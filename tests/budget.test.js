'use strict';

const assert=require('assert');
global.NetWizardPhysicalInterventionPlan=require('../js/netwizard-physical-intervention-plan.js');
global.NetWizardFieldInterventionPackage=require('../js/netwizard-field-intervention-package.js');
global.NetWizardXlsxWriter=require('../js/netwizard-xlsx-writer.js');
const Budget=require('../js/netwizard-budget.js');

const project={
  _schemaVersion:'3.50.0',
  projName:'Presupuesto sede',
  workflow:{
    mode:'design',
    derivedFrom:{type:'inventory',snapshotId:'snap1',sourceProjectName:'Sede'},
    interventionBaseline:{
      version:'netwizard-physical-intervention-baseline-v1',capturedAt:'2026-10-01T08:00:00Z',
      racks:[{id:'rack1',name:'RACK-01',rackUnits:24}],devices:[],pdus:[],powerConnections:[],
      cableRuns:[],patchConnections:[],hostOutletConnections:[]
    }
  },
  devices:[
    {id:'sw1',name:'SW-01',type:'switch',kind:'switch',manufacturer:'Cisco',model:'C9200L',modelSource:'global',modelRef:'global-cisco-c9200l',designDisposition:'add'},
    {id:'fw1',name:'FW-01',type:'firewall',kind:'firewall',manufacturer:'Fortinet',model:'FG-80F',modelSource:'manual',designDisposition:'add'}
  ],
  ports:[
    {id:'sw1-p1',deviceId:'sw1',name:'Gi1/0/1',transceiver:'SFP-10G-SR'},
    {id:'fw1-p1',deviceId:'fw1',name:'wan1'}
  ],
  links:[{id:'dac1',name:'Core DAC',medium:'DAC'}],
  racks:[{id:'rack1',name:'RACK-01',rackUnits:24,originRef:'rack1'}],
  rackItems:[],pdus:[],powerConnections:[],
  patchPanels:[{id:'pp1',name:'PP-01',portCount:24,category:'Cat6A'}],
  telecomOutlets:[{id:'to1',name:'TO-01',portCount:2,category:'Cat6A'}],
  cableRuns:[{id:'cab1',label:'C-001',cableType:'Cat6A',lengthM:100}],
  patchConnections:[{id:'pc1',patchPanelId:'pp1',switchPortId:'sw1-p1'}],
  hostOutletConnections:[],
  wanCircuits:[{id:'wan1',name:'Fibra 1G',provider:'ISP-A',deviceId:'fw1',portId:'fw1-p1',enabled:true}],
  customDeviceModels:[],
  budget:{
    version:'netwizard-budget-v1',
    currency:'EUR',taxRatePct:21,defaultMarginPct:20,scope:'full',
    modelPricing:{
      'global:global-cisco-c9200l':{unitCost:1000,unitPrice:1500,chargeType:'one-time',capexOpex:'capex'}
    },
    resourcePricing:{
      'device:fw1':{unitCost:500,unitPrice:800,chargeType:'one-time',capexOpex:'capex'},
      'cableRun:cab1':{unitCost:0.5,unitPrice:1,chargeType:'one-time',capexOpex:'capex'},
      'wanCircuit:wan1':{unitCost:50,unitPrice:80,chargeType:'recurring',billingPeriodMonths:1,capexOpex:'opex'}
    },
    serviceLines:[
      {id:'labor1',category:'Mano de obra',description:'Instalación y puesta en marcha',quantity:8,unit:'h',unitCost:25,unitPrice:50,chargeType:'one-time',capexOpex:'capex'},
      {id:'lic1',category:'Licencia',description:'UTM anual',quantity:1,unit:'año',unitCost:240,unitPrice:360,chargeType:'recurring',billingPeriodMonths:12,capexOpex:'opex',resourceRef:'device:fw1'}
    ]
  }
};

const original=JSON.parse(JSON.stringify(project));
let report=Budget.build(project);
assert.deepStrictEqual(project,original,'El presupuesto no debe mutar el proyecto');
assert.strictEqual(report.currency,'EUR');
assert.ok(report.lines.some(x=>x.resourceRef==='device:sw1'&&x.pricingSource==='model'&&x.unitPrice===1500));
assert.ok(report.lines.some(x=>x.resourceRef==='cableRun:cab1'&&x.quantity===100&&x.totalPrice===100));
assert.ok(report.lines.some(x=>x.resourceRef==='wanCircuit:wan1'&&x.monthlyRecurringPrice===80));
assert.ok(report.lines.some(x=>x.resourceKind==='service'&&x.description==='Instalación y puesta en marcha'));
assert.strictEqual(report.totals.oneTimeCost,1750);
assert.strictEqual(report.totals.oneTimePrice,2800);
assert.strictEqual(report.totals.monthlyRecurringCost,70);
assert.strictEqual(report.totals.monthlyRecurringPrice,110);
assert.strictEqual(report.totals.annualRecurringCost,840);
assert.strictEqual(report.totals.annualRecurringPrice,1320);
assert.strictEqual(report.totals.year1Cost,2590);
assert.strictEqual(report.totals.year1Price,4120);
assert.strictEqual(report.totals.grossProfitYear1,1530);
assert.strictEqual(report.totals.taxAmountYear1,865.2);
assert.strictEqual(report.totals.year1CustomerTotal,4985.2);
assert.ok(report.counts.unpriced>0,'Los materiales sin precio deben permanecer visibles');

const validation=Budget.validateProject(project);
assert.strictEqual(validation.ok,true,JSON.stringify(validation.issues));
assert.ok(validation.counts.unpriced>0);

report=Budget.build(project,{scope:'intervention'});
assert.ok(report.lines.some(x=>x.resourceRef==='device:sw1'));
assert.ok(report.lines.some(x=>x.resourceRef==='device:fw1'));
assert.ok(!report.lines.some(x=>x.resourceRef==='rack:rack1'),'El rack reutilizado no entra en BOM diferencial');
assert.ok(report.lines.some(x=>x.resourceRef==='wanCircuit:wan1'),'WAN recurrente sigue visible para decisión comercial');
assert.ok(report.lines.some(x=>x.resourceKind==='service'));

const rows=Budget.toRows(project);
assert.ok(rows.some(x=>x.resourceRef==='device:sw1'&&x.totalPrice===1500));
const csv=Budget.toCsv(project);
assert.ok(csv.includes('resourceRef'));
assert.ok(csv.includes('device:sw1'));
const xlsx=Budget.buildXlsx(project);
assert.ok(xlsx instanceof Uint8Array);
assert.strictEqual(xlsx[0],0x50);
assert.strictEqual(xlsx[1],0x4b);
const md=Budget.markdown(project);
assert.ok(md.includes('# BOM & Presupuesto'));
assert.ok(md.includes('Total cliente año 1: 4985.20 EUR'));

const bad=JSON.parse(JSON.stringify(project));
bad.budget.resourcePricing['ghost:x']={unitCost:10,unitPrice:5};
const badValidation=Budget.validateProject(bad);
assert.ok(badValidation.issues.some(x=>x.code==='NW-BUDGET-003'&&!x.blocking));
assert.ok(badValidation.issues.some(x=>x.code==='NW-BUDGET-004'&&!x.blocking));

console.log('✓ BOM & Budget deriva inventario, recurrencia, CAPEX/OPEX y margen sin duplicar recursos');
