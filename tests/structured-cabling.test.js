'use strict';
const assert=require('assert');
const Cabling=require('../js/netwizard-structured-cabling.js');
const UI=require('../js/netwizard-structured-cabling-ui.js');
const Schema=require('../js/netwizard-project-schema.js');

let project={
  _schemaVersion:'3.50.0',
  racks:[{id:'rack1',name:'Rack 1',rackUnits:24}],
  physicalLocations:[{id:'loc1',name:'Oficina'}],
  devices:[{id:'sw1',name:'SW-01',rackId:'rack1'}],
  ports:[{id:'p1',deviceId:'sw1',name:'Gi1/0/1'},{id:'p2',deviceId:'sw1',name:'Gi1/0/2'}],
  hosts:[{id:'h1',name:'PC-01',portRef:'p1'}],
  patchPanels:[],telecomOutlets:[],cableRuns:[],patchConnections:[],hostOutletConnections:[],
  rackItems:[]
};

project=UI.addPatchPanel(project,{id:'pp1',rackId:'rack1',name:'PP-01',portCount:24,category:'Cat6A',rackUnit:20});
assert.strictEqual(project.patchPanels.length,1);
assert.ok(project.rackItems.some(x=>x.patchPanelId==='pp1'&&x.startUnit===20));

const optionalPlacement=UI.addPatchPanel({racks:[{id:'rack1'}],patchPanels:[],rackItems:[]},{id:'pp-no-u',rackId:'rack1',name:'PP sin U',portCount:24,rackUnit:''});
assert.ok(!optionalPlacement.rackItems.some(x=>x.patchPanelId==='pp-no-u'),'Una U vacía no debe convertirse en U0');

project=UI.addOutlet(project,{id:'to1',locationId:'loc1',name:'TO-01',portCount:1,category:'Cat6A'});
project=UI.addCableRun(project,{id:'run1',patchPanelId:'pp1',patchPort:1,outletId:'to1',outletPort:1,cableType:'Cat6A',lengthM:35,route:'CPD → Oficina'});
project=UI.addPatchConnection(project,{id:'pc1',patchPanelId:'pp1',patchPort:1,switchPortId:'p1',patchCordLengthM:1});
project=UI.addHostOutletConnection(project,{id:'hc1',hostId:'h1',outletId:'to1',outletPort:1,patchCordLengthM:2});

let audit=Cabling.validate(project);
assert.strictEqual(audit.ok,true,audit.issues.map(x=>x.code+': '+x.message).join('\n'));
assert.strictEqual(audit.paths.length,1);
assert.strictEqual(audit.paths[0].complete,true);
assert.ok(audit.paths[0].switchPortLabel.includes('SW-01'));
assert.ok(audit.paths[0].hostLabel.includes('PC-01'));
const access=Cabling.hostAccess(project,'h1');
assert.strictEqual(access.structured,true);
assert.strictEqual(access.complete,true);
assert.strictEqual(access.switchPortId,'p1');
assert.strictEqual(access.deviceId,'sw1');
assert.strictEqual(Cabling.rackEdges(project,'rack1').length,1);
assert.ok(Cabling.billOfMaterials(project).some(x=>x.kind==='Toma de red'));
assert.ok(Cabling.billOfMaterials(project).some(x=>x.kind==='Cable estructurado'));

const prepared=Schema.prepareImport({format:'netwizard-project',schemaVersion:'3.50.0',project},{defaults:()=>({
  devices:[],ports:[],vlans:[],subnets:[],hosts:[],links:[],fwRules:[],physicalLocations:[],hostPhysicalLocations:[],
  patchPanels:[],telecomOutlets:[],cableRuns:[],patchConnections:[],hostOutletConnections:[],
  vlanMatrix:{},dhcp:{},security:{},roas:{},vtp:{roles:{}},topo:{pos:{}},uiSort:{},visual:{locs:[],assign:{devices:{},hosts:{}},pos:{},view:{}},iot:{accessNodes:[],devices:[],map:{show:{}}}
})});
assert.strictEqual(prepared.ok,true,prepared.errors.join('\n'));
assert.strictEqual(prepared.project.patchPanels[0].id,'pp1');
assert.strictEqual(prepared.project.cableRuns[0].lengthM,35);

const duplicate=JSON.parse(JSON.stringify(project));
duplicate.cableRuns.push({id:'run2',patchPanelId:'pp1',patchPort:1,outletId:'to1',outletPort:1,cableType:'Cat6A',lengthM:95});
audit=Cabling.validate(duplicate);
assert.ok(audit.issues.some(x=>x.code==='NW-CABLE-005'));
assert.ok(audit.issues.some(x=>x.code==='NW-CABLE-006'));
assert.ok(audit.issues.some(x=>x.code==='NW-CABLE-008'));

const mismatch=JSON.parse(JSON.stringify(project));
mismatch.patchConnections[0].switchPortId='p2';
audit=Cabling.validate(mismatch);
const mismatchIssue=audit.issues.find(x=>x.code==='NW-CABLE-016');
assert.ok(mismatchIssue);
assert.strictEqual(mismatchIssue.severity,'warning');
assert.strictEqual(audit.ok,true,'portRef legacy no debe competir con la ruta física autoritativa');
assert.strictEqual(Cabling.hostAccess(mismatch,'h1').switchPortId,'p2');
const mirrored=UI.syncHostAccessMirrors(mismatch);
assert.strictEqual(mirrored.hosts[0].portRef,'p2');
assert.strictEqual(mirrored.hosts[0].connectedDeviceId,'sw1');

const disconnected=JSON.parse(JSON.stringify(project));
disconnected.patchConnections=[];
audit=Cabling.validate(disconnected);
assert.ok(audit.issues.some(x=>x.code==='NW-CABLE-018'));

global.NetWizardProductionGate=require('../js/netwizard-production-gate.js');
global.NetWizardRackModel=require('../js/netwizard-rack-model.js');
global.NetWizardStructuredCabling=Cabling;
const Integration=require('../js/netwizard-rack-production-integration.js');
assert.strictEqual(Integration.install(),true);
const gate=global.NetWizardProductionGate.runProductionGate(duplicate,{productionMode:true,strict:false});
assert.strictEqual(gate.canExport,false);
assert.ok(gate.issues.some(x=>x.code==='NW-CABLE-008'&&x.blocking));

const removed=UI.removeEntity(project,'patchPanel','pp1');
assert.strictEqual(removed.patchPanels.length,0);
assert.strictEqual(removed.cableRuns.length,0);
assert.strictEqual(removed.patchConnections.length,0);
assert.ok(!removed.rackItems.some(x=>x.patchPanelId==='pp1'));

console.log('✓ Cableado estructurado modela switch → patch panel → toma → host y valida producción');
