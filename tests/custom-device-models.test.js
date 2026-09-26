'use strict';

const assert=require('assert');
const fs=require('fs');
const path=require('path');
const Schema=require('../js/netwizard-project-schema.js');
const Models=require('../js/netwizard-custom-device-models.js');

const base={
  workflow:{mode:'inventory'},
  customDeviceModels:[{
    id:'acme-x48p',
    manufacturer:' ACME ',
    model:' X48P ',
    sku:' X48P-POE ',
    kind:'switch',
    rackUnits:'1',
    weightKg:'4.8',
    powerTypicalWatts:'82',
    powerMaxWatts:'370',
    poeBudgetWatts:'240',
    powerSupplies:{count:'2',redundant:true,voltage:'230V'},
    portGroups:[
      {id:'access',namePattern:'Gi1/0/{n}',count:'48',media:'copper',speedMaxMbps:'1000',supportedSpeedsMbps:['10','100','1000'],poeCapable:true},
      {id:'uplinks',namePattern:'SFP+{n}',count:4,startIndex:1,media:'sfp+',speedMaxMbps:10000,supportedSpeedsMbps:[1000,10000],poeCapable:false}
    ],
    capabilities:{l2:true,l3:true,stacking:true}
  }],
  devices:[{
    id:'sw1',name:'SW-PLANTA-1',kind:'switch',type:'switch',vendorOs:'generic_network',
    modelSource:'custom',modelRef:'acme-x48p',serialNumber:' SN-001 ',assetTag:' RACK-A-01 '
  }],
  ports:[],vlans:[],subnets:[],hosts:[],links:[],fwRules:[],dhcp:{},
  iot:{accessNodes:[],devices:[],map:{show:{}}}
};

const prepared=Schema.prepareImport(base);
assert.strictEqual(prepared.ok,true,prepared.errors.join('\n'));
assert.strictEqual(prepared.project.customDeviceModels.length,1);
const model=prepared.project.customDeviceModels[0];
assert.strictEqual(model.manufacturer,'ACME');
assert.strictEqual(model.model,'X48P');
assert.strictEqual(model.rackUnits,1);
assert.strictEqual(model.weightKg,4.8);
assert.strictEqual(model.powerTypicalWatts,82);
assert.strictEqual(model.powerMaxWatts,370);
assert.strictEqual(model.poeBudgetWatts,240);
assert.deepStrictEqual(model.powerSupplies,{count:2,redundant:true,voltage:'230V'});
assert.deepStrictEqual(model.portGroups[0].supportedSpeedsMbps,[10,100,1000]);
assert.strictEqual(prepared.project.devices[0].modelSource,'custom');
assert.strictEqual(prepared.project.devices[0].modelRef,'acme-x48p');
assert.strictEqual(prepared.project.devices[0].serialNumber,'SN-001');

const exported=Schema.prepareExport(prepared.project);
assert.strictEqual(exported.project.customDeviceModels[0].id,'acme-x48p');
assert.strictEqual(exported.project.devices[0].modelRef,'acme-x48p');

const resolved=Models.resolve(prepared.project,prepared.project.devices[0]);
assert.strictEqual(resolved.source,'custom');
assert.strictEqual(resolved.model.model,'X48P');

const expanded=Models.expandPortGroups(resolved.model);
assert.strictEqual(expanded.length,52);
assert.strictEqual(expanded[0].name,'Gi1/0/1');
assert.strictEqual(expanded[47].name,'Gi1/0/48');
assert.strictEqual(expanded[48].name,'SFP+1');
assert.strictEqual(expanded[51].speedMaxMbps,10000);

const applied=Models.applyModel({id:'sw2',name:'SW2',rackUnits:2,powerDrawWatts:50},resolved.model);
assert.strictEqual(applied.modelSource,'custom');
assert.strictEqual(applied.modelRef,'acme-x48p');
assert.strictEqual(applied.manufacturer,'ACME');
assert.strictEqual(applied.rackUnits,2,'instance override must be preserved');
assert.strictEqual(applied.powerDrawWatts,50,'instance power override must be preserved');
assert.strictEqual(applied.poeBudgetW,240);

const overwritten=Models.applyModel({id:'sw3',rackUnits:2},resolved.model,{overwrite:true});
assert.strictEqual(overwritten.rackUnits,1);

const broken=Schema.prepareImport({...base,devices:[{id:'sw1',name:'SW1',type:'switch',kind:'switch',modelSource:'custom',modelRef:'missing'}]});
assert.strictEqual(broken.ok,false);
assert.ok(broken.errors.some(x=>x.includes('modelRef personalizado inexistente')));

const missingRef=Schema.prepareImport({...base,devices:[{id:'sw1',name:'SW1',type:'switch',kind:'switch',modelSource:'custom'}]});
assert.strictEqual(missingRef.ok,false);
assert.ok(missingRef.errors.some(x=>x.includes('requiere modelRef')));

const badSource=Schema.prepareImport({...base,devices:[{id:'sw1',name:'SW1',type:'switch',kind:'switch',modelSource:'remote'}]});
assert.strictEqual(badSource.ok,true);
assert.strictEqual(badSource.project.devices[0].modelSource,'manual');
assert.ok(badSource.warnings.some(x=>x.includes('modelSource desconocido')));

const duplicate=Schema.validateProject({...prepared.project,customDeviceModels:[model,{...model}]});
assert.strictEqual(duplicate.ok,false);
assert.ok(duplicate.errors.some(x=>x.includes('customDeviceModels: id duplicado')));

const external=JSON.parse(fs.readFileSync(path.join(__dirname,'..','schemas','netwizard-project.schema.json'),'utf8'));
assert.ok(external.$defs.customDeviceModel);
assert.strictEqual(external.$defs.project.properties.customDeviceModels.items.$ref,'#/$defs/customDeviceModel');
assert.deepStrictEqual(external.$defs.device.properties.modelSource.enum,['manual','global','custom']);

console.log('✓ Modelos personalizados son portables, referenciables y expanden puertos sin sobrescribir instancias');
