/* NetWizard Observed State and Drift v1 */
(function initNetWizardObservedDrift(root){
'use strict';
function arr(v){return Array.isArray(v)?v:[];}
function clean(v){return String(v==null?'':v).trim();}
function same(a,b){return JSON.stringify(a)===JSON.stringify(b);}
function indexById(items){const m=new Map();for(const item of arr(items)){if(item&&clean(item.id))m.set(clean(item.id),item);}return m;}
function compareCollection(kind,desiredItems,observedItems,options){
  const issues=[],drift=[],desired=indexById(desiredItems),observed=indexById(observedItems),critical=new Set(arr(options&&options.criticalKinds));
  for(const [id,wanted] of desired){
    const actual=observed.get(id),base={category:'drift',resourceKind:kind,resourceId:id};
    if(!actual){const blocking=critical.has(kind)||wanted.critical===true;const item={...base,code:'NW-DRIFT-001',severity:blocking?'error':'warning',blocking,message:`${kind} ${id}: no aparece en el estado observado.`};issues.push(item);drift.push({...item,type:'missing',desired:wanted,observed:null});continue;}
    const fields=arr((options&&options.fieldsByKind&&options.fieldsByKind[kind])||Object.keys(wanted).filter(k=>!['id','name','observedAt','lastSeen'].includes(k)));
    for(const field of fields){if(!(field in wanted))continue;if(same(wanted[field],actual[field]))continue;const blocking=critical.has(kind)&&arr(options&&options.blockingFields).includes(field);const item={...base,code:'NW-DRIFT-002',severity:blocking?'error':'warning',blocking,field,message:`${kind} ${id}: ${field} observado (${JSON.stringify(actual[field])}) difiere del diseño (${JSON.stringify(wanted[field])}).`};issues.push(item);drift.push({...item,type:'changed',desired:wanted[field],observed:actual[field]});}
  }
  for(const [id,actual] of observed){if(desired.has(id))continue;const item={category:'drift',resourceKind:kind,resourceId:id,code:'NW-DRIFT-003',severity:'warning',blocking:false,message:`${kind} ${id}: existe en el estado observado pero no en el diseño.`};issues.push(item);drift.push({...item,type:'unexpected',desired:null,observed:actual});}
  return{issues,drift};
}
function validateSnapshot(snapshot){const issues=[];if(snapshot!=null&&typeof snapshot!=='object')issues.push({code:'NW-DRIFT-010',severity:'error',blocking:true,category:'drift',message:'Snapshot observado inválido.'});else if(snapshot&& !clean(snapshot.observedAt))issues.push({code:'NW-DRIFT-011',severity:'warning',blocking:false,category:'drift',message:'Snapshot observado sin fecha observedAt.'});return issues;}
function validateProject(project,options){
  const snapshot=project&&project.observedState,issues=validateSnapshot(snapshot),drift=[];
  if(snapshot&&typeof snapshot==='object'){
    const opts=Object.assign({criticalKinds:['devices','links','wanCircuits','internalServices'],blockingFields:['adminState','operState','enabled','provider','bandwidthUpMbps','bandwidthDownMbps','security','vrfRef','vlanRef']},project&&project.driftPolicy||{},options||{});
    const kinds=['devices','ports','links','vlans','wanCircuits','internalServices','wifiAccessPoints','wifiSsids','vrfs','ipv6Networks'];
    for(const kind of kinds){const result=compareCollection(kind,project&&project[kind],snapshot[kind],opts);issues.push(...result.issues);drift.push(...result.drift);}
  }
  const blocking=issues.filter(i=>i.blocking).length;
  return{version:'netwizard-observed-drift-v1',ok:blocking===0,issues,drift,counts:{blocking,warnings:issues.filter(i=>i.severity==='warning').length,missing:drift.filter(d=>d.type==='missing').length,changed:drift.filter(d=>d.type==='changed').length,unexpected:drift.filter(d=>d.type==='unexpected').length},observedAt:snapshot&&snapshot.observedAt||null};
}
const api={version:'netwizard-observed-drift-v1',validateProject,validateSnapshot,compareCollection};root.NetWizardObservedDrift=api;if(typeof module!=='undefined'&&module.exports)module.exports=api;
})(typeof window!=='undefined'?window:globalThis);
