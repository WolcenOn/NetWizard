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
delete require.cache[require.resolve('../js/netwizard-audit.js')];
const Audit=require('../js/netwizard-audit.js');
delete require.cache[require.resolve('../js/netwizard-resilience-topology.js')];
const Resilience=require('../js/netwizard-resilience-topology.js');
delete require.cache[require.resolve('../js/netwizard-traffic-capacity.js')];
const Capacity=require('../js/netwizard-traffic-capacity.js');
delete require.cache[require.resolve('../js/netwizard-observed-drift.js')];
const Drift=require('../js/netwizard-observed-drift.js');
delete require.cache[require.resolve('../js/netwizard-inter-site-reachability.js')];
const Reach=require('../js/netwizard-inter-site-reachability.js');

const es=JSON.parse(fs.readFileSync(path.join(root,'i18n','es.json'),'utf8'));
const en=JSON.parse(fs.readFileSync(path.join(root,'i18n','en.json'),'utf8'));
assert.deepStrictEqual(Object.keys(es).sort(),Object.keys(en).sort(),'ES y EN deben mantener paridad exacta');

for(const key of [
  'validation.page.title','validation.observed.title','validation.reach.title',
  'validation.resilience.title','validation.capacity.title','validation.wan.title',
  'validation.drift.title','validation.audit.errors'
]){
  assert.ok(es[key],key+' falta en ES');
  assert.ok(en[key],key+' falta en EN');
  assert.ok(global.NetWizardI18n.dictionaries.es[key],key+' falta en bundle ES');
  assert.ok(global.NetWizardI18n.dictionaries.en[key],key+' falta en bundle EN');
}

const localizedIssue={
  code:'NW-CAPACITY-001',severity:'error',blocking:true,message:'legacy',
  messageKey:'validation.issue.capacity.NW-CAPACITY-001',messageParams:{label:'WAN-A'}
};
assert.match(Audit.summarizeIssues([localizedIssue],{locale:'en'}),/WAN-A: invalid peak traffic/);
assert.match(Audit.summarizeIssues([localizedIssue],{locale:'es'}),/WAN-A: pico de tráfico inválido/);

const res=Resilience.validateProject({devices:[],ports:[],stacks:[{id:'stack-a',members:[]}],mlagDomains:[],haGroups:[],diversityPolicies:[]});
assert.ok(res.issues.length);
assert.ok(res.issues.every(i=>i.messageKey&&i.messageParams),'Resilience issues deben incluir metadata i18n');

const cap=Capacity.validateProject({trafficProfiles:[{id:'p1',name:'WAN profile',peakMbps:-1}],wanCircuits:[],links:[]});
assert.ok(cap.issues.some(i=>i.messageKey==='validation.issue.capacity.NW-CAPACITY-001'));

const drift=Drift.validateProject({devices:[{id:'r1'}],observedState:{observedAt:'2026-10-05T00:00:00Z',devices:[]}});
assert.ok(drift.issues.some(i=>i.messageKey==='validation.issue.drift.NW-DRIFT-001'));

const reach=Reach.traceDirection(
  {routing:{strategy:'none'},devices:[],ports:[],links:[],vlans:[]},
  {id:'s1',cidr:'10.0.0.0/24',gatewayDeviceRef:'r1'},
  {id:'s2',cidr:'10.0.1.0/24',gatewayDeviceRef:'r2'}
);
assert.strictEqual(reach.reasonKey,'validation.reach.reason.strategy');
assert.deepStrictEqual(reach.reasonParams,{});

const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
for(const key of [
  'validation.page.title','validation.page.subtitle','validation.observed.title',
  'validation.observed.saveAnalyze','validation.observed.downloadRollback'
]){
  assert.ok(html.includes('data-i18n="'+key+'"'),'Falta contrato HTML '+key);
}

const auditRun=spawnSync(process.execPath,['scripts/i18n-audit-hardcoded.js','--check'],{cwd:root,encoding:'utf8'});
assert.strictEqual(auditRun.status,0,(auditRun.stdout||'')+'\n'+(auditRun.stderr||''));

console.log('✓ Beta i18n: Validation/analysis tiene ES/EN, metadata derivada y guardrail estricto');
