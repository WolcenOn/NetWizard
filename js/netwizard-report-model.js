/* NetWizard unified report model */
(function initNetWizardReportModel(root){
'use strict';
const arr=v=>Array.isArray(v)?v:[];
const clean=v=>String(v==null?'':v).trim();
const POE=root.NetWizardPoeModel||(typeof require==='function'?require('./netwizard-poe-model.js'):null);
const RACK=root.NetWizardRackModel||(typeof require==='function'?require('./netwizard-rack-model.js'):null);
const CABLING=root.NetWizardStructuredCabling||(typeof require==='function'?require('./netwizard-structured-cabling.js'):null);
const byId=(list,id)=>arr(list).find(x=>x&&x.id===id)||null;
function labelDevice(project,id,options){const locale=localeOf(options),d=byId(project&&project.devices,id);return d?d.name||d.id:pick(locale,'Sin equipo asignado','No device assigned');}
function labelPort(project,id,options){const locale=localeOf(options),p=byId(project&&project.ports,id);return p?`${labelDevice(project,p.deviceId,{locale})} · ${p.name||p.id}`:pick(locale,'Sin puerto asignado','No port assigned');}
function linkPortA(link){return link&&(link.aPortId||link.a||link.fromPortId||link.from||link.portA)||null;}
function linkPortB(link){return link&&(link.bPortId||link.b||link.toPortId||link.to||link.portB)||null;}
function connectivity(project,options){const locale=localeOf(options);return arr(project&&project.links).map(link=>({id:link.id,name:link.name||link.label||pick(locale,'Enlace','Link'),aPort:labelPort(project,linkPortA(link),{locale}),bPort:labelPort(project,linkPortB(link),{locale}),media:link.media||link.medium||link.cableType||pick(locale,'No documentado','Not documented'),capacityMbps:link.capacityMbps||null,physicalPath:link.physicalPath||link.route||pick(locale,'No documentada','Not documented'),cableId:link.cableId||null}));}
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
       return{id:port.id,name:port.name||port.id,destination:remote?labelDevice(project,remote.deviceId,{locale}):pick(locale,'Extremo no documentado','Undocumented endpoint'),remotePort:remote?remote.name||remote.id:'—',medium:mediaLabel(medium),mediaKind:mediaKind(medium),route:link.physicalPath||link.route||link.name||link.label||pick(locale,'Enlace directo','Direct link'),connectionType:'direct'};
     }
     const path=structuredByPort.get(port.id);
     if(path){
       const medium=path.cableType||port.media||'No documentado';
       return{id:port.id,name:port.name||port.id,destination:path.hostLabel||pick(locale,'Host no documentado','Undocumented host'),remotePort:path.outletLabel?`${path.outletLabel} · P${path.outletPort||1}`:'—',medium:mediaLabel(medium),mediaKind:mediaKind(medium),route:[path.panelLabel&&`${path.panelLabel} · P${path.patchPort||'—'}`,path.route].filter(Boolean).join(' → ')||pick(locale,'Cableado estructurado','Structured cabling'),connectionType:'structured'};
     }
     const host=hostByPort.get(port.id);
     if(host){
       const medium=port.media||'No documentado';
       return{id:port.id,name:port.name||port.id,destination:host.name||host.hostname||host.id,remotePort:'NIC / endpoint',medium:mediaLabel(medium),mediaKind:mediaKind(medium),route:'Host conectado directamente',connectionType:'host'};
     }
     const medium=port.media||'No documentado';
     return{id:port.id,name:port.name||port.id,destination:pick(locale,'Libre','Free'),remotePort:'—',medium:mediaLabel(medium),mediaKind:'free',route:port.desc||port.description||pick(locale,'Sin conexión documentada','No documented connection'),connectionType:'free'};
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
     switchPortId:path.switchPortId||null,switchDeviceId:device&&device.id||null,switchDeviceName:device?device.name||device.id:pick(locale,'Sin switch','No switch'),switchPortName:port?port.name||port.id:pick(locale,'Sin puerto','No port'),
     patchCordLengthM:path.patchCordLengthM,patchPanelId:path.patchPanelId||null,patchPanelName:panel?panel.name||panel.id:path.panelLabel||pick(locale,'Sin patch panel','No patch panel'),patchPort:path.patchPort||null,
     cableType:path.cableType||'No documentado',lengthM:path.lengthM,route:path.route||'Ruta no documentada',
     outletId:path.outletId||null,outletName:outlet?outlet.name||outlet.id:path.outletLabel||pick(locale,'Sin toma','No outlet'),outletPort:path.outletPort||1,locationName:location?location.name||location.id:pick(locale,'Ubicación no documentada','Undocumented location'),
     hostId:path.hostId||null,hostName:host?host.name||host.hostname||host.id:path.hostLabel||pick(locale,'Sin equipo final','No endpoint'),hostCordLengthM:path.hostCordLengthM,
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
function buildInstallationChecklist(project,rackSummaries,structuredChains,powerMap,options){const locale=localeOf(options);
 const tasks=[],devices=arr(project&&project.devices),items=arr(project&&project.rackItems),ports=arr(project&&project.ports),portById=new Map(ports.map(p=>[p.id,p]));
 const rackByDevice=new Map();
 for(const d of devices)if(d&&(d.rackId||d.rack))rackByDevice.set(d.id,d.rackId||d.rack);
 for(const item of items)if(item&&item.deviceId&&item.rackId&&!rackByDevice.has(item.deviceId))rackByDevice.set(item.deviceId,item.rackId);
 const push=(rackId,category,task,reference,documented=true)=>tasks.push({rackId:rackId||null,category,task,reference:reference||'—',documented:!!documented});
 for(const item of items)push(item.rackId,pick(locale,'Montaje','Mounting'),`${pick(locale,'Montar','Mount')} ${item.label||item.name||item.id} ${pick(locale,'en','at')} ${Number.isFinite(Number(item.startUnit))?'U'+item.startUnit:pick(locale,'posición definida','defined position')}`,item.face||'front',Number.isFinite(Number(item.startUnit))||String(item.mounting||'').startsWith('vertical'));
 for(const link of arr(project&&project.links)){
   const a=portById.get(linkPortA(link)),b=portById.get(linkPortB(link)),rackId=a&&rackByDevice.get(a.deviceId)||b&&rackByDevice.get(b.deviceId)||null;
   push(rackId,'Datos',`Conectar ${labelPort(project,linkPortA(link))} ↔ ${labelPort(project,linkPortB(link))}`,[link.media||link.medium||link.cableType,link.physicalPath||link.route].filter(Boolean).join(' · '),!!(a&&b));
 }
 for(const chain of structuredChains){
   push(chain.rackId,pick(locale,'Parcheo','Patching'),`${pick(locale,'Conectar','Connect')} ${chain.switchDeviceName} · ${chain.switchPortName} → ${chain.patchPanelName} · P${chain.patchPort||'—'}`,chain.patchCordLengthM!=null?`${pick(locale,'Latiguillo','Patch cord')} ${chain.patchCordLengthM} m`:pick(locale,'Latiguillo rack','Rack patch cord'),!!chain.switchPortId);
   push(chain.rackId,pick(locale,'Cableado','Cabling'),`${pick(locale,'Tender','Run')} ${chain.patchPanelName} · P${chain.patchPort||'—'} → ${chain.outletName} · P${chain.outletPort||1}`,[chain.cableType,chain.lengthM!=null?`${chain.lengthM} m`:null,chain.route].filter(Boolean).join(' · '),!!(chain.patchPanelId&&chain.outletId));
   push(chain.rackId,pick(locale,'Puesto final','Endpoint'),`${pick(locale,'Conectar','Connect')} ${chain.outletName} · P${chain.outletPort||1} → ${chain.hostName}`,chain.hostCordLengthM!=null?`${pick(locale,'Latiguillo','Patch cord')} ${chain.hostCordLengthM} m`:pick(locale,'Latiguillo usuario','User patch cord'),!!chain.hostId);
   push(chain.rackId,'Etiquetado',`Etiquetar ambos extremos de ${chain.label}`,`${chain.patchPanelName} P${chain.patchPort||'—'} / ${chain.outletName} P${chain.outletPort||1}`,chain.complete);
   push(chain.rackId,pick(locale,'Certificación','Certification'),`${pick(locale,'Certificar enlace','Certify link')} ${chain.label}`,chain.cableType,chain.complete);
 }
 for(const row of arr(powerMap&&powerMap.rows))push(row.rackId,pick(locale,'Energía','Power'),`${pick(locale,'Conectar','Connect')} ${row.deviceName} PSU-${row.psu} → ${row.pduName}`,row.outlet?`${pick(locale,'Toma','Outlet')} ${row.outlet} · feed ${row.feed||'—'}`:pick(locale,'Sin toma documentada','No documented outlet'),row.status==='connected');
 for(const rack of rackSummaries)push(rack.rackId,pick(locale,'Verificación','Verification'),`${pick(locale,'Verificar rack','Verify rack')} ${rack.rackName}: ${pick(locale,'enlaces, alimentación y etiquetado','links, power, and labeling')}`,`${rack.devices} ${pick(locale,'equipos','devices')} · ${rack.dataLinks+rack.structuredRuns} ${pick(locale,'enlaces de datos','data links')}`,rack.missingPower===0&&rack.issues===0);
 return tasks;
}

function buildConnectionOverview(project,structuredChains,options){const locale=localeOf(options);
 const devices=arr(project&&project.devices),hosts=arr(project&&project.hosts),ports=arr(project&&project.ports),links=arr(project&&project.links),racks=arr(project&&project.racks),locations=arr(project&&project.physicalLocations);
 const portMap=new Map(ports.map(p=>[p.id,p])),deviceMap=new Map(devices.map(d=>[d.id,d])),rackMap=new Map(racks.map(r=>[r.id,r])),locationMap=new Map(locations.map(l=>[l.id,l]));
 const nodes=[],edges=[],seenNodes=new Set(),seenEdges=new Set();
 const addDevice=id=>{
   const d=deviceMap.get(id);if(!d)return null;
   const key=`device:${id}`;if(!seenNodes.has(key)){
     const rackId=d.rackId||d.rack||null,rack=rackMap.get(rackId),loc=locationMap.get(d.locationId||d.physicalLocationId||(rack&&rack.locationId));
     nodes.push({id:key,entityId:id,kind:'device',label:d.name||d.id,detail:[d.type||d.kind,rack&&rack.name,loc&&loc.name,d.mgmtIp].filter(Boolean).join(' · '),rackId,locationId:loc&&loc.id||null});
     seenNodes.add(key);
   }
   return key;
 };
 const addHost=id=>{
   const h=byId(hosts,id);if(!h)return null;
   const key=`host:${id}`;if(!seenNodes.has(key)){
     const loc=locationMap.get(h.locationId||h.physicalLocationId);
     nodes.push({id:key,entityId:id,kind:'host',label:h.name||h.hostname||h.id,detail:[h.type||'host',loc&&loc.name||h.physicalLocation,h.staticIp||h.ip||null].filter(Boolean).join(' · '),locationId:loc&&loc.id||null});
     seenNodes.add(key);
   }
   return key;
 };
 const pushEdge=edge=>{if(!edge||!edge.fromId||!edge.toId)return;const key=edge.id||`${edge.kind}:${edge.fromId}:${edge.toId}:${edges.length}`;if(seenEdges.has(key))return;seenEdges.add(key);edges.push(Object.assign({id:key},edge));};
 for(const link of links){
   const aId=linkPortA(link),bId=linkPortB(link),a=portMap.get(aId),b=portMap.get(bId);if(!a||!b)continue;
   const fromId=addDevice(a.deviceId),toId=addDevice(b.deviceId);if(!fromId||!toId)continue;
   pushEdge({id:`link:${link.id||aId+'-'+bId}`,kind:'direct',fromId,toId,label:link.name||link.label||link.cableId||pick(locale,'Enlace','Link'),fromPort:a.name||a.id,toPort:b.name||b.id,media:mediaLabel(link.media||link.medium||link.cableType),capacityMbps:link.capacityMbps||null,route:link.physicalPath||link.route||null});
 }
 for(const chain of arr(structuredChains)){
   if(!chain||!chain.switchDeviceId||!chain.hostId)continue;
   const fromId=addDevice(chain.switchDeviceId),toId=addHost(chain.hostId);if(!fromId||!toId)continue;
   pushEdge({id:`structured:${chain.id}`,kind:'structured',fromId,toId,label:chain.label||chain.id,fromPort:chain.switchPortName||null,toPort:chain.outletName||null,media:chain.cableType||null,capacityMbps:null,route:chain.route||null,detail:`${chain.patchPanelName||'Patch panel'} P${chain.patchPort||'—'} → ${chain.outletName||pick(locale,'Toma','Outlet')} P${chain.outletPort||1}`});
 }
 const structuredHosts=new Set(arr(structuredChains).map(x=>x&&x.hostId).filter(Boolean));
 for(const host of hosts){
   if(structuredHosts.has(host.id))continue;
   const portId=host.portRef||host.portId||host.connectedPortId,port=portMap.get(portId);if(!port)continue;
   const fromId=addDevice(port.deviceId),toId=addHost(host.id);if(!fromId||!toId)continue;
   pushEdge({id:`host:${host.id}:${port.id}`,kind:'host',fromId,toId,label:pick(locale,'Conexión de host','Host connection'),fromPort:port.name||port.id,toPort:host.name||host.id,media:port.media||null,route:host.physicalLocation||null});
 }
 for(const d of devices)addDevice(d.id);
 return{nodes,edges};
}
function buildInstallationLabels(project,structuredChains,powerMap,options){const locale=localeOf(options);
 const labels=[],racks=arr(project&&project.racks),devices=arr(project&&project.devices),items=arr(project&&project.rackItems),panels=arr(project&&project.patchPanels),outlets=arr(project&&project.telecomOutlets),pdus=arr(project&&project.pdus),links=arr(project&&project.links),ports=arr(project&&project.ports),locations=arr(project&&project.physicalLocations);
 const portMap=new Map(ports.map(p=>[p.id,p])),deviceMap=new Map(devices.map(d=>[d.id,d])),rackMap=new Map(racks.map(r=>[r.id,r])),locMap=new Map(locations.map(l=>[l.id,l]));
 const pad=n=>String(n+1).padStart(2,'0');
 const add=(kind,code,title,detail,sourceId,side)=>labels.push({kind,code:clean(code)||clean(title)||'Etiqueta',title:clean(title)||clean(code)||'Etiqueta',detail:clean(detail),sourceId:sourceId||null,side:side||null});
 for(const rack of racks){const loc=locMap.get(rack.locationId);add('rack',rack.name||rack.id,rack.name||rack.id,[loc&&loc.name,`${rack.rackUnits||42}U`].filter(Boolean).join(' · '),rack.id);}
 for(const d of devices){const rack=rackMap.get(d.rackId||d.rack);add('device',d.name||d.id,d.name||d.id,[d.type||d.kind,d.vendor||d.vendorOs,d.model,rack&&rack.name,d.rackUnit?`U${d.rackUnit}`:null,d.mgmtIp].filter(Boolean).join(' · '),d.id);}
 for(const panel of panels){const rack=rackMap.get(panel.rackId);add('patch-panel',panel.name||panel.id,panel.name||panel.id,[rack&&rack.name,`${panel.portCount||0} puertos`,panel.category].filter(Boolean).join(' · '),panel.id);}
 for(const outlet of outlets){const loc=locMap.get(outlet.locationId);add('outlet',outlet.name||outlet.id,outlet.name||outlet.id,[loc&&loc.name,`${outlet.portCount||1} puerto(s)`,outlet.category].filter(Boolean).join(' · '),outlet.id);}
 for(const pdu of pdus){const rack=rackMap.get(pdu.rackId);add('pdu',pdu.name||pdu.id,pdu.name||pdu.id,[rack&&rack.name,pdu.feed?`Feed ${pdu.feed}`:null,`${pdu.outletCount||0} tomas`].filter(Boolean).join(' · '),pdu.id);}
 for(const item of items){
   if(!item||item.deviceId||item.patchPanelId||String(item.type||'').includes('patch'))continue;
   add('rack-item',item.label||item.name||item.id,item.label||item.name||item.id,[rackMap.get(item.rackId)?.name,item.startUnit?`U${item.startUnit}`:null,item.type].filter(Boolean).join(' · '),item.id);
 }
 links.forEach((link,index)=>{
   const a=portMap.get(linkPortA(link)),b=portMap.get(linkPortB(link));if(!a||!b)return;
   const da=deviceMap.get(a.deviceId),db=deviceMap.get(b.deviceId),code=link.cableId||link.name||link.label||`DATA-${pad(index)}`;
   const common=[mediaLabel(link.media||link.medium||link.cableType),link.capacityMbps?`${link.capacityMbps} Mbps`:null,link.physicalPath||link.route].filter(Boolean).join(' · ');
   add('cable-data',code,code,`A · ${da?.name||a.deviceId} ${a.name||a.id} → ${db?.name||b.deviceId} ${b.name||b.id}${common?' · '+common:''}`,link.id,'A');
   add('cable-data',code,code,`B · ${db?.name||b.deviceId} ${b.name||b.id} → ${da?.name||a.deviceId} ${a.name||a.id}${common?' · '+common:''}`,link.id,'B');
 });
 arr(structuredChains).forEach((chain,index)=>{
   const code=chain.label||chain.id||`CAB-${pad(index)}`;
   const a=`${chain.patchPanelName||'Patch panel'} P${chain.patchPort||'—'}`;
   const b=`${chain.outletName||pick(locale,'Toma','Outlet')} P${chain.outletPort||1}`;
   const common=[chain.cableType,chain.route,chain.lengthM!=null?`${chain.lengthM} m`:null].filter(Boolean).join(' · ');
   add('cable-structured',code,code,`A · ${a} → ${b}${common?' · '+common:''}`,chain.id,'A');
   add('cable-structured',code,code,`B · ${b} → ${a}${common?' · '+common:''}`,chain.id,'B');
 });
 arr(powerMap&&powerMap.rows).filter(x=>x&&x.status==='connected').forEach((row,index)=>{
   const code=row.label||`PWR-${pad(index)}`,common=`${row.deviceName} PSU-${row.psu} ↔ ${row.pduName} toma ${row.outlet||'—'} · Feed ${row.feed||'—'}`;
   add('cable-power',code,code,`A · ${common}`,`${row.deviceId}:${row.psu}`,'A');
   add('cable-power',code,code,`B · ${common}`,`${row.deviceId}:${row.psu}`,'B');
 });
 const counts={};for(const label of labels)counts[label.kind]=(counts[label.kind]||0)+1;
 return{items:labels,counts,total:labels.length};
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
     rows.push({rackId,deviceId:device.id,deviceName:device.name||device.id,psu:1,pduId:null,pduName:pick(localeOf(options),'Sin conexión declarada','No declared connection'),outlet:null,feed:null,status:'missing'});
     continue;
   }
   for(const c of own){
     const pdu=pduMap.get(c.pduId);
     rows.push({rackId:rackId||(pdu&&pdu.rackId)||null,deviceId:device.id,deviceName:device.name||device.id,psu:Number(c.powerSupplyIndex||0)+1,pduId:c.pduId||null,pduName:pdu?pdu.name||pdu.id:c.pduId||'PDU no documentada',outlet:c.outlet||null,feed:c.feed||(pdu&&pdu.feed)||null,status:pdu?'connected':'invalid'});
   }
 }
 return{pdus:pdus.map(p=>({id:p.id,rackId:p.rackId||null,name:p.name||p.id,feed:p.feed||null,outletCount:p.outletCount||0,maxPowerWatts:p.maxPowerWatts||null})),rows};
}
function build(project,options){options=options||{};const locale=localeOf(options);
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
 const installationChecklist=buildInstallationChecklist(project,rackSummaries,structuredChains,powerMap,{locale});
 const connectionOverview=buildConnectionOverview(project,structuredChains,{locale});
 const installationLabels=buildInstallationLabels(project,structuredChains,powerMap,{locale});
 return{
   version:'netwizard-report-model-v4',
   project:{name:project.projName||project.name||'Red',schemaVersion:project._schemaVersion||null},
   summary:{devices:arr(project.devices).length,ports:arr(project.ports).length,links:arr(project.links).length,hosts:arr(project.hosts).length,vlans:arr(project.vlans).length,racks:racks.racks.length,wanCircuits:arr(project.wanCircuits).length,poeLoadWatts:Object.values(poe.loadsByDevice).reduce((a,b)=>a+Number(b||0),0)},
   connectivity:connectivity(project,{locale}),inventory:inventory(project),materials,racks,rackTopologies,structuredCabling,structuredChains,portMatrices,powerMap,rackSummaries,installationChecklist,connectionOverview,installationLabels,poe,findings:arr(gate.issues)
 };
}
const api={version:'netwizard-report-model-v4',build,connectivity,inventory,labelDevice,labelPort,linkPortA,linkPortB,mediaKind,mediaLabel,buildPortMatrices,buildPowerMap,buildStructuredChains,buildRackSummaries,buildInstallationChecklist,buildConnectionOverview,buildInstallationLabels};
root.NetWizardReportModel=api;
if(typeof module!=='undefined'&&module.exports)module.exports=api;
})(typeof window!=='undefined'?window:globalThis);
