'use strict';

const assert=require('assert');
const Bundle=require('../js/netwizard-deployment-bundle.js');

const generatedAt='2026-09-15T12:34:56.000Z';
const project={
  projName:'Oficina Norte',
  devices:[
    {id:'sw1',name:'SW Core',kind:'switch',type:'switch',vendorOs:'cisco_ios'},
    {id:'fw1',name:'FW Edge',kind:'firewall',type:'firewall',vendorOs:'fortinet'}
  ],
  ports:[],vlans:[],subnets:[],hosts:[],links:[],fwRules:[],dhcp:{},vlanMatrix:{}
};
const readyReport={ok:true,ready:true,canExport:true,status:'ready',productionMode:true,strict:true,issues:[],counts:{errors:0,warnings:0,info:0,blocking:0,byCategory:{}}};
const fakeGate={
  runProductionGate(_project,options){assert.deepStrictEqual(options,{productionMode:true,strict:true});return JSON.parse(JSON.stringify(readyReport));},
  exportChecklistMarkdown(report){return `# Checklist\n\nEstado: ${report.status}\n`;}
};
const fakeSchema={schemaVersion:'3.50.0',prepareExport(value){return{format:'netwizard-project',schemaVersion:'3.50.0',exportedAt:'replaced',project:value};}};
const fakeDocs={
  INVENTORY_COLUMNS:['section','name'],
  buildInventoryRows(){return[{section:'Dispositivos',name:'SW Core'}];},
  buildConnectivityMatrix(){return[{source:'VLAN 10',destination:'Internet',action:'ALLOW',services:'HTTPS',reason:'policy',sourceType:'intent'}];},
  buildMarkdownDocument(_project,options){return `# Documentación\n\n${options.generatedAt}`;},
  toCsv(rows,columns){return [columns.join(','),...rows.map(row=>columns.map(key=>row[key]||'').join(','))].join('\n');}
};
function generateConfig(id,vendor){return `! ${vendor}\nhostname ${id}\ninterface ethernet1\n description deployment-test\n`;}
function build(extra){return Bundle.buildDeploymentPackage(project,Object.assign({generatedAt,gate:fakeGate,schema:fakeSchema,documentation:fakeDocs,generateConfig},extra||{}));}

const pkg=build();
assert.strictEqual(pkg.ok,true);
assert.strictEqual(pkg.blocked,false);
assert.strictEqual(pkg.filename,'Oficina-Norte-deployment-2026-09-15.zip');
assert.strictEqual(pkg.report.generatedAt,generatedAt);
assert.strictEqual(pkg.manifest.format,'netwizard-deployment-bundle');
assert.strictEqual(pkg.manifest.schemaVersion,'3.50.0');
assert.strictEqual(pkg.manifest.counts.devices,2);
assert.strictEqual(pkg.manifest.counts.files,pkg.files.length);
assert.ok(pkg.files.some(file=>file.path==='configs/01-FW-Edge-fw1-fortinet.conf'));
assert.ok(pkg.files.some(file=>file.path==='configs/02-SW-Core-sw1-cisco_ios.cfg'));
for(const required of ['manifest.json','README.md','project/netwizard-project.json','reports/production-gate.json','reports/production-checklist.md','reports/inventory.csv','reports/connectivity-matrix.csv','reports/documentation.md']){
  assert.ok(pkg.files.some(file=>file.path===required),`Falta ${required}`);
}
assert.ok(pkg.manifest.files.every(file=>/^[0-9a-f]{8}$/.test(file.crc32)));
assert.strictEqual(Bundle.crc32('123456789').toString(16),'cbf43926');
assert.strictEqual(Bundle.configExtension('aruba_aoss'),'cfg');
assert.strictEqual(Bundle.configExtension('windows'),'ps1');

const zipA=Bundle.encodeZip(pkg);
const zipB=Bundle.encodeZip(build());
assert.deepStrictEqual(zipA,zipB,'mismo proyecto y fecha deben producir el mismo ZIP');
assert.strictEqual(new DataView(zipA.buffer,zipA.byteOffset,4).getUint32(0,true),0x04034b50);
assert.ok(Buffer.from(zipA).includes(Buffer.from('manifest.json')));
assert.ok(Buffer.from(zipA).includes(Buffer.from('netwizard-deployment-bundle')));
const zipView=new DataView(zipA.buffer,zipA.byteOffset,zipA.byteLength);
const eocd=zipA.length-22;
assert.strictEqual(zipView.getUint32(eocd,true),0x06054b50);
assert.strictEqual(zipView.getUint16(eocd+10,true),pkg.files.length);
const centralSize=zipView.getUint32(eocd+12,true);
const centralOffset=zipView.getUint32(eocd+16,true);
assert.strictEqual(centralOffset+centralSize,eocd);
let centralCursor=centralOffset;
for(const file of pkg.files){
  assert.strictEqual(zipView.getUint32(centralCursor,true),0x02014b50);
  const nameLength=zipView.getUint16(centralCursor+28,true);
  const extraLength=zipView.getUint16(centralCursor+30,true);
  const commentLength=zipView.getUint16(centralCursor+32,true);
  const localOffset=zipView.getUint32(centralCursor+42,true);
  assert.strictEqual(zipView.getUint32(localOffset,true),0x04034b50);
  const name=Buffer.from(zipA.slice(centralCursor+46,centralCursor+46+nameLength)).toString('utf8');
  assert.strictEqual(name,file.path);
  centralCursor+=46+nameLength+extraLength+commentLength;
}
assert.strictEqual(centralCursor,eocd);

let generated=false;
const blocked=build({
  gate:{runProductionGate(){return{canExport:false,status:'blocked',issues:[{code:'NW-IP-001',severity:'error',blocking:true,message:'IP duplicada'}],counts:{errors:1,warnings:0}};},exportChecklistMarkdown(){return'';}},
  generateConfig(){generated=true;return'config';}
});
assert.strictEqual(blocked.ok,false);
assert.strictEqual(blocked.blocked,true);
assert.strictEqual(blocked.files.length,0);
assert.strictEqual(generated,false,'no debe generar configuraciones si la puerta bloquea');
assert.throws(()=>Bundle.encodeZip(blocked),/paquete bloqueado/i);

const invalidConfig=build({generateConfig(){return'! Sin vendor asignado';}});
assert.strictEqual(invalidConfig.ok,false);
assert.strictEqual(invalidConfig.issues[0].code,'NW-BUNDLE-011');

const schemaFailure=build({schema:{prepareExport(){throw new Error('schema roto');}}});
assert.strictEqual(schemaFailure.ok,false);
assert.strictEqual(schemaFailure.issues[0].code,'NW-BUNDLE-002');

const docsFailure=build({documentation:Object.assign({},fakeDocs,{buildMarkdownDocument(){throw new Error('docs rotas');}})});
assert.strictEqual(docsFailure.ok,false);
assert.strictEqual(docsFailure.issues[0].code,'NW-BUNDLE-020');

console.log('✓ Deployment Bundle bloquea errores y genera un ZIP determinista con artefactos completos');
