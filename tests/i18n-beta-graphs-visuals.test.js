'use strict';

const assert=require('assert');
const fs=require('fs');
const path=require('path');
const {spawnSync}=require('child_process');

const root=path.resolve(__dirname,'..');
const store=new Map();
global.localStorage={
  getItem:key=>store.has(key)?store.get(key):null,
  setItem:(key,value)=>store.set(key,String(value)),
  removeItem:key=>store.delete(key)
};

delete require.cache[require.resolve('../js/netwizard-i18n.js')];
const I18N=require('../js/netwizard-i18n.js');

const es=JSON.parse(fs.readFileSync(path.join(root,'i18n','es.json'),'utf8'));
const en=JSON.parse(fs.readFileSync(path.join(root,'i18n','en.json'),'utf8'));
assert.deepStrictEqual(Object.keys(es).sort(),Object.keys(en).sort(),'ES y EN deben mantener paridad exacta');

for(const key of [
  'graphs.page.title','graphs.v5.title','graphs.topology.title','graphs.panel.title',
  'graphs.layout.treeBlocks','graphs.trace.blocked','graphs.iot.editDevice',
  'graphs.confirm.deleteLocationImpact','graphs.canvas.autoPending','graphs.trace.reason.firewallRule','iot.tech.controller','iot.tech.generic'
]){
  assert.ok(es[key],key+' falta en ES');
  assert.ok(en[key],key+' falta en EN');
  assert.ok(I18N.dictionaries.es[key],key+' falta en bundle ES');
  assert.ok(I18N.dictionaries.en[key],key+' falta en bundle EN');
}

I18N.setLocale('en');
assert.strictEqual(I18N.t('graphs.page.title'),'🧭 Graph Views');
assert.strictEqual(I18N.t('graphs.panel.locationSummary',{devices:2,hosts:3}),'2 devices · 3 hosts');
I18N.setLocale('es');
assert.strictEqual(I18N.t('graphs.trace.physicalGap'),'FALTA ENLACE FÍSICO');

const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
for(const key of [
  'graphs.page.title','graphs.tabs.v5','graphs.v5.title','graphs.actions.autoLocate',
  'graphs.topology.title','graphs.topology.interactionHint'
]){
  assert.ok(html.includes('data-i18n="'+key+'"'),'Falta contrato HTML '+key);
}

for(const file of [
  'js/netwizard-v5-panel.js','js/netwizard-v5-controls.js','js/netwizard-v5-layout-manager.js',
  'js/netwizard-v5-iot-extension.js','js/netwizard-v5-connectivity-trace.js'
]){
  const source=fs.readFileSync(path.join(root,file),'utf8');
  assert.ok(source.includes('graphs.'),'Falta i18n Graphs en '+file);
}

const main=fs.readFileSync(path.join(root,'js','netwizard.js'),'utf8');
assert.ok(main.includes("if(S.step==='graphs')"),'Falta rerender Graphs en cambio de locale');
assert.ok(main.includes("i18nText('graphs.confirm.deleteLocation'"),'Falta confirmación localizada de ubicación');
const connectivity=fs.readFileSync(path.join(root,'js','netwizard-connectivity-model.js'),'utf8');
assert.ok(connectivity.includes("messageKey:'graphs.trace.reason.firewallRule'")||connectivity.includes("reasonKey:'graphs.trace.reason.firewallRule'"),'Falta razón estable para bloqueo firewall');
assert.ok(connectivity.includes("messageKey:'graphs.trace.reason.policyBlocked'"),'Falta razón estable para bloqueo de matriz');

const auditRun=spawnSync(process.execPath,['scripts/i18n-audit-hardcoded.js','--check'],{cwd:root,encoding:'utf8'});
assert.strictEqual(auditRun.status,0,(auditRun.stdout||'')+'\n'+(auditRun.stderr||''));

console.log('✓ Beta i18n: Graphs/V5/topología tienen ES/EN y guardrail estricto');
