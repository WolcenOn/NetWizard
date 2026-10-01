/* NetWizard Intervention Execution & Acceptance v1
 * Canonical field evidence lives under workflow.interventionExecution.
 * To-Be remains authoritative; execution evidence documents what happened in field.
 */
(function initNetWizardInterventionExecution(root){
'use strict';

const VERSION='netwizard-intervention-execution-v1';
const arr=v=>Array.isArray(v)?v:[];
const obj=v=>v&&typeof v==='object'&&!Array.isArray(v)?v:{};
const clean=v=>String(v==null?'':v).trim();
const clone=v=>JSON.parse(JSON.stringify(v==null?null:v));

function tryRequire(path){try{return require(path);}catch{return null;}}
function planner(){
  return root.NetWizardPhysicalInterventionPlan||(typeof require==='function'?tryRequire('./netwizard-physical-intervention-plan.js'):null);
}
function drift(){
  return root.NetWizardObservedDrift||(typeof require==='function'?tryRequire('./netwizard-observed-drift.js'):null);
}
function isApplicable(project){
  const w=obj(project&&project.workflow),from=obj(w.derivedFrom);
  return w.mode==='design'&&from.type==='inventory'&&obj(w.interventionBaseline).version==='netwizard-physical-intervention-baseline-v1';
}
function record(project){
  const raw=obj(obj(project&&project.workflow).interventionExecution);
  if(raw.version!==VERSION)return{version:VERSION,startedAt:'',technician:'',actions:{},acceptance:{}};
  return{
    version:VERSION,
    startedAt:clean(raw.startedAt),
    technician:clean(raw.technician),
    actions:obj(raw.actions),
    acceptance:obj(raw.acceptance)
  };
}
function actionId(action,index){
  return clean(action&&action.id)||[
    clean(action&&action.type),clean(action&&action.category),clean(action&&action.deviceId),
    clean(action&&action.originRef),clean(action&&action.currentId),String(index+1)
  ].join(':');
}
function normalizeActionEvidence(raw,defaultActor){
  const x=obj(raw),status=['pending','done','blocked'].includes(clean(x.status).toLowerCase())?clean(x.status).toLowerCase():'pending';
  return{
    status,
    completedAt:clean(x.completedAt),
    completedBy:clean(x.completedBy||defaultActor),
    note:clean(x.note),
    evidenceRefs:arr(x.evidenceRefs).map(clean).filter(Boolean).slice(0,20)
  };
}
function build(project){
  const P=planner(),plan=P&&P.buildChecklist?P.buildChecklist(project):null;
  if(!plan||!plan.ok)return{ok:false,version:VERSION,message:plan&&plan.message||'No hay intervención ejecutable.',items:[],counts:{total:0,done:0,blocked:0,pending:0,percent:0},record:record(project)};
  const rec=record(project),items=arr(plan.actions).map((action,index)=>{
    const id=actionId(action,index),evidence=normalizeActionEvidence(rec.actions[id],rec.technician);
    return Object.assign({},clone(action),{actionId:id,order:index+1,...evidence});
  });
  const total=items.length,done=items.filter(x=>x.status==='done').length,blocked=items.filter(x=>x.status==='blocked').length;
  return{ok:true,version:VERSION,items,counts:{total,done,blocked,pending:total-done-blocked,percent:total?Math.round(done*100/total):100},record:rec};
}
function patchRecord(project,patch){
  const p=clone(project||{}),w=obj(p.workflow),current=record(p),next=Object.assign({},current,obj(patch));
  next.version=VERSION;next.actions=obj(next.actions);next.acceptance=obj(next.acceptance);
  p.workflow=Object.assign({},w,{interventionExecution:next});
  return p;
}
function setAction(project,id,patch){
  const current=record(project),actions=clone(current.actions||{}),before=normalizeActionEvidence(actions[id],current.technician);
  actions[id]=Object.assign({},before,obj(patch));
  return patchRecord(project,{actions});
}
function acceptanceChecks(project){
  const execution=build(project),rec=record(project),acceptance=obj(rec.acceptance),issues=[],warnings=[];
  if(!isApplicable(project))issues.push({code:'NW-ACCEPT-001',message:'El proyecto no es un Diseño To-Be derivado de Inventario.',blocking:true});
  if(!execution.ok)issues.push({code:'NW-ACCEPT-002',message:execution.message||'No se puede construir la ejecución de campo.',blocking:true});

  for(const item of arr(execution.items)){
    if(item.status!=='done')issues.push({code:item.status==='blocked'?'NW-ACCEPT-003':'NW-ACCEPT-004',actionId:item.actionId,message:(item.status==='blocked'?'Acción bloqueada: ':'Acción pendiente: ')+(item.title||item.type||item.actionId),blocking:true});
    if(item.status==='done'&&!clean(item.completedBy))issues.push({code:'NW-ACCEPT-005',actionId:item.actionId,message:'Acción completada sin técnico/responsable: '+(item.title||item.actionId),blocking:true});
    if(item.status==='done'&&!arr(item.evidenceRefs).length)warnings.push({code:'NW-ACCEPT-101',actionId:item.actionId,message:'Acción sin referencia de evidencia: '+(item.title||item.actionId),blocking:false});
  }

  const required=[
    ['connectivityVerified','Conectividad post-change no confirmada.'],
    ['labelsVerified','Etiquetado/documentación física no confirmados.'],
    ['asBuiltReviewed','As-Built final no revisado contra lo ejecutado.']
  ];
  for(const [key,message] of required)if(acceptance[key]!==true)issues.push({code:'NW-ACCEPT-006',field:key,message,blocking:true});
  if(acceptance.requireClientAcceptance===true&&acceptance.clientAccepted!==true)issues.push({code:'NW-ACCEPT-007',field:'clientAccepted',message:'La aceptación del cliente es obligatoria y todavía no está confirmada.',blocking:true});
  if(!clean(acceptance.acceptedBy))issues.push({code:'NW-ACCEPT-008',field:'acceptedBy',message:'Falta el responsable de aceptación/cierre.',blocking:true});

  const observed=obj(project&&project.observedState),observedAt=clean(observed.observedAt);
  if(!observedAt)issues.push({code:'NW-ACCEPT-009',message:'Falta una captura Observed con observedAt antes del cierre.',blocking:true});
  const completedTimes=arr(execution.items).map(x=>Date.parse(x.completedAt||'')).filter(Number.isFinite);
  if(observedAt&&completedTimes.length){
    const observedMs=Date.parse(observedAt),latest=Math.max(...completedTimes);
    if(!Number.isFinite(observedMs)||observedMs<latest)issues.push({code:'NW-ACCEPT-010',message:'La captura Observed es anterior a la última acción completada en campo.',blocking:true});
  }

  const Drift=drift(),driftReport=Drift&&typeof Drift.validateProject==='function'?Drift.validateProject(project):null;
  if(driftReport){
    for(const item of arr(driftReport.issues).filter(x=>x&&x.blocking))issues.push({code:'NW-ACCEPT-011',message:'Drift bloqueante: '+clean(item.message),blocking:true});
    for(const item of arr(driftReport.issues).filter(x=>x&&!x.blocking))warnings.push({code:'NW-ACCEPT-102',message:'Drift/revisión: '+clean(item.message),blocking:false});
  }

  return{
    version:'netwizard-intervention-acceptance-v1',
    ready:issues.length===0,
    execution,
    acceptance:clone(acceptance),
    observedAt:observedAt||null,
    drift:driftReport,
    issues,
    warnings,
    counts:{blocking:issues.length,warnings:warnings.length,actions:execution.counts||{total:0,done:0,blocked:0,pending:0}}
  };
}
function acceptedRecord(project,options){
  const opts=obj(options),current=record(project),acceptance=Object.assign({},obj(current.acceptance),{
    connectivityVerified:opts.connectivityVerified===true,
    labelsVerified:opts.labelsVerified===true,
    asBuiltReviewed:opts.asBuiltReviewed===true,
    requireClientAcceptance:opts.requireClientAcceptance===true,
    clientAccepted:opts.clientAccepted===true,
    acceptedBy:clean(opts.acceptedBy||obj(current.acceptance).acceptedBy||current.technician),
    acceptedAt:clean(opts.acceptedAt||new Date().toISOString()),
    note:clean(opts.note||obj(current.acceptance).note)
  });
  return patchRecord(project,{acceptance});
}

const api={VERSION,version:VERSION,isApplicable,record,build,actionId,normalizeActionEvidence,patchRecord,setAction,acceptanceChecks,acceptedRecord};
root.NetWizardInterventionExecution=api;
if(typeof module!=='undefined'&&module.exports)module.exports=api;
})(typeof window!=='undefined'?window:globalThis);
