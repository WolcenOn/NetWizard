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
global.NetWizardI18n=I18N;

const es=JSON.parse(fs.readFileSync(path.join(root,'i18n','es.json'),'utf8'));
const en=JSON.parse(fs.readFileSync(path.join(root,'i18n','en.json'),'utf8'));
const keys=Object.keys(es).filter(k=>k.startsWith('device.')||k.startsWith('ports.'));
assert.ok(keys.length>=160,'Dispositivos/Puertos debe tener cobertura i18n sustancial');
for(const key of keys){
  assert.ok(Object.prototype.hasOwnProperty.call(en,key),'Falta clave EN: '+key);
  assert.strictEqual(typeof es[key],'string',key+' ES debe ser string');
  assert.strictEqual(typeof en[key],'string',key+' EN debe ser string');
}

assert.strictEqual(I18N.dictionaries.en['device.page.title'],'🖥 Devices');
assert.strictEqual(I18N.dictionaries.en['device.kind.access_point'],'Access Point');
assert.strictEqual(I18N.dictionaries.en['ports.bulk.title'],'🧩 Bulk port creation and editing');

const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
for(const marker of [
  'data-i18n="device.page.title"',
  'data-i18n="device.actions.add"',
  'data-i18n="device.list.title"',
  'data-i18n="ports.page.title"',
  'data-i18n="ports.form.title"',
  'data-i18n="ports.actions.quick24"',
  'data-i18n="ports.list.title"',
  'data-i18n-placeholder="ports.form.allowedVlansPlaceholder"'
]) assert.ok(html.includes(marker),'Falta contrato i18n HTML: '+marker);

const core=fs.readFileSync(path.join(root,'js','netwizard.js'),'utf8');
assert.match(core,/deviceKindText/);
assert.match(core,/device\.catalog\.u6pro\.note/);
assert.match(core,/ports\.list\.page/);
assert.match(core,/netwizard:i18n/);

const customSource=fs.readFileSync(path.join(root,'js','netwizard-custom-device-model-ui.js'),'utf8');
assert.match(customSource,/device\.custom\.title/);
assert.match(customSource,/i18nNode\('option'/);

const bulkSource=fs.readFileSync(path.join(root,'js','netwizard-bulk-port-editor.js'),'utf8');
assert.match(bulkSource,/ports\.bulk\.title/);
assert.match(bulkSource,/netwizard:i18n/);

delete require.cache[require.resolve('../js/netwizard-bulk-port-editor.js')];
const Bulk=require('../js/netwizard-bulk-port-editor.js');
const base={
  devices:[{id:'sw1',name:'SW1'}],
  vlans:[{id:'v10',vlanId:10,name:'Users'}],
  ports:[]
};
const rows=Bulk.buildRows(base,{deviceId:'sw1',root:'Gi1/0/',start:1,count:2,media:'GE',mode:'access',accessVlanRef:'v10'});
assert.strictEqual(rows.length,2);
assert.strictEqual(rows[0].name,'Gi1/0/1');
assert.strictEqual(Bulk.applyRows(base,rows).ports.length,2);

delete require.cache[require.resolve('../js/netwizard-custom-device-model-ui.js')];
const Custom=require('../js/netwizard-custom-device-model-ui.js');
const groups=Custom.parsePortGroups('Gi1/0/{n}|24|copper|1000|10,100,1000|yes');
assert.strictEqual(groups.length,1);
assert.strictEqual(groups[0].count,24);
assert.strictEqual(groups[0].poeCapable,true);

const audit=spawnSync(process.execPath,['scripts/i18n-audit-hardcoded.js','--check'],{cwd:root,encoding:'utf8'});
assert.strictEqual(audit.status,0,(audit.stdout||'')+'\n'+(audit.stderr||''));

console.log('✓ Beta i18n: Dispositivos y Puertos tienen ES/EN, cambio en caliente y guardrail estricto');
