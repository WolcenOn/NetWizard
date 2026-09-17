/* =========================================================
   NetWizard Observed Config UI v3.50
   Captura configuración real por dispositivo y previsualiza
   change set + candidato incremental sin relajar el bundle global.
========================================================= */
(function initNetWizardObservedConfigUi(root){
  'use strict';

  const MAX_CONFIG_CHARS=262144;
  function arr(value){return Array.isArray(value)?value:[];}
  function obj(value){return value&&typeof value==='object'&&!Array.isArray(value)?value:{};}
  function clone(value){return JSON.parse(JSON.stringify(value==null?{}:value));}
  function clean(value,max){return String(value==null?'':value).replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g,'').trim().slice(0,max||200);}
  function normalizeConfig(value){return String(value==null?'':value).replace(/\r\n?/g,'\n').replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g,'').replace(/\n+$/,'');}
  function safeName(value,fallback){const source=clean(value,120);const ascii=source.normalize?source.normalize('NFD').replace(/[\u0300-\u036f]/g,''):source;return ascii.replace(/[^A-Za-z0-9_.-]+/g,'-').replace(/^[.-]+|[.-]+$/g,'').slice(0,100)||fallback||'device';}
  function iso(value){const date=new Date(value);return Number.isFinite(date.getTime())?date.toISOString():null;}
  function latestObservedAt(configs,fallback){const values=Object.values(obj(configs)).map(entry=>iso(obj(entry).capturedAt)).filter(Boolean).sort();return values.at(-1)||iso(fallback)||null;}
  function snapshotForDevice(project,deviceId){return obj(obj(obj(project).observedState).deviceConfigs)[clean(deviceId,120)]||null;}

  function upsertSnapshot(project,deviceId,input){
    const next=clone(project),id=clean(deviceId,120),device=arr(next.devices).find(item=>clean(item&&item.id,120)===id),data=obj(input);
    if(!device)throw new Error('El dispositivo seleccionado no existe.');
    const content=normalizeConfig(data.content);if(!content)throw new Error('La configuración observada está vacía.');
    if(content.length>MAX_CONFIG_CHARS)throw new Error(`La captura supera el límite de ${MAX_CONFIG_CHARS} caracteres por dispositivo.`);
    const capturedAt=iso(data.capturedAt||new Date().toISOString());if(!capturedAt)throw new Error('La fecha de captura no es válida.');
    const observed=Object.assign({},obj(next.observedState)),configs=Object.assign({},obj(observed.deviceConfigs));
    configs[id]={vendor:clean(device.vendorOs,80)||'generic_network',capturedAt,source:clean(data.source,160)||'manual-ui',content,contentTruncated:false};
    observed.deviceConfigs=configs;observed.observedAt=latestObservedAt(configs,capturedAt);observed.source=clean(observed.source,160)||'manual-ui';observed.deviceConfigsTruncated=false;
    next.observedState=observed;
    const maxAge=Number(data.maxObservedAgeHours);next.deployment=Object.assign({},obj(next.deployment),{changeMode:'incremental',maxObservedAgeHours:Number.isFinite(maxAge)&&maxAge>=1?maxAge:24,requireExecutableIncremental:data.requireExecutableIncremental===true});
    return next;
  }

  function removeSnapshot(project,deviceId){
    const next=clone(project),observed=Object.assign({},obj(next.observedState)),configs=Object.assign({},obj(observed.deviceConfigs));delete configs[clean(deviceId,120)];observed.deviceConfigs=configs;
    observed.observedAt=latestObservedAt(configs,null);if(!Object.keys(configs).length&&Object.keys(observed).every(key=>['deviceConfigs','observedAt','source','deviceConfigsTruncated'].includes(key)))next.observedState=null;else next.observedState=observed;
    return next;
  }

  function buildDevicePreview(project,deviceId,options){
    const p=clone(project),opts=obj(options),id=clean(deviceId,120),device=arr(p.devices).find(item=>clean(item&&item.id,120)===id);
    if(!device)return{ok:false,status:'blocked',issues:[{code:'NW-OBS-UI-001',blocking:true,message:'El dispositivo seleccionado no existe.'}],candidate:'',rollback:''};
    const changeSetApi=opts.changeSet||root.NetWizardChangeSet,incrementalApi=opts.incremental||root.NetWizardIncrementalGenerators,generate=opts.generateConfig||root.genConfig;
    if(!changeSetApi||typeof changeSetApi.buildChangeSet!=='function'||!incrementalApi||typeof incrementalApi.buildPlan!=='function'||typeof generate!=='function')return{ok:false,status:'blocked',issues:[{code:'NW-OBS-UI-002',blocking:true,message:'El runtime incremental todavía no está disponible.'}],candidate:'',rollback:''};
    let desired='';try{desired=normalizeConfig(generate(id,clean(device.vendorOs,80)||undefined,p));}catch(error){return{ok:false,status:'blocked',issues:[{code:'NW-OBS-UI-003',blocking:true,message:`No se pudo generar el objetivo: ${error&&error.message||error}`}],candidate:'',rollback:''};}
    if(!desired)return{ok:false,status:'blocked',issues:[{code:'NW-OBS-UI-004',blocking:true,message:'El generador no produjo una configuración objetivo.'}],candidate:'',rollback:''};
    const previewProject=clone(p),snapshot=snapshotForDevice(p,id);previewProject.devices=[clone(device)];previewProject.observedState=Object.assign({},obj(previewProject.observedState),{deviceConfigs:snapshot?{[id]:clone(snapshot)}:{}});previewProject.deployment=Object.assign({},obj(previewProject.deployment),{changeMode:'incremental'});
    const generatedAt=iso(opts.generatedAt)||new Date().toISOString(),vendor=clean(device.vendorOs,80),extension=vendor==='juniper_junos'?'set':vendor==='fortinet'?'conf':vendor==='mikrotik_routeros'?'rsc':'cfg',configPaths={[id]:`configs/${safeName(device.name,id)}.${extension}`},desiredConfigs={[id]:desired};
    const changeSet=changeSetApi.buildChangeSet(previewProject,{generatedAt,configPaths,desiredConfigs}),changeIssues=arr(changeSet&&changeSet.issues);
    if(!changeSet||changeSet.ok===false)return{ok:false,status:'blocked',device,desired,changeSet,incrementalPlan:null,issues:changeIssues,candidate:'',rollback:'',applyFilename:null,rollbackFilename:null};
    const incrementalPlan=incrementalApi.buildPlan(previewProject,{generatedAt,changeSet,configPaths,desiredConfigs}),planDevice=arr(incrementalPlan&&incrementalPlan.devices).find(item=>item.deviceId===id)||{},artifacts=arr(incrementalPlan&&incrementalPlan.artifacts),apply=artifacts.find(file=>file.path===planDevice.applyPath),rollback=artifacts.find(file=>file.path===planDevice.rollbackPath),issues=changeIssues.concat(arr(incrementalPlan&&incrementalPlan.issues));
    return{ok:!!(incrementalPlan&&incrementalPlan.ok),status:planDevice.status||'blocked',device,desired,changeSet,incrementalPlan,planDevice,issues,candidate:apply&&apply.content||'',rollback:rollback&&rollback.content||'',applyFilename:planDevice.applyPath&&planDevice.applyPath.split('/').pop()||null,rollbackFilename:planDevice.rollbackPath&&planDevice.rollbackPath.split('/').pop()||null};
  }

  function localDateTimeValue(value){const date=new Date(value||Date.now());if(!Number.isFinite(date.getTime()))return'';const offset=date.getTimezoneOffset()*60000;return new Date(date.getTime()-offset).toISOString().slice(0,16);}
  function downloadText(filename,content){if(!root.document||!content)return false;const blob=new Blob([content],{type:'text/plain;charset=utf-8'}),url=URL.createObjectURL(blob),link=root.document.createElement('a');link.href=url;link.download=filename;root.document.body.appendChild(link);link.click();link.remove();root.setTimeout(()=>URL.revokeObjectURL(url),1000);return true;}
  function statusText(result){
    const labels={'candidate-ready':'✅ Candidato incremental seguro','no-change':'✅ Sin cambios','manual-review':'⚠ Revisión manual necesaria',blocked:'⛔ Preflight bloqueado','full-target':'ℹ Configuración completa'};const device=obj(result&&result.planDevice),change=obj(result&&result.changeSet),lines=[labels[result&&result.status]||labels.blocked];
    if(change.coverage)lines.push(`Captura: ${change.coverage.observed}/${change.coverage.devices} · cambios: ${change.coverage.changed} · antigüedad máxima: ${change.maxObservedAgeHours} h`);
    if(device.adapterId)lines.push(`Adaptador: ${device.adapterId} · comandos +${obj(device.commandCounts).additions||0} / -${obj(device.commandCounts).deletions||0}`);
    for(const item of arr(result&&result.issues))lines.push(`[${item.code||'NW'}] ${item.message||item}`);return lines.join('\n');
  }

  function bindBrowserUi(attempt){
    if(!root.document)return false;const byId=id=>root.document.getElementById(id),select=byId('observedDevice'),textarea=byId('observedConfig'),saveButton=byId('observedSave'),removeButton=byId('observedRemove'),preflightButton=byId('observedPreflight');
    if(!select||!textarea||!saveButton||!removeButton||!preflightButton||!root.NetWizardState){if((attempt||0)<40&&root.setTimeout)root.setTimeout(()=>bindBrowserUi((attempt||0)+1),100);return false;}
    const source=byId('observedSource'),capturedAt=byId('observedCapturedAt'),maxAge=byId('observedMaxAge'),strict=byId('observedRequireExecutable'),status=byId('observedStatus'),candidate=byId('observedCandidate'),rollback=byId('observedRollback'),downloadCandidate=byId('observedDownloadCandidate'),downloadRollback=byId('observedDownloadRollback');let lastPreview=null,refreshing=false;
    function selectedId(){return clean(select.value,120);}
    function renderDevices(){const project=root.NetWizardState.getSnapshot(),previous=selectedId(),devices=arr(project.devices).slice().sort((a,b)=>String(a.name||a.id).localeCompare(String(b.name||b.id)));select.textContent='';for(const device of devices){const option=root.document.createElement('option');option.value=device.id;option.textContent=`${device.name||device.id} · ${device.vendorOs||'sin vendor'}`;select.appendChild(option);}if(devices.some(device=>device.id===previous))select.value=previous;loadSnapshot();}
    function loadSnapshot(){if(refreshing)return;refreshing=true;const project=root.NetWizardState.getSnapshot(),entry=snapshotForDevice(project,selectedId()),deployment=obj(project.deployment);textarea.value=entry&&entry.content||'';source.value=entry&&entry.source||'manual-ui';capturedAt.value=localDateTimeValue(entry&&entry.capturedAt||Date.now());maxAge.value=String(Number(deployment.maxObservedAgeHours)>=1?Number(deployment.maxObservedAgeHours):24);strict.checked=deployment.requireExecutableIncremental===true;status.textContent=entry?'Captura cargada. Ejecuta el preflight para calcular el delta.':'Sin captura observada para este dispositivo.';candidate.value='';rollback.value='';lastPreview=null;downloadCandidate.disabled=true;downloadRollback.disabled=true;refreshing=false;}
    function formProject(){return upsertSnapshot(root.NetWizardState.getSnapshot(),selectedId(),{content:textarea.value,source:source.value,capturedAt:capturedAt.value,maxObservedAgeHours:maxAge.value,requireExecutableIncremental:strict.checked});}
    function preview(project){const result=buildDevicePreview(project,selectedId());lastPreview=result;status.textContent=statusText(result);candidate.value=result.candidate||'';rollback.value=result.rollback||'';downloadCandidate.disabled=!result.candidate;downloadRollback.disabled=!result.rollback;return result;}
    select.addEventListener('change',loadSnapshot);
    saveButton.addEventListener('click',()=>{try{const project=formProject();root.NetWizardState.replaceProject(project,{source:'observed-config-ui',skipRefresh:true});preview(root.NetWizardState.getSnapshot());}catch(error){status.textContent=`⛔ ${error&&error.message||error}`;}});
    preflightButton.addEventListener('click',()=>{try{preview(formProject());}catch(error){status.textContent=`⛔ ${error&&error.message||error}`;candidate.value='';rollback.value='';}});
    removeButton.addEventListener('click',()=>{const id=selectedId();if(!id)return;if(root.confirm&&!root.confirm('¿Eliminar la captura observada de este dispositivo?'))return;root.NetWizardState.replaceProject(removeSnapshot(root.NetWizardState.getSnapshot(),id),{source:'observed-config-ui-remove',skipRefresh:true});loadSnapshot();});
    downloadCandidate.addEventListener('click',()=>{if(lastPreview&&lastPreview.candidate)downloadText(lastPreview.applyFilename||`${safeName(selectedId(),'device')}-candidate.cfg`,lastPreview.candidate);});
    downloadRollback.addEventListener('click',()=>{if(lastPreview&&lastPreview.rollback)downloadText(lastPreview.rollbackFilename||`${safeName(selectedId(),'device')}-rollback.cfg`,lastPreview.rollback);});
    root.document.addEventListener('nw:project:changed',event=>{if(event&&event.detail&&String(event.detail.source||'').startsWith('observed-config-ui'))return;renderDevices();});renderDevices();root.__netwizardObservedConfigUiBound=true;return true;
  }

  const api={version:'netwizard-observed-config-ui-v3.50',MAX_CONFIG_CHARS,snapshotForDevice,upsertSnapshot,removeSnapshot,buildDevicePreview,statusText,localDateTimeValue,downloadText,bindBrowserUi};root.NetWizardObservedConfigUi=api;
  if(typeof module!=='undefined'&&module.exports)module.exports=api;
  if(root.document){if(root.document.readyState==='loading')root.document.addEventListener('DOMContentLoaded',()=>bindBrowserUi(0));else bindBrowserUi(0);}
})(typeof window!=='undefined'?window:globalThis);
