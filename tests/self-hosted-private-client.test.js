'use strict';

const assert=require('assert');
const Client=require('../js/netwizard-self-hosted-private-client.js');

(async()=>{
  const calls=[];
  const responses=[
    {status:401,ok:false,body:null},
    {status:200,ok:true,body:{authenticated:true,csrfToken:'csrf-123',expiresAt:'2026-09-29T20:00:00Z'}},
    {status:200,ok:true,body:{
      contractVersion:'netwizard-private-deployment-plan-v2',
      generatedAt:'2026-09-29T18:00:00Z',
      ok:true,
      productionReady:false,
      productionStatus:'review',
      productionGateContract:'netwizard-private-production-gate-v1',
      productionGate:{contractVersion:'netwizard-private-production-gate-v1',status:'review',ready:false},
      artifacts:[{path:'configs/01-r1.cfg',content:'hostname R1\n'}],
      issues:[]
    }},
    {status:204,ok:true,body:null}
  ];
  const fetchFn=async(url,init={})=>{
    calls.push({url,init});
    const next=responses.shift();
    return{
      status:next.status,
      ok:next.ok,
      async json(){if(next.body==null)throw new Error('no json');return next.body;}
    };
  };
  const snapshot={_schemaVersion:'3.50.0',projName:'Local',devices:[{id:'r1',vendorOs:'cisco_ios'}]};
  const client=Client.createClient({
    fetchFn,
    authProvider:()=>({capabilities:{selfHostedPrivateGeneration:true}}),
    stateProvider:()=>({getSnapshot:()=>snapshot})
  });

  let state=await client.refreshSession();
  assert.strictEqual(state.enabled,true);
  assert.strictEqual(state.authenticated,false);

  state=await client.login('operator-secret');
  assert.strictEqual(state.authenticated,true);
  assert.strictEqual(state.expiresAt,'2026-09-29T20:00:00Z');
  assert.strictEqual(calls[1].url,'/api/private/self-hosted/session');
  assert.strictEqual(calls[1].init.headers['X-NetWizard-Private-Request'],'1');
  assert.deepStrictEqual(JSON.parse(calls[1].init.body),{token:'operator-secret'});

  const result=await client.generateDeploymentPlan();
  assert.strictEqual(result.contractVersion,'netwizard-private-deployment-plan-v2');
  assert.match(result.artifacts[0].content,/hostname R1/);
  assert.strictEqual(calls[2].url,'/api/private/self-hosted/deployment-plan');
  assert.strictEqual(calls[2].init.headers['X-NetWizard-CSRF'],'csrf-123');
  assert.strictEqual(calls[2].init.headers['X-NetWizard-Private-Request'],'1');
  assert.deepStrictEqual(JSON.parse(calls[2].init.body),{snapshot});
  assert.ok(!('desiredConfigs' in JSON.parse(calls[2].init.body)));

  assert.strictEqual(await client.logout(),true);
  assert.strictEqual(client.state().authenticated,false);
  assert.strictEqual(calls[3].init.headers['X-NetWizard-CSRF'],'csrf-123');

  const disabled=Client.createClient({
    fetchFn:async()=>{throw new Error('should not fetch');},
    authProvider:()=>({capabilities:{selfHostedPrivateGeneration:false}})
  });
  assert.strictEqual(disabled.enabled(),false);
  await assert.rejects(()=>disabled.generateDeploymentPlan(),/unavailable/);

  console.log('✓ Cliente self-hosted transporta snapshot y sesión sin lógica vendor ni inputs de config cliente');
})().catch(err=>{console.error(err);process.exitCode=1;});
