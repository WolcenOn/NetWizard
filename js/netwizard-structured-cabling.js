/* NetWizard Structured Cabling Model */
(function initNetWizardStructuredCabling(root){
'use strict';
const arr=v=>Array.isArray(v)?v:[];
const clean=v=>String(v==null?'':v).trim();
const num=v=>{const n=Number(v);return Number.isFinite(n)?n:null;};
const byId=(list,id)=>arr(list).find(x=>x&&x.id===id)||null;
function issue(code,severity,message,extra){return Object.assign({code,severity,blocking:severity==='error',category:'structured-cabling',source:'structured-cabling',message},extra||{});}
function mediaIsCopper(value){const s=clean(value).toLowerCase();return !s||s.includes('cat')||s.includes('copper')||s.includes('utp')||s.includes('ftp');}
function portLabel(project,id){const p=byId(project&&project.ports,id);if(!p)return id||'Sin puerto';const d=byId(project&&project.devices,p.deviceId);return `${d?.name||p.deviceId||'Equipo'} · ${p.name||p.id}`;}
function hostLabel(project,id){const h=byId(project&&project.hosts,id);return h?h.name||h.id:id||'Sin host';}
function panelLabel(project,id){const p=byId(project&&project.patchPanels,id);return p?p.name||p.id:id||'Sin patch panel';}
function outletLabel(project,id,port){const o=byId(project&&project.telecomOutlets,id);return o?`${o.name||o.id}${port?' · '+port:''}`:id||'Sin toma';}
function paths(project){
 const panels=new Map(arr(project&&project.patchPanels).map(x=>[x.id,x]));
 const outlets=new Map(arr(project&&project.telecomOutlets).map(x=>[x.id,x]));
 const patchByPanelPort=new Map(arr(project&&project.patchConnections).map(x=>[`${x.patchPanelId}|${x.patchPort}`,x]));
 const hostByOutletPort=new Map(arr(project&&project.hostOutletConnections).map(x=>[`${x.outletId}|${x.outletPort||1}`,x]));
 return arr(project&&project.cableRuns).map(run=>{
   const key=`${run.patchPanelId}|${run.patchPort}`,okey=`${run.outletId}|${run.outletPort||1}`;
   const patch=patchByPanelPort.get(key)||null,host=hostByOutletPort.get(okey)||null,panel=panels.get(run.patchPanelId)||null,outlet=outlets.get(run.outletId)||null;
   return{id:run.id,label:run.label||run.id,patchPanelId:run.patchPanelId,patchPort:Number(run.patchPort)||null,outletId:run.outletId,outletPort:Number(run.outletPort)||1,cableType:run.cableType||'Cat6A',lengthM:num(run.lengthM),route:run.route||run.physicalPath||null,switchPortId:patch&&patch.switchPortId||null,hostId:host&&host.hostId||null,patchCordLengthM:num(patch&&patch.patchCordLengthM),hostCordLengthM:num(host&&host.patchCordLengthM),panelLabel:panel?panel.name||panel.id:run.patchPanelId,outletLabel:outlet?outlet.name||outlet.id:run.outletId,switchPortLabel:patch?portLabel(project,patch.switchPortId):'Sin puerto de switch',hostLabel:host?hostLabel(project,host.hostId):'Sin host',complete:!!(panel&&outlet&&patch&&host)};
 });
}
function validate(project){
 const issues=[],panels=arr(project&&project.patchPanels),outlets=arr(project&&project.telecomOutlets),runs=arr(project&&project.cableRuns),patches=arr(project&&project.patchConnections),hosts=arr(project&&project.hostOutletConnections);
 const panelMap=new Map(panels.map(x=>[x.id,x])),outletMap=new Map(outlets.map(x=>[x.id,x])),portMap=new Map(arr(project&&project.ports).map(x=>[x.id,x])),hostMap=new Map(arr(project&&project.hosts).map(x=>[x.id,x])),rackMap=new Map(arr(project&&project.racks).map(x=>[x.id,x]));
 const usedRunPanel=new Map(),usedRunOutlet=new Map();
 for(const panel of panels){if(panel.rackId&&!rackMap.has(panel.rackId))issues.push(issue('NW-CABLE-011','error',`${panel.name||panel.id}: rack inexistente (${panel.rackId}).`,{patchPanelId:panel.id,rackId:panel.rackId}));if(!(num(panel.portCount)>0))issues.push(issue('NW-CABLE-012','error',`${panel.name||panel.id}: número de puertos inválido.`,{patchPanelId:panel.id}));}
 for(const run of runs){
   const panel=panelMap.get(run.patchPanelId),outlet=outletMap.get(run.outletId),pp=Number(run.patchPort),op=Number(run.outletPort||1);
   if(!panel)issues.push(issue('NW-CABLE-001','error',`${run.label||run.id}: patch panel inexistente (${run.patchPanelId}).`,{cableRunId:run.id,patchPanelId:run.patchPanelId}));
   else if(!Number.isInteger(pp)||pp<1||pp>Number(panel.portCount||0))issues.push(issue('NW-CABLE-002','error',`${run.label||run.id}: puerto ${run.patchPort} fuera del rango de ${panel.name||panel.id}.`,{cableRunId:run.id,patchPanelId:panel.id,patchPort:run.patchPort}));
   if(!outlet)issues.push(issue('NW-CABLE-003','error',`${run.label||run.id}: toma inexistente (${run.outletId}).`,{cableRunId:run.id,outletId:run.outletId}));
   else if(!Number.isInteger(op)||op<1||op>Number(outlet.portCount||1))issues.push(issue('NW-CABLE-004','error',`${run.label||run.id}: puerto ${op} fuera del rango de ${outlet.name||outlet.id}.`,{cableRunId:run.id,outletId:outlet.id,outletPort:op}));
   const pk=`${run.patchPanelId}|${run.patchPort}`;if(usedRunPanel.has(pk))issues.push(issue('NW-CABLE-005','error',`El puerto ${run.patchPort} de ${run.patchPanelId} tiene más de un tramo permanente.`,{cableRunId:run.id,patchPanelId:run.patchPanelId,patchPort:run.patchPort}));else usedRunPanel.set(pk,run.id);
   const ok=`${run.outletId}|${op}`;if(usedRunOutlet.has(ok))issues.push(issue('NW-CABLE-006','error',`La toma ${run.outletId} puerto ${op} tiene más de un tramo permanente.`,{cableRunId:run.id,outletId:run.outletId,outletPort:op}));else usedRunOutlet.set(ok,run.id);
   if(mediaIsCopper(run.cableType)&&num(run.lengthM)!=null&&num(run.lengthM)>90)issues.push(issue('NW-CABLE-008','error',`${run.label||run.id}: enlace permanente de cobre ${run.lengthM} m supera 90 m.`,{cableRunId:run.id,lengthM:num(run.lengthM)}));
 }
 const usedPatchPanel=new Map(),usedSwitchPort=new Map();
 for(const p of patches){
   const panel=panelMap.get(p.patchPanelId),pp=Number(p.patchPort);
   if(!panel)issues.push(issue('NW-CABLE-001','error',`Parcheo ${p.id}: patch panel inexistente (${p.patchPanelId}).`,{patchConnectionId:p.id,patchPanelId:p.patchPanelId}));
   else if(!Number.isInteger(pp)||pp<1||pp>Number(panel.portCount||0))issues.push(issue('NW-CABLE-002','error',`Parcheo ${p.id}: puerto ${p.patchPort} fuera de rango.`,{patchConnectionId:p.id,patchPanelId:p.patchPanelId,patchPort:p.patchPort}));
   if(!portMap.has(p.switchPortId))issues.push(issue('NW-CABLE-007','error',`Parcheo ${p.id}: puerto de switch inexistente (${p.switchPortId}).`,{patchConnectionId:p.id,portId:p.switchPortId}));
   const pk=`${p.patchPanelId}|${p.patchPort}`;if(usedPatchPanel.has(pk))issues.push(issue('NW-CABLE-009','error',`El puerto ${p.patchPort} de ${p.patchPanelId} tiene más de un latiguillo de parcheo.`,{patchConnectionId:p.id,patchPanelId:p.patchPanelId}));else usedPatchPanel.set(pk,p.id);
   if(p.switchPortId){if(usedSwitchPort.has(p.switchPortId))issues.push(issue('NW-CABLE-010','error',`El puerto ${portLabel(project,p.switchPortId)} está parcheado más de una vez.`,{patchConnectionId:p.id,portId:p.switchPortId}));else usedSwitchPort.set(p.switchPortId,p.id);}
 }
 const usedHostOutlet=new Map(),usedHost=new Map();
 for(const h of hosts){
   const outlet=outletMap.get(h.outletId),op=Number(h.outletPort||1);
   if(!outlet)issues.push(issue('NW-CABLE-003','error',`Conexión de host ${h.id}: toma inexistente (${h.outletId}).`,{hostOutletConnectionId:h.id,outletId:h.outletId}));
   else if(!Number.isInteger(op)||op<1||op>Number(outlet.portCount||1))issues.push(issue('NW-CABLE-004','error',`Conexión de host ${h.id}: puerto ${op} fuera de rango.`,{hostOutletConnectionId:h.id,outletId:h.outletId,outletPort:op}));
   if(!hostMap.has(h.hostId))issues.push(issue('NW-CABLE-013','error',`Conexión de toma referencia un host inexistente (${h.hostId}).`,{hostOutletConnectionId:h.id,hostId:h.hostId}));
   const ok=`${h.outletId}|${op}`;if(usedHostOutlet.has(ok))issues.push(issue('NW-CABLE-014','error',`La toma ${h.outletId} puerto ${op} tiene más de un host conectado.`,{hostOutletConnectionId:h.id,outletId:h.outletId}));else usedHostOutlet.set(ok,h.id);
   if(h.hostId){if(usedHost.has(h.hostId))issues.push(issue('NW-CABLE-015','warning',`${hostLabel(project,h.hostId)} aparece conectado a más de una toma.`,{hostOutletConnectionId:h.id,hostId:h.hostId}));else usedHost.set(h.hostId,h.id);}
 }
 return{version:'netwizard-structured-cabling-v1',ok:!issues.some(x=>x.blocking),issues,counts:{blocking:issues.filter(x=>x.blocking).length,warnings:issues.filter(x=>x.severity==='warning').length},paths:paths(project)};
}
function rackEdges(project,rackId){const panelIds=new Set(arr(project&&project.patchPanels).filter(x=>x.rackId===rackId).map(x=>x.id));return paths(project).filter(x=>panelIds.has(x.patchPanelId));}
function billOfMaterials(project){
 const rows=[];
 for(const o of arr(project&&project.telecomOutlets))rows.push({kind:'Toma de red',description:`${o.name||o.id} · ${o.portCount||1} puerto(s) · ${o.category||'categoría no definida'}`,quantity:1,locationId:o.locationId});
 const runs=arr(project&&project.cableRuns);const byType=new Map();for(const r of runs){const k=r.cableType||'Cable estructurado';const cur=byType.get(k)||{quantity:0,lengthM:0};cur.quantity++;cur.lengthM+=num(r.lengthM)||0;byType.set(k,cur);}for(const [kind,v] of byType)rows.push({kind:'Cable estructurado',description:`${kind} · ${Math.round(v.lengthM*10)/10} m documentados`,quantity:v.quantity});
 const patchCount=arr(project&&project.patchConnections).length,hostCount=arr(project&&project.hostOutletConnections).length;if(patchCount)rows.push({kind:'Latiguillo rack',description:'Latiguillos patch panel ↔ switch',quantity:patchCount});if(hostCount)rows.push({kind:'Latiguillo usuario',description:'Latiguillos toma ↔ host',quantity:hostCount});
 return rows;
}
const api={version:'netwizard-structured-cabling-v1',validate,paths,rackEdges,billOfMaterials,portLabel,hostLabel,panelLabel,outletLabel};
root.NetWizardStructuredCabling=api;if(typeof module!=='undefined'&&module.exports)module.exports=api;
})(typeof window!=='undefined'?window:globalThis);
