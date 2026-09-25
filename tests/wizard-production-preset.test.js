'use strict';

const assert=require('assert');
const fs=require('fs');
const path=require('path');

const root=path.resolve(__dirname,'..');
require('../js/netwizard-audit.js');
require('../js/netwizard-network-utils.js');
require('../js/netwizard-l2-utils.js');
require('../js/netwizard-dhcp-utils.js');
require('../js/netwizard-policy-utils.js');
require('../js/netwizard-broadcast-utils.js');
require('../js/netwizard-vendor-hardening.js');
const Schema=require('../js/netwizard-project-schema.js');
const Presets=require('../js/netwizard-wizard-presets.js');
const Gate=require('../js/netwizard-production-gate.js');

const canonical=JSON.parse(fs.readFileSync(path.join(root,'samples','small-office.json'),'utf8')).project;
const preset=Presets.get('production-small-office');

assert.ok(preset,'falta preset production-small-office');
assert.deepStrictEqual(preset,canonical,'el preset del asistente debe seguir el fixture certificado small-office');

const prepared=Schema.prepareImport({
  format:'netwizard-project',
  schemaVersion:'3.50.0',
  project:preset
},{defaults:()=>({})});
assert.strictEqual(prepared.ok,true,(prepared.errors||[]).join('\n'));

const report=Gate.runProductionGate(prepared.project,{productionMode:true,strict:true});
assert.strictEqual(report.status,'ready',Gate.summarizeGate(report));
assert.strictEqual(report.canExport,true,Gate.summarizeGate(report));
assert.strictEqual(report.counts.blocking,0,Gate.summarizeGate(report));
assert.strictEqual(report.counts.warnings,0,Gate.summarizeGate(report));

const exported=Schema.prepareExport(prepared.project);
assert.strictEqual(exported.schemaVersion,'3.50.0');
assert.ok(exported.project.devices.length>=3);
assert.ok(exported.project.links.length>=2);
assert.ok(exported.project.vlans.length>=3);

console.log('✓ Preset por defecto del asistente coincide con small-office y queda READY para producción');
