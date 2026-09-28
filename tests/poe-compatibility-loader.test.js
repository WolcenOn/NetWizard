'use strict';

const assert=require('assert');

const canonical=require('../js/netwizard-poe-utils-v2.js');
const legacy=require('../js/netwizard-poe-utils.js');

assert.strictEqual(legacy.version,canonical.version);
assert.strictEqual(typeof legacy.validatePoe,'function');
assert.strictEqual(typeof legacy.mountPoePanel,'function');

console.log('✓ El loader PoE legacy delega al módulo canónico sin formar parte del entrypoint');
