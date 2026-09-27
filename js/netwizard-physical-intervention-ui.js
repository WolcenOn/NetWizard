/* NetWizard Physical Intervention Plan UI v1 */
(function initNetWizardPhysicalInterventionUi(root){
'use strict';

const arr=v=>Array.isArray(v)?v:[];
const obj=v=>v&&typeof v==='object'&&!Array.isArray(v)?v:{};
const state=()=>root.NetWizardState||null;
const planner=()=>root.NetWizardPhysicalInterventionPlan||null;
const doc=()=>root.document||null;

function make(tag,cls,text){
  const d=doc(),n=d.createElement(tag);
  if(cls)n.className=cls;
  if(text!=null)n.textContent=String(text);
  return n;
}
function snapshot(){return state()?.getSnapshot?.()||{};}
function isApplicable(project){
  const w=obj(project&&project.workflow);
  return w.mode==='design'&&obj(w.derivedFrom).type==='inventory'&&obj(w.interventionBaseline).version==='netwizard-physical-intervention-baseline-v1';
}
function categoryLabel(value){
  return {device:'Equipo',rack:'Rack',pdu:'PDU',power:'Alimentación',cable:'Cableado',patch:'Patch rack','host-patch':'Patch usuario'}[value]||value;
}
function typeLabel(value){
  return {
    'add-device':'Instalar equipo','retire-device':'Retirar equipo','replace-device':'Reemplazar equipo','move-device':'Mover equipo',
    'add-rack':'Instalar rack','remove-rack':'Retirar rack','modify-rack':'Modificar rack',
    'add-pdu':'Instalar PDU','remove-pdu':'Retirar PDU','modify-pdu':'Modificar PDU',
    'connect-power':'Conectar alimentación','disconnect-power':'Desconectar alimentación','reconnect-power':'Reconectar alimentación',
    'install-cable':'Instalar cable','remove-cable':'Retirar cable','replace-or-reroute-cable':'Sustituir/reencaminar cable',
    'add-patch':'Añadir latiguillo','remove-patch':'Retirar latiguillo','repatch':'Repatch',
    'add-host-patch':'Conectar host','remove-host-patch':'Desconectar host','repatch-host':'Reconectar host'
  }[value]||value;
}
function render(project){
  const P=planner(),plan=P&&P.buildChecklist?P.buildChecklist(project):null;
  const card=make('div','card nw-card-wide');
  const head=make('div','card-h');
  head.append(make('div','card-t','🛠 Plan de intervención física'));
  card.append(head);
  if(!plan||!plan.ok){
    card.append(make('div','co co-yw',plan&&plan.message||'No existe una línea base física para comparar.'));
    return card;
  }
  const c=plan.counts||{};
  head.append(make('span','b bac',`${c.total||0} acciones`));
  card.append(make('p','hint','Se calcula automáticamente comparando el Diseño To-Be con la línea base As-Built. Edita racks, equipos, PDU o cableado normalmente; el plan se actualiza solo.'));

  const stats=make('div','stats');
  for(const [v,l] of [[c.devices,'Equipos'],[c.racks,'Racks'],[c.pdus,'PDU'],[c.power,'Alimentación'],[c.cabling,'Cableado']]){
    const x=make('div');x.append(make('b','',v||0),make('span','',l));stats.append(x);
  }
  card.append(stats);

  if(!arr(plan.actions).length){
    card.append(make('div','co co-gn','No hay diferencias físicas entre el As-Built y el To-Be.'));
    return card;
  }

  const wrap=make('div','tw'),table=make('table');
  const thead=make('thead'),hr=make('tr');
  ['#','Área','Acción','Elemento / detalle'].forEach(x=>hr.append(make('th','',x)));thead.append(hr);table.append(thead);
  const tbody=make('tbody');
  arr(plan.actions).forEach((a,index)=>{
    const tr=make('tr');
    tr.append(make('td','mono',String(index+1)));
    tr.append(make('td','',categoryLabel(a.category)));
    tr.append(make('td','',typeLabel(a.type)));
    const detail=make('td');detail.append(make('b','',a.title||a.type));
    if(a.details)detail.append(make('div','hint',a.details));
    tr.append(detail);tbody.append(tr);
  });
  table.append(tbody);wrap.append(table);card.append(wrap);

  const note=make('div','co co-ac','Orden orientativo: desconexiones/retiradas → movimientos/instalación → cableado/patching → reconexión eléctrica. La secuencia debe revisarse antes de ejecutar trabajos en campo.');
  card.append(note);
  return card;
}
function inject(){
  const d=doc();if(!d)return;
  let mount=d.getElementById('physicalInterventionPlanMount');
  if(!mount){
    const host=d.getElementById('pg-physical');
    if(!host)return;
    mount=d.createElement('div');mount.id='physicalInterventionPlanMount';
    const anchor=d.getElementById('inventoryGoldenPathMount');
    if(anchor&&anchor.parentNode===host)host.insertBefore(mount,anchor.nextSibling);
    else host.append(mount);
  }
  mount.textContent='';
  const project=snapshot();
  if(isApplicable(project))mount.append(render(project));
}
const api={version:'netwizard-physical-intervention-ui-v1',isApplicable,render,inject};
root.NetWizardPhysicalInterventionUi=api;
if(typeof module!=='undefined'&&module.exports)module.exports=api;
if(root.document){
  if(root.document.readyState==='loading')root.document.addEventListener('DOMContentLoaded',()=>root.setTimeout(inject,0));
  else root.setTimeout(inject,0);
  root.document.addEventListener('nw:project:changed',()=>root.setTimeout(inject,0));
}
})(typeof window!=='undefined'?window:globalThis);
