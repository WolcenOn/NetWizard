/* NetWizard Remote Project Client v1 */
(function initNetWizardRemoteProjectClient(root){
'use strict';

function clean(v){return String(v==null?'':v).trim();}
function clone(v){return v==null?v:JSON.parse(JSON.stringify(v));}
function createError(message,status,body){
  const err=new Error(message);
  err.status=status||0;
  if(body&&body.currentVersion!=null)err.currentVersion=Number(body.currentVersion)||0;
  err.body=body||null;
  return err;
}
function createClient(options){
  const opts=options||{};
  const fetchFn=opts.fetchFn||(root.fetch?root.fetch.bind(root):null);
  const stateApi=opts.stateApi||null;
  const authApi=opts.authApi||null;
  const locationObj=opts.location||root.location||null;
  let context=null;
  let lastSnapshotJSON='';
  let autoOpened='';

  function state(){
    return stateApi||root.NetWizardState||null;
  }
  function auth(){
    return authApi||root.NetWizardAuth||null;
  }
  function authState(){
    const a=auth();
    return a&&typeof a.state==='function'?a.state():{authenticated:false,capabilities:{},user:null};
  }
  function emit(name,detail){
    try{
      if(typeof root.dispatchEvent==='function'&&typeof root.CustomEvent==='function'){
        root.dispatchEvent(new root.CustomEvent(name,{detail:clone(detail)}));
      }
    }catch(_e){}
  }
  async function requestJSON(url,init){
    if(!fetchFn)throw createError('fetch unavailable',0,null);
    const response=await fetchFn(url,Object.assign({credentials:'same-origin'},init||{}));
    let body=null;
    try{body=await response.json();}catch{}
    if(!response.ok){
      const message=body&&body.error?String(body.error):('remote request failed: '+response.status);
      throw createError(message,response.status,body);
    }
    return {response,body:body||{}};
  }
  function contextSnapshot(){return clone(context);}
  function clear(){
    const previous=contextSnapshot();
    context=null;
    lastSnapshotJSON='';
    emit('nw:remote-project:changed',{context:null,previous});
  }
  function setContext(project,revision,response,snapshot){
    if(!project||!revision)throw createError('invalid remote project response',0,null);
    const projectId=clean(project.id||revision.projectId);
    const currentVersion=Number(project.currentVersion||revision.version||0);
    if(!projectId||currentVersion<1)throw createError('invalid remote project metadata',0,null);
    let etag='';
    try{etag=clean(response&&response.headers&&response.headers.get&&response.headers.get('etag'));}catch{}
    context={
      projectId,
      workspaceId:clean(project.workspaceId),
      name:clean(project.name),
      schemaVersion:clean(project.schemaVersion||revision.schemaVersion),
      currentVersion,
      etag
    };
    lastSnapshotJSON=JSON.stringify(snapshot||revision.snapshot||{});
    emit('nw:remote-project:changed',{context:contextSnapshot()});
    return contextSnapshot();
  }
  function requireAuthenticated(){
    const current=authState();
    if(!current.authenticated||!current.user)throw createError('authenticated SaaS session required',401,null);
    return current;
  }
  function csrf(){
    const current=requireAuthenticated();
    const token=clean(current.user&&current.user.csrfToken);
    if(!token)throw createError('csrf token unavailable',403,null);
    return token;
  }
  async function open(projectId,options){
    const id=clean(projectId);
    if(!id)throw createError('project id required',0,null);
    requireAuthenticated();
    const result=await requestJSON('/api/projects/'+encodeURIComponent(id));
    const project=result.body.project;
    const revision=result.body.revision;
    const snapshot=revision&&revision.snapshot;
    if(!project||!revision||!snapshot||typeof snapshot!=='object'||Array.isArray(snapshot)){
      throw createError('invalid remote project response',0,result.body);
    }
    if(clean(project.id)!==id)throw createError('remote project id mismatch',0,result.body);
    const ctx=setContext(project,revision,result.response,snapshot);
    const optsOpen=options||{};
    if(optsOpen.replaceState!==false){
      const s=state();
      if(!s||typeof s.replaceProject!=='function')throw createError('NetWizardState unavailable',0,null);
      s.replaceProject(clone(snapshot),{source:'remote-project-open'});
    }
    return {context:ctx,project:clone(project),revision:clone(revision),snapshot:clone(snapshot)};
  }
  function canUsePrivateRouting(){
    const current=authState(),caps=current.capabilities||{};
    return !!(context&&current.authenticated&&current.user&&current.user.csrfToken&&caps.privateRouting);
  }
  function canUsePrivateDeploymentPlan(){
    const current=authState(),caps=current.capabilities||{};
    return !!(context&&current.authenticated&&current.user&&current.user.csrfToken&&caps.privateDeploymentPlan);
  }
  async function saveCurrent(options){
    if(!context)throw createError('remote project context required',0,null);
    const s=state();
    if(!s||typeof s.getSnapshot!=='function')throw createError('NetWizardState unavailable',0,null);
    const snapshot=clone(s.getSnapshot());
    const serialized=JSON.stringify(snapshot||{});
    if(!(options&&options.force)&&serialized===lastSnapshotJSON){
      return {saved:false,context:contextSnapshot(),snapshot};
    }
    const headers={'Content-Type':'application/json','X-NetWizard-CSRF':csrf()};
    if(context.etag)headers['If-Match']=context.etag;
    const result=await requestJSON('/api/projects/'+encodeURIComponent(context.projectId),{
      method:'PUT',
      headers,
      body:JSON.stringify({expectedVersion:context.currentVersion,snapshot})
    });
    setContext(result.body.project,result.body.revision,result.response,snapshot);
    return {saved:true,context:contextSnapshot(),project:clone(result.body.project),revision:clone(result.body.revision),snapshot};
  }
  async function generatePrivateRouting(deviceId){
    if(!context)throw createError('remote project context required',0,null);
    if(!canUsePrivateRouting())throw createError('private routing unavailable for current session',403,null);
    const id=clean(deviceId);
    if(!id)throw createError('device id required',0,null);
    const result=await requestJSON('/api/projects/'+encodeURIComponent(context.projectId)+'/private/routing',{
      method:'POST',
      headers:{'Content-Type':'application/json','X-NetWizard-CSRF':csrf()},
      body:JSON.stringify({expectedVersion:context.currentVersion,deviceId:id})
    });
    const body=result.body||{};
    if(body.contractVersion!=='netwizard-private-routing-v1'||clean(body.deviceId)!==id||typeof body.output!=='string'){
      throw createError('private routing contract mismatch',0,body);
    }
    return clone(body);
  }
  async function syncAndGenerateRouting(deviceId){
    await saveCurrent();
    return generatePrivateRouting(deviceId);
  }
  async function generatePrivateDeploymentPlan(){
    if(!context)throw createError('remote project context required',0,null);
    if(!canUsePrivateDeploymentPlan())throw createError('private deployment plan unavailable for current session',403,null);
    const result=await requestJSON('/api/projects/'+encodeURIComponent(context.projectId)+'/private/deployment-plan',{
      method:'POST',
      headers:{'Content-Type':'application/json','X-NetWizard-CSRF':csrf()},
      body:JSON.stringify({expectedVersion:context.currentVersion})
    });
    const body=result.body||{};
    if(
      body.contractVersion!=='netwizard-private-deployment-plan-v2'||
      typeof body.generatedAt!=='string'||
      typeof body.ok!=='boolean'||
      typeof body.productionReady!=='boolean'||
      !['ready','review','blocked'].includes(clean(body.productionStatus))||
      body.productionGateContract!=='netwizard-private-production-gate-v1'||
      !body.productionGate||typeof body.productionGate!=='object'||
      body.productionReady!==(body.productionStatus==='ready')||
      !Array.isArray(body.artifacts)||
      !Array.isArray(body.issues)
    ){
      throw createError('private deployment plan contract mismatch',0,body);
    }
    return clone(body);
  }
  async function syncAndGenerateDeploymentPlan(){
    await saveCurrent();
    return generatePrivateDeploymentPlan();
  }
  async function autoOpenFromLocation(){
    if(!locationObj)return false;
    let id='';
    try{id=clean(new URLSearchParams(String(locationObj.search||'')).get('projectId'));}catch{}
    if(!id||id===autoOpened)return false;
    const current=authState(),caps=current.capabilities||{};
    if(!current.authenticated||!caps.remoteProjectWrites)return false;
    autoOpened=id;
    try{
      await open(id,{replaceState:true});
      return true;
    }catch(err){
      autoOpened='';
      emit('nw:remote-project:error',{projectId:id,message:err&&err.message||String(err),status:err&&err.status||0});
      throw err;
    }
  }

  return {
    version:'netwizard-remote-project-v2',
    context:contextSnapshot,
    clear,
    open,
    saveCurrent,
    canUsePrivateRouting,
    generatePrivateRouting,
    syncAndGenerateRouting,
    canUsePrivateDeploymentPlan,
    generatePrivateDeploymentPlan,
    syncAndGenerateDeploymentPlan,
    autoOpenFromLocation
  };
}

const singleton=createClient({});
function mount(){
  const tryOpen=()=>singleton.autoOpenFromLocation().catch(err=>{
    if(root.console&&typeof root.console.warn==='function')root.console.warn('NetWizard remote project open failed',err);
  });
  if(typeof root.addEventListener==='function')root.addEventListener('nw:auth:changed',tryOpen);
  if(root.document){
    if(root.document.readyState==='loading')root.document.addEventListener('DOMContentLoaded',()=>root.setTimeout?root.setTimeout(tryOpen,0):tryOpen(),{once:true});
    else if(root.setTimeout)root.setTimeout(tryOpen,0);else tryOpen();
  }
  return singleton;
}

const api={version:'netwizard-remote-project-client-v2',createClient,mount};
root.NetWizardRemoteProject=singleton;
root.NetWizardRemoteProjectClient=api;
if(typeof module!=='undefined'&&module.exports)module.exports=api;
if(root.document)mount();
})(typeof window!=='undefined'?window:globalThis);
