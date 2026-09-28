'use strict';

const assert=require('assert');
const ChangeSet=require('../js/netwizard-change-set.js');
const Incremental=require('../js/netwizard-incremental-generators.js');
const Runbook=require('../js/netwizard-deployment-runbook.js');
const Vendor=require('../private/vendor-config-engine.js');
const Worker=require('../private/deployment-worker.js');

const generatedAt='2026-09-28T11:00:00.000Z';
const project={
  _schemaVersion:'3.50.0',
  projName:'Private deployment parity',
  devices:[{id:'r1',name:'EDGE-1',type:'router',kind:'router',vendorOs:'juniper_junos',internetEdge:'yes'}],
  ports:[{id:'p1',deviceId:'r1',name:'ge-0/0/0',mode:'trunk',role:'lan',allowedVlans:[10]}],
  vlans:[{id:'v10',vlanId:10,name:'Users'}],
  subnets:[{id:'s10',vlanRef:'v10',cidr:'10.10.10.0/24',gateway:'10.10.10.1'}],
  hosts:[],links:[],haGroups:[],mlagDomains:[],wifiAccessPoints:[],wifiControllers:[],
  internalServices:[],failureScenarios:[],fwRules:[],dhcp:{},
  routing:{strategy:'static'},management:{},highAvailability:{},accessSecurity:{},linkAggregations:[],
  deployment:{changeMode:'full',requireExecutableIncremental:false,observationMinutes:15}
};

const generated=Vendor.generateAll(project,{r1:'CLIENT OVERRIDE MUST BE IGNORED'});
assert.strictEqual(generated.ok,true);
const desiredConfigs=generated.configs;
const configPaths=generated.configPaths;
const changeSet=ChangeSet.buildChangeSet(project,{generatedAt,desiredConfigs,configPaths});
const incrementalPlan=Incremental.buildPlan(project,{generatedAt,changeSet,desiredConfigs,configPaths});
const deploymentPlan=Runbook.buildDeploymentPlan(project,{generatedAt,changeSet,incrementalPlan,configPaths});

const actual=Worker.handle({project,desiredConfigs:{r1:'CLIENT OVERRIDE MUST BE IGNORED'},generatedAt});

assert.strictEqual(actual.contractVersion,'netwizard-private-deployment-plan-v1');
assert.strictEqual(actual.privateConfigContract,'netwizard-private-vendor-config-v1');
assert.strictEqual(actual.configSources.r1,'private');
assert.strictEqual(actual.ok,true);
assert.deepStrictEqual(actual.changeSet,ChangeSet.publicChangeSet(changeSet));
assert.deepStrictEqual(actual.incrementalPlan,Incremental.publicPlan(incrementalPlan));
assert.deepStrictEqual(actual.deploymentPlan,deploymentPlan);
assert.strictEqual(actual.runbookMarkdown,Runbook.buildMarkdown(deploymentPlan));
assert.strictEqual(actual.rollbackMarkdown,Runbook.buildRollbackMarkdown(deploymentPlan));
assert.strictEqual(actual.changeSummaryMarkdown,ChangeSet.buildSummaryMarkdown(changeSet));
assert.strictEqual(actual.incrementalSummaryMarkdown,Incremental.buildSummaryMarkdown(incrementalPlan));
assert.strictEqual(actual.postChangeChecklistMarkdown,ChangeSet.buildPostChangeChecklist(changeSet,deploymentPlan));
const configArtifact=actual.artifacts.find(x=>x.path===configPaths.r1);
assert.ok(configArtifact);
assert.doesNotMatch(configArtifact.content,/CLIENT OVERRIDE MUST BE IGNORED/);
assert.match(configArtifact.content,/Juniper Junos/);

assert.throws(
  ()=>Worker.handle({project,desiredConfigs:{missing:'set x'},generatedAt}),
  /unknown device/
);

const unsupported=JSON.parse(JSON.stringify(project));
unsupported.devices[0].vendorOs='windows';
const blocked=Worker.handle({project:unsupported,generatedAt});
assert.strictEqual(blocked.ok,false);
assert.strictEqual(blocked.changeSet,null);
assert.strictEqual(blocked.incrementalPlan,null);
assert.strictEqual(blocked.deploymentPlan,null);
assert.ok(blocked.issues.some(x=>x.code==='NW-PRIVATE-CONFIG-003'&&x.blocking));

const legacy=Worker.handle({project:unsupported,desiredConfigs:{r1:'Write-Host "legacy"\n'},generatedAt});
assert.strictEqual(legacy.configSources.r1,'legacy-client-fallback');
assert.ok(legacy.changeSet);

console.log('✓ Private deployment deriva configs en servidor y limita fallback a vendors legacy');
