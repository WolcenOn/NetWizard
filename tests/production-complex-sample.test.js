'use strict';
const assert=require('assert');
const fs=require('fs');
const path=require('path');

const root=path.resolve(__dirname,'..');
require(path.join(root,'js','netwizard-audit.js'));
const Schema=require(path.join(root,'js','netwizard-project-schema.js'));
const Gate=require(path.join(root,'js','netwizard-production-gate.js'));
const Rack=require(path.join(root,'js','netwizard-rack-model.js'));

const payload=JSON.parse(fs.readFileSync(path.join(root,'samples','production-complex-ready.json'),'utf8'));
const defaults=()=>({
  _schemaVersion:'3.48.0',step:'dash',projName:'',
  devices:[],ports:[],vlans:[],subnets:[],hosts:[],links:[],fwRules:[],
  vlanMatrix:{},dhcp:{},security:{},roas:{},vtp:{roles:{}},topo:{pos:{}},
  visual:{locs:[],assign:{devices:{},hosts:{}},pos:{},view:{}},
  iot:{accessNodes:[],devices:[],map:{show:{}}},
  physicalLocations:[],hostPhysicalLocations:[],uiSort:{},
  racks:[],rackItems:[],pdus:[],powerConnections:[]
});

const prepared=Schema.prepareImport(payload,{defaults});
assert.strictEqual(prepared.ok,true,prepared.errors&&prepared.errors.join('\n'));
assert.strictEqual(prepared.project._schemaVersion,Schema.schemaVersion||'3.50.0');
assert.ok(prepared.project.devices.length>=3);
assert.ok(prepared.project.vlans.length>=6);
assert.ok(prepared.project.links.length>=2);
assert.ok(prepared.project.racks.length>=1);

const rack=Rack.validate(prepared.project);
assert.strictEqual(rack.ok,true,rack.issues.map(i=>`${i.code}: ${i.message}`).join('\n'));

const report=Gate.runProductionGate(prepared.project,{productionMode:true,strict:true});
assert.strictEqual(report.canExport,true,report.issues.map(i=>`[${i.severity}] [${i.code}] ${i.message}`).join('\n'));
assert.strictEqual(report.counts.blocking,0,Gate.summarizeGate(report));

console.log('✓ Sample complejo importa, valida racks y supera la puerta de producción sin bloqueos');
