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
delete require.cache[require.resolve('../js/netwizard-rack-model.js')];
const Rack=require('../js/netwizard-rack-model.js');

const es=JSON.parse(fs.readFileSync(path.join(root,'i18n','es.json'),'utf8'));
const en=JSON.parse(fs.readFileSync(path.join(root,'i18n','en.json'),'utf8'));
const prefixes=['rack.','physical.'];
const migratedKeys=Object.keys(es).filter(k=>prefixes.some(p=>k.startsWith(p)));
assert.ok(migratedKeys.length>120,'El bloque Rack/Physical debe tener cobertura i18n sustancial');
for(const key of migratedKeys){
  assert.ok(Object.prototype.hasOwnProperty.call(en,key),'Falta clave EN: '+key);
  assert.strictEqual(typeof es[key],'string',key+' ES debe ser string');
  assert.strictEqual(typeof en[key],'string',key+' EN debe ser string');
}
assert.strictEqual(I18N.dictionaries.en['rack.page.title'],'🗄 Racks, power and passive material');
assert.strictEqual(I18N.dictionaries.en['physical.deviceInventory.title'],'Device inventory');

I18N.setLocale('en');
assert.strictEqual(Rack.validateRackResize({racks:[]},'missing',12).message,'Rack not found.');
const noSwitches={
  designRequirements:{rackPolicy:{layoutPattern:'patch-manager-switch',organizerPerSwitch:true,patchPanelPorts:24}},
  racks:[{id:'r1',name:'Rack A',rackUnits:12}],
  devices:[],ports:[],patchPanels:[],patchConnections:[],rackItems:[],pdus:[],powerConnections:[],links:[]
};
assert.strictEqual(Rack.planRackAutoLayout(noSwitches,'r1').message,'There are no switches mounted in this rack.');

I18N.setLocale('es');
assert.strictEqual(Rack.validateRackResize({racks:[]},'missing',12).message,'Rack inexistente.');
assert.strictEqual(Rack.planRackAutoLayout(noSwitches,'r1').message,'No hay switches montados en este rack.');

const physicalSource=fs.readFileSync(path.join(root,'js','netwizard-physical-inventory-ui.js'),'utf8');
assert.match(physicalSource,/dataset\.i18n=key/,'Los campos inyectados deben participar en applyI18n');

const audit=spawnSync(process.execPath,['scripts/i18n-audit-hardcoded.js','--check'],{
  cwd:root,encoding:'utf8'
});
assert.strictEqual(audit.status,0,(audit.stdout||'')+'\n'+(audit.stderr||''));

console.log('✓ Beta i18n: Rack e Inventario físico cambian ES/EN y quedan protegidos contra hardcoded');
