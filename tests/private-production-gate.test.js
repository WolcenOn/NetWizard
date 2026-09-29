'use strict';

const assert=require('assert');
const fs=require('fs');
const path=require('path');

require('../js/netwizard-audit.js');
const Worker=require('../private/deployment-worker.js');
const Vendor=require('../private/vendor-config-engine.js');
const Gate=require('../private/deployment-production-gate.js');

const generatedAt='2026-09-29T06:00:00.000Z';
const payload=JSON.parse(fs.readFileSync(path.join(__dirname,'..','samples','small-office.json'),'utf8'));
const project=payload.project;

const result=Worker.handle({project,generatedAt});

assert.strictEqual(result.ok,true);
assert.strictEqual(result.productionGateContract,'netwizard-private-production-gate-v1');
assert.strictEqual(result.productionStatus,'ready');
assert.strictEqual(result.productionReady,true);
assert.strictEqual(result.productionGate.status,'ready');
assert.strictEqual(result.productionGate.ready,true);
assert.strictEqual(result.productionGate.canExport,true);
assert.strictEqual(result.productionGate.counts.blocking,0);
assert.strictEqual(result.productionGate.generatedAt,generatedAt);
assert.match(result.productionGateSummaryMarkdown,/Private Production Gate: LISTO/);
assert.ok(result.artifacts.some(file=>file.path==='reports/private-production-gate.md'&&/LISTO/.test(file.content)));

const generated=Vendor.generateAll(project);
assert.strictEqual(generated.ok,true);

const tampered={
  ok:true,
  configSources:Object.assign({},generated.sources),
  artifacts:generated.artifacts.concat([
    {path:'../escape.cfg',content:'hostname bad\n',mime:'text/plain'},
    {path:generated.configPaths[project.devices[0].id],content:'duplicate\n',mime:'text/plain'}
  ]),
  changeSet:{format:'netwizard-change-set'},
  incrementalPlan:{format:'netwizard-incremental-plan'},
  deploymentPlan:{format:'netwizard-deployment-plan'},
  runbookMarkdown:'# Runbook\n\nApply safely.\n',
  rollbackMarkdown:'# Rollback\n\nUndo safely.\n',
  postChangeChecklistMarkdown:'# Checklist\n\nValidate safely.\n'
};

const artifactIssues=Gate.validateArtifacts(project,tampered,generated);
assert.ok(artifactIssues.some(item=>item.code==='NW-PRIVATE-GATE-004'));
assert.ok(artifactIssues.some(item=>item.code==='NW-PRIVATE-GATE-005'));
assert.ok(artifactIssues.some(item=>item.code==='NW-PRIVATE-GATE-002'));

const placeholder={
  ok:true,
  configSources:Object.assign({},generated.sources),
  artifacts:generated.artifacts.map((file,index)=>index===0?Object.assign({},file,{content:'! Vendor/OS todavía no implementado en Private Engine\n'}):file),
  changeSet:{format:'netwizard-change-set'},
  incrementalPlan:{format:'netwizard-incremental-plan'},
  deploymentPlan:{format:'netwizard-deployment-plan'},
  runbookMarkdown:'# Runbook\n\nApply safely.\n',
  rollbackMarkdown:'# Rollback\n\nUndo safely.\n',
  postChangeChecklistMarkdown:'# Checklist\n\nValidate safely.\n'
};
const placeholderIssues=Gate.validateArtifacts(project,placeholder,generated);
assert.ok(placeholderIssues.some(item=>item.code==='NW-PRIVATE-GATE-003'));

const reviewProject=JSON.parse(JSON.stringify(project));
const cisco=reviewProject.devices.find(d=>d.vendorOs==='cisco_ios');
if(cisco){
  cisco.internetEdge='yes';
  reviewProject.roas=Object.assign({},reviewProject.roas||{},{gwId:null,wanCidr:'',wanNh:''});
  const reviewGenerated=Vendor.generateAll(reviewProject);
  const reviewResult={
    ok:true,
    configSources:Object.assign({},reviewGenerated.sources),
    artifacts:reviewGenerated.artifacts.slice(),
    changeSet:{format:'netwizard-change-set'},
    incrementalPlan:{format:'netwizard-incremental-plan'},
    deploymentPlan:{format:'netwizard-deployment-plan'},
    runbookMarkdown:'# Runbook\n\nApply safely.\n',
    rollbackMarkdown:'# Rollback\n\nUndo safely.\n',
    postChangeChecklistMarkdown:'# Checklist\n\nValidate safely.\n'
  };
  const reviewIssues=Gate.validateArtifacts(reviewProject,reviewResult,reviewGenerated);
  assert.ok(reviewIssues.some(item=>item.code==='NW-PRIVATE-GATE-010'&&item.deviceId===cisco.id&&item.blocking));
}

assert.strictEqual(Gate.safeArtifactPath('configs/a.cfg'),true);
assert.strictEqual(Gate.safeArtifactPath('../a.cfg'),false);
assert.strictEqual(Gate.safeArtifactPath('/etc/passwd'),false);
assert.strictEqual(Gate.safeArtifactPath('configs\\a.cfg'),false);

console.log('✓ Private Production Gate certifica fixture ready y bloquea artefactos manipulados');
