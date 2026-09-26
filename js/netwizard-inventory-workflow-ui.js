/* NetWizard Inventory Workflow UI v1
 * Selector Design/Inventory + Golden Path As-Built.
 */
(function initNetWizardInventoryWorkflowUi(root){
'use strict';

const arr=v=>Array.isArray(v)?v:[];
const clean=v=>String(v==null?'':v).trim();
const clone=v=>JSON.parse(JSON.stringify(v==null?null:v));
const state=()=>root.NetWizardState||null;
const gate=()=>root.NetWizardInventoryGate||null;
const doc=()=>root.document||null;
const byId=id=>doc()&&doc().getElementById(id);

const DESIGN_ONLY_STEPS=new Set(['wiz','vlan','iot','fw','cfg']);
const INVENTORY_ONLY_STEPS=new Set(['physical']);

function make(tag,cls,text){
  const n=doc().createElement(tag);
  if(cls)n.className=cls;
  if(text!=null)n.textContent=String(text);
  return n;
}
function button(text,cls,action){
  const b=make('button',`btn ${cls||'bs'}`,text);
  b.type='button';
  if(action)b.dataset.inventoryAction=action;
  return b;
}
function field(label,node){
  const wrap=make('div');
  const l=make('label','fl',label);
  wrap.append(l,node);return wrap;
}
function select(options,value){
  const s=doc().createElement('select');
  for(const [v,l] of options){
    const o=doc().createElement('option');o.value=v;o.textContent=l;o.selected=String(v)===String(value??'');s.appendChild(o);
  }
  return s;
}
function getSnapshot(){return state()?.getSnapshot?.()||null;}
function modeOf(project){return clean(project&&project.workflow&&project.workflow.mode||'design').toLowerCase()==='inventory'?'inventory':'design';}

function updateProject(mutator,source){
  const S=state();if(!S||typeof S.updateProject!=='function')return null;
  return S.updateProject(project=>mutator(clone(project)),{source:source||'inventory-workflow-ui'});
}
function setMode(mode){
  const nextMode=mode==='inventory'?'inventory':'design';
  return updateProject(project=>{
    project.workflow=Object.assign({},project.workflow||{},{mode:nextMode});
    const current=clean(project.step||'dash');
    if(nextMode==='inventory'&&DESIGN_ONLY_STEPS.has(current))project.step='loc';
    if(nextMode==='design'&&INVENTORY_ONLY_STEPS.has(current))project.step='loc';
    return project;
  },'workflow-mode-ui');
}
function setStep(step){
  return updateProject(project=>{project.step=step;return project;},'inventory-golden-path-nav');
}
function setLocationRackMode(locationId,rackMode){
  const allowed=['rack','wall-cabinet','none','unknown'];
  return updateProject(project=>{
    project.physicalLocations=arr(project.physicalLocations).map(loc=>loc.id===locationId?Object.assign({},loc,{inventoryRackMode:allowed.includes(rackMode)?rackMode:'unknown'}):loc);
    return project;
  },'inventory-location-rack-mode');
}

function ensureWorkflowCard(){
  if(!doc()||byId('nwWorkflowModeCard'))return;
  const page=byId('pg-dash'),anchor=page&&page.querySelector('.card');
  if(!page||!anchor)return;
  const card=make('div','card');card.id='nwWorkflowModeCard';
  const head=make('div','card-h');head.append(make('div','card-t','🧭 Tipo de trabajo'));
  const hint=make('div','hint','El mismo proyecto usa entidades canónicas, pero NetWizard adapta el recorrido y los criterios de calidad al trabajo que vas a realizar.');
  const grid=make('div','g2');
  const inv=make('button','btn bs','📋 Inventariar una red existente');inv.type='button';inv.id='nwModeInventory';inv.dataset.workflowMode='inventory';
  const design=make('button','btn bs','🧠 Diseñar una red');design.type='button';design.id='nwModeDesign';design.dataset.workflowMode='design';
  grid.append(inv,design);card.append(head,hint,grid);
  anchor.insertAdjacentElement('afterend',card);
  card.addEventListener('click',e=>{
    const b=e.target&&e.target.closest&&e.target.closest('[data-workflow-mode]');
    if(!b)return;setMode(b.dataset.workflowMode);
  });
}
function renderWorkflowCard(project){
  ensureWorkflowCard();
  const mode=modeOf(project);
  for(const b of doc().querySelectorAll('[data-workflow-mode]')){
    const active=b.dataset.workflowMode===mode;
    b.classList.toggle('bp',active);b.classList.toggle('bs',!active);
    b.setAttribute('aria-pressed',active?'true':'false');
  }
}

function applyNavigation(project){
  const mode=modeOf(project);
  for(const node of doc().querySelectorAll('[data-workflow-only]')){
    const visible=node.dataset.workflowOnly===mode;
    node.style.display=visible?'':'none';
  }
  const secSecurity=byId('sbSecSecurity'),secExport=byId('sbSecExport');
  if(secSecurity)secSecurity.style.display=mode==='inventory'?'none':'';
  if(secExport)secExport.style.display=mode==='inventory'?'none':'';
  const wizard=doc().querySelector('.sb-it[data-step="wiz"]');
  if(wizard)wizard.style.display=mode==='inventory'?'none':'';
  for(const step of ['vlan','iot','fw','cfg']){
    const node=doc().querySelector(`.sb-it[data-step="${step}"]`);
    if(node)node.style.display=mode==='inventory'?'none':'';
  }
  const physical=doc().querySelector('.sb-it[data-step="physical"]');
  if(physical)physical.style.display=mode==='inventory'?'':'none';
}

function rackModeLabel(value){
  return value==='rack'?'Rack propio':value==='wall-cabinet'?'Armario mural':value==='none'?'Sin rack / armario':'Sin confirmar';
}
function locationRackMode(project,location){
  const explicit=clean(location&&location.inventoryRackMode).toLowerCase();
  if(['rack','wall-cabinet','none','unknown'].includes(explicit))return explicit;
  return arr(project&&project.racks).some(r=>r&&r.locationId===location.id)?'rack':'unknown';
}
function renderProgress(report){
  const card=make('div','card nw-card-wide');
  const head=make('div','card-h');head.append(make('div','card-t','📋 Golden Path · Inventario As-Built'));
  const badge=make('span',`b ${report.status==='blocked'?'brd':report.status==='review'?'byw':'bgn'}`,report.status==='blocked'?'Bloqueado':report.status==='review'?'Revisar':'Listo');
  head.append(badge);card.append(head);
  card.append(make('p','hint','Documenta lo que existe: ubicación → rack/armario → equipos → alimentación → puertos → cableado. VLAN/IP/configuración observada queda como información opcional.'));
  const meter=make('div','co co-ac',`Captura esencial: ${report.progress.requiredComplete}/${report.progress.requiredTotal} · ${report.progress.percent}%`);
  card.append(meter);
  const grid=make('div','nw-card-grid');
  for(const step of report.progress.steps){
    const box=make('section','rack-topology-group');
    box.dataset.inventoryStep=step.id;
    const title=make('h4','',`${step.complete?'✓':'○'} ${step.label}${step.required?'':' · opcional'}`);
    const detail=make('div','hint',step.detail);
    box.append(title,detail);grid.append(box);
  }
  card.append(grid);
  const actions=make('div','brow');
  actions.append(
    button('📍 Ubicaciones','bs bsm','locations'),
    button('🖥 Equipos','bs bsm','devices'),
    button('🔌 Puertos','bs bsm','ports'),
    button('🔗 Enlaces','bs bsm','links')
  );
  card.append(actions);return card;
}
function renderLocationSurvey(project){
  const card=make('div','card nw-card-wide');
  const head=make('div','card-h');head.append(make('div','card-t','📍 ¿Qué hay en cada ubicación?'),make('span','b bac',String(arr(project.physicalLocations).length)));
  card.append(head);
  if(!arr(project.physicalLocations).length){
    card.append(make('div','co co-yw','Primero crea la sede, edificio, planta o sala en Paso 0 · Ubicaciones.'));
    const a=make('div','brow');a.append(button('Crear ubicaciones','bp','locations'));card.append(a);return card;
  }
  card.append(make('p','hint','Indica si la ubicación tiene rack, armario mural o si los equipos están instalados sin armario. No se crea ningún rack automáticamente.'));
  const grid=make('div','nw-card-grid');
  for(const loc of arr(project.physicalLocations)){
    const box=make('section','rack-editor-group');
    box.dataset.inventoryLocationId=loc.id;
    box.append(make('h3','',loc.name||loc.id));
    const current=locationRackMode(project,loc);
    const s=select([
      ['unknown','— Sin confirmar —'],
      ['rack','Rack propio'],
      ['wall-cabinet','Armario mural'],
      ['none','Sin rack / armario']
    ],current);
    s.dataset.inventoryRackMode=loc.id;
    box.append(field('Infraestructura observada',s));
    const racks=arr(project.racks).filter(r=>r&&r.locationId===loc.id);
    box.append(make('div','hint',racks.length?`${racks.length} rack/armario(s) asociado(s): ${racks.map(r=>r.name||r.id).join(', ')}`:`Estado: ${rackModeLabel(current)}`));
    grid.append(box);
  }
  card.append(grid);return card;
}
function renderGate(report){
  const card=make('div','card nw-card-wide');
  const head=make('div','card-h');head.append(make('div','card-t','✅ Inventory Gate'));
  const badge=make('span',`b ${report.status==='blocked'?'brd':report.status==='review'?'byw':'bgn'}`,report.status==='blocked'?'BLOQUEADO':report.status==='review'?'REVISAR':'LISTO');
  head.append(badge);card.append(head);
  card.append(make('p','hint','Este gate verifica coherencia del As-Built. No exige direccionamiento, DHCP, routing, firewall ni deployment.'));
  card.append(make('div','co co-ac',gate().summarize(report)));
  const issues=arr(report.issues);
  if(!issues.length){card.append(make('div','co co-gn','No se han detectado incidencias documentales.'));return card;}
  const ul=make('ul','rack-issues');
  for(const i of issues.slice(0,20)){
    const li=make('li','',`[${i.code}] ${i.message}`);
    if(i.blocking)li.style.fontWeight='700';
    ul.append(li);
  }
  card.append(ul);
  if(issues.length>20)card.append(make('div','hint',`Se muestran 20 de ${issues.length} incidencias.`));
  return card;
}
function renderInventoryPage(project){
  const mount=byId('inventoryWorkflowMount');if(!mount)return;
  mount.textContent='';
  if(modeOf(project)!=='inventory'){
    mount.append(make('div','co co-ac','Esta página pertenece al flujo Inventario. Cambia el tipo de trabajo desde el Panel para usarla.'));
    return;
  }
  const report=gate()?.run?.(project);
  if(!report){mount.append(make('div','co co-yw','Inventory Gate no está disponible.'));return;}
  mount.append(renderProgress(report),renderLocationSurvey(project),renderGate(report));
}

function bindInventoryPage(){
  const mount=byId('inventoryWorkflowMount');if(!mount||mount.dataset.bound==='1')return;
  mount.dataset.bound='1';
  mount.addEventListener('change',e=>{
    const selectNode=e.target&&e.target.closest&&e.target.closest('[data-inventory-rack-mode]');
    if(selectNode)setLocationRackMode(selectNode.dataset.inventoryRackMode,selectNode.value);
  });
  mount.addEventListener('click',e=>{
    const b=e.target&&e.target.closest&&e.target.closest('[data-inventory-action]');if(!b)return;
    const action=b.dataset.inventoryAction;
    if(action==='locations')setStep('loc');
    if(action==='devices')setStep('dev');
    if(action==='ports')setStep('ports');
    if(action==='links')setStep('links');
  });
}
function render(){
  const project=getSnapshot();if(!project)return;
  renderWorkflowCard(project);
  applyNavigation(project);
  renderInventoryPage(project);
}
function install(){
  if(!doc()||!state())return false;
  ensureWorkflowCard();bindInventoryPage();render();
  doc().addEventListener('nw:project:changed',render);
  return true;
}

const api={
  version:'netwizard-inventory-workflow-ui-v1',
  modeOf,setMode,setLocationRackMode,locationRackMode,applyNavigation,render,install
};
root.NetWizardInventoryWorkflowUi=api;
if(typeof module!=='undefined'&&module.exports)module.exports=api;
if(root.document){
  if(root.document.readyState==='loading')root.document.addEventListener('DOMContentLoaded',install);
  else install();
}
})(typeof window!=='undefined'?window:globalThis);
