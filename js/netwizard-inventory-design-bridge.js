/* NetWizard Inventory -> Design Bridge v1 */
(function initNetWizardInventoryDesignBridge(root){
'use strict';

const DISPOSITIONS=Object.freeze(['keep','retire','replace','add']);
const arr=v=>Array.isArray(v)?v:[];
const obj=v=>v&&typeof v==='object'&&!Array.isArray(v)?v:{};
const clean=v=>String(v==null?'':v).trim();
const clone=v=>JSON.parse(JSON.stringify(v==null?null:v));
const nowIso=()=>new Date().toISOString();
function interventionPlanner(){
  if(root.NetWizardPhysicalInterventionPlan)return root.NetWizardPhysicalInterventionPlan;
  if(typeof require==='function'){try{return require('./netwizard-physical-intervention-plan.js');}catch(_e){}}
  return null;
}

function normalizeDisposition(value,fallback){
  const v=clean(value).toLowerCase();
  return DISPOSITIONS.includes(v)?v:(fallback||'keep');
}
function originRef(item){return clean(item&&item.originRef)||clean(item&&item.id);}
function markOrigin(list){
  return arr(list).map(item=>Object.assign({},item,{originRef:originRef(item)}));
}
function normalizeDerivedFrom(value){
  const v=obj(value);
  return {
    type:'inventory',
    snapshotId:clean(v.snapshotId),
    sourceProjectName:clean(v.sourceProjectName),
    sourceSchemaVersion:clean(v.sourceSchemaVersion),
    createdAt:clean(v.createdAt)
  };
}
function createDesignFromInventory(project,options){
  const source=clone(project||{}),opts=obj(options);
  const mode=clean(obj(source.workflow).mode||'design').toLowerCase();
  if(mode!=='inventory'&&!opts.allowNonInventory){
    return{ok:false,code:'source_not_inventory',message:'El proyecto origen debe estar en modo Inventario.',project:source};
  }

  const next=clone(source);
  const createdAt=clean(opts.createdAt)||nowIso();
  const sourceProjectName=clean(source.projName)||'Inventario';
  next.projName=clean(opts.name)||`${sourceProjectName} · Diseño To-Be`;
  const planner=interventionPlanner();
  next.workflow=Object.assign({},obj(source.workflow),{
    mode:'design',
    designPhase:'to-be',
    derivedFrom:normalizeDerivedFrom({
      snapshotId:opts.snapshotId,
      sourceProjectName,
      sourceSchemaVersion:source._schemaVersion||source.schemaVersion||'',
      createdAt
    }),
    interventionBaseline:planner&&planner.captureBaseline?planner.captureBaseline(source,{capturedAt:createdAt}):null
  });
  next.step='loc';
  next.selected=null;

  // Mantener evidencia observada; el diseño se construye encima del As-Built.
  next.physicalLocations=markOrigin(next.physicalLocations);
  next.racks=markOrigin(next.racks);
  next.rackItems=markOrigin(next.rackItems);
  next.pdus=markOrigin(next.pdus);
  next.powerConnections=markOrigin(next.powerConnections);
  next.patchPanels=markOrigin(next.patchPanels);
  next.telecomOutlets=markOrigin(next.telecomOutlets);
  next.cableRuns=markOrigin(next.cableRuns);
  next.patchConnections=markOrigin(next.patchConnections);
  next.hostOutletConnections=markOrigin(next.hostOutletConnections);
  next.ports=markOrigin(next.ports);
  next.links=markOrigin(next.links);
  next.hosts=markOrigin(next.hosts);

  next.devices=arr(next.devices).map(device=>Object.assign({},device,{
    originRef:originRef(device),
    designDisposition:normalizeDisposition(device.designDisposition,'keep')
  }));

  return{
    ok:true,
    code:'derived',
    project:next,
    source:source,
    summary:summarize(next)
  };
}
function setDeviceDisposition(project,deviceId,disposition,options){
  const next=clone(project||{}),id=clean(deviceId),status=normalizeDisposition(disposition,'keep'),opts=obj(options);
  const device=arr(next.devices).find(d=>d&&d.id===id);
  if(!device)return{ok:false,code:'device_not_found',message:'No se encuentra el equipo.',project:next};
  const hasOrigin=!!clean(device.originRef);
  if(hasOrigin&&status==='add')return{ok:false,code:'invalid_disposition_transition',message:'Un equipo procedente del As-Built no puede marcarse como Añadir.',project:next};
  if(!hasOrigin&&status!=='add')return{ok:false,code:'invalid_disposition_transition',message:'Un equipo nuevo solo puede marcarse como Añadir.',project:next};
  device.designDisposition=status;
  if(status==='replace'){
    device.replacementNote=clean(opts.replacementNote||device.replacementNote);
    device.replacementDeviceRef=clean(opts.replacementDeviceRef||device.replacementDeviceRef);
  }else{
    delete device.replacementNote;
    delete device.replacementDeviceRef;
  }
  return{ok:true,project:next,device:clone(device)};
}
function normalizeDeviceForSummary(device){
  const hasOrigin=!!clean(device&&device.originRef);
  return Object.assign({},device,{
    designDisposition:hasOrigin?normalizeDisposition(device&&device.designDisposition,'keep'):'add'
  });
}
function summarize(project){
  const devices=arr(project&&project.devices).map(normalizeDeviceForSummary);
  const groups={keep:[],retire:[],replace:[],add:[]};
  for(const d of devices)groups[d.designDisposition].push(d);
  return{
    version:'netwizard-inventory-to-design-summary-v1',
    source:normalizeDerivedFrom(obj(obj(project&&project.workflow).derivedFrom)),
    counts:{
      keep:groups.keep.length,
      retire:groups.retire.length,
      replace:groups.replace.length,
      add:groups.add.length,
      total:devices.length
    },
    devices:groups
  };
}
function buildPhysicalChangeSet(project){
  const summary=summarize(project),rows=[];
  for(const status of DISPOSITIONS){
    for(const d of summary.devices[status]){
      rows.push({
        deviceId:d.id,
        originRef:clean(d.originRef)||null,
        name:d.name||d.id,
        manufacturer:d.manufacturer||'',
        model:d.model||'',
        rackId:d.rackId||d.rack||'',
        rackUnit:d.rackUnit==null?null:d.rackUnit,
        disposition:status,
        replacementDeviceRef:d.replacementDeviceRef||null,
        replacementNote:d.replacementNote||''
      });
    }
  }
  return{
    version:'netwizard-physical-change-set-v1',
    source:summary.source,
    counts:summary.counts,
    devices:rows,
    actionable:rows.filter(x=>x.disposition!=='keep')
  };
}

const api={
  version:'netwizard-inventory-design-bridge-v1',
  dispositions:DISPOSITIONS.slice(),
  createDesignFromInventory,
  setDeviceDisposition,
  summarize,
  buildPhysicalChangeSet
};
root.NetWizardInventoryDesignBridge=api;
if(typeof module!=='undefined'&&module.exports)module.exports=api;
})(typeof window!=='undefined'?window:globalThis);
