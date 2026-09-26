'use strict';

const assert=require('assert');
const Gate=require('../js/netwizard-inventory-gate.js');
const Schema=require('../js/netwizard-project-schema.js');
const PhysicalUi=require('../js/netwizard-physical-inventory-ui.js');
const WorkflowUi=require('../js/netwizard-inventory-workflow-ui.js');

function baseProject(){
  return {
    _schemaVersion:'3.50.0',
    workflow:{mode:'inventory'},
    physicalLocations:[{id:'loc1',name:'Sala técnica',type:'room',inventoryRackMode:'rack'}],
    racks:[{id:'rack1',name:'RACK-01',locationId:'loc1',rackUnits:12}],
    rackItems:[],
    pdus:[],
    powerConnections:[],
    patchPanels:[],
    telecomOutlets:[],
    cableRuns:[],
    patchConnections:[],
    hostOutletConnections:[],
    devices:[{
      id:'sw1',name:'SW-01',type:'switch',kind:'switch',
      manufacturer:'ACME',model:'X48',serialNumber:'SER-001',
      locationId:'loc1',physicalLocation:'Sala técnica',
      rackId:'rack1',rack:'rack1',rackUnit:10,rackUnits:1,
      powerDrawWatts:60
    }],
    ports:[{
      id:'p1',deviceId:'sw1',name:'Gi1/0/1',media:'copper',
      speedMaxMbps:1000,negotiatedSpeedMbps:1000,adminState:'up',operState:'up'
    }],
    links:[],
    hosts:[],
    vlans:[],
    subnets:[],
    fwRules:[],
    dhcp:{},
    iot:{accessNodes:[],devices:[],map:{show:{}}}
  };
}

const clean=baseProject();
const report=Gate.run(clean);
assert.strictEqual(report.ok,true,report.issues.map(x=>x.message).join('\n'));
assert.strictEqual(report.ready,true,'Un As-Built coherente no necesita VLAN/routing/firewall para estar listo');
assert.strictEqual(report.canExportAsBuilt,true);
assert.strictEqual(report.progress.requiredComplete,report.progress.requiredTotal);
assert.strictEqual(report.progress.percent,100);
assert.ok(!report.issues.some(x=>/VLAN|DHCP|routing|firewall/i.test(x.message)));

const declaredRackMissing=baseProject();
declaredRackMissing.racks=[];
Object.assign(declaredRackMissing.devices[0],{rackId:null,rack:null,rackUnit:null,rackUnits:null});
const missingRackReport=Gate.run(declaredRackMissing);
assert.strictEqual(missingRackReport.ok,false);
assert.ok(missingRackReport.issues.some(x=>x.code==='NW-INV-013'&&x.blocking));

const noRack=baseProject();
noRack.physicalLocations[0].inventoryRackMode='none';
noRack.racks=[];
Object.assign(noRack.devices[0],{rackId:null,rack:null,rackUnit:null,rackUnits:null});
const noRackReport=Gate.run(noRack);
assert.strictEqual(noRackReport.ok,true,noRackReport.issues.map(x=>x.message).join('\n'));
assert.strictEqual(noRackReport.progress.steps.find(x=>x.id==='racks').complete,true,'Declarar sin rack satisface el paso físico');

const duplicate=baseProject();
duplicate.devices.push({
  id:'sw2',name:'SW-02',type:'switch',kind:'switch',
  manufacturer:'ACME',model:'X24',serialNumber:'SER-001',
  locationId:'loc1'
});
duplicate.ports.push({id:'p2',deviceId:'sw2',name:'Gi1/0/1',media:'copper',speedMaxMbps:1000});
const duplicateReport=Gate.run(duplicate);
assert.strictEqual(duplicateReport.ok,false);
assert.ok(duplicateReport.issues.some(x=>x.code==='NW-INV-007'&&x.blocking));

const badSpeed=baseProject();
badSpeed.ports[0].negotiatedSpeedMbps=10000;
const speedReport=Gate.run(badSpeed);
assert.strictEqual(speedReport.ok,false);
assert.ok(speedReport.issues.some(x=>x.code==='NW-IF-001'));

const legacyLocation=baseProject();
delete legacyLocation.devices[0].locationId;
legacyLocation.devices[0].physicalLocation='Sala técnica';
const legacyReport=Gate.run(legacyLocation);
assert.ok(!legacyReport.issues.some(x=>x.code==='NW-INV-103'),'El nombre físico legacy debe resolver contra physicalLocations');

const prepared=Schema.prepareImport({...baseProject(),physicalLocations:[{id:'loc1',name:'Sala técnica',inventoryRackMode:'closet'}]});
assert.strictEqual(prepared.ok,true,prepared.errors.join('\n'));
assert.strictEqual(prepared.project.physicalLocations[0].inventoryRackMode,'unknown');
assert.ok(prepared.warnings.some(x=>x.includes('inventoryRackMode desconocido')));

const external=require('../schemas/netwizard-project.schema.json');
assert.deepStrictEqual(external.$defs.physicalLocation.properties.inventoryRackMode.enum,['','rack','wall-cabinet','none','unknown']);

const edited=PhysicalUi.applyDevicePatchToProject(baseProject(),{editId:'sw1',beforeIds:['sw1']},{
  assetTag:'ACT-001',powerDrawWatts:72,locationId:'loc1'
});
assert.strictEqual(edited.targetId,'sw1');
assert.strictEqual(edited.project.devices[0].assetTag,'ACT-001');
assert.strictEqual(edited.project.devices[0].model,'X48','El patch físico no debe borrar datos de modelo no incluidos');

const withNew=baseProject();
withNew.devices.push({id:'sw-new',name:'SW-NUEVO',type:'switch',kind:'switch',modelSource:'custom',modelRef:'custom-x'});
const newApplied=PhysicalUi.applyDevicePatchToProject(withNew,{beforeIds:['sw1'],name:'SW-NUEVO'},{serialNumber:'SER-NEW'});
assert.strictEqual(newApplied.targetId,'sw-new');
assert.strictEqual(newApplied.project.devices.find(x=>x.id==='sw-new').serialNumber,'SER-NEW');
assert.strictEqual(newApplied.project.devices.find(x=>x.id==='sw-new').modelRef,'custom-x');

const portApplied=PhysicalUi.applyPortPatchToProject(baseProject(),{editId:'p1',beforeIds:['p1']},{transceiver:'SFP-1G',utilizationPercent:35});
assert.strictEqual(portApplied.project.ports[0].transceiver,'SFP-1G');
assert.strictEqual(portApplied.project.ports[0].speedMaxMbps,1000);

assert.strictEqual(WorkflowUi.modeOf(baseProject()),'inventory');
assert.strictEqual(WorkflowUi.modeOf({workflow:{mode:'design'}}),'design');
assert.strictEqual(WorkflowUi.locationRackMode(baseProject(),baseProject().physicalLocations[0]),'rack');

console.log('✓ Golden Path de Inventario valida As-Built sin exigir diseño lógico y conserva captura física');
