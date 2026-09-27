'use strict';

const assert=require('assert');
global.NetWizardPhysicalInterventionPlan=require('../js/netwizard-physical-intervention-plan.js');
const Bridge=require('../js/netwizard-inventory-design-bridge.js');
const Package=require('../js/netwizard-field-intervention-package.js');

const source={
  _schemaVersion:'3.50.0',
  projName:'Sede mantenimiento',
  workflow:{mode:'inventory'},
  physicalLocations:[{id:'loc1',name:'CPD',type:'room'}],
  racks:[{id:'rack1',name:'RACK-01',locationId:'loc1',rackUnits:24}],
  rackItems:[{id:'ri1',rackId:'rack1',type:'device',deviceId:'sw1',label:'SW-01',startUnit:18,heightUnits:1}],
  devices:[{id:'sw1',name:'SW-01',type:'switch',kind:'switch',manufacturer:'ACME',model:'X48',rackId:'rack1',rackUnit:18,rackUnits:1}],
  ports:[{id:'p1',deviceId:'sw1',name:'Gi1/0/1',media:'copper',speedMaxMbps:1000}],
  pdus:[{id:'pdu1',name:'PDU-A',rackId:'rack1',feed:'A',outletCount:8}],
  powerConnections:[{id:'pw1',deviceId:'sw1',pduId:'pdu1',outlet:1,powerSupplyIndex:0,feed:'A'}],
  patchPanels:[{id:'pp1',rackId:'rack1',name:'PP-01',portCount:24,category:'Cat6A'}],
  telecomOutlets:[{id:'to1',locationId:'loc1',name:'TO-01',portCount:1,category:'Cat6A'}],
  cableRuns:[{id:'c1',label:'C-001',patchPanelId:'pp1',patchPort:1,outletId:'to1',outletPort:1,cableType:'Cat6A',lengthM:35,route:'Canal A'}],
  patchConnections:[{id:'pc1',patchPanelId:'pp1',patchPort:1,switchPortId:'p1',patchCordLengthM:1}],
  hostOutletConnections:[],
  vlans:[],subnets:[],hosts:[],links:[],fwRules:[],dhcp:{},customDeviceModels:[],
  iot:{accessNodes:[],devices:[],map:{show:{}}}
};

const derived=Bridge.createDesignFromInventory(source,{snapshotId:'snap_1',createdAt:'2026-09-27T09:00:00Z'});
assert.strictEqual(derived.ok,true);

const p=JSON.parse(JSON.stringify(derived.project));
p.devices[0].designDisposition='replace';
p.devices[0].replacementDeviceRef='sw2';
p.devices[0].replacementNote='Sustituir por switch PoE multigig';
p.devices.push({
  id:'sw2',name:'SW-02',type:'switch',kind:'switch',manufacturer:'ACME',model:'X48-MG',
  designDisposition:'add',rackId:'rack1',rackUnit:20,rackUnits:1
});
p.rackItems.push({id:'ri2',rackId:'rack1',type:'device',deviceId:'sw2',label:'SW-02',startUnit:20,heightUnits:1});
p.powerConnections[0].outlet=5;
p.cableRuns[0].cableType='Cat6A F/UTP';
p.cableRuns[0].route='Canal B';

const pkg=Package.build(p);
assert.strictEqual(pkg.ok,true);
assert.ok(pkg.counts.actions>=3);
assert.ok(pkg.checklist.some(x=>x.type==='replace-device'));
assert.ok(pkg.checklist.some(x=>x.type==='reconnect-power'));
assert.ok(pkg.checklist.some(x=>x.type==='replace-or-reroute-cable'));

const addedDevices=pkg.bom.additions.filter(x=>x.kind==='Equipo');
assert.strictEqual(addedDevices.length,1,'replacement device must appear once in additions');
assert.ok(addedDevices[0].description.includes('X48-MG'));
const removedDevices=pkg.bom.removals.filter(x=>x.kind==='Equipo');
assert.strictEqual(removedDevices.length,1);
assert.ok(removedDevices[0].description.includes('X48'));

const addedCables=pkg.bom.additions.filter(x=>x.kind==='Cableado');
const removedCables=pkg.bom.removals.filter(x=>x.kind==='Cableado');
assert.strictEqual(addedCables.length,1);
assert.strictEqual(removedCables.length,1);
assert.ok(addedCables[0].description.includes('F/UTP'));
assert.ok(removedCables[0].description.includes('Cat6A'));

const md=Package.buildMarkdown(p);
assert.ok(md.includes('# Paquete de intervención — Sede mantenimiento · Diseño To-Be'));
assert.ok(md.includes('## Checklist de trabajo'));
assert.ok(md.includes('## Comparativa As-Built -> To-Be'));
assert.ok(md.includes('## BOM diferencial — añadir'));
assert.ok(md.includes('SW-02'));
assert.ok(md.includes('PDU-A')||md.includes('toma 5'));
assert.ok(md.includes('Actualizar el As-Built')||md.includes('actualizar el As-Built'));

const noBaseline=Package.build({...p,workflow:{mode:'design'}});
assert.strictEqual(noBaseline.ok,false);

console.log('✓ Paquete de campo genera checklist, before/after y BOM diferencial sin duplicados');
