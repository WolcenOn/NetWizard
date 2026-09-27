/* NetWizard Field Execution UX v1
 * UI-only execution progress derived from the intervention checklist.
 * Progress lives in localStorage and never mutates the project/To-Be.
 */
(function initNetWizardFieldExecution(root){
'use strict';

const arr=v=>Array.isArray(v)?v:[];
const obj=v=>v&&typeof v==='object'&&!Array.isArray(v)?v:{};
const clean=v=>String(v==null?'':v).trim();
const state=()=>root.NetWizardState||null;
const planner=()=>root.NetWizardPhysicalInterventionPlan||null;
const doc=()=>root.document||null;
const STORAGE_PREFIX='nwp_field_execution_v1:';

function make(tag,cls,text){
  const d=doc(),n=d.createElement(tag);
  if(cls)n.className=cls;
  if(text!=null)n.textContent=String(text);
  return n;
}
function snapshot(){return state()?.getSnapshot?.()||{};}
function projectKey(project){
  const w=obj(project&&project.workflow),d=obj(w.derivedFrom);
  return [
    clean(project&&project.projName)||'netwizard',
    clean(d.snapshotId)||clean(d.sourceProjectName)||'source',
    clean(w.interventionBaseline&&w.interventionBaseline.capturedAt)||'baseline'
  ].join('|');
}
function actionKey(action,index){
  const a=action||{};
  return [
    clean(a.type),clean(a.category),clean(a.deviceId),clean(a.rackId),clean(a.pduId),
    clean(a.powerConnectionId),clean(a.cableRunId),clean(a.patchConnectionId),clean(a.hostOutletConnectionId),
    clean(a.originRef),clean(a.currentId),clean(a.title),clean(a.details),String(index)
  ].join('|');
}
function loadProgress(project){
  try{
    const raw=root.localStorage&&root.localStorage.getItem(STORAGE_PREFIX+projectKey(project));
    const value=raw?JSON.parse(raw):{};
    return obj(value);
  }catch(_e){return{};}
}
function saveProgress(project,progress){
  try{
    if(root.localStorage)root.localStorage.setItem(STORAGE_PREFIX+projectKey(project),JSON.stringify(obj(progress)));
    return true;
  }catch(_e){return false;}
}
function clearProgress(project){
  try{
    if(root.localStorage)root.localStorage.removeItem(STORAGE_PREFIX+projectKey(project));
    return true;
  }catch(_e){return false;}
}
function build(project){
  const P=planner(),plan=P&&P.buildChecklist?P.buildChecklist(project):null;
  if(!plan||!plan.ok)return{ok:false,message:plan&&plan.message||'No hay intervención ejecutable.',items:[],counts:{total:0,done:0,pending:0,percent:0}};
  const progress=loadProgress(project),items=arr(plan.actions).map((action,index)=>{
    const key=actionKey(action,index),saved=obj(progress[key]);
    return Object.assign({},action,{order:index+1,executionKey:key,done:saved.done===true,note:clean(saved.note)});
  });
  const done=items.filter(x=>x.done).length,total=items.length;
  return{ok:true,items,counts:{total,done,pending:total-done,percent:total?Math.round(done*100/total):100}};
}
function updateItem(project,key,patch){
  const progress=loadProgress(project),current=obj(progress[key]);
  progress[key]=Object.assign({},current,patch||{});
  saveProgress(project,progress);
  return build(project);
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
  }[value]||value||'Acción';
}
function categoryLabel(value){
  return {device:'Equipo',rack:'Rack',pdu:'PDU',power:'Alimentación',cable:'Cableado',patch:'Patch rack','host-patch':'Patch usuario'}[value]||value||'General';
}
function render(project){
  const execution=build(project),card=make('div','card nw-card-wide'),head=make('div','card-h');
  head.append(make('div','card-t','🧰 Modo ejecución en campo'));card.append(head);
  if(!execution.ok){card.append(make('div','co co-yw',execution.message));return card;}
  const badge=make('span','b bac',`${execution.counts.done}/${execution.counts.total} · ${execution.counts.percent}%`);head.append(badge);
  card.append(make('p','hint','Marca acciones mientras trabajas en campo. Este progreso es auxiliar y local al navegador: no modifica el Diseño To-Be ni convierte datos deseados en observados.'));

  const controls=make('div','brow');
  const filter=make('select');filter.id='fieldExecutionFilter';
  [['pending','Pendientes'],['all','Todas'],['done','Completadas']].forEach(([v,l])=>{const o=make('option','',l);o.value=v;filter.append(o);});
  const reset=make('button','btn bs','↺ Reiniciar progreso');reset.type='button';
  controls.append(filter,reset);card.append(controls);

  const progress=make('div','co '+(execution.counts.pending?'co-ac':'co-gn'),
    execution.counts.pending?`${execution.counts.pending} acción(es) pendientes de confirmar en campo.`:'Checklist de campo completado. El cierre As-Built sigue requiriendo confirmación explícita.');
  card.append(progress);

  const list=make('div');list.id='fieldExecutionList';card.append(list);
  function draw(){
    const current=build(project),mode=filter.value||'pending';list.textContent='';
    badge.textContent=`${current.counts.done}/${current.counts.total} · ${current.counts.percent}%`;
    progress.className='co '+(current.counts.pending?'co-ac':'co-gn');
    progress.textContent=current.counts.pending?`${current.counts.pending} acción(es) pendientes de confirmar en campo.`:'Checklist de campo completado. El cierre As-Built sigue requiriendo confirmación explícita.';
    const visible=current.items.filter(x=>mode==='all'||(mode==='done'?x.done:!x.done));
    if(!visible.length){list.append(make('div','hint',mode==='pending'?'No quedan acciones pendientes.':'No hay acciones en este filtro.'));return;}
    for(const item of visible){
      const row=make('div','card');row.style.margin='8px 0';row.dataset.executionKey=item.executionKey;
      const top=make('div','row');
      const left=make('label');left.style.display='flex';left.style.gap='10px';left.style.alignItems='flex-start';left.style.cursor='pointer';
      const cb=make('input');cb.type='checkbox';cb.checked=item.done;cb.style.width='22px';cb.style.height='22px';cb.dataset.fieldExecutionDone=item.executionKey;
      const text=make('div');text.append(make('b','',`${item.order}. ${typeLabel(item.type)}`),make('div','hint',`${categoryLabel(item.category)} · ${item.title||item.type}`));
      if(item.details)text.append(make('div','hint',item.details));
      left.append(cb,text);top.append(left);row.append(top);
      const note=make('input');note.type='text';note.placeholder='Nota de campo (opcional)';note.value=item.note||'';note.dataset.fieldExecutionNote=item.executionKey;row.append(note);
      cb.onchange=()=>{updateItem(project,item.executionKey,{done:cb.checked,note:note.value});draw();};
      note.onchange=()=>{updateItem(project,item.executionKey,{done:cb.checked,note:note.value});};
      row.append(make('div','hint',item.done?'✓ Confirmada en este navegador':'Pendiente'));
      list.append(row);
    }
  }
  filter.onchange=draw;
  reset.onclick=()=>{if(root.confirm&&!root.confirm('¿Reiniciar todas las marcas y notas de ejecución de esta intervención?'))return;clearProgress(project);draw();};
  draw();
  return card;
}
function isApplicable(project){
  const w=obj(project&&project.workflow);
  return w.mode==='design'&&obj(w.derivedFrom).type==='inventory'&&obj(w.interventionBaseline).version==='netwizard-physical-intervention-baseline-v1';
}
function inject(){
  const d=doc();if(!d)return;
  let mount=d.getElementById('fieldExecutionMount');
  if(!mount){
    const host=d.getElementById('pg-physical');if(!host)return;
    mount=d.createElement('div');mount.id='fieldExecutionMount';
    const anchor=d.getElementById('physicalInterventionPlanMount');
    if(anchor&&anchor.parentNode===host)host.insertBefore(mount,anchor.nextSibling);
    else host.append(mount);
  }
  mount.textContent='';const project=snapshot();if(isApplicable(project))mount.append(render(project));
}
const api={version:'netwizard-field-execution-v1',projectKey,actionKey,loadProgress,saveProgress,clearProgress,build,updateItem,isApplicable,render,inject};
root.NetWizardFieldExecution=api;
if(typeof module!=='undefined'&&module.exports)module.exports=api;
if(root.document){
  if(root.document.readyState==='loading')root.document.addEventListener('DOMContentLoaded',()=>root.setTimeout(inject,0));
  else root.setTimeout(inject,0);
  root.document.addEventListener('nw:project:changed',()=>root.setTimeout(inject,0));
}
})(typeof window!=='undefined'?window:globalThis);
