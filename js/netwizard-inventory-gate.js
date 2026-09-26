/* NetWizard Inventory Gate v1
 * Valida consistencia documental del As-Built sin exigir diseño lógico.
 */
(function initNetWizardInventoryGate(root){
'use strict';

const arr=v=>Array.isArray(v)?v:[];
const clean=v=>String(v==null?'':v).trim();
function tryRequire(path){try{return typeof require==='function'?require(path):null;}catch{return null;}}
function physicalApi(){return root.NetWizardPhysicalInventory||tryRequire('./netwizard-physical-inventory.js');}
function rackApi(){return root.NetWizardRackModel||tryRequire('./netwizard-rack-model.js');}
function cablingApi(){return root.NetWizardStructuredCabling||tryRequire('./netwizard-structured-cabling.js');}

function issue(code,severity,message,extra){
  return Object.assign({
    code,
    severity,
    blocking:severity==='error',
    category:'inventory',
    source:'inventory-gate',
    message
  },extra||{});
}
function keyOf(i){
  return [i&&i.code,i&&i.severity,i&&i.deviceId,i&&i.portId,i&&i.rackId,i&&i.patchPanelId,i&&i.cableRunId,i&&i.message].join('\u0001');
}
function mergeIssues(){
  const seen=new Set(),out=[];
  for(const group of arguments){
    for(const item of arr(group)){
      const key=keyOf(item);
      if(seen.has(key))continue;
      seen.add(key);out.push(item);
    }
  }
  return out;
}
function locationIdForDevice(device){
  return clean(device&&device.locationId)||clean(device&&device.physicalLocationId)||'';
}
function rackIdForDevice(device){return clean(device&&(device.rackId||device.rack));}
function duplicateFieldIssues(project,field,label,code){
  const map=new Map(),out=[];
  for(const d of arr(project&&project.devices)){
    const value=clean(d&&d[field]);
    if(!value)continue;
    const key=value.toLowerCase();
    if(!map.has(key)){map.set(key,d);continue;}
    const previous=map.get(key);
    out.push(issue(code,'error',`${label} duplicado "${value}" en ${previous.name||previous.id} y ${d.name||d.id}.`,{deviceId:d.id,otherDeviceId:previous.id,field}));
  }
  return out;
}
function documentaryIssues(project){
  const p=project||{},issues=[];
  const locations=arr(p.physicalLocations),racks=arr(p.racks),devices=arr(p.devices),ports=arr(p.ports),links=arr(p.links);
  const locationIds=new Set(locations.map(x=>x&&x.id).filter(Boolean));
  const rackIds=new Set(racks.map(x=>x&&x.id).filter(Boolean));
  const deviceIds=new Set(devices.map(x=>x&&x.id).filter(Boolean));
  const portIds=new Set(ports.map(x=>x&&x.id).filter(Boolean));

  if(!locations.length)issues.push(issue('NW-INV-001','error','El inventario no tiene ninguna ubicación física definida.'));
  if(!devices.length)issues.push(issue('NW-INV-002','warning','No hay equipos inventariados todavía.'));

  for(const loc of locations){
    const mode=clean(loc&&loc.inventoryRackMode).toLowerCase();
    if(mode&&!['rack','wall-cabinet','none','unknown'].includes(mode)){
      issues.push(issue('NW-INV-003','warning',`${loc.name||loc.id}: estado de rack no reconocido (${mode}).`,{locationId:loc.id}));
    }
    if(!mode){
      const hasRack=racks.some(r=>r&&r.locationId===loc.id);
      if(!hasRack)issues.push(issue('NW-INV-101','warning',`${loc.name||loc.id}: indica si existe rack/armario o si la ubicación no dispone de él.`,{locationId:loc.id}));
    }
  }

  for(const rack of racks){
    if(rack.locationId&&!locationIds.has(rack.locationId))issues.push(issue('NW-INV-004','error',`${rack.name||rack.id}: ubicación inexistente (${rack.locationId}).`,{rackId:rack.id,locationId:rack.locationId}));
    if(!rack.locationId)issues.push(issue('NW-INV-102','warning',`${rack.name||rack.id}: no tiene ubicación física asignada.`,{rackId:rack.id}));
  }

  for(const d of devices){
    const locationId=locationIdForDevice(d),rackId=rackIdForDevice(d);
    if(locationId&&!locationIds.has(locationId))issues.push(issue('NW-INV-005','error',`${d.name||d.id}: ubicación inexistente (${locationId}).`,{deviceId:d.id,locationId}));
    if(rackId&&!rackIds.has(rackId))issues.push(issue('NW-INV-006','error',`${d.name||d.id}: rack inexistente (${rackId}).`,{deviceId:d.id,rackId}));
    if(!locationId&&!rackId)issues.push(issue('NW-INV-103','warning',`${d.name||d.id}: falta ubicación/rack observado.`,{deviceId:d.id}));
    if(!clean(d.manufacturer)&&!clean(d.vendor)&&!clean(d.vendorOs))issues.push(issue('NW-INV-104','warning',`${d.name||d.id}: fabricante/plataforma no documentado.`,{deviceId:d.id}));
    if(!clean(d.model))issues.push(issue('NW-INV-105','warning',`${d.name||d.id}: modelo no documentado.`,{deviceId:d.id}));
    if(!clean(d.serialNumber)&&!clean(d.assetTag))issues.push(issue('NW-INV-106','warning',`${d.name||d.id}: falta número de serie o asset tag.`,{deviceId:d.id}));
    if(!ports.some(pt=>pt&&pt.deviceId===d.id))issues.push(issue('NW-INV-107','warning',`${d.name||d.id}: no tiene puertos físicos documentados.`,{deviceId:d.id}));
  }

  issues.push(...duplicateFieldIssues(p,'serialNumber','Número de serie','NW-INV-007'));
  issues.push(...duplicateFieldIssues(p,'assetTag','Asset tag','NW-INV-008'));

  const usedPorts=new Map();
  for(const link of links){
    const endpoints=[link&& (link.aPortId||link.a||link.fromPortId||link.from||link.portA),link&& (link.bPortId||link.b||link.toPortId||link.to||link.portB)].filter(Boolean);
    if(endpoints.length!==2)issues.push(issue('NW-INV-009','error',`${link.name||link.id||'Enlace'}: extremos físicos incompletos.`,{linkId:link.id}));
    for(const id of endpoints){
      if(!portIds.has(id)){issues.push(issue('NW-INV-010','error',`${link.name||link.id||'Enlace'}: puerto inexistente (${id}).`,{linkId:link.id,portId:id}));continue;}
      if(usedPorts.has(id))issues.push(issue('NW-INV-011','error',`El puerto ${id} aparece en más de un enlace físico (${usedPorts.get(id)} y ${link.id||'sin id'}).`,{linkId:link.id,portId:id}));
      else usedPorts.set(id,link.id||'enlace');
    }
  }

  for(const port of ports){
    if(port.deviceId&&!deviceIds.has(port.deviceId))issues.push(issue('NW-INV-012','error',`${port.name||port.id}: referencia un equipo inexistente (${port.deviceId}).`,{portId:port.id,deviceId:port.deviceId}));
    if(!clean(port.media))issues.push(issue('NW-INV-108','warning',`${port.name||port.id}: medio físico no documentado.`,{portId:port.id,deviceId:port.deviceId}));
    if(port.speedMaxMbps==null&&port.speedMbps==null)issues.push(issue('NW-INV-109','warning',`${port.name||port.id}: velocidad máxima no documentada.`,{portId:port.id,deviceId:port.deviceId}));
  }

  return issues;
}
function progress(project){
  const p=project||{},locations=arr(p.physicalLocations),racks=arr(p.racks),devices=arr(p.devices),ports=arr(p.ports);
  const rackDeclared=locations.length>0&&locations.every(loc=>{
    const mode=clean(loc&&loc.inventoryRackMode).toLowerCase();
    return ['rack','wall-cabinet','none'].includes(mode)||racks.some(r=>r&&r.locationId===loc.id);
  });
  const rackDevices=devices.filter(d=>rackIdForDevice(d)).length;
  const powerDocumented=arr(p.pdus).length>0||arr(p.powerConnections).length>0;
  const cablingDocumented=arr(p.links).length>0||arr(p.cableRuns).length>0||arr(p.patchPanels).length>0||arr(p.telecomOutlets).length>0;
  const logicalObserved=arr(p.vlans).length>0||arr(p.subnets).length>0||!!p.observedState;
  const steps=[
    {id:'locations',label:'Ubicaciones',required:true,complete:locations.length>0,detail:`${locations.length} ubicación(es)`},
    {id:'racks',label:'Rack / armario',required:true,complete:rackDeclared,detail:`${racks.length} rack(s) documentado(s)`},
    {id:'equipment',label:'Equipos y ocupación',required:true,complete:devices.length>0,detail:`${devices.length} equipo(s) · ${rackDevices} en rack`},
    {id:'power',label:'Alimentación',required:false,complete:powerDocumented,detail:`${arr(p.pdus).length} PDU · ${arr(p.powerConnections).length} conexión(es)`},
    {id:'ports',label:'Puertos físicos',required:true,complete:ports.length>0,detail:`${ports.length} puerto(s)`},
    {id:'cabling',label:'Cableado y conexiones',required:false,complete:cablingDocumented,detail:`${arr(p.links).length+arr(p.cableRuns).length} enlace(s)/tramo(s)`},
    {id:'logical',label:'Lógica observada',required:false,complete:logicalObserved,detail:'Opcional'}
  ];
  const required=steps.filter(x=>x.required),requiredComplete=required.filter(x=>x.complete).length;
  return{steps,requiredComplete,requiredTotal:required.length,percent:required.length?Math.round(requiredComplete*100/required.length):100};
}
function run(project){
  const p=project||{};
  const physicalModule=physicalApi(),rackModule=rackApi(),cablingModule=cablingApi();
  const physical=physicalModule&&typeof physicalModule.validateProject==='function'?physicalModule.validateProject(p):{issues:[]};
  const rack=rackModule&&typeof rackModule.validate==='function'?rackModule.validate(p):{issues:[]};
  const cabling=cablingModule&&typeof cablingModule.validate==='function'?cablingModule.validate(p):{issues:[]};
  const issues=mergeIssues(documentaryIssues(p),physical.issues,rack.issues,cabling.issues);
  const blocking=issues.filter(i=>i&&(i.blocking||i.severity==='error'));
  const warnings=issues.filter(i=>i&&i.severity==='warning');
  const info=issues.filter(i=>i&&i.severity==='info');
  const status=blocking.length?'blocked':warnings.length?'review':'ready';
  return{
    version:'netwizard-inventory-gate-v1',
    ok:!blocking.length,
    ready:status==='ready',
    canExportAsBuilt:!blocking.length,
    status,
    issues,
    counts:{blocking:blocking.length,errors:blocking.length,warnings:warnings.length,info:info.length},
    progress:progress(p),
    physicalInventory:physical,
    racks:rack,
    structuredCabling:cabling
  };
}
function summarize(report){
  const r=report||{counts:{},progress:{requiredComplete:0,requiredTotal:0,percent:0}};
  const state=r.status==='blocked'?'BLOQUEADO':r.status==='review'?'REVISAR':'LISTO';
  return `${state} · ${r.counts&&r.counts.blocking||0} bloqueos · ${r.counts&&r.counts.warnings||0} avisos · captura esencial ${r.progress&&r.progress.requiredComplete||0}/${r.progress&&r.progress.requiredTotal||0} (${r.progress&&r.progress.percent||0}%)`;
}

const api={version:'netwizard-inventory-gate-v1',run,progress,documentaryIssues,mergeIssues,summarize};
root.NetWizardInventoryGate=api;
if(typeof module!=='undefined'&&module.exports)module.exports=api;
})(typeof window!=='undefined'?window:globalThis);
