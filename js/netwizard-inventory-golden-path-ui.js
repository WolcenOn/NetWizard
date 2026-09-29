/* NetWizard Inventory Golden Path UI v1 */
(function(root){
'use strict';
const arr=v=>Array.isArray(v)?v:[];
const state=()=>root.NetWizardState||null;
const gate=()=>root.NetWizardInventoryGate||null;
const el=(tag,cls,text)=>{const n=root.document.createElement(tag);if(cls)n.className=cls;if(text!=null)n.textContent=String(text);return n;};
function snapshot(){return state()?.getSnapshot?.()||{};}
function setMode(mode){
 const S=state();if(!S)return;
 S.updateProject(p=>Object.assign({},p,{workflow:Object.assign({},p.workflow||{},{mode:mode==='inventory'?'inventory':'design'}),step:mode==='inventory'?'loc':'wiz'}),{source:'workflow-mode-ui'});
}
function nav(step){
 const S=state();if(!S)return;
 S.updateProject(p=>Object.assign({},p,{step}),{source:'inventory-golden-path-nav'});
}
function workflowSelector(){
 const p=snapshot(),box=el('div','card'),h=el('div','card-h');h.append(el('div','card-t','🧭 Tipo de trabajo'));box.append(h);
 const hint=el('p','hint','Elige el objetivo principal. No convierte ni elimina datos existentes; cambia el recorrido y los criterios de validación.');box.append(hint);
 const row=el('div','brow');
 for(const [mode,title,desc] of [['inventory','📋 Inventariar una red existente','As-Built: ubicación, rack, equipos, alimentación, puertos y cableado.'],['design','🧠 Diseñar una red','To-Be: requisitos, capacidad, arquitectura, validación y deployment.']]){
   const b=el('button',`btn ${p.workflow&&p.workflow.mode===mode?'bp':'bs'}`,title);b.type='button';b.title=desc;b.onclick=()=>setMode(mode);row.append(b);
 }
 box.append(row);return box;
}
function stepCard(index,title,done,detail,target){
 const card=el('button',`btn ${done?'bs':'bp'}`);card.type='button';card.dataset.inventoryStep=String(index);card.style.cssText='text-align:left;display:grid;grid-template-columns:34px 1fr;gap:9px;align-items:start;width:100%;padding:11px;margin:6px 0';
 const n=el('span','',done?'✓':String(index));n.style.cssText='display:grid;place-items:center;width:28px;height:28px;border-radius:50%;background:'+(done?'#14532d':'#1d4ed8')+';color:#fff;font-weight:800';
 const body=el('span');const b=el('b','',title),small=el('small','',detail);small.style.cssText='display:block;margin-top:3px;opacity:.75';body.append(b,small);card.append(n,body);card.onclick=()=>nav(target);return card;
}
function renderGoldenPath(project){
 const wrap=el('div','nw-panel-stack'),mode=project.workflow&&project.workflow.mode||'design';
 if(mode!=='inventory'){
   const c=el('div','co co-ac','Esta página puede usarse también en Diseño para racks/cableado, pero el Golden Path de Inventario aparece al cambiar el tipo de trabajo a Inventario.');wrap.append(c);return wrap;
 }
 const g=gate()?.validate(project)||{status:'review',counts:{},score:{}},s=g.score||{};
 const head=el('div','card nw-card-wide'),hh=el('div','card-h');hh.append(el('div','card-t','⭐ Golden Path · Inventario As-Built'),el('span',`b ${g.status==='ready'?'bgn':g.status==='blocked'?'brd':'byw'}`,g.status==='ready'?'Documentación coherente':g.status==='blocked'?'Bloqueos físicos':'Revisión pendiente'));head.append(hh);
 head.append(el('p','hint','Documenta lo que existe en orden de dependencia: ubicación → rack contenedor → equipos → colocación y alimentación → puertos → cableado → lógica observada.'));
 const stats=el('div','stats');for(const [v,l] of [[s.locations,'Ubicaciones'],[s.racks,'Racks'],[s.devices,'Equipos'],[s.placedDevices,'Colocados'],[s.ports,'Puertos'],[s.cableRuns,'Tramos']]){const x=el('div');x.append(el('b','',v||0),el('span','',l));stats.append(x);}head.append(stats);wrap.append(head);
 const flow=el('div','card nw-card-wide');flow.append(el('div','card-t','Recorrido recomendado'));
 flow.append(
   stepCard(1,'Ubicaciones',s.locations>0,'Sedes, plantas, salas técnicas y armarios.','loc'),
   stepCard(2,'Racks contenedores',s.racks>0,'Crea armarios/racks, altura U y ubicación. La ocupación se documenta después de crear los equipos.','physical'),
   stepCard(3,'Equipos',s.devices>0,'Identidad del equipo: tipo, fabricante, modelo, serial/asset y capacidades.','dev'),
   stepCard(4,'Colocación y alimentación',s.placedDevices>0&&(s.pdus===0||s.powerConnections>0),'Asigna rack/U desde Inventario físico y documenta PDU, feed, toma y PSU cuando aplique.','physical'),
   stepCard(5,'Puertos físicos',s.ports>0,'Medio, velocidad máxima/negociada, PoE, transceptor y estado.','ports'),
   stepCard(6,'Cableado y conexiones',s.cableRuns>0||arr(project.links).length>0,'Patch panel, toma, ruta física, longitud y enlaces directos.','physical'),
   stepCard(7,'Lógica observada',arr(project.vlans).length>0||project.observedState,'VLAN/IP/configuración solo cuando se conoce.','vlan')
 );wrap.append(flow);
 const issues=el('div','card nw-card-wide');issues.append(el('div','card-t',`Inventory Gate · ${g.counts?.blocking||0} bloqueos · ${g.counts?.warnings||0} avisos`));
 if(!arr(g.issues).length)issues.append(el('div','co co-gn','Inventario documentalmente coherente.'));
 else{const ul=el('ul','rack-issues');for(const i of arr(g.issues).slice(0,18))ul.append(el('li','',`[${i.code}] ${i.message}`));issues.append(ul);}wrap.append(issues);
 return wrap;
}
function inject(){
 if(!root.document)return;
 const dash=root.document.getElementById('pg-dash');if(dash){let mount=root.document.getElementById('workflowSelectorMount');if(!mount){mount=root.document.createElement('div');mount.id='workflowSelectorMount';dash.insertBefore(mount,dash.children[1]||null);}mount.textContent='';mount.append(workflowSelector());}
 const physical=root.document.getElementById('inventoryGoldenPathMount');if(physical){physical.textContent='';physical.append(renderGoldenPath(snapshot()));}
 const mode=snapshot().workflow&&snapshot().workflow.mode||'design';
 const wiz=root.document.querySelector('.sb-it[data-step="wiz"]');if(wiz)wiz.style.display=mode==='inventory'?'none':'';
 const phys=root.document.querySelector('.sb-it[data-step="physical"]');if(phys)phys.style.display='';
}
const api={version:'netwizard-inventory-golden-path-ui-v1',setMode,renderGoldenPath,inject};
root.NetWizardInventoryGoldenPathUi=api;
if(typeof module!=='undefined'&&module.exports)module.exports=api;
if(root.document){root.document.addEventListener('DOMContentLoaded',()=>setTimeout(inject,0));root.document.addEventListener('nw:project:changed',()=>setTimeout(inject,0));}
})(typeof window!=='undefined'?window:globalThis);
