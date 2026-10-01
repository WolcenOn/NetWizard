'use strict';

const assert=require('assert');

global.NetWizardPhysicalInterventionPlan=require('../js/netwizard-physical-intervention-plan.js');
const Bridge=require('../js/netwizard-inventory-design-bridge.js');
const Closeout=require('../js/netwizard-intervention-closeout.js');
const Schema=require('../js/netwizard-project-schema.js');

const sourceA={
  _schemaVersion:'3.50.0',
  projName:'Sede I9 · As-Built',
  workflow:{mode:'inventory'},
  physicalLocations:[{id:'loc1',name:'CPD',type:'room'}],
  racks:[{id:'rack1',name:'RACK-01',locationId:'loc1',rackUnits:24}],
  rackItems:[{id:'ri-a',rackId:'rack1',type:'device',deviceId:'sw-a',label:'SW-A',startUnit:18,heightUnits:1,face:'front'}],
  devices:[{id:'sw-a',name:'SW-A',type:'switch',kind:'switch',manufacturer:'ACME',model:'X24',modelSource:'manual',rackId:'rack1',rackUnit:18,rackUnits:1}],
  ports:[{id:'p-a',deviceId:'sw-a',name:'Gi1/0/1',media:'copper',speedMaxMbps:1000}],
  links:[],
  pdus:[{id:'pdu1',name:'PDU-A',rackId:'rack1',feed:'A',outletCount:8}],
  powerConnections:[{id:'pw-a',deviceId:'sw-a',pduId:'pdu1',outlet:1,powerSupplyIndex:0,feed:'A'}],
  patchPanels:[],telecomOutlets:[],cableRuns:[],patchConnections:[],hostOutletConnections:[],
  hosts:[],vlans:[],subnets:[],fwRules:[],dhcp:{},customDeviceModels:[],
  observedState:{observedAt:'2026-09-27T08:00:00Z',deviceConfigs:{'sw-a':{capturedAt:'2026-09-27T08:00:00Z',content:'cfg-a'}}},
  iot:{accessNodes:[],devices:[],map:{show:{}}}
};

const cycle1=Bridge.createDesignFromInventory(sourceA,{snapshotId:'snap-a',createdAt:'2026-09-27T09:00:00Z'});
assert.strictEqual(cycle1.ok,true);
cycle1.project.devices.push({
  id:'sw-b',name:'SW-B',type:'switch',kind:'switch',manufacturer:'ACME',model:'X48',
  modelSource:'manual',designDisposition:'add',rackId:'rack1',rackUnit:20,rackUnits:1
});
cycle1.project.ports.push({id:'p-b',deviceId:'sw-b',name:'Gi1/0/1',media:'copper',speedMaxMbps:1000});
cycle1.project.rackItems.push({id:'ri-b',rackId:'rack1',type:'device',deviceId:'sw-b',label:'SW-B',startUnit:20,heightUnits:1,face:'front'});
cycle1.project.powerConnections.push({id:'pw-b',deviceId:'sw-b',pduId:'pdu1',outlet:2,powerSupplyIndex:0,feed:'A'});

let firstReplace=Bridge.setDeviceDisposition(cycle1.project,'sw-a','replace',{replacementDeviceRef:'sw-b',replacementNote:'Ciclo 1'});
assert.strictEqual(firstReplace.ok,true);
assert.strictEqual(firstReplace.project.devices.find(d=>d.id==='sw-a').replacementDeviceRef,'sw-b');

const cleared=Bridge.setDeviceDisposition(firstReplace.project,'sw-a','replace',{replacementDeviceRef:''});
assert.strictEqual(cleared.ok,true);
assert.strictEqual(cleared.project.devices.find(d=>d.id==='sw-a').replacementDeviceRef,'','Debe poder limpiarse una selección de reemplazo previa');

firstReplace=Bridge.setDeviceDisposition(cleared.project,'sw-a','replace',{replacementDeviceRef:'sw-b',replacementNote:'Ciclo 1'});
const closedB=Closeout.buildUpdatedAsBuilt(firstReplace.project,{designSnapshotId:'snap-design-a',closedAt:'2026-09-27T10:00:00Z',allowIncompleteExecution:true});
assert.strictEqual(closedB.ok,true,closedB.message);
const asBuiltB=closedB.project;
assert.deepStrictEqual(asBuiltB.devices.map(d=>d.id),['sw-b']);
assert.strictEqual(asBuiltB.workflow.updatedFrom.sourceInventorySnapshotId,'snap-a');
assert.strictEqual(asBuiltB.workflow.updatedFrom.designSnapshotId,'snap-design-a');
assert.strictEqual(asBuiltB.observedState.deviceConfigs['sw-a'],undefined);
assert.ok(!('originRef' in asBuiltB.devices[0]));
assert.ok(!('designDisposition' in asBuiltB.devices[0]));
assert.ok(!('replacementDeviceRef' in asBuiltB.devices[0]));

const roundTripB=Schema.prepareImport(Schema.prepareExport(asBuiltB));
assert.strictEqual(roundTripB.ok,true,roundTripB.errors&&roundTripB.errors.join('\n'));
assert.strictEqual(roundTripB.project.workflow.updatedFrom.type,'intervention-closeout');

const cycle2=Bridge.createDesignFromInventory(roundTripB.project,{snapshotId:'snap-b',createdAt:'2026-09-27T11:00:00Z'});
assert.strictEqual(cycle2.ok,true);
assert.strictEqual(cycle2.project.workflow.updatedFrom.designSnapshotId,'snap-design-a','El To-Be siguiente conserva la procedencia del cierre anterior');
assert.strictEqual(cycle2.project.workflow.derivedFrom.snapshotId,'snap-b');
assert.strictEqual(cycle2.project.devices[0].id,'sw-b');
assert.strictEqual(cycle2.project.devices[0].originRef,'sw-b');
assert.strictEqual(cycle2.project.devices[0].designDisposition,'keep');

cycle2.project.devices.push({
  id:'sw-c',name:'SW-C',type:'switch',kind:'switch',manufacturer:'ACME',model:'X48-2',
  modelSource:'manual',designDisposition:'add',rackId:'rack1',rackUnit:22,rackUnits:1
});
cycle2.project.ports.push({id:'p-c',deviceId:'sw-c',name:'Gi1/0/1',media:'copper',speedMaxMbps:2500});
cycle2.project.rackItems.push({id:'ri-c',rackId:'rack1',type:'device',deviceId:'sw-c',label:'SW-C',startUnit:22,heightUnits:1,face:'front'});
cycle2.project.powerConnections.push({id:'pw-c',deviceId:'sw-c',pduId:'pdu1',outlet:3,powerSupplyIndex:0,feed:'A'});

const secondReplace=Bridge.setDeviceDisposition(cycle2.project,'sw-b','replace',{replacementDeviceRef:'sw-c',replacementNote:'Ciclo 2'});
assert.strictEqual(secondReplace.ok,true);

const closedC=Closeout.buildUpdatedAsBuilt(secondReplace.project,{designSnapshotId:'snap-design-b',closedAt:'2026-09-27T12:00:00Z',allowIncompleteExecution:true});
assert.strictEqual(closedC.ok,true,closedC.message);
const asBuiltC=closedC.project;
assert.deepStrictEqual(asBuiltC.devices.map(d=>d.id),['sw-c']);
assert.strictEqual(asBuiltC.workflow.updatedFrom.sourceInventorySnapshotId,'snap-b');
assert.strictEqual(asBuiltC.workflow.updatedFrom.designSnapshotId,'snap-design-b');
assert.strictEqual(asBuiltC.workflow.updatedFrom.sourceProjectName,asBuiltB.projName);
assert.strictEqual(asBuiltC.projName,'Sede I9 · As-Built actualizado');
assert.strictEqual((asBuiltC.projName.match(/As-Built actualizado/g)||[]).length,1);
assert.strictEqual(asBuiltC.ports.some(p=>p.deviceId==='sw-b'),false);
assert.strictEqual(asBuiltC.rackItems.some(x=>x.deviceId==='sw-b'),false);
assert.strictEqual(asBuiltC.powerConnections.some(x=>x.deviceId==='sw-b'),false);
assert.ok(asBuiltC.devices.every(d=>!('originRef' in d)&&!('designDisposition' in d)&&!('replacementDeviceRef' in d)));

const finalRoundTrip=Schema.prepareImport(Schema.prepareExport(asBuiltC));
assert.strictEqual(finalRoundTrip.ok,true,finalRoundTrip.errors&&finalRoundTrip.errors.join('\n'));
assert.strictEqual(finalRoundTrip.project.workflow.mode,'inventory');
assert.strictEqual(finalRoundTrip.project.workflow.updatedFrom.sourceInventorySnapshotId,'snap-b');

console.log('✓ Dos ciclos de intervención consecutivos preservan procedencia y limpian referencias temporales');
