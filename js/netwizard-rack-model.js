/* NetWizard Rack Model v1 */
(function initNetWizardRackModel(root){
'use strict';
const arr=v=>Array.isArray(v)?v:[];
const num=v=>{const n=Number(v);return Number.isFinite(n)?n:null;};
const clean=v=>String(v==null?'':v).trim();
const byId=(list,id)=>arr(list).find(x=>x&&x.id===id)||null;
const CABLING=root.NetWizardStructuredCabling||(typeof require==='function'?require('./netwizard-structured-cabling.js'):null);
function normalizeRack(rack){const units=num(rack&&rack.rackUnits);return Object.assign({},rack,{rackUnits:units&&units>0?Math.floor(units):42,numberingDirection:rack&&rack.numberingDirection==='top-down'?'top-down':'bottom-up'});}
function deviceRackItem(device){if(!device||!clean(device.rackId||device.rack))return null;return{id:`rackitem-device-${device.id}`,rackId:device.rackId||device.rack,type:'device',deviceId:device.id,label:device.name||device.id,startUnit:num(device.rackUnit),heightUnits:num(device.rackUnits||device.heightU)||1,face:device.rackFace||'front',weightKg:num(device.weightKg),powerDrawWatts:num(device.powerDrawWatts)};}
function allRackItems(project){const explicit=arr(project&&project.rackItems).map(x=>Object.assign({},x));const deviceItems=arr(project&&project.devices).map(deviceRackItem).filter(Boolean);const existingDevices=new Set(explicit.filter(x=>x&&x.deviceId).map(x=>x.deviceId));return explicit.concat(deviceItems.filter(x=>!existingDevices.has(x.deviceId)));}
function occupiedUnits(item){const start=num(item&&item.startUnit),height=num(item&&item.heightUnits);if(start==null||height==null||height<=0)return[];return Array.from({length:Math.floor(height)},(_,i)=>Math.floor(start)+i);}
function issue(code,severity,message,extra){return Object.assign({code,severity,blocking:severity==='error',category:'rack',message,source:'rack'},extra||{});}
function validate(project){const issues=[],racks=arr(project&&project.racks).map(normalizeRack),items=allRackItems(project),rackMap=new Map(racks.map(r=>[r.id,r]));const occupancy=new Map();
 for(const item of items){const rack=rackMap.get(item.rackId);if(!rack){issues.push(issue('NW-RACK-003','error',`${item.label||item.id}: referencia un rack inexistente (${item.rackId}).`,{rackItemId:item.id,rackId:item.rackId}));continue;}const units=occupiedUnits(item);if(!units.length&&item.mounting!=='vertical-left'&&item.mounting!=='vertical-right'&&item.mounting!=='vertical-rear'){issues.push(issue('NW-RACK-002','error',`${item.label||item.id}: posición o altura de rack inválida.`,{rackItemId:item.id,rackId:item.rackId}));continue;}for(const u of units){if(u<1||u>rack.rackUnits)issues.push(issue('NW-RACK-002','error',`${item.label||item.id}: ocupa U${u}, fuera del rango 1-${rack.rackUnits}.`,{rackItemId:item.id,rackId:item.rackId,unit:u}));const key=`${rack.id}|${item.face||'front'}|${u}`;if(occupancy.has(key)){const other=occupancy.get(key);issues.push(issue('NW-RACK-001','error',`${item.label||item.id} colisiona con ${other.label||other.id} en ${rack.name||rack.id} U${u}.`,{rackId:rack.id,unit:u,rackItemId:item.id,otherRackItemId:other.id}));}else occupancy.set(key,item);}}
 for(const rack of racks){const rackItems=items.filter(x=>x.rackId===rack.id);const weight=rackItems.reduce((s,x)=>s+(num(x.weightKg)||0),0);const draw=rackItems.reduce((s,x)=>s+(num(x.powerDrawWatts)||0),0);if(num(rack.maxLoadKg)!=null&&weight>num(rack.maxLoadKg))issues.push(issue('NW-RACK-004','error',`${rack.name||rack.id}: peso ${weight} kg supera el máximo ${rack.maxLoadKg} kg.`,{rackId:rack.id}));if(num(rack.powerCapacityWatts)!=null&&draw>num(rack.powerCapacityWatts))issues.push(issue('NW-RACK-005','error',`${rack.name||rack.id}: consumo ${draw} W supera capacidad ${rack.powerCapacityWatts} W.`,{rackId:rack.id}));if(num(rack.coolingCapacityWatts)!=null&&draw>num(rack.coolingCapacityWatts))issues.push(issue('NW-RACK-006','warning',`${rack.name||rack.id}: carga térmica estimada ${draw} W supera refrigeración declarada ${rack.coolingCapacityWatts} W.`,{rackId:rack.id}));}
 const pduMap=new Map(arr(project&&project.pdus).map(p=>[p.id,p]));const deviceMap=new Map(arr(project&&project.devices).map(d=>[d.id,d]));
 const outlets=new Map();for(const c of arr(project&&project.powerConnections)){if(!pduMap.has(c.pduId)){issues.push(issue('NW-RACK-009','error',`Conexión ${c.id||'eléctrica'} referencia una PDU inexistente (${c.pduId||'sin id'}).`,{powerConnectionId:c.id,pduId:c.pduId}));continue;}if(!deviceMap.has(c.deviceId)){issues.push(issue('NW-RACK-010','error',`Conexión ${c.id||'eléctrica'} referencia un equipo inexistente (${c.deviceId||'sin id'}).`,{powerConnectionId:c.id,deviceId:c.deviceId}));continue;}const key=`${c.pduId}|${c.outlet}`;if(outlets.has(key))issues.push(issue('NW-RACK-007','error',`La toma ${c.outlet} de ${c.pduId} está asignada a más de una conexión.`,{powerConnectionId:c.id,pduId:c.pduId,outlet:c.outlet}));else outlets.set(key,c);}
 const byDevice=new Map();for(const c of arr(project&&project.powerConnections)){if(!c.deviceId)continue;const list=byDevice.get(c.deviceId)||[];list.push(c);byDevice.set(c.deviceId,list);}for(const [deviceId,connections] of byDevice){if(connections.length>1){const feeds=new Set(connections.map(c=>clean(c.feed||c.pduId)));if(feeds.size<connections.length)issues.push(issue('NW-RACK-008','warning',`${byId(project&&project.devices,deviceId)?.name||deviceId}: fuentes redundantes comparten la misma alimentación.`,{deviceId}));}}
 return{version:'netwizard-rack-model-v1',ok:!issues.some(i=>i.blocking),issues,counts:{blocking:issues.filter(i=>i.blocking).length,warnings:issues.filter(i=>i.severity==='warning').length},racks,items,occupancy:Object.fromEntries(occupancy)};
}
function rackTopology(project,rackId){
 const rack=byId(project&&project.racks,rackId);if(!rack)return{rack:null,nodes:[],dataEdges:[],powerEdges:[]};
 const items=allRackItems(project).filter(x=>x.rackId===rackId),deviceIds=new Set(items.filter(x=>x.deviceId).map(x=>x.deviceId));
 for(const d of arr(project&&project.devices))if((d.rackId||d.rack)===rackId)deviceIds.add(d.id);
 const nodes=[];
 for(const d of arr(project&&project.devices).filter(x=>deviceIds.has(x.id)))nodes.push({id:d.id,kind:'device',label:d.name||d.id,rackUnit:d.rackUnit||null,heightUnits:d.rackUnits||d.heightU||1});
 for(const i of items.filter(x=>x.type!=='device'))nodes.push({id:i.id,kind:i.type||'rack-item',label:i.label||i.name||i.id,rackUnit:i.startUnit||null,heightUnits:i.heightUnits||1});
 for(const p of arr(project&&project.pdus).filter(x=>x.rackId===rackId))nodes.push({id:p.id,kind:'pdu',label:p.name||p.id,feed:p.feed||null,outletCount:p.outletCount||0});
 const portMap=new Map(arr(project&&project.ports).map(p=>[p.id,p]));
 const devMap=new Map(arr(project&&project.devices).map(d=>[d.id,d]));
 const dataEdges=[];
 for(const link of arr(project&&project.links)){
   const a=portMap.get(link.aPortId),b=portMap.get(link.bPortId);if(!a||!b)continue;
   const aIn=deviceIds.has(a.deviceId),bIn=deviceIds.has(b.deviceId);if(!aIn&&!bIn)continue;
   const da=devMap.get(a.deviceId),db=devMap.get(b.deviceId);
   dataEdges.push({id:link.id,kind:'data',internal:aIn&&bIn,fromDeviceId:a.deviceId,toDeviceId:b.deviceId,fromLabel:`${da?.name||a.deviceId} · ${a.name||a.id}`,toLabel:`${db?.name||b.deviceId} · ${b.name||b.id}`,media:link.media||link.cableType||null,capacityMbps:link.capacityMbps||null,physicalPath:link.physicalPath||null});
 }
 const pduMap2=new Map(arr(project&&project.pdus).map(p=>[p.id,p]));
 const powerEdges=arr(project&&project.powerConnections).filter(x=>deviceIds.has(x.deviceId)||pduMap2.get(x.pduId)?.rackId===rackId).map(x=>{const d=devMap.get(x.deviceId),p=pduMap2.get(x.pduId);return{id:x.id,kind:'power',deviceId:x.deviceId,pduId:x.pduId,fromLabel:`${d?.name||x.deviceId} PSU-${Number(x.powerSupplyIndex||0)+1}`,toLabel:`${p?.name||x.pduId} · toma ${x.outlet||'—'}`,feed:x.feed||p?.feed||null,outlet:x.outlet||null};});
 const cablingEdges=CABLING&&typeof CABLING.rackEdges==='function'?CABLING.rackEdges(project,rackId):[];
 return{rack:normalizeRack(rack),nodes,dataEdges,powerEdges,cablingEdges};
}
function billOfMaterials(project){const rows=[];for(const rack of arr(project&&project.racks))rows.push({kind:'Rack',description:`${rack.name||rack.id} · ${rack.rackUnits||42}U`,quantity:1,locationId:rack.locationId});for(const item of allRackItems(project)){if(item.type!=='device')rows.push({kind:item.type||'Elemento rack',description:item.label||item.name||item.id,quantity:1,rackId:item.rackId});}for(const p of arr(project&&project.patchPanels))rows.push({kind:'Patch panel',description:`${p.name||p.id} · ${p.portCount||0} puertos`,quantity:1,rackId:p.rackId});for(const pdu of arr(project&&project.pdus))rows.push({kind:'PDU',description:`${pdu.name||pdu.id} · ${pdu.outletCount||0} tomas`,quantity:1,rackId:pdu.rackId});return rows;}
const api={version:'netwizard-rack-model-v3',normalizeRack,deviceRackItem,allRackItems,occupiedUnits,validate,rackTopology,billOfMaterials};root.NetWizardRackModel=api;if(typeof module!=='undefined'&&module.exports)module.exports=api;
})(typeof window!=='undefined'?window:globalThis);
