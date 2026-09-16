/* =========================================================
   NetWizard Change Set v3.50
   Compara configuraciones observadas con el estado deseado generado.

   Los parches son evidencia para revisión. No se presentan como comandos
   ejecutables porque la semántica de borrado depende del fabricante/contexto.
========================================================= */
(function initNetWizardChangeSet(root){
  'use strict';

  const FORMAT='netwizard-change-set';
  const VERSION='3.50.0';
  function arr(value){return Array.isArray(value)?value:[];}
  function obj(value){return value&&typeof value==='object'&&!Array.isArray(value)?value:{};}
  function clean(value,max){return String(value==null?'':value).replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g,'').trim().slice(0,max||200);}
  function normalizeConfig(value){return String(value==null?'':value).replace(/\r\n?/g,'\n').split('\n').map(line=>line.replace(/[ \t]+$/,'')).join('\n').replace(/\n+$/,'');}
  function lines(value){const normalized=normalizeConfig(value);return normalized?normalized.split('\n'):[];}
  function issue(code,message,blocking,extra){return Object.assign({code,severity:blocking?'error':'warning',blocking:!!blocking,category:'change-set',source:'change-set',message},extra||{});}
  function safeName(value,fallback){const source=clean(value,120);const ascii=source.normalize?source.normalize('NFD').replace(/[\u0300-\u036f]/g,''):source;return ascii.replace(/[^A-Za-z0-9_.-]+/g,'-').replace(/^[.-]+|[.-]+$/g,'').slice(0,100)||fallback||'device';}
  function fingerprint(value){let hash=0x811c9dc5;const text=normalizeConfig(value);for(let i=0;i<text.length;i++){hash^=text.charCodeAt(i);hash=Math.imul(hash,0x01000193)>>>0;}return `fnv1a32:${hash.toString(16).padStart(8,'0')}`;}
  function countLines(values){const counts=new Map();for(const line of values)counts.set(line,(counts.get(line)||0)+1);return counts;}
  function deltaStats(before,after){
    const oldLines=lines(before),newLines=lines(after),oldCounts=countLines(oldLines),newCounts=countLines(newLines);let added=0,removed=0;
    for(const [line,count] of newCounts)added+=Math.max(0,count-(oldCounts.get(line)||0));
    for(const [line,count] of oldCounts)removed+=Math.max(0,count-(newCounts.get(line)||0));
    return{beforeLines:oldLines.length,afterLines:newLines.length,addedLines:added,removedLines:removed,changed:normalizeConfig(before)!==normalizeConfig(after)};
  }
  function commonEdges(before,after){
    const left=lines(before),right=lines(after);let prefix=0,suffix=0;
    while(prefix<left.length&&prefix<right.length&&left[prefix]===right[prefix])prefix++;
    while(suffix<left.length-prefix&&suffix<right.length-prefix&&left[left.length-1-suffix]===right[right.length-1-suffix])suffix++;
    return{left,right,prefix,suffix};
  }
  function unifiedPatch(before,after,beforeLabel,afterLabel){
    const diff=commonEdges(before,after);if(diff.prefix===diff.left.length&&diff.prefix===diff.right.length)return'';
    const oldBody=diff.left.slice(diff.prefix,diff.left.length-diff.suffix),newBody=diff.right.slice(diff.prefix,diff.right.length-diff.suffix);
    const oldStart=diff.prefix+1,newStart=diff.prefix+1;
    const out=[`--- ${beforeLabel}`,`+++ ${afterLabel}`,`@@ -${oldStart},${oldBody.length} +${newStart},${newBody.length} @@`];
    for(const line of oldBody)out.push(`-${line}`);for(const line of newBody)out.push(`+${line}`);return out.join('\n')+'\n';
  }
  function observedConfigMap(snapshot){
    const raw=snapshot&&snapshot.deviceConfigs,map=new Map();
    if(Array.isArray(raw)){for(const entry of raw){const id=clean(entry&&entry.deviceId,120);if(id)map.set(id,obj(entry));}}
    else for(const [id,entry] of Object.entries(obj(raw)))map.set(clean(id,120),typeof entry==='string'?{content:entry}:obj(entry));
    return map;
  }
  function desiredConfigMap(value){if(value instanceof Map)return value;return new Map(Object.entries(obj(value)));}
  function hoursBetween(later,earlier){const a=new Date(later).getTime(),b=new Date(earlier).getTime();return Number.isFinite(a)&&Number.isFinite(b)?(a-b)/3600000:null;}
  function publicChangeSet(changeSet){const copy=JSON.parse(JSON.stringify(changeSet||{}));delete copy.artifacts;return copy;}

  function buildChangeSet(project,options){
    const p=obj(project),opts=obj(options),deployment=obj(p.deployment),requestedMode=clean(deployment.changeMode||opts.changeMode||'full',30).toLowerCase();
    const mode=requestedMode==='incremental'?'incremental':'full';const generatedAt=clean(opts.generatedAt,80)||new Date().toISOString();
    const maxAge=Math.max(1,Number(deployment.maxObservedAgeHours||opts.maxObservedAgeHours||24));
    const observed=obj(p.observedState),observedMap=observedConfigMap(observed),desiredMap=desiredConfigMap(opts.desiredConfigs),configPaths=obj(opts.configPaths);
    const issues=[],devices=[],artifacts=[],deviceList=arr(p.devices);
    if(observed.deviceConfigsTruncated)issues.push(issue('NW-CHANGE-006','El conjunto de configuraciones observadas fue truncado durante la importación.',true));
    for(let index=0;index<deviceList.length;index++){
      const device=deviceList[index],deviceId=clean(device&&device.id,120),deviceName=clean(device&&device.name,120)||deviceId,vendor=clean(device&&device.vendorOs,80)||'generic_network';
      const desired=normalizeConfig(desiredMap.get(deviceId));const snapshot=observedMap.get(deviceId);const observedContent=normalizeConfig(snapshot&&snapshot.content);const hasObserved=!!(snapshot&&observedContent);
      const capturedAt=clean(snapshot&&snapshot.capturedAt||observed.observedAt,80)||null;const ageHours=capturedAt?hoursBetween(generatedAt,capturedAt):null;const blocking=mode==='incremental';
      if(!hasObserved)issues.push(issue('NW-CHANGE-001',`${deviceName}: no existe configuración observada; no puede calcularse un delta fiable.`,blocking,{deviceId}));
      if(hasObserved&&!capturedAt)issues.push(issue('NW-CHANGE-002',`${deviceName}: la configuración observada no tiene capturedAt/observedAt.`,blocking,{deviceId}));
      if(hasObserved&&ageHours!=null&&ageHours>maxAge)issues.push(issue('NW-CHANGE-003',`${deviceName}: el snapshot tiene ${Math.floor(ageHours)} h y supera el máximo de ${maxAge} h.`,blocking,{deviceId,ageHours}));
      const observedVendor=clean(snapshot&&snapshot.vendor,80);if(hasObserved&&observedVendor&&observedVendor!==vendor)issues.push(issue('NW-CHANGE-004',`${deviceName}: el snapshot es ${observedVendor}, pero el diseño requiere ${vendor}.`,blocking,{deviceId}));
      if(snapshot&&snapshot.contentTruncated)issues.push(issue('NW-CHANGE-005',`${deviceName}: la configuración observada fue truncada durante la importación.`,true,{deviceId}));
      if(!desired)issues.push(issue('NW-CHANGE-008',`${deviceName}: no existe configuración objetivo para construir el change set.`,true,{deviceId}));
      const stats=hasObserved?deltaStats(observedContent,desired):{beforeLines:0,afterLines:lines(desired).length,addedLines:lines(desired).length,removedLines:0,changed:true};
      const stem=`${String(index+1).padStart(2,'0')}-${safeName(deviceName,'device')}-${safeName(deviceId,'id')}`;let patchPath=null,rollbackPatchPath=null;
      if(hasObserved&&stats.changed){patchPath=`changes/patches/${stem}.diff`;rollbackPatchPath=`changes/rollback/${stem}.diff`;artifacts.push({path:patchPath,content:unifiedPatch(observedContent,desired,`observed/${deviceId}`,`desired/${deviceId}`)});artifacts.push({path:rollbackPatchPath,content:unifiedPatch(desired,observedContent,`desired/${deviceId}`,`observed/${deviceId}`)});}
      devices.push({deviceId,deviceName,vendor,status:!hasObserved?'baseline-required':(stats.changed?'change-required':'no-change'),applyMode:hasObserved?'reviewed-target':'full-target',configPath:configPaths[deviceId]||null,patchPath,rollbackPatchPath,capturedAt,ageHours:ageHours==null?null:Math.max(0,Number(ageHours.toFixed(2))),observedFingerprint:hasObserved?fingerprint(observedContent):null,desiredFingerprint:fingerprint(desired),stats});
    }
    const blockingIssues=issues.filter(item=>item.blocking),covered=devices.filter(item=>item.capturedAt&&item.observedFingerprint).length,changed=devices.filter(item=>item.status==='change-required').length;
    return{ok:blockingIssues.length===0,format:FORMAT,version:VERSION,generatedAt,projectName:clean(p.projName,160),requestedMode:mode,executionMode:mode==='incremental'?'reviewed-incremental':'full-target',maxObservedAgeHours:maxAge,observedAt:clean(observed.observedAt,80)||null,coverage:{devices:devices.length,observed:covered,missing:devices.length-covered,changed,noChange:devices.filter(item=>item.status==='no-change').length},issues,devices,artifacts,warning:'Los archivos .diff son evidencia de revisión y rollback; no son comandos para aplicar directamente.'};
  }
  function list(items){return arr(items).map(item=>`- [ ] ${item}`).join('\n')||'- [ ] Sin elementos.';}
  function buildSummaryMarkdown(changeSet){
    const c=obj(changeSet),out=[`# Change set — ${c.projectName||'NetWizard'}`,'',`- Modo solicitado: **${c.requestedMode||'full'}**`,`- Modo de ejecución: **${c.executionMode||'full-target'}**`,`- Snapshot observado: ${c.observedAt||'no disponible'}`,`- Cobertura: ${c.coverage&&c.coverage.observed||0}/${c.coverage&&c.coverage.devices||0} dispositivos`,`- Dispositivos con cambios: ${c.coverage&&c.coverage.changed||0}`,'',`> ${c.warning||''}`,'','## Dispositivos',''];
    for(const d of arr(c.devices)){out.push(`### ${d.deviceName} (${d.vendor})`,'',`- Estado: **${d.status}**`,`- Líneas añadidas/eliminadas: +${d.stats&&d.stats.addedLines||0} / -${d.stats&&d.stats.removedLines||0}`,`- Configuración objetivo: ${d.configPath?`\`${d.configPath}\``:'no disponible'}`,`- Diff de revisión: ${d.patchPath?`\`${d.patchPath}\``:'no disponible'}`,`- Diff inverso: ${d.rollbackPatchPath?`\`${d.rollbackPatchPath}\``:'no disponible'}`,'');}
    if(arr(c.issues).length)out.push('## Incidencias','',...c.issues.map(item=>`- [${item.code}] ${item.message}`),'');return out.join('\n')+'\n';
  }
  function buildPostChangeChecklist(changeSet,deploymentPlan){
    const c=obj(changeSet),plan=obj(deploymentPlan),items=['Registrar hora, operador y ticket del cambio.','Capturar una nueva configuración observada para cada equipo modificado.','Comparar fingerprints y conservar el snapshot posterior.'];
    for(const target of arr(obj(plan).postchecks))items.push(target);return[`# Evidencias posteriores — ${c.projectName||'NetWizard'}`,'',`Generado: ${c.generatedAt||''}`,'','## Checklist',list(items),'','## Resultado por dispositivo','',...arr(c.devices).map(d=>`- [ ] ${d.deviceName}: estado, conectividad y configuración verificados (${d.status}).`),''].join('\n');
  }
  const api={version:'netwizard-change-set-v3.50',format:FORMAT,buildChangeSet,buildSummaryMarkdown,buildPostChangeChecklist,publicChangeSet,unifiedPatch,deltaStats,fingerprint,normalizeConfig};
  root.NetWizardChangeSet=api;if(typeof module!=='undefined'&&module.exports)module.exports=api;
})(typeof window!=='undefined'?window:globalThis);
