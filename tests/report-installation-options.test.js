'use strict';

const assert=require('assert');
const modelApi=require('../js/netwizard-report-model.js');
const report=require('../js/netwizard-detailed-report-v3.js');

const project={
  _schemaVersion:'3.50.0',
  projName:'Instalación etiquetas',
  physicalLocations:[{id:'loc1',name:'CPD'},{id:'loc2',name:'Oficina'}],
  racks:[{id:'rack1',name:'RACK-CPD-01',locationId:'loc1',rackUnits:42}],
  devices:[
    {id:'sw1',name:'SW-CORE',type:'switch',rackId:'rack1',rackUnit:20,mgmtIp:'10.0.0.2'},
    {id:'srv1',name:'SRV-01',type:'server',rackId:'rack1',rackUnit:16,mgmtIp:'10.0.0.10'}
  ],
  rackItems:[
    {id:'ri-sw1',rackId:'rack1',type:'device',deviceId:'sw1',startUnit:20,heightUnits:1,label:'SW-CORE',face:'front'},
    {id:'ri-srv1',rackId:'rack1',type:'device',deviceId:'srv1',startUnit:16,heightUnits:2,label:'SRV-01',face:'front'},
    {id:'ri-cm1',rackId:'rack1',type:'cable-manager',startUnit:18,heightUnits:1,label:'PASACABLES-01',face:'front'}
  ],
  pdus:[{id:'pdu1',rackId:'rack1',name:'PDU-A',feed:'A',outletCount:12}],
  powerConnections:[{id:'pc1',deviceId:'sw1',pduId:'pdu1',outlet:1,powerSupplyIndex:0,feed:'A'}],
  ports:[
    {id:'p1',deviceId:'sw1',name:'Te1/1',mode:'trunk',media:'fiber'},
    {id:'p2',deviceId:'srv1',name:'Eth0',mode:'access',media:'fiber'},
    {id:'p3',deviceId:'sw1',name:'Gi1/0/2',mode:'access',media:'copper'}
  ],
  links:[{id:'l1',name:'Uplink servidor',cableId:'CAB-DIRECT-01',fromPortId:'p1',toPortId:'p2',medium:'OM4 multimode',capacityMbps:10000,physicalPath:'Interior rack'}],
  hosts:[{id:'h1',name:'PC-01',physicalLocation:'Oficina'}],
  vlans:[],wanCircuits:[],
  patchPanels:[{id:'pp1',rackId:'rack1',name:'PP-01',portCount:24,category:'Cat6A'}],
  telecomOutlets:[{id:'to1',locationId:'loc2',name:'TO-01',portCount:1,category:'Cat6A'}],
  cableRuns:[{id:'run1',label:'CAB-OFI-01',patchPanelId:'pp1',patchPort:1,outletId:'to1',outletPort:1,cableType:'Cat6A',lengthM:25,route:'CPD → Oficina'}],
  patchConnections:[{id:'patch1',patchPanelId:'pp1',patchPort:1,switchPortId:'p3',patchCordLengthM:1}],
  hostOutletConnections:[{id:'host1',hostId:'h1',outletId:'to1',outletPort:1,patchCordLengthM:2}]
};
const gate={issues:[],counts:{blocking:0,errors:0,warnings:0}};

const model=modelApi.build(project,{gateReport:gate});
assert.strictEqual(model.version,'netwizard-report-model-v4');
assert.ok(model.connectionOverview.nodes.some(n=>n.id==='device:sw1'));
assert.ok(model.connectionOverview.nodes.some(n=>n.id==='host:h1'));
assert.ok(model.connectionOverview.edges.some(e=>e.kind==='direct'&&e.fromPort==='Te1/1'&&e.toPort==='Eth0'));
assert.ok(model.connectionOverview.edges.some(e=>e.kind==='structured'&&e.label==='CAB-OFI-01'));

assert.ok(model.installationLabels.total>0);
assert.strictEqual(model.installationLabels.items.filter(x=>x.kind==='rack'&&x.code==='RACK-CPD-01').length,1);
assert.strictEqual(model.installationLabels.items.filter(x=>x.kind==='device'&&x.code==='SW-CORE').length,1);
assert.strictEqual(model.installationLabels.items.filter(x=>x.kind==='cable-data'&&x.code==='CAB-DIRECT-01').length,2);
assert.strictEqual(model.installationLabels.items.filter(x=>x.kind==='cable-structured'&&x.code==='CAB-OFI-01').length,2);
assert.strictEqual(model.installationLabels.items.filter(x=>x.kind==='cable-power').length,2);
assert.ok(model.installationLabels.items.some(x=>x.kind==='patch-panel'&&x.code==='PP-01'));
assert.ok(model.installationLabels.items.some(x=>x.kind==='outlet'&&x.code==='TO-01'));
assert.ok(model.installationLabels.items.some(x=>x.kind==='pdu'&&x.code==='PDU-A'));
assert.ok(model.installationLabels.items.some(x=>x.kind==='rack-item'&&x.code==='PASACABLES-01'));

const defaultHtml=report.build(project,{gateReport:gate});
assert.ok(defaultHtml.includes('Esquema general de conexión de equipos'));
assert.ok(defaultHtml.includes('connection-diagram-card'));
assert.ok(defaultHtml.includes('SW-CORE'));
assert.ok(defaultHtml.includes('SRV-01'));
assert.ok(defaultHtml.includes('Te1/1'));
assert.ok(defaultHtml.includes('Eth0'));
assert.ok(defaultHtml.includes('CAB-OFI-01'));
assert.ok(defaultHtml.includes('Hojas de etiquetas imprimibles'),'Las etiquetas deben formar parte del manual técnico por defecto');
assert.ok(defaultHtml.includes('CAB-DIRECT-01'));
assert.ok(defaultHtml.includes('CAB-OFI-01'));

const connectionsOnly=report.build(project,{gateReport:gate,sections:['connection-diagram','direct-connectivity']});
assert.ok(connectionsOnly.includes('Esquema general de conexión de equipos'));
assert.ok(connectionsOnly.includes('Conectividad directa de datos'));
assert.ok(!connectionsOnly.includes('Matrices de puertos por equipo'));
assert.ok(!connectionsOnly.includes('Estado de preparación para instalación'));

const labelsOnly=report.build(project,{gateReport:gate,sections:['labels'],labelsOnly:true,labelPreset:'cable-3x12'});
assert.ok(labelsOnly.includes('Hojas de etiquetas imprimibles'));
assert.ok(labelsOnly.includes('A4 · 3 × 12 etiquetas de cable'));
assert.ok(labelsOnly.includes('CAB-DIRECT-01'));
assert.ok(labelsOnly.includes('CAB-OFI-01'));
assert.ok(labelsOnly.includes('RACK-CPD-01'));
assert.ok(labelsOnly.includes('SW-CORE'));
assert.ok(labelsOnly.includes('Extremo A'));
assert.ok(labelsOnly.includes('Extremo B'));
assert.ok(labelsOnly.includes('@page labels{size:A4 portrait'));
assert.ok(labelsOnly.includes('--label-cols:3'));
assert.ok(!labelsOnly.includes('Estado de preparación para instalación'));

const custom=report.selectedSections({sections:['cover','labels']});
assert.deepStrictEqual([...custom],['cover','labels']);
assert.ok(report.SECTION_DEFS.some(x=>x.id==='connection-diagram'&&x.default===true));
assert.ok(report.SECTION_DEFS.some(x=>x.id==='labels'&&x.default===true));
assert.ok(report.selectedSections({}).has('labels'));
assert.ok(report.LABEL_PRESETS['a4-3x8']);
assert.ok(report.LABEL_PRESETS['a4-2x7']);
assert.ok(report.LABEL_PRESETS['cable-3x12']);

console.log('✓ Informe de instalación permite seleccionar secciones, muestra topología y genera hojas de etiquetas');