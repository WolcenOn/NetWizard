/* NetWizard Installation Report v3 */
(function(root){
'use strict';
const MODEL=root.NetWizardReportModel||(typeof require==='function'?require('./netwizard-report-model.js'):null);
const arr=v=>Array.isArray(v)?v:[];
const clean=v=>String(v==null?'':v).trim();
const SEC=root.NetWizardSecurityUtils||{};const CORE=root.NetWizardCoreUtils||{};
const fallback=v=>clean(v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const esc=v=>{try{return typeof SEC.escapeHtml==='function'?SEC.escapeHtml(clean(v)):typeof CORE.escapeHtml==='function'?CORE.escapeHtml(clean(v)):fallback(v);}catch{return fallback(v);}};
const byId=(list,id)=>arr(list).find(x=>x&&x.id===id)||null;
const table=(h,r,e)=>r.length?`<div class="table-wrap"><table><thead><tr>${h.map(x=>`<th>${esc(x)}</th>`).join('')}</tr></thead><tbody>${r.map(row=>`<tr>${row.map(x=>`<td>${esc(x)}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`:`<p class="empty">${esc(e)}</p>`;
const section=(n,t,b)=>`<section><h2>${n}. ${esc(t)}</h2>${b}</section>`;
function gate(project,options){if(options&&options.gateReport)return options.gateReport;try{return root.NetWizardProductionGate&&root.NetWizardProductionGate.runProductionGate?root.NetWizardProductionGate.runProductionGate(project,{productionMode:true,strict:false}):{issues:[],counts:{}};}catch{return{issues:[],counts:{}};}}
function status(g){const i=arr(g&&g.issues),c=g&&g.counts||{};const blocking=Number(c.blocking!=null?c.blocking:i.filter(x=>x&&x.blocking).length),errors=Number(c.errors!=null?c.errors:i.filter(x=>x&&x.severity==='error').length),warnings=Number(c.warnings!=null?c.warnings:i.filter(x=>x&&x.severity==='warning').length);return blocking?{state:'BLOQUEADO',risk:blocking>=3?'Crítico':'Alto',blocking,errors,warnings}:errors?{state:'APTO CON ADVERTENCIAS',risk:'Alto',blocking,errors,warnings}:warnings?{state:'APTO CON ADVERTENCIAS',risk:'Medio',blocking,errors,warnings}:{state:'APTO',risk:'Bajo',blocking,errors,warnings};}
function rackRows(model){const items=model.racks&&model.racks.items||[];return arr(model.racks&&model.racks.racks).map(r=>{const own=items.filter(i=>i.rackId===r.id),used=new Set();own.forEach(i=>{for(let u=Number(i.startUnit);u<Number(i.startUnit)+Number(i.heightUnits||1);u++)if(Number.isFinite(u))used.add(u);});return[r.name||r.id,`${used.size}/${r.rackUnits}U`,own.length,r.powerCapacityWatts?`${r.powerCapacityWatts} W`:'—',r.coolingCapacityWatts?`${r.coolingCapacityWatts} W`:'—'];});}
function rackRange(item){const start=Number(item&&item.startUnit),height=Math.max(1,Number(item&&item.heightUnits||1));if(!Number.isFinite(start))return'—';const end=start+height-1;return end===start?`U${start}`:`U${start}–U${end}`;}
function rackAssociation(project,item){
 if(item&&item.deviceId){const d=byId(project&&project.devices,item.deviceId);return d?d.name||d.id:item.deviceId;}
 const panelId=item&&(item.patchPanelId||(String(item.type||'').includes('patch')?item.id:null));
 if(panelId){const p=byId(project&&project.patchPanels,panelId);return p?p.name||p.id:panelId;}
 return item&&item.label||item&&item.name||'—';
}
function rackDetails(project,model){
 const racks=arr(model.racks&&model.racks.racks),items=arr(model.racks&&model.racks.items),issues=arr(model.racks&&model.racks.issues);
 if(!racks.length)return'<p class="empty">No hay racks definidos. Añadir racks permite planificar unidades, energía y material pasivo.</p>';
 return racks.map(r=>{
   const own=items.filter(i=>i.rackId===r.id).slice().sort((a,b)=>Number(b.startUnit||0)-Number(a.startUnit||0));
   const pdus=arr(project.pdus).filter(p=>p.rackId===r.id);
   const ownIssues=issues.filter(i=>i.rackId===r.id);
   const loc=byId(project.physicalLocations,r.locationId);
   const itemRows=own.map(i=>[rackRange(i),`${Number(i.heightUnits||1)}U`,i.label||i.name||i.id,i.type||'elemento',i.face||'front',rackAssociation(project,i),i.powerDrawWatts!=null?`${i.powerDrawWatts} W`:'—']);
   const pduText=pdus.length?pdus.map(p=>`${p.name||p.id} · feed ${p.feed||'—'} · ${p.outletCount||0} tomas`).join(' | '):'Sin PDU documentada';
   const issueHtml=ownIssues.length?`<div class="rack-warnings"><b>Incidencias:</b><ul>${ownIssues.map(i=>`<li>${esc(i.message||i.code)}</li>`).join('')}</ul></div>`:'';
   return`<article class="rack-card"><div class="rack-title"><div><h3>${esc(r.name||r.id)}</h3><span>${esc(loc?loc.name||loc.id:'Ubicación no documentada')}</span></div><b>${esc(r.rackUnits||42)}U</b></div><div class="rack-meta"><span>Potencia: <b>${esc(r.powerCapacityWatts?`${r.powerCapacityWatts} W`:'—')}</b></span><span>Refrigeración: <b>${esc(r.coolingCapacityWatts?`${r.coolingCapacityWatts} W`:'—')}</b></span><span>PDU: <b>${esc(pdus.length)}</b></span></div>${table(['U','Altura','Elemento','Tipo','Cara','Asociación','Consumo'],itemRows,'Rack sin elementos colocados.')}<p class="rack-pdu">${esc(pduText)}</p>${issueHtml}</article>`;
 }).join('');
}
function mediaClass(kind){return['copper','fiber-mm','fiber-sm','fiber','dac-aoc','console','other','free'].includes(kind)?`media-${kind}`:'media-other';}
function mediaLegend(){
 const entries=[
  ['media-copper','Cobre Cat5e / Cat6 / Cat6A'],
  ['media-fiber-mm','Fibra multimodo (OM)'],
  ['media-fiber-sm','Fibra monomodo (OS)'],
  ['media-fiber','Fibra sin especificar'],
  ['media-dac-aoc','DAC / AOC'],
  ['media-console','Consola / serie'],
  ['media-other','Otro / no documentado'],
  ['feed-a','Alimentación feed A'],
  ['feed-b','Alimentación feed B']
 ];
 return`<div class="legend">${entries.map(([cls,label])=>`<div class="legend-item"><span class="legend-swatch ${cls}"></span><span>${esc(label)}</span></div>`).join('')}</div>`;
}
function portMatrixChunk(ports){
 const header=`<tr><th class="matrix-label">Campo</th>${ports.map(p=>`<th>${esc(p.name)}</th>`).join('')}</tr>`;
 const row=(label,key,mediumRow)=>`<tr><th class="matrix-label">${esc(label)}</th>${ports.map(p=>{const cls=mediaClass(p.mediaKind);const value=p[key]||'—';return`<td class="media-cell ${cls}">${mediumRow?`<span class="mini-swatch ${cls}"></span>`:''}${esc(value)}</td>`;}).join('')}</tr>`;
 return`<div class="port-matrix-wrap"><table class="port-matrix"><thead>${header}</thead><tbody>${row('Destino','destination',false)}${row('Puerto remoto','remotePort',false)}${row('Medio','medium',true)}${row('Ruta / uso','route',false)}</tbody></table></div>`;
}
function matrixChunks(ports,size){const out=[];for(let i=0;i<ports.length;i+=size)out.push(ports.slice(i,i+size));return out;}
function matrixHeader(matrix,rack,chunk,index,total){
 return`<div class="matrix-title"><h3>${esc(matrix.deviceName)}</h3><span>${esc(rack?rack.name||rack.id:'Sin rack')} · ${esc(matrix.ports.length)} puertos</span></div><p class="matrix-range">Banco ${index+1}/${total} · ${esc(chunk[0].name)} – ${esc(chunk[chunk.length-1].name)}</p>`;
}
function portMatrices(model,project){
 const matrices=arr(model.portMatrices);
 if(!matrices.length)return'<p class="empty">No hay equipos con puertos definidos.</p>';
 return matrices.map(matrix=>{
   const rack=byId(project.racks,matrix.rackId);
   const screenChunks=matrixChunks(matrix.ports,12),printChunks=matrixChunks(matrix.ports,6);
   const screen=`<article class="matrix-card matrix-screen"><div class="matrix-title"><h3>${esc(matrix.deviceName)}</h3><span>${esc(rack?rack.name||rack.id:'Sin rack')} · ${esc(matrix.ports.length)} puertos</span></div>${screenChunks.map((chunk,i)=>`<div class="matrix-block"><p class="matrix-range">Bloque ${i+1} · ${esc(chunk[0].name)} – ${esc(chunk[chunk.length-1].name)}</p>${portMatrixChunk(chunk)}</div>`).join('')}</article>`;
   const print=`<div class="matrix-print">${printChunks.map((chunk,i)=>`<article class="matrix-print-card">${matrixHeader(matrix,rack,chunk,i,printChunks.length)}${portMatrixChunk(chunk)}</article>`).join('')}</div>`;
   return screen+print;
 }).join('');
}
function feedClass(feed){const s=clean(feed).toUpperCase();if(s==='A')return'feed-a';if(s==='B')return'feed-b';if(s.includes('UPS'))return'feed-ups';return'feed-other';}
function powerMap(project,model){
 const rows=arr(model.powerMap&&model.powerMap.rows),pdus=arr(model.powerMap&&model.powerMap.pdus),racks=arr(model.racks&&model.racks.racks);
 if(!rows.length&&!pdus.length)return'<p class="empty">No hay PDU ni conexiones de alimentación documentadas.</p>';
 const rackIds=new Set([...racks.map(r=>r.id),...rows.map(r=>r.rackId).filter(Boolean),...pdus.map(p=>p.rackId).filter(Boolean)]);
 if(rows.some(r=>!r.rackId)||pdus.some(p=>!p.rackId))rackIds.add('');
 return Array.from(rackIds).map(rackId=>{
   const rack=byId(project.racks,rackId),ownRows=rows.filter(r=>(r.rackId||'')===(rackId||'')),ownPdus=pdus.filter(p=>(p.rackId||'')===(rackId||''));
   if(!ownRows.length&&!ownPdus.length)return'';
   const pduCards=ownPdus.length?`<div class="pdu-grid">${ownPdus.map(p=>`<div class="pdu-card"><b>${esc(p.name)}</b><span class="feed-badge ${feedClass(p.feed)}">Feed ${esc(p.feed||'—')}</span><small>${esc(p.outletCount||0)} tomas${p.maxPowerWatts?` · ${esc(p.maxPowerWatts)} W`:''}</small></div>`).join('')}</div>`:'<p class="empty">Sin PDU documentada en este rack.</p>';
   const connectionTable=ownRows.length?`<div class="table-wrap"><table><thead><tr><th>Equipo</th><th>PSU</th><th>PDU</th><th>Toma</th><th>Feed</th><th>Estado</th></tr></thead><tbody>${ownRows.map(r=>`<tr class="${r.status==='missing'?'power-missing':''}"><td>${esc(r.deviceName)}</td><td>PSU-${esc(r.psu)}</td><td>${esc(r.pduName)}</td><td>${esc(r.outlet||'—')}</td><td><span class="feed-badge ${feedClass(r.feed)}">${esc(r.feed||'—')}</span></td><td>${esc(r.status==='connected'?'Conectada':r.status==='invalid'?'PDU inválida':'Pendiente')}</td></tr>`).join('')}</tbody></table></div>`:'<p class="empty">No hay equipos con alimentación asociada.</p>';
   return`<article class="power-card"><h3>${esc(rack?rack.name||rack.id:'Sin rack asignado')}</h3>${pduCards}${connectionTable}</article>`;
 }).join('');
}
function rackSummaryReport(project,model){
 const rows=arr(model.rackSummaries).map(r=>{
   const loc=byId(project.physicalLocations,r.locationId);
   return[r.rackName,loc?loc.name||loc.id:'—',`${r.usedUnits}/${r.totalUnits}U`,r.freeUnits,r.devices,r.passiveItems,r.patchPanels,r.dataLinks+r.structuredRuns,r.pdus,r.feeds.length?r.feeds.join(' / '):'—',r.missingPower,r.issues];
 });
 return table(['Rack','Ubicación','Uso','U libres','Equipos','Pasivo','Patch panels','Conexiones datos','PDU','Feeds','Energía pendiente','Incidencias'],rows,'No hay racks definidos.');
}
function structuredChainsReport(model){
 const chains=arr(model.structuredChains);
 if(!chains.length)return'<p class="empty">No hay cadenas de cableado estructurado documentadas.</p>';
 return chains.map(chain=>{
   const state=chain.complete?'Completa':`Incompleta: ${arr(chain.missing).join(', ')||'revisar datos'}`;
   const total=chain.totalLengthM!=null?`${Math.round(chain.totalLengthM*10)/10} m totales`:'Longitud total no documentada';
   return`<article class="chain-card ${chain.complete?'chain-ok':'chain-pending'}"><div class="chain-title"><div><h3>${esc(chain.label)}</h3><span>${esc(state)} · ${esc(total)}</span></div><b>${esc(chain.cableType)}</b></div><div class="chain-flow"><div><small>Switch</small><strong>${esc(chain.switchDeviceName)}</strong><span>${esc(chain.switchPortName)}</span></div><i>→</i><div><small>Patch panel</small><strong>${esc(chain.patchPanelName)}</strong><span>P${esc(chain.patchPort||'—')}</span></div><i>→</i><div><small>Enlace permanente</small><strong>${esc(chain.cableType)}</strong><span>${esc(chain.lengthM!=null?chain.lengthM+' m':'—')}</span></div><i>→</i><div><small>Toma</small><strong>${esc(chain.outletName)}</strong><span>P${esc(chain.outletPort||1)}</span></div><i>→</i><div><small>Equipo final</small><strong>${esc(chain.hostName)}</strong><span>${esc(chain.locationName)}</span></div></div>${table(['Tramo','Origen','Destino','Longitud / detalle'],[
    ['Latiguillo rack',`${chain.switchDeviceName} · ${chain.switchPortName}`,`${chain.patchPanelName} · P${chain.patchPort||'—'}`,chain.patchCordLengthM!=null?`${chain.patchCordLengthM} m`:'—'],
    ['Cable permanente',`${chain.patchPanelName} · P${chain.patchPort||'—'}`,`${chain.outletName} · P${chain.outletPort||1}`,[chain.cableType,chain.lengthM!=null?`${chain.lengthM} m`:null,chain.route].filter(Boolean).join(' · ')],
    ['Latiguillo final',`${chain.outletName} · P${chain.outletPort||1}`,chain.hostName,chain.hostCordLengthM!=null?`${chain.hostCordLengthM} m`:'—']
   ],'')}</article>`;
 }).join('');
}
function installationChecklistReport(project,model){
 const tasks=arr(model.installationChecklist);
 if(!tasks.length)return'<p class="empty">No hay tareas de instalación derivadas del proyecto.</p>';
 const ids=[...new Set(tasks.map(t=>t.rackId||''))];
 return ids.map(rackId=>{
   const rack=byId(project.racks,rackId),own=tasks.filter(t=>(t.rackId||'')===rackId);
   return`<article class="check-card"><h3>${esc(rack?rack.name||rack.id:'Tareas sin rack asignado')}</h3><div class="table-wrap"><table class="check-table"><thead><tr><th>Hecho</th><th>Área</th><th>Tarea</th><th>Referencia</th><th>Documentación</th></tr></thead><tbody>${own.map(t=>`<tr class="${t.documented?'':'check-pending'}"><td class="checkbox">☐</td><td>${esc(t.category)}</td><td>${esc(t.task)}</td><td>${esc(t.reference)}</td><td>${esc(t.documented?'Lista':'Pendiente')}</td></tr>`).join('')}</tbody></table></div></article>`;
 }).join('');
}
function rackItemFace(item){
 const face=clean(item&&item.face).toLowerCase();
 if(face==='rear'||face==='back'||face==='trasera')return'rear';
 if(face==='both'||face==='front-rear'||face==='both-sides')return'both';
 return'front';
}
function rackItemClass(item){
 const t=clean(item&&item.type).toLowerCase();
 if(t.includes('patch'))return'rack-item-patch';
 if(t.includes('cable'))return'rack-item-cable';
 if(t.includes('shelf')||t.includes('tray'))return'rack-item-shelf';
 if(item&&item.deviceId)return'rack-item-device';
 return'rack-item-passive';
}
function rackFaceVisual(project,rack,items,face){
 const units=Math.max(1,Number(rack&&rack.rackUnits||42));
 const own=arr(items).filter(i=>i&&i.rackId===rack.id);
 const rows=[];
 for(let u=units;u>=1;u--){
   const hit=own.find(item=>{
     const start=Number(item.startUnit),height=Math.max(1,Number(item.heightUnits||1)),f=rackItemFace(item);
     return Number.isFinite(start)&&u>=start&&u<start+height&&(f===face||f==='both');
   });
   let content='<span class="rack-empty">Libre</span>';
   let cls='rack-slot-empty';
   if(hit){
     const start=Number(hit.startUnit),height=Math.max(1,Number(hit.heightUnits||1)),end=start+height-1;
     const label=rackAssociation(project,hit);
     const isTop=u===end;
     content=isTop?`<strong>${esc(label)}</strong><small>${esc(hit.type||'elemento')} · ${esc(rackRange(hit))}</small>`:'<span class="rack-continuation">│</span>';
     cls=rackItemClass(hit);
   }
   rows.push(`<div class="rack-face-row ${cls}"><span class="rack-unit">U${u}</span><div class="rack-slot">${content}</div></div>`);
 }
 const pdus=face==='rear'?arr(project.pdus).filter(p=>p&&p.rackId===rack.id):[];
 const pduRail=pdus.length?`<div class="rear-pdu-rail">${pdus.map(p=>`<div class="rear-pdu ${feedClass(p.feed)}"><b>${esc(p.name||p.id)}</b><span>Feed ${esc(p.feed||'—')}</span><small>${esc(p.outletCount||0)} tomas</small></div>`).join('')}</div>`:'';
 return`<div class="rack-face-card"><div class="rack-face-head"><b>${face==='rear'?'Vista trasera':'Vista frontal'}</b><span>${units}U</span></div><div class="rack-face-body"><div class="rack-unit-stack">${rows.join('')}</div>${pduRail}</div></div>`;
}
function rackVisualReport(project,model){
 const racks=arr(model.racks&&model.racks.racks),items=arr(model.racks&&model.racks.items);
 if(!racks.length)return'<p class="empty">No hay racks definidos para generar elevaciones.</p>';
 return racks.map(rack=>{
   const loc=byId(project.physicalLocations,rack.locationId);
   return`<article class="rack-visual-card"><div class="rack-visual-title"><div><h3>${esc(rack.name||rack.id)}</h3><span>${esc(loc?loc.name||loc.id:'Ubicación no documentada')}</span></div><span class="rack-visual-hint">Frontal / trasera</span></div><div class="rack-elevations">${rackFaceVisual(project,rack,items,'front')}${rackFaceVisual(project,rack,items,'rear')}</div></article>`;
 }).join('');
}
function rackPlanItems(project,model,rack){
 const items=arr(model.racks&&model.racks.items).filter(i=>i&&i.rackId===rack.id).slice().sort((a,b)=>Number(b.startUnit||0)-Number(a.startUnit||0));
 const pdus=arr(project.pdus).filter(p=>p&&p.rackId===rack.id);
 const rows=items.map(i=>`<div class="plan-rack-item ${rackItemClass(i)}"><b>${esc(rackRange(i))}</b><span>${esc(rackAssociation(project,i))}</span><small>${esc(i.face||'front')} · ${esc(i.type||'elemento')}</small></div>`).join('');
 const pduRows=pdus.map(p=>`<div class="plan-rack-item plan-pdu ${feedClass(p.feed)}"><b>PDU</b><span>${esc(p.name||p.id)}</span><small>Feed ${esc(p.feed||'—')} · ${esc(p.outletCount||0)} tomas</small></div>`).join('');
 return`<div class="plan-rack-box"><div class="plan-rack-head"><b>${esc(rack.name||rack.id)}</b><span>${esc(rack.rackUnits||42)}U</span></div><div class="plan-rack-items">${rows||'<span class="rack-empty">Sin elementos montados</span>'}${pduRows}</div></div>`;
}
function planRef(prefix,index){return`${prefix}-${String(index+1).padStart(2,'0')}`;}
function planNode(label,detail){
 return`<div class="plan-node"><strong>${esc(label||'—')}</strong>${detail?`<small>${esc(detail)}</small>`:''}</div>`;
}
function splitEndpoint(label){
 const parts=clean(label).split(' · ');
 return{label:parts[0]||label||'—',detail:parts.slice(1).join(' · ')||''};
}
function primaryDataEdges(edges){
 return arr(edges).slice().sort((a,b)=>{
   const ext=(a.internal?1:0)-(b.internal?1:0);if(ext)return ext;
   const cap=Number(b.capacityMbps||0)-Number(a.capacityMbps||0);if(cap)return cap;
   return clean(a.label||a.id).localeCompare(clean(b.label||b.id),undefined,{numeric:true,sensitivity:'base'});
 });
}
function rackInstallationPlan(project,model){
 const racks=arr(model.racks&&model.racks.racks);
 if(!racks.length)return'<p class="empty">No hay racks definidos para generar el plano de replanteo.</p>';
 return racks.map(rack=>{
   const topology=arr(model.rackTopologies).find(t=>t&&t.rack&&t.rack.id===rack.id)||{dataEdges:[],powerEdges:[]};
   const data=primaryDataEdges(topology.dataEdges).map((e,i)=>Object.assign({ref:planRef('DATA',i)},e));
   const chains=arr(model.structuredChains).filter(x=>x.rackId===rack.id).slice().sort((a,b)=>clean(a.label||a.id).localeCompare(clean(b.label||b.id),undefined,{numeric:true,sensitivity:'base'})).map((x,i)=>Object.assign({ref:planRef('CAB',i)},x));
   const power=arr(topology.powerEdges).slice().sort((a,b)=>clean(a.fromLabel).localeCompare(clean(b.fromLabel),undefined,{numeric:true,sensitivity:'base'})).map((e,i)=>Object.assign({ref:planRef('PWR',i)},e));
   const dataVisual=data.slice(0,8).map(e=>{const a=splitEndpoint(e.fromLabel),b=splitEndpoint(e.toLabel);const detail=[e.label,e.cableId,e.media,e.capacityMbps?`${e.capacityMbps} Mbps`:null,e.internal?'interno':'hacia otro rack/equipo'].filter(Boolean).join(' · ');return`<div class="plan-path plan-data"><span class="plan-ref">${esc(e.ref)}</span>${planNode(a.label,a.detail)}<div class="plan-edge"><b>→ ${esc(e.label||e.id||'Enlace')} →</b><small>${esc(detail)}</small></div>${planNode(b.label,b.detail)}</div>`;}).join('');
   const chainVisual=chains.slice(0,6).map(x=>`<div class="plan-path plan-cabling"><span class="plan-ref">${esc(x.ref)}</span>${planNode(x.switchDeviceName,x.switchPortName)}<div class="plan-arrow">→</div>${planNode(x.patchPanelName,'P'+(x.patchPort||'—'))}<div class="plan-arrow">→</div>${planNode(x.outletName,'P'+(x.outletPort||1))}<div class="plan-arrow">→</div>${planNode(x.hostName,x.locationName)}<small class="plan-path-note">${esc([x.label,x.cableType,x.lengthM!=null?x.lengthM+' m':null,x.route].filter(Boolean).join(' · '))}</small></div>`).join('');
   const powerVisual=power.slice(0,6).map(e=>{const a=splitEndpoint(e.fromLabel),b=splitEndpoint(e.toLabel);return`<div class="plan-path plan-power"><span class="plan-ref">${esc(e.ref)}</span>${planNode(a.label,a.detail)}<div class="plan-edge"><b>→ Feed ${esc(e.feed||'—')} →</b><small>${esc(e.label||e.id||'Alimentación')}</small></div>${planNode(b.label,b.detail)}</div>`;}).join('');
   const extra=[];
   if(data.length>8)extra.push(`${data.length-8} enlace(s) de datos adicional(es)`);
   if(chains.length>6)extra.push(`${chains.length-6} cadena(s) estructurada(s) adicional(es)`);
   if(power.length>6)extra.push(`${power.length-6} alimentación(es) adicional(es)`);
   const refs=[];
   data.forEach(e=>refs.push([e.ref,'Datos',e.fromLabel,e.toLabel,[e.media,e.capacityMbps?e.capacityMbps+' Mbps':null].filter(Boolean).join(' · ')||'—',[e.label,e.cableId,e.physicalPath].filter(Boolean).join(' · ')||'—']));
   chains.forEach(x=>refs.push([x.ref,'Estructurado',`${x.switchDeviceName} · ${x.switchPortName}`,`${x.hostName} · ${x.outletName} P${x.outletPort||1}`,[x.cableType,x.lengthM!=null?x.lengthM+' m':null].filter(Boolean).join(' · ')||'—',`${x.patchPanelName} P${x.patchPort||'—'} · ${x.route}`]));
   power.forEach(e=>refs.push([e.ref,'Energía',e.fromLabel,e.toLabel,`Feed ${e.feed||'—'}`,e.label||e.id||'—']));
   const loc=byId(project.physicalLocations,rack.locationId);
   const visual=(dataVisual||chainVisual||powerVisual)?`<div class="plan-link-groups">${dataVisual?`<h4>Enlaces directos principales</h4>${dataVisual}`:''}${chainVisual?`<h4>Cableado estructurado</h4>${chainVisual}`:''}${powerVisual?`<h4>Alimentación</h4>${powerVisual}`:''}</div>`:'<p class="empty">No hay conexiones documentadas para este rack.</p>';
   return`<article class="rack-plan-card"><div class="rack-plan-title"><div><h3>${esc(rack.name||rack.id)}</h3><span>${esc(loc?loc.name||loc.id:'Ubicación no documentada')}</span></div><b>Plano de replanteo</b></div><div class="rack-plan-layout">${rackPlanItems(project,model,rack)}${visual}</div>${extra.length?`<p class="plan-more">El diagrama resume los enlaces más relevantes: ${esc(extra.join(' · '))}. La tabla siguiente conserva todos.</p>`:''}<h4>Referencias de instalación</h4>${table(['Ref.','Tipo','Origen','Destino','Medio / feed','Etiqueta / ruta'],refs,'Sin referencias de conexión.')}</article>`;
 }).join('');
}
function technicianReadiness(project,model,statusInfo){
 const incomplete=arr(model.structuredChains).filter(x=>!x.complete).length;
 const pendingTasks=arr(model.installationChecklist).filter(x=>!x.documented).length;
 const missingPower=arr(model.powerMap&&model.powerMap.rows).filter(x=>x.status!=='connected').length;
 const rackIssues=arr(model.racks&&model.racks.issues).length;
 const rows=[
  ['Estado global',statusInfo.state,statusInfo.blocking?'Resolver bloqueantes antes de la puesta en marcha':'Revisar advertencias y proceder según checklist'],
  ['Cadenas físicas incompletas',incomplete,incomplete?'Completar patch panel, toma, puerto o equipo final':'Todas las cadenas documentadas están completas'],
  ['Tareas con documentación pendiente',pendingTasks,pendingTasks?'Completar referencias antes del cierre de instalación':'Checklist documental completo'],
  ['Alimentaciones pendientes',missingPower,missingPower?'Asignar PDU, toma y feed':'Alimentación documentada'],
  ['Incidencias de rack',rackIssues,rackIssues?'Resolver colisiones, capacidad o referencias':'Sin incidencias de rack']
 ];
 return`<div class="readiness-grid">${rows.map(([k,v,n])=>{const pending=k==='Estado global'?statusInfo.blocking>0:Number(v)>0;return`<div class="readiness-card ${pending?'readiness-pending':'readiness-ok'}"><span>${esc(k)}</span><b>${esc(v)}</b><small>${esc(n)}</small></div>`;}).join('')}</div>`;
}
function workSequenceReport(){
 const steps=[
  ['1','Preparación','Confirmar rack, U, material pasivo, equipos, PDU, latiguillos y cableado antes de montar.'],
  ['2','Montaje','Instalar elementos siguiendo las elevaciones frontal/trasera y respetando U y cara indicadas.'],
  ['3','Alimentación','Conectar cada PSU a la PDU y toma documentadas, manteniendo separados los feeds A/B.'],
  ['4','Datos en rack','Ejecutar enlaces directos y parcheos switch ↔ patch panel según matrices y cadenas físicas.'],
  ['5','Cableado horizontal','Tender y certificar los enlaces permanentes hasta las tomas respetando tipo, longitud y ruta.'],
  ['6','Puesto final','Conectar toma ↔ equipo final, etiquetar ambos extremos y comprobar enlace físico.'],
  ['7','Verificación','Completar el checklist, resolver pendientes y registrar la aceptación del rack.']
 ];
 return`<div class="work-sequence">${steps.map(([n,t,d])=>`<div class="work-step"><b>${esc(n)}</b><div><strong>${esc(t)}</strong><span>${esc(d)}</span></div></div>`).join('')}</div>`;
}
function acceptanceReport(project,model){
 const racks=arr(model.rackSummaries);
 if(!racks.length)return'<p class="empty">No hay racks para hoja de aceptación.</p>';
 return racks.map(r=>`<article class="acceptance-card"><h3>${esc(r.rackName)}</h3><div class="acceptance-grid"><div><span>Técnico instalador</span><b>________________________________</b></div><div><span>Fecha / hora</span><b>________________________________</b></div><div><span>Resultado</span><b>☐ Conforme &nbsp;&nbsp; ☐ Pendiente</b></div><div><span>Firma</span><b>________________________________</b></div></div><p><b>Observaciones:</b></p><div class="notes-lines">________________________________________________________________________________<br>________________________________________________________________________________<br>________________________________________________________________________________</div></article>`).join('');
}
function build(project,options){
 project=project||{};options=options||{};
 const g=gate(project,options),model=MODEL?MODEL.build(project,{gateReport:g}):null;
 if(!model)throw new Error('NetWizardReportModel no está disponible.');
 const s=status(g),findings=arr(g.issues);
 const readiness=technicianReadiness(project,model,s);
 const summary=`<div class="stats">${[['Dispositivos',model.summary.devices],['Puertos',model.summary.ports],['Enlaces',model.summary.links],['Hosts',model.summary.hosts],['Racks',model.summary.racks],['Carga PoE',`${Math.round(model.summary.poeLoadWatts*10)/10} W`]].map(([k,v])=>`<div><b>${esc(v)}</b><span>${esc(k)}</span></div>`).join('')}</div><div class="risk"><b>${esc(s.state)}</b><span>Riesgo ${esc(s.risk)} · ${s.blocking} bloqueantes · ${s.errors} errores · ${s.warnings} advertencias</span></div>`;
 const rackSummary=table(['Rack','Ocupación','Elementos','Potencia','Refrigeración'],rackRows(model),'No hay racks definidos.');
 const connectivity=table(['Enlace','Extremo A','Extremo B','Medio','Capacidad','Ruta física'],model.connectivity.map(x=>[x.name,x.aPort,x.bPort,x.media,x.capacityMbps?`${x.capacityMbps} Mbps`:'—',x.physicalPath]),'No hay enlaces documentados.');
 const inventory=table(['Equipo','Tipo','Fabricante/plataforma','Modelo','Rack','U','Consumo'],model.inventory.map(x=>[x.name,x.type,x.vendor,x.model,x.rackId||'Sin rack',x.rackUnit||'—',x.powerDrawWatts?`${x.powerDrawWatts} W`:'—']),'No hay equipos inventariados.');
 const materials=table(['Material','Tipo','Cantidad','Rack'],model.materials.map(x=>[x.description||x.label||x.name||x.kind||x.type||'Material',x.kind||x.type||'Material',x.quantity||1,x.rackId||'—']),'No hay material pasivo definido.');
 const rackConnectionRows=[];
 for(const topology of arr(model.rackTopologies)){
   const rackName=topology.rack&&topology.rack.name||topology.rack&&topology.rack.id||'Rack';
   for(const e of arr(topology.dataEdges))rackConnectionRows.push([rackName,'Datos',e.fromLabel,e.toLabel,[e.media||'—',e.capacityMbps?`${e.capacityMbps} Mbps`:null,e.internal?'interno':'externo'].filter(Boolean).join(' · ')]);
   for(const e of arr(topology.powerEdges))rackConnectionRows.push([rackName,'Energía',e.fromLabel,e.toLabel,`Feed ${e.feed||'—'}`]);
 }
 const rackConnections=table(['Rack','Tipo','Origen','Destino','Detalle'],rackConnectionRows,'No hay conexiones de datos o alimentación asociadas a racks.');
 const cablePathRows=arr(model.structuredCabling&&model.structuredCabling.paths).map(p=>[p.route||p.label||p.id,p.switchPortLabel,`${p.panelLabel} · P${p.patchPort}`,`${p.outletLabel} · P${p.outletPort}`,p.hostLabel,p.cableType,p.lengthM!=null?`${p.lengthM} m`:'—',p.complete?'Completa':'Incompleta']);
 const cablePaths=table(['Ruta','Switch','Patch panel','Toma','Host','Cable','Longitud','Estado'],cablePathRows,'No hay cableado estructurado documentado.');
 const issueRows=findings.map(i=>[i.code||'—',i.severity||'info',i.category||'general',i.blocking?'Sí':'No',i.message||'']);
 const body=[
  `<section class="cover"><div class="cover-kicker">NETWIZARD 3.50.0</div><h1>Manual técnico de instalación</h1><h2>${esc(model.project.name)}</h2><div class="cover-status"><b>${esc(s.state)}</b><span>Riesgo ${esc(s.risk)}</span></div><div class="cover-meta"><span>Esquema ${esc(model.project.schemaVersion||'—')}</span><span>${esc(model.summary.racks)} rack(s)</span><span>${esc(model.summary.devices)} equipo(s)</span><span>${esc(model.summary.ports)} puerto(s)</span></div><p>Documento operativo para montaje, alimentación, cableado, etiquetado, certificación y aceptación.</p></section>`,
  section(1,'Estado de preparación para instalación',readiness+workSequenceReport()),
  section(2,'Resumen por armario / rack',rackSummaryReport(project,model)),
  section(3,'Elevaciones frontal y trasera',rackVisualReport(project,model)),
  section(4,'Plano visual de replanteo y conexiones',rackInstallationPlan(project,model)),
  section(5,'Racks y ocupación',rackSummary+rackDetails(project,model)),
  section(6,'Matrices de puertos por equipo',portMatrices(model,project)),
  section(7,'Leyenda de medios y cableado',mediaLegend()),
  section(8,'Mapa de alimentación PDU / PSU',powerMap(project,model)),
  section(9,'Cadena completa de cableado estructurado',structuredChainsReport(model)),
  section(10,'Checklist de instalación',installationChecklistReport(project,model)),
  section(11,'Conectividad directa de datos',connectivity),
  section(12,'Inventario y materiales',inventory+'<h3>Material pasivo</h3>'+materials),
  section(13,'Conexiones físicas por rack',rackConnections),
  section(14,'Validación e incidencias',table(['Código','Severidad','Categoría','Bloqueante','Descripción'],issueRows,'No se han detectado incidencias.')),
  section(15,'Aceptación y cierre de instalación',acceptanceReport(project,model))
 ].join('');
 const css=':root{font-family:Inter,Segoe UI,Arial,sans-serif;color:#172033;-webkit-print-color-adjust:exact;print-color-adjust:exact}body{margin:0;background:#eef2f7}.toolbar{position:sticky;top:0;background:#111827;padding:10px;text-align:right;z-index:5}.toolbar button{padding:9px 14px;border:0;border-radius:8px;font-weight:700}.page{max-width:1180px;margin:20px auto;background:#fff;padding:36px;box-shadow:0 10px 35px #0002}header{display:flex;justify-content:space-between;gap:20px;border-bottom:4px solid #2563eb;padding-bottom:20px}header span{font-size:12px;color:#2563eb;font-weight:800}header h1{margin:6px 0}.stats{display:grid;grid-template-columns:repeat(6,1fr);gap:8px;margin:18px 0}.stats div{padding:12px;border:1px solid #dbe3ee;border-radius:8px;background:#f8fafc}.stats b{display:block;font-size:20px}.stats span{font-size:11px;color:#64748b}.risk{padding:14px;background:#eff6ff;border-left:4px solid #2563eb;display:flex;justify-content:space-between}section{margin:30px 0}h2{font-size:21px;border-bottom:1px solid #dbe3ee;padding-bottom:7px}h3{font-size:15px}.table-wrap,.port-matrix-wrap{overflow:auto}table{width:100%;border-collapse:collapse;font-size:12px}th,td{border:1px solid #dbe3ee;padding:7px;text-align:left;vertical-align:top}th{background:#eff6ff}.empty{padding:12px;background:#f8fafc;border-left:4px solid #94a3b8}.rack-card,.matrix-card,.power-card{border:1px solid #dbe3ee;border-radius:10px;padding:14px;margin:14px 0;break-inside:avoid}.rack-title,.matrix-title{display:flex;align-items:flex-start;justify-content:space-between;gap:12px}.rack-title h3,.matrix-title h3,.power-card h3{margin:0 0 4px}.rack-title span,.matrix-title span{font-size:11px;color:#64748b}.rack-meta{display:flex;gap:8px;flex-wrap:wrap;margin:10px 0}.rack-meta span{padding:6px 9px;background:#f8fafc;border:1px solid #dbe3ee;border-radius:999px;font-size:11px}.rack-pdu{font-size:11px;color:#475569}.rack-warnings{margin-top:9px;padding:9px;background:#fff7ed;border-left:4px solid #f97316}.rack-warnings ul{margin:5px 0 0 18px}.port-matrix{width:max-content;min-width:100%;table-layout:auto}.port-matrix th,.port-matrix td{min-width:105px;max-width:170px}.port-matrix .matrix-label{position:sticky;left:0;z-index:2;min-width:105px;background:#eff6ff;font-weight:800}.matrix-block{margin:10px 0 18px}.matrix-range{font-size:11px;color:#64748b;margin:0 0 5px}.media-cell{border-top-width:3px}.mini-swatch,.legend-swatch{display:inline-block;width:12px;height:12px;border-radius:3px;margin-right:5px;vertical-align:-2px}.legend{display:grid;grid-template-columns:repeat(3,minmax(180px,1fr));gap:8px}.legend-item{display:flex;align-items:center;padding:9px;border:1px solid #dbe3ee;border-radius:8px;background:#fff}.media-copper{background:#dbeafe!important;border-color:#2563eb!important}.media-fiber-mm{background:#ffedd5!important;border-color:#f97316!important}.media-fiber-sm{background:#fef9c3!important;border-color:#ca8a04!important}.media-fiber{background:#cffafe!important;border-color:#0891b2!important}.media-dac-aoc{background:#ede9fe!important;border-color:#7c3aed!important}.media-console{background:#e5e7eb!important;border-color:#6b7280!important}.media-other{background:#f1f5f9!important;border-color:#64748b!important}.media-free{background:#f8fafc!important;border-color:#cbd5e1!important;color:#64748b}.pdu-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(190px,1fr));gap:8px;margin:10px 0}.pdu-card{border:1px solid #dbe3ee;border-radius:8px;padding:10px;display:grid;gap:5px}.pdu-card small{color:#64748b}.feed-badge{display:inline-block;border-radius:999px;padding:3px 7px;font-size:10px;font-weight:800;width:max-content}.feed-a{background:#fee2e2!important;border-color:#dc2626!important;color:#991b1b}.feed-b{background:#dcfce7!important;border-color:#16a34a!important;color:#166534}.feed-ups{background:#fef3c7!important;border-color:#d97706!important;color:#92400e}.feed-other{background:#e2e8f0!important;border-color:#64748b!important;color:#334155}.power-missing td{background:#fff7ed}.chain-card,.check-card{border:1px solid #dbe3ee;border-radius:10px;padding:14px;margin:14px 0;break-inside:avoid}.chain-title{display:flex;justify-content:space-between;gap:12px;align-items:flex-start}.chain-title h3,.check-card h3{margin:0 0 5px}.chain-title span{font-size:11px;color:#64748b}.chain-flow{display:grid;grid-template-columns:1fr auto 1fr auto 1fr auto 1fr auto 1fr;gap:6px;align-items:stretch;margin:12px 0}.chain-flow>div{border:1px solid #dbe3ee;border-radius:8px;padding:9px;background:#f8fafc;display:grid;gap:3px}.chain-flow small{color:#64748b}.chain-flow i{align-self:center;font-style:normal;font-size:18px;color:#64748b}.chain-pending{border-left:4px solid #f97316}.chain-ok{border-left:4px solid #16a34a}.checkbox{font-size:18px;text-align:center;width:42px}.check-pending td{background:#fff7ed}.check-table th:first-child,.check-table td:first-child{text-align:center}@media print{body{background:#fff}.toolbar{display:none}.page{margin:0;max-width:none;box-shadow:none;padding:0}.rack-card,.matrix-card,.power-card{break-inside:avoid}}@media(max-width:800px){.stats{grid-template-columns:repeat(2,1fr)}.legend{grid-template-columns:1fr}.chain-flow{display:flex;flex-direction:column}.chain-flow i{transform:rotate(90deg);align-self:center}.page{margin:0;padding:18px}}.cover{min-height:680px;display:flex;flex-direction:column;justify-content:center;align-items:flex-start;border:0;margin:0;break-after:page}.cover-kicker{font-size:13px;font-weight:900;color:#2563eb;letter-spacing:.12em}.cover h1{font-size:42px;margin:12px 0 4px}.cover h2{font-size:26px;margin:0 0 28px;color:#475569;border:0}.cover-status{display:flex;gap:12px;align-items:center;padding:14px 18px;border-left:5px solid #2563eb;background:#eff6ff}.cover-status b{font-size:18px}.cover-meta{display:flex;flex-wrap:wrap;gap:8px;margin:20px 0}.cover-meta span{border:1px solid #dbe3ee;border-radius:999px;padding:6px 10px;background:#f8fafc;font-size:12px}.rack-visual-card,.acceptance-card{border:1px solid #dbe3ee;border-radius:10px;padding:14px;margin:14px 0;break-inside:avoid}.rack-visual-title{display:flex;align-items:flex-start;justify-content:space-between;gap:12px}.rack-visual-title h3,.acceptance-card h3{margin:0 0 4px}.rack-visual-title span{font-size:11px;color:#64748b}.rack-elevations{display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-top:12px}.rack-face-card{border:2px solid #334155;border-radius:8px;overflow:hidden;background:#f8fafc}.rack-face-head{display:flex;justify-content:space-between;background:#0f172a;color:#fff;padding:7px 9px;font-size:12px}.rack-face-body{display:flex;align-items:stretch}.rack-unit-stack{flex:1}.rack-face-row{display:grid;grid-template-columns:42px 1fr;min-height:18px;border-bottom:1px solid #cbd5e1}.rack-unit{padding:2px 5px;background:#e2e8f0;border-right:1px solid #cbd5e1;font-size:9px;font-weight:800;text-align:right}.rack-slot{padding:2px 6px;display:flex;justify-content:space-between;gap:6px;align-items:center;font-size:9px}.rack-slot strong{white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.rack-slot small{color:#475569;white-space:nowrap}.rack-slot-empty{background:#f8fafc;color:#94a3b8}.rack-item-device{background:#dbeafe}.rack-item-patch{background:#dcfce7}.rack-item-cable{background:#fef3c7}.rack-item-shelf{background:#ede9fe}.rack-item-passive{background:#e2e8f0}.rack-continuation{font-weight:900;color:#64748b}.rear-pdu-rail{width:92px;border-left:2px solid #334155;padding:4px;display:flex;flex-direction:column;gap:5px;background:#fff}.rear-pdu{border:1px solid currentColor;border-radius:6px;padding:5px;display:grid;gap:2px;font-size:9px}.rear-pdu small{font-size:8px}.readiness-grid{display:grid;grid-template-columns:repeat(5,1fr);gap:8px;margin:14px 0}.readiness-card{border:1px solid #dbe3ee;border-radius:8px;padding:10px;display:grid;gap:4px}.readiness-card span{font-size:10px;color:#64748b;text-transform:uppercase;font-weight:800}.readiness-card b{font-size:18px}.readiness-card small{font-size:10px;color:#475569}.readiness-pending{border-left:4px solid #f97316;background:#fff7ed}.readiness-ok{border-left:4px solid #16a34a;background:#f0fdf4}.work-sequence{display:grid;gap:7px;margin:14px 0}.work-step{display:grid;grid-template-columns:34px 1fr;gap:9px;align-items:start;border:1px solid #dbe3ee;border-radius:8px;padding:9px}.work-step>b{display:grid;place-items:center;width:28px;height:28px;border-radius:50%;background:#0f172a;color:#fff}.work-step div{display:grid;gap:2px}.work-step span{font-size:11px;color:#475569}.acceptance-grid{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin:12px 0}.acceptance-grid div{display:grid;gap:8px}.acceptance-grid span{font-size:10px;text-transform:uppercase;color:#64748b;font-weight:800}.notes-lines{line-height:2;color:#64748b}@page{size:A4 landscape;margin:10mm}@media print{body{background:#fff;font-size:9pt}.toolbar{display:none}.page{margin:0;max-width:none;box-shadow:none;padding:0}.cover{min-height:180mm}.table-wrap,.port-matrix-wrap{overflow:visible}thead{display:table-header-group}tr,.rack-card,.matrix-card,.power-card,.rack-visual-card,.chain-card,.check-card,.acceptance-card,.matrix-block{break-inside:avoid-page}.rack-elevations{gap:8mm}.rack-face-row{min-height:3.8mm}.rack-slot{font-size:7.5pt}.rack-unit{font-size:7pt}section:not(.cover){break-before:page}h2{break-after:avoid-page}.readiness-grid{grid-template-columns:repeat(5,1fr)}.chain-flow{font-size:8pt}.port-matrix th,.port-matrix td{min-width:22mm;max-width:34mm;padding:1.5mm;font-size:7pt}}@media(max-width:800px){.readiness-grid,.rack-elevations,.acceptance-grid{grid-template-columns:1fr}.rear-pdu-rail{width:76px}}';
 return`<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(model.project.name)} · Manual técnico de instalación</title><style>${css}</style></head><body><div class="toolbar"><button onclick="window.print()">🖨 Imprimir / Guardar PDF</button></div><main class="page">${body}</main></body></html>`;
}
function openReport(project,options){const html=build(project,options),win=root.open&&root.open('','_blank');if(!win)throw new Error('El navegador bloqueó la ventana del informe.');win.document.open();win.document.write(html);win.document.close();return win;}
function currentProject(){const s=root.NetWizardState;if(s&&typeof s.getSnapshot==='function')return s.getSnapshot();return{};}
function inject(){if(!root.document||root.document.getElementById('btnCompactReport'))return;const target=root.document.getElementById('btnExport');if(!target)return;const b=root.document.createElement('button');b.id='btnCompactReport';b.className='btn bs bsm';b.type='button';b.textContent='🧰 Informe de instalación';b.onclick=()=>{try{openReport(currentProject(),{});}catch(e){root.alert&&root.alert(e.message);}};target.parentNode.insertBefore(b,target);}
const api={version:'netwizard-installation-report-v5',build,openReport,currentProject,inject};
root.NetWizardInstallationReport=api;
root.NetWizardCompactReport=api;
if(!root.NetWizardDetailedReport)root.NetWizardDetailedReport=api;
if(typeof module!=='undefined'&&module.exports)module.exports=api;
if(root.document){if(root.document.readyState==='loading')root.document.addEventListener('DOMContentLoaded',inject);else inject();}
})(typeof window!=='undefined'?window:globalThis);
