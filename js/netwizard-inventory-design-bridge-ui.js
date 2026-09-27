/* NetWizard Inventory -> Design Bridge UI v1 */
(function initNetWizardInventoryDesignBridgeUi(root){
'use strict';

const arr=v=>Array.isArray(v)?v:[];
const obj=v=>v&&typeof v==='object'&&!Array.isArray(v)?v:{};
const clean=v=>String(v==null?'':v).trim();
const state=()=>root.NetWizardState||null;
const bridge=()=>root.NetWizardInventoryDesignBridge||null;
const history=()=>root.NetWizardHistory||null;
const gate=()=>root.NetWizardInventoryGate||null;
const doc=()=>root.document||null;

function make(tag,cls,text){
  const d=doc(),n=d.createElement(tag);
  if(cls)n.className=cls;
  if(text!=null)n.textContent=String(text);
  return n;
}
function snapshot(){return state()?.getSnapshot?.()||{};}
function isDerivedDesign(project){
  const w=obj(project&&project.workflow),from=obj(w.derivedFrom);
  return w.mode==='design'&&from.type==='inventory';
}
function sourceSnapshotId(project){return clean(obj(obj(project&&project.workflow).derivedFrom).snapshotId);}

function deriveToDesign(){
  const S=state(),B=bridge(),H=history(),G=gate(),current=snapshot();
  if(!S||!B)return;
  if(obj(current.workflow).mode!=='inventory')return root.alert&&root.alert('Esta operación parte de un proyecto en modo Inventario.');
  const report=G&&G.validate?G.validate(current):null;
  if(report&&report.counts&&report.counts.blocking){
    return root.alert&&root.alert('El Inventory Gate tiene bloqueos físicos. Corrígelos antes de crear el Diseño To-Be.');
  }
  const warnings=report&&report.counts?Number(report.counts.warnings||0):0;
  const msg=[
    'Se creará un Diseño To-Be a partir del As-Built actual.',
    '',
    'El inventario original se guardará como snapshot restaurable.',
    'Los equipos existentes empezarán como “Mantener”.',
    warnings?`Hay ${warnings} aviso(s) documentales que también pasarán al diseño.`:null,
    '',
    '¿Continuar?'
  ].filter(Boolean).join('\n');
  if(root.confirm&&!root.confirm(msg))return;
  if(!H||typeof H.createSnapshot!=='function'){
    return root.alert&&root.alert('No se puede proteger el As-Built porque NetWizardHistory no está disponible.');
  }
  const snap=H.createSnapshot('As-Built origen · '+(current.projName||'Inventario'),{
    source:'inventory-to-design',
    project:current
  });
  const result=B.createDesignFromInventory(current,{snapshotId:snap.id,createdAt:snap.ts});
  if(!result.ok)return root.alert&&root.alert(result.message||'No se pudo crear el diseño.');
  result.project.step='dev';
  S.replaceProject(result.project,{source:'inventory-to-design'});
}

function restoreAsBuilt(){
  const H=history(),project=snapshot(),id=sourceSnapshotId(project);
  if(!H||!id)return root.alert&&root.alert('No se encuentra el snapshot de origen.');
  if(root.confirm&&!root.confirm('¿Volver al As-Built original? El diseño actual se guardará automáticamente antes de restaurar.'))return;
  const res=H.restoreSnapshot(id);
  if(!res.ok&&root.alert)root.alert(res.error||'No se pudo restaurar el As-Built.');
}

function dispositionLabel(value){
  return {keep:'Mantener',retire:'Retirar',replace:'Reemplazar',add:'Añadir'}[value]||value;
}
function summaryText(summary){
  const c=summary.counts||{};
  return `${c.keep||0} mantener · ${c.retire||0} retirar · ${c.replace||0} reemplazar · ${c.add||0} añadir`;
}
function updateDisposition(deviceId,value){
  const S=state(),B=bridge(),current=snapshot();if(!S||!B)return;
  const result=B.setDeviceDisposition(current,deviceId,value);
  if(!result.ok)return root.alert&&root.alert(result.message||'No se pudo actualizar el equipo.');
  S.replaceProject(result.project,{source:'inventory-design-disposition'});
}

function renderInventoryAction(project){
  const card=make('div','card');
  const h=make('div','card-h');h.append(make('div','card-t','🔁 Del As-Built al To-Be'));card.append(h);
  card.append(make('p','hint','Crea un diseño nuevo usando el inventario como base física. NetWizard guarda antes un snapshot restaurable del As-Built.'));
  const B=bridge(),G=gate(),report=G&&G.validate?G.validate(project):null;
  if(report&&report.counts&&report.counts.blocking){
    const warn=make('div','co co-rd',`Hay ${report.counts.blocking} bloqueo(s) físicos. Resuélvelos antes de derivar el diseño.`);card.append(warn);
  }else if(report&&report.counts&&report.counts.warnings){
    card.append(make('div','co co-yw',`Se puede derivar, pero quedan ${report.counts.warnings} aviso(s) documentales.`));
  }else{
    card.append(make('div','co co-gn','El As-Built puede usarse como base de un Diseño To-Be.'));
  }
  const row=make('div','brow'),btn=make('button','btn bp','🧠 Crear Diseño To-Be');
  btn.type='button';btn.disabled=!!(report&&report.counts&&report.counts.blocking);btn.onclick=deriveToDesign;row.append(btn);card.append(row);
  if(!B)btn.disabled=true;
  return card;
}

function renderDerivedDesign(project){
  const B=bridge(),summary=B?B.summarize(project):{counts:{},devices:{}},changeSet=B?B.buildPhysicalChangeSet(project):{actionable:[]};
  const physicalPlan=root.NetWizardPhysicalInterventionPlan&&root.NetWizardPhysicalInterventionPlan.build
    ? root.NetWizardPhysicalInterventionPlan.build(project)
    : null;
  const card=make('div','card nw-card-wide');
  const h=make('div','card-h');
  h.append(make('div','card-t','🔁 Diseño derivado del As-Built'),make('span','b bac',summaryText(summary)));card.append(h);
  const src=obj(obj(project.workflow).derivedFrom);
  card.append(make('p','hint',`Origen: ${src.sourceProjectName||'Inventario'} · snapshot ${src.snapshotId||'—'}. Marca qué ocurrirá con cada equipo antes de continuar con el diseño.`));

  const wrap=make('div','tw'),table=make('table');
  const thead=make('thead'),trh=make('tr');
  ['Equipo','Fabricante / modelo','Rack / U','Decisión'].forEach(x=>trh.append(make('th','',x)));thead.append(trh);table.append(thead);
  const tbody=make('tbody');
  for(const d of arr(project.devices)){
    const hasOrigin=!!clean(d.originRef),current=clean(d.designDisposition)||(hasOrigin?'keep':'add');
    const tr=make('tr');
    tr.append(make('td','',d.name||d.id));
    tr.append(make('td','',[d.manufacturer,d.model].filter(Boolean).join(' · ')||'—'));
    tr.append(make('td','',[d.rackId||d.rack,d.rackUnit!=null?`U${d.rackUnit}`:null].filter(Boolean).join(' · ')||'—'));
    const td=make('td'),sel=make('select');
    for(const value of ['keep','retire','replace','add']){
      if(hasOrigin&&value==='add')continue;
      if(!hasOrigin&&value!=='add')continue;
      const opt=make('option','',dispositionLabel(value));opt.value=value;if(value===current)opt.selected=true;sel.append(opt);
    }
    sel.dataset.designDisposition=d.id;sel.onchange=()=>updateDisposition(d.id,sel.value);td.append(sel);tr.append(td);tbody.append(tr);
  }
  table.append(tbody);wrap.append(table);card.append(wrap);

  const actionable=arr(changeSet.actionable);
  const physicalCount=physicalPlan&&physicalPlan.ok?Number(physicalPlan.counts&&physicalPlan.counts.total||0):actionable.length;
  const note=make('div',physicalCount?'co co-yw':'co co-gn',
    physicalCount?`Plan físico: ${physicalCount} acción(es) de intervención detectadas. Revísalas en Inventario físico.`:'Plan físico: no hay diferencias físicas detectadas frente al As-Built.'
  );card.append(note);
  const actions=make('div','brow');
  const back=make('button','btn bs','↩ Volver al As-Built');back.type='button';back.onclick=restoreAsBuilt;actions.append(back);
  card.append(actions);
  return card;
}

function inject(){
  const d=doc();if(!d)return;
  const p=snapshot();

  let inventoryMount=d.getElementById('inventoryToDesignMount');
  if(!inventoryMount){
    const host=d.getElementById('inventoryGoldenPathMount');
    if(host&&host.parentNode){inventoryMount=d.createElement('div');inventoryMount.id='inventoryToDesignMount';host.parentNode.insertBefore(inventoryMount,host.nextSibling);}
  }
  if(inventoryMount){
    inventoryMount.textContent='';
    if(obj(p.workflow).mode==='inventory')inventoryMount.append(renderInventoryAction(p));
  }

  let designMount=d.getElementById('inventoryDerivedDesignMount');
  if(!designMount){
    const host=d.getElementById('pg-dev');
    if(host){designMount=d.createElement('div');designMount.id='inventoryDerivedDesignMount';host.insertBefore(designMount,host.children[1]||null);}
  }
  if(designMount){
    designMount.textContent='';
    if(isDerivedDesign(p))designMount.append(renderDerivedDesign(p));
  }
}

const api={version:'netwizard-inventory-design-bridge-ui-v1',deriveToDesign,restoreAsBuilt,updateDisposition,inject,isDerivedDesign};
root.NetWizardInventoryDesignBridgeUi=api;
if(typeof module!=='undefined'&&module.exports)module.exports=api;
if(root.document){
  if(root.document.readyState==='loading')root.document.addEventListener('DOMContentLoaded',()=>root.setTimeout(inject,0));
  else root.setTimeout(inject,0);
  root.document.addEventListener('nw:project:changed',()=>root.setTimeout(inject,0));
}
})(typeof window!=='undefined'?window:globalThis);
