'use strict';

const assert=require('assert');
const fs=require('fs');
const path=require('path');
const Bridge=require('../js/netwizard-inventory-design-bridge.js');
const Schema=require('../js/netwizard-project-schema.js');

const source={
  _schemaVersion:'3.50.0',
  projName:'Sede Alicante · As-Built',
  workflow:{mode:'inventory'},
  physicalLocations:[{id:'loc1',name:'CPD',type:'room'}],
  racks:[{id:'rack1',name:'RACK-01',locationId:'loc1',rackUnits:24}],
  rackItems:[{id:'ri1',rackId:'rack1',type:'device',deviceId:'sw1',label:'SW-01',startUnit:20,heightUnits:1}],
  devices:[{id:'sw1',name:'SW-01',type:'switch',kind:'switch',manufacturer:'ACME',model:'X48',rackId:'rack1',rackUnit:20,rackUnits:1}],
  ports:[{id:'p1',deviceId:'sw1',name:'Gi1/0/1',media:'copper',speedMaxMbps:1000}],
  pdus:[],powerConnections:[],patchPanels:[],telecomOutlets:[],cableRuns:[],patchConnections:[],hostOutletConnections:[],
  vlans:[],subnets:[],hosts:[],links:[],fwRules:[],dhcp:{},
  customDeviceModels:[],
  observedState:{observedAt:'2026-09-27T06:00:00Z',deviceConfigs:{}},
  iot:{accessNodes:[],devices:[],map:{show:{}}}
};

const original=JSON.parse(JSON.stringify(source));
const derived=Bridge.createDesignFromInventory(source,{snapshotId:'snap_asbuilt_1',createdAt:'2026-09-27T06:30:00Z'});
assert.strictEqual(derived.ok,true,derived.message);
assert.deepStrictEqual(source,original,'Derivar un diseño no debe mutar el inventario origen');
assert.strictEqual(derived.project.workflow.mode,'design');
assert.strictEqual(derived.project.workflow.designPhase,'to-be');
assert.deepStrictEqual(derived.project.workflow.derivedFrom,{
  type:'inventory',
  snapshotId:'snap_asbuilt_1',
  sourceProjectName:'Sede Alicante · As-Built',
  sourceSchemaVersion:'3.50.0',
  createdAt:'2026-09-27T06:30:00Z'
});
assert.strictEqual(derived.project.projName,'Sede Alicante · As-Built · Diseño To-Be');
assert.strictEqual(derived.project.devices[0].originRef,'sw1');
assert.strictEqual(derived.project.devices[0].designDisposition,'keep');
assert.strictEqual(derived.project.ports[0].originRef,'p1');
assert.strictEqual(derived.project.racks[0].originRef,'rack1');
assert.deepStrictEqual(derived.project.observedState,source.observedState,'La evidencia observada debe conservarse');

let changed=Bridge.setDeviceDisposition(derived.project,'sw1','replace',{replacementNote:'Sustituir por modelo PoE multigig'});
assert.strictEqual(changed.ok,true);
assert.strictEqual(changed.project.devices[0].designDisposition,'replace');
assert.strictEqual(changed.project.devices[0].replacementNote,'Sustituir por modelo PoE multigig');

changed.project.devices.push({id:'sw2',name:'SW-02',type:'switch',kind:'switch',modelSource:'manual',designDisposition:'add'});
const summary=Bridge.summarize(changed.project);
assert.deepStrictEqual(summary.counts,{keep:0,retire:0,replace:1,add:1,total:2});

const changeSet=Bridge.buildPhysicalChangeSet(changed.project);
assert.strictEqual(changeSet.actionable.length,2);
assert.ok(changeSet.actionable.some(x=>x.deviceId==='sw1'&&x.disposition==='replace'));
assert.ok(changeSet.actionable.some(x=>x.deviceId==='sw2'&&x.disposition==='add'));

const prepared=Schema.prepareImport(changed.project);
assert.strictEqual(prepared.ok,true,prepared.errors.join('\n'));
assert.strictEqual(prepared.project.workflow.derivedFrom.snapshotId,'snap_asbuilt_1');
assert.strictEqual(prepared.project.devices[0].originRef,'sw1');
assert.strictEqual(prepared.project.devices[0].designDisposition,'replace');
const exported=Schema.prepareExport(prepared.project);
assert.strictEqual(exported.project.workflow.derivedFrom.type,'inventory');
assert.strictEqual(exported.project.devices[0].designDisposition,'replace');

const badDisposition=Schema.validateProject({
  ...prepared.project,
  devices:[{...prepared.project.devices[0],designDisposition:'move'}]
});
assert.strictEqual(badDisposition.ok,false);
assert.ok(badDisposition.errors.some(x=>x.includes('designDisposition inválido')));

const external=JSON.parse(fs.readFileSync(path.join(__dirname,'..','schemas','netwizard-project.schema.json'),'utf8'));
assert.deepStrictEqual(external.$defs.device.properties.designDisposition.enum,['keep','retire','replace','add']);
assert.strictEqual(external.$defs.project.properties.workflow.properties.derivedFrom.properties.type.const,'inventory');

const wrongSource=Bridge.createDesignFromInventory({...source,workflow:{mode:'design'}});
assert.strictEqual(wrongSource.ok,false);
assert.strictEqual(wrongSource.code,'source_not_inventory');

console.log('✓ Inventory -> Design conserva As-Built, procedencia y decisiones físicas');
