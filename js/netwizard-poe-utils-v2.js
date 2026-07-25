/* NetWizard PoE Utils v2 - canonical model consumer */
(function initNetWizardPoeUtils(root){
'use strict';
const MODEL=root.NetWizardPoeModel||(typeof require==='function'?require('./netwizard-poe-model.js'):null);
if(!MODEL)throw new Error('NetWizardPoeModel no está disponible.');
const arr=v=>Array.isArray(v)?v:[];
const round1=v=>Math.round(Number(v||0)*10)/10;
const byId=(list,id)=>arr(list).find(x=>x&&x.id===id)||null;
const labelDevice=d=>d&&(d.name||d.id)||'?';
const labelPort=(project,p)=>`${labelDevice(byId(project&&project.devices,p&&p.deviceId))} ${p&&(p.name||p.id)||'?'}`;
const inferCopper=p=>!/sfp|qsfp|fiber|fibra|optical|dac/.test([p&&p.media,p&&p.name,p&&p.desc].filter(Boolean).join(' ').toLowerCase());
function issue(code,severity,message,extra){return Object.assign({code,severity,category:'poe',message,blocking:severity==='error',source:'poe'},extra||{});}
function validatePoe(project){
 project=project||{};const errors=[],warnings=[],info=[],issues=[];const data=MODEL.collect(project);const seen=new Set();
 const push=(bucket,item)=>{const key=[item.code,item.hostId||'',item.portId||'',item.deviceId||''].join('|');if(seen.has(key))return;seen.add(key);bucket.push(item.message);issues.push(item);};
 for(const c of data.contexts){
  const host=c.host||{};const name=host.name||host.id||'Host';const watts=round1(c.demand.watts);
  if(watts<=0)push(warnings,issue('NW-POE-001','warning',`Host ${name}: marcado como PoE pero sin consumo estimado.`,{hostId:host.id}));
  if(!c.port){push(warnings,issue('NW-POE-002','warning',`Host ${name}: requiere PoE pero no tiene puerto físico asociado.`,{hostId:host.id}));continue;}
  if(!inferCopper(c.port))push(warnings,issue('NW-POE-003','warning',`Host ${name}: requiere PoE pero está asociado a ${labelPort(project,c.port)}, que parece fibra/SFP/DAC.`,{hostId:host.id,portId:c.port.id}));
  const cap=c.portCapacity.watts;const mode=MODEL.normalizePoeMode(c.port.poeMode||c.port.poeStandard||c.port.poe);
  if(mode==='none'||cap===0)push(errors,issue('NW-POE-004','error',`${labelPort(project,c.port)}: host ${name} requiere PoE (${watts} W) pero el puerto está marcado sin PoE.`,{hostId:host.id,portId:c.port.id}));
  else if(cap!==null&&watts>cap)push(errors,issue('NW-POE-005','error',`${labelPort(project,c.port)}: host ${name} requiere ${watts} W y el puerto soporta ${cap} W.`,{hostId:host.id,portId:c.port.id}));
  else if(cap===null)push(info,issue('NW-POE-006','info',`${labelPort(project,c.port)}: carga ${watts} W en modo automático; define estándar o capacidad solo si necesitas validación estricta por puerto.`,{hostId:host.id,portId:c.port.id}));
 }
 for(const [portId,watts] of Object.entries(data.loadsByPort)){
  const port=byId(project.ports,portId);const consumers=data.contexts.filter(c=>c.portId===portId);const cap=MODEL.portPoeCapacity(port).watts;
  if(consumers.length>1&&cap!==null&&cap>0&&watts>cap)push(errors,issue('NW-POE-007','error',`${labelPort(project,port)}: carga PoE agregada ${round1(watts)} W supera capacidad ${cap} W.`,{portId}));
 }
 for(const [deviceId,watts] of Object.entries(data.loadsByDevice)){
  const device=byId(project.devices,deviceId);const budget=MODEL.devicePoeBudget(device).watts;
  if(budget!==null&&watts>budget)push(errors,issue('NW-POE-008','error',`${labelDevice(device)}: carga PoE total ${round1(watts)} W supera presupuesto ${budget} W.`,{deviceId}));
  else if(budget===null)push(info,issue('NW-POE-009','info',`${labelDevice(device)}: carga PoE estimada ${round1(watts)} W; define presupuesto del equipo para validar capacidad total.`,{deviceId}));
 }
 if(!errors.length&&!warnings.length&&!info.length)info.push('PoE: sin cargas PoE detectadas o sin incompatibilidades evidentes.');
 return{ok:errors.length===0,errors,warnings,info,issues,loadsByDevice:data.loadsByDevice,loadsByPort:data.loadsByPort,contexts:data.contexts};
}
function renderPoePanel(project){const a=validatePoe(project);return[`PoE: ${a.errors.length} errores, ${a.warnings.length} avisos, ${a.info.length} info`,...a.errors,...a.warnings,...a.info].join('\n');}
function el(tag,cls,text){const n=document.createElement(tag);if(cls)n.className=cls;if(text!==undefined)n.textContent=String(text??'');return n;}
function input(attrs){const n=document.createElement('input');Object.entries(attrs||{}).forEach(([k,v])=>k==='dataset'?Object.assign(n.dataset,v):n.setAttribute(k,String(v)));return n;}
function select(dataset,options,value){const n=document.createElement('select');Object.assign(n.dataset,dataset||{});for(const [v,l] of options){const o=document.createElement('option');o.value=v;o.textContent=l;o.selected=String(value??'')===String(v);n.appendChild(o);}return n;}
function table(headers,rows,empty){const w=el('div','tw'),t=el('table'),th=el('thead'),tr=el('tr');headers.forEach(h=>tr.appendChild(el('th','',h)));th.appendChild(tr);t.appendChild(th);const tb=el('tbody');if(rows.length)rows.forEach(cells=>{const r=el('tr');cells.forEach(c=>{const d=el('td');c instanceof Node?d.appendChild(c):d.textContent=String(c??'');r.appendChild(d);});tb.appendChild(r);});else{const r=el('tr'),d=el('td','',empty);d.colSpan=headers.length;r.appendChild(d);tb.appendChild(r);}t.appendChild(tb);w.appendChild(t);return w;}
function renderPoePanelDom(project){
 const audit=validatePoe(project),card=el('div','card');card.id='poePlannerCard';const head=el('div','card-h');head.append(el('div','card-t','⚡ PoE · Presupuesto y consumo'),el('span',`b ${audit.errors.length?'brd':audit.warnings.length?'byw':'bgn'}`,`${audit.errors.length} errores · ${audit.warnings.length} avisos · ${audit.info.length} info`));card.appendChild(head);
 const msg=el('div',`co ${audit.errors.length?'co-rd':audit.warnings.length?'co-yw':'co-gn'}`,[...audit.errors,...audit.warnings,...audit.info].slice(0,8).join('\n'));card.appendChild(msg);
 const devRows=arr(project.devices).filter(d=>d.type==='switch'||audit.loadsByDevice[d.id]!=null||d.poeBudgetW!=null).map(d=>[d.name||d.id,`${round1(audit.loadsByDevice[d.id]||0)} W`,input({type:'number',min:0,step:1,value:d.poeBudgetW??'',dataset:{poeDev:d.id}})]);
 const hostRows=arr(project.hosts).filter(h=>MODEL.hostRequiresPoe(h)||h.poeMode||h.poeWatts!=null).map(h=>[h.name||h.id,select({poeHostMode:h.id},[['auto','Auto'],['required','Requiere'],['none','No PoE']],MODEL.normalizePoeMode(h.poeMode||'auto')),input({type:'number',min:0,step:0.1,value:h.poeWatts??'',placeholder:MODEL.defaultPowerForHostType(h.type)||'',dataset:{poeHostW:h.id}})]);
 const portRows=arr(project.ports).filter(p=>p.poeMode||p.poeWattsMax!=null||audit.loadsByPort[p.id]!=null).slice(0,80).map(p=>[labelPort(project,p),`${round1(audit.loadsByPort[p.id]||0)} W`,select({poePortMode:p.id},[['auto','Auto'],['none','Sin PoE'],['af','802.3af'],['at','802.3at'],['bt','802.3bt 60W'],['bt90','802.3bt 90W']],MODEL.normalizePoeMode(p.poeMode||'auto')),input({type:'number',min:0,step:0.1,value:p.poeWattsMax??'',placeholder:'auto',dataset:{poePortW:p.id}})]);
 card.append(table(['Equipo','Carga','Presupuesto W'],devRows,'Sin switches PoE detectados.'),table(['Host','Modo','W'],hostRows,'Sin hosts PoE detectados.'),table(['Puerto','Carga','Estándar','W máx.'],portRows,'Sin puertos PoE configurados.'));
 const row=el('div','brow'),save=el('button','btn bp','💾 Guardar PoE'),auditBtn=el('button','btn bs','🧪 Auditar PoE');save.id='poeSaveBtn';auditBtn.id='poeAuditBtn';row.append(save,auditBtn);card.appendChild(row);return card;
}
function mountPoePanel(){if(typeof document==='undefined')return;const page=document.getElementById('pg-ports')||document.getElementById('pg-dash'),state=root.NetWizardState;if(!page||!state||typeof state.getSnapshot!=='function')return;let mount=document.getElementById('poePlannerMount');if(!mount){mount=document.createElement('div');mount.id='poePlannerMount';page.appendChild(mount);}mount.textContent='';mount.appendChild(renderPoePanelDom(state.getSnapshot()));const save=document.getElementById('poeSaveBtn');if(save)save.onclick=()=>{const next=state.getSnapshot();document.querySelectorAll('[data-poe-dev]').forEach(n=>{const d=next.devices.find(x=>x.id===n.dataset.poeDev);if(d)d.poeBudgetW=n.value===''?null:Number(n.value);});document.querySelectorAll('[data-poe-host-mode]').forEach(n=>{const h=next.hosts.find(x=>x.id===n.dataset.poeHostMode);if(h){h.poeMode=n.value;h.poeRequired=n.value==='required'?true:n.value==='none'?false:null;}});document.querySelectorAll('[data-poe-host-w]').forEach(n=>{const h=next.hosts.find(x=>x.id===n.dataset.poeHostW);if(h)h.poeWatts=n.value===''?null:Number(n.value);});document.querySelectorAll('[data-poe-port-mode]').forEach(n=>{const p=next.ports.find(x=>x.id===n.dataset.poePortMode);if(p)p.poeMode=n.value;});document.querySelectorAll('[data-poe-port-w]').forEach(n=>{const p=next.ports.find(x=>x.id===n.dataset.poePortW);if(p)p.poeWattsMax=n.value===''?null:Number(n.value);});state.replaceProject(next,{source:'poe-ui'});};const auditBtn=document.getElementById('poeAuditBtn');if(auditBtn)auditBtn.onclick=()=>alert(renderPoePanel(state.getSnapshot()));}
const api={version:'netwizard-poe-utils-v3.22',...MODEL,validatePoe,renderPoePanel,renderPoePanelDom,mountPoePanel};root.NetWizardPoeUtils=api;if(typeof module!=='undefined'&&module.exports)module.exports=api;if(typeof document!=='undefined'){document.addEventListener('DOMContentLoaded',()=>setTimeout(mountPoePanel,0));document.addEventListener('nw:project:changed',()=>setTimeout(mountPoePanel,0));}
})(typeof window!=='undefined'?window:globalThis);
