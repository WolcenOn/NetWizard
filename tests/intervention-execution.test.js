'use strict';
const assert=require('assert');

global.NetWizardPhysicalInterventionPlan={
  buildChecklist(){
    return{
      ok:true,
      actions:[
        {id:'device:move:sw1',type:'move-device',category:'device',title:'Mover SW-01'},
        {id:'patch:change:pc1',type:'repatch',category:'patch',title:'Repatch SW-01'}
      ]
    };
  }
};
global.NetWizardObservedDrift=require('../js/netwizard-observed-drift.js');
const Execution=require('../js/netwizard-intervention-execution.js');

const base={
  workflow:{
    mode:'design',
    derivedFrom:{type:'inventory',snapshotId:'snap1'},
    interventionBaseline:{version:'netwizard-physical-intervention-baseline-v1',capturedAt:'2026-10-01T08:00:00Z'}
  },
  devices:[],ports:[],links:[],vlans:[],wanCircuits:[],internalServices:[],
  wifiAccessPoints:[],wifiSsids:[],vrfs:[],ipv6Networks:[],
  observedState:{observedAt:'2026-10-01T10:10:00Z'}
};

assert.strictEqual(Execution.isApplicable(base),true);
let report=Execution.acceptanceChecks(base);
assert.strictEqual(report.ready,false);
assert.ok(report.issues.some(x=>x.code==='NW-ACCEPT-004'));

let project=JSON.parse(JSON.stringify(base));
project=Execution.patchRecord(project,{technician:'Ana Instaladora',startedAt:'2026-10-01T09:00:00Z'});
for(const item of Execution.build(project).items){
  project=Execution.setAction(project,item.actionId,{
    status:'done',
    completedAt:'2026-10-01T10:00:00Z',
    completedBy:'Ana Instaladora',
    note:'Ejecutado según plan',
    evidenceRefs:['foto-'+item.order,'test-'+item.order]
  });
}
project=Execution.acceptedRecord(project,{
  connectivityVerified:true,
  labelsVerified:true,
  asBuiltReviewed:true,
  acceptedBy:'Carlos Supervisor',
  acceptedAt:'2026-10-01T10:15:00Z',
  note:'Aceptación técnica'
});
report=Execution.acceptanceChecks(project);
assert.strictEqual(report.ready,true,JSON.stringify(report.issues));
assert.strictEqual(report.execution.counts.done,2);
assert.strictEqual(report.execution.counts.pending,0);
assert.strictEqual(report.warnings.length,0);

const stale=JSON.parse(JSON.stringify(project));
stale.observedState.observedAt='2026-10-01T09:30:00Z';
report=Execution.acceptanceChecks(stale);
assert.strictEqual(report.ready,false);
assert.ok(report.issues.some(x=>x.code==='NW-ACCEPT-010'));

const blocked=Execution.setAction(project,'device:move:sw1',{status:'blocked',completedAt:'',note:'Sin ventana'});
report=Execution.acceptanceChecks(blocked);
assert.strictEqual(report.ready,false);
assert.ok(report.issues.some(x=>x.code==='NW-ACCEPT-003'));

const drifted=JSON.parse(JSON.stringify(project));
drifted.devices=[{id:'fw1',critical:true,enabled:true}];
drifted.observedState={observedAt:'2026-10-01T10:10:00Z',devices:[]};
report=Execution.acceptanceChecks(drifted);
assert.strictEqual(report.ready,false);
assert.ok(report.issues.some(x=>x.code==='NW-ACCEPT-011'));

const client=JSON.parse(JSON.stringify(project));
client.workflow.interventionExecution.acceptance.requireClientAcceptance=true;
client.workflow.interventionExecution.acceptance.clientAccepted=false;
report=Execution.acceptanceChecks(client);
assert.strictEqual(report.ready,false);
assert.ok(report.issues.some(x=>x.code==='NW-ACCEPT-007'));

console.log('✓ Intervention Execution exige evidencia, Observed, drift limpio y aceptación');
