'use strict';

const assert=require('assert');
const {createClient}=require('../js/netwizard-remote-project-client.js');

function response(status,body,etag){
  return {
    ok:status>=200&&status<300,
    status,
    headers:{get(name){return String(name).toLowerCase()==='etag'?(etag||''):'';}},
    async json(){return body;}
  };
}

const remoteSnapshot={
  _schemaVersion:'3.50.0',
  projName:'Cloud project',
  devices:[{id:'r1',name:'RTR-01',type:'router',vendorOs:'cisco_ios'}],
  ports:[],vlans:[],subnets:[],hosts:[],links:[]
};
let stateSnapshot={
  _schemaVersion:'3.50.0',
  projName:'Local draft',
  devices:[{id:'sw-local',name:'SW-LOCAL',type:'switch',vendorOs:'cisco_ios'}],
  ports:[],vlans:[],subnets:[],hosts:[],links:[]
};
const replaced=[];
const recoveries=[];
const transitionApi={
  createRecoverySnapshot(label,source){recoveries.push({label,source,state:JSON.parse(JSON.stringify(stateSnapshot))});}
};
const stateApi={
  getSnapshot(){return JSON.parse(JSON.stringify(stateSnapshot));},
  replaceProject(project,options){stateSnapshot=JSON.parse(JSON.stringify(project));replaced.push({project,options});}
};
const authApi={
  state(){return{
    authenticated:true,
    capabilities:{remoteProjectWrites:true,privateRouting:true,privateDeploymentPlan:true},
    user:{csrfToken:'csrf-123'}
  };}
};
const calls=[];
let step=0;
const fetchFn=async(url,init)=>{
  calls.push({url,init:init||{}});
  step++;
  if(step===1)return response(200,{
    project:{id:'prj_test',workspaceId:'ws1',name:'Cloud project',schemaVersion:'3.50.0',currentVersion:4},
    revision:{projectId:'prj_test',version:4,schemaVersion:'3.50.0',snapshot:remoteSnapshot}
  },'"prj_test:4"');
  if(step===2){
    const body=JSON.parse(init.body);
    assert.strictEqual(body.expectedVersion,4);
    assert.strictEqual(init.headers['X-NetWizard-CSRF'],'csrf-123');
    assert.strictEqual(init.headers['If-Match'],'"prj_test:4"');
    return response(200,{
      project:{id:'prj_test',workspaceId:'ws1',name:'Cloud project',schemaVersion:'3.50.0',currentVersion:5},
      revision:{projectId:'prj_test',version:5,schemaVersion:'3.50.0',snapshot:body.snapshot}
    },'"prj_test:5"');
  }
  if(step===3){
    const body=JSON.parse(init.body);
    assert.deepStrictEqual(body,{expectedVersion:5,deviceId:'r1'});
    assert.strictEqual(init.headers['X-NetWizard-CSRF'],'csrf-123');
    return response(200,{
      contractVersion:'netwizard-private-routing-v1',
      planVersion:'netwizard-routing-plan-v1',
      generatorVersion:'private-test',
      deviceId:'r1',
      vendor:'cisco_ios',
      output:'router ospf 10\n network 10.0.0.0 0.0.0.255 area 0\n',
      warnings:[]
    });
  }
  if(step===4){
    const body=JSON.parse(init.body);
    assert.deepStrictEqual(body,{expectedVersion:5});
    assert.strictEqual(init.headers['X-NetWizard-CSRF'],'csrf-123');
    return response(200,{
      contractVersion:'netwizard-private-deployment-plan-v2',
      generatedAt:'2026-09-28T18:00:00Z',
      ok:true,
      projectName:'Cloud project',
      runbookMarkdown:'# Runbook\n',
      rollbackMarkdown:'# Rollback\n',
      changeSummaryMarkdown:'# Changes\n',
      incrementalSummaryMarkdown:'# Incremental\n',
      postChangeChecklistMarkdown:'# Checklist\n',
      artifacts:[{path:'configs/01-RTR-EDITED-r1-cisco_ios.cfg',content:'hostname RTR-EDITED\n',mime:'text/plain;charset=utf-8'}],
      issues:[],
      configSources:{r1:'private'},
      privateConfigContract:'netwizard-private-vendor-config-v1',
      productionReady:true,
      productionStatus:'ready',
      productionGateContract:'netwizard-private-production-gate-v1',
      productionGate:{status:'ready',ready:true,canExport:true,counts:{errors:0,warnings:0,info:0,blocking:0},issues:[]},
      productionGateSummaryMarkdown:'# Private Production Gate\n\nLISTO\n'
    });
  }
  throw new Error('unexpected fetch '+url);
};

(async()=>{
  const client=createClient({fetchFn,stateApi,authApi,transitionApi,location:{search:''}});
  const opened=await client.open('prj_test');
  assert.strictEqual(opened.context.currentVersion,4);
  assert.strictEqual(opened.context.etag,'"prj_test:4"');
  assert.strictEqual(recoveries.length,1);
  assert.deepStrictEqual(recoveries[0],{
    label:'project-remote-open-backup',
    source:'pre-remote-open',
    state:{
      _schemaVersion:'3.50.0',
      projName:'Local draft',
      devices:[{id:'sw-local',name:'SW-LOCAL',type:'switch',vendorOs:'cisco_ios'}],
      ports:[],vlans:[],subnets:[],hosts:[],links:[]
    }
  });
  assert.strictEqual(replaced.length,1);
  assert.strictEqual(replaced[0].options.source,'remote-project-open');

  stateSnapshot.devices[0].name='RTR-EDITED';
  const result=await client.syncAndGenerateRouting('r1');
  assert.match(result.output,/router ospf 10/);
  assert.strictEqual(client.context().currentVersion,5);
  assert.strictEqual(calls[1].url,'/api/projects/prj_test');
  assert.strictEqual(calls[2].url,'/api/projects/prj_test/private/routing');

  const deployment=await client.syncAndGenerateDeploymentPlan();
  assert.strictEqual(deployment.contractVersion,'netwizard-private-deployment-plan-v2');
  assert.strictEqual(deployment.ok,true);
  assert.strictEqual(deployment.productionReady,true);
  assert.strictEqual(deployment.productionStatus,'ready');
  assert.strictEqual(deployment.productionGateContract,'netwizard-private-production-gate-v1');
  assert.match(deployment.artifacts[0].content,/RTR-EDITED/);
  assert.strictEqual(calls[3].url,'/api/projects/prj_test/private/deployment-plan');

  const portable=stateApi.getSnapshot();
  assert.strictEqual(portable.projectId,undefined);
  assert.strictEqual(portable.currentVersion,undefined);
  assert.strictEqual(portable.devices[0].name,'RTR-EDITED');

  client.handleAuthChanged({authenticated:false});
  assert.strictEqual(client.context(),null);
  assert.strictEqual(stateApi.getSnapshot().devices[0].name,'RTR-EDITED');
  await assert.rejects(()=>client.saveCurrent(),/remote project context required/);

  let authenticated=true;
  let reopenFetches=0;
  const reopenState={snapshot:JSON.parse(JSON.stringify(remoteSnapshot))};
  const reopenClient=createClient({
    location:{search:'?projectId=prj_reopen'},
    authApi:{state(){return{authenticated,user:authenticated?{csrfToken:'csrf-reopen'}:null,capabilities:{remoteProjectWrites:true}};}},
    stateApi:{
      getSnapshot(){return JSON.parse(JSON.stringify(reopenState.snapshot));},
      replaceProject(project){reopenState.snapshot=JSON.parse(JSON.stringify(project));}
    },
    transitionApi:{createRecoverySnapshot(){}},
    fetchFn:async()=>{
      reopenFetches++;
      return response(200,{
        project:{id:'prj_reopen',workspaceId:'ws1',name:'Reopen',schemaVersion:'3.50.0',currentVersion:1},
        revision:{projectId:'prj_reopen',version:1,schemaVersion:'3.50.0',snapshot:remoteSnapshot}
      },'"prj_reopen:1"');
    }
  });
  assert.strictEqual(await reopenClient.autoOpenFromLocation(),true);
  assert.strictEqual(reopenFetches,1);
  authenticated=false;
  reopenClient.handleAuthChanged({authenticated:false});
  assert.strictEqual(reopenClient.context(),null);
  authenticated=true;
  assert.strictEqual(await reopenClient.autoOpenFromLocation(),true);
  assert.strictEqual(reopenFetches,2);

  assert.strictEqual(reopenClient.handleProjectChanged({source:'device-edit'}),false);
  assert.strictEqual(reopenClient.context().projectId,'prj_reopen');
  assert.strictEqual(reopenClient.handleProjectChanged({source:'remote-project-open'}),false);
  assert.strictEqual(reopenClient.context().projectId,'prj_reopen');
  assert.strictEqual(reopenClient.handleProjectChanged({source:'reset'}),true);
  assert.strictEqual(reopenClient.context(),null);
  for(const source of ['history-restore','wizard-scenario-example','json-import','json-import-text','json-import-file']){
    assert.strictEqual(reopenClient.handleProjectChanged({source}),true,source+' debe ser frontera local');
  }

  console.log('✓ Contexto SaaS se invalida en pérdida de auth y reemplazos locales sin romper ediciones remotas');
})().catch(err=>{console.error(err);process.exitCode=1;});
