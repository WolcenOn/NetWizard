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
delete require.cache[require.resolve('../js/netwizard-policy-utils.js')];
const Policy=require('../js/netwizard-policy-utils.js');

const es=JSON.parse(fs.readFileSync(path.join(root,'i18n','es.json'),'utf8'));
const en=JSON.parse(fs.readFileSync(path.join(root,'i18n','en.json'),'utf8'));
assert.deepStrictEqual(Object.keys(es).sort(),Object.keys(en).sort(),'ES y EN deben mantener paridad exacta');

for(const key of [
  'firewall.page.title','firewall.form.title','firewall.matrix.title',
  'firewall.hardening.title','firewall.policy.title',
  'firewall.policy.issue.isolationMissing','firewall.policy.diff.title'
]){
  assert.ok(es[key],key+' falta en ES');
  assert.ok(en[key],key+' falta en EN');
  assert.ok(global.NetWizardI18n.dictionaries.es[key],key+' falta en bundle ES');
  assert.ok(global.NetWizardI18n.dictionaries.en[key],key+' falta en bundle EN');
}

const diff={add:[{prio:10,action:'allow',src:'a',dst:'b',proto:'tcp',port:'443',name:'rule'}],update:[],unchanged:[],remove:[],finalRuleCount:1,manualCount:0,proposed:[{}]};
assert.match(Policy.summarizePolicyApplyDiff(diff,'en'),/Firewall\/ACL rule change preview/);
assert.match(Policy.summarizePolicyApplyDiff(diff,'es'),/Vista previa de cambios/);

const project={
  vlans:[{id:'v10',vlanId:10,name:'Guests',intent:{type:'guests',internet:false,isolation:'isolated'}}],
  subnets:[],
  fwRules:[]
};
const audit=Policy.validatePolicyForProject(project);
assert.ok(audit.issues.length>0,'Debe generar incidencias de política');
assert.ok(audit.issues.every(i=>i.messageKey&&i.messageParams),'Las incidencias migradas deben conservar messageKey/messageParams');

const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
for(const key of [
  'firewall.page.title','firewall.form.title','firewall.matrix.title',
  'firewall.hardening.title','firewall.templates.title'
]){
  assert.ok(html.includes('data-i18n="'+key+'"'),'Falta contrato HTML '+key);
}

const source=fs.readFileSync(path.join(root,'js','netwizard-policy-utils.js'),'utf8');
assert.ok(source.includes("messageKey:'firewall.policy.issue.isolationMissing'"));
assert.ok(source.includes("root.addEventListener&&root.addEventListener('netwizard:i18n'"));

const auditRun=spawnSync(process.execPath,['scripts/i18n-audit-hardcoded.js','--check'],{cwd:root,encoding:'utf8'});
assert.strictEqual(auditRun.status,0,(auditRun.stdout||'')+'\n'+(auditRun.stderr||''));

console.log('✓ Beta i18n: Firewall tiene ES/EN, mensajes derivados y guardrail estricto');
