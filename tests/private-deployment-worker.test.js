'use strict';

const assert=require('assert');
const ChangeSet=require('../js/netwizard-change-set.js');
const Incremental=require('../js/netwizard-incremental-generators.js');
const Runbook=require('../js/netwizard-deployment-runbook.js');
const Worker=require('../private/deployment-worker.js');

const generatedAt='2026-09-28T11:00:00.000Z';
const observed='set system host-name OLD\nset interfaces ge-0/0/0 unit 0 family inet address 192.0.2.2/30\n';
const desired='set system host-name NEW\nset interfaces ge-0/0/0 unit 0 family inet address 192.0.2.2/30\nset routing-options static route 0.0.0.0/0 next-hop 192.0.2.1\n';
const project={
  _schemaVersion:'3.50.0',
  projName:'Private deployment parity',
  devices:[{id:'r1',name:'EDGE-1',type:'router',kind:'router',vendorOs:'juniper_junos',internetEdge:'yes'}],
  ports:[],links:[],haGroups:[],mlagDomains:[],wifiAccessPoints:[],wifiControllers:[],
  internalServices:[],failureScenarios:[],
  deployment:{changeMode:'incremental',requireExecutableIncremental:true,observationMinutes:15},
  observedState:{deviceConfigs:{r1:{vendor:'juniper_junos',capturedAt:'2026-09-28T10:00:00.000Z',content:observed}}}
};
const desiredConfigs={r1:desired};
const configPaths={r1:'configs/01-EDGE-1-r1-juniper_junos.set'};

const changeSet=ChangeSet.buildChangeSet(project,{generatedAt,desiredConfigs,configPaths});
const incrementalPlan=Incremental.buildPlan(project,{generatedAt,changeSet,desiredConfigs,configPaths});
const deploymentPlan=Runbook.buildDeploymentPlan(project,{generatedAt,changeSet,incrementalPlan,configPaths});

const actual=Worker.handle({project,desiredConfigs,configPaths,generatedAt});

assert.strictEqual(actual.contractVersion,'netwizard-private-deployment-plan-v1');
assert.strictEqual(actual.ok,true);
assert.deepStrictEqual(actual.changeSet,ChangeSet.publicChangeSet(changeSet));
assert.deepStrictEqual(actual.incrementalPlan,Incremental.publicPlan(incrementalPlan));
assert.deepStrictEqual(actual.deploymentPlan,deploymentPlan);
assert.strictEqual(actual.runbookMarkdown,Runbook.buildMarkdown(deploymentPlan));
assert.strictEqual(actual.rollbackMarkdown,Runbook.buildRollbackMarkdown(deploymentPlan));
assert.strictEqual(actual.changeSummaryMarkdown,ChangeSet.buildSummaryMarkdown(changeSet));
assert.strictEqual(actual.incrementalSummaryMarkdown,Incremental.buildSummaryMarkdown(incrementalPlan));
assert.strictEqual(actual.postChangeChecklistMarkdown,ChangeSet.buildPostChangeChecklist(changeSet,deploymentPlan));
assert.deepStrictEqual(
  actual.artifacts.map(x=>x.path),
  changeSet.artifacts.concat(incrementalPlan.artifacts).map(x=>x.path)
);
assert.ok(actual.artifacts.some(x=>x.path.startsWith('incremental/commands/')&&/set system host-name NEW/.test(x.content)));

assert.throws(
  ()=>Worker.handle({project,desiredConfigs:{missing:'set x'},configPaths:{},generatedAt}),
  /unknown device/
);

const blockedProject=JSON.parse(JSON.stringify(project));
delete blockedProject.observedState;
const blocked=Worker.handle({project:blockedProject,desiredConfigs,configPaths,generatedAt});
assert.strictEqual(blocked.ok,false);
assert.ok(blocked.changeSet);
assert.strictEqual(blocked.incrementalPlan,null);
assert.strictEqual(blocked.deploymentPlan,null);
assert.strictEqual(blocked.runbookMarkdown,'');

console.log('✓ Private deployment worker mantiene paridad y corta la cadena ante bloqueos');
