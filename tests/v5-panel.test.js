'use strict';

const assert=require('assert');
const fs=require('fs');
const path=require('path');
const factory=require('../js/netwizard-v5-panel.js');

assert.strictEqual(factory.version,'netwizard-v5-panel-factory-v1');
assert.strictEqual(typeof factory.create,'function');

const source=fs.readFileSync(path.join(__dirname,'../js/netwizard-v5-panel.js'),'utf8');
assert.ok(!source.includes('.innerHTML'), 'El panel V5 no debe usar innerHTML');
assert.ok(source.includes("textContent=String(text)"), 'El panel V5 debe escribir texto mediante textContent');
assert.ok(source.includes("o.actions?.[name]?.("), 'El panel debe delegar acciones en el controlador');
assert.ok(!source.includes('project().devices['), 'El panel no debe mutar dispositivos por índice');
assert.ok(!source.includes('visual().pos['), 'El panel no debe mutar posiciones directamente');

console.log('✓ V5 panel queda limitado a DOM seguro y delegación de acciones');