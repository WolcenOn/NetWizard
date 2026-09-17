'use strict';

const assert=require('assert');
const Bundle=require('../js/netwizard-deployment-bundle.js');
const ChangeSet=require('../js/netwizard-change-set.js');
const Incremental=require('../js/netwizard-incremental-generators.js');

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
const fakeRunbook={
  buildDeploymentPlan(value,options){return{ok:true,format:'netwizard-deployment-plan',version:'3.50.0',projectName:value.projName,generatedAt:options.generatedAt,strategy:'staged',observationMinutes:15,phases:[{id:'edge',steps:['deploy-01']}],steps:value.devices.map((device,index)=>({id:`deploy-${index+1}`,deviceId:device.id,deviceName:device.name,configPath:options.configPaths[device.id]})),issues:[],warnings:[],prechecks:[],stopCriteria:[],postchecks:[],rollbackPlan:[],snapshotWarning:'NO es un backup'};},
  buildMarkdown(){return'# Runbook\n';},
  buildRollbackMarkdown(){return'# Rollback\n';}
};
const fakeChangeSet={
  buildChangeSet(value,options){return{ok:true,format:'netwizard-change-set',version:'3.50.0',generatedAt:options.generatedAt,projectName:value.projName,requestedMode:'full',executionMode:'full-target',observedAt:null,coverage:{devices:value.devices.length,observed:0,missing:value.devices.length,changed:0,noChange:0},issues:[],devices:value.devices.map(device=>({deviceId:device.id,deviceName:device.name,vendor:device.vendorOs,status:'baseline-required',capturedAt:null,observedFingerprint:null,desiredFingerprint:'fnv1a32:00000000',stats:{addedLines:1,removedLines:0}})),artifacts:[],warning:'diff no ejecutable'};},
  buildSummaryMarkdown(){return'# Change set\n';},
  buildPostChangeChecklist(){return'# Evidencias posteriores\n';},
  publicChangeSet(value){const copy=JSON.parse(JSON.stringify(value));delete copy.artifacts;return copy;}
};
const fakeIncremental={
  buildPlan(value,options){return{ok:true,format:'netwizard-incremental-plan',version:'3.50.0',generatedAt:options.generatedAt,projectName:value.projName,mode:options.changeSet.requestedMode,requireExecutableIncremental:false,registry:[{id:'junos.set-delta',vendors:['juniper_junos']}],counts:{devices:value.devices.length,candidateReady:0,manualReview:0,noChange:0,fullTarget:value.devices.length},issues:[],devices:value.devices.map(device=>({deviceId:device.id,deviceName:device.name,vendor:device.vendorOs,status:'full-target',adapterId:null,applyPath:null,rollbackPath:null,commandCounts:{additions:0,deletions:0}})),artifacts:[],warning:'solo candidatos seguros'};},
  buildSummaryMarkdown(){return'# Plan incremental\n';},
  publicPlan(value){const copy=JSON.parse(JSON.stringify(value));delete copy.artifacts;return copy;}
};
function generateConfig(id,vendor){return `! ${vendor}\nhostname ${id}\ninterface ethernet1\n description deployment-test\n`;}
function build(extra){return Bundle.buildDeploymentPackage(project,Object.assign({generatedAt,gate:fakeGate,schema:fakeSchema,documentation:fakeDocs,runbook:fakeRunbook,changeSet:fakeChangeSet,incremental:fakeIncremental,generateConfig},extra||{}));}

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
for(const required of ['manifest.json','README.md','project/netwizard-project.json','reports/production-gate.json','reports/production-checklist.md','reports/inventory.csv','reports/connectivity-matrix.csv','reports/documentation.md','deployment/plan.json','deployment/runbook.md','deployment/rollback-checklist.md','changes/change-set.json','changes/summary.md','incremental/plan.json','incremental/summary.md','evidence/pre-change.json','evidence/post-change-checklist.md']){
  assert.ok(pkg.files.some(file=>file.path===required),`Falta ${required}`);
}
assert.ok(pkg.manifest.files.every(file=>/^[0-9a-f]{8}$/.test(file.crc32)));
assert.strictEqual(pkg.manifest.deployment.steps,2);
assert.strictEqual(pkg.manifest.changeSet.executionMode,'full-target');
assert.strictEqual(pkg.manifest.incremental.mode,'full');
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

const runbookFailure=build({runbook:Object.assign({},fakeRunbook,{buildDeploymentPlan(){return{ok:false,issues:[{code:'NW-RUNBOOK-001',severity:'error',blocking:true,message:'ciclo'}]};}})});
assert.strictEqual(runbookFailure.ok,false);
assert.strictEqual(runbookFailure.issues[0].code,'NW-RUNBOOK-001');

const changeSetFailure=build({changeSet:Object.assign({},fakeChangeSet,{buildChangeSet(){return{ok:false,issues:[{code:'NW-CHANGE-001',severity:'error',blocking:true,message:'snapshot ausente'}]};}})});
assert.strictEqual(changeSetFailure.ok,false);
assert.strictEqual(changeSetFailure.issues[0].code,'NW-CHANGE-001');

const incrementalFailure=build({incremental:Object.assign({},fakeIncremental,{buildPlan(){return{ok:false,issues:[{code:'NW-INCREMENTAL-002',severity:'error',blocking:true,message:'adaptador ausente'}]};}})});
assert.strictEqual(incrementalFailure.ok,false);
assert.strictEqual(incrementalFailure.issues[0].code,'NW-INCREMENTAL-002');

const incrementalProject=JSON.parse(JSON.stringify(project));
incrementalProject.deployment={changeMode:'incremental',maxObservedAgeHours:24};
incrementalProject.observedState={observedAt:'2026-09-15T11:00:00.000Z',deviceConfigs:{
  sw1:{vendor:'cisco_ios',content:generateConfig('sw1','cisco_ios'),capturedAt:'2026-09-15T11:00:00.000Z'},
  fw1:{vendor:'fortinet',content:'! fortinet\nhostname fw1\ninterface ethernet1\n description old-value\n',capturedAt:'2026-09-15T11:00:00.000Z'}
}};
const incremental=Bundle.buildDeploymentPackage(incrementalProject,{generatedAt,gate:fakeGate,schema:fakeSchema,documentation:fakeDocs,runbook:fakeRunbook,changeSet:ChangeSet,incremental:fakeIncremental,generateConfig});
assert.strictEqual(incremental.ok,true);
assert.strictEqual(incremental.manifest.changeSet.executionMode,'reviewed-incremental');
assert.strictEqual(incremental.manifest.changeSet.observedDevices,2);
assert.strictEqual(incremental.manifest.changeSet.changedDevices,1);
assert.ok(incremental.files.some(file=>file.path.startsWith('changes/patches/')&&file.path.endsWith('.diff')));
assert.ok(incremental.files.some(file=>file.path.startsWith('changes/rollback/')&&file.path.endsWith('.diff')));

const junosProject={projName:'Junos incremental',devices:[{id:'r1',name:'Edge Junos',kind:'router',vendorOs:'juniper_junos'}],ports:[],vlans:[],subnets:[],hosts:[],links:[],fwRules:[],dhcp:{},vlanMatrix:{},deployment:{changeMode:'incremental',maxObservedAgeHours:24,requireExecutableIncremental:true},observedState:{observedAt:'2026-09-15T11:00:00.000Z',deviceConfigs:{r1:{vendor:'juniper_junos',capturedAt:'2026-09-15T11:00:00.000Z',content:'set system host-name OLD\nset system services ssh\n'}}}};
const junosDesired='set system host-name NEW\nset system services ssh\nset routing-options static route 0.0.0.0/0 next-hop 192.0.2.1\n';
const junosBundle=Bundle.buildDeploymentPackage(junosProject,{generatedAt,gate:fakeGate,schema:fakeSchema,documentation:fakeDocs,runbook:fakeRunbook,changeSet:ChangeSet,incremental:Incremental,generateConfig(){return junosDesired;}});
assert.strictEqual(junosBundle.ok,true);
assert.strictEqual(junosBundle.manifest.incremental.candidateReady,1);
assert.strictEqual(junosBundle.manifest.incremental.manualReview,0);
assert.ok(junosBundle.files.some(file=>file.path.startsWith('incremental/commands/')&&/delete system host-name OLD/.test(file.content)));
assert.ok(junosBundle.files.some(file=>file.path.startsWith('incremental/rollback/')&&/set system host-name OLD/.test(file.content)));

const ciscoProject={projName:'Cisco incremental',devices:[{id:'sw1',name:'Access Cisco',kind:'switch',vendorOs:'cisco_ios'}],ports:[],vlans:[],subnets:[],hosts:[],links:[],fwRules:[],dhcp:{},vlanMatrix:{},deployment:{changeMode:'incremental',maxObservedAgeHours:24,requireExecutableIncremental:true},observedState:{observedAt:'2026-09-15T11:00:00.000Z',deviceConfigs:{sw1:{vendor:'cisco_ios',capturedAt:'2026-09-15T11:00:00.000Z',content:'hostname ACCESS-1\ninterface GigabitEthernet1/0/1\n switchport\n switchport mode access\n switchport access vlan 10\n no shutdown\n exit\n'}}}};
const ciscoDesired='configure terminal\nhostname ACCESS-1\nvlan 20\n name Voice\n exit\ninterface GigabitEthernet1/0/1\n switchport\n switchport mode access\n switchport access vlan 20\n no shutdown\n exit\nend\nwrite memory\n';
const ciscoBundle=Bundle.buildDeploymentPackage(ciscoProject,{generatedAt,gate:fakeGate,schema:fakeSchema,documentation:fakeDocs,runbook:fakeRunbook,changeSet:ChangeSet,incremental:Incremental,generateConfig(){return ciscoDesired;}});
assert.strictEqual(ciscoBundle.ok,true);
assert.strictEqual(ciscoBundle.manifest.incremental.candidateReady,1);
assert.strictEqual(ciscoBundle.manifest.incremental.manualReview,0);
assert.ok(ciscoBundle.files.some(file=>file.path.startsWith('incremental/commands/')&&file.path.endsWith('.cfg')&&/switchport access vlan 20/.test(file.content)));
assert.ok(ciscoBundle.files.some(file=>file.path.startsWith('incremental/rollback/')&&file.path.endsWith('.cfg')&&/switchport access vlan 10/.test(file.content)));

const fortiProject={projName:'FortiOS incremental',devices:[{id:'fw1',name:'FortiGate Edge',kind:'firewall',vendorOs:'fortinet'}],ports:[],vlans:[],subnets:[],hosts:[],links:[],fwRules:[],dhcp:{},vlanMatrix:{},deployment:{changeMode:'incremental',maxObservedAgeHours:24,requireExecutableIncremental:true},observedState:{observedAt:'2026-09-15T11:00:00.000Z',deviceConfigs:{fw1:{vendor:'fortinet',capturedAt:'2026-09-15T11:00:00.000Z',content:'config system global\n set hostname "FW-OLD"\nend\nconfig router static\n edit 10\n  set dst 0.0.0.0/0\n  set gateway 203.0.113.1\n next\nend\n'}}}};
const fortiDesired='config system global\n set hostname "FW1"\nend\nconfig router static\n edit 10\n  set dst 0.0.0.0/0\n  set gateway 203.0.113.254\n next\nend\n';
const fortiBundle=Bundle.buildDeploymentPackage(fortiProject,{generatedAt,gate:fakeGate,schema:fakeSchema,documentation:fakeDocs,runbook:fakeRunbook,changeSet:ChangeSet,incremental:Incremental,generateConfig(){return fortiDesired;}});
assert.strictEqual(fortiBundle.ok,true);
assert.strictEqual(fortiBundle.manifest.incremental.candidateReady,1);
assert.strictEqual(fortiBundle.manifest.incremental.manualReview,0);
assert.ok(fortiBundle.files.some(file=>file.path.startsWith('incremental/commands/')&&file.path.endsWith('.conf')&&/set gateway 203\.0\.113\.254/.test(file.content)));
assert.ok(fortiBundle.files.some(file=>file.path.startsWith('incremental/rollback/')&&file.path.endsWith('.conf')&&/set gateway 203\.0\.113\.1/.test(file.content)));

console.log('✓ Deployment Bundle bloquea errores y genera un ZIP determinista con artefactos completos');
