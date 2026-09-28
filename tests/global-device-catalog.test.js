'use strict';

const assert=require('assert');

let calls=[];
global.NetWizardAuth={
  state(){return{
    authenticated:true,
    capabilities:{globalDeviceCatalog:true},
    user:{isAdmin:true,csrfToken:'csrf-123'}
  };}
};
global.fetch=async (url,init)=>{
  calls.push({url,init:init||{}});
  if(String(url)==='/api/device-models/global'){
    return {ok:true,status:200,json:async()=>({models:[{id:'global-acme-x48',manufacturer:'ACME',model:'X48'}]})};
  }
  return {ok:true,status:200,json:async()=>({
    id:'global-acme-x48-x48p-poe-rev-a',manufacturer:'ACME',model:'X48',validated:true
  })};
};

const Catalog=require('../js/netwizard-global-device-catalog.js');

const local={
  id:'custom-acme-x48',
  manufacturer:'ACME',
  model:'X48',
  sku:'X48P-POE',
  revision:'Rev A',
  kind:'switch',
  rackUnits:1,
  portGroups:[{id:'access',namePattern:'Gi1/0/{n}',count:48,media:'copper',speedMaxMbps:1000}]
};

assert.strictEqual(Catalog.canPromote(),true);
assert.strictEqual(Catalog.globalId(local),'global-acme-x48-x48p-poe-rev-a');

(async()=>{
  const promoted=await Catalog.promote(local);
  assert.strictEqual(promoted.validated,true);
  assert.strictEqual(calls.length,1);
  assert.strictEqual(calls[0].init.method,'PUT');
  assert.strictEqual(calls[0].init.headers['X-NetWizard-CSRF'],'csrf-123');
  const body=JSON.parse(calls[0].init.body);
  assert.strictEqual(body.definition.id,undefined,'La promoción no debe reutilizar el id local como identidad global');
  assert.strictEqual(body.definition.manufacturer,'ACME');
  assert.strictEqual(local.id,'custom-acme-x48','La promoción no debe mutar el modelo local');

  calls=[];
  const list=await Catalog.list();
  assert.strictEqual(list.length,1);
  assert.strictEqual(list[0].id,'global-acme-x48');

  global.NetWizardAuth.state=()=>({authenticated:true,capabilities:{globalDeviceCatalog:true},user:{isAdmin:false,csrfToken:'x'}});
  assert.strictEqual(Catalog.canPromote(),false);
  await assert.rejects(()=>Catalog.promote(local),/admin required/);

  console.log('✓ Catálogo global promueve copias validadas solo con sesión admin');
})().catch(err=>{console.error(err);process.exitCode=1;});
