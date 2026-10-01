'use strict';

const assert=require('assert');
const Schema=require('../js/netwizard-project-schema.js');

const project={
  _schemaVersion:'3.50.0',
  projName:'Budget schema',
  workflow:{mode:'design'},
  devices:[{id:'sw1',name:'SW-01',type:'switch',kind:'switch',manufacturer:'Cisco',model:'C9200L',modelSource:'manual'}],
  ports:[],vlans:[],subnets:[],hosts:[],links:[],fwRules:[],physicalLocations:[],hostPhysicalLocations:[],customDeviceModels:[],
  racks:[],rackItems:[],pdus:[],powerConnections:[],patchPanels:[],telecomOutlets:[],cableRuns:[],patchConnections:[],hostOutletConnections:[],
  budget:{
    version:'netwizard-budget-v1',
    currency:'eur',
    taxRatePct:21,
    defaultMarginPct:25,
    scope:'full',
    resourcePricing:{
      'device:sw1':{
        unitCost:1000,unitPrice:1500,chargeType:'one-time',capexOpex:'capex',
        billingPeriodMonths:1,supplier:'Dist A',quoteRef:'Q-1'
      }
    },
    modelPricing:{},
    serviceLines:[
      {
        id:'labor1',category:'Mano de obra',description:'Instalación',quantity:4,unit:'h',
        unitCost:25,unitPrice:50,chargeType:'one-time',billingPeriodMonths:1,capexOpex:'capex',
        resourceRef:'device:sw1'
      }
    ]
  }
};

const prepared=Schema.prepareImport(project);
assert.strictEqual(prepared.ok,true,prepared.errors&&prepared.errors.join('\n'));
assert.strictEqual(prepared.project.budget.version,'netwizard-budget-v1');
assert.strictEqual(prepared.project.budget.currency,'EUR');
assert.strictEqual(prepared.project.budget.resourcePricing['device:sw1'].unitPrice,1500);
assert.strictEqual(prepared.project.budget.serviceLines[0].resourceRef,'device:sw1');

const exported=Schema.prepareExport(prepared.project);
assert.strictEqual(exported.project.budget.currency,'EUR');
assert.strictEqual(exported.project.budget.serviceLines.length,1);
assert.strictEqual(Schema.model.budgetVersion,'netwizard-budget-v1');

const legacy=Schema.prepareImport({
  _schemaVersion:'3.50.0',projName:'Legacy without budget',workflow:{mode:'design'},
  devices:[],ports:[],vlans:[],subnets:[],hosts:[],links:[],fwRules:[],physicalLocations:[],hostPhysicalLocations:[],customDeviceModels:[],
  racks:[],rackItems:[],pdus:[],powerConnections:[],patchPanels:[],telecomOutlets:[],cableRuns:[],patchConnections:[],hostOutletConnections:[]
});
assert.strictEqual(legacy.ok,true);
const legacyExport=Schema.prepareExport(legacy.project);
assert.strictEqual(Object.prototype.hasOwnProperty.call(legacyExport.project,'budget'),false,'Un proyecto legacy no debe exportar budget vacío');

console.log('✓ Project Schema conserva budget v1 y mantiene proyectos legacy sin budget');
