/* NetWizard Intervention Closeout v1
 * Cierra un Diseño To-Be derivado de inventario y produce un As-Built actualizado.
 */
(function initNetWizardInterventionCloseout(root){
'use strict';

const arr=v=>Array.isArray(v)?v:[];
const obj=v=>v&&typeof v==='object'&&!Array.isArray(v)?v:{};
const clean=v=>String(v==null?'':v).trim();
const clone=v=>JSON.parse(JSON.stringify(v==null?null:v));
const nowIso=()=>new Date().toISOString();

function planner(){
  if(root.NetWizardPhysicalInterventionPlan)return root.NetWizardPhysicalInterventionPlan;
  if(typeof require==='function'){try{return require('./netwizard-physical-intervention-plan.js');}catch(_e){}}
  return null;
}
function isDerivedDesign(project){
  const w=obj(project&&project.workflow),from=obj(w.derivedFrom);
  return w.mode==='design'&&from.type==='inventory';
}
function stripAsBuiltSuffix(value){
  return clean(value)
    .replace(/\s*·\s*Diseño To-Be\s*$/i,'')
    .replace(/\s*·\s*As-Built actualizado\s*$/i,'')
    .replace(/\s*·\s*As-Built\s*$/i,'')
    .trim();
}
function defaultName(project){
  const from=obj(obj(project&&project.workflow).derivedFrom);
  const base=stripAsBuiltSuffix(from.sourceProjectName||project&&project.projName)||'Proyecto';
  return `${base} · As-Built actualizado`;
}
function replacementValidation(project){
  const devices=arr(project&&project.devices),byId=new Map(devices.filter(Boolean).map(d=>[clean(d.id),d]));
  const errors=[],used=new Set();
  for(const d of devices){
    if(clean(d&&d.designDisposition)!=='replace')continue;
    const ref=clean(d.replacementDeviceRef);
    if(!ref){
      errors.push({code:'replacement_missing',deviceId:d.id,message:`${d.name||d.id}: está marcado para reemplazo pero no indica replacementDeviceRef.`});
      continue;
    }
    const replacement=byId.get(ref);
    if(!replacement){
      errors.push({code:'replacement_not_found',deviceId:d.id,replacementDeviceRef:ref,message:`${d.name||d.id}: replacementDeviceRef no existe (${ref}).`});
      continue;
    }
    if(clean(replacement.originRef)){
      errors.push({code:'replacement_not_new',deviceId:d.id,replacementDeviceRef:ref,message:`${d.name||d.id}: el reemplazo debe ser un equipo nuevo sin originRef.`});
    }
    if(clean(replacement.designDisposition||'add')!=='add'){
      errors.push({code:'replacement_not_add',deviceId:d.id,replacementDeviceRef:ref,message:`${d.name||d.id}: el reemplazo debe estar marcado como add.`});
    }
    if(used.has(ref)){
      errors.push({code:'replacement_reused',deviceId:d.id,replacementDeviceRef:ref,message:`El equipo ${ref} se usa como reemplazo de más de un activo.`});
    }
    used.add(ref);
  }
  return errors;
}
function stripOrigin(item){
  const out=clone(item||{});
  delete out.originRef;
  return out;
}
function stripDeviceDesignFields(device){
  const out=stripOrigin(device);
  delete out.designDisposition;
  delete out.replacementDeviceRef;
  delete out.replacementNote;
  return out;
}
function cleanObservedState(observedState,removedDeviceIds){
  if(!observedState||typeof observedState!=='object'||Array.isArray(observedState))return observedState==null?null:clone(observedState);
  const out=clone(observedState);
  const raw=out&&out.deviceConfigs;
  if(Array.isArray(raw)){
    out.deviceConfigs=raw.filter(entry=>!removedDeviceIds.has(clean(entry&&entry.deviceId)));
  }else if(raw&&typeof raw==='object'){
    for(const id of removedDeviceIds)delete raw[id];
  }
  return out;
}
function pruneLinks(links,removedPortIds,removedDeviceIds){
  return arr(links).filter(link=>{
    if(!link)return false;
    const portRefs=[link.fromPortId,link.toPortId,link.aPortId,link.bPortId].map(clean).filter(Boolean);
    if(portRefs.some(id=>removedPortIds.has(id)))return false;
    const deviceRefs=[link.fromDeviceId,link.toDeviceId,link.aDeviceId,link.bDeviceId].map(clean).filter(Boolean);
    if(deviceRefs.some(id=>removedDeviceIds.has(id)))return false;
    return true;
  }).map(stripOrigin);
}
function buildUpdatedAsBuilt(project,options){
  const source=clone(project||{}),opts=obj(options);
  if(!isDerivedDesign(source)){
    return{ok:false,code:'source_not_derived_design',message:'El cierre requiere un Diseño To-Be derivado de un Inventario As-Built.',project:source,errors:[]};
  }
  const replacementErrors=replacementValidation(source);
  if(replacementErrors.length){
    return{ok:false,code:'replacement_contract_invalid',message:'Hay reemplazos incompletos o ambiguos.',project:source,errors:replacementErrors};
  }

  const devices=arr(source.devices);
  const removedDeviceIds=new Set(
    devices
      .filter(d=>['retire','replace'].includes(clean(d&&d.designDisposition)))
      .map(d=>clean(d.id))
      .filter(Boolean)
  );
  const keptDevices=devices.filter(d=>!removedDeviceIds.has(clean(d&&d.id))).map(stripDeviceDesignFields);

  const removedPortIds=new Set(
    arr(source.ports)
      .filter(p=>removedDeviceIds.has(clean(p&&p.deviceId)))
      .map(p=>clean(p.id))
      .filter(Boolean)
  );
  const keptPorts=arr(source.ports)
    .filter(p=>!removedDeviceIds.has(clean(p&&p.deviceId)))
    .map(stripOrigin);

  const next=clone(source);
  next.projName=clean(opts.name)||defaultName(source);
  next.step='physical';
  next.selected=null;
  next.devices=keptDevices;
  next.ports=keptPorts;
  next.links=pruneLinks(source.links,removedPortIds,removedDeviceIds);
  next.rackItems=arr(source.rackItems)
    .filter(item=>!removedDeviceIds.has(clean(item&&item.deviceId)))
    .map(stripOrigin);
  next.powerConnections=arr(source.powerConnections)
    .filter(conn=>!removedDeviceIds.has(clean(conn&&conn.deviceId)))
    .map(stripOrigin);
  next.patchConnections=arr(source.patchConnections)
    .filter(conn=>!removedPortIds.has(clean(conn&&conn.switchPortId)))
    .map(stripOrigin);

  for(const key of ['physicalLocations','racks','pdus','patchPanels','telecomOutlets','cableRuns','hostOutletConnections','hosts']){
    next[key]=arr(source[key]).map(stripOrigin);
  }

  next.observedState=cleanObservedState(source.observedState,removedDeviceIds);
  next.designRequirements=Object.assign({},obj(source.designRequirements),{locationPlans:[]});

  const previousWorkflow=obj(source.workflow),derived=obj(previousWorkflow.derivedFrom);
  const plan=planner()&&planner().build?planner().build(source):null;
  const closedAt=clean(opts.closedAt)||nowIso();
  next.workflow={
    mode:'inventory',
    updatedFrom:{
      type:'intervention-closeout',
      sourceInventorySnapshotId:clean(derived.snapshotId),
      sourceProjectName:clean(derived.sourceProjectName),
      sourceSchemaVersion:clean(derived.sourceSchemaVersion),
      designSnapshotId:clean(opts.designSnapshotId),
      designProjectName:clean(source.projName),
      baselineCapturedAt:clean(obj(previousWorkflow.interventionBaseline).capturedAt),
      closedAt,
      interventionActionCount:plan&&plan.ok?Number(plan.counts&&plan.counts.total||0):0
    }
  };

  return{
    ok:true,
    code:'closed',
    project:next,
    removed:{
      devices:[...removedDeviceIds],
      ports:[...removedPortIds],
      links:arr(source.links).length-arr(next.links).length,
      rackItems:arr(source.rackItems).length-arr(next.rackItems).length,
      powerConnections:arr(source.powerConnections).length-arr(next.powerConnections).length,
      patchConnections:arr(source.patchConnections).length-arr(next.patchConnections).length
    },
    summary:{
      keptDevices:keptDevices.length,
      removedDevices:removedDeviceIds.size,
      keptPorts:keptPorts.length,
      removedPorts:removedPortIds.size,
      interventionActionCount:next.workflow.updatedFrom.interventionActionCount,
      closedAt
    }
  };
}

const api={version:'netwizard-intervention-closeout-v1',isDerivedDesign,replacementValidation,buildUpdatedAsBuilt,defaultName};
root.NetWizardInterventionCloseout=api;
if(typeof module!=='undefined'&&module.exports)module.exports=api;
})(typeof window!=='undefined'?window:globalThis);
