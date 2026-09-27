'use strict';

const assert=require('assert');
global.NetWizardPhysicalInterventionPlan=require('../js/netwizard-physical-intervention-plan.js');
const Bridge=require('../js/netwizard-inventory-design-bridge.js');
const Planner=global.NetWizardPhysicalInterventionPlan;
const Schema=require('../js/netwizard-project-schema.js');

const source={
  _schemaVersion:'3.50.0',
  projName:'Rack mantenimiento · As-Built',
  workflow:{mode:'inventory'},
  physicalLocations:[{id:'loc1',name:'CPD',type:'room'}],
  racks:[{id:'rack1',name:'RACK-01',locationId:'loc1',rackUnits:24}],
  rackItems:[{id:'ri1',rackId:'rack1',type:'device',deviceId:'sw1',label:'SW-01',startUnit:18,heightUnits:1}],
  devices:[{id:'sw1',name:'SW-01',type:'switch',kind:'switch',manufacturer:'ACME',model:'X48',rackId:'rack1',rackUnit:18,rackUnits:1}],
  ports:[{id:'p1',deviceId:'sw1',name:'Gi1/0/1',media:'copper',speedMaxMbps:1000}],
  pdus:[{id:'pdu1',name:'PDU-A',rackId:'rack1',feed:'A',outletCount:8,maxPowerWatts:3680}],
  powerConnections:[{id:'pw1',deviceId:'sw1',pduId:'pdu1',outlet:1,powerSupplyIndex:0,feed:'A'}],
  patchPanels:[{id:'pp1',rackId:'rack1',name:'PP-01',portCount:24,category:'Cat6A'}],
  telecomOutlets:[{id:'to1',locationId:'loc1',name:'TO-01',portCount:1,category:'Cat6A'}],
  cableRuns:[{id:'c1',label:'C-001',patchPanelId:'pp1',patchPort:1,outletId:'to1',outletPort:1,cableType:'Cat6A',lengthM:35,route:'Canal A'}],
  patchConnections:[{id:'pc1',patchPanelId:'pp1',patchPort:1,switchPortId:'p1',patchCordLengthM:1}],
  hostOutletConnections:[],
  vlans:[],subnets:[],hosts:[{id:'h1',name:'PC-01',type:'pc'}],links:[],fwRules:[],dhcp:{},customDeviceModels:[],
  iot:{accessNodes:[],devices:[],map:{show:{}}}
};

const derived=Bridge.createDesignFromInventory(source,{snapshotId:'snap_1',createdAt:'2026-09-27T08:00:00Z'});
assert.strictEqual(derived.ok,true);
assert.strictEqual(derived.project.workflow.interventionBaseline.version,'netwizard-physical-intervention-baseline-v1');
assert.strictEqual(derived.project.workflow.interventionBaseline.devices[0].rackUnit,18);
assert.strictEqual(derived.project.workflow.interventionBaseline.powerConnections[0].outlet,1);
assert.strictEqual(derived.project.workflow.interventionBaseline.cableRuns[0].route,'Canal A');

const unchanged=Planner.build(derived.project);
assert.strictEqual(unchanged.ok,true);
assert.strictEqual(unchanged.counts.total,0);

const changed=JSON.parse(JSON.stringify(derived.project));
changed.devices[0].rackUnit=20;
changed.rackItems[0].startUnit=20;
changed.powerConnections[0].outlet=5;
changed.powerConnections[0].feed='B';
changed.cableRuns[0].cableType='Cat6A F/UTP';
changed.cableRuns[0].route='Canal B';
changed.pdus.push({id:'pdu2',name:'PDU-B',rackId:'rack1',feed:'B',outletCount:8});
changed.patchConnections[0].switchPortId='p1';
changed.hostOutletConnections.push({id:'hc1',hostId:'h1',outletId:'to1',outletPort:1,patchCordLengthM:2});

const plan=Planner.buildChecklist(changed);
assert.strictEqual(plan.ok,true);
assert.ok(plan.actions.some(x=>x.type==='move-device'&&x.details.includes('U18')&&x.details.includes('U20')));
assert.ok(plan.actions.some(x=>x.type==='reconnect-power'&&x.details.includes('toma 1')&&x.details.includes('toma 5')));
assert.ok(plan.actions.some(x=>x.type==='replace-or-reroute-cable'));
assert.ok(plan.actions.some(x=>x.type==='add-pdu'));
assert.ok(plan.actions.some(x=>x.type==='add-host-patch'));
assert.ok(plan.counts.total>=5);
assert.ok(plan.counts.power>=1);
assert.ok(plan.counts.cabling>=2);

const removed=JSON.parse(JSON.stringify(changed));
removed.cableRuns=[];
const removedPlan=Planner.build(removed);
assert.ok(removedPlan.actions.some(x=>x.type==='remove-cable'&&x.originRef==='c1'));

const prepared=Schema.prepareImport(changed);
assert.strictEqual(prepared.ok,true,prepared.errors.join('\n'));
assert.strictEqual(prepared.project.workflow.interventionBaseline.version,'netwizard-physical-intervention-baseline-v1');
assert.strictEqual(prepared.project.workflow.interventionBaseline.devices[0].id,'sw1');
const exported=Schema.prepareExport(prepared.project);
assert.strictEqual(exported.project.workflow.interventionBaseline.powerConnections[0].id,'pw1');

const fs=require('fs'),path=require('path');
const external=JSON.parse(fs.readFileSync(path.join(__dirname,'..','schemas','netwizard-project.schema.json'),'utf8'));
assert.strictEqual(external.$defs.physicalInterventionBaseline.properties.version.const,'netwizard-physical-intervention-baseline-v1');
assert.strictEqual(external.$defs.project.properties.workflow.properties.interventionBaseline.$ref,'#/$defs/physicalInterventionBaseline');

const invalid=Schema.validateProject({
  ...prepared.project,
  workflow:{...prepared.project.workflow,interventionBaseline:{version:'legacy'}}
});
assert.strictEqual(invalid.ok,false);
assert.ok(invalid.errors.some(x=>x.includes('interventionBaseline.version')));

console.log('✓ Plan de intervención física detecta movimientos, alimentación y cableado desde As-Built');
