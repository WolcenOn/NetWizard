'use strict';

const assert=require('assert');

const store=new Map();
global.localStorage={
  getItem:key=>store.has(key)?store.get(key):null,
  setItem:(key,value)=>store.set(key,String(value)),
  removeItem:key=>store.delete(key)
};
global.NetWizardPhysicalInterventionPlan={
  buildChecklist(){
    return{
      ok:true,
      actions:[
        {id:'device:move:sw1',type:'move-device',category:'device',title:'Mover SW-01',details:'RACK-01 U18 → U20',deviceId:'sw1'},
        {id:'power:change:pw1',type:'reconnect-power',category:'power',title:'Reconectar SW-01',details:'PDU-A toma 5',powerConnectionId:'pw1'}
      ]
    };
  }
};
global.NetWizardObservedDrift={validateProject(){return{ok:true,issues:[],drift:[],counts:{blocking:0,warnings:0}};}};
global.NetWizardInterventionExecution=require('../js/netwizard-intervention-execution.js');

const Field=require('../js/netwizard-field-execution-ui.js');
const project={
  projName:'Sede campo',
  workflow:{
    mode:'design',
    derivedFrom:{type:'inventory',snapshotId:'snap-source',sourceProjectName:'Sede campo'},
    interventionBaseline:{version:'netwizard-physical-intervention-baseline-v1',capturedAt:'2026-09-27T10:00:00Z'}
  },
  observedState:{observedAt:'2026-09-27T12:00:00Z'}
};

assert.strictEqual(Field.isApplicable(project),true);
let execution=Field.build(project);
assert.strictEqual(execution.ok,true);
assert.strictEqual(execution.counts.total,2);
assert.strictEqual(execution.counts.done,0);
assert.strictEqual(execution.counts.pending,2);

let next=global.NetWizardInterventionExecution.patchRecord(project,{technician:'Ana',startedAt:'2026-09-27T10:30:00Z'});
for(const item of global.NetWizardInterventionExecution.build(next).items){
  next=global.NetWizardInterventionExecution.setAction(next,item.actionId,{
    status:'done',completedAt:'2026-09-27T11:00:00Z',completedBy:'Ana',note:'OK',evidenceRefs:['foto-'+item.order]
  });
}
execution=Field.build(next);
assert.strictEqual(execution.counts.done,2);
assert.strictEqual(execution.counts.pending,0);
assert.strictEqual(execution.counts.percent,100);

const key=Field.projectKey(project);
assert.ok(key.includes('snap-source'));
assert.ok(key.includes('2026-09-27T10:00:00Z'));
store.set('nwp_field_execution_v1:'+key,JSON.stringify({'legacy-key':{done:true,note:'legacy'}}));
assert.strictEqual(Object.keys(Field.legacyProgress(project)).length,1);

const unrelated={projName:'Inventario',workflow:{mode:'inventory'}};
assert.strictEqual(Field.isApplicable(unrelated),false);

console.log('✓ Field Execution UX v2 usa evidencia canónica y detecta progreso legacy');
