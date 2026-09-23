/* NetWizard unified report model */
(function initNetWizardReportModel(root){
'use strict';
const arr=v=>Array.isArray(v)?v:[];
const clean=v=>String(v==null?'':v).trim();
const POE=root.NetWizardPoeModel||(typeof require==='function'?require('./netwizard-poe-model.js'):null);
const RACK=root.NetWizardRackModel||(typeof require==='function'?require('./netwizard-rack-model.js'):null);
const CABLING=root.NetWizardStructuredCabling||(typeof require==='function'?require('./netwizard-structured-cabling.js'):null);
const byId=(list,id)=>arr(list).find(x=>x&&x.id===id)||null;
function labelDevice(project,id){const d=byId(project&&project.devices,id);return d?d.name||d.id:'Sin equipo asignado';}
function labelPort(project,id){const p=byId(project&&project.ports,id);return p?`${labelDevice(project,p.deviceId)} · ${p.name||p.id}`:'Sin puerto asignado';}
function connectivity(project){return arr(project&&project.links).map(link=>({id:link.id,name:link.name||'Enlace',aPort:labelPort(project,link.aPortId||link.a),bPort:labelPort(project,link.bPortId||link.b),media:link.media||link.cableType||'No documentado',capacityMbps:link.capacityMbps||null,physicalPath:link.physicalPath||'No documentada',cableId:link.cableId||null}));}
function inventory(project){return arr(project&&project.devices).map(d=>({id:d.id,name:d.name||d.id,type:d.type||'unknown',vendor:d.vendor||d.vendorOs||d.platform||'',model:d.model||'',rackId:d.rackId||d.rack||null,rackUnit:d.rackUnit||null,heightUnits:d.rackUnits||d.heightU||1,powerDrawWatts:d.powerDrawWatts||null,poeBudgetWatts:d.poeBudgetW||d.poeBudgetWatts||null}));}
function mediaKind(value){
 const s=clean(value).toLowerCase();
 if(!s)return'other';
 if(/cat\s*[5678]|copper|utp|ftp|stp|rj45|base-?t/.test(s))return'copper';
 if(/multimode|multi-mode|\bmm\b|\bom[1-5]\b/.test(s))return'fiber-mm';
 if(/singlemode|single-mode|\bsm\b|\bos[12]\b/.test(s))return'fiber-sm';
 if(/\bfiber\b|\bfibre\b|ópt|optic/.test(s))return'fiber';
 if(/\bdac\b|direct attach|\baoc\b|active optical/.test(s))return'dac-aoc';
 if(/console|serial|rollover|usb/.test(s))return'console';
 return'other';
}
function mediaLabel(value){return clean(value)||'No documentado';}
function portIdFromLink(link,key){return link&&(link[key+'PortId']||link[key])||null;}
function buildPortMatrices(project,structuredCabling){
 const ports=arr(project&&project.ports),links=arr(project&&project.links),hosts=arr(project&&project.hosts);
 const linkByPort=new Map();
 for(const link of links){
   const a=portIdFromLink(link,'a'),b=portIdFromLink(link,'b');
   if(a&&!linkByPort.has(a))linkByPort.set(a,{link,otherId:b});
   if(b&&!linkByPort.has(b))linkByPort.set(b,{link,otherId:a});
 }
 const structuredByPort=new Map();
 for(const path of arr(structuredCabling&&structuredCabling.paths))if(path&&path.switchPortId&&!structuredByPort.has(path.switchPortId))structuredByPort.set(path.switchPortId,path);
 const hostByPort=new Map();
 for(const host of hosts){
   const id=host&&(host.portId||host.portRef||host.connectedPortId);
   if(id&&!hostByPort.has(id))hostByPort.set(id,host);
 }
 const devices=arr(project&&project.devices).slice().sort((a,b)=>clean(a&&a.name||a&&a.id).localeCompare(clean(b&&b.name||b&&b.id),undefined,{numeric:true,sensitivity:'base'}));
 return devices.map(device=>{
   const own=ports.filter(p=>p&&p.deviceId===device.id).slice().sort((a,b)=>clean(a.name||a.id).localeCompare(clean(b.name||b.id),undefined,{numeric:true,sensitivity:'base'}));
   const mapped=own.map(port=>{
     const direct=linkByPort.get(port.id);
     if(direct){
       const remote=byId(ports,direct.otherId),link=direct.link;
       const medium=link.media||link.cableType||port.media||'No documentado';
       return{id:port.id,name:port.name||port.id,destination:remote?labelDevice(project,remote.deviceId):'Extremo no documentado',remotePort:remote?remote.name||remote.id:'—',medium:mediaLabel(medium),mediaKind:mediaKind(medium),route:link.physicalPath||link.name||'Enlace directo',connectionType:'direct'};
     }
     const path=structuredByPort.get(port.id);
     if(path){
       const medium=path.cableType||port.media||'No documentado';
       return{id:port.id,name:port.name||port.id,destination:path.hostLabel||'Host no documentado',remotePort:path.outletLabel?`${path.outletLabel} · P${path.outletPort||1}`:'—',medium:mediaLabel(medium),mediaKind:mediaKind(medium),route:[path.panelLabel&&`${path.panelLabel} · P${path.patchPort||'—'}`,path.route].filter(Boolean).join(' → ')||'Cableado estructurado',connectionType:'structured'};
     }
     const host=hostByPort.get(port.id);
     if(host){
       const medium=port.media||'No documentado';
       return{id:port.id,name:port.name||port.id,destination:host.name||host.hostname||host.id,remotePort:'NIC / endpoint',medium:mediaLabel(medium),mediaKind:mediaKind(medium),route:'Host conectado directamente',connectionType:'host'};
     }
     const medium=port.media||'No documentado';
     return{id:port.id,name:port.name||port.id,destination:'Libre',remotePort:'—',medium:mediaLabel(medium),mediaKind:'free',route:port.desc||port.description||'Sin conexión documentada',connectionType:'free'};
   });
   return{deviceId:device.id,deviceName:device.name||device.id,rackId:device.rackId||device.rack||null,ports:mapped};
 }).filter(x=>x.ports.length);
}
function buildPowerMap(project,racks){
 const devices=arr(project&&project.devices),items=arr(racks&&racks.items),pdus=arr(project&&project.pdus),connections=arr(project&&project.powerConnections);
 const rackByDevice=new Map();
 for(const item of items)if(item&&item.deviceId&&item.rackId&&!rackByDevice.has(item.deviceId))rackByDevice.set(item.deviceId,item.rackId);
 const pduMap=new Map(pdus.map(p=>[p.id,p]));
 const rows=[];
 for(const device of devices){
   const rackId=device.rackId||device.rack||rackByDevice.get(device.id)||null;
   if(!rackId&&!connections.some(c=>c&&c.deviceId===device.id))continue;
   const own=connections.filter(c=>c&&c.deviceId===device.id).slice().sort((a,b)=>Number(a.powerSupplyIndex||0)-Number(b.powerSupplyIndex||0));
   if(!own.length){
     rows.push({rackId,deviceId:device.id,deviceName:device.name||device.id,psu:1,pduId:null,pduName:'Sin conexión declarada',outlet:null,feed:null,status:'missing'});
     continue;
   }
   for(const c of own){
     const pdu=pduMap.get(c.pduId);
     rows.push({rackId:rackId||(pdu&&pdu.rackId)||null,deviceId:device.id,deviceName:device.name||device.id,psu:Number(c.powerSupplyIndex||0)+1,pduId:c.pduId||null,pduName:pdu?pdu.name||pdu.id:c.pduId||'PDU no documentada',outlet:c.outlet||null,feed:c.feed||(pdu&&pdu.feed)||null,status:pdu?'connected':'invalid'});
   }
 }
 return{pdus:pdus.map(p=>({id:p.id,rackId:p.rackId||null,name:p.name||p.id,feed:p.feed||null,outletCount:p.outletCount||0,maxPowerWatts:p.maxPowerWatts||null})),rows};
}
function build(project,options){
 project=project||{};options=options||{};
 const gate=options.gateReport||{issues:[],counts:{}};
 const poe=POE?POE.collect(project):{contexts:[],loadsByPort:{},loadsByDevice:{}};
 const racks=RACK?RACK.validate(project):{racks:[],items:[],issues:[]};
 const rackMaterials=RACK?RACK.billOfMaterials(project):[];
 const cableMaterials=CABLING?CABLING.billOfMaterials(project):[];
 const materials=rackMaterials.concat(cableMaterials);
 const structuredCabling=CABLING?CABLING.validate(project):{issues:[],paths:[]};
 const rackTopologies=RACK&&typeof RACK.rackTopology==='function'?racks.racks.map(r=>RACK.rackTopology(project,r.id)):[];
 const portMatrices=buildPortMatrices(project,structuredCabling);
 const powerMap=buildPowerMap(project,racks);
 return{
   version:'netwizard-report-model-v3',
   project:{name:project.projName||project.name||'Red',schemaVersion:project._schemaVersion||null},
   summary:{devices:arr(project.devices).length,ports:arr(project.ports).length,links:arr(project.links).length,hosts:arr(project.hosts).length,vlans:arr(project.vlans).length,racks:racks.racks.length,wanCircuits:arr(project.wanCircuits).length,poeLoadWatts:Object.values(poe.loadsByDevice).reduce((a,b)=>a+Number(b||0),0)},
   connectivity:connectivity(project),inventory:inventory(project),materials,racks,rackTopologies,structuredCabling,portMatrices,powerMap,poe,findings:arr(gate.issues)
 };
}
const api={version:'netwizard-report-model-v2',build,connectivity,inventory,labelDevice,labelPort,mediaKind,mediaLabel,buildPortMatrices,buildPowerMap};
root.NetWizardReportModel=api;
if(typeof module!=='undefined'&&module.exports)module.exports=api;
})(typeof window!=='undefined'?window:globalThis);
