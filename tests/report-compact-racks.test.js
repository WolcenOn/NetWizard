'use strict';
const assert=require('assert');
const report=require('../js/netwizard-detailed-report-v3.js');
const reportModel=require('../js/netwizard-report-model.js');

const gate={issues:[{code:'NW-RACK-001',severity:'error',blocking:true,category:'rack',message:'Rack HQ: colisión en U20.'}],counts:{blocking:1,errors:1,warnings:0}};
const project={
  _schemaVersion:'3.50.0',
  projName:'Proyecto Rack',
  physicalLocations:[{id:'loc1',name:'CPD'}],
  racks:[{id:'rack1',name:'Rack HQ',locationId:'loc1',rackUnits:42,powerCapacityWatts:4000,coolingCapacityWatts:3500}],
  devices:[
    {id:'sw1',name:'SW-CORE',type:'switch',vendor:'Cisco',model:'C9300',rackId:'rack1',rackUnit:20,rackUnits:1,powerDrawWatts:180},
    {id:'srv1',name:'SRV-01',type:'server',vendor:'Dell',model:'R650',rackId:'rack1',rackUnit:16,rackUnits:2,powerDrawWatts:420}
  ],
  rackItems:[
    {id:'ri-sw1',rackId:'rack1',type:'device',deviceId:'sw1',startUnit:20,heightUnits:1,label:'SW-CORE',face:'front',powerDrawWatts:180},
    {id:'ri-srv1',rackId:'rack1',type:'device',deviceId:'srv1',startUnit:16,heightUnits:2,label:'SRV-01',face:'front',powerDrawWatts:420},
    {id:'ri-pp1',rackId:'rack1',type:'patch-panel',patchPanelId:'pp1',startUnit:22,heightUnits:1,label:'Patch panel Cat6A',face:'front'},
    {id:'ri-rear1',rackId:'rack1',type:'cable-manager',startUnit:10,heightUnits:1,label:'Pasacables trasero',face:'rear'}
  ],
  pdus:[
    {id:'pdu1',rackId:'rack1',name:'PDU A',feed:'A',outletCount:12,maxPowerWatts:3680},
    {id:'pdu2',rackId:'rack1',name:'PDU B',feed:'B',outletCount:12,maxPowerWatts:3680}
  ],
  powerConnections:[{id:'pc1',deviceId:'sw1',pduId:'pdu1',outlet:1,powerSupplyIndex:0,feed:'A'}],
  ports:[
    {id:'p1',deviceId:'sw1',name:'Gi1/0/1',mode:'trunk',media:'fiber'},
    {id:'p2',deviceId:'srv1',name:'Eth0',mode:'access',media:'fiber'},
    {id:'p3',deviceId:'sw1',name:'Gi1/0/2',mode:'access',media:'copper'},
    {id:'p4',deviceId:'sw1',name:'Gi1/0/3',mode:'access',media:'copper'}
  ],
  links:[{id:'l1',name:'Uplink servidor',fromPortId:'p1',toPortId:'p2',medium:'OM4 multimode',capacityMbps:10000,physicalPath:'Interior Rack HQ'}],
  hosts:[{id:'h1',name:'PC-01'}],
  vlans:[],wanCircuits:[],
  patchPanels:[{id:'pp1',rackId:'rack1',name:'PP-01',portCount:24,category:'Cat6A'}],
  telecomOutlets:[{id:'to1',locationId:'loc1',name:'TO-01',portCount:1,category:'Cat6A'}],
  cableRuns:[{id:'run1',patchPanelId:'pp1',patchPort:1,outletId:'to1',outletPort:1,cableType:'Cat6A',lengthM:30,route:'CPD → oficina'}],
  patchConnections:[{id:'patch1',patchPanelId:'pp1',patchPort:1,switchPortId:'p3',patchCordLengthM:1}],
  hostOutletConnections:[{id:'host1',hostId:'h1',outletId:'to1',outletPort:1,patchCordLengthM:2}]
};

const model=reportModel.build(project,{gateReport:gate});
assert.strictEqual(model.portMatrices.length,2);
const switchMatrix=model.portMatrices.find(x=>x.deviceId==='sw1');
assert.ok(switchMatrix);
assert.strictEqual(switchMatrix.ports.find(x=>x.id==='p1').destination,'SRV-01');
assert.strictEqual(switchMatrix.ports.find(x=>x.id==='p1').remotePort,'Eth0');
assert.strictEqual(switchMatrix.ports.find(x=>x.id==='p1').mediaKind,'fiber-mm');
assert.strictEqual(switchMatrix.ports.find(x=>x.id==='p3').destination,'PC-01');
assert.strictEqual(switchMatrix.ports.find(x=>x.id==='p3').mediaKind,'copper');
assert.strictEqual(switchMatrix.ports.find(x=>x.id==='p4').destination,'Libre');
assert.ok(model.powerMap.rows.some(x=>x.deviceId==='sw1'&&x.pduName==='PDU A'&&x.outlet===1));
assert.ok(model.powerMap.rows.some(x=>x.deviceId==='srv1'&&x.status==='missing'));
assert.strictEqual(model.structuredChains.length,1);
assert.strictEqual(model.structuredChains[0].switchDeviceName,'SW-CORE');
assert.strictEqual(model.structuredChains[0].patchPanelName,'PP-01');
assert.strictEqual(model.structuredChains[0].outletName,'TO-01');
assert.strictEqual(model.structuredChains[0].hostName,'PC-01');
assert.strictEqual(model.structuredChains[0].totalLengthM,33);
assert.ok(model.rackSummaries.some(x=>x.rackId==='rack1'&&x.dataLinks===1&&x.structuredRuns===1));
assert.strictEqual(model.rackTopologies[0].dataEdges.length,1);
assert.strictEqual(model.rackTopologies[0].dataEdges[0].media,'OM4 multimode');
assert.ok(model.installationChecklist.some(x=>x.category==='Parcheo'&&x.task.includes('Gi1/0/2')));
assert.ok(model.installationChecklist.some(x=>x.category==='Energía'&&x.task.includes('SRV-01')&&!x.documented));

const html=report.build(project,{gateReport:gate});
assert.ok(html.includes('Manual técnico de instalación'));
assert.ok(html.includes('Estado de preparación para instalación'));
assert.ok(html.includes('Preparación'));
assert.ok(html.includes('Documento operativo para montaje, alimentación, cableado, etiquetado, certificación y aceptación.'));
assert.ok(html.includes('readiness-pending'));
assert.ok(html.includes('Resumen por armario / rack'));
assert.ok(html.includes('Elevaciones frontal y trasera'));
assert.ok(html.includes('Vista frontal'));
assert.ok(html.includes('Vista trasera'));
assert.ok(html.includes('Pasacables trasero'));
assert.ok(html.includes('rear-pdu-rail'));
assert.ok(html.includes('U42'));
assert.ok(html.includes('Racks y ocupación'));
assert.ok(html.includes('Matrices de puertos por equipo'));
assert.ok(html.includes('Destino'));
assert.ok(html.includes('Puerto remoto'));
assert.ok(html.includes('Medio'));
assert.ok(html.includes('Ruta / uso'));
assert.ok(html.includes('Gi1/0/1'));
assert.ok(html.includes('Eth0'));
assert.ok(html.includes('OM4 multimode'));
assert.ok(html.includes('media-fiber-mm'));
assert.ok(html.includes('Cat6A'));
assert.ok(html.includes('media-copper'));
assert.ok(html.includes('Leyenda de medios y cableado'));
assert.ok(html.includes('Fibra multimodo'));
assert.ok(html.includes('Mapa de alimentación PDU / PSU'));
assert.ok(html.includes('PDU A'));
assert.ok(html.includes('PDU B'));
assert.ok(html.includes('PSU-1'));
assert.ok(html.includes('Sin conexión declarada'));
assert.ok(html.includes('Feed A'));
assert.ok(html.includes('Feed B'));
assert.ok(html.includes('U20'));
assert.ok(html.includes('U16–U17'));
assert.ok(html.includes('Patch panel Cat6A'));
assert.ok(html.includes('Cadena completa de cableado estructurado'));
assert.ok(html.includes('Switch'));
assert.ok(html.includes('Patch panel'));
assert.ok(html.includes('Enlace permanente'));
assert.ok(html.includes('Equipo final'));
assert.ok(html.includes('33 m totales'));
assert.ok(html.includes('Checklist de instalación'));
assert.ok(html.includes('Certificar enlace'));
assert.ok(html.includes('Documentación'));
assert.ok(html.includes('☐'));
assert.ok(html.includes('CPD → oficina'));
assert.ok(html.includes('PC-01'));
assert.ok(html.includes('BLOQUEADO'));
assert.ok(html.includes('Aceptación y cierre de instalación'));
assert.ok(html.includes('Técnico instalador'));
assert.ok(html.includes('☐ Conforme'));
assert.ok(html.includes('@page{size:A4 landscape'));
assert.ok(html.includes('Manual técnico de instalación</title>'));
assert.ok(html.includes('🧰 Informe de instalación')===false,'El texto del botón se inyecta en la UI, no dentro del HTML generado');
console.log('✓ Informe de instalación fase 3 añade elevaciones frontal/trasera, PDF A4 y cierre listo para técnico');
