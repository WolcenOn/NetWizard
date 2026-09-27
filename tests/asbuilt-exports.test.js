'use strict';

const assert=require('assert');
global.NetWizardDocumentationUtils=require('../js/netwizard-documentation-utils.js');
global.NetWizardRackModel=require('../js/netwizard-rack-model.js');
global.NetWizardPhysicalInterventionPlan=require('../js/netwizard-physical-intervention-plan.js');
global.NetWizardFieldInterventionPackage=require('../js/netwizard-field-intervention-package.js');
const Exports=require('../js/netwizard-asbuilt-exports.js');

const project={
  _schemaVersion:'3.50.0',
  projName:'Sede export',
  workflow:{mode:'inventory'},
  physicalLocations:[
    {id:'site1',name:'Sede',type:'site'},
    {id:'room1',name:'CPD',type:'room',parentId:'site1'}
  ],
  racks:[{id:'rack1',name:'RACK-01',locationId:'room1',rackUnits:24}],
  rackItems:[{id:'ri1',rackId:'rack1',type:'device',deviceId:'sw1',label:'SW-01',startUnit:18,heightUnits:1,face:'front'}],
  devices:[{id:'sw1',name:'SW-01',type:'switch',kind:'switch',manufacturer:'ACME',model:'X48',serialNumber:'SN1',assetTag:'AT1',vendorOs:'cisco_ios',mgmtIp:'10.0.0.2',locationId:'room1',rackId:'rack1',rackUnit:18,rackUnits:1,powerDrawWatts:100}],
  ports:[
    {id:'p1',deviceId:'sw1',name:'Gi1/0/1',mode:'access',media:'GE',speedMaxMbps:1000,accessVlanRef:'v10',adminState:'up',operState:'up'},
    {id:'p2',deviceId:'sw1',name:'Gi1/0/2',mode:'access',media:'GE',speedMaxMbps:1000}
  ],
  links:[],
  vlans:[{id:'v10',vlanId:10,name:'Usuarios'}],
  subnets:[{id:'sn10',vlanRef:'v10',cidr:'10.10.0.0/24',gateway:'10.10.0.1'}],
  hosts:[],fwRules:[],dhcp:{},
  pdus:[{id:'pdu1',name:'PDU-A',rackId:'rack1',feed:'A',outletCount:8,maxPowerWatts:3680}],
  powerConnections:[{id:'pw1',deviceId:'sw1',pduId:'pdu1',outlet:1,powerSupplyIndex:0,feed:'A'}],
  patchPanels:[{id:'pp1',rackId:'rack1',name:'PP-01',portCount:24,category:'Cat6A'}],
  telecomOutlets:[{id:'to1',locationId:'room1',name:'TO-01',portCount:1,category:'Cat6A'}],
  cableRuns:[{id:'c1',label:'C-001',patchPanelId:'pp1',patchPort:1,outletId:'to1',outletPort:1,cableType:'Cat6A',lengthM:25,route:'Bandeja A'}],
  patchConnections:[{id:'pc1',patchPanelId:'pp1',patchPort:1,switchPortId:'p1',patchCordLengthM:1}],
  hostOutletConnections:[],
  customDeviceModels:[],iot:{accessNodes:[],devices:[],map:{show:{}}}
};

const original=JSON.parse(JSON.stringify(project));
const tables=Exports.buildTables(project);
assert.deepStrictEqual(project,original,'Los exports no deben mutar el proyecto');
assert.strictEqual(tables.devices.length,1);
assert.strictEqual(tables.devices[0].location,'Sede / CPD');
assert.strictEqual(tables.devices[0].serialNumber,'SN1');
assert.strictEqual(tables.ports.length,2);
assert.strictEqual(tables.ports[0].device,'SW-01');
assert.strictEqual(tables.cables.length,1);
assert.strictEqual(tables.cables[0].patchPanel,'PP-01');
assert.strictEqual(tables.cables[0].outlet,'TO-01');
assert.strictEqual(tables.cables[0].outletLocation,'Sede / CPD');
assert.strictEqual(tables.pdus.length,1);
assert.strictEqual(tables.power.length,1);
assert.strictEqual(tables.power[0].pdu,'PDU-A');
assert.ok(tables.racks.some(r=>r.rack==='RACK-01'&&r.startUnit===18));
assert.ok(tables.bom.some(r=>r.kind==='Rack'));
assert.ok(tables.bom.some(r=>r.kind==='Patch panel'));
assert.strictEqual(tables.differentialBom.length,0,'Un As-Built sin baseline de intervención no debe inventar BOM diferencial');

const pack=Exports.buildCsvPack(project);
assert.strictEqual(pack.version,'netwizard-asbuilt-export-pack-v1');
assert.strictEqual(pack.manifest.workflowMode,'inventory');
assert.strictEqual(pack.manifest.sheets.devices,1);
assert.ok(pack.files['devices.csv'].includes('serialNumber'));
assert.ok(pack.files['devices.csv'].includes('SW-01'));
assert.ok(pack.files['ports.csv'].includes('Gi1/0/1'));
assert.ok(pack.files['cables.csv'].includes('C-001'));
assert.ok(pack.files['power.csv'].includes('PDU-A'));
assert.ok(pack.files['manifest.json'].includes('netwizard-asbuilt-export-pack-v1'));

const md=Exports.markdown(project);
assert.ok(md.includes('# As-Built Export Pack — Sede export'));
assert.ok(md.includes('devices: 1 filas'));
assert.ok(md.includes('cables: 1 filas'));

console.log('✓ As-Built Export Pack genera tablas físicas deterministas sin mutar el proyecto');
