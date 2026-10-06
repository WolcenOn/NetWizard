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

for(const mod of [
  '../js/netwizard-deployment-runbook.js',
  '../js/netwizard-change-set.js',
  '../js/netwizard-incremental-generators.js',
  '../js/netwizard-deployment-bundle.js'
]) delete require.cache[require.resolve(mod)];

const Runbook=require('../js/netwizard-deployment-runbook.js');
const ChangeSet=require('../js/netwizard-change-set.js');
const Incremental=require('../js/netwizard-incremental-generators.js');
const Bundle=require('../js/netwizard-deployment-bundle.js');

const es=JSON.parse(fs.readFileSync(path.join(root,'i18n','es.json'),'utf8'));
const en=JSON.parse(fs.readFileSync(path.join(root,'i18n','en.json'),'utf8'));
assert.deepStrictEqual(Object.keys(es).sort(),Object.keys(en).sort(),'ES y EN deben mantener paridad exacta');

const deployKeys=Object.keys(es).filter(key=>key.startsWith('deploy.'));
assert.ok(deployKeys.length>=400,'Deployment debe tener cobertura i18n amplia');
for(const key of [
  'deploy.page.title','deploy.readiness.applyReady','deploy.private.remoteHint',
  'deploy.bundle.readme.title','deploy.changeSet.title','deploy.incremental.title',
  'deploy.runbook.md.title','deploy.runbook.phase.access',
  'deploy.runbook.vendor.cisco_ios.backup.0'
]){
  assert.ok(es[key],key+' falta en ES');
  assert.ok(en[key],key+' falta en EN');
  assert.ok(global.NetWizardI18n.dictionaries.es[key],key+' falta en bundle ES');
  assert.ok(global.NetWizardI18n.dictionaries.en[key],key+' falta en bundle EN');
}

const generatedAt='2026-10-06T10:00:00.000Z';
const project={
  projName:'Deploy i18n',
  devices:[{id:'sw1',name:'SW-01',kind:'switch',type:'switch',vendorOs:'cisco_ios'}],
  ports:[],links:[],haGroups:[],mlagDomains:[],wifiAccessPoints:[],wifiControllers:[],
  failureScenarios:[],internalServices:[],
  deployment:{
    strategy:'staged',changeTicket:'CHG-1',maintenanceWindow:'10:00-11:00',
    approvalOwner:'NetOps',observationMinutes:15,changeMode:'full'
  },
  observedState:{
    observedAt:generatedAt,
    deviceConfigs:{sw1:{content:'hostname SW-01',capturedAt:generatedAt,vendor:'cisco_ios'}}
  }
};
const desiredConfigs={sw1:'hostname SW-01'};
const configPaths={sw1:'configs/01-sw1.cfg'};

const enChange=ChangeSet.buildChangeSet(project,{generatedAt,desiredConfigs,configPaths,locale:'en'});
const esChange=ChangeSet.buildChangeSet(project,{generatedAt,desiredConfigs,configPaths,locale:'es'});
assert.match(ChangeSet.buildSummaryMarkdown(enChange,{locale:'en'}),/# Change set — Deploy i18n/);
assert.match(ChangeSet.buildSummaryMarkdown(enChange,{locale:'en'}),/Observed snapshot:/);
assert.match(ChangeSet.buildSummaryMarkdown(esChange,{locale:'es'}),/Snapshot observado:/);

const enIncremental=Incremental.buildPlan(project,{generatedAt,changeSet:enChange,desiredConfigs,configPaths,locale:'en'});
const esIncremental=Incremental.buildPlan(project,{generatedAt,changeSet:esChange,desiredConfigs,configPaths,locale:'es'});
assert.match(Incremental.buildSummaryMarkdown(enIncremental,{locale:'en'}),/# Incremental plan — Deploy i18n/);
assert.match(Incremental.buildSummaryMarkdown(esIncremental,{locale:'es'}),/# Plan incremental — Deploy i18n/);

const enPlan=Runbook.buildDeploymentPlan(project,{generatedAt,configPaths,changeSet:enChange,incrementalPlan:enIncremental,locale:'en'});
const esPlan=Runbook.buildDeploymentPlan(project,{generatedAt,configPaths,changeSet:esChange,incrementalPlan:esIncremental,locale:'es'});
assert.strictEqual(enPlan.phases[0].label,'Access switching');
assert.strictEqual(esPlan.phases[0].label,'Switching de acceso');
assert.match(enPlan.prechecks[0],/Approval, change window/);
assert.match(esPlan.prechecks[0],/Aprobación, ventana/);
assert.match(Runbook.buildMarkdown(enPlan,{locale:'en'}),/# Deployment runbook — Deploy i18n/);
assert.match(Runbook.buildMarkdown(esPlan,{locale:'es'}),/# Runbook de despliegue — Deploy i18n/);
assert.match(Runbook.buildRollbackMarkdown(enPlan,{locale:'en'}),/# Rollback checklist — Deploy i18n/);
assert.match(Runbook.buildRollbackMarkdown(esPlan,{locale:'es'}),/# Checklist de rollback — Deploy i18n/);

const privateResult={
  contractVersion:'netwizard-private-deployment-plan-v2',
  privateConfigContract:'netwizard-private-config-v1',
  generatedAt,
  ok:true,
  productionReady:true,
  productionStatus:'ready',
  productionGateContract:'netwizard-private-production-gate-v1',
  productionGate:{canExport:true,status:'ready',issues:[]},
  artifacts:[],issues:[],configPaths:{},configReadiness:{},configCapabilities:{}
};
const schema={
  schemaVersion:'3.50.0',
  prepareExport(source){return{schemaVersion:'3.50.0',project:JSON.parse(JSON.stringify(source))};}
};
const enPkg=Bundle.buildPrivateDeploymentPackage(project,privateResult,{schema,locale:'en'});
const esPkg=Bundle.buildPrivateDeploymentPackage(project,privateResult,{schema,locale:'es'});
assert.strictEqual(enPkg.ok,true);
assert.strictEqual(esPkg.ok,true);
const enReadme=enPkg.files.find(file=>file.path==='README.md').content;
const esReadme=esPkg.files.find(file=>file.path==='README.md').content;
assert.match(enReadme,/# Private deployment package — Deploy i18n/);
assert.match(enReadme,/## Authority/);
assert.match(esReadme,/# Paquete privado de despliegue — Deploy i18n/);
assert.match(esReadme,/## Autoridad/);

const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
for(const key of ['deploy.page.title','deploy.config.title','deploy.actions.generateServer','deploy.export.title','deploy.import.action']){
  assert.ok(html.includes('data-i18n="'+key+'"'),'Falta contrato HTML '+key);
}

const privateUi=fs.readFileSync(path.join(root,'js','netwizard-private-deployment-ui.js'),'utf8');
assert.ok(privateUi.includes("root.addEventListener&&root.addEventListener('netwizard:i18n'"));
assert.ok(privateUi.includes("const token=root.document.getElementById('nwSelfHostedPrivateToken')?.value||''"));

const auditRun=spawnSync(process.execPath,['scripts/i18n-audit-hardcoded.js','--check'],{cwd:root,encoding:'utf8'});
assert.strictEqual(auditRun.status,0,(auditRun.stdout||'')+'\n'+(auditRun.stderr||''));

console.log('✓ Beta i18n: Deployment/Export tiene ES/EN, artefactos por locale y guardrail estricto');
