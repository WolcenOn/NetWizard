/* NetWizard Cloud Private Deployment UI v1 */
(function initNetWizardPrivateDeploymentUi(root){
'use strict';

const clean=v=>String(v==null?'':v).trim();
let lastResult=null;
let lastResultContext=null;
let selectedKey='';

function authState(){
  const auth=root.NetWizardAuth;
  return auth&&typeof auth.state==='function'?auth.state():{authenticated:false,capabilities:{},user:null};
}
function el(tag,attrs,text){
  const n=root.document.createElement(tag);
  for(const [k,v] of Object.entries(attrs||{})){
    if(k==='className')n.className=v;
    else n.setAttribute(k,String(v));
  }
  if(text!=null)n.textContent=String(text);
  return n;
}
function ensureMount(){
  if(!root.document)return null;
  let card=root.document.getElementById('nwPrivateDeploymentCard');
  if(card)return card;
  const page=root.document.getElementById('pg-cfg');
  if(!page)return null;
  card=el('div',{className:'card',id:'nwPrivateDeploymentCard'});
  const routing=root.document.getElementById('nwPrivateRoutingCard');
  if(routing&&routing.parentNode){
    routing.parentNode.insertBefore(card,routing.nextSibling);
  }else{
    const heading=page.querySelector('.ph');
    if(heading&&heading.nextSibling)page.insertBefore(card,heading.nextSibling);
    else page.appendChild(card);
  }
  return card;
}
function setStatus(message,kind){
  const node=root.document&&root.document.getElementById('nwPrivateDeploymentStatus');
  if(!node)return;
  node.className='co '+(kind==='error'?'co-rd':kind==='ok'?'co-gn':'co-ac');
  node.textContent=message;
}
function safeFileName(value,fallback){
  const out=clean(value).replace(/[\\/:*?"<>|]+/g,'-').replace(/\s+/g,'-').replace(/^-+|-+$/g,'');
  return out||fallback||'netwizard-artifact.txt';
}
function viewsFor(result){
  const r=result||{};
  const views=[];
  const add=(key,label,content,fileName,mime)=>{
    const text=typeof content==='string'?content:'';
    if(!text)return;
    views.push({key,label,content:text,fileName:safeFileName(fileName,key+'.txt'),mime:mime||'text/plain;charset=utf-8'});
  };
  add('production-gate','Production Gate',r.productionGateSummaryMarkdown,'private-production-gate.md','text/markdown;charset=utf-8');
  add('runbook','Runbook',r.runbookMarkdown,'deployment-runbook.md','text/markdown;charset=utf-8');
  add('rollback','Rollback',r.rollbackMarkdown,'deployment-rollback.md','text/markdown;charset=utf-8');
  add('post-change','Checklist post-change',r.postChangeChecklistMarkdown,'post-change-checklist.md','text/markdown;charset=utf-8');
  add('change-summary','Resumen change set',r.changeSummaryMarkdown,'change-summary.md','text/markdown;charset=utf-8');
  add('incremental-summary','Resumen incremental',r.incrementalSummaryMarkdown,'incremental-summary.md','text/markdown;charset=utf-8');
  for(const [index,artifact] of (Array.isArray(r.artifacts)?r.artifacts:[]).entries()){
    if(!artifact||typeof artifact.content!=='string')continue;
    const path=clean(artifact.path)||('artifact-'+(index+1)+'.txt');
    if(path==='reports/private-production-gate.md'&&typeof r.productionGateSummaryMarkdown==='string')continue;
    add('artifact:'+index,path,artifact.content,path,clean(artifact.mime)||'text/plain;charset=utf-8');
  }
  return views;
}
function resultMatchesContext(remote){
  if(!lastResult||!lastResultContext||!remote||typeof remote.context!=='function')return false;
  const ctx=remote.context();
  return !!(ctx&&ctx.projectId===lastResultContext.projectId&&ctx.currentVersion===lastResultContext.currentVersion);
}
function clearResult(){
  lastResult=null;
  lastResultContext=null;
  selectedKey='';
}
function selectedView(result){
  const views=viewsFor(result);
  if(!views.length)return null;
  let view=views.find(x=>x.key===selectedKey);
  if(!view){
    view=views.find(x=>x.key==='runbook')||views[0];
    selectedKey=view.key;
  }
  return view;
}
function configArtifactForDevice(result,deviceId){
  const r=result||{},id=clean(deviceId);
  if(!id)return null;
  const plan=r.deploymentPlan&&typeof r.deploymentPlan==='object'?r.deploymentPlan:{};
  const step=(Array.isArray(plan.steps)?plan.steps:[]).find(item=>clean(item&&item.deviceId)===id);
  const paths=r.configPaths&&typeof r.configPaths==='object'?r.configPaths:{};
  const path=clean(paths[id]||step&&step.configPath);
  if(!path)return null;
  const artifact=(Array.isArray(r.artifacts)?r.artifacts:[]).find(item=>clean(item&&item.path)===path&&typeof item.content==='string');
  if(!artifact)return null;
  const readinessMap=r.configReadiness&&typeof r.configReadiness==='object'?r.configReadiness:{};
  const rawReadiness=readinessMap[id]&&typeof readinessMap[id]==='object'?readinessMap[id]:{};
  const readiness={
    status:clean(rawReadiness.status),
    reasons:(Array.isArray(rawReadiness.reasons)?rawReadiness.reasons:[]).map(clean).filter(Boolean)
  };
  return {deviceId:id,vendor:clean(step&&step.vendor),path,content:artifact.content,mime:clean(artifact.mime)||'text/plain;charset=utf-8',readiness};
}
function deviceConfig(deviceId){
  if(!lastResult)return null;
  return configArtifactForDevice(lastResult,deviceId);
}
function renderResult(result){
  const select=root.document&&root.document.getElementById('nwPrivateDeploymentView');
  const output=root.document&&root.document.getElementById('nwPrivateDeploymentOutput');
  const copy=root.document&&root.document.getElementById('nwPrivateDeploymentCopy');
  const download=root.document&&root.document.getElementById('nwPrivateDeploymentDownload');
  if(!select||!output)return;

  const views=viewsFor(result);
  select.textContent='';
  if(!views.length){
    select.appendChild(el('option',{value:''},'Sin salidas textuales'));
    select.disabled=true;
    output.value='';
    if(copy)copy.disabled=true;
    if(download)download.disabled=true;
    return;
  }
  for(const view of views)select.appendChild(el('option',{value:view.key},view.label));
  const current=selectedView(result);
  select.disabled=false;
  select.value=current.key;
  output.value=current.content;
  if(copy)copy.disabled=!current.content;
  if(download)download.disabled=!current.content;

  select.onchange=()=>{
    selectedKey=clean(select.value);
    const next=selectedView(result);
    output.value=next?next.content:'';
    if(copy)copy.disabled=!(next&&next.content);
    if(download)download.disabled=!(next&&next.content);
  };
}
function render(){
  const card=ensureMount();
  if(!card)return false;
  const auth=authState(),caps=auth.capabilities||{};
  const cloudAvailable=!!(caps.authEnforced&&caps.privateDeploymentPlan);
  card.style.display=cloudAvailable?'':'none';
  if(!cloudAvailable)return false;

  const remote=root.NetWizardRemoteProject;
  const ctx=remote&&typeof remote.context==='function'?remote.context():null;
  if(lastResult&&!resultMatchesContext(remote))clearResult();

  card.textContent='';
  const head=el('div',{className:'card-h'});
  head.append(
    el('div',{className:'card-t'},'☁ Private Deployment Plan'),
    el('span',{className:'b bac'},ctx?('v'+ctx.currentVersion):'sin contexto')
  );
  card.appendChild(head);
  card.appendChild(el('div',{className:'hint'},
    'Sincroniza la revisión cloud y genera configuraciones, change set, plan incremental, runbook y rollback en el Private Engine. Las salidas son derivadas y no se guardan dentro del snapshot.'));

  const actionRow=el('div',{className:'row'});
  const infoCol=el('div');
  infoCol.append(el('label',{className:'fl'},'Proyecto remoto'));
  infoCol.append(el('div',{className:'co co-ac',id:'nwPrivateDeploymentContext'},
    ctx?((ctx.name||ctx.projectId)+' · versión '+ctx.currentVersion):'Abre primero un proyecto cloud.'));
  const actionCol=el('div');
  actionCol.append(el('label',{className:'fl'},'Private Engine'));
  const generate=el('button',{type:'button',className:'btn bp',id:'nwPrivateDeploymentGenerate'},'☁ Sincronizar y generar deployment plan');
  generate.disabled=!(remote&&remote.canUsePrivateDeploymentPlan&&remote.canUsePrivateDeploymentPlan());
  actionCol.appendChild(generate);
  actionRow.append(infoCol,actionCol);
  card.appendChild(actionRow);

  const status=el('div',{className:'co co-ac',id:'nwPrivateDeploymentStatus'});
  status.textContent=ctx
    ? ('Listo para generar desde la revisión remota '+ctx.currentVersion+'.')
    : 'Abre un proyecto SaaS para activar el deployment privado.';
  card.appendChild(status);

  const selectorRow=el('div',{className:'row'});
  const selectorCol=el('div');
  selectorCol.append(el('label',{className:'fl',for:'nwPrivateDeploymentView'},'Salida derivada'));
  const select=el('select',{id:'nwPrivateDeploymentView'});
  select.appendChild(el('option',{value:''},'Genera un plan para ver las salidas'));
  select.disabled=true;
  selectorCol.appendChild(select);
  const metaCol=el('div');
  metaCol.append(el('label',{className:'fl'},'Contrato'));
  metaCol.append(el('div',{className:'hint',id:'nwPrivateDeploymentContract'},'netwizard-private-deployment-plan-v2'));
  selectorRow.append(selectorCol,metaCol);
  card.appendChild(selectorRow);

  const output=el('textarea',{
    className:'cfg',
    id:'nwPrivateDeploymentOutput',
    readonly:'readonly',
    style:'min-height:260px;margin-top:8px;',
    placeholder:'Runbook, rollback, resúmenes y artefactos privados aparecerán aquí.'
  });
  card.appendChild(output);

  const actions=el('div',{className:'brow'});
  const copy=el('button',{type:'button',className:'btn bs bsm',id:'nwPrivateDeploymentCopy'},'Copiar salida');
  const download=el('button',{type:'button',className:'btn bs bsm',id:'nwPrivateDeploymentDownload'},'Descargar salida');
  copy.disabled=true;download.disabled=true;
  actions.append(copy,download);
  card.appendChild(actions);

  if(lastResult&&resultMatchesContext(remote)){
    renderResult(lastResult);
    const issueCount=Array.isArray(lastResult.issues)?lastResult.issues.length:0;
    const gateIssues=lastResult.productionGate&&Array.isArray(lastResult.productionGate.issues)?lastResult.productionGate.issues.length:0;
    const gateLabel=lastResult.productionStatus==='ready'?'LISTO':lastResult.productionStatus==='review'?'REVISIÓN':'BLOQUEADO';
    setStatus(
      lastResult.ok
        ? ('Deployment plan privado generado · Production Gate: '+gateLabel+' · '+(lastResult.artifacts||[]).length+' artefacto(s) · '+gateIssues+' incidencia(s) de gate.')
        : ('Deployment plan incompleto · Production Gate: '+gateLabel+' · '+issueCount+' incidencia(s) de generación.'),
      lastResult.productionReady?'ok':(lastResult.productionStatus==='blocked'?'error':'info')
    );
  }

  generate.onclick=async()=>{
    if(!remote||typeof remote.syncAndGenerateDeploymentPlan!=='function')return setStatus('Cliente SaaS remoto no disponible.','error');
    generate.disabled=true;
    clearResult();
    output.value='';select.disabled=true;copy.disabled=true;download.disabled=true;
    setStatus('Sincronizando revisión y ejecutando Private Deployment Plan…','info');
    try{
      const result=await remote.syncAndGenerateDeploymentPlan();
      const latest=remote.context();
      lastResult=result;
      lastResultContext=latest?{projectId:latest.projectId,currentVersion:latest.currentVersion}:null;
      selectedKey='';
      render();
      if(root.NetWizardConfigView&&typeof root.NetWizardConfigView.refreshPrivateArtifacts==='function'){
        root.NetWizardConfigView.refreshPrivateArtifacts();
      }
    }catch(err){
      const conflict=err&&[409,412].includes(err.status);
      const suffix=conflict?' Recarga el proyecto cloud antes de reintentar.':'';
      setStatus('No se pudo generar el deployment plan privado: '+(err&&err.message||'error desconocido')+'.'+suffix,'error');
    }finally{
      const live=root.document.getElementById('nwPrivateDeploymentGenerate');
      if(live)live.disabled=!(remote&&remote.canUsePrivateDeploymentPlan&&remote.canUsePrivateDeploymentPlan());
    }
  };

  copy.onclick=()=>{
    const view=selectedView(lastResult);
    if(!view||!view.content)return;
    if(root.navigator&&root.navigator.clipboard&&root.navigator.clipboard.writeText){
      root.navigator.clipboard.writeText(view.content);
    }
  };
  download.onclick=()=>{
    const view=selectedView(lastResult);
    if(!view||!view.content||!root.Blob||!root.URL||!root.URL.createObjectURL)return;
    const url=root.URL.createObjectURL(new root.Blob([view.content],{type:view.mime}));
    const link=el('a',{href:url,download:view.fileName});
    root.document.body.appendChild(link);
    link.click();
    link.remove();
    root.setTimeout?root.setTimeout(()=>root.URL.revokeObjectURL(url),0):root.URL.revokeObjectURL(url);
  };
  return true;
}
function install(){
  if(!root.document)return false;
  const rerender=()=>{try{render();}catch(err){if(root.console)root.console.error('NetWizard private deployment UI',err);}};
  const remoteChanged=()=>rerender();
  root.addEventListener&&root.addEventListener('nw:auth:changed',rerender);
  root.addEventListener&&root.addEventListener('nw:remote-project:changed',remoteChanged);
  root.document.addEventListener&&root.document.addEventListener('nw:project:changed',()=>{
    clearResult();
    rerender();
  });
  if(root.document.readyState==='loading')root.document.addEventListener('DOMContentLoaded',rerender,{once:true});else rerender();
  return true;
}

const api={version:'netwizard-private-deployment-ui-v2',viewsFor,configArtifactForDevice,deviceConfig,render,install,clearResult};
root.NetWizardPrivateDeploymentUi=api;
if(typeof module!=='undefined'&&module.exports)module.exports=api;
if(root.document)install();
})(typeof window!=='undefined'?window:globalThis);
