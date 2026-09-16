/* =========================================================
   NetWizard Incremental Generators v3.50
   Registro conservador de adaptadores para cambios ejecutables.

   Solo genera comandos cuando el adaptador puede demostrar un formato
   determinista. El fallback siempre es revisión manual, nunca CLI inferida.
========================================================= */
(function initNetWizardIncrementalGenerators(root){
  'use strict';

  const FORMAT='netwizard-incremental-plan';
  const VERSION='3.50.0';
  const PLACEHOLDER=/\$\{[^}]+\}|\b(?:NEXT_HOP|CHANGEME|TODO|REPLACE_ME)\b/i;
  const SENSITIVE=/\b(?:secret|password|authentication-key|encrypted-password|private-key|community)\b/i;
  function arr(value){return Array.isArray(value)?value:[];}
  function obj(value){return value&&typeof value==='object'&&!Array.isArray(value)?value:{};}
  function clean(value,max){return String(value==null?'':value).replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g,'').trim().slice(0,max||200);}
  function text(value){return String(value==null?'':value).replace(/\r\n?/g,'\n');}
  function safeName(value,fallback){const source=clean(value,120);const ascii=source.normalize?source.normalize('NFD').replace(/[\u0300-\u036f]/g,''):source;return ascii.replace(/[^A-Za-z0-9_.-]+/g,'-').replace(/^[.-]+|[.-]+$/g,'').slice(0,100)||fallback||'device';}
  function issue(code,message,blocking,extra){return Object.assign({code,severity:blocking?'error':'warning',blocking:!!blocking,category:'incremental-generator',source:'incremental-generator',message},extra||{});}
  function observedConfigMap(snapshot){const raw=snapshot&&snapshot.deviceConfigs,map=new Map();if(Array.isArray(raw)){for(const entry of raw){const id=clean(entry&&entry.deviceId,120);if(id)map.set(id,obj(entry));}}else for(const [id,entry] of Object.entries(obj(raw)))map.set(clean(id,120),typeof entry==='string'?{content:entry}:obj(entry));return map;}
  function desiredConfigMap(value){return value instanceof Map?value:new Map(Object.entries(obj(value)));}
  function parseJunosSet(value){
    const commands=[],invalid=[];
    for(const [index,raw] of text(value).split('\n').entries()){
      const line=raw.trim();if(!line||line.startsWith('#'))continue;
      if(/^set\s+\S/.test(line))commands.push(line);else invalid.push({line:index+1,content:line});
    }
    return{commands:Array.from(new Set(commands)),invalid};
  }
  function difference(left,right){const deny=new Set(right);return Array.from(new Set(left)).filter(line=>!deny.has(line)).sort();}
  function setToDelete(line){return line.replace(/^set\s+/,'delete ');}
  function renderSetFile(title,deletes,adds){const out=[`# ${title}`,'# Revisar con show | compare y ejecutar commit check antes de confirmar.'];for(const line of deletes)out.push(line);for(const line of adds)out.push(line);return out.join('\n')+'\n';}
  function junosAdapter(context){
    const before=parseJunosSet(context.observedConfig),after=parseJunosSet(context.desiredConfig);
    const invalid=before.invalid.map(item=>Object.assign({side:'observed'},item)).concat(after.invalid.map(item=>Object.assign({side:'desired'},item)));
    if(invalid.length)return{ready:false,reason:'La captura o el objetivo contiene líneas que no son comandos Junos set.',details:{invalid:invalid.slice(0,20)}};
    const additions=difference(after.commands,before.commands),removedSet=difference(before.commands,after.commands),deletions=removedSet.map(setToDelete);
    const sensitive=additions.concat(removedSet).filter(line=>PLACEHOLDER.test(line)||SENSITIVE.test(line));
    if(sensitive.length)return{ready:false,reason:'El delta toca secretos, credenciales o placeholders y requiere revisión manual.',details:{sensitiveLines:sensitive.map((_line,index)=>`sensitive-${index+1}`)}};
    if(!additions.length&&!deletions.length)return{ready:true,noChange:true,additions:[],deletions:[],applyContent:'',rollbackContent:''};
    const rollbackDeletes=additions.map(setToDelete),rollbackAdds=removedSet;
    return{ready:true,noChange:false,additions,deletions,applyContent:renderSetFile(`NetWizard Junos candidate — ${context.deviceName}`,deletions,additions),rollbackContent:renderSetFile(`NetWizard Junos rollback candidate — ${context.deviceName}`,rollbackDeletes,rollbackAdds),instructions:['Entrar en modo configuración y crear un rollback point/backup real.','Cargar el fichero con `load set <archivo>` en la configuración candidata.','Ejecutar `show | compare` y comprobar que coincide con el change set.','Ejecutar `commit check`.','Usar `commit confirmed` según la política del cambio; confirmar solo tras validar.'],rollbackInstructions:['Si el commit aún no se confirmó, dejar expirar `commit confirmed` o ejecutar rollback según procedimiento.','Si procede una reversión explícita, cargar el fichero rollback con `load set` y revisar `show | compare`.','Ejecutar `commit check`; el backup real sigue siendo la fuente autoritativa.']};
  }
  function createRegistry(){
    const adapters=[];
    function register(adapter){const item=obj(adapter),id=clean(item.id,100),vendors=arr(item.vendors).map(v=>clean(v,80)).filter(Boolean);if(!id||typeof item.generate!=='function'||!vendors.length)throw new Error('Adaptador incremental inválido.');if(adapters.some(existing=>existing.id===id))throw new Error(`Adaptador incremental duplicado: ${id}`);adapters.push({id,version:clean(item.version,40)||'1',vendors,priority:Number.isFinite(Number(item.priority))?Number(item.priority):100,generate:item.generate});adapters.sort((a,b)=>b.priority-a.priority||a.id.localeCompare(b.id));return api;}
    function resolve(vendor){return adapters.find(adapter=>adapter.vendors.includes(clean(vendor,80)))||null;}
    function inspect(){return adapters.map(({id,version,vendors,priority})=>({id,version,vendors:vendors.slice(),priority}));}
    const api={register,resolve,inspect};return api;
  }
  const registry=createRegistry();registry.register({id:'junos.set-delta',version:'1',vendors:['juniper_junos'],priority:300,generate:junosAdapter});

  function buildPlan(project,options){
    const p=obj(project),opts=obj(options),changeSet=obj(opts.changeSet),desiredMap=desiredConfigMap(opts.desiredConfigs),observedMap=observedConfigMap(p.observedState),deployment=obj(p.deployment),incremental=changeSet.requestedMode==='incremental',requireExecutable=deployment.requireExecutableIncremental===true;
    const issues=[],devices=[],artifacts=[],generatedAt=clean(opts.generatedAt,80)||new Date().toISOString(),changeById=new Map(arr(changeSet.devices).map(change=>[change.deviceId,change]));
    if(!changeSet.format)issues.push(issue('NW-INCREMENTAL-001','No existe un change set válido para generar el plan incremental.',true));
    for(const [index,device] of arr(p.devices).entries()){
      const deviceId=clean(device&&device.id,120),deviceName=clean(device&&device.name,120)||deviceId,vendor=clean(device&&device.vendorOs,80)||'generic_network',change=obj(changeById.get(deviceId));
      const base={deviceId,deviceName,vendor,changeStatus:change.status||'baseline-required',adapterId:null,status:incremental?'manual-review':'full-target',applyPath:null,rollbackPath:null,instructions:[],rollbackInstructions:[],commandCounts:{additions:0,deletions:0}};
      if(!incremental){devices.push(base);continue;}
      if(change.status==='no-change'){devices.push(Object.assign(base,{status:'no-change'}));continue;}
      const observed=obj(observedMap.get(deviceId)).content,desired=desiredMap.get(deviceId);
      if(!clean(observed,1)||!clean(desired,1)){issues.push(issue('NW-INCREMENTAL-005',`${deviceName}: faltan la configuración observada o el objetivo requerido por el adaptador.`,true,{deviceId,vendor}));devices.push(base);continue;}
      const adapter=registry.resolve(vendor);if(!adapter){const blocking=requireExecutable;issues.push(issue('NW-INCREMENTAL-002',`${deviceName}: no existe adaptador incremental seguro para ${vendor}.`,blocking,{deviceId,vendor}));devices.push(base);continue;}
      let result;
      try{result=adapter.generate({project:p,device,deviceId,deviceName,vendor,change,observedConfig:observed,desiredConfig:desired});}catch(error){issues.push(issue('NW-INCREMENTAL-006',`${deviceName}: el adaptador ${adapter.id} falló: ${error&&error.message||error}`,true,{deviceId,vendor}));devices.push(base);continue;}
      if(!result||!result.ready){const blocking=requireExecutable;issues.push(issue('NW-INCREMENTAL-003',`${deviceName}: ${result&&result.reason||'el adaptador no pudo demostrar un delta seguro.'}`,blocking,{deviceId,vendor,details:result&&result.details||null}));devices.push(Object.assign(base,{adapterId:adapter.id}));continue;}
      if(result.noChange){devices.push(Object.assign(base,{adapterId:adapter.id,status:'no-change'}));continue;}
      const stem=`${String(index+1).padStart(2,'0')}-${safeName(deviceName,'device')}-${safeName(deviceId,'id')}`,applyPath=`incremental/commands/${stem}.set`,rollbackPath=`incremental/rollback/${stem}.set`;
      artifacts.push({path:applyPath,content:result.applyContent,mime:'text/plain;charset=utf-8'},{path:rollbackPath,content:result.rollbackContent,mime:'text/plain;charset=utf-8'});
      devices.push(Object.assign(base,{adapterId:adapter.id,status:'candidate-ready',applyPath,rollbackPath,instructions:arr(result.instructions),rollbackInstructions:arr(result.rollbackInstructions),commandCounts:{additions:arr(result.additions).length,deletions:arr(result.deletions).length}}));
    }
    const counts={devices:devices.length,candidateReady:devices.filter(item=>item.status==='candidate-ready').length,manualReview:devices.filter(item=>item.status==='manual-review').length,noChange:devices.filter(item=>item.status==='no-change').length,fullTarget:devices.filter(item=>item.status==='full-target').length};
    return{ok:!issues.some(item=>item.blocking),format:FORMAT,version:VERSION,generatedAt,projectName:clean(p.projName,160),mode:incremental?'incremental':'full',requireExecutableIncremental:requireExecutable,registry:registry.inspect(),counts,issues,devices,artifacts,warning:'Solo candidate-ready contiene comandos cargables. manual-review conserva el diff y la configuración objetivo, pero no inventa CLI.'};
  }
  function publicPlan(plan){const copy=JSON.parse(JSON.stringify(plan||{}));delete copy.artifacts;return copy;}
  function buildSummaryMarkdown(plan){const p=obj(plan),out=[`# Plan incremental — ${p.projectName||'NetWizard'}`,'',`- Modo: **${p.mode||'full'}**`,`- Candidatos seguros: ${obj(p.counts).candidateReady||0}`,`- Revisión manual: ${obj(p.counts).manualReview||0}`,`- Sin cambios: ${obj(p.counts).noChange||0}`,'',`> ${p.warning||''}`,'','## Dispositivos',''];for(const device of arr(p.devices)){out.push(`### ${device.deviceName} (${device.vendor})`,'',`- Estado: **${device.status}**`,`- Adaptador: ${device.adapterId||'ninguno'}`,`- Comandos: +${obj(device.commandCounts).additions||0} / -${obj(device.commandCounts).deletions||0}`,`- Candidato: ${device.applyPath?`\`${device.applyPath}\``:'no generado'}`,`- Rollback candidato: ${device.rollbackPath?`\`${device.rollbackPath}\``:'no generado'}`,'');}if(arr(p.issues).length)out.push('## Incidencias','',...p.issues.map(item=>`- [${item.code}] ${item.message}`),'');return out.join('\n')+'\n';}

  const api={version:'netwizard-incremental-generators-v3.50',format:FORMAT,registry,createRegistry,buildPlan,publicPlan,buildSummaryMarkdown,parseJunosSet,junosAdapter};
  root.NetWizardIncrementalGenerators=api;if(typeof module!=='undefined'&&module.exports)module.exports=api;
})(typeof window!=='undefined'?window:globalThis);
