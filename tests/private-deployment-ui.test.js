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
  ['production-gate','runbook','rollback','post-change','change-summary','incremental-summary','generation-diagnostics','artifact:1','artifact:2']
);
assert.strictEqual(views[0].fileName,'private-production-gate.md');
assert.match(views[0].content,/LISTO/);
assert.strictEqual(views[6].fileName,'private-generation-diagnostics.md');
assert.match(views[6].content,/Diagnóstico de generación privada/);
assert.strictEqual(views[7].fileName,'configs-01-edge.cfg');
assert.match(views[7].content,/hostname EDGE/);
assert.strictEqual(views[7].mime,'text/plain;charset=utf-8');

const configResult={
  configPaths:{r1:'configs/01-edge.cfg'},
  configReadiness:{r1:{status:'apply-ready',reasons:[]}},
  configCapabilities:{r1:{vendor:'cisco_ios',kind:'router',mode:'cli',supported:true,certification:'dynamic',extension:'cfg'}},
  artifacts:[{path:'configs/01-edge.cfg',content:'hostname EDGE\n',mime:'text/plain;charset=utf-8'}]
};
const config=Ui.configArtifactForDevice(configResult,'r1');
assert.ok(config);
assert.strictEqual(config.path,'configs/01-edge.cfg');
assert.match(config.content,/hostname EDGE/);
assert.strictEqual(config.readiness.status,'apply-ready');
assert.deepStrictEqual(config.readiness.reasons,[]);
assert.strictEqual(config.capability.mode,'cli');
assert.strictEqual(config.capability.kind,'router');
assert.strictEqual(config.capability.certification,'dynamic');

const okStatus=Ui.deviceStatusFromResult(configResult,'r1');
assert.strictEqual(okStatus.status,'apply-ready');
assert.ok(okStatus.artifact);
assert.strictEqual(okStatus.capability.mode,'cli');

const unsupportedResult={
  configCapabilities:{ap1:{vendor:'huawei_vrp',kind:'access_point',mode:'cli',supported:false,certification:'unsupported',reason:'El generador huawei_vrp no cubre dispositivos de tipo access_point.'}},
  configPaths:{ap1:'configs/01-ap1.cfg'},
  issues:[{code:'NW-PRIVATE-CONFIG-004',severity:'error',blocking:true,deviceId:'ap1',message:'AP1: El generador huawei_vrp no cubre dispositivos de tipo access_point.'}],
  artifacts:[]
};
const unsupportedStatus=Ui.deviceStatusFromResult(unsupportedResult,'ap1');
assert.strictEqual(unsupportedStatus.status,'unsupported');
assert.match(unsupportedStatus.reasons.join(' '),/access_point/);
assert.strictEqual(unsupportedStatus.issues[0].code,'NW-PRIVATE-CONFIG-004');

const failedResult={
  configCapabilities:{r2:{vendor:'cisco_ios',kind:'router',mode:'cli',supported:true,certification:'dynamic'}},
  configPaths:{r2:'configs/01-r2.cfg'},
  issues:[{code:'NW-PRIVATE-CONFIG-002',severity:'error',blocking:true,deviceId:'r2',message:'R2: Private Engine no produjo una configuración utilizable.'}],
  artifacts:[]
};
const failedStatus=Ui.deviceStatusFromResult(failedResult,'r2');
assert.strictEqual(failedStatus.status,'generation-error');
assert.match(failedStatus.reasons.join(' '),/NW-PRIVATE-CONFIG-002/);

const staleStatus=Ui.deviceStatusFromResult(configResult,'r1',{stale:true});
assert.strictEqual(staleStatus.status,'stale');
assert.strictEqual(staleStatus.artifact,null);

const blockedAfterGeneration={
  configPaths:{r1:'configs/01-edge.cfg'},
  configReadiness:{r1:{status:'review-required',reasons:['WAN incompleta']}},
  deploymentPlan:null,
  artifacts:[{path:'configs/01-edge.cfg',content:'hostname EDGE\n'}]
};
const blockedConfig=Ui.configArtifactForDevice(blockedAfterGeneration,'r1');
assert.match(blockedConfig.content,/hostname EDGE/);
assert.strictEqual(blockedConfig.readiness.status,'review-required');
assert.deepStrictEqual(blockedConfig.readiness.reasons,['WAN incompleta']);

const sparse=Ui.viewsFor({artifacts:[{path:'rollback/r1.txt',content:'undo\n'}]});
assert.deepStrictEqual(sparse.map(x=>x.key),['generation-diagnostics','artifact:0']);
assert.strictEqual(sparse[1].fileName,'rollback-r1.txt');

console.log('✓ UI privada distingue pendiente, error, no soportado, obsoleto y artefactos generados');
