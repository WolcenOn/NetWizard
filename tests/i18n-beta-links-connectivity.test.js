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
const Transit=require('../js/netwizard-inter-site-transit-editor.js');

const es=JSON.parse(fs.readFileSync(path.join(root,'i18n','es.json'),'utf8'));
const en=JSON.parse(fs.readFileSync(path.join(root,'i18n','en.json'),'utf8'));
assert.deepStrictEqual(Object.keys(es).sort(),Object.keys(en).sort(),'ES y EN deben mantener paridad exacta');

for(const key of [
  'links.page.title','links.form.medium','links.list.page','links.alert.portAlreadyLinked',
  'links.feedback.switchUplink','links.transit.title','links.transit.alert.validCidr',
  'links.transit.empty','links.transit.create'
]){
  assert.ok(es[key],key+' falta en ES');
  assert.ok(en[key],key+' falta en EN');
  assert.ok(I18N.dictionaries.es[key],key+' falta en bundle ES');
  assert.ok(I18N.dictionaries.en[key],key+' falta en bundle EN');
}

I18N.setLocale('en');
assert.strictEqual(I18N.t('links.empty.none'),'No links.');
assert.strictEqual(I18N.t('links.list.page',{count:12,page:1,total:2}),'12 links · page 1/2');
I18N.setLocale('es');
assert.strictEqual(I18N.t('links.transit.selectDevice'),'— dispositivo L3 —');

assert.ok(Transit.parseCidr('10.255.0.0/30'));
assert.strictEqual(Transit.contains('10.255.0.0/30','10.255.0.1'),true);

const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
for(const key of ['links.page.title','links.form.title','links.portView.title','links.list.title']){
  assert.ok(html.includes('data-i18n="'+key+'"'),'Falta contrato HTML '+key);
}
assert.ok(html.includes('data-i18n-placeholder="links.form.notesPlaceholder"'));

const source=fs.readFileSync(path.join(root,'js','netwizard-inter-site-transit-editor.js'),'utf8');
assert.ok(source.includes("root.addEventListener&&root.addEventListener('netwizard:i18n'"),'Falta rerender de tránsito en cambio de locale');
assert.ok(source.includes("typeof I18N.t==='function'?I18N.t(key,params)"),'El helper de tránsito debe delegar en NetWizardI18n.t');
assert.ok(!source.includes('I18N.i18nText('),'No debe renombrarse accidentalmente la API runtime de i18n');
assert.ok(!source.includes("'Tránsito inter-sede a '"),'No debe persistirse descripción traducida como dato canónico');
assert.ok(source.includes("'Inter-site transit to '"),'El fallback persistido debe ser locale-neutral');

const audit=spawnSync(process.execPath,['scripts/i18n-audit-hardcoded.js','--check'],{cwd:root,encoding:'utf8'});
assert.strictEqual(audit.status,0,(audit.stdout||'')+'\n'+(audit.stderr||''));

console.log('✓ Beta i18n: Links/conectividad tiene ES/EN completo y guardrail estricto');
