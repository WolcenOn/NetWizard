/* NetWizard Field Execution UX v2
 * Canonical execution evidence is persisted under workflow.interventionExecution.
 */
(function initNetWizardFieldExecution(root){
'use strict';

const arr=v=>Array.isArray(v)?v:[];
const obj=v=>v&&typeof v==='object'&&!Array.isArray(v)?v:{};
const clean=v=>String(v==null?'':v).trim();
const state=()=>root.NetWizardState||null;
const model=()=>root.NetWizardInterventionExecution||null;
const doc=()=>root.document||null;
const LEGACY_PREFIX='nwp_field_execution_v1:';

function make(tag,cls,text){
  const d=doc(),n=d.createElement(tag);
  if(cls)n.className=cls;
  if(text!=null)n.textContent=String(text);
  return n;
}
function snapshot(){return state()?.getSnapshot?.()||{};}
function clone(v){return JSON.parse(JSON.stringify(v==null?{}:v));}
function projectKey(project){
  const w=obj(project&&project.workflow),d=obj(w.derivedFrom);
  return [
    clean(project&&project.projName)||'netwizard',
    clean(d.snapshotId)||clean(d.sourceProjectName)||'source',
    clean(w.interventionBaseline&&w.interventionBaseline.capturedAt)||'baseline'
  ].join('|');
}
function legacyProgress(project){
  try{
    const raw=root.localStorage&&root.localStorage.getItem(LEGACY_PREFIX+projectKey(project));
    return raw?obj(JSON.parse(raw)):{};
  }catch(_e){return{};}
}
function updateProject(mutator,source){
  const S=state();if(!S||typeof S.updateProject!=='function')return false;
  S.updateProject(mutator,{source:source||'field-execution-v2'});return true;
}
function setTechnician(value){
  updateProject(project=>{
    const p=clone(project),w=obj(p.workflow),rec=model().record(p);
    p.workflow=Object.assign({},w,{interventionExecution:Object.assign({},rec,{technician:clean(value),startedAt:rec.startedAt||new Date().toISOString()})});
    return{workflow:p.workflow};
  },'field-execution-technician');
}
function setAction(actionId,patch){
  updateProject(project=>{
    const next=model().setAction(project,actionId,patch);
    const rec=obj(next.workflow.interventionExecution);
    if(!rec.startedAt)rec.startedAt=new Date().toISOString();
    return{workflow:next.workflow};
  },'field-execution-action');
}
function saveAcceptance(values){
  updateProject(project=>{
    const next=model().acceptedRecord(project,values);
    return{workflow:next.workflow};
  },'field-execution-acceptance');
}
function migrateLegacy(project){
  const legacy=legacyProgress(project),keys=Object.keys(legacy);
  if(!keys.length)return false;
  const execution=model().build(project);if(!execution.ok)return false;
  let changed=false,next=clone(project);
  for(const [legacyKey,saved] of Object.entries(legacy)){
    const hit=execution.items.find(item=>{
      const fields=[clean(item.type),clean(item.category),clean(item.deviceId),clean(item.rackId),clean(item.pduId),clean(item.powerConnectionId),clean(item.cableRunId),clean(item.patchConnectionId),clean(item.hostOutletConnectionId),clean(item.originRef),clean(item.currentId),clean(item.title),clean(item.details)];
      return fields.filter(Boolean).every(value=>legacyKey.includes(value));
    });
    if(!hit)continue;
    const patch={status:saved&&saved.done===true?'done':'pending',note:clean(saved&&saved.note)};
    if(patch.status==='done'){patch.completedAt=new Date().toISOString();patch.completedBy=model().record(next).technician||'Migrado desde progreso local';}
    next=model().setAction(next,hit.actionId,patch);changed=true;
  }
  if(!changed)return false;
  updateProject(()=>({workflow:next.workflow}),'field-execution-legacy-migration');
  try{root.localStorage&&root.localStorage.removeItem(LEGACY_PREFIX+projectKey(project));}catch(_e){}
  return true;
}
function evidenceText(item){return arr(item.evidenceRefs).join(', ');}
function render(project){
  const M=model(),execution=M&&M.build?M.build(project):null,card=make('div','card nw-card-wide'),head=make('div','card-h');
  head.append(make('div','card-t','🧰 Ejecución de campo & aceptación'));card.append(head);
  if(!execution||!execution.ok){card.append(make('div','co co-yw',execution&&execution.message||'No hay intervención ejecutable.'));return card;}
  const rec=execution.record,badge=make('span','b bac',execution.counts.done+'/'+execution.counts.total+' · '+execution.counts.percent+'%');head.append(badge);
  card.append(make('p','hint','La evidencia queda dentro del proyecto: técnico, estado, hora, notas y referencias de fotos/tickets/tests. No modifica la intención To-Be; documenta lo realmente ejecutado.'));

  const top=make('div','g2'),tech=make('input'),started=make('input');
  tech.id='fieldExecutionTechnician';tech.placeholder='Técnico / responsable';tech.value=rec.technician||'';
  started.disabled=true;started.value=rec.startedAt||'Pendiente de inicio';
  const techW=make('div'),techL=make('label','fl','Técnico / responsable');techL.htmlFor=tech.id;techW.append(techL,tech);
  const startW=make('div'),startL=make('label','fl','Inicio registrado');startW.append(startL,started);top.append(techW,startW);card.append(top);
  tech.onchange=()=>setTechnician(tech.value);

  const legacy=legacyProgress(project);
  if(Object.keys(legacy).length&&!Object.keys(rec.actions||{}).length){
    const box=make('div','co co-ac','Se detectó progreso local de la versión anterior.');
    const btn=make('button','btn bs bsm','Migrar progreso local');btn.type='button';btn.onclick=()=>migrateLegacy(snapshot());box.append(' ',btn);card.append(box);
  }

  const filterRow=make('div','brow'),filter=make('select');
  [['pending','Pendientes/bloqueadas'],['all','Todas'],['done','Completadas']].forEach(([v,l])=>{const o=make('option','',l);o.value=v;filter.append(o);});
  filterRow.append(filter);card.append(filterRow);

  const list=make('div');list.id='fieldExecutionList';card.append(list);
  function draw(){
    const current=M.build(snapshot()),mode=filter.value||'pending';list.textContent='';
    badge.textContent=current.counts.done+'/'+current.counts.total+' · '+current.counts.percent+'%';
    const visible=current.items.filter(x=>mode==='all'||(mode==='done'?x.status==='done':x.status!=='done'));
    if(!visible.length){list.append(make('div','hint',mode==='pending'?'No quedan acciones pendientes.':'No hay acciones en este filtro.'));return;}
    for(const item of visible){
      const row=make('div','card');row.style.margin='8px 0';row.dataset.executionActionId=item.actionId;
      const title=make('div','row');title.append(make('b','',item.order+'. '+(item.title||item.type)),make('span','b '+(item.status==='done'?'bgr':item.status==='blocked'?'brd':'bac'),item.status.toUpperCase()));row.append(title);
      if(item.details)row.append(make('div','hint',item.details));
      const grid=make('div','g2');
      const status=make('select'),note=make('input'),evidence=make('input'),completedBy=make('input');
      [['pending','Pendiente'],['done','Completada'],['blocked','Bloqueada']].forEach(([v,l])=>{const o=make('option','',l);o.value=v;status.append(o);});status.value=item.status;
      note.placeholder='Nota de campo';note.value=item.note||'';
      evidence.placeholder='Evidencia: foto-123, ticket-456, test-ping...';evidence.value=evidenceText(item);
      completedBy.placeholder='Ejecutado por';completedBy.value=item.completedBy||rec.technician||'';
      for(const [label,control] of [['Estado',status],['Ejecutado por',completedBy],['Nota',note],['Referencias de evidencia',evidence]]){const w=make('div');w.append(make('label','fl',label),control);grid.append(w);}
      row.append(grid);
      const save=()=>{
        const currentStatus=status.value,wasDone=item.status==='done';
        setAction(item.actionId,{
          status:currentStatus,
          completedBy:clean(completedBy.value)||clean(tech.value),
          completedAt:currentStatus==='done'?(wasDone&&item.completedAt?item.completedAt:new Date().toISOString()):'',
          note:clean(note.value),
          evidenceRefs:String(evidence.value||'').split(/[,;\n]+/).map(clean).filter(Boolean)
        });
      };
      status.onchange=save;note.onchange=save;evidence.onchange=save;completedBy.onchange=save;list.append(row);
    }
  }
  filter.onchange=draw;draw();

  const acceptance=obj(rec.acceptance),acc=make('div','card');acc.id='fieldAcceptanceCard';acc.style.marginTop='12px';
  acc.append(make('div','card-t','✅ Criterios de aceptación / cierre'));
  const checks=[
    ['connectivityVerified','Conectividad post-change validada'],
    ['labelsVerified','Etiquetado y documentación física verificados'],
    ['asBuiltReviewed','As-Built revisado contra lo ejecutado'],
    ['requireClientAcceptance','Exigir aceptación del cliente'],
    ['clientAccepted','Cliente / responsable receptor acepta el resultado']
  ];
  const controls={};
  checks.forEach(([key,label])=>{const line=make('label');line.style.cssText='display:flex;gap:8px;align-items:center;margin:7px 0';const cb=make('input');cb.type='checkbox';cb.checked=acceptance[key]===true;controls[key]=cb;line.append(cb,make('span','',label));acc.append(line);});
  const aw=make('div','g2'),acceptedBy=make('input'),acceptNote=make('input');
  acceptedBy.id='fieldAcceptanceBy';acceptedBy.placeholder='Responsable de aceptación';acceptedBy.value=acceptance.acceptedBy||rec.technician||'';
  acceptNote.placeholder='Nota de aceptación / acta / ticket';acceptNote.value=acceptance.note||'';
  for(const [label,control] of [['Aceptado por',acceptedBy],['Nota / referencia',acceptNote]]){const w=make('div');w.append(make('label','fl',label),control);aw.append(w);}acc.append(aw);
  const saveAcc=make('button','btn bp','💾 Guardar criterios de aceptación');saveAcc.type='button';
  saveAcc.onclick=()=>saveAcceptance({
    connectivityVerified:controls.connectivityVerified.checked,
    labelsVerified:controls.labelsVerified.checked,
    asBuiltReviewed:controls.asBuiltReviewed.checked,
    requireClientAcceptance:controls.requireClientAcceptance.checked,
    clientAccepted:controls.clientAccepted.checked,
    acceptedBy:acceptedBy.value,note:acceptNote.value
  });
  acc.append(saveAcc);
  const report=M.acceptanceChecks(project),summary=make('div','co '+(report.ready?'co-gn':'co-rd'),report.ready?'Cierre preparado: ejecución y aceptación completas.':'Cierre bloqueado: '+report.counts.blocking+' requisito(s) pendiente(s).');summary.style.marginTop='8px';acc.append(summary);
  for(const issue of arr(report.issues).slice(0,8))acc.append(make('div','hint','• '+issue.message));
  for(const warning of arr(report.warnings).slice(0,5))acc.append(make('div','hint','⚠ '+warning.message));
  card.append(acc);
  return card;
}
function isApplicable(project){return !!(model()&&model().isApplicable&&model().isApplicable(project));}
function build(project){return model()?.build?.(project)||{ok:false,items:[],counts:{total:0,done:0,pending:0,blocked:0,percent:0}};}
function inject(){
  const d=doc();if(!d)return;
  let mount=d.getElementById('fieldExecutionMount');
  if(!mount){
    const host=d.getElementById('pg-physical');if(!host)return;
    mount=d.createElement('div');mount.id='fieldExecutionMount';
    const anchor=d.getElementById('physicalInterventionPlanMount');
    if(anchor&&anchor.parentNode===host)host.insertBefore(mount,anchor.nextSibling);else host.append(mount);
  }
  mount.textContent='';const project=snapshot();if(isApplicable(project))mount.append(render(project));
}
const api={version:'netwizard-field-execution-v2',projectKey,legacyProgress,migrateLegacy,build,isApplicable,render,inject,setTechnician,setAction,saveAcceptance};
root.NetWizardFieldExecution=api;
if(typeof module!=='undefined'&&module.exports)module.exports=api;
if(root.document){
  const active=()=>root.document.getElementById('pg-physical')?.classList.contains('on');
  const refresh=()=>{if(active())root.setTimeout(inject,0);};
  if(root.document.readyState==='loading')root.document.addEventListener('DOMContentLoaded',refresh);else refresh();
  root.document.addEventListener('nw:project:changed',refresh);
  root.document.addEventListener('nw:view:changed',event=>{if(event.detail?.step==='physical')root.setTimeout(inject,0);});
}
})(typeof window!=='undefined'?window:globalThis);
