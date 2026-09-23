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
function portMatrices(model,project){
 const matrices=arr(model.portMatrices);
 if(!matrices.length)return'<p class="empty">No hay equipos con puertos definidos.</p>';
 return matrices.map(matrix=>{
   const rack=byId(project.racks,matrix.rackId);
   const chunks=[];for(let i=0;i<matrix.ports.length;i+=12)chunks.push(matrix.ports.slice(i,i+12));
   return`<article class="matrix-card"><div class="matrix-title"><h3>${esc(matrix.deviceName)}</h3><span>${esc(rack?rack.name||rack.id:'Sin rack')} · ${esc(matrix.ports.length)} puertos</span></div>${chunks.map((chunk,i)=>`<div class="matrix-block"><p class="matrix-range">Bloque ${i+1} · ${esc(chunk[0].name)} – ${esc(chunk[chunk.length-1].name)}</p>${portMatrixChunk(chunk)}</div>`).join('')}</article>`;
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
function build(project,options){
 project=project||{};options=options||{};
 const g=gate(project,options),model=MODEL?MODEL.build(project,{gateReport:g}):null;
 if(!model)throw new Error('NetWizardReportModel no está disponible.');
 const s=status(g),findings=arr(g.issues);
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
  `<header><div><span>NETWIZARD 3.50.0 · Informe de instalación física</span><h1>${esc(model.project.name)}</h1></div><strong>${esc(s.state)}</strong></header>`,
  section(1,'Resumen ejecutivo',summary),
  section(2,'Racks y ocupación',rackSummary+rackDetails(project,model)),
  section(3,'Matrices de puertos por equipo',portMatrices(model,project)),
  section(4,'Leyenda de medios y cableado',mediaLegend()),
  section(5,'Mapa de alimentación PDU / PSU',powerMap(project,model)),
  section(6,'Conectividad de datos',connectivity),
  section(7,'Cableado estructurado',cablePaths),
  section(8,'Inventario y materiales',inventory+'<h3>Material pasivo</h3>'+materials),
  section(9,'Conexiones físicas por rack',rackConnections),
  section(10,'Validación e incidencias',table(['Código','Severidad','Categoría','Bloqueante','Descripción'],issueRows,'No se han detectado incidencias.'))
 ].join('');
 const css=':root{font-family:Inter,Segoe UI,Arial,sans-serif;color:#172033;-webkit-print-color-adjust:exact;print-color-adjust:exact}body{margin:0;background:#eef2f7}.toolbar{position:sticky;top:0;background:#111827;padding:10px;text-align:right;z-index:5}.toolbar button{padding:9px 14px;border:0;border-radius:8px;font-weight:700}.page{max-width:1180px;margin:20px auto;background:#fff;padding:36px;box-shadow:0 10px 35px #0002}header{display:flex;justify-content:space-between;gap:20px;border-bottom:4px solid #2563eb;padding-bottom:20px}header span{font-size:12px;color:#2563eb;font-weight:800}header h1{margin:6px 0}.stats{display:grid;grid-template-columns:repeat(6,1fr);gap:8px;margin:18px 0}.stats div{padding:12px;border:1px solid #dbe3ee;border-radius:8px;background:#f8fafc}.stats b{display:block;font-size:20px}.stats span{font-size:11px;color:#64748b}.risk{padding:14px;background:#eff6ff;border-left:4px solid #2563eb;display:flex;justify-content:space-between}section{margin:30px 0}h2{font-size:21px;border-bottom:1px solid #dbe3ee;padding-bottom:7px}h3{font-size:15px}.table-wrap,.port-matrix-wrap{overflow:auto}table{width:100%;border-collapse:collapse;font-size:12px}th,td{border:1px solid #dbe3ee;padding:7px;text-align:left;vertical-align:top}th{background:#eff6ff}.empty{padding:12px;background:#f8fafc;border-left:4px solid #94a3b8}.rack-card,.matrix-card,.power-card{border:1px solid #dbe3ee;border-radius:10px;padding:14px;margin:14px 0;break-inside:avoid}.rack-title,.matrix-title{display:flex;align-items:flex-start;justify-content:space-between;gap:12px}.rack-title h3,.matrix-title h3,.power-card h3{margin:0 0 4px}.rack-title span,.matrix-title span{font-size:11px;color:#64748b}.rack-meta{display:flex;gap:8px;flex-wrap:wrap;margin:10px 0}.rack-meta span{padding:6px 9px;background:#f8fafc;border:1px solid #dbe3ee;border-radius:999px;font-size:11px}.rack-pdu{font-size:11px;color:#475569}.rack-warnings{margin-top:9px;padding:9px;background:#fff7ed;border-left:4px solid #f97316}.rack-warnings ul{margin:5px 0 0 18px}.port-matrix{width:max-content;min-width:100%;table-layout:auto}.port-matrix th,.port-matrix td{min-width:105px;max-width:170px}.port-matrix .matrix-label{position:sticky;left:0;z-index:2;min-width:105px;background:#eff6ff;font-weight:800}.matrix-block{margin:10px 0 18px}.matrix-range{font-size:11px;color:#64748b;margin:0 0 5px}.media-cell{border-top-width:3px}.mini-swatch,.legend-swatch{display:inline-block;width:12px;height:12px;border-radius:3px;margin-right:5px;vertical-align:-2px}.legend{display:grid;grid-template-columns:repeat(3,minmax(180px,1fr));gap:8px}.legend-item{display:flex;align-items:center;padding:9px;border:1px solid #dbe3ee;border-radius:8px;background:#fff}.media-copper{background:#dbeafe!important;border-color:#2563eb!important}.media-fiber-mm{background:#ffedd5!important;border-color:#f97316!important}.media-fiber-sm{background:#fef9c3!important;border-color:#ca8a04!important}.media-fiber{background:#cffafe!important;border-color:#0891b2!important}.media-dac-aoc{background:#ede9fe!important;border-color:#7c3aed!important}.media-console{background:#e5e7eb!important;border-color:#6b7280!important}.media-other{background:#f1f5f9!important;border-color:#64748b!important}.media-free{background:#f8fafc!important;border-color:#cbd5e1!important;color:#64748b}.pdu-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(190px,1fr));gap:8px;margin:10px 0}.pdu-card{border:1px solid #dbe3ee;border-radius:8px;padding:10px;display:grid;gap:5px}.pdu-card small{color:#64748b}.feed-badge{display:inline-block;border-radius:999px;padding:3px 7px;font-size:10px;font-weight:800;width:max-content}.feed-a{background:#fee2e2!important;border-color:#dc2626!important;color:#991b1b}.feed-b{background:#dcfce7!important;border-color:#16a34a!important;color:#166534}.feed-ups{background:#fef3c7!important;border-color:#d97706!important;color:#92400e}.feed-other{background:#e2e8f0!important;border-color:#64748b!important;color:#334155}.power-missing td{background:#fff7ed}@media print{body{background:#fff}.toolbar{display:none}.page{margin:0;max-width:none;box-shadow:none;padding:0}.rack-card,.matrix-card,.power-card{break-inside:avoid}}@media(max-width:800px){.stats{grid-template-columns:repeat(2,1fr)}.legend{grid-template-columns:1fr}.page{margin:0;padding:18px}}';
 return`<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(model.project.name)} · Informe de instalación</title><style>${css}</style></head><body><div class="toolbar"><button onclick="window.print()">🖨 Imprimir / Guardar PDF</button></div><main class="page">${body}</main></body></html>`;
}
function openReport(project,options){const html=build(project,options),win=root.open&&root.open('','_blank');if(!win)throw new Error('El navegador bloqueó la ventana del informe.');win.document.open();win.document.write(html);win.document.close();return win;}
function currentProject(){const s=root.NetWizardState;if(s&&typeof s.getSnapshot==='function')return s.getSnapshot();return{};}
function inject(){if(!root.document||root.document.getElementById('btnCompactReport'))return;const target=root.document.getElementById('btnExport');if(!target)return;const b=root.document.createElement('button');b.id='btnCompactReport';b.className='btn bs bsm';b.type='button';b.textContent='🧰 Informe de instalación';b.onclick=()=>{try{openReport(currentProject(),{});}catch(e){root.alert&&root.alert(e.message);}};target.parentNode.insertBefore(b,target);}
const api={version:'netwizard-installation-report-v3',build,openReport,currentProject,inject};
root.NetWizardInstallationReport=api;
root.NetWizardCompactReport=api;
if(!root.NetWizardDetailedReport)root.NetWizardDetailedReport=api;
if(typeof module!=='undefined'&&module.exports)module.exports=api;
if(root.document){if(root.document.readyState==='loading')root.document.addEventListener('DOMContentLoaded',inject);else inject();}
})(typeof window!=='undefined'?window:globalThis);
