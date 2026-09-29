'use strict';

const assert=require('assert');
const Ui=require('../js/netwizard-private-deployment-ui.js');

const views=Ui.viewsFor({
  productionGateSummaryMarkdown:'# Private Production Gate\n\nLISTO\n',
  runbookMarkdown:'# Runbook\n',
  rollbackMarkdown:'# Rollback\n',
  postChangeChecklistMarkdown:'# Checklist\n',
  changeSummaryMarkdown:'# Change\n',
  incrementalSummaryMarkdown:'# Incremental\n',
  artifacts:[
    {path:'reports/private-production-gate.md',content:'# duplicate gate\n',mime:'text/markdown;charset=utf-8'},
    {path:'configs/01-edge.cfg',content:'hostname EDGE\n',mime:'text/plain;charset=utf-8'},
    {path:'incremental/commands/r1.cfg',content:'interface Gi0/1\n',mime:'text/plain;charset=utf-8'}
  ]
});

assert.deepStrictEqual(
  views.map(x=>x.key),
  ['production-gate','runbook','rollback','post-change','change-summary','incremental-summary','artifact:1','artifact:2']
);
assert.strictEqual(views[0].fileName,'private-production-gate.md');
assert.match(views[0].content,/LISTO/);
assert.strictEqual(views[6].fileName,'configs-01-edge.cfg');
assert.match(views[6].content,/hostname EDGE/);
assert.strictEqual(views[6].mime,'text/plain;charset=utf-8');

const configResult={
  configPaths:{r1:'configs/01-edge.cfg'},
  artifacts:[{path:'configs/01-edge.cfg',content:'hostname EDGE\n',mime:'text/plain;charset=utf-8'}]
};
const config=Ui.configArtifactForDevice(configResult,'r1');
assert.ok(config);
assert.strictEqual(config.path,'configs/01-edge.cfg');
assert.match(config.content,/hostname EDGE/);

const blockedAfterGeneration={
  configPaths:{r1:'configs/01-edge.cfg'},
  deploymentPlan:null,
  artifacts:[{path:'configs/01-edge.cfg',content:'hostname EDGE\n'}]
};
assert.match(Ui.configArtifactForDevice(blockedAfterGeneration,'r1').content,/hostname EDGE/);

const sparse=Ui.viewsFor({artifacts:[{path:'rollback/r1.txt',content:'undo\n'}]});
assert.deepStrictEqual(sparse.map(x=>x.key),['artifact:0']);
assert.strictEqual(sparse[0].fileName,'rollback-r1.txt');

console.log('✓ UI cloud de deployment presenta runbook, rollback y artefactos privados como salidas derivadas');
