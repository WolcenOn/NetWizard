'use strict';

const assert=require('assert');

const store=new Map();
global.localStorage={
  getItem:key=>store.has(key)?store.get(key):null,
  setItem:(key,value)=>store.set(key,String(value)),
  removeItem:key=>store.delete(key)
};
global.NetWizardPhysicalInterventionPlan={
  buildChecklist(project){
    return{
      ok:true,
      actions:[
        {type:'move-device',category:'device',title:'Mover SW-01',details:'RACK-01 U18 → U20',deviceId:'sw1'},
        {type:'reconnect-power',category:'power',title:'Reconectar SW-01',details:'PDU-A toma 5',powerConnectionId:'pw1'}
      ]
    };
  }
};

const Field=require('../js/netwizard-field-execution-ui.js');
const project={
  projName:'Sede campo',
  workflow:{
    mode:'design',
    derivedFrom:{type:'inventory',snapshotId:'snap-source',sourceProjectName:'Sede campo'},
    interventionBaseline:{version:'netwizard-physical-intervention-baseline-v1',capturedAt:'2026-09-27T10:00:00Z'}
  }
};

assert.strictEqual(Field.isApplicable(project),true);
const original=JSON.parse(JSON.stringify(project));

let execution=Field.build(project);
assert.strictEqual(execution.ok,true);
assert.strictEqual(execution.counts.total,2);
assert.strictEqual(execution.counts.done,0);
assert.strictEqual(execution.counts.pending,2);
assert.strictEqual(execution.counts.percent,0);
assert.deepStrictEqual(project,original,'La UX de campo no debe mutar el proyecto');

const first=execution.items[0];
execution=Field.updateItem(project,first.executionKey,{done:true,note:'Equipo movido y fijado'});
assert.strictEqual(execution.counts.done,1);
assert.strictEqual(execution.counts.pending,1);
assert.strictEqual(execution.counts.percent,50);
assert.strictEqual(execution.items[0].note,'Equipo movido y fijado');
assert.deepStrictEqual(project,original,'Marcar progreso no debe mutar el To-Be');

const second=execution.items[1];
execution=Field.updateItem(project,second.executionKey,{done:true});
assert.strictEqual(execution.counts.done,2);
assert.strictEqual(execution.counts.pending,0);
assert.strictEqual(execution.counts.percent,100);

const key=Field.projectKey(project);
assert.ok(key.includes('snap-source'));
assert.ok(key.includes('2026-09-27T10:00:00Z'));
assert.ok(store.size>=1);

Field.clearProgress(project);
execution=Field.build(project);
assert.strictEqual(execution.counts.done,0);
assert.strictEqual(execution.counts.pending,2);

const unrelated={
  projName:'Inventario',
  workflow:{mode:'inventory'}
};
assert.strictEqual(Field.isApplicable(unrelated),false);

console.log('✓ Field Execution UX conserva progreso local sin mutar el To-Be');
