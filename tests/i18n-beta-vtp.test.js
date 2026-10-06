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
global.NetWizardI18n=require('../js/netwizard-i18n.js');
delete require.cache[require.resolve('../js/netwizard-vtp-production-verification.js')];
const VTP=require('../js/netwizard-vtp-production-verification.js');

const es=JSON.parse(fs.readFileSync(path.join(root,'i18n','es.json'),'utf8'));
const en=JSON.parse(fs.readFileSync(path.join(root,'i18n','en.json'),'utf8'));
assert.deepStrictEqual(Object.keys(es).sort(),Object.keys(en).sort(),'ES y EN deben mantener paridad exacta');

for(const key of [
  'vtp.title','vtp.fields.domain','vtp.role.off','vtp.feedback.saved',
  'vtp.explain.domain','vtp.verify.title','vtp.verify.reason.domainMismatch'
]){
  assert.ok(es[key],key+' falta en ES');
  assert.ok(en[key],key+' falta en EN');
  assert.ok(global.NetWizardI18n.dictionaries.es[key],key+' falta en bundle ES');
  assert.ok(global.NetWizardI18n.dictionaries.en[key],key+' falta en bundle EN');
}

const project={
  devices:[{id:'sw1',name:'SW-01',kind:'switch',type:'switch',vendorOs:'cisco_ios'}],
  vtp:{domain:'CORP',version:'3',pruning:'yes',roles:{sw1:'server'}},
  observedState:{vtpDevices:{sw1:{
    domain:'OTHER',version:'2',mode:'client',revision:null,primary:false,primaryId:'',
    primaryConflict:false,digestErrors:null,revisionErrors:null
  }}}
};
const result=VTP.evaluateDevice(project,'sw1');
assert.strictEqual(result.ok,false);
assert.ok(Array.isArray(result.reasons)&&result.reasons.length>0,'Debe preservar reasons legacy');
assert.ok(Array.isArray(result.reasonDetails)&&result.reasonDetails.length===result.reasons.length,'Debe añadir reasonDetails paralelos');
assert.ok(result.reasonDetails.every(r=>r.messageKey&&r.messageParams),'Cada reasonDetail debe ser traducible');

global.NetWizardI18n.setLocale('en');
assert.strictEqual(global.NetWizardI18n.t('vtp.verify.reason.domainMismatch',{actual:'OTHER',desired:'CORP'}),'Observed VTP domain "OTHER" does not match desired "CORP".');
global.NetWizardI18n.setLocale('es');
assert.strictEqual(global.NetWizardI18n.t('vtp.verify.reason.domainMismatch',{actual:'OTHER',desired:'CORP'}),'Dominio VTP observado "OTHER" no coincide con el deseado "CORP".');

const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
for(const key of ['vtp.title','vtp.fields.domain','vtp.fields.password','vtp.actions.save','vtp.order.text']){
  assert.ok(html.includes('data-i18n="'+key+'"'),'Falta contrato HTML '+key);
}

const source=fs.readFileSync(path.join(root,'js','netwizard-vtp-production-verification.js'),'utf8');
assert.ok(source.includes('reasonDetails'));
assert.ok(source.includes("root.addEventListener&&root.addEventListener('netwizard:i18n'"));

const auditRun=spawnSync(process.execPath,['scripts/i18n-audit-hardcoded.js','--check'],{cwd:root,encoding:'utf8'});
assert.strictEqual(auditRun.status,0,(auditRun.stdout||'')+'\n'+(auditRun.stderr||''));

console.log('✓ Beta i18n: VTP tiene ES/EN, verificación traducible y guardrail estricto');
