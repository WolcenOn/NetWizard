/* =========================================================
   NetWizard Deployment Bundle v3.50
   Construye un ZIP autocontenido para revisión y despliegue.

   La exportación siempre ejecuta la puerta estricta de producción. Los avisos
   quedan documentados, pero cualquier error bloqueante impide crear el ZIP.
========================================================= */
(function initNetWizardDeploymentBundle(root){
  'use strict';

  const FORMAT='netwizard-deployment-bundle';
  const VERSION='3.50.0';
  const MAX_DEVICES=1000;
  const MAX_ENTRY_BYTES=16*1024*1024;
  const MAX_PACKAGE_BYTES=128*1024*1024;
  const UNSUPPORTED_OUTPUT=/Sin vendor asignado|vendor (?:no )?asignado|not implemented|no implementado|unsupported vendor/i;
  const CONFIG_EXTENSIONS={
    cisco_ios:'cfg',cisco_asa:'cfg',fortinet:'conf',juniper_junos:'set',aruba_aoss:'cfg',
    mikrotik_routeros:'rsc',huawei_vrp:'cfg',pfsense:'txt',ubiquiti_unifi:'md',
    tplink_omada:'md',galgus_cloud:'md',windows:'ps1',linux:'sh',generic_network:'txt'
  };

  function arr(value){ return Array.isArray(value) ? value : []; }
  function obj(value){ return value && typeof value==='object' && !Array.isArray(value) ? value : {}; }
  function clone(value){ return JSON.parse(JSON.stringify(value == null ? null : value)); }
  function clean(value,max){ return String(value == null ? '' : value).replace(/[\u0000-\u001F\u007F]/g,' ').trim().slice(0,max||200); }
  function normalizeText(value){ return String(value == null ? '' : value).replace(/\r\n?/g,'\n'); }
  function isoDate(value){ const date=value instanceof Date?value:new Date(value||Date.now()); return Number.isNaN(date.getTime())?new Date().toISOString():date.toISOString(); }
  function safeName(value,fallback){
    const source=clean(value,120);
    const ascii=source.normalize?source.normalize('NFD').replace(/[\u0300-\u036f]/g,''):source;
    return ascii.replace(/[^A-Za-z0-9_.-]+/g,'-').replace(/^[.-]+|[.-]+$/g,'').slice(0,100)||fallback||'netwizard';
  }
  function safePath(value){
    return String(value||'').split('/').map(part=>safeName(part,'file')).filter(Boolean).join('/').replace(/^\/+/, '');
  }
  function bytes(value){ return value instanceof Uint8Array?value:new TextEncoder().encode(normalizeText(value)); }
  function hex32(value){ return (value>>>0).toString(16).padStart(8,'0'); }

  const CRC_TABLE=(()=>{ const table=new Uint32Array(256); for(let n=0;n<256;n++){let c=n;for(let k=0;k<8;k++)c=(c&1)?(0xEDB88320^(c>>>1)):(c>>>1);table[n]=c>>>0;}return table; })();
  function crc32(input){ let crc=0xFFFFFFFF; for(const byte of bytes(input)) crc=CRC_TABLE[(crc^byte)&0xFF]^(crc>>>8); return (crc^0xFFFFFFFF)>>>0; }

  function configExtension(vendor){ return CONFIG_EXTENSIONS[clean(vendor,80).toLowerCase()]||'txt'; }
  function configPath(device,index){
    const vendor=clean(device&&device.vendorOs,80).toLowerCase()||'generic';
    const order=String(index+1).padStart(2,'0');
    return `configs/${order}-${safeName(device&&device.name,'device')}-${safeName(device&&device.id,'id')}-${safeName(vendor,'generic')}.${configExtension(vendor)}`;
  }
  function addFile(files,path,content,mime){
    const normalized=safePath(path);
    if(!normalized || files.some(file=>file.path===normalized)) throw new Error(`Ruta duplicada o inválida en bundle: ${path}`);
    const data=bytes(content);
    if(data.length>MAX_ENTRY_BYTES) throw new Error(`El archivo ${normalized} supera el límite de ${MAX_ENTRY_BYTES} bytes.`);
    files.push({path:normalized,content:normalizeText(content),mime:mime||'text/plain;charset=utf-8',bytes:data.length,crc32:hex32(crc32(data))});
  }
  function dependency(options,key,globalName){ return options&&options[key] || root[globalName] || null; }
  function gateIssue(code,message,extra){ return Object.assign({code,severity:'error',blocking:true,category:'deployment-bundle',source:'deployment-bundle',message},extra||{}); }
  function compareText(a,b){ const left=clean(a,120),right=clean(b,120); return left<right?-1:(left>right?1:0); }

  function buildReadme(project,report,generatedAt,configFiles,changeSet,incrementalPlan){
    const lines=[
      `# Paquete de despliegue — ${clean(project.projName,160)||'NetWizard'}`,'',
      `- Formato: ${FORMAT} ${VERSION}`,
      `- Generado: ${generatedAt}`,
      `- Estado de producción: ${String(report.status||'unknown').toUpperCase()}`,
      `- Dispositivos configurados: ${configFiles.length}`,
      `- Avisos: ${(report.counts&&report.counts.warnings||0)+arr(changeSet&&changeSet.issues).filter(item=>item.severity==='warning').length+arr(incrementalPlan&&incrementalPlan.issues).filter(item=>item.severity==='warning').length}`,'',
      '## Contenido','',
      '- `project/netwizard-project.json`: snapshot saneado y versionado.',
      '- `configs/`: configuración generada para cada dispositivo.',
      '- `reports/production-gate.json`: resultado estructurado de la validación.',
      '- `reports/production-checklist.md`: checklist y correcciones.',
      '- `reports/inventory.csv`: inventario operativo.',
      '- `reports/connectivity-matrix.csv`: intención de conectividad entre VLANs.',
      '- `reports/documentation.md`: documentación completa del diseño.',
      '- `deployment/plan.json`: orden estructurado y dependencias del cambio.',
      '- `deployment/runbook.md`: procedimiento ejecutable con prechecks y validaciones.',
      '- `deployment/rollback-checklist.md`: reversión en orden inverso.',
      '- `changes/change-set.json`: comparación estructurada entre configuración observada y objetivo.',
      '- `changes/summary.md`: resumen humano de cobertura y diferencias.',
      '- `changes/patches/`: diffs de revisión; no son comandos ejecutables.',
      '- `changes/rollback/`: diffs inversos para apoyar la reversión.',
      '- `incremental/plan.json`: decisión del registro de adaptadores por equipo.',
      '- `incremental/summary.md`: candidatos ejecutables y revisiones manuales.',
      '- `incremental/commands/`: comandos cargables solo cuando el adaptador los certifica.',
      '- `incremental/rollback/`: comandos inversos candidatos; el backup real sigue siendo autoritativo.',
      '- `evidence/pre-change.json`: fingerprints y metadatos del snapshot previo.',
      '- `evidence/post-change-checklist.md`: evidencias que deben capturarse tras el cambio.',
      '- `manifest.json`: índice y CRC32 de cada archivo de payload.','',
      '## Uso seguro','',
      '1. Revisa los avisos y el checklist.',
      '2. Compara cada configuración con el estado real del equipo.',
      '3. Prueba en laboratorio y conserva un backup del dispositivo.',
      '4. Aplica los cambios de forma controlada y valida conectividad.','',
      '> El paquete puede contener direccionamiento y configuración sensible. Almacénalo y compártelo de forma segura.'
    ];
    return lines.join('\n')+'\n';
  }

  function buildDeploymentPackage(project,options){
    const opts=obj(options); const generatedAt=isoDate(opts.generatedAt); const source=clone(project||{});
    const gate=dependency(opts,'gate','NetWizardProductionGate');
    const schema=dependency(opts,'schema','NetWizardProjectSchema');
    const docs=dependency(opts,'documentation','NetWizardDocumentationUtils');
    const runbook=dependency(opts,'runbook','NetWizardDeploymentRunbook');
    const changeSetBuilder=dependency(opts,'changeSet','NetWizardChangeSet');
    const incrementalBuilder=dependency(opts,'incremental','NetWizardIncrementalGenerators');
    const generate=opts.generateConfig || root.genConfig;
    const missing=[];
    if(!gate||typeof gate.runProductionGate!=='function') missing.push('ProductionGate');
    if(!schema||typeof schema.prepareExport!=='function') missing.push('ProjectSchema');
    if(!docs||typeof docs.buildInventoryRows!=='function'||typeof docs.buildConnectivityMatrix!=='function'||typeof docs.buildMarkdownDocument!=='function'||typeof docs.toCsv!=='function') missing.push('DocumentationUtils');
    if(!runbook||typeof runbook.buildDeploymentPlan!=='function'||typeof runbook.buildMarkdown!=='function'||typeof runbook.buildRollbackMarkdown!=='function') missing.push('DeploymentRunbook');
    if(!changeSetBuilder||typeof changeSetBuilder.buildChangeSet!=='function'||typeof changeSetBuilder.buildSummaryMarkdown!=='function'||typeof changeSetBuilder.buildPostChangeChecklist!=='function'||typeof changeSetBuilder.publicChangeSet!=='function') missing.push('ChangeSet');
    if(!incrementalBuilder||typeof incrementalBuilder.buildPlan!=='function'||typeof incrementalBuilder.buildSummaryMarkdown!=='function'||typeof incrementalBuilder.publicPlan!=='function') missing.push('IncrementalGenerators');
    if(typeof generate!=='function') missing.push('ConfigGenerator');
    if(missing.length) return {ok:false,blocked:true,format:FORMAT,version:VERSION,generatedAt,issues:[gateIssue('NW-BUNDLE-001',`Dependencias no disponibles: ${missing.join(', ')}`)],files:[]};

    let exported; let canonical; let report;
    try{
      exported=schema.prepareExport(source,opts.schemaOptions||{}); exported.exportedAt=generatedAt; canonical=obj(exported.project);
      report=obj(gate.runProductionGate(canonical,{productionMode:true,strict:true}));
    }catch(error){
      return {ok:false,blocked:true,format:FORMAT,version:VERSION,generatedAt,projectName:clean(source.projName,160),issues:[gateIssue('NW-BUNDLE-002',`No se pudo preparar o validar el proyecto: ${error&&error.message||error}`)],files:[]};
    }
    report.generatedAt=generatedAt;
    if(!report.canExport){
      return {ok:false,blocked:true,format:FORMAT,version:VERSION,generatedAt,projectName:clean(canonical.projName,160),report,issues:arr(report.issues),files:[]};
    }

    const devices=arr(canonical.devices).slice().sort((a,b)=>compareText(a&&a.name,b&&b.name)||compareText(a&&a.id,b&&b.id));
    if(devices.length>MAX_DEVICES) return {ok:false,blocked:true,format:FORMAT,version:VERSION,generatedAt,projectName:clean(canonical.projName,160),report,issues:[gateIssue('NW-BUNDLE-003',`El proyecto supera el límite de ${MAX_DEVICES} dispositivos por paquete.`)],files:[]};
    const configEntries=[]; const generationIssues=[];
    for(let index=0;index<devices.length;index++){
      const device=devices[index]; const vendor=clean(device&&device.vendorOs,80)||'generic'; let output='';
      try{ output=normalizeText(generate(device.id,vendor,canonical)); }
      catch(error){ generationIssues.push(gateIssue('NW-BUNDLE-010',`${clean(device.name,80)||device.id}: el generador lanzó un error: ${error&&error.message||error}`,{deviceId:device.id})); continue; }
      if(output.trim().length<20 || UNSUPPORTED_OUTPUT.test(output)){
        generationIssues.push(gateIssue('NW-BUNDLE-011',`${clean(device.name,80)||device.id}: configuración vacía o no soportada para ${vendor}.`,{deviceId:device.id}));
        continue;
      }
      if(bytes(output).length>MAX_ENTRY_BYTES){generationIssues.push(gateIssue('NW-BUNDLE-012',`${clean(device.name,80)||device.id}: la configuración supera el límite de ${MAX_ENTRY_BYTES} bytes.`,{deviceId:device.id}));continue;}
      configEntries.push({device,path:configPath(device,index),output});
    }
    if(generationIssues.length || (devices.length && configEntries.length!==devices.length)){
      return {ok:false,blocked:true,format:FORMAT,version:VERSION,generatedAt,projectName:clean(canonical.projName,160),report,issues:generationIssues,files:[]};
    }

    const configPaths=Object.fromEntries(configEntries.map(entry=>[entry.device.id,entry.path]));
    const desiredConfigs=Object.fromEntries(configEntries.map(entry=>[entry.device.id,entry.output]));
    let changeSet;
    try{changeSet=changeSetBuilder.buildChangeSet(canonical,{generatedAt,configPaths,desiredConfigs});}
    catch(error){return {ok:false,blocked:true,format:FORMAT,version:VERSION,generatedAt,projectName:clean(canonical.projName,160),report,issues:[gateIssue('NW-BUNDLE-032',`No se pudo construir el change set: ${error&&error.message||error}`)],files:[]};}
    if(!changeSet||changeSet.ok===false){
      const changeIssues=arr(changeSet&&changeSet.issues);return {ok:false,blocked:true,format:FORMAT,version:VERSION,generatedAt,projectName:clean(canonical.projName,160),report,changeSet,issues:changeIssues.length?changeIssues:[gateIssue('NW-BUNDLE-033','El change set incremental no es ejecutable.')],files:[]};
    }
    let incrementalPlan;
    try{incrementalPlan=incrementalBuilder.buildPlan(canonical,{generatedAt,changeSet,desiredConfigs,configPaths});}
    catch(error){return {ok:false,blocked:true,format:FORMAT,version:VERSION,generatedAt,projectName:clean(canonical.projName,160),report,changeSet,issues:[gateIssue('NW-BUNDLE-034',`No se pudo construir el plan incremental: ${error&&error.message||error}`)],files:[]};}
    if(!incrementalPlan||incrementalPlan.ok===false){
      const incrementalIssues=arr(incrementalPlan&&incrementalPlan.issues);return {ok:false,blocked:true,format:FORMAT,version:VERSION,generatedAt,projectName:clean(canonical.projName,160),report,changeSet,incrementalPlan,issues:incrementalIssues.length?incrementalIssues:[gateIssue('NW-BUNDLE-035','El plan incremental requerido no es ejecutable.')],files:[]};
    }
    let deploymentPlan;
    try{deploymentPlan=runbook.buildDeploymentPlan(canonical,{generatedAt,configPaths,changeSet,incrementalPlan});}
    catch(error){return {ok:false,blocked:true,format:FORMAT,version:VERSION,generatedAt,projectName:clean(canonical.projName,160),report,issues:[gateIssue('NW-BUNDLE-030',`No se pudo construir el plan de despliegue: ${error&&error.message||error}`)],files:[]};}
    if(!deploymentPlan||deploymentPlan.ok===false){
      const planIssues=arr(deploymentPlan&&deploymentPlan.issues);return {ok:false,blocked:true,format:FORMAT,version:VERSION,generatedAt,projectName:clean(canonical.projName,160),report,deploymentPlan,issues:planIssues.length?planIssues:[gateIssue('NW-BUNDLE-031','El plan de despliegue no es ejecutable.')],files:[]};
    }

    const files=[];
    try{
      const inventory=docs.buildInventoryRows(canonical); const matrix=docs.buildConnectivityMatrix(canonical,{locale:opts.locale});
      for(const entry of configEntries) addFile(files,entry.path,entry.output.endsWith('\n')?entry.output:entry.output+'\n');
      addFile(files,'project/netwizard-project.json',JSON.stringify(exported,null,2)+'\n','application/json');
      addFile(files,'reports/production-gate.json',JSON.stringify(report,null,2)+'\n','application/json');
      addFile(files,'reports/production-checklist.md',gate.exportChecklistMarkdown?gate.exportChecklistMarkdown(report,{locale:opts.locale}):'# Production checklist\n');
      addFile(files,'reports/inventory.csv',docs.toCsv(inventory,docs.INVENTORY_COLUMNS)+'\n','text/csv;charset=utf-8');
      addFile(files,'reports/connectivity-matrix.csv',docs.toCsv(matrix,['source','destination','action','services','reason','sourceType'])+'\n','text/csv;charset=utf-8');
      addFile(files,'reports/documentation.md',docs.buildMarkdownDocument(canonical,{locale:opts.locale,generatedAt})+'\n','text/markdown;charset=utf-8');
      addFile(files,'deployment/plan.json',JSON.stringify(deploymentPlan,null,2)+'\n','application/json');
      addFile(files,'deployment/runbook.md',runbook.buildMarkdown(deploymentPlan),'text/markdown;charset=utf-8');
      addFile(files,'deployment/rollback-checklist.md',runbook.buildRollbackMarkdown(deploymentPlan),'text/markdown;charset=utf-8');
      addFile(files,'changes/change-set.json',JSON.stringify(changeSetBuilder.publicChangeSet(changeSet),null,2)+'\n','application/json');
      addFile(files,'changes/summary.md',changeSetBuilder.buildSummaryMarkdown(changeSet),'text/markdown;charset=utf-8');
      for(const artifact of arr(changeSet.artifacts)) addFile(files,artifact.path,artifact.content,'text/x-diff;charset=utf-8');
      addFile(files,'incremental/plan.json',JSON.stringify(incrementalBuilder.publicPlan(incrementalPlan),null,2)+'\n','application/json');
      addFile(files,'incremental/summary.md',incrementalBuilder.buildSummaryMarkdown(incrementalPlan),'text/markdown;charset=utf-8');
      for(const artifact of arr(incrementalPlan.artifacts)) addFile(files,artifact.path,artifact.content,artifact.mime||'text/plain;charset=utf-8');
      addFile(files,'evidence/pre-change.json',JSON.stringify({format:'netwizard-pre-change-evidence',version:VERSION,generatedAt,observedAt:changeSet.observedAt,coverage:changeSet.coverage,devices:changeSet.devices.map(device=>({deviceId:device.deviceId,vendor:device.vendor,capturedAt:device.capturedAt,observedFingerprint:device.observedFingerprint,desiredFingerprint:device.desiredFingerprint,status:device.status}))},null,2)+'\n','application/json');
      addFile(files,'evidence/post-change-checklist.md',changeSetBuilder.buildPostChangeChecklist(changeSet,deploymentPlan),'text/markdown;charset=utf-8');
      addFile(files,'README.md',buildReadme(canonical,report,generatedAt,configEntries,changeSet,incrementalPlan),'text/markdown;charset=utf-8');
    }catch(error){
      return {ok:false,blocked:true,format:FORMAT,version:VERSION,generatedAt,projectName:clean(canonical.projName,160),report,issues:[gateIssue('NW-BUNDLE-020',`No se pudieron construir los artefactos: ${error&&error.message||error}`)],files:[]};
    }
    const payloadBytes=files.reduce((sum,file)=>sum+file.bytes,0);
    if(payloadBytes>MAX_PACKAGE_BYTES) return {ok:false,blocked:true,format:FORMAT,version:VERSION,generatedAt,projectName:clean(canonical.projName,160),report,issues:[gateIssue('NW-BUNDLE-021',`El paquete supera el límite de ${MAX_PACKAGE_BYTES} bytes.`)],files:[]};

    const manifest={
      format:FORMAT,version:VERSION,schemaVersion:exported.schemaVersion||schema.schemaVersion||VERSION,
      generatedAt,projectName:clean(canonical.projName,160),productionStatus:report.status,
      counts:{devices:devices.length,files:files.length+1,warnings:(report.counts&&report.counts.warnings||0)+arr(changeSet.issues).filter(item=>item.severity==='warning').length+arr(incrementalPlan.issues).filter(item=>item.severity==='warning').length,errors:report.counts&&report.counts.errors||0},
      sensitive:true,
      deployment:{strategy:deploymentPlan.strategy,phases:deploymentPlan.phases.length,steps:deploymentPlan.steps.length,observationMinutes:deploymentPlan.observationMinutes,estimatedTotalMinutes:deploymentPlan.estimatedTotalMinutes},
      changeSet:{requestedMode:changeSet.requestedMode,executionMode:changeSet.executionMode,observedDevices:changeSet.coverage.observed,changedDevices:changeSet.coverage.changed,missingDevices:changeSet.coverage.missing},
      incremental:{mode:incrementalPlan.mode,requireExecutableIncremental:incrementalPlan.requireExecutableIncremental,candidateReady:incrementalPlan.counts.candidateReady,manualReview:incrementalPlan.counts.manualReview,noChange:incrementalPlan.counts.noChange},
      files:files.map(file=>({path:file.path,bytes:file.bytes,crc32:file.crc32,mime:file.mime}))
    };
    try{addFile(files,'manifest.json',JSON.stringify(manifest,null,2)+'\n','application/json');}
    catch(error){return {ok:false,blocked:true,format:FORMAT,version:VERSION,generatedAt,projectName:manifest.projectName,report,issues:[gateIssue('NW-BUNDLE-022',`No se pudo crear el manifiesto: ${error&&error.message||error}`)],files:[]};}
    const filename=`${safeName(canonical.projName,'netwizard')}-deployment-${generatedAt.slice(0,10)}.zip`;
    return {ok:true,blocked:false,format:FORMAT,version:VERSION,generatedAt,projectName:manifest.projectName,filename,report,changeSet,incrementalPlan,deploymentPlan,manifest,issues:arr(report.issues).concat(arr(changeSet.issues),arr(incrementalPlan.issues)),files};
  }

  function dosDateTime(value){
    const d=new Date(value); const year=Math.max(1980,Math.min(2107,d.getUTCFullYear()));
    return {date:((year-1980)<<9)|((d.getUTCMonth()+1)<<5)|d.getUTCDate(),time:(d.getUTCHours()<<11)|(d.getUTCMinutes()<<5)|(d.getUTCSeconds()>>1)};
  }
  function u16(value){ const out=new Uint8Array(2); new DataView(out.buffer).setUint16(0,value,true); return out; }
  function u32(value){ const out=new Uint8Array(4); new DataView(out.buffer).setUint32(0,value>>>0,true); return out; }
  function concat(parts){ const size=parts.reduce((sum,part)=>sum+part.length,0); const out=new Uint8Array(size); let offset=0; for(const part of parts){out.set(part,offset);offset+=part.length;}return out; }
  function encodeZip(pkg){
    if(!pkg||!pkg.ok) throw new Error('No se puede codificar un paquete bloqueado.');
    const local=[]; const central=[]; let offset=0; const stamp=dosDateTime(pkg.generatedAt);
    for(const file of pkg.files){
      const name=bytes(file.path); const data=bytes(file.content); const crc=crc32(data);
      const localHeader=concat([u32(0x04034b50),u16(20),u16(0x0800),u16(0),u16(stamp.time),u16(stamp.date),u32(crc),u32(data.length),u32(data.length),u16(name.length),u16(0),name]);
      local.push(localHeader,data);
      const centralHeader=concat([u32(0x02014b50),u16(20),u16(20),u16(0x0800),u16(0),u16(stamp.time),u16(stamp.date),u32(crc),u32(data.length),u32(data.length),u16(name.length),u16(0),u16(0),u16(0),u16(0),u32(0),u32(offset),name]);
      central.push(centralHeader); offset+=localHeader.length+data.length;
    }
    const centralBytes=concat(central); const end=concat([u32(0x06054b50),u16(0),u16(0),u16(pkg.files.length),u16(pkg.files.length),u32(centralBytes.length),u32(offset),u16(0)]);
    return concat([...local,centralBytes,end]);
  }

  function download(pkg){
    if(!root.document||!pkg||!pkg.ok) return false;
    const blob=new Blob([encodeZip(pkg)],{type:'application/zip'}); const url=URL.createObjectURL(blob);
    const link=root.document.createElement('a'); link.href=url; link.download=pkg.filename; root.document.body.appendChild(link); link.click(); link.remove(); root.setTimeout(()=>URL.revokeObjectURL(url),1000); return true;
  }
  function summarize(pkg){
    if(!pkg||!pkg.ok){
      const issues=arr(pkg&&pkg.issues); const lines=['⛔ Paquete de despliegue BLOQUEADO'];
      if(pkg&&pkg.report) lines.push(`Puerta: ${String(pkg.report.status||'blocked').toUpperCase()} · Errores: ${pkg.report.counts&&pkg.report.counts.errors||0} · Avisos: ${pkg.report.counts&&pkg.report.counts.warnings||0}`);
      issues.slice(0,12).filter(issue=>issue.severity!=='info').forEach(issue=>lines.push(`• [${issue.code||'NW-BUNDLE'}] ${issue.message||''}`));
      return lines.join('\n');
    }
    return `✅ Paquete preparado: ${pkg.filename}\nEstado: ${String(pkg.report.status).toUpperCase()} · ${pkg.manifest.counts.devices} configuraciones · ${pkg.manifest.deployment.steps} pasos · ${pkg.manifest.counts.files} archivos · cambio ${pkg.manifest.changeSet.executionMode} · candidatos seguros ${pkg.manifest.incremental.candidateReady} · revisión manual ${pkg.manifest.incremental.manualReview} · ${pkg.manifest.counts.warnings} avisos.`;
  }

  function bindBrowserUi(attempt){
    if(!root.document)return; const button=root.document.getElementById('expDeploymentPackage'); const output=root.document.getElementById('deploymentPackageStatus');
    if(!button||!output||!root.NetWizardState){if((attempt||0)<40&&root.setTimeout)root.setTimeout(()=>bindBrowserUi((attempt||0)+1),100);return;}
    button.onclick=()=>{
      const locale=root.NetWizardI18n&&root.NetWizardI18n.getReportLocale?root.NetWizardI18n.getReportLocale():'es';
      const pkg=buildDeploymentPackage(root.NetWizardState.getSnapshot(),{locale}); root.NetWizardLastDeploymentBundle=pkg; output.textContent=summarize(pkg);
      const gateOut=root.document.getElementById('productionGateOut'); if(gateOut&&pkg.report&&root.NetWizardProductionGate&&root.NetWizardProductionGate.summarizeGate) gateOut.textContent=root.NetWizardProductionGate.summarizeGate(pkg.report,{limit:80});
      if(!pkg.ok){root.alert&&root.alert('Paquete bloqueado: corrige los errores de producción indicados.');return;}
      try{download(pkg);}catch(error){output.textContent=`⛔ No se pudo descargar el ZIP: ${error&&error.message||error}`;root.alert&&root.alert('No se pudo descargar el paquete ZIP.');return;}
      try{root.document.dispatchEvent(new CustomEvent('nw:deployment:bundle',{detail:{filename:pkg.filename,status:pkg.report.status}}));}catch(_error){}
    };
  }

  const api={version:'netwizard-deployment-bundle-v3.50',format:FORMAT,buildDeploymentPackage,encodeZip,download,summarize,crc32,safeName,configExtension};
  root.NetWizardDeploymentBundle=api;
  if(typeof module!=='undefined'&&module.exports)module.exports=api;
  if(root.document){if(root.document.readyState==='loading')root.document.addEventListener('DOMContentLoaded',()=>bindBrowserUi(0));else bindBrowserUi(0);}
})(typeof window!=='undefined'?window:globalThis);
