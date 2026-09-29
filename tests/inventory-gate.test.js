'use strict';

const assert=require('assert');

global.NetWizardPhysicalInventory=require('../js/netwizard-physical-inventory.js');
global.NetWizardRackModel=require('../js/netwizard-rack-model.js');
global.NetWizardStructuredCabling=require('../js/netwizard-structured-cabling.js');
const Gate=require('../js/netwizard-inventory-gate.js');

const empty=Gate.validate({physicalLocations:[],racks:[],rackItems:[],devices:[],ports:[],pdus:[],powerConnections:[],patchPanels:[],telecomOutlets:[],cableRuns:[],patchConnections:[],hostOutletConnections:[]});
assert.strictEqual(empty.ok,true);
assert.strictEqual(empty.status,'review');
assert.ok(empty.issues.some(x=>x.code==='NW-INV-001'));
assert.ok(empty.issues.some(x=>x.code==='NW-INV-002'));
assert.ok(empty.issues.some(x=>x.code==='NW-INV-003'));

const project={
  workflow:{mode:'inventory'},
  physicalLocations:[{id:'loc1',name:'CPD',type:'room'}],
  racks:[{id:'rack1',name:'RACK-01',locationId:'loc1',rackUnits:24}],
  rackItems:[{id:'ri1',rackId:'rack1',type:'device',deviceId:'sw1',label:'SW-01',startUnit:20,heightUnits:1,face:'front'}],
  devices:[{id:'sw1',name:'SW-01',type:'switch',kind:'switch',manufacturer:'ACME',model:'X48',serialNumber:'ABC',rackId:'rack1',rack:'rack1',rackUnit:20,rackUnits:1,powerDrawWatts:80}],
  ports:[{id:'p1',deviceId:'sw1',name:'Gi1/0/1',media:'copper',speedMaxMbps:1000,negotiatedSpeedMbps:1000}],
  pdus:[{id:'pdu1',rackId:'rack1',name:'PDU-A',feed:'A',outletCount:8,maxPowerWatts:3680}],
  powerConnections:[{id:'pw1',deviceId:'sw1',powerSupplyIndex:0,pduId:'pdu1',outlet:1,feed:'A'}],
  patchPanels:[],telecomOutlets:[],cableRuns:[],patchConnections:[],hostOutletConnections:[],links:[]
};
const coherent=Gate.validate(project);
assert.strictEqual(coherent.ok,true);
assert.strictEqual(coherent.score.locations,1);
assert.strictEqual(coherent.score.racks,1);
assert.strictEqual(coherent.score.devices,1);
assert.strictEqual(coherent.score.rackItems,1);
assert.strictEqual(coherent.score.placedDevices,1);
assert.strictEqual(coherent.score.ports,1);
assert.strictEqual(coherent.score.pdus,1);
assert.strictEqual(coherent.score.powerConnections,1);
assert.ok(!coherent.issues.some(x=>x.code==='NW-INV-010'));
assert.ok(!coherent.issues.some(x=>x.code==='NW-INV-011'));

const broken=JSON.parse(JSON.stringify(project));
broken.ports[0].negotiatedSpeedMbps=10000;
const blocked=Gate.validate(broken);
assert.strictEqual(blocked.ok,false);
assert.strictEqual(blocked.status,'blocked');
assert.ok(blocked.issues.some(x=>x.code==='NW-IF-001'&&x.blocking));

console.log('✓ Inventory Gate valida documentación física sin exigir diseño lógico');
