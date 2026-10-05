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
  'hosts.page.title','hosts.form.title','hosts.actions.add','hosts.subnet.summary',
  'hosts.connection.directAuthority','hosts.alert.ipOutsideSubnet','hosts.bulk.result',
  'hosts.list.page','hosts.ipMap.summary','hosts.typeLabel.server'
]){
  assert.ok(es[key],key+' falta en ES');
  assert.ok(en[key],key+' falta en EN');
  assert.ok(I18N.dictionaries.es[key],key+' falta en bundle ES');
  assert.ok(I18N.dictionaries.en[key],key+' falta en bundle EN');
}

I18N.setLocale('en');
assert.strictEqual(I18N.t('hosts.form.title'),'➕ New host');
assert.strictEqual(I18N.t('hosts.alert.ipOutsideSubnet',{ip:'10.0.0.9',cidr:'10.0.1.0/24'}),'IP 10.0.0.9 is not in 10.0.1.0/24.');
I18N.setLocale('es');
assert.strictEqual(I18N.t('hosts.ipMap.noVlans'),'Sin VLANs configuradas.');

const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
for(const key of [
  'hosts.page.title','hosts.form.title','hosts.form.connectedDevice','hosts.actions.bulk',
  'hosts.ipMap.title','hosts.list.title','hosts.bulk.title'
]){
  assert.ok(html.includes('data-i18n="'+key+'"'),'Falta contrato HTML '+key);
}
assert.ok(html.includes('data-i18n-placeholder="hosts.form.notesPlaceholder"'),'Falta placeholder i18n de notas');

const source=fs.readFileSync(path.join(root,'js','netwizard.js'),'utf8');
for(const key of [
  'hosts.subnet.none','hosts.connection.ambiguous','hosts.alert.staticRequired',
  'hosts.bulk.invalidFormat','hosts.empty.filtered','hosts.ipMap.noSubnet'
]){
  assert.ok(source.includes("i18nText('"+key+"'"),'Falta uso dinámico '+key);
}

const auditRun=spawnSync(process.execPath,['scripts/i18n-audit-hardcoded.js','--check'],{cwd:root,encoding:'utf8'});
assert.strictEqual(auditRun.status,0,(auditRun.stdout||'')+'\n'+(auditRun.stderr||''));

console.log('✓ Beta i18n: Hosts/IP Map tienen ES/EN completo y guardrail estricto');
