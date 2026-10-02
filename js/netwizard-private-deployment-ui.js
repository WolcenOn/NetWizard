/* NetWizard Cloud Private Deployment UI v1 */
(function initNetWizardPrivateDeploymentUi(root){
'use strict';

const clean=v=>String(v==null?'':v).trim();
const clone=v=>v==null?v:JSON.parse(JSON.stringify(v));
let lastResult=null;
let lastResultContext=null;
let lastResultMode='';
let lastResultStale=false;
let pendingGenerateAfterLogin=false;
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
function bindPrimaryGenerateAction(options){
  const opts=options||{},button=root.document&&root.document.getElementById('cfgGenerateServer');
  if(!button)return;
  if(!opts.available){
    button.disabled=true;
    button.textContent='☁ Generación server-side no disponible';
    button.onclick=null;
    return;
  }
  button.disabled=false;
  const locked=opts.mode==='self-hosted'&&!opts.authenticated;
  button.textContent=locked?'🔒 Autorizar y generar':'☁ Generar en servidor';
  button.onclick=()=>{
    const live=root.document&&root.document.getElementById('nwPrivateDeploymentGenerate');
    if(live&&!live.disabled){live.click();return;}
    if(locked){
      pendingGenerateAfterLogin=true;
      if(opts.card&&typeof opts.card.scrollIntoView==='function')opts.card.scrollIntoView({behavior:'smooth',block:'center'});
      const token=root.document&&root.document.getElementById('nwSelfHostedPrivateToken');
      if(token&&typeof token.focus==='function')token.focus();
    }
  };
}
function safeFileName(value,fallback){
  const out=clean(value).replace(/[\\/:*?"<>|]+/g,'-').replace(/\s+/g,'-').replace(/^-+|-+$/g,'');
  return out||fallback||'netwizard-artifact.txt';
}
function generationDiagnosticsMarkdown(result){
  const r=result||{},caps=r.configCapabilities&&typeof r.configCapabilities==='object'?r.configCapabilities:{};
  const readiness=r.configReadiness&&typeof r.configReadiness==='object'?r.configReadiness:{};
  const paths=r.configPaths&&typeof r.configPaths==='object'?r.configPaths:{};
  const issues=Array.isArray(r.issues)?r.issues:[];
  const ids=new Set([...Object.keys(caps),...Object.keys(readiness),...Object.keys(paths),...issues.map(x=>clean(x&&x.deviceId)).filter(Boolean)]);
  const lines=['# Diagnóstico de generación privada','',`Generado: ${clean(r.generatedAt)||'—'}`,'', '| Dispositivo | Vendor | Tipo | Modo | Estado | Detalle |','| --- | --- | --- | --- | --- | --- |'];
  for(const id of Array.from(ids).sort()){
    const cap=caps[id]&&typeof caps[id]==='object'?caps[id]:{};
    const ready=readiness[id]&&typeof readiness[id]==='object'?readiness[id]:{};
    const ownIssues=issues.filter(x=>clean(x&&x.deviceId)===id);
    const hasArtifact=(Array.isArray(r.artifacts)?r.artifacts:[]).some(a=>clean(a&&a.path)===clean(paths[id])&&typeof a.content==='string');
    let status=clean(ready.status);
    if(!status){
      if(cap.supported===false)status='unsupported';
      else if(ownIssues.length)status='generation-error';
      else if(hasArtifact)status='generated';
      else status='missing-artifact';
    }
    const details=[
      clean(cap.reason),
      ...(Array.isArray(ready.reasons)?ready.reasons.map(clean):[]),
      ...ownIssues.map(x=>clean(x&&x.code)+(clean(x&&x.message)?': '+clean(x.message):''))
    ].filter(Boolean).join(' · ').replace(/\|/g,'\\|');
    lines.push(`| ${id} | ${clean(cap.vendor)||'—'} | ${clean(cap.kind)||'—'} | ${clean(cap.mode)||'—'} | ${status} | ${details||'—'} |`);
  }
  if(!ids.size)lines.push('| — | — | — | — | sin dispositivos | — |');
  return lines.join('\n')+'\n';
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
  add('generation-diagnostics','Diagnóstico de generación',generationDiagnosticsMarkdown(r),'private-generation-diagnostics.md','text/markdown;charset=utf-8');
  for(const [index,artifact] of (Array.isArray(r.artifacts)?r.artifacts:[]).entries()){
    if(!artifact||typeof artifact.content!=='string')continue;
    const path=clean(artifact.path)||('artifact-'+(index+1)+'.txt');
    if(path==='reports/private-production-gate.md'&&typeof r.productionGateSummaryMarkdown==='string')continue;
    add('artifact:'+index,path,artifact.content,path,clean(artifact.mime)||'text/plain;charset=utf-8');
  }
  return views;
}
function resultMatchesContext(remote){
  if(!lastResult)return false;
  if(lastResultMode==='self-hosted')return true;
  if(!lastResultContext||!remote||typeof remote.context!=='function')return false;
  const ctx=remote.context();
  return !!(ctx&&ctx.projectId===lastResultContext.projectId&&ctx.currentVersion===lastResultContext.currentVersion);
}
function clearResult(){
  lastResult=null;
  lastResultContext=null;
  lastResultMode='';
  lastResultStale=false;
  selectedKey='';
}
function markResultStale(){
  if(!lastResult)return;
  lastResultStale=true;
  selectedKey='generation-diagnostics';
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
  const capabilityMap=r.configCapabilities&&typeof r.configCapabilities==='object'?r.configCapabilities:{};
  const rawCapability=capabilityMap[id]&&typeof capabilityMap[id]==='object'?capabilityMap[id]:{};
  const capability={
    mode:clean(rawCapability.mode),
    supported:rawCapability.supported!==false,
    kind:clean(rawCapability.kind),
    certification:clean(rawCapability.certification),
    reason:clean(rawCapability.reason)
  };
  return {deviceId:id,vendor:clean(step&&step.vendor),path,content:artifact.content,mime:clean(artifact.mime)||'text/plain;charset=utf-8',readiness,capability};
}
function deviceStatusFromResult(result,deviceId,options){
  const r=result||{},id=clean(deviceId),opts=options||{};
  if(!id)return{status:'missing-device',reasons:['Dispositivo no disponible.'],issues:[],capability:null,artifact:null};
  if(!result)return{status:'pending',reasons:['Todavía no se ha ejecutado Private Engine para este proyecto.'],issues:[],capability:null,artifact:null};
  const capabilityMap=r.configCapabilities&&typeof r.configCapabilities==='object'?r.configCapabilities:{};
  const rawCapability=capabilityMap[id]&&typeof capabilityMap[id]==='object'?capabilityMap[id]:null;
  const capability=rawCapability?{
    vendor:clean(rawCapability.vendor),kind:clean(rawCapability.kind),mode:clean(rawCapability.mode),
    supported:rawCapability.supported!==false,certification:clean(rawCapability.certification),
    extension:clean(rawCapability.extension),reason:clean(rawCapability.reason)
  }:null;
  const ownIssues=(Array.isArray(r.issues)?r.issues:[]).filter(item=>clean(item&&item.deviceId)===id).map(item=>({
    code:clean(item&&item.code),severity:clean(item&&item.severity),blocking:item&&item.blocking===true,message:clean(item&&item.message)
  }));
  if(opts.stale){
    return{status:'stale',reasons:['El proyecto cambió después de la última generación. Regenera antes de usar la configuración.'],issues:ownIssues,capability,artifact:null,generatedAt:clean(r.generatedAt)};
  }
  const artifact=configArtifactForDevice(r,id);
  if(artifact){
    const ready=artifact.readiness||{},reasons=Array.isArray(ready.reasons)?ready.reasons.map(clean).filter(Boolean):[];
    return{status:clean(ready.status)||'generated',reasons,issues:ownIssues,capability:artifact.capability||capability,artifact,generatedAt:clean(r.generatedAt)};
  }
  if(capability&&capability.supported===false){
    return{status:'unsupported',reasons:[capability.reason||'La combinación vendor/tipo no está soportada.'],issues:ownIssues,capability,artifact:null,generatedAt:clean(r.generatedAt)};
  }
  if(ownIssues.length){
    return{status:'generation-error',reasons:ownIssues.map(x=>(x.code?x.code+': ':'')+(x.message||'Error de generación')).filter(Boolean),issues:ownIssues,capability,artifact:null,generatedAt:clean(r.generatedAt)};
  }
  const paths=r.configPaths&&typeof r.configPaths==='object'?r.configPaths:{};
  if(clean(paths[id])){
    return{status:'missing-artifact',reasons:['Private Engine calculó una ruta de configuración pero no devolvió el artefacto.'],issues:ownIssues,capability,artifact:null,generatedAt:clean(r.generatedAt)};
  }
  return{status:'not-generated',reasons:['El resultado privado no contiene datos de generación para este dispositivo.'],issues:ownIssues,capability,artifact:null,generatedAt:clean(r.generatedAt)};
}
function deviceStatus(deviceId){
  return deviceStatusFromResult(lastResult,deviceId,{stale:lastResultStale});
}
function deviceConfig(deviceId){
  if(!lastResult||lastResultStale)return null;
  return configArtifactForDevice(lastResult,deviceId);
}
function exportState(){
  const remote=root.NetWizardRemoteProject;
  const contextValid=lastResultMode!=='remote'||resultMatchesContext(remote);
  return{
    available:!!lastResult&&contextValid&&!lastResultStale,
    stale:!!lastResult&&lastResultStale,
    mode:lastResultMode,
    generatedAt:clean(lastResult&&lastResult.generatedAt),
    productionStatus:clean(lastResult&&lastResult.productionStatus),
    productionReady:!!(lastResult&&lastResult.productionReady),
    result:lastResult&&contextValid&&!lastResultStale?clone(lastResult):null
  };
}
function exportResult(){
  return exportState().result;
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
  const selfHostedAvailable=!!caps.selfHostedPrivateGeneration;
  const available=cloudAvailable||selfHostedAvailable;
  card.style.display=available?'':'none';
  if(!available){
    bindPrimaryGenerateAction({available:false,card});
    return false;
  }

  const mode=cloudAvailable?'remote':'self-hosted';
  const remote=root.NetWizardRemoteProject;
  const selfHosted=root.NetWizardSelfHostedPrivate;
  const ctx=remote&&typeof remote.context==='function'?remote.context():null;
  const localState=selfHosted&&typeof selfHosted.state==='function'?selfHosted.state():{authenticated:false};
  bindPrimaryGenerateAction({available:true,mode,authenticated:!!localState.authenticated,card});
  if(lastResult&&lastResultMode==='remote'&&!resultMatchesContext(remote))clearResult();

  card.textContent='';
  const head=el('div',{className:'card-h'});
  head.append(
    el('div',{className:'card-t'},mode==='remote'?'☁ Private Deployment Plan':'🔒 Private Engine self-hosted'),
    el('span',{className:'b bac'},mode==='remote'?(ctx?('v'+ctx.currentVersion):'sin contexto'):(localState.authenticated?'sesión activa':'bloqueado'))
  );
  card.appendChild(head);
  card.appendChild(el('div',{className:'hint'},mode==='remote'
    ? 'Sincroniza la revisión cloud y genera configuraciones, change set, plan incremental, runbook y rollback en el Private Engine. Las salidas son derivadas y no se guardan dentro del snapshot.'
    : 'Genera configuraciones y artefactos en el Private Engine del servidor. El navegador envía solo el snapshot 3.50 actual; los generadores vendor y las claves privadas no se publican al cliente.'));

  if(mode==='self-hosted'&&!localState.authenticated){
    const authRow=el('div',{className:'row'});
    const tokenCol=el('div');
    tokenCol.append(el('label',{className:'fl',for:'nwSelfHostedPrivateToken'},'Autorizar este navegador'));
    const tokenInput=el('input',{id:'nwSelfHostedPrivateToken',type:'password',autocomplete:'off',spellcheck:'false',placeholder:'Token de operador (solo alta inicial)'});
    tokenCol.appendChild(tokenInput);
    const actionCol=el('div');
    actionCol.append(el('label',{className:'fl'},'Navegador de confianza'));
    const unlock=el('button',{type:'button',className:'btn bp',id:'nwSelfHostedPrivateLogin'},'🔓 Autorizar y continuar');
    actionCol.appendChild(unlock);
    authRow.append(tokenCol,actionCol);
    card.appendChild(authRow);
    const status=el('div',{className:'co co-ac',id:'nwPrivateDeploymentStatus'},
      'El token se usa una sola vez para autorizar este navegador. La confianza queda en una cookie HttpOnly firmada, sobrevive a redeploys y no guarda el token en el proyecto ni en JavaScript.');
    card.appendChild(status);
    unlock.onclick=async()=>{
      if(!selfHosted||typeof selfHosted.login!=='function')return setStatus('Cliente self-hosted no disponible.','error');
      unlock.disabled=true;
      setStatus('Autorizando este navegador para Private Engine…','info');
      try{
        await selfHosted.login(tokenInput.value);
        tokenInput.value='';
        const shouldGenerate=pendingGenerateAfterLogin;
        pendingGenerateAfterLogin=false;
        render();
        if(shouldGenerate){
          const live=root.document&&root.document.getElementById('nwPrivateDeploymentGenerate');
          if(live&&!live.disabled)live.click();
        }
      }catch(err){
        pendingGenerateAfterLogin=false;
        tokenInput.value='';
        setStatus('No se pudo autorizar el navegador: '+(err&&err.message||'error desconocido')+'.','error');
        unlock.disabled=false;
      }
    };
    tokenInput.onkeydown=e=>{if(e.key==='Enter')unlock.click();};
    return true;
  }

  const actionRow=el('div',{className:'row'});
  const infoCol=el('div');
  infoCol.append(el('label',{className:'fl'},mode==='remote'?'Proyecto remoto':'Proyecto local'));
  infoCol.append(el('div',{className:'co co-ac',id:'nwPrivateDeploymentContext'},mode==='remote'
    ? (ctx?((ctx.name||ctx.projectId)+' · versión '+ctx.currentVersion):'Abre primero un proyecto cloud.')
    : 'Snapshot actual · schema 3.50.0 · generación efímera server-side'));
  const actionCol=el('div');
  actionCol.append(el('label',{className:'fl'},'Private Engine'));
  const generate=el('button',{type:'button',className:'btn bp',id:'nwPrivateDeploymentGenerate'},
    mode==='remote'?'☁ Sincronizar y generar deployment plan':'🔒 Generar en servidor');
  generate.disabled=mode==='remote'
    ? !(remote&&remote.canUsePrivateDeploymentPlan&&remote.canUsePrivateDeploymentPlan())
    : !(selfHosted&&typeof selfHosted.generateDeploymentPlan==='function'&&localState.authenticated);
  actionCol.appendChild(generate);
  if(mode==='self-hosted'){
    const lock=el('button',{type:'button',className:'btn bs bsm',id:'nwSelfHostedPrivateLogout',style:'margin-left:6px;'},'Revocar este navegador');
    actionCol.appendChild(lock);
    lock.onclick=async()=>{
      pendingGenerateAfterLogin=false;
      clearResult();
      if(root.NetWizardConfigView&&typeof root.NetWizardConfigView.refreshPrivateArtifacts==='function'){
        root.NetWizardConfigView.refreshPrivateArtifacts();
      }
      try{if(selfHosted&&typeof selfHosted.logout==='function')await selfHosted.logout();}finally{render();}
    };
  }
  actionRow.append(infoCol,actionCol);
  card.appendChild(actionRow);

  const status=el('div',{className:'co co-ac',id:'nwPrivateDeploymentStatus'});
  status.textContent=mode==='remote'
    ? (ctx?('Listo para generar desde la revisión remota '+ctx.currentVersion+'.'):'Abre un proyecto SaaS para activar el deployment privado.')
    : ('Navegador autorizado para Private Engine'+(localState.expiresAt?' hasta '+localState.expiresAt:'')+'.');
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

  if(lastResult&&lastResultMode===mode&&resultMatchesContext(remote)){
    renderResult(lastResult);
    const issueCount=Array.isArray(lastResult.issues)?lastResult.issues.length:0;
    const gateIssues=lastResult.productionGate&&Array.isArray(lastResult.productionGate.issues)?lastResult.productionGate.issues.length:0;
    const gateLabel=lastResult.productionStatus==='ready'?'LISTO':lastResult.productionStatus==='review'?'REVISIÓN':'BLOQUEADO';
    if(lastResultStale){
      setStatus('Resultado privado OBSOLETO: el proyecto cambió después de generar. Regenera antes de usar cualquier configuración.','error');
    }else{
      setStatus(
        lastResult.ok
          ? ('Deployment plan privado generado · Production Gate: '+gateLabel+' · '+(lastResult.artifacts||[]).length+' artefacto(s) · '+gateIssues+' incidencia(s) de gate.')
          : ('Deployment plan incompleto · Production Gate: '+gateLabel+' · '+issueCount+' incidencia(s) de generación. Revisa “Diagnóstico de generación”.'),
        lastResult.productionReady?'ok':(lastResult.productionStatus==='blocked'?'error':'info')
      );
    }
  }

  generate.onclick=async()=>{
    generate.disabled=true;
    clearResult();
    output.value='';select.disabled=true;copy.disabled=true;download.disabled=true;
    setStatus(mode==='remote'
      ? 'Sincronizando revisión y ejecutando Private Deployment Plan…'
      : 'Validando snapshot y ejecutando Private Engine en el servidor…','info');
    try{
      let result=null,latest=null;
      if(mode==='remote'){
        if(!remote||typeof remote.syncAndGenerateDeploymentPlan!=='function')throw new Error('Cliente SaaS remoto no disponible');
        result=await remote.syncAndGenerateDeploymentPlan();
        latest=remote.context();
      }else{
        if(!selfHosted||typeof selfHosted.generateDeploymentPlan!=='function')throw new Error('Cliente self-hosted no disponible');
        result=await selfHosted.generateDeploymentPlan();
      }
      lastResult=result;
      lastResultMode=mode;
      lastResultStale=false;
      lastResultContext=mode==='remote'&&latest?{projectId:latest.projectId,currentVersion:latest.currentVersion}:null;
      selectedKey='';
      render();
      if(root.NetWizardConfigView&&typeof root.NetWizardConfigView.refreshPrivateArtifacts==='function'){
        root.NetWizardConfigView.refreshPrivateArtifacts();
      }
    }catch(err){
      const conflict=mode==='remote'&&err&&[409,412].includes(err.status);
      const suffix=conflict?' Recarga el proyecto cloud antes de reintentar.':'';
      setStatus('No se pudo generar el deployment plan privado: '+(err&&err.message||'error desconocido')+'.'+suffix,'error');
    }finally{
      const live=root.document.getElementById('nwPrivateDeploymentGenerate');
      if(live)live.disabled=mode==='remote'
        ? !(remote&&remote.canUsePrivateDeploymentPlan&&remote.canUsePrivateDeploymentPlan())
        : !(selfHosted&&typeof selfHosted.state==='function'&&selfHosted.state().authenticated);
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
  const active=()=>root.document.getElementById('pg-cfg')?.classList.contains('on');
  const rerender=()=>{if(!active())return;try{render();}catch(err){if(root.console)root.console.error('NetWizard private deployment UI',err);}};
  const remoteChanged=()=>rerender();
  root.addEventListener&&root.addEventListener('nw:auth:changed',rerender);
  root.addEventListener&&root.addEventListener('nw:remote-project:changed',remoteChanged);
  root.addEventListener&&root.addEventListener('nw:self-hosted-private:changed',rerender);
  root.document.addEventListener&&root.document.addEventListener('nw:project:changed',()=>{
    markResultStale();
    if(!active())return;
    rerender();
    if(root.NetWizardConfigView&&typeof root.NetWizardConfigView.refreshPrivateArtifacts==='function'){
      root.NetWizardConfigView.refreshPrivateArtifacts();
    }
  });
  root.document.addEventListener('nw:view:changed',event=>{if(event.detail?.step==='cfg')rerender();});
  if(root.document.readyState==='loading')root.document.addEventListener('DOMContentLoaded',rerender,{once:true});else rerender();
  return true;
}

const api={version:'netwizard-private-deployment-ui-v4',viewsFor,generationDiagnosticsMarkdown,configArtifactForDevice,deviceStatusFromResult,deviceStatus,deviceConfig,exportState,exportResult,bindPrimaryGenerateAction,render,install,clearResult};
root.NetWizardPrivateDeploymentUi=api;
if(typeof module!=='undefined'&&module.exports)module.exports=api;
if(root.document)install();
})(typeof window!=='undefined'?window:globalThis);
