'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const store = new Map();
globalThis.localStorage = {
  getItem(key){ return store.has(key) ? store.get(key) : null; },
  setItem(key, value){ store.set(key, String(value)); },
  removeItem(key){ store.delete(key); },
  clear(){ store.clear(); }
};

const I18n = require('../js/netwizard-i18n.js');
const Gate = require('../js/netwizard-production-gate.js');
const History = require('../js/netwizard-history.js');

function test(name, fn){
  try { fn(); console.log(`✓ ${name}`); }
  catch (err) { console.error(`✗ ${name}`); throw err; }
}

test('Phase 1 closure keeps exact ES/EN parity for new recovery and gate keys', () => {
  const es = I18n.dictionaries.es;
  const en = I18n.dictionaries.en;
  assert.deepStrictEqual(Object.keys(en).sort(), Object.keys(es).sort());
  for(const key of ['history.title','history.confirm.restore','pg.summary.title','pg.summary.result.blocked','pg.stale']){
    assert.ok(es[key], key + ' missing in es');
    assert.ok(en[key], key + ' missing in en');
  }
});

test('Production gate summary localizes labels and messageKey without mutating report data', () => {
  const report = {
    status:'blocked',
    productionMode:true,
    strict:true,
    counts:{errors:1,warnings:0,info:0,blocking:1,byCategory:{schema:{errors:1,warnings:0,info:0}}},
    issues:[{code:'NW-SCHEMA-900',severity:'error',category:'schema',message:'Snapshot inválido',messageKey:'history.error.invalid',messageParams:{},blocking:true}]
  };
  const before = JSON.stringify(report);
  const text = Gate.summarizeGate(report,{locale:'en'});
  assert.ok(text.includes('⛔ Production gate: BLOCKED'));
  assert.ok(text.includes('Mode: production · strict'));
  assert.ok(text.includes('Errors: 1 · Warnings: 0 · Info: 0'));
  assert.ok(text.includes('Invalid snapshot'));
  assert.ok(text.includes('Result: do not export or apply production configurations'));
  assert.strictEqual(JSON.stringify(report), before);
});

test('Release criteria reasons follow explicit report locale', () => {
  const report = {issues:[{code:'NW-X',severity:'error',category:'general',message:'x',blocking:true}]};
  const result = Gate.evaluateReleaseCriteria(report,{locale:'en'});
  assert.ok(result.reasons.some(x => x.includes('1 blocking issue')));
});

test('History recovery errors follow live UI locale', () => {
  I18n.setLocale('en');
  assert.strictEqual(History.restoreSnapshot('missing').error, 'Snapshot not found');
  I18n.setLocale('es');
  assert.strictEqual(History.restoreSnapshot('missing').error, 'Snapshot no encontrado');
});

test('History hot locale switching preserves an unsent snapshot label', () => {
  const src = fs.readFileSync(path.join(root,'js','netwizard-history.js'),'utf8');
  assert.ok(src.includes("const pending=current?current.value:''"));
  assert.ok(src.includes('if(next) next.value=pending'));
});

test('Production gate locale switching rerenders the existing result without recomputing it', () => {
  const src = fs.readFileSync(path.join(root,'js','netwizard-production-gate.js'),'utf8');
  assert.ok(src.includes("root.addEventListener && root.addEventListener('netwizard:i18n', renderLast)"));
  assert.ok(src.includes("if(lastView==='stale')"));
  assert.ok(!src.includes("if(out)out.textContent='Proyecto modificado."));
});

console.log('\nTests Phase 1 i18n closure completados.');
