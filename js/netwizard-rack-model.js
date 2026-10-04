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
function rackOccupancy(project,rackId){
 const rack=byId(project&&project.racks,rackId);
 const items=allRackItems(project).filter(x=>x.rackId===rackId);
 const units=new Set(),entries=[];
 const representedPanels=new Set(items.filter(x=>x&&x.patchPanelId).map(x=>x.patchPanelId));
 for(const item of items){
   const start=num(item&&item.startUnit),height=num(item&&item.heightUnits);
   if(start==null||height==null||height<=0)continue;
   const first=Math.max(1,Math.floor(start));
   const end=Math.max(first,Math.ceil(start+height-1));
   for(let u=first;u<=end;u++)units.add(u);
   entries.push({
     id:item.id,label:item.label||item.name||item.id,type:item.type||'rack-item',
     startUnit:start,endUnit:end,heightUnits:height
   });
 }
 for(const panel of arr(project&&project.patchPanels).filter(x=>x&&x.rackId===rackId&&!representedPanels.has(x.id))){
   const u=num(panel.rackUnit);
   if(u!=null&&u>=1){
     const unit=Math.floor(u);units.add(unit);
     entries.push({id:panel.id,label:panel.name||panel.id,type:'patch-panel',startUnit:unit,endUnit:unit});
   }
 }
 const usedUnits=Array.from(units).sort((a,b)=>a-b);
 return{rack:rack?normalizeRack(rack):null,items,entries,usedUnits,usedCount:usedUnits.length,minUsedUnit:usedUnits.length?usedUnits[0]:null,maxUsedUnit:usedUnits.length?usedUnits[usedUnits.length-1]:0};
}
function recommendedRackUnits(project,rackId,options){
 const o=options||{},summary=rackOccupancy(project,rackId);
 const standards=arr(o.standardSizes).map(Number).filter(x=>Number.isInteger(x)&&x>0).sort((a,b)=>a-b);
 const sizes=standards.length?standards:[6,9,12,15,18,22,24,27,32,36,42,47];
 const policy=project&&project.designRequirements&&project.designRequirements.capacityPolicy||{};
 const reserve=Math.max(0,Math.floor(num(o.reserveUnits)!=null?num(o.reserveUnits):(num(policy.minFreeRackUnits)!=null?num(policy.minFreeRackUnits):4)));
 const growth=Math.max(0,num(o.growthPercent)!=null?num(o.growthPercent):(num(policy.rackGrowthPercent)!=null?num(policy.rackGrowthPercent):20));
 const occupied=Math.max(0,summary.maxUsedUnit||0);
 const target=Math.max(occupied+reserve,Math.ceil(occupied*(1+growth/100)),1);
 const recommended=sizes.find(x=>x>=target)||target;
 return{rackId,occupiedThroughUnit:occupied,reserveUnits:reserve,growthPercent:growth,targetUnits:target,recommendedUnits:recommended,standardSizes:sizes};
}
function validateRackResize(project,rackId,rackUnits){
 const rack=byId(project&&project.racks,rackId),units=Math.floor(num(rackUnits)||0);
 if(!rack)return{ok:false,rack:null,rackId,rackUnits:units,blockers:[],message:'Rack inexistente.'};
 if(units<1)return{ok:false,rack:normalizeRack(rack),rackId,rackUnits:units,blockers:[],message:'La altura del rack debe ser al menos 1U.'};
 if(units>100)return{ok:false,rack:normalizeRack(rack),rackId,rackUnits:units,blockers:[],message:'La altura del rack no puede superar 100U.'};
 const summary=rackOccupancy(project,rackId);
 const blockers=summary.entries.filter(x=>x.endUnit>units).sort((a,b)=>b.endUnit-a.endUnit);
 const recommendation=recommendedRackUnits(project,rackId);
 return{
   ok:!blockers.length,rack:normalizeRack(rack),rackId,rackUnits:units,blockers,
   minRackUnits:summary.maxUsedUnit||1,maxUsedUnit:summary.maxUsedUnit||0,recommendedUnits:recommendation.recommendedUnits,
   message:blockers.length
     ?'No se puede reducir a '+units+'U: '+blockers.map(x=>x.label+' ocupa U'+x.startUnit+(x.endUnit!==x.startUnit?'-U'+x.endUnit:'')).join(', ')+'.'
     :'El rack puede redimensionarse a '+units+'U sin dejar elementos fuera de rango.'
 };
}

function cloneProject(project){return JSON.parse(JSON.stringify(project||{}));}
function safeIdPart(value){return clean(value).toLowerCase().replace(/[^a-z0-9_-]+/g,'-').replace(/^-+|-+$/g,'').slice(0,64)||'item';}
function stableIdHash(value){
 let h=2166136261;const s=clean(value);
 for(let i=0;i<s.length;i++){h^=s.charCodeAt(i);h=Math.imul(h,16777619);}
 return (h>>>0).toString(36);
}
function generatedIdPart(value){return safeIdPart(value)+'-'+stableIdHash(value);}
function rackLayoutPolicy(project,options){
 const raw=Object.assign({},project&&project.designRequirements&&project.designRequirements.rackPolicy||{},options||{});
 const ports=Math.max(1,Math.min(192,Math.floor(num(raw.patchPanelPorts)||24)));
 const pattern=['patch-manager-switch','patch-switch','manual'].includes(clean(raw.layoutPattern))?clean(raw.layoutPattern):'patch-manager-switch';
 return{patchPanelPorts:ports,organizerPerSwitch:!(raw.organizerPerSwitch===false||raw.organizerPerSwitch==='false'||raw.organizerPerSwitch===0||raw.organizerPerSwitch==='0'),layoutPattern:pattern};
}
function isSwitchDevice(device){
 const kind=clean(device&&device.kind||device&&device.type).toLowerCase();
 return kind==='switch'||kind==='l3switch'||kind==='l3_switch'||kind==='layer3-switch';
}
function rackSpan(start,height){
 const s=num(start),h=num(height);
 if(s==null||h==null||h<=0)return[];
 const first=Math.max(1,Math.floor(s)),last=Math.max(first,Math.ceil(s+h-1));
 return Array.from({length:last-first+1},(_,i)=>first+i);
}
function panelOwnerMap(project){
 const ports=new Map(arr(project&&project.ports).map(x=>[x.id,x])),owners=new Map();
 for(const connection of arr(project&&project.patchConnections)){
   const port=ports.get(connection&&connection.switchPortId);if(!port||!connection.patchPanelId)continue;
   const set=owners.get(connection.patchPanelId)||new Set();set.add(port.deviceId);owners.set(connection.patchPanelId,set);
 }
 return owners;
}
function patchablePortCount(project,deviceId){
 return arr(project&&project.ports).filter(p=>{
   if(!p||p.deviceId!==deviceId)return false;
   const mode=clean(p.mode).toLowerCase(),media=clean(p.media||p.medium).toLowerCase(),role=clean(p.role).toLowerCase();
   if(mode==='routed'||role==='transit'||role==='uplink'||role==='wan')return false;
   if(/fiber|sfp|qsfp|dac/.test(media))return false;
   return mode==='access'||(!mode&&!/loopback/i.test(clean(p.name)));
 }).length;
}
function planRackAutoLayout(project,rackId,options){
 const rack=byId(project&&project.racks,rackId),policy=rackLayoutPolicy(project,options);
 if(!rack)return{ok:false,code:'rack_missing',rackId,policy,message:'Rack inexistente.',clusters:[],warnings:[]};
 if(policy.layoutPattern==='manual')return{ok:false,code:'manual_policy',rackId,policy,message:'La política del proyecto está en disposición manual.',clusters:[],warnings:[]};
 const switches=arr(project&&project.devices).filter(d=>(d.rackId||d.rack)===rackId&&isSwitchDevice(d))
   .slice().sort((a,b)=>(num(a.rackUnit)||999)-(num(b.rackUnit)||999)||clean(a.name).localeCompare(clean(b.name)));
 if(!switches.length)return{ok:false,code:'no_switches',rackId,policy,message:'No hay switches montados en este rack.',clusters:[],warnings:[]};

 const panels=arr(project&&project.patchPanels).filter(p=>p&&p.rackId===rackId);
 const items=arr(project&&project.rackItems).filter(i=>i&&i.rackId===rackId);
 const owners=panelOwnerMap(project),claimedPanels=new Set(),claimedManagers=new Set(),warnings=[];
 const panelItemByPanel=new Map(items.filter(i=>i.patchPanelId).map(i=>[i.patchPanelId,i]));
 const managers=items.filter(i=>clean(i.type).toLowerCase()==='cable-manager');
 const preferredManagerBySwitch=new Map(),preferredManagerIds=new Set();
 for(const manager of managers){
   const mu=num(manager.startUnit);if(mu==null)continue;
   const candidate=switches.filter(sw=>!preferredManagerBySwitch.has(sw.id)).slice().sort((a,b)=>{
     const ad=Math.abs((num(a.rackUnit)||0)-mu),bd=Math.abs((num(b.rackUnit)||0)-mu);
     return ad-bd||clean(a.name).localeCompare(clean(b.name));
   })[0];
   if(candidate&&Math.abs((num(candidate.rackUnit)||0)-mu)<=2){
     preferredManagerBySwitch.set(candidate.id,manager);preferredManagerIds.add(manager.id);
   }
 }
 const createdPanels=[],createdItems=[],clusters=[];

 function nearestFree(list,target,claimed,getUnit){
   return list.filter(x=>!claimed.has(x.id)).slice().sort((a,b)=>{
     const au=num(getUnit(a)),bu=num(getUnit(b)),t=num(target)||0;
     const ad=au==null?1e9:Math.abs(au-t),bd=bu==null?1e9:Math.abs(bu-t);
     return ad-bd||clean(a.name||a.label||a.id).localeCompare(clean(b.name||b.label||b.id));
   })[0]||null;
 }
 for(const sw of switches){
   const switchUnit=num(sw.rackUnit)||1;
   const shared=panels.filter(p=>owners.get(p.id)&&owners.get(p.id).size>1&&owners.get(p.id).has(sw.id));
   const exclusive=panels.filter(p=>{
     const set=owners.get(p.id);return set&&set.size===1&&set.has(sw.id)&&!claimedPanels.has(p.id);
   });
   let selected=exclusive.slice();
   selected.forEach(p=>claimedPanels.add(p.id));
   const accessPorts=patchablePortCount(project,sw.id);
   const requiredPorts=Math.max(1,accessPorts);
   let capacity=selected.reduce((sum,p)=>sum+(num(p.portCount)||policy.patchPanelPorts),0);
   if(shared.length&&!selected.length){
     warnings.push((sw.name||sw.id)+': usa '+shared.length+' patch panel(es) compartido(s); se mantienen en su posición actual.');
   }else{
     const unowned=panels.filter(p=>(!owners.get(p.id)||owners.get(p.id).size===0)&&!claimedPanels.has(p.id));
     while(capacity<requiredPorts){
       const candidate=nearestFree(unowned,switchUnit,claimedPanels,p=>p.rackUnit);
       if(candidate){
         selected.push(candidate);claimedPanels.add(candidate.id);capacity+=num(candidate.portCount)||policy.patchPanelPorts;continue;
       }
       const index=selected.length+1,id='rackauto-pp-'+generatedIdPart(rackId)+'-'+generatedIdPart(sw.id)+'-'+index;
       const existing=panels.find(p=>p.id===id);
       if(existing&&!claimedPanels.has(existing.id)){
         selected.push(existing);claimedPanels.add(existing.id);capacity+=num(existing.portCount)||policy.patchPanelPorts;continue;
       }
       const panel={id,rackId,name:'PP-'+(sw.name||sw.id)+'-'+index,portCount:policy.patchPanelPorts,category:'Cat6A',rackUnit:null};
       selected.push(panel);claimedPanels.add(id);createdPanels.push(panel);capacity+=policy.patchPanelPorts;
     }
   }

   const panelRefs=selected.map(panel=>{
     let item=panelItemByPanel.get(panel.id)||null;
     if(!item){
       const id='rackauto-item-'+generatedIdPart(panel.id);
       item=items.find(x=>x.id===id)||createdItems.find(x=>x.id===id)||{id,rackId,type:'patch-panel',patchPanelId:panel.id,label:panel.name||panel.id,startUnit:null,heightUnits:1,face:'front'};
       if(!items.some(x=>x.id===id)&&!createdItems.some(x=>x.id===id))createdItems.push(item);
     }
     return{panelId:panel.id,itemId:item.id,label:panel.name||panel.id,heightUnits:num(item.heightUnits)||1};
   });

   let manager=null;
   if(policy.layoutPattern==='patch-manager-switch'&&policy.organizerPerSwitch){
     const deterministicId='rackauto-manager-'+generatedIdPart(rackId)+'-'+generatedIdPart(sw.id);
     manager=items.find(i=>i.id===deterministicId)||null;
     if(!manager){
       const preferred=preferredManagerBySwitch.get(sw.id);
       if(preferred&&!claimedManagers.has(preferred.id)){manager=preferred;claimedManagers.add(preferred.id);}
     }
     if(!manager){
       const candidate=nearestFree(managers.filter(i=>!preferredManagerIds.has(i.id)),switchUnit,claimedManagers,i=>i.startUnit);
       if(candidate){manager=candidate;claimedManagers.add(candidate.id);}
     }
     if(!manager){
       manager={id:deterministicId,rackId,type:'cable-manager',label:'Organizador '+(sw.name||sw.id),startUnit:null,heightUnits:1,face:'front'};
       createdItems.push(manager);
     }
     claimedManagers.add(manager.id);
   }
   clusters.push({
     switchId:sw.id,switchName:sw.name||sw.id,switchHeight:Math.max(1,Math.ceil(num(sw.rackUnits||sw.heightU)||1)),
     panels:shared.length&&!selected.length?[]:panelRefs,sharedPanelIds:shared.map(x=>x.id),
     manager:manager?{itemId:manager.id,label:manager.label||manager.name||manager.id,heightUnits:1}:null,
     previousSwitchUnit:num(sw.rackUnit)
   });
 }

 const movableDeviceIds=new Set(clusters.map(x=>x.switchId));
 const movableItemIds=new Set();
 const movablePanelIds=new Set();
 for(const cluster of clusters){
   cluster.panels.forEach(x=>{movableItemIds.add(x.itemId);movablePanelIds.add(x.panelId);});
   if(cluster.manager)movableItemIds.add(cluster.manager.itemId);
 }
 const representedPanels=new Set(items.filter(i=>i.patchPanelId).map(i=>i.patchPanelId));
 const fixed=new Map(),fixedConflicts=[];
 const markFixed=(unit,label)=>{
   if(unit<1||unit>Number(rack.rackUnits||42))return;
   if(fixed.has(unit))fixedConflicts.push('U'+unit+': '+fixed.get(unit)+' / '+label);
   else fixed.set(unit,label);
 };
 for(const item of allRackItems(project).filter(i=>i.rackId===rackId)){
   if((item.deviceId&&movableDeviceIds.has(item.deviceId))||movableItemIds.has(item.id))continue;
   if((item.face||'front')!=='front')continue;
   rackSpan(item.startUnit,item.heightUnits||1).forEach(u=>markFixed(u,item.label||item.name||item.id));
 }
 for(const panel of panels){
   if(movablePanelIds.has(panel.id)||representedPanels.has(panel.id))continue;
   const u=num(panel.rackUnit);if(u!=null)markFixed(Math.floor(u),panel.name||panel.id);
 }
 if(fixedConflicts.length)return{ok:false,code:'fixed_collision',rackId,policy,message:'El rack contiene colisiones entre elementos que el autolayout no debe mover: '+fixedConflicts.join('; ')+'.',clusters,warnings,createdPanels,createdItems};

 let cursor=1,maxUnit=0;
 for(const cluster of clusters){
   const panelHeight=cluster.panels.reduce((sum,p)=>sum+Math.max(1,Math.ceil(num(p.heightUnits)||1)),0);
   const blockHeight=panelHeight+(cluster.manager?1:0)+cluster.switchHeight;
   let start=cursor,found=false;
   while(start+blockHeight-1<=Number(rack.rackUnits||42)){
     let blocked=false;
     for(let u=start;u<start+blockHeight;u++)if(fixed.has(u)){blocked=true;break;}
     if(!blocked){found=true;break;}
     start++;
   }
   if(!found){
     return{
       ok:false,code:'insufficient_space',rackId,policy,clusters,warnings,createdPanels,createdItems,
       requiredUnits:blockHeight,availableUnits:Number(rack.rackUnits||42),
       message:(rack.name||rack.id)+': no hay '+blockHeight+'U contiguas libres para organizar '+cluster.switchName+'.'
     };
   }
   let unit=start;
   for(const panel of cluster.panels){panel.startUnit=unit;unit+=Math.max(1,Math.ceil(num(panel.heightUnits)||1));}
   if(cluster.manager){cluster.manager.startUnit=unit;unit++;}
   cluster.switchStartUnit=unit;
   cluster.blockStartUnit=start;cluster.blockEndUnit=start+blockHeight-1;
   maxUnit=Math.max(maxUnit,cluster.blockEndUnit);cursor=cluster.blockEndUnit+1;
 }
 for(const unit of fixed.keys())maxUnit=Math.max(maxUnit,unit);
 return{
   ok:true,code:'ready',rackId,rack:normalizeRack(rack),policy,clusters,warnings,createdPanels,createdItems,
   fixedUnits:Array.from(fixed.keys()).sort((a,b)=>a-b),proposedMaxUnit:maxUnit,
   summary:{
     switches:clusters.length,
     panels:clusters.reduce((n,x)=>n+x.panels.length,0),
     managers:clusters.filter(x=>x.manager).length,
     createPanels:createdPanels.length,
     createItems:createdItems.length
   },
   message:'Se organizarán '+clusters.length+' switch(es) en patrón '+policy.layoutPattern+', sin mover el resto del rack.'
 };
}
function applyRackAutoLayout(project,rackId,options){
 const plan=planRackAutoLayout(project,rackId,options);
 if(!plan.ok)return{ok:false,project:cloneProject(project),plan,message:plan.message};
 const next=cloneProject(project);
 for(const key of ['racks','rackItems','patchPanels','devices'])if(!Array.isArray(next[key]))next[key]=[];
 for(const panel of plan.createdPanels)if(!next.patchPanels.some(x=>x.id===panel.id))next.patchPanels.push(Object.assign({},panel));
 for(const item of plan.createdItems)if(!next.rackItems.some(x=>x.id===item.id))next.rackItems.push(Object.assign({},item));
 for(const cluster of plan.clusters){
   const device=next.devices.find(x=>x.id===cluster.switchId);
   if(device){
     device.rackId=rackId;device.rack=rackId;device.rackUnit=cluster.switchStartUnit;device.rackFace='front';
     const explicit=next.rackItems.find(x=>x.deviceId===device.id);
     if(explicit){explicit.rackId=rackId;explicit.startUnit=cluster.switchStartUnit;explicit.heightUnits=num(device.rackUnits||device.heightU)||explicit.heightUnits||1;explicit.face='front';}
   }
   for(const panelRef of cluster.panels){
     const panel=next.patchPanels.find(x=>x.id===panelRef.panelId);
     if(panel){panel.rackId=rackId;panel.rackUnit=panelRef.startUnit;}
     let item=next.rackItems.find(x=>x.id===panelRef.itemId);
     if(!item){
       item={id:panelRef.itemId,rackId,type:'patch-panel',patchPanelId:panelRef.panelId,label:panel&&panel.name||panelRef.label,startUnit:panelRef.startUnit,heightUnits:1,face:'front'};
       next.rackItems.push(item);
     }
     item.rackId=rackId;item.type='patch-panel';item.patchPanelId=panelRef.panelId;item.startUnit=panelRef.startUnit;item.heightUnits=num(panelRef.heightUnits)||1;item.face='front';
   }
   if(cluster.manager){
     let item=next.rackItems.find(x=>x.id===cluster.manager.itemId);
     if(!item){item={id:cluster.manager.itemId,rackId,type:'cable-manager',label:cluster.manager.label,startUnit:cluster.manager.startUnit,heightUnits:1,face:'front'};next.rackItems.push(item);}
     item.rackId=rackId;item.type='cable-manager';item.startUnit=cluster.manager.startUnit;item.heightUnits=1;item.face='front';
   }
 }
 const audit=validate(next);
 const layoutBlocking=arr(audit.issues).filter(i=>i.rackId===rackId&&i.blocking&&['NW-RACK-001','NW-RACK-002','NW-RACK-003'].includes(i.code));
 if(layoutBlocking.length)return{ok:false,project:cloneProject(project),plan,audit,message:layoutBlocking.map(x=>x.message).join(' ')};
 return{ok:true,project:next,plan,audit,message:plan.message};
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
   const aId=link.aPortId||link.a||link.fromPortId||link.from||link.portA;
   const bId=link.bPortId||link.b||link.toPortId||link.to||link.portB;
   const a=portMap.get(aId),b=portMap.get(bId);if(!a||!b)continue;
   const aIn=deviceIds.has(a.deviceId),bIn=deviceIds.has(b.deviceId);if(!aIn&&!bIn)continue;
   const da=devMap.get(a.deviceId),db=devMap.get(b.deviceId);
   dataEdges.push({id:link.id,kind:'data',label:link.name||link.label||link.cableId||link.id||'Enlace',cableId:link.cableId||null,internal:aIn&&bIn,fromDeviceId:a.deviceId,toDeviceId:b.deviceId,fromPortId:a.id,toPortId:b.id,fromLabel:`${da?.name||a.deviceId} · ${a.name||a.id}`,toLabel:`${db?.name||b.deviceId} · ${b.name||b.id}`,media:link.media||link.medium||link.cableType||null,capacityMbps:link.capacityMbps||null,physicalPath:link.physicalPath||link.route||null});
 }
 const pduMap2=new Map(arr(project&&project.pdus).map(p=>[p.id,p]));
 const powerEdges=arr(project&&project.powerConnections).filter(x=>deviceIds.has(x.deviceId)||pduMap2.get(x.pduId)?.rackId===rackId).map(x=>{const d=devMap.get(x.deviceId),p=pduMap2.get(x.pduId);return{id:x.id,kind:'power',label:x.label||x.name||x.id||'Alimentación',deviceId:x.deviceId,pduId:x.pduId,fromLabel:`${d?.name||x.deviceId} PSU-${Number(x.powerSupplyIndex||0)+1}`,toLabel:`${p?.name||x.pduId} · toma ${x.outlet||'—'}`,feed:x.feed||p?.feed||null,outlet:x.outlet||null};});
 const cablingEdges=CABLING&&typeof CABLING.rackEdges==='function'?CABLING.rackEdges(project,rackId):[];
 return{rack:normalizeRack(rack),nodes,dataEdges,powerEdges,cablingEdges};
}
function billOfMaterials(project){const rows=[];for(const rack of arr(project&&project.racks))rows.push({kind:'Rack',description:`${rack.name||rack.id} · ${rack.rackUnits||42}U`,quantity:1,locationId:rack.locationId});for(const item of allRackItems(project)){if(item.type!=='device'&&item.type!=='reserved'&&!item.patchPanelId)rows.push({kind:item.type||'Elemento rack',description:item.label||item.name||item.id,quantity:1,rackId:item.rackId});}for(const p of arr(project&&project.patchPanels))rows.push({kind:'Patch panel',description:`${p.name||p.id} · ${p.portCount||0} puertos`,quantity:1,rackId:p.rackId});for(const pdu of arr(project&&project.pdus))rows.push({kind:'PDU',description:`${pdu.name||pdu.id} · ${pdu.outletCount||0} tomas`,quantity:1,rackId:pdu.rackId});return rows;}
const api={version:'netwizard-rack-model-v5',normalizeRack,deviceRackItem,allRackItems,occupiedUnits,rackOccupancy,recommendedRackUnits,validateRackResize,rackLayoutPolicy,planRackAutoLayout,applyRackAutoLayout,validate,rackTopology,billOfMaterials};root.NetWizardRackModel=api;if(typeof module!=='undefined'&&module.exports)module.exports=api;
})(typeof window!=='undefined'?window:globalThis);
