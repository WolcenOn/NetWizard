'use strict';

const assert=require('assert');
const Manifest=require('../js/netwizard-browser-modules.js');

const paths=Manifest.paths();
for(const legacy of ['js/netwizard-poe-utils.js','js/netwizard-detailed-report.js']){
  assert.ok(!paths.includes(legacy),legacy+' debe permanecer fuera del entrypoint canónico');
}

const poeLegacy=require('../js/netwizard-poe-utils.js');
const poeCanonical=require('../js/netwizard-poe-utils-v2.js');
assert.strictEqual(poeLegacy.version,poeCanonical.version);
assert.strictEqual(poeLegacy.validatePoe,poeCanonical.validatePoe);

const reportLegacy=require('../js/netwizard-detailed-report.js');
const reportCanonical=require('../js/netwizard-detailed-report-v2.js');
assert.strictEqual(reportLegacy.version,reportCanonical.version);
assert.strictEqual(reportLegacy.build,reportCanonical.build);

console.log('✓ Los wrappers legacy delegan al módulo canónico sin entrar en el grafo browser');
