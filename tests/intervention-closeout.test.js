'use strict';

const assert=require('assert');
const fs=require('fs');
const path=require('path');

global.NetWizardPhysicalInterventionPlan=require('../js/netwizard-physical-intervention-plan.js');
const Bridge=require('../js/netwizard-inventory-design-bridge.js');
const Closeout=require('../js/netwizard-intervention-closeout.js');
const Execution=require('../js/netwizard-intervention-execution.js');
const Schema=require('../js/netwizard-project-schema.js');

const source={
  _schemaVersion:'3.50.0',
  projName:'Sede Murcia · As-Built',
  workflow:{mode:'inventory'},
  physicalLocations:[{id:'loc1',name:'CPD',type:'room'}],
  racks:[{id:'rack1',name:'RACK-01',locationId:'loc1',rackUnits:24}],
  rackItems:[{id:'ri-old',rackId:'rack1',type:'device',deviceId:'sw-old',label:'SW-OLD',startUnit:18,heightUnits:1}],
  devices:[{id:'sw-old',name:'SW-OLD',type:'switch',kind:'switch',manufacturer:'ACME',model:'X24',rackId:'rack1',rackUnit:18,rackUnits:1}],
  ports:[
    {id:'p-old-1',deviceId:'sw-old',name:'Gi1/0/1',media:'copper',speedMaxMbps:1000},
    {id:'p-old-2',deviceId:'sw-old',name:'Gi1/0/2',media:'copper',speedMaxMbps:1000}
  ],
  links:[{id:'l-old',name:'Old uplink',fromPortId:'p-old-1',toPortId:'p-old-2',medium:'copper'}],
  pdus:[{id:'pdu1',name:'PDU-A',rackId:'rack1',feed:'A',outletCount:8}],
  powerConnections:[{id:'pw-old',deviceId:'sw-old',pduId:'pdu1',outlet:1,powerSupplyIndex:0,feed:'A'}],
  patchPanels:[{id:'pp1',rackId:'rack1',name:'PP-01',portCount:24,category:'Cat6A'}],
  telecomOutlets:[{id:'to1',locationId:'loc1',name:'TO-01',portCount:1,category:'Cat6A'}],
  cableRuns:[{id:'c1',label:'C-001',patchPanelId:'pp1',patchPort:1,outletId:'to1',outletPort:1,cableType:'Cat6A',lengthM:25,route:'Canal A'}],
  patchConnections:[{id:'pc-old',patchPanelId:'pp1',patchPort:1,switchPortId:'p-old-2',patchCordLengthM:1}],
  hostOutletConnections:[],
  hosts:[],vlans:[],subnets:[],fwRules:[],dhcp:{},customDeviceModels:[],
  designRequirements:{locations:[{locationId:'loc1',copperPorts:24}]},
  observedState:{
    observedAt:'2026-09-27T08:00:00Z',
    deviceConfigs:{
      'sw-old':{vendor:'generic_network',capturedAt:'2026-09-27T08:00:00Z',content:'old config'}
    }
  },
  iot:{accessNodes:[],devices:[],map:{show:{}}}
};

const derived=Bridge.createDesignFromInventory(source,{snapshotId:'snap-origin',createdAt:'2026-09-27T09:00:00Z'});
assert.strictEqual(derived.ok,true);

let design=JSON.parse(JSON.stringify(derived.project));
design.devices[0].designDisposition='replace';
design.devices[0].replacementDeviceRef='sw-new';
design.devices[0].replacementNote='Renovación de switch de acceso';
design.devices.push({
  id:'sw-new',name:'SW-NEW',type:'switch',kind:'switch',manufacturer:'ACME',model:'X48',
  modelSource:'manual',designDisposition:'add',rackId:'rack1',rackUnit:20,rackUnits:1
});
design.ports.push({id:'p-new-1',deviceId:'sw-new',name:'Gi1/0/1',media:'copper',speedMaxMbps:1000});
design.rackItems.push({id:'ri-new',rackId:'rack1',type:'device',deviceId:'sw-new',label:'SW-NEW',startUnit:20,heightUnits:1});
design.powerConnections.push({id:'pw-new',deviceId:'sw-new',pduId:'pdu1',outlet:2,powerSupplyIndex:0,feed:'A'});
design.patchConnections.push({id:'pc-new',patchPanelId:'pp1',patchPort:1,switchPortId:'p-new-1',patchCordLengthM:1});

design.observedState={observedAt:'2026-09-27T09:50:00Z'};
design=Execution.patchRecord(design,{technician:'Ana Instaladora',startedAt:'2026-09-27T09:10:00Z'});
for(const item of Execution.build(design).items){
  design=Execution.setAction(design,item.actionId,{
    status:'done',completedAt:'2026-09-27T09:40:00Z',completedBy:'Ana Instaladora',
    note:'Ejecutado',evidenceRefs:['foto-'+item.order]
  });
}
design=Execution.acceptedRecord(design,{
  connectivityVerified:true,labelsVerified:true,asBuiltReviewed:true,
  acceptedBy:'Carlos Supervisor',acceptedAt:'2026-09-27T09:55:00Z'
});

const originalDesign=JSON.parse(JSON.stringify(design));
const closed=Closeout.buildUpdatedAsBuilt(design,{
  designSnapshotId:'snap-design-final',
  closedAt:'2026-09-27T10:00:00Z'
});
assert.strictEqual(closed.ok,true,closed.message);
assert.deepStrictEqual(design,originalDesign,'El cierre no debe mutar el Diseño To-Be');

const finalProject=closed.project;
assert.strictEqual(finalProject.workflow.mode,'inventory');
assert.strictEqual(finalProject.workflow.updatedFrom.type,'intervention-closeout');
assert.strictEqual(finalProject.workflow.updatedFrom.sourceInventorySnapshotId,'snap-origin');
assert.strictEqual(finalProject.workflow.updatedFrom.designSnapshotId,'snap-design-final');
assert.strictEqual(finalProject.workflow.updatedFrom.closedAt,'2026-09-27T10:00:00Z');
assert.strictEqual(finalProject.workflow.updatedFrom.completedActionCount,closed.summary.interventionActionCount);
assert.strictEqual(finalProject.workflow.updatedFrom.acceptedBy,'Carlos Supervisor');
assert.strictEqual(finalProject.workflow.updatedFrom.technician,'Ana Instaladora');
assert.strictEqual(finalProject.workflow.updatedFrom.observedAt,'2026-09-27T09:50:00Z');
assert.ok(finalProject.workflow.updatedFrom.evidenceCount>=1);
assert.ok(!('derivedFrom' in finalProject.workflow));
assert.ok(!('interventionBaseline' in finalProject.workflow));
assert.ok(!('interventionExecution' in finalProject.workflow));
assert.ok(!('designPhase' in finalProject.workflow));
assert.ok(finalProject.designRequirements);
assert.deepStrictEqual(finalProject.designRequirements.locationPlans,[],'El As-Built no debe conservar demandas To-Be activas');

assert.strictEqual(finalProject.devices.some(d=>d.id==='sw-old'),false);
assert.strictEqual(finalProject.devices.some(d=>d.id==='sw-new'),true);
const newDevice=finalProject.devices.find(d=>d.id==='sw-new');
assert.ok(!('originRef' in newDevice));
assert.ok(!('designDisposition' in newDevice));
assert.ok(!('replacementDeviceRef' in newDevice));

assert.strictEqual(finalProject.ports.some(p=>p.deviceId==='sw-old'),false);
assert.strictEqual(finalProject.ports.some(p=>p.id==='p-new-1'),true);
assert.strictEqual(finalProject.links.some(l=>l.id==='l-old'),false);
assert.strictEqual(finalProject.rackItems.some(x=>x.deviceId==='sw-old'),false);
assert.strictEqual(finalProject.rackItems.some(x=>x.deviceId==='sw-new'),true);
assert.strictEqual(finalProject.powerConnections.some(x=>x.deviceId==='sw-old'),false);
assert.strictEqual(finalProject.powerConnections.some(x=>x.deviceId==='sw-new'),true);
assert.strictEqual(finalProject.patchConnections.some(x=>x.switchPortId==='p-old-2'),false);
assert.strictEqual(finalProject.patchConnections.some(x=>x.switchPortId==='p-new-1'),true);
assert.ok(!finalProject.observedState.deviceConfigs['sw-old'],'No debe quedar configuración observada asociada a un equipo retirado');

assert.deepStrictEqual(closed.removed.devices,['sw-old']);
assert.deepStrictEqual(new Set(closed.removed.ports),new Set(['p-old-1','p-old-2']));
assert.strictEqual(closed.removed.links,1);
assert.strictEqual(closed.removed.rackItems,1);
assert.strictEqual(closed.removed.powerConnections,1);
assert.strictEqual(closed.removed.patchConnections,1);

const prepared=Schema.prepareImport(finalProject);
assert.strictEqual(prepared.ok,true,prepared.errors.join('\n'));
assert.strictEqual(prepared.project.workflow.updatedFrom.type,'intervention-closeout');
assert.strictEqual(prepared.project.workflow.updatedFrom.designSnapshotId,'snap-design-final');
const exported=Schema.prepareExport(prepared.project);
assert.strictEqual(exported.project.workflow.updatedFrom.closedAt,'2026-09-27T10:00:00Z');
assert.deepStrictEqual(Schema.model.interventionCloseoutVersion,'netwizard-intervention-closeout-v1');
assert.deepStrictEqual(Schema.model.interventionExecutionVersion,'netwizard-intervention-execution-v1');

const bad=JSON.parse(JSON.stringify(derived.project));
bad.devices[0].designDisposition='replace';
bad.devices[0].replacementDeviceRef='';
const missing=Closeout.buildUpdatedAsBuilt(bad);
assert.strictEqual(missing.ok,false);
assert.strictEqual(missing.code,'replacement_contract_invalid');
assert.ok(missing.errors.some(x=>x.code==='replacement_missing'));

const duplicate=JSON.parse(JSON.stringify(derived.project));
duplicate.devices.push({...duplicate.devices[0],id:'sw-old-2',name:'SW-OLD-2',originRef:'sw-old-2',designDisposition:'replace',replacementDeviceRef:'sw-new'});
duplicate.devices[0].designDisposition='replace';
duplicate.devices[0].replacementDeviceRef='sw-new';
duplicate.devices.push({id:'sw-new',name:'SW-NEW',type:'switch',kind:'switch',modelSource:'manual',designDisposition:'add'});
const duplicateResult=Closeout.buildUpdatedAsBuilt(duplicate);
assert.strictEqual(duplicateResult.ok,false);
assert.ok(duplicateResult.errors.some(x=>x.code==='replacement_reused'));

const external=JSON.parse(fs.readFileSync(path.join(__dirname,'..','schemas','netwizard-project.schema.json'),'utf8'));
assert.strictEqual(external.$defs.interventionCloseoutProvenance.properties.type.const,'intervention-closeout');
assert.strictEqual(external.$defs.project.properties.workflow.properties.updatedFrom.$ref,'#/$defs/interventionCloseoutProvenance');
assert.strictEqual(external.$defs.project.properties.workflow.properties.interventionExecution.$ref,'#/$defs/interventionExecution');

const derivedAgain=Bridge.createDesignFromInventory(finalProject,{snapshotId:'snap-origin-2',createdAt:'2026-09-27T11:00:00Z'});
assert.strictEqual(derivedAgain.ok,true);
assert.strictEqual(derivedAgain.project.workflow.updatedFrom.type,'intervention-closeout','La procedencia del cierre anterior debe viajar al siguiente To-Be');

assert.strictEqual(
  Closeout.defaultName(derivedAgain.project),
  'Sede Murcia · As-Built actualizado',
  'Los ciclos repetidos no deben acumular sufijos generados'
);
assert.strictEqual(
  Closeout.defaultName({
    projName:'Fallback · Diseño To-Be',
    workflow:{mode:'design',derivedFrom:{type:'inventory',sourceProjectName:''}}
  }),
  'Fallback · As-Built actualizado'
);

console.log('✓ Cierre de intervención produce As-Built limpio, trazable y portable');
