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
  'iot.page.title','iot.access.title','iot.devices.title','iot.map.title',
  'iot.plan.heading','iot.accessType.zigbee_coordinator','iot.deviceType.camera',
  'iot.tech.camera','iot.confirm.deleteDevice','iot.feedback.planCopied'
]){
  assert.ok(es[key],key+' falta en ES');
  assert.ok(en[key],key+' falta en EN');
  assert.ok(I18N.dictionaries.es[key],key+' falta en bundle ES');
  assert.ok(I18N.dictionaries.en[key],key+' falta en bundle EN');
}

I18N.setLocale('en');
assert.strictEqual(I18N.t('iot.access.empty'),'No IoT infrastructure.');
assert.strictEqual(I18N.t('iot.plan.location',{location:'Lab',role:' / Rack A'}),'  - Location: Lab / Rack A');
I18N.setLocale('es');
assert.strictEqual(I18N.t('iot.map.panelHint'),'Haz clic en un nodo para editar o inspeccionar.');

const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
for(const key of [
  'iot.page.title','iot.access.title','iot.devices.title','iot.map.title',
  'iot.plan.title','iot.access.modalTitle','iot.devices.modalTitle'
]){
  assert.ok(html.includes('data-i18n="'+key+'"'),'Falta contrato HTML '+key);
}

const source=fs.readFileSync(path.join(root,'js','netwizard-iot-embedded.js'),'utf8');
for(const key of [
  'iot.stats.infrastructure','iot.access.meta.management','iot.devices.meta.access',
  'iot.plan.action.mqtt','iot.map.technology','iot.confirm.deleteAccess'
]){
  assert.ok(source.includes("'"+key+"'"),'Falta uso dinámico '+key);
}
assert.ok(source.includes("window.addEventListener('netwizard:i18n'"),'Falta rerender IoT en cambio de locale');

const auditRun=spawnSync(process.execPath,['scripts/i18n-audit-hardcoded.js','--check'],{cwd:root,encoding:'utf8'});
assert.strictEqual(auditRun.status,0,(auditRun.stdout||'')+'\n'+(auditRun.stderr||''));

console.log('✓ Beta i18n: IoT workspace tiene ES/EN completo y guardrail estricto');
