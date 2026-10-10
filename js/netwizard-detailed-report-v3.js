/* NetWizard Installation Report v7 */
(function(root){
'use strict';
const MODEL=root.NetWizardReportModel||(typeof require==='function'?require('./netwizard-report-model.js'):null);
const arr=v=>Array.isArray(v)?v:[];
const clean=v=>String(v==null?'':v).trim();
function localeOf(options){const explicit=clean(options&&options.locale);if(explicit)return explicit.toLowerCase()==='en'?'en':'es';const i18n=root.NetWizardI18n;const current=i18n&&typeof i18n.getReportLocale==='function'?i18n.getReportLocale():i18n&&typeof i18n.getLocale==='function'?i18n.getLocale():'es';return clean(current).toLowerCase()==='en'?'en':'es';}
function pick(locale,es,en){return locale==='en'?en:es;}
const EN_REPLACEMENTS=[
 ['Manual técnico de instalación','Technical installation manual'],
 ['Etiquetas de instalación','Installation labels'],
 ['Imprimir / Guardar PDF','Print / Save PDF'],
 ['Estado de preparación para instalación','Installation readiness'],
 ['Resumen por armario / rack','Rack summary'],
 ['Elevaciones frontal y trasera','Front and rear elevations'],
 ['Plano visual de replanteo y conexiones','Installation layout and connection plan'],
 ['Esquema general de conexión de equipos','Overall equipment connection diagram'],
 ['Racks y ocupación','Racks and occupancy'],
 ['Matrices de puertos por equipo','Port matrices by device'],
 ['Leyenda de medios y cableado','Media and cabling legend'],
 ['Mapa de alimentación PDU / PSU','PDU / PSU power map'],
 ['Cadena completa de cableado estructurado','End-to-end structured cabling chain'],
 ['Checklist de instalación','Installation checklist'],
 ['Plan de intervención / As-Built → To-Be','Intervention plan / As-Built → To-Be'],
 ['Conectividad directa de datos','Direct data connectivity'],
 ['Inventario y materiales','Inventory and materials'],
 ['Conexiones físicas por rack','Physical connections by rack'],
 ['Validación e incidencias','Validation and issues'],
 ['Aceptación y cierre de instalación','Installation acceptance and closeout'],
 ['Hojas de etiquetas imprimibles','Printable label sheets'],
 ['Documento operativo para montaje, alimentación, cableado, etiquetado, certificación y aceptación.','Operational document for mounting, power, cabling, labeling, certification, and acceptance.'],
 ['Estado global','Overall status'],['Riesgo','Risk'],['bloqueantes','blockers'],['errores','errors'],['advertencias','warnings'],
 ['Dispositivos','Devices'],['Puertos','Ports'],['Enlaces','Links'],['Carga PoE','PoE load'],
 ['Ocupación','Occupancy'],['Elementos','Items'],['Potencia','Power'],['Refrigeración','Cooling'],
 ['Enlace','Link'],['Extremo A','Endpoint A'],['Extremo B','Endpoint B'],['Medio','Media'],['Capacidad','Capacity'],['Ruta física','Physical path'],
 ['Equipo','Device'],['Tipo','Type'],['Fabricante/plataforma','Vendor/platform'],['Modelo','Model'],['Consumo','Power draw'],
 ['Material pasivo','Passive material'],['Material','Material'],['Cantidad','Quantity'],
 ['Origen','Source'],['Destino','Destination'],['Detalle','Detail'],['Datos','Data'],['Energía','Power'],
 ['Ruta','Path'],['Toma','Outlet'],['Cable','Cable'],['Longitud','Length'],['Estado','Status'],
 ['Código','Code'],['Severidad','Severity'],['Categoría','Category'],['Bloqueante','Blocking'],['Descripción','Description'],
 ['Sí','Yes'],['No','No'],['Sin rack','No rack'],['Sin rack asignado','No rack assigned'],['Sin PDU documentada','No documented PDU'],
 ['Sin conexión declarada','No declared connection'],['No hay racks definidos.','No racks are defined.'],
 ['No hay enlaces documentados.','No documented links.'],['No hay equipos inventariados.','No inventoried devices.'],
 ['No hay material pasivo definido.','No passive material is defined.'],['No hay conexiones de datos o alimentación asociadas a racks.','No data or power connections are associated with racks.'],
 ['No hay cableado estructurado documentado.','No structured cabling is documented.'],['No se han detectado incidencias.','No issues were detected.'],
 ['Vista frontal','Front view'],['Vista trasera','Rear view'],['Ubicación no documentada','Undocumented location'],['Frontal / trasera','Front / rear'],
 ['Libre','Free'],['Campo','Field'],['Puerto remoto','Remote port'],['Ruta / uso','Path / use'],['Banco','Bank'],['Bloque','Block'],
 ['Cobre Cat5e / Cat6 / Cat6A','Copper Cat5e / Cat6 / Cat6A'],['Fibra multimodo (OM)','Multimode fiber (OM)'],['Fibra monomodo (OS)','Single-mode fiber (OS)'],['Fibra sin especificar','Unspecified fiber'],['Consola / serie','Console / serial'],['Otro / no documentado','Other / undocumented'],
 ['Alimentación feed A','Power feed A'],['Alimentación feed B','Power feed B'],['tomas','outlets'],['Conectada','Connected'],['PDU inválida','Invalid PDU'],['Pendiente','Pending'],
 ['Completa','Complete'],['Incompleta:','Incomplete:'],['revisar datos','review data'],['m totales','m total'],['Longitud total no documentada','Total length not documented'],
 ['Enlace permanente','Permanent link'],['Equipo final','Endpoint'],['Tramo','Segment'],['Longitud / detalle','Length / detail'],['Latiguillo rack','Rack patch cord'],['Cable permanente','Permanent cable'],['Latiguillo final','Endpoint patch cord'],
 ['No hay tareas de instalación derivadas del proyecto.','No installation tasks are derived from the project.'],['Tareas sin rack asignado','Tasks without assigned rack'],['Hecho','Done'],['Área','Area'],['Tarea','Task'],['Referencia','Reference'],['Documentación','Documentation'],['Lista','Ready'],
 ['Plano de replanteo','Installation layout'],['Referencias de instalación','Installation references'],['Enlaces directos principales','Primary direct links'],['Cableado estructurado','Structured cabling'],['Alimentación','Power'],
 ['No hay conexiones documentadas para este rack.','No connections are documented for this rack.'],['El diagrama resume los enlaces más relevantes:','The diagram summarizes the most relevant links:'],
 ['Tipo','Type'],['Medio / feed','Media / feed'],['Etiqueta / ruta','Label / path'],['Sin referencias de conexión.','No connection references.'],
 ['Técnico instalador','Installation technician'],['Fecha / hora','Date / time'],['Resultado','Result'],['Conforme','Accepted'],['Firma','Signature'],['Observaciones:','Notes:'],
 ['No hay racks para hoja de aceptación.','No racks are available for the acceptance sheet.'],
 ['Preparación','Preparation'],['Infraestructura física','Physical infrastructure'],['Conexiones','Connections'],['Operación','Operations'],['Inventario','Inventory'],['Etiquetado','Labeling'],['General','General'],
 ['Portada','Cover'],['Configurar informe de instalación','Configure installation report'],
 ['Selecciona las secciones que quieres incluir. Las tarjetas resaltadas se incluirán. Las etiquetas forman parte del informe técnico y también pueden abrirse por separado.','Select the sections to include. Highlighted cards will be included. Labels are part of the technical report and can also be opened separately.'],
 ['sección(es) seleccionadas','section(s) selected'],['Etiquetas:','Labels:'],['incluidas','included'],['no incluidas','not included'],
 ['Todo','All'],['Informe técnico','Technical report'],['Solo conexiones','Connections only'],['Solo etiquetas','Labels only'],
 ['Formato de etiquetas','Label format'],['Elige según el papel adhesivo. Después puedes ajustar la escala al 100 % en el diálogo de impresión.','Choose the adhesive paper format. You can then set print scaling to 100% in the print dialog.'],
 ['Cancelar','Cancel'],['Abrir solo etiquetas','Open labels only'],['Generar informe','Generate report'],['Selecciona al menos una sección.','Select at least one section.'],
 ['Informe de instalación','Installation report'],['Esquema','Schema'],['equipo(s)','device(s)'],['puerto(s)','port(s)'],['rack(s)','rack(s)'],
 ['BLOQUEADO','BLOCKED'],['APTO CON ADVERTENCIAS','READY WITH WARNINGS'],['APTO','READY'],['Crítico','Critical'],['Alto','High'],['Medio','Medium'],['Bajo','Low']
];
function localizeHtml(html,locale){if(locale!=='en')return html;let out=String(html);for(const pair of EN_REPLACEMENTS.slice().sort((a,b)=>b[0].length-a[0].length))out=out.split(pair[0]).join(pair[1]);return out;}
const SEC=root.NetWizardSecurityUtils||{};const CORE=root.NetWizardCoreUtils||{};
const fallback=v=>clean(v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const esc=v=>{try{return typeof SEC.escapeHtml==='function'?SEC.escapeHtml(clean(v)):typeof CORE.escapeHtml==='function'?CORE.escapeHtml(clean(v)):fallback(v);}catch{return fallback(v);}};
const byId=(list,id)=>arr(list).find(x=>x&&x.id===id)||null;
const table=(h,r,e)=>r.length?`<div class="table-wrap"><table><thead><tr>${h.map(x=>`<th>${esc(x)}</th>`).join('')}</tr></thead><tbody>${r.map(row=>`<tr>${row.map(x=>`<td>${esc(x)}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`:`<p class="empty">${esc(e)}</p>`;
const section=(n,t,b)=>`<section><h2>${n}. ${esc(t)}</h2>${b}</section>`;
function gate(project,options){if(options&&options.gateReport)return options.gateReport;const locale=localeOf(options);try{return root.NetWizardProductionGate&&root.NetWizardProductionGate.runProductionGate?root.NetWizardProductionGate.runProductionGate(project,{productionMode:true,strict:false,locale}):{issues:[],counts:{}};}catch{return{issues:[],counts:{}};}}
function status(g,locale){const i=arr(g&&g.issues),c=g&&g.counts||{};const blocking=Number(c.blocking!=null?c.blocking:i.filter(x=>x&&x.blocking).length),errors=Number(c.errors!=null?c.errors:i.filter(x=>x&&x.severity==='error').length),warnings=Number(c.warnings!=null?c.warnings:i.filter(x=>x&&x.severity==='warning').length);return blocking?{state:pick(locale,'BLOQUEADO','BLOCKED'),risk:blocking>=3?pick(locale,'Crítico','Critical'):pick(locale,'Alto','High'),blocking,errors,warnings}:errors?{state:pick(locale,'APTO CON ADVERTENCIAS','READY WITH WARNINGS'),risk:pick(locale,'Alto','High'),blocking,errors,warnings}:warnings?{state:pick(locale,'APTO CON ADVERTENCIAS','READY WITH WARNINGS'),risk:pick(locale,'Medio','Medium'),blocking,errors,warnings}:{state:pick(locale,'APTO','READY'),risk:pick(locale,'Bajo','Low'),blocking,errors,warnings};}
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
 return racks.map((rack,rackIndex)=>{
   const rackRef=`R${String(rackIndex+1).padStart(2,'0')}`;
   const topology=arr(model.rackTopologies).find(t=>t&&t.rack&&t.rack.id===rack.id)||{dataEdges:[],powerEdges:[]};
   const data=primaryDataEdges(topology.dataEdges).map((e,i)=>Object.assign({ref:planRef(rackRef+'-DATA',i)},e));
   const chains=arr(model.structuredChains).filter(x=>x.rackId===rack.id).slice().sort((a,b)=>clean(a.label||a.id).localeCompare(clean(b.label||b.id),undefined,{numeric:true,sensitivity:'base'})).map((x,i)=>Object.assign({ref:planRef(rackRef+'-CAB',i)},x));
   const power=arr(topology.powerEdges).slice().sort((a,b)=>clean(a.fromLabel).localeCompare(clean(b.fromLabel),undefined,{numeric:true,sensitivity:'base'})).map((e,i)=>Object.assign({ref:planRef(rackRef+'-PWR',i)},e));
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
function interventionReport(project){
 const pkg=root.NetWizardFieldInterventionPackage&&typeof root.NetWizardFieldInterventionPackage.build==='function'?root.NetWizardFieldInterventionPackage.build(project):null;
 if(!pkg||!pkg.ok)return'<p class="empty">Este proyecto no contiene un plan de intervención derivado de As-Built.</p>';
 const checklist=table(['Hecho','#','Área','Acción','Detalle'],arr(pkg.checklist).map(a=>['☐',a.order,a.category||'—',a.title||a.type,a.details||'—']),'No hay acciones físicas pendientes.');
 const compare=table(['#','Área','Cambio','Detalle'],arr(pkg.beforeAfter).map(r=>[r.order,r.category||'—',r.title||r.type,r.details||'—']),'No hay diferencias físicas.');
 const bomBlock=(title,items,sign)=>`<h3>${esc(title)}</h3>${table(['Δ','Tipo','Cantidad','Material'],arr(items).map(x=>[sign,x.kind||'Material',x.quantity||1,x.description||'—']),'Sin elementos.')}`;
 return`<div class="readiness-grid">
   <div class="readiness-card"><span>Acciones</span><b>${esc(pkg.counts.actions)}</b><small>intervenciones físicas</small></div>
   <div class="readiness-card"><span>Añadir</span><b>${esc(pkg.counts.addMaterials)}</b><small>líneas de material</small></div>
   <div class="readiness-card"><span>Retirar</span><b>${esc(pkg.counts.removeMaterials)}</b><small>líneas de material</small></div>
   <div class="readiness-card"><span>Reutilizar</span><b>${esc(pkg.counts.reuseMaterials)}</b><small>líneas de material</small></div>
   <div class="readiness-card"><span>Revisar</span><b>${esc(pkg.counts.reviewMaterials)}</b><small>decisiones manuales</small></div>
  </div>
  <h3>Checklist de trabajo</h3>${checklist}
  <h3>Comparativa As-Built → To-Be</h3>${compare}
  ${bomBlock('BOM diferencial · material a añadir',pkg.bom.additions,'+')}
  ${bomBlock('BOM diferencial · material a retirar',pkg.bom.removals,'−')}
  ${bomBlock('Material reutilizado',pkg.bom.reuse,'=')}
  ${bomBlock('Revisión manual',pkg.bom.review,'?')}
  <div class="co co-ac"><b>Cierre:</b> actualizar el As-Built después de ejecutar y verificar la intervención real.</div>`;
}
function acceptanceReport(project,model){
 const racks=arr(model.rackSummaries);
 if(!racks.length)return'<p class="empty">No hay racks para hoja de aceptación.</p>';
 return racks.map(r=>`<article class="acceptance-card"><h3>${esc(r.rackName)}</h3><div class="acceptance-grid"><div><span>Técnico instalador</span><b>________________________________</b></div><div><span>Fecha / hora</span><b>________________________________</b></div><div><span>Resultado</span><b>☐ Conforme &nbsp;&nbsp; ☐ Pendiente</b></div><div><span>Firma</span><b>________________________________</b></div></div><p><b>Observaciones:</b></p><div class="notes-lines">________________________________________________________________________________<br>________________________________________________________________________________<br>________________________________________________________________________________</div></article>`).join('');
}

const SECTION_DEFS=[
 {id:'cover',title:'Portada',group:'General',default:true},
 {id:'readiness',title:'Estado de preparación para instalación',group:'Preparación',default:true},
 {id:'rack-summary',title:'Resumen por armario / rack',group:'Infraestructura física',default:true},
 {id:'rack-elevations',title:'Elevaciones frontal y trasera',group:'Infraestructura física',default:true},
 {id:'rack-plan',title:'Plano visual de replanteo y conexiones',group:'Conexiones',default:true},
 {id:'connection-diagram',title:'Esquema general de conexión de equipos',group:'Conexiones',default:true},
 {id:'rack-occupancy',title:'Racks y ocupación',group:'Infraestructura física',default:true},
 {id:'port-matrices',title:'Matrices de puertos por equipo',group:'Conexiones',default:true},
 {id:'media-legend',title:'Leyenda de medios y cableado',group:'Conexiones',default:true},
 {id:'power-map',title:'Mapa de alimentación PDU / PSU',group:'Conexiones',default:true},
 {id:'structured-cabling',title:'Cadena completa de cableado estructurado',group:'Conexiones',default:true},
 {id:'checklist',title:'Checklist de instalación',group:'Operación',default:true},
 {id:'intervention',title:'Plan de intervención / As-Built → To-Be',group:'Operación',default:false},
 {id:'direct-connectivity',title:'Conectividad directa de datos',group:'Conexiones',default:true},
 {id:'inventory',title:'Inventario y materiales',group:'Inventario',default:true},
 {id:'rack-connections',title:'Conexiones físicas por rack',group:'Conexiones',default:true},
 {id:'findings',title:'Validación e incidencias',group:'Operación',default:true},
 {id:'acceptance',title:'Aceptación y cierre de instalación',group:'Operación',default:true},
 {id:'labels',title:'Hojas de etiquetas imprimibles',group:'Etiquetado',default:true}
];
const LABEL_PRESETS={
 'a4-3x8':{id:'a4-3x8',label:'A4 · 3 × 8 etiquetas',columns:3,rows:8,heightMm:31,gapMm:3},
 'a4-2x7':{id:'a4-2x7',label:'A4 · 2 × 7 etiquetas grandes',columns:2,rows:7,heightMm:36,gapMm:4},
 'cable-3x12':{id:'cable-3x12',label:'A4 · 3 × 12 etiquetas de cable',columns:3,rows:12,heightMm:19,gapMm:2}
};
function selectedSections(options){
 const explicit=arr(options&&options.sections).filter(Boolean);
 if(options&&options.labelsOnly)return new Set(['labels']);
 if(explicit.length)return new Set(explicit);
 const out=new Set(SECTION_DEFS.filter(x=>x.default).map(x=>x.id));
 if(options&&options.includeLabels)out.add('labels');
 return out;
}
function graphComponents(graph){
 const nodes=arr(graph&&graph.nodes),edges=arr(graph&&graph.edges),adj=new Map(nodes.map(n=>[n.id,new Set()]));
 for(const e of edges){if(adj.has(e.fromId)&&adj.has(e.toId)){adj.get(e.fromId).add(e.toId);adj.get(e.toId).add(e.fromId);}}
 const seen=new Set(),components=[];
 for(const node of nodes){
   if(seen.has(node.id))continue;
   const ids=[],queue=[node.id];seen.add(node.id);
   while(queue.length){const id=queue.shift();ids.push(id);for(const n of adj.get(id)||[])if(!seen.has(n)){seen.add(n);queue.push(n);}}
   const idSet=new Set(ids);
   components.push({nodes:nodes.filter(n=>idSet.has(n.id)),edges:edges.filter(e=>idSet.has(e.fromId)&&idSet.has(e.toId)),adj});
 }
 return components;
}
function componentLayout(component){
 const nodes=component.nodes,edges=component.edges;
 if(!nodes.length)return{width:900,height:220,positions:new Map()};
 const degree=id=>edges.reduce((n,e)=>n+(e.fromId===id||e.toId===id?1:0),0);
 const root=nodes.slice().sort((a,b)=>degree(b.id)-degree(a.id)||clean(a.label).localeCompare(clean(b.label)))[0];
 const levels=new Map([[root.id,0]]),queue=[root.id],adj=new Map(nodes.map(n=>[n.id,[]]));
 for(const e of edges){if(adj.has(e.fromId)&&adj.has(e.toId)){adj.get(e.fromId).push(e.toId);adj.get(e.toId).push(e.fromId);}}
 while(queue.length){const id=queue.shift(),level=levels.get(id);for(const next of adj.get(id)||[])if(!levels.has(next)){levels.set(next,level+1);queue.push(next);}}
 let fallback=Math.max(0,...levels.values());
 for(const n of nodes)if(!levels.has(n.id))levels.set(n.id,++fallback);
 const groups=new Map();for(const n of nodes){const l=levels.get(n.id);if(!groups.has(l))groups.set(l,[]);groups.get(l).push(n);}
 const maxRows=Math.max(1,...[...groups.values()].map(x=>x.length)),cols=Math.max(1,...groups.keys())+1;
 const width=Math.max(860,cols*230+100),height=Math.max(260,maxRows*105+100),positions=new Map();
 for(const [level,list] of [...groups.entries()].sort((a,b)=>a[0]-b[0])){
   list.sort((a,b)=>clean(a.label).localeCompare(clean(b.label),undefined,{numeric:true,sensitivity:'base'}));
   const step=height/(list.length+1);
   list.forEach((node,index)=>positions.set(node.id,{x:65+level*230,y:step*(index+1)-28,w:165,h:56}));
 }
 return{width,height,positions};
}
function equipmentConnectionDiagram(model){
 const graph=model.connectionOverview||{nodes:[],edges:[]};
 if(!arr(graph.nodes).length)return'<p class="empty">No hay equipos suficientes para construir el esquema de conexión.</p>';
 const components=graphComponents(graph);
 const cards=components.map((component,index)=>{
   const layout=componentLayout(component),pos=layout.positions;
   const edgeSvg=component.edges.map(edge=>{
     const a=pos.get(edge.fromId),b=pos.get(edge.toId);if(!a||!b)return'';
     const x1=a.x+a.w,y1=a.y+a.h/2,x2=b.x,y2=b.y+b.h/2,mx=(x1+x2)/2,my=(y1+y2)/2;
     const cls=edge.kind==='structured'?'connection-edge-structured':edge.kind==='host'?'connection-edge-host':'connection-edge-direct';
     const label=[edge.fromPort,edge.toPort,edge.media].filter(Boolean).join(' · ');
     const lw=Math.min(240,Math.max(60,label.length*5.4));
     return`<g class="connection-edge ${cls}"><line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}"/><rect x="${mx-lw/2}" y="${my-10}" width="${lw}" height="20" rx="5"/><text x="${mx}" y="${my+3}" text-anchor="middle">${esc(label||edge.label)}</text></g>`;
   }).join('');
   const nodeSvg=component.nodes.map(node=>{
     const p=pos.get(node.id),cls=node.kind==='host'?'connection-node-host':'connection-node-device';
     return`<g class="connection-node ${cls}"><rect x="${p.x}" y="${p.y}" width="${p.w}" height="${p.h}" rx="9"/><text class="connection-node-title" x="${p.x+10}" y="${p.y+21}">${esc(node.label)}</text><text class="connection-node-detail" x="${p.x+10}" y="${p.y+40}">${esc((node.detail||'').slice(0,36))}</text></g>`;
   }).join('');
   return`<article class="connection-diagram-card"><div class="connection-diagram-title"><h3>Grupo ${index+1}</h3><span>${component.nodes.length} elementos · ${component.edges.length} conexiones</span></div><div class="connection-svg-wrap"><svg viewBox="0 0 ${layout.width} ${layout.height}" role="img" aria-label="Esquema de conexión de equipos"><defs><marker id="nw-arrow-${index}" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse"><path d="M 0 0 L 10 5 L 0 10 z"/></marker></defs>${edgeSvg}${nodeSvg}</svg></div></article>`;
 }).join('');
 const rows=arr(graph.edges).map(e=>[e.kind==='structured'?'Cableado estructurado':e.kind==='host'?'Host':'Enlace directo',e.label,e.fromPort||'—',e.toPort||'—',e.media||'—',e.route||e.detail||'—']);
 return cards+table(['Tipo','Referencia','Origen / puerto','Destino / puerto','Medio','Ruta / detalle'],rows,'No hay conexiones documentadas.');
}
function normalizedLabelPreset(options){
 const id=clean(options&&options.labelPreset)||'a4-3x8';
 return LABEL_PRESETS[id]||LABEL_PRESETS['a4-3x8'];
}
function installationLabelSheets(model,options){
 const preset=normalizedLabelPreset(options),all=arr(model.installationLabels&&model.installationLabels.items);
 const kinds=arr(options&&options.labelKinds).filter(Boolean),items=kinds.length?all.filter(x=>kinds.includes(x.kind)):all;
 if(!items.length)return'<p class="empty">No hay elementos etiquetables en el proyecto.</p>';
 const perPage=preset.columns*preset.rows,pages=[];for(let i=0;i<items.length;i+=perPage)pages.push(items.slice(i,i+perPage));
 const labelName={rack:'RACK',device:'EQUIPO','patch-panel':'PATCH PANEL',outlet:'TOMA',pdu:'PDU','rack-item':'ELEMENTO','cable-data':'CABLE DATOS','cable-structured':'CABLE ESTRUCTURADO','cable-power':'ALIMENTACIÓN'};
 return`<div class="label-intro"><b>${esc(items.length)} etiquetas</b><span>Plantilla ${esc(preset.label)}. Los cables generan una etiqueta para cada extremo.</span></div>`+pages.map((page,index)=>`<article class="label-sheet-page" style="--label-cols:${preset.columns};--label-rows:${preset.rows};--label-height:${preset.heightMm}mm;--label-gap:${preset.gapMm}mm"><div class="label-sheet-head"><b>Etiquetas de instalación · hoja ${index+1}/${pages.length}</b><span>${esc(preset.label)}</span></div><div class="label-grid">${page.map(label=>`<div class="install-label label-${esc(label.kind)}"><span class="label-kind">${esc(labelName[label.kind]||label.kind)}</span><strong>${esc(label.code)}</strong><b>${esc(label.title)}</b><small>${esc(label.detail||'')}</small>${label.side?`<em>Extremo ${esc(label.side)}</em>`:''}</div>`).join('')}</div></article>`).join('');
}
function saveReportPreferences(rootRef,sections,preset){
 try{rootRef.localStorage&&rootRef.localStorage.setItem('netwizard_install_report_options_v1',JSON.stringify({selectionVersion:2,sections:[...sections],labelPreset:preset}));}catch{}
}
function loadReportPreferences(rootRef){
 try{const raw=rootRef.localStorage&&rootRef.localStorage.getItem('netwizard_install_report_options_v1');if(raw){const parsed=JSON.parse(raw);if(parsed&&Array.isArray(parsed.sections))return parsed;}}catch{}
 return null;
}
function build(project,options){
 project=project||{};options=options||{};const locale=localeOf(options);
 const g=gate(project,{...options,locale}),model=MODEL?MODEL.build(project,{gateReport:g,locale}):null;
 if(!model)throw new Error('NetWizardReportModel no está disponible.');
 const s=status(g,locale),findings=arr(g.issues);
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
 const sectionSet=selectedSections(options);
 const interventionPackage=root.NetWizardFieldInterventionPackage&&typeof root.NetWizardFieldInterventionPackage.build==='function'?root.NetWizardFieldInterventionPackage.build(project):null;
 const explicitSections=arr(options&&options.sections).filter(Boolean);
 if(!explicitSections.length&&interventionPackage&&interventionPackage.ok)sectionSet.add('intervention');
 if((!interventionPackage||!interventionPackage.ok)&&!explicitSections.includes('intervention'))sectionSet.delete('intervention');
 const coverHtml=`<section class="cover"><div class="cover-kicker">NETWIZARD 3.50.0</div><h1>Manual técnico de instalación</h1><h2>${esc(model.project.name)}</h2><div class="cover-status"><b>${esc(s.state)}</b><span>Riesgo ${esc(s.risk)}</span></div><div class="cover-meta"><span>Esquema ${esc(model.project.schemaVersion||'—')}</span><span>${esc(model.summary.racks)} rack(s)</span><span>${esc(model.summary.devices)} equipo(s)</span><span>${esc(model.summary.ports)} puerto(s)</span></div><p>Documento operativo para montaje, alimentación, cableado, etiquetado, certificación y aceptación.</p></section>`;
 const builders={
  readiness:()=>readiness+workSequenceReport(),
  'rack-summary':()=>rackSummaryReport(project,model),
  'rack-elevations':()=>rackVisualReport(project,model),
  'rack-plan':()=>rackInstallationPlan(project,model),
  'connection-diagram':()=>equipmentConnectionDiagram(model),
  'rack-occupancy':()=>rackSummary+rackDetails(project,model),
  'port-matrices':()=>portMatrices(model,project),
  'media-legend':()=>mediaLegend(),
  'power-map':()=>powerMap(project,model),
  'structured-cabling':()=>structuredChainsReport(model),
  checklist:()=>installationChecklistReport(project,model),
  intervention:()=>interventionReport(project),
  'direct-connectivity':()=>connectivity,
  inventory:()=>inventory+'<h3>Material pasivo</h3>'+materials,
  'rack-connections':()=>rackConnections,
  findings:()=>table(['Código','Severidad','Categoría','Bloqueante','Descripción'],issueRows,'No se han detectado incidencias.'),
  acceptance:()=>acceptanceReport(project,model),
  labels:()=>installationLabelSheets(model,options)
 };
 const blocks=[];
 if(sectionSet.has('cover'))blocks.push(coverHtml);
 let sectionNo=1;
 for(const def of SECTION_DEFS){
   if(def.id==='cover'||!sectionSet.has(def.id)||!builders[def.id])continue;
   blocks.push(section(sectionNo++,def.title,builders[def.id]()));
 }
 const body=blocks.join('');
 const css=':root{font-family:Inter,Segoe UI,Arial,sans-serif;color:#172033;-webkit-print-color-adjust:exact;print-color-adjust:exact}body{margin:0;background:#eef2f7}.toolbar{position:sticky;top:0;background:#111827;padding:10px;text-align:right;z-index:5}.toolbar button{padding:9px 14px;border:0;border-radius:8px;font-weight:700}.page{max-width:1180px;margin:20px auto;background:#fff;padding:36px;box-shadow:0 10px 35px #0002}header{display:flex;justify-content:space-between;gap:20px;border-bottom:4px solid #2563eb;padding-bottom:20px}header span{font-size:12px;color:#2563eb;font-weight:800}header h1{margin:6px 0}.stats{display:grid;grid-template-columns:repeat(6,1fr);gap:8px;margin:18px 0}.stats div{padding:12px;border:1px solid #dbe3ee;border-radius:8px;background:#f8fafc}.stats b{display:block;font-size:20px}.stats span{font-size:11px;color:#64748b}.risk{padding:14px;background:#eff6ff;border-left:4px solid #2563eb;display:flex;justify-content:space-between}section{margin:30px 0}h2{font-size:21px;border-bottom:1px solid #dbe3ee;padding-bottom:7px}h3{font-size:15px}.table-wrap,.port-matrix-wrap{overflow:auto}table{width:100%;border-collapse:collapse;font-size:12px}th,td{border:1px solid #dbe3ee;padding:7px;text-align:left;vertical-align:top}th{background:#eff6ff}.empty{padding:12px;background:#f8fafc;border-left:4px solid #94a3b8}.rack-card,.matrix-card,.power-card{border:1px solid #dbe3ee;border-radius:10px;padding:14px;margin:14px 0;break-inside:avoid}.rack-title,.matrix-title{display:flex;align-items:flex-start;justify-content:space-between;gap:12px}.rack-title h3,.matrix-title h3,.power-card h3{margin:0 0 4px}.rack-title span,.matrix-title span{font-size:11px;color:#64748b}.rack-meta{display:flex;gap:8px;flex-wrap:wrap;margin:10px 0}.rack-meta span{padding:6px 9px;background:#f8fafc;border:1px solid #dbe3ee;border-radius:999px;font-size:11px}.rack-pdu{font-size:11px;color:#475569}.rack-warnings{margin-top:9px;padding:9px;background:#fff7ed;border-left:4px solid #f97316}.rack-warnings ul{margin:5px 0 0 18px}.port-matrix{width:max-content;min-width:100%;table-layout:auto}.port-matrix th,.port-matrix td{min-width:105px;max-width:170px}.port-matrix .matrix-label{position:sticky;left:0;z-index:2;min-width:105px;background:#eff6ff;font-weight:800}.matrix-block{margin:10px 0 18px}.matrix-range{font-size:11px;color:#64748b;margin:0 0 5px}.media-cell{border-top-width:3px}.mini-swatch,.legend-swatch{display:inline-block;width:12px;height:12px;border-radius:3px;margin-right:5px;vertical-align:-2px}.legend{display:grid;grid-template-columns:repeat(3,minmax(180px,1fr));gap:8px}.legend-item{display:flex;align-items:center;padding:9px;border:1px solid #dbe3ee;border-radius:8px;background:#fff}.media-copper{background:#dbeafe!important;border-color:#2563eb!important}.media-fiber-mm{background:#ffedd5!important;border-color:#f97316!important}.media-fiber-sm{background:#fef9c3!important;border-color:#ca8a04!important}.media-fiber{background:#cffafe!important;border-color:#0891b2!important}.media-dac-aoc{background:#ede9fe!important;border-color:#7c3aed!important}.media-console{background:#e5e7eb!important;border-color:#6b7280!important}.media-other{background:#f1f5f9!important;border-color:#64748b!important}.media-free{background:#f8fafc!important;border-color:#cbd5e1!important;color:#64748b}.pdu-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(190px,1fr));gap:8px;margin:10px 0}.pdu-card{border:1px solid #dbe3ee;border-radius:8px;padding:10px;display:grid;gap:5px}.pdu-card small{color:#64748b}.feed-badge{display:inline-block;border-radius:999px;padding:3px 7px;font-size:10px;font-weight:800;width:max-content}.feed-a{background:#fee2e2!important;border-color:#dc2626!important;color:#991b1b}.feed-b{background:#dcfce7!important;border-color:#16a34a!important;color:#166534}.feed-ups{background:#fef3c7!important;border-color:#d97706!important;color:#92400e}.feed-other{background:#e2e8f0!important;border-color:#64748b!important;color:#334155}.power-missing td{background:#fff7ed}.chain-card,.check-card{border:1px solid #dbe3ee;border-radius:10px;padding:14px;margin:14px 0;break-inside:avoid}.chain-title{display:flex;justify-content:space-between;gap:12px;align-items:flex-start}.chain-title h3,.check-card h3{margin:0 0 5px}.chain-title span{font-size:11px;color:#64748b}.chain-flow{display:grid;grid-template-columns:1fr auto 1fr auto 1fr auto 1fr auto 1fr;gap:6px;align-items:stretch;margin:12px 0}.chain-flow>div{border:1px solid #dbe3ee;border-radius:8px;padding:9px;background:#f8fafc;display:grid;gap:3px}.chain-flow small{color:#64748b}.chain-flow i{align-self:center;font-style:normal;font-size:18px;color:#64748b}.chain-pending{border-left:4px solid #f97316}.chain-ok{border-left:4px solid #16a34a}.checkbox{font-size:18px;text-align:center;width:42px}.check-pending td{background:#fff7ed}.check-table th:first-child,.check-table td:first-child{text-align:center}@media print{body{background:#fff}.toolbar{display:none}.page{margin:0;max-width:none;box-shadow:none;padding:0}.rack-card,.matrix-card,.power-card{break-inside:avoid}}@media(max-width:800px){.stats{grid-template-columns:repeat(2,1fr)}.legend{grid-template-columns:1fr}.chain-flow{display:flex;flex-direction:column}.chain-flow i{transform:rotate(90deg);align-self:center}.page{margin:0;padding:18px}}.cover{min-height:680px;display:flex;flex-direction:column;justify-content:center;align-items:flex-start;border:0;margin:0;break-after:page}.cover-kicker{font-size:13px;font-weight:900;color:#2563eb;letter-spacing:.12em}.cover h1{font-size:42px;margin:12px 0 4px}.cover h2{font-size:26px;margin:0 0 28px;color:#475569;border:0}.cover-status{display:flex;gap:12px;align-items:center;padding:14px 18px;border-left:5px solid #2563eb;background:#eff6ff}.cover-status b{font-size:18px}.cover-meta{display:flex;flex-wrap:wrap;gap:8px;margin:20px 0}.cover-meta span{border:1px solid #dbe3ee;border-radius:999px;padding:6px 10px;background:#f8fafc;font-size:12px}.rack-visual-card,.acceptance-card{border:1px solid #dbe3ee;border-radius:10px;padding:14px;margin:14px 0;break-inside:avoid}.rack-visual-title{display:flex;align-items:flex-start;justify-content:space-between;gap:12px}.rack-visual-title h3,.acceptance-card h3{margin:0 0 4px}.rack-visual-title span{font-size:11px;color:#64748b}.rack-elevations{display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-top:12px}.rack-face-card{border:2px solid #334155;border-radius:8px;overflow:hidden;background:#f8fafc}.rack-face-head{display:flex;justify-content:space-between;background:#0f172a;color:#fff;padding:7px 9px;font-size:12px}.rack-face-body{display:flex;align-items:stretch}.rack-unit-stack{flex:1}.rack-face-row{display:grid;grid-template-columns:42px 1fr;min-height:18px;border-bottom:1px solid #cbd5e1}.rack-unit{padding:2px 5px;background:#e2e8f0;border-right:1px solid #cbd5e1;font-size:9px;font-weight:800;text-align:right}.rack-slot{padding:2px 6px;display:flex;justify-content:space-between;gap:6px;align-items:center;font-size:9px}.rack-slot strong{white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.rack-slot small{color:#475569;white-space:nowrap}.rack-slot-empty{background:#f8fafc;color:#94a3b8}.rack-item-device{background:#dbeafe}.rack-item-patch{background:#dcfce7}.rack-item-cable{background:#fef3c7}.rack-item-shelf{background:#ede9fe}.rack-item-passive{background:#e2e8f0}.rack-continuation{font-weight:900;color:#64748b}.rear-pdu-rail{width:92px;border-left:2px solid #334155;padding:4px;display:flex;flex-direction:column;gap:5px;background:#fff}.rear-pdu{border:1px solid currentColor;border-radius:6px;padding:5px;display:grid;gap:2px;font-size:9px}.rear-pdu small{font-size:8px}.readiness-grid{display:grid;grid-template-columns:repeat(5,1fr);gap:8px;margin:14px 0}.readiness-card{border:1px solid #dbe3ee;border-radius:8px;padding:10px;display:grid;gap:4px}.readiness-card span{font-size:10px;color:#64748b;text-transform:uppercase;font-weight:800}.readiness-card b{font-size:18px}.readiness-card small{font-size:10px;color:#475569}.readiness-pending{border-left:4px solid #f97316;background:#fff7ed}.readiness-ok{border-left:4px solid #16a34a;background:#f0fdf4}.work-sequence{display:grid;gap:7px;margin:14px 0}.work-step{display:grid;grid-template-columns:34px 1fr;gap:9px;align-items:start;border:1px solid #dbe3ee;border-radius:8px;padding:9px}.work-step>b{display:grid;place-items:center;width:28px;height:28px;border-radius:50%;background:#0f172a;color:#fff}.work-step div{display:grid;gap:2px}.work-step span{font-size:11px;color:#475569}.acceptance-grid{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin:12px 0}.acceptance-grid div{display:grid;gap:8px}.acceptance-grid span{font-size:10px;text-transform:uppercase;color:#64748b;font-weight:800}.notes-lines{line-height:2;color:#64748b}@page{size:A4 landscape;margin:10mm}@media print{body{background:#fff;font-size:9pt}.toolbar{display:none}.page{margin:0;max-width:none;box-shadow:none;padding:0}.cover{min-height:180mm}.table-wrap,.port-matrix-wrap{overflow:visible}thead{display:table-header-group}tr,.rack-card,.matrix-card,.power-card,.rack-visual-card,.chain-card,.check-card,.acceptance-card,.matrix-block{break-inside:avoid-page}.rack-elevations{gap:8mm}.rack-face-row{min-height:3.8mm}.rack-slot{font-size:7.5pt}.rack-unit{font-size:7pt}section:not(.cover){break-before:page}h2{break-after:avoid-page}.readiness-grid{grid-template-columns:repeat(5,1fr)}.chain-flow{font-size:8pt}.port-matrix th,.port-matrix td{min-width:22mm;max-width:34mm;padding:1.5mm;font-size:7pt}}@media(max-width:800px){.readiness-grid,.rack-elevations,.acceptance-grid{grid-template-columns:1fr}.rear-pdu-rail{width:76px}}.connection-diagram-card{border:1px solid #dbe3ee;border-radius:10px;padding:12px;margin:14px 0;break-inside:avoid-page}.connection-diagram-title{display:flex;justify-content:space-between;gap:12px}.connection-diagram-title h3{margin:0}.connection-diagram-title span{font-size:11px;color:#64748b}.connection-svg-wrap{overflow:auto;margin-top:8px}.connection-svg-wrap svg{width:100%;min-width:720px;height:auto;background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px}.connection-edge line{stroke:#2563eb;stroke-width:3}.connection-edge rect{fill:#fff;stroke:#cbd5e1}.connection-edge text{font-size:10px;fill:#334155;font-family:Inter,Arial,sans-serif}.connection-edge-structured line{stroke:#16a34a;stroke-dasharray:8 4}.connection-edge-host line{stroke:#7c3aed;stroke-dasharray:4 4}.connection-node rect{fill:#fff;stroke:#334155;stroke-width:2}.connection-node-device rect{fill:#eff6ff;stroke:#2563eb}.connection-node-host rect{fill:#f5f3ff;stroke:#7c3aed}.connection-node-title{font-size:13px;font-weight:800;fill:#0f172a}.connection-node-detail{font-size:9px;fill:#475569}.label-intro{display:flex;justify-content:space-between;gap:12px;padding:10px 12px;background:#f8fafc;border:1px solid #dbe3ee;border-radius:8px}.label-intro span{font-size:11px;color:#475569}.label-sheet-page{page:labels;width:194mm;min-height:277mm;margin:8mm auto;padding:0;background:#fff;break-before:page;box-sizing:border-box}.label-sheet-head{display:flex;justify-content:space-between;font-size:8pt;margin:0 0 3mm;color:#475569}.label-grid{display:grid;grid-template-columns:repeat(var(--label-cols),1fr);grid-auto-rows:var(--label-height);gap:var(--label-gap)}.install-label{border:1px dashed #64748b;border-radius:2mm;padding:2.4mm;box-sizing:border-box;overflow:hidden;display:flex;flex-direction:column;justify-content:center;gap:.8mm;background:#fff;break-inside:avoid}.install-label .label-kind{font-size:6.5pt;font-weight:900;letter-spacing:.08em;color:#64748b}.install-label strong{font:900 13pt Fira Code,monospace;line-height:1.05}.install-label b{font-size:8pt}.install-label small{font-size:6.5pt;color:#334155;line-height:1.2}.install-label em{font-size:6.5pt;font-style:normal;font-weight:800;color:#2563eb}.label-rack strong{font-size:18pt}.label-device strong{font-size:14pt}.label-cable-data,.label-cable-structured{border-left:3mm solid #2563eb}.label-cable-structured{border-left-color:#16a34a}.label-cable-power{border-left:3mm solid #dc2626}@page labels{size:A4 portrait;margin:8mm}@media print{.connection-svg-wrap{overflow:visible}.connection-svg-wrap svg{min-width:0}.label-sheet-page{width:auto;min-height:0;margin:0;padding:0;break-before:page}.label-sheet-page section{break-before:auto}.label-grid{gap:var(--label-gap)}.install-label{border:0.35mm solid #94a3b8}}.matrix-print{display:none}.rack-plan-card{border:1px solid #dbe3ee;border-radius:10px;padding:14px;margin:14px 0}.rack-plan-title{display:flex;justify-content:space-between;align-items:flex-start;gap:12px}.rack-plan-title h3{margin:0 0 4px}.rack-plan-title span{font-size:11px;color:#64748b}.rack-plan-layout{display:grid;grid-template-columns:minmax(220px,.55fr) minmax(0,1.45fr);gap:14px;margin-top:12px}.plan-rack-box{border:2px solid #334155;border-radius:9px;overflow:hidden;background:#f8fafc}.plan-rack-head{display:flex;justify-content:space-between;background:#0f172a;color:#fff;padding:8px 10px;font-size:12px}.plan-rack-items{padding:7px;display:grid;gap:5px}.plan-rack-item{display:grid;grid-template-columns:64px 1fr;gap:3px 7px;border:1px solid #cbd5e1;border-radius:7px;padding:6px 7px;font-size:10px}.plan-rack-item b{grid-row:1/3;align-self:center}.plan-rack-item small{color:#475569}.plan-pdu{grid-template-columns:64px 1fr}.plan-link-groups{display:grid;gap:7px;align-content:start}.plan-link-groups h4{margin:5px 0 1px;font-size:11px;text-transform:uppercase;letter-spacing:.04em;color:#475569}.plan-path{position:relative;display:flex;align-items:stretch;gap:6px;flex-wrap:wrap;border:1px solid #dbe3ee;border-radius:9px;padding:8px 8px 8px 48px;background:#fff;break-inside:avoid}.plan-ref{position:absolute;left:7px;top:8px;display:inline-block;border-radius:5px;padding:3px 5px;background:#0f172a;color:#fff;font-size:8px;font-weight:900;letter-spacing:.03em}.plan-node{flex:1 1 115px;min-width:105px;border:1px solid #cbd5e1;border-radius:7px;padding:6px;background:#f8fafc;display:grid;gap:2px;font-size:10px}.plan-node small{color:#64748b;font-size:9px}.plan-edge{flex:1 1 145px;min-width:135px;display:grid;place-items:center;text-align:center;padding:4px;font-size:9px}.plan-edge small{color:#64748b}.plan-arrow{display:grid;place-items:center;min-width:14px;font-weight:900;color:#64748b}.plan-path-note{flex-basis:100%;font-size:9px;color:#475569;padding-top:2px}.plan-data{border-left:4px solid #2563eb}.plan-cabling{border-left:4px solid #16a34a}.plan-power{border-left:4px solid #dc2626}.plan-more{font-size:10px;color:#475569;background:#f8fafc;border-left:3px solid #64748b;padding:7px}.rack-plan-card h4{margin:14px 0 6px}.matrix-print-card{border:1px solid #dbe3ee;border-radius:8px;padding:10px;margin:0 0 10px}@media print{.matrix-screen{display:none!important}.matrix-print{display:block!important}.matrix-print-card{break-inside:avoid-page;margin:0 0 5mm;padding:3mm;border:1px solid #94a3b8}.matrix-print-card .port-matrix-wrap{overflow:visible}.matrix-print-card .port-matrix{width:100%;min-width:0;table-layout:fixed}.matrix-print-card .port-matrix th,.matrix-print-card .port-matrix td{min-width:0!important;max-width:none!important;width:auto;padding:1.3mm;font-size:6.7pt;overflow-wrap:anywhere;word-break:break-word}.matrix-print-card .port-matrix .matrix-label{position:static;left:auto;min-width:0!important;width:27mm!important}.matrix-print-card .matrix-title{break-after:avoid}.rack-plan-card{break-inside:auto}.rack-plan-layout{grid-template-columns:52mm 1fr;gap:4mm}.plan-rack-item{font-size:7.5pt;grid-template-columns:15mm 1fr;padding:1.2mm}.plan-path{padding:2mm 2mm 2mm 13mm;gap:1.5mm;break-inside:avoid-page}.plan-ref{font-size:6.5pt}.plan-node{min-width:24mm;font-size:7pt;padding:1.5mm}.plan-node small,.plan-edge,.plan-path-note{font-size:6.5pt}.plan-edge{min-width:28mm}.rack-plan-card .table-wrap{overflow:visible}.rack-plan-card table{font-size:7pt}.rack-plan-card th,.rack-plan-card td{padding:1.5mm;overflow-wrap:anywhere} }';
 const labelsOnly=!!options.labelsOnly;
 const raw=`<!doctype html><html lang="${locale}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(model.project.name)} · ${labelsOnly?'Etiquetas de instalación':'Manual técnico de instalación'}</title><style>${css}</style></head><body class="${labelsOnly?'labels-only':''}"><div class="toolbar"><button onclick="window.print()">🖨 Imprimir / Guardar PDF</button></div><main class="page">${body}</main></body></html>`;
 return localizeHtml(raw,locale);
}
function openReport(project,options){const opts=Object.assign({},options||{},{locale:localeOf(options)}),html=build(project,opts),win=root.open&&root.open('','_blank');if(!win)throw new Error(pick(opts.locale,'El navegador bloqueó la ventana del informe.','The browser blocked the report window.'));win.document.open();win.document.write(html);win.document.close();return win;}
function currentProject(){const s=root.NetWizardState;if(s&&typeof s.getSnapshot==='function')return s.getSnapshot();return{};}

function openConfigurator(project){
 const locale=localeOf();
 if(!root.document)return openReport(project,{locale});
 const existing=root.document.getElementById('nwInstallReportConfigurator');if(existing)existing.remove();
 const prefs=loadReportPreferences(root)||{};
 const savedSections=arr(prefs.sections);const migratedSections=savedSections.length&&!prefs.selectionVersion?[...new Set([...savedSections,'labels'])]:savedSections;const selected=new Set(migratedSections.length?migratedSections:SECTION_DEFS.filter(x=>x.default).map(x=>x.id));
 const fieldPkg=root.NetWizardFieldInterventionPackage&&typeof root.NetWizardFieldInterventionPackage.build==='function'?root.NetWizardFieldInterventionPackage.build(project):null;
 if(!savedSections.length&&fieldPkg&&fieldPkg.ok)selected.add('intervention');
 const overlay=root.document.createElement('div');overlay.id='nwInstallReportConfigurator';overlay.style.cssText='position:fixed;inset:0;z-index:12000;background:rgba(2,6,23,.74);display:grid;place-items:center;padding:20px';
 const card=root.document.createElement('div');card.style.cssText='width:min(920px,96vw);max-height:92vh;overflow:auto;background:#0b1220;color:#e2e8f0;border:1px solid #334155;border-radius:18px;box-shadow:0 28px 80px #0008;padding:18px';
 const title=root.document.createElement('h2');title.textContent=pick(locale,'Configurar informe de instalación','Configure installation report');title.style.margin='0 0 6px';
 const hint=root.document.createElement('p');hint.textContent=pick(locale,'Selecciona las secciones que quieres incluir. Las tarjetas resaltadas se incluirán. Las etiquetas forman parte del informe técnico y también pueden abrirse por separado.','Select the sections to include. Highlighted cards will be included. Labels are part of the technical report and can also be opened separately.');hint.style.cssText='margin:0 0 10px;color:#94a3b8;font-size:13px';
 const selectionSummary=root.document.createElement('div');selectionSummary.id='nwInstallReportSelectionSummary';selectionSummary.style.cssText='margin:0 0 14px;padding:9px 11px;border:1px solid #334155;border-radius:10px;background:#111827;color:#cbd5e1;font-size:12px';
 card.append(title,hint,selectionSummary);
 const presetBar=root.document.createElement('div');presetBar.style.cssText='display:flex;gap:8px;flex-wrap:wrap;margin-bottom:14px';
 const refreshSelection=()=>{card.querySelectorAll('label[data-report-option]').forEach(lab=>{const cb=lab.querySelector('input[data-report-section]');const on=!!(cb&&cb.checked);lab.style.background=on?'#172554':'#111827';lab.style.borderColor=on?'#3b82f6':'#334155';lab.style.boxShadow=on?'inset 0 0 0 1px #3b82f6':'none';lab.style.opacity=on?'1':'.78';});selectionSummary.textContent=`${selected.size} ${pick(locale,'sección(es) seleccionadas','section(s) selected')} · ${pick(locale,'Etiquetas:','Labels:')} ${selected.has('labels')?pick(locale,'incluidas','included'):pick(locale,'no incluidas','not included')}`;};
 const presetButton=(label,ids)=>{const b=root.document.createElement('button');b.type='button';b.className='btn bs bsm';b.textContent=label;b.addEventListener('click',()=>{selected.clear();ids.forEach(id=>selected.add(id));card.querySelectorAll('input[data-report-section]').forEach(cb=>{cb.checked=selected.has(cb.dataset.reportSection);});refreshSelection();});return b;};
 presetBar.append(
   presetButton(pick(locale,'Todo','All'),SECTION_DEFS.map(x=>x.id)),
   presetButton(pick(locale,'Informe técnico','Technical report'),SECTION_DEFS.filter(x=>x.default).map(x=>x.id)),
   presetButton(pick(locale,'Solo conexiones','Connections only'),['cover','rack-plan','connection-diagram','port-matrices','media-legend','power-map','structured-cabling','direct-connectivity','rack-connections']),
   presetButton(pick(locale,'Solo etiquetas','Labels only'),['labels'])
 );
 card.appendChild(presetBar);
 const groups=new Map();
 for(const def of SECTION_DEFS){if(!groups.has(def.group))groups.set(def.group,[]);groups.get(def.group).push(def);}
 for(const [group,defs] of groups){
   const fs=root.document.createElement('fieldset');fs.style.cssText='border:1px solid #334155;border-radius:10px;padding:10px;margin:9px 0';
   const lg=root.document.createElement('legend');lg.textContent=localizeHtml(group,locale);lg.style.cssText='padding:0 6px;font-weight:800;color:#93c5fd';fs.appendChild(lg);
   const grid=root.document.createElement('div');grid.style.cssText='display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:6px';
   for(const def of defs){
     const lab=root.document.createElement('label');lab.dataset.reportOption=def.id;lab.style.cssText='display:flex;gap:8px;align-items:flex-start;padding:9px;border:1px solid #334155;border-radius:9px;background:#111827;cursor:pointer;transition:.12s ease';
     const cb=root.document.createElement('input');cb.type='checkbox';cb.dataset.reportSection=def.id;cb.checked=selected.has(def.id);cb.style.marginTop='2px';cb.addEventListener('change',()=>{cb.checked?selected.add(def.id):selected.delete(def.id);refreshSelection();});
     const span=root.document.createElement('span');span.textContent=localizeHtml(def.title,locale);lab.append(cb,span);grid.appendChild(lab);
   }
   fs.appendChild(grid);card.appendChild(fs);
 }
 const labelRow=root.document.createElement('div');labelRow.style.cssText='display:grid;grid-template-columns:1fr minmax(250px,340px);gap:12px;align-items:center;margin:12px 0;padding:10px;border:1px solid #334155;border-radius:10px';
 const labelText=root.document.createElement('div');const lb=root.document.createElement('b');lb.textContent=pick(locale,'Formato de etiquetas','Label format');const ls=root.document.createElement('div');ls.textContent=pick(locale,'Elige según el papel adhesivo. Después puedes ajustar la escala al 100 % en el diálogo de impresión.','Choose the adhesive paper format. You can then set print scaling to 100% in the print dialog.');ls.style.cssText='font-size:11px;color:#94a3b8;margin-top:3px';labelText.append(lb,ls);
 const preset=root.document.createElement('select');preset.style.cssText='width:100%;padding:8px;border-radius:7px;background:#111827;color:#e2e8f0;border:1px solid #475569';
 for(const p of Object.values(LABEL_PRESETS)){const opt=root.document.createElement('option');opt.value=p.id;opt.textContent=p.label;if(p.id===(prefs.labelPreset||'a4-3x8'))opt.selected=true;preset.appendChild(opt);}
 labelRow.append(labelText,preset);card.appendChild(labelRow);refreshSelection();
 const actions=root.document.createElement('div');actions.style.cssText='position:sticky;bottom:-18px;display:flex;justify-content:flex-end;gap:8px;flex-wrap:wrap;margin:14px -18px -18px;padding:12px 18px;background:#0b1220;border-top:1px solid #334155';
 const btn=(text,fn,primary)=>{const b=root.document.createElement('button');b.type='button';b.className='btn '+(primary?'bp':'bs')+' bsm';b.textContent=text;b.addEventListener('click',fn);return b;};
 actions.append(
   btn(pick(locale,'Cancelar','Cancel'),()=>overlay.remove(),false),
   btn(pick(locale,'🏷 Abrir solo etiquetas','🏷 Open labels only'),()=>{saveReportPreferences(root,selected,preset.value);overlay.remove();openReport(project,{sections:['labels'],labelsOnly:true,labelPreset:preset.value,locale});},false),
   btn(pick(locale,'🧰 Generar informe','🧰 Generate report'),()=>{if(!selected.size){root.alert&&root.alert(pick(locale,'Selecciona al menos una sección.','Select at least one section.'));return;}saveReportPreferences(root,selected,preset.value);overlay.remove();openReport(project,{sections:[...selected],includeLabels:selected.has('labels'),labelPreset:preset.value,locale});},true)
 );
 card.appendChild(actions);overlay.appendChild(card);overlay.addEventListener('click',e=>{if(e.target===overlay)overlay.remove();});root.document.body.appendChild(overlay);return overlay;
}
function inject(){
 if(!root.document||root.document.getElementById('btnCompactReport'))return;
 const target=root.document.getElementById('btnExport');if(!target)return;
 const b=root.document.createElement('button');b.id='btnCompactReport';b.className='btn bs bsm';b.type='button';
 const paint=()=>{const locale=localeOf();b.textContent=pick(locale,'🧰 Informe de instalación','🧰 Installation report');};
 paint();b.onclick=()=>{try{openConfigurator(currentProject());}catch(e){root.alert&&root.alert(e.message);}};
 target.parentNode.insertBefore(b,target);root.document.addEventListener('nw:i18n:changed',paint);
}
const api={version:'netwizard-installation-report-v7.1',build,openReport,currentProject,inject,openConfigurator,SECTION_DEFS,LABEL_PRESETS,selectedSections,equipmentConnectionDiagram,installationLabelSheets,interventionReport};
root.NetWizardInstallationReport=api;
root.NetWizardCompactReport=api;
if(!root.NetWizardDetailedReport)root.NetWizardDetailedReport=api;
if(typeof module!=='undefined'&&module.exports)module.exports=api;
if(root.document){if(root.document.readyState==='loading')root.document.addEventListener('DOMContentLoaded',inject);else inject();}
})(typeof window!=='undefined'?window:globalThis);
