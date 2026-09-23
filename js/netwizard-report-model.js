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
function linkPortA(link){return link&&(link.aPortId||link.a||link.fromPortId||link.from||link.portA)||null;}
function linkPortB(link){return link&&(link.bPortId||link.b||link.toPortId||link.to||link.portB)||null;}
function connectivity(project){return arr(project&&project.links).map(link=>({id:link.id,name:link.name||link.label||'Enlace',aPort:labelPort(project,linkPortA(link)),bPort:labelPort(project,linkPortB(link)),media:link.media||link.medium||link.cableType||'No documentado',capacityMbps:link.capacityMbps||null,physicalPath:link.physicalPath||link.route||'No documentada',cableId:link.cableId||null}));}
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
function portIdFromLink(link,key){return key==='a'?linkPortA(link):linkPortB(link);}
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
       const medium=link.media||link.medium||link.cableType||port.media||'No documentado';
       return{id:port.id,name:port.name||port.id,destination:remote?labelDevice(project,remote.deviceId):'Extremo no documentado',remotePort:remote?remote.name||remote.id:'—',medium:mediaLabel(medium),mediaKind:mediaKind(medium),route:link.physicalPath||link.route||link.name||link.label||'Enlace directo',connectionType:'direct'};
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
function buildStructuredChains(project,structuredCabling){
 const ports=arr(project&&project.ports),devices=arr(project&&project.devices),panels=arr(project&&project.patchPanels),outlets=arr(project&&project.telecomOutlets),hosts=arr(project&&project.hosts),locations=arr(project&&project.physicalLocations);
 return arr(structuredCabling&&structuredCabling.paths).map(path=>{
   const port=byId(ports,path.switchPortId),device=port?byId(devices,port.deviceId):null,panel=byId(panels,path.patchPanelId),outlet=byId(outlets,path.outletId),host=byId(hosts,path.hostId),location=outlet?byId(locations,outlet.locationId):null;
   const missing=[];
   if(!port)missing.push('puerto de switch');
   if(!panel)missing.push('patch panel');
   if(!outlet)missing.push('toma');
   if(!host)missing.push('equipo final');
   const lengths=[path.patchCordLengthM,path.lengthM,path.hostCordLengthM].map(Number).filter(Number.isFinite);
   return{
     id:path.id,label:path.label||path.id,rackId:panel&&panel.rackId||null,
     switchPortId:path.switchPortId||null,switchDeviceId:device&&device.id||null,switchDeviceName:device?device.name||device.id:'Sin switch',switchPortName:port?port.name||port.id:'Sin puerto',
     patchCordLengthM:path.patchCordLengthM,patchPanelId:path.patchPanelId||null,patchPanelName:panel?panel.name||panel.id:path.panelLabel||'Sin patch panel',patchPort:path.patchPort||null,
     cableType:path.cableType||'No documentado',lengthM:path.lengthM,route:path.route||'Ruta no documentada',
     outletId:path.outletId||null,outletName:outlet?outlet.name||outlet.id:path.outletLabel||'Sin toma',outletPort:path.outletPort||1,locationName:location?location.name||location.id:'Ubicación no documentada',
     hostId:path.hostId||null,hostName:host?host.name||host.hostname||host.id:path.hostLabel||'Sin equipo final',hostCordLengthM:path.hostCordLengthM,
     totalLengthM:lengths.length?lengths.reduce((a,b)=>a+b,0):null,complete:!!path.complete&&!missing.length,missing
   };
 });
}
function buildRackSummaries(project,racks,structuredChains,powerMap){
 const devices=arr(project&&project.devices),ports=arr(project&&project.ports),links=arr(project&&project.links),items=arr(racks&&racks.items),rackIssues=arr(racks&&racks.issues),panels=arr(project&&project.patchPanels),pdus=arr(project&&project.pdus);
 const rackByDevice=new Map();
 for(const d of devices)if(d&&(d.rackId||d.rack))rackByDevice.set(d.id,d.rackId||d.rack);
 for(const item of items)if(item&&item.deviceId&&item.rackId&&!rackByDevice.has(item.deviceId))rackByDevice.set(item.deviceId,item.rackId);
 const portById=new Map(ports.map(p=>[p.id,p]));
 return arr(racks&&racks.racks).map(rack=>{
   const ownItems=items.filter(i=>i.rackId===rack.id),ownDevices=devices.filter(d=>rackByDevice.get(d.id)===rack.id),deviceIds=new Set(ownDevices.map(d=>d.id)),used=new Set();
   for(const item of ownItems)for(let u=Number(item.startUnit);Number.isFinite(u)&&u<Number(item.startUnit)+Number(item.heightUnits||1);u++)used.add(u);
   const dataLinks=links.filter(link=>{const a=portById.get(linkPortA(link)),b=portById.get(linkPortB(link));return !!((a&&deviceIds.has(a.deviceId))||(b&&deviceIds.has(b.deviceId)));});
   const chains=structuredChains.filter(x=>x.rackId===rack.id);
   const ownPower=arr(powerMap&&powerMap.rows).filter(x=>x.rackId===rack.id);
   const feeds=[...new Set(ownPower.map(x=>clean(x.feed)).filter(Boolean))];
   return{
     rackId:rack.id,rackName:rack.name||rack.id,locationId:rack.locationId||null,totalUnits:rack.rackUnits||42,usedUnits:used.size,freeUnits:Math.max(0,Number(rack.rackUnits||42)-used.size),
     devices:ownDevices.length,passiveItems:ownItems.filter(i=>!i.deviceId).length,patchPanels:panels.filter(p=>p.rackId===rack.id).length,pdus:pdus.filter(p=>p.rackId===rack.id).length,
     dataLinks:dataLinks.length,structuredRuns:chains.length,powerConnections:ownPower.filter(x=>x.status==='connected').length,missingPower:ownPower.filter(x=>x.status!=='connected').length,feeds,issues:rackIssues.filter(i=>i.rackId===rack.id).length
   };
 });
}
function buildInstallationChecklist(project,rackSummaries,structuredChains,powerMap){
 const tasks=[],devices=arr(project&&project.devices),items=arr(project&&project.rackItems),ports=arr(project&&project.ports),portById=new Map(ports.map(p=>[p.id,p]));
 const rackByDevice=new Map();
 for(const d of devices)if(d&&(d.rackId||d.rack))rackByDevice.set(d.id,d.rackId||d.rack);
 for(const item of items)if(item&&item.deviceId&&item.rackId&&!rackByDevice.has(item.deviceId))rackByDevice.set(item.deviceId,item.rackId);
 const push=(rackId,category,task,reference,documented=true)=>tasks.push({rackId:rackId||null,category,task,reference:reference||'—',documented:!!documented});
 for(const item of items)push(item.rackId,'Montaje',`Montar ${item.label||item.name||item.id} en ${Number.isFinite(Number(item.startUnit))?'U'+item.startUnit:'posición definida'}`,item.face||'front',Number.isFinite(Number(item.startUnit))||String(item.mounting||'').startsWith('vertical'));
 for(const link of arr(project&&project.links)){
   const a=portById.get(linkPortA(link)),b=portById.get(linkPortB(link)),rackId=a&&rackByDevice.get(a.deviceId)||b&&rackByDevice.get(b.deviceId)||null;
   push(rackId,'Datos',`Conectar ${labelPort(project,linkPortA(link))} ↔ ${labelPort(project,linkPortB(link))}`,[link.media||link.medium||link.cableType,link.physicalPath||link.route].filter(Boolean).join(' · '),!!(a&&b));
 }
 for(const chain of structuredChains){
   push(chain.rackId,'Parcheo',`Conectar ${chain.switchDeviceName} · ${chain.switchPortName} → ${chain.patchPanelName} · P${chain.patchPort||'—'}`,chain.patchCordLengthM!=null?`Latiguillo ${chain.patchCordLengthM} m`:'Latiguillo rack',!!chain.switchPortId);
   push(chain.rackId,'Cableado',`Tender ${chain.patchPanelName} · P${chain.patchPort||'—'} → ${chain.outletName} · P${chain.outletPort||1}`,[chain.cableType,chain.lengthM!=null?`${chain.lengthM} m`:null,chain.route].filter(Boolean).join(' · '),!!(chain.patchPanelId&&chain.outletId));
   push(chain.rackId,'Puesto final',`Conectar ${chain.outletName} · P${chain.outletPort||1} → ${chain.hostName}`,chain.hostCordLengthM!=null?`Latiguillo ${chain.hostCordLengthM} m`:'Latiguillo usuario',!!chain.hostId);
   push(chain.rackId,'Etiquetado',`Etiquetar ambos extremos de ${chain.label}`,`${chain.patchPanelName} P${chain.patchPort||'—'} / ${chain.outletName} P${chain.outletPort||1}`,chain.complete);
   push(chain.rackId,'Certificación',`Certificar enlace ${chain.label}`,chain.cableType,chain.complete);
 }
 for(const row of arr(powerMap&&powerMap.rows))push(row.rackId,'Energía',`Conectar ${row.deviceName} PSU-${row.psu} → ${row.pduName}`,row.outlet?`Toma ${row.outlet} · feed ${row.feed||'—'}`:'Sin toma documentada',row.status==='connected');
 for(const rack of rackSummaries)push(rack.rackId,'Verificación',`Verificar rack ${rack.rackName}: enlaces, alimentación y etiquetado`,`${rack.devices} equipos · ${rack.dataLinks+rack.structuredRuns} enlaces de datos`,rack.missingPower===0&&rack.issues===0);
 return tasks;
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
 const structuredChains=buildStructuredChains(project,structuredCabling);
 const rackSummaries=buildRackSummaries(project,racks,structuredChains,powerMap);
 const installationChecklist=buildInstallationChecklist(project,rackSummaries,structuredChains,powerMap);
 return{
   version:'netwizard-report-model-v3',
   project:{name:project.projName||project.name||'Red',schemaVersion:project._schemaVersion||null},
   summary:{devices:arr(project.devices).length,ports:arr(project.ports).length,links:arr(project.links).length,hosts:arr(project.hosts).length,vlans:arr(project.vlans).length,racks:racks.racks.length,wanCircuits:arr(project.wanCircuits).length,poeLoadWatts:Object.values(poe.loadsByDevice).reduce((a,b)=>a+Number(b||0),0)},
   connectivity:connectivity(project),inventory:inventory(project),materials,racks,rackTopologies,structuredCabling,structuredChains,portMatrices,powerMap,rackSummaries,installationChecklist,poe,findings:arr(gate.issues)
 };
}
const api={version:'netwizard-report-model-v3',build,connectivity,inventory,labelDevice,labelPort,linkPortA,linkPortB,mediaKind,mediaLabel,buildPortMatrices,buildPowerMap,buildStructuredChains,buildRackSummaries,buildInstallationChecklist};
root.NetWizardReportModel=api;
if(typeof module!=='undefined'&&module.exports)module.exports=api;
})(typeof window!=='undefined'?window:globalThis);
