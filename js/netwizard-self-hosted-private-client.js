/* =========================================================
   NetWizard Self-Hosted Private Client v1
   Transporte público hacia Private Engine server-side.
   No contiene lógica de generación vendor.
========================================================= */
(function initNetWizardSelfHostedPrivateClient(root){
'use strict';

function clean(v){return String(v==null?'':v).trim();}
function clone(v){return v==null?v:JSON.parse(JSON.stringify(v));}
function createError(message,status,body){
  const err=new Error(message);err.status=status||0;err.body=body||null;return err;
}
function authState(){
  const auth=root.NetWizardAuth;
  return auth&&typeof auth.state==='function'?auth.state():{capabilities:{}};
}
function validDeploymentResult(body){
  return !!(
    body&&
    body.contractVersion==='netwizard-private-deployment-plan-v2'&&
    typeof body.generatedAt==='string'&&
    typeof body.ok==='boolean'&&
    typeof body.productionReady==='boolean'&&
    ['ready','review','blocked'].includes(clean(body.productionStatus))&&
    body.productionGateContract==='netwizard-private-production-gate-v1'&&
    body.productionGate&&typeof body.productionGate==='object'&&
    body.productionReady===(body.productionStatus==='ready')&&
    Array.isArray(body.artifacts)&&
    Array.isArray(body.issues)
  );
}
function createClient(options){
  const opts=options||{};
  const fetchFn=opts.fetchFn||(root.fetch?root.fetch.bind(root):null);
  const stateProvider=opts.stateProvider||(()=>root.NetWizardState);
  const authProvider=opts.authProvider||authState;
  let session=null;

  async function requestJSON(url,init){
    if(!fetchFn)throw createError('fetch unavailable',0,null);
    const response=await fetchFn(url,Object.assign({credentials:'same-origin'},init||{}));
    let body=null;
    try{body=await response.json();}catch{}
    return{response,body};
  }
  function enabled(){
    const current=authProvider()||{},caps=current.capabilities||{};
    return !!caps.selfHostedPrivateGeneration;
  }
  function state(){
    return{
      enabled:enabled(),
      authenticated:!!(session&&session.authenticated&&session.csrfToken),
      expiresAt:clean(session&&session.expiresAt)
    };
  }
  function emit(){
    try{
      if(typeof root.dispatchEvent==='function'&&typeof root.CustomEvent==='function'){
        root.dispatchEvent(new root.CustomEvent('nw:self-hosted-private:changed',{detail:state()}));
      }
    }catch(_e){}
  }
  async function refreshSession(){
    if(!enabled()){session=null;emit();return state();}
    const result=await requestJSON('/api/private/self-hosted/session');
    if(result.response.status===401){session=null;emit();return state();}
    if(!result.response.ok)throw createError('self-hosted private session unavailable',result.response.status,result.body);
    if(!result.body||result.body.authenticated!==true||!clean(result.body.csrfToken)){
      throw createError('self-hosted private session contract mismatch',0,result.body);
    }
    session=clone(result.body);emit();return state();
  }
  async function login(token){
    if(!enabled())throw createError('self-hosted private generation unavailable',404,null);
    const value=String(token==null?'':token);
    if(!value.trim())throw createError('self-hosted private token required',0,null);
    const result=await requestJSON('/api/private/self-hosted/session',{
      method:'POST',
      headers:{'Content-Type':'application/json','X-NetWizard-Private-Request':'1'},
      body:JSON.stringify({token:value})
    });
    if(!result.response.ok)throw createError(
      result.response.status===401?'private token rejected':'self-hosted private login failed',
      result.response.status,result.body
    );
    if(!result.body||result.body.authenticated!==true||!clean(result.body.csrfToken)){
      throw createError('self-hosted private session contract mismatch',0,result.body);
    }
    session=clone(result.body);emit();return state();
  }
  async function logout(){
    if(!session||!clean(session.csrfToken)){session=null;emit();return false;}
    const result=await requestJSON('/api/private/self-hosted/logout',{
      method:'POST',
      headers:{
        'X-NetWizard-Private-Request':'1',
        'X-NetWizard-CSRF':session.csrfToken
      }
    });
    if(!result.response.ok&&result.response.status!==401){
      throw createError('self-hosted private logout failed',result.response.status,result.body);
    }
    session=null;emit();return true;
  }
  async function generateDeploymentPlan(){
    if(!enabled())throw createError('self-hosted private generation unavailable',404,null);
    if(!session||!clean(session.csrfToken))throw createError('self-hosted private session required',401,null);
    const stateApi=stateProvider();
    if(!stateApi||typeof stateApi.getSnapshot!=='function')throw createError('NetWizardState unavailable',0,null);
    const snapshot=clone(stateApi.getSnapshot());
    const result=await requestJSON('/api/private/self-hosted/deployment-plan',{
      method:'POST',
      headers:{
        'Content-Type':'application/json',
        'X-NetWizard-Private-Request':'1',
        'X-NetWizard-CSRF':session.csrfToken
      },
      body:JSON.stringify({snapshot})
    });
    if(result.response.status===401){session=null;emit();}
    if(!result.response.ok)throw createError('self-hosted private deployment failed',result.response.status,result.body);
    if(!validDeploymentResult(result.body))throw createError('private deployment plan contract mismatch',0,result.body);
    return clone(result.body);
  }

  return{version:'netwizard-self-hosted-private-client-v1',state,enabled,refreshSession,login,logout,generateDeploymentPlan};
}

const singleton=createClient({});
root.NetWizardSelfHostedPrivateClient={version:'netwizard-self-hosted-private-client-v1',createClient,validDeploymentResult};
root.NetWizardSelfHostedPrivate=singleton;

function refresh(){
  singleton.refreshSession().catch(err=>{
    if(root.console&&typeof root.console.warn==='function'&&err&&err.status!==401){
      root.console.warn('NetWizard self-hosted private session refresh failed',err);
    }
  });
}
if(typeof root.addEventListener==='function')root.addEventListener('nw:auth:changed',refresh);
if(root.document){
  if(root.document.readyState==='loading')root.document.addEventListener('DOMContentLoaded',refresh,{once:true});
  else refresh();
}
if(typeof module!=='undefined'&&module.exports)module.exports={createClient,validDeploymentResult};
})(typeof window!=='undefined'?window:globalThis);
