'use strict';

const assert=require('assert');
const Ui=require('../js/netwizard-private-deployment-ui.js');

const views=Ui.viewsFor({
  runbookMarkdown:'# Runbook\n',
  rollbackMarkdown:'# Rollback\n',
  postChangeChecklistMarkdown:'# Checklist\n',
  changeSummaryMarkdown:'# Change\n',
  incrementalSummaryMarkdown:'# Incremental\n',
  artifacts:[
    {path:'configs/01-edge.cfg',content:'hostname EDGE\n',mime:'text/plain;charset=utf-8'},
    {path:'incremental/commands/r1.cfg',content:'interface Gi0/1\n',mime:'text/plain;charset=utf-8'}
  ]
});

assert.deepStrictEqual(
  views.map(x=>x.key),
  ['runbook','rollback','post-change','change-summary','incremental-summary','artifact:0','artifact:1']
);
assert.strictEqual(views[0].fileName,'deployment-runbook.md');
assert.strictEqual(views[5].fileName,'configs-01-edge.cfg');
assert.match(views[5].content,/hostname EDGE/);
assert.strictEqual(views[5].mime,'text/plain;charset=utf-8');

const sparse=Ui.viewsFor({artifacts:[{path:'rollback/r1.txt',content:'undo\n'}]});
assert.deepStrictEqual(sparse.map(x=>x.key),['artifact:0']);
assert.strictEqual(sparse[0].fileName,'rollback-r1.txt');

console.log('✓ UI cloud de deployment presenta runbook, rollback y artefactos privados como salidas derivadas');
