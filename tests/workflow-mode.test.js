'use strict';

const assert=require('assert');
const fs=require('fs');
const path=require('path');
const Schema=require('../js/netwizard-project-schema.js');

const minimal={
  devices:[],ports:[],vlans:[],subnets:[],hosts:[],links:[],fwRules:[],dhcp:{},
  iot:{accessNodes:[],devices:[],map:{show:{}}}
};

// Legacy/current projects without workflow remain compatible and become design.
const legacy=Schema.prepareImport(minimal);
assert.strictEqual(legacy.ok,true,legacy.errors.join('\n'));
assert.deepStrictEqual(legacy.project.workflow,{mode:'design'});
assert.ok(!legacy.migrations.some(x=>/workflow/i.test(x)),'3.50 compatibility must not add a schema migration just for workflow defaulting');

// Inventory survives sanitize/import/export.
const inventory=Schema.prepareImport({...minimal,workflow:{mode:'inventory',note:'field survey'}});
assert.strictEqual(inventory.ok,true,inventory.errors.join('\n'));
assert.strictEqual(inventory.project.workflow.mode,'inventory');
assert.strictEqual(inventory.project.workflow.note,'field survey');
const exported=Schema.prepareExport(inventory.project);
assert.strictEqual(exported.project.workflow.mode,'inventory');

// Design remains explicit.
const design=Schema.prepareImport({...minimal,workflow:{mode:'design'}});
assert.strictEqual(design.ok,true);
assert.strictEqual(design.project.workflow.mode,'design');

// Unknown values are made safe but never silently.
const unknown=Schema.prepareImport({...minimal,workflow:{mode:'maintenance'}});
assert.strictEqual(unknown.ok,true);
assert.strictEqual(unknown.project.workflow.mode,'design');
assert.ok(unknown.warnings.some(x=>x.includes('workflow.mode desconocido')));

// Direct validation catches an invalid unsanitized contract.
const invalid=Schema.validateProject({...minimal,workflow:{mode:'maintenance'}});
assert.strictEqual(invalid.ok,false);
assert.ok(invalid.errors.some(x=>x.includes('workflow.mode debe ser inventory o design')));

assert.deepStrictEqual(Schema.model.workflowModes,['inventory','design']);

// External JSON Schema must describe the same contract.
const external=JSON.parse(fs.readFileSync(path.join(__dirname,'..','schemas','netwizard-project.schema.json'),'utf8'));
assert.deepStrictEqual(external.$defs.project.properties.workflow.properties.mode.enum,['inventory','design']);

console.log('✓ workflow.mode distingue inventory/design sin romper proyectos existentes');
