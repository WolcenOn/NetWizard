/* NetWizard Intervention Closeout UI v1 */
(function initNetWizardInterventionCloseoutUi(root){
'use strict';

const obj=v=>v&&typeof v==='object'&&!Array.isArray(v)?v:{};
const arr=v=>Array.isArray(v)?v:[];
const state=()=>root.NetWizardState||null;
const closeout=()=>root.NetWizardInterventionCloseout||null;
const history=()=>root.NetWizardHistory||null;
const gate=()=>root.NetWizardInventoryGate||null;
const schema=()=>root.NetWizardProjectSchema||null;
const doc=()=>root.document||null;

function make(tag,cls,text){
  const d=doc(),n=d.createElement(tag);
  if(cls)n.className=cls;
  if(text!=null)n.textContent=String(text);
  return n;
}
function snapshot(){return state()?.getSnapshot?.()||{};}
function validateCandidate(project){
  const C=closeout(),G=gate(),S=schema();
  const built=C&&C.buildUpdatedAsBuilt?C.buildUpdatedAsBuilt(project,{closedAt:new Date().toISOString()}):null;
  if(!built||!built.ok)return{ok:false,built,gate:null,schema:null};
  const gateReport=G&&G.validate?G.validate(built.project):null;
  const schemaReport=S&&S.validateProject?S.validateProject(built.project):null;
  const schemaErrors=arr(schemaReport&&schemaReport.errors);
  const blocking=Number(gateReport&&gateReport.counts&&gateReport.counts.blocking||0);
  return{ok:blocking===0&&schemaErrors.length===0,built,gate:gateReport,schema:schemaReport};
}
function closeIntervention(){
  const S=state(),C=closeout(),H=history(),current=snapshot();
  if(!S||!C||!H)return root.alert&&root.alert('No están disponibles los servicios necesarios para cerrar la intervención.');

  const preview=validateCandidate(current);
  if(!preview.built||!preview.built.ok){
    const errors=arr(preview.built&&preview.built.errors).map(x=>x.message).filter(Boolean);
    return root.alert&&root.alert([preview.built&&preview.built.message||'No se puede cerrar la intervención.',...errors.slice(0,5)].join('\n'));
  }
  const schemaErrors=arr(preview.schema&&preview.schema.errors);
  const blocking=Number(preview.gate&&preview.gate.counts&&preview.gate.counts.blocking||0);
  if(schemaErrors.length||blocking){
    const details=[
      blocking?`Inventory Gate: ${blocking} bloqueo(s).`:null,
      ...schemaErrors.slice(0,5)
    ].filter(Boolean);
    return root.alert&&root.alert(['El As-Built candidato todavía no es válido.',...details].join('\n'));
  }

  const warnings=Number(preview.gate&&preview.gate.counts&&preview.gate.counts.warnings||0);
  const removed=preview.built.removed||{};
  const msg=[
    'Vas a cerrar la intervención y convertir este To-Be en un As-Built actualizado.',
    '',
    'Confirma que el proyecto refleja lo realmente ejecutado en campo.',
    'NetWizard no marcará datos como observados automáticamente.',
    '',
    `Acciones del plan: ${preview.built.summary.interventionActionCount||0}`,
    `Equipos retirados/reemplazados que salen del As-Built: ${preview.built.summary.removedDevices||0}`,
    `Puertos dependientes eliminados: ${preview.built.summary.removedPorts||0}`,
    warnings?`Avisos documentales del Inventory Gate: ${warnings}`:null,
    (removed.links||removed.rackItems||removed.powerConnections||removed.patchConnections)
      ?`Referencias dependientes limpiadas: enlaces ${removed.links||0}, rack ${removed.rackItems||0}, alimentación ${removed.powerConnections||0}, patch ${removed.patchConnections||0}.`
      :null,
    '',
    'Antes del cierre se guardará un snapshot restaurable del Diseño To-Be.',
    '',
    '¿Cerrar intervención?'
  ].filter(Boolean).join('\n');
  if(root.confirm&&!root.confirm(msg))return;

  const snap=H.createSnapshot('Diseño To-Be antes del cierre · '+(current.projName||'NetWizard'),{
    source:'intervention-closeout',
    project:current
  });
  const result=C.buildUpdatedAsBuilt(current,{designSnapshotId:snap.id,closedAt:snap.ts});
  if(!result.ok)return root.alert&&root.alert(result.message||'No se pudo crear el As-Built actualizado.');

  const finalGate=gate()&&gate().validate?gate().validate(result.project):null;
  const finalSchema=schema()&&schema().validateProject?schema().validateProject(result.project):null;
  if(Number(finalGate&&finalGate.counts&&finalGate.counts.blocking||0)||arr(finalSchema&&finalSchema.errors).length){
    return root.alert&&root.alert('El cierre fue cancelado porque la validación final del As-Built no es válida.');
  }

  S.replaceProject(result.project,{source:'intervention-closeout'});
  if(typeof root.navTo==='function')root.navTo('physical');
}
function render(project){
  const preview=validateCandidate(project),card=make('div','card nw-card-wide');
  const head=make('div','card-h');head.append(make('div','card-t','✅ Cierre de intervención'));card.append(head);
  card.append(make('p','hint','Cuando el Diseño To-Be ya coincide con lo ejecutado en campo, puedes convertirlo en el nuevo Inventario As-Built. Se guardará antes un snapshot restaurable del diseño.'));

  if(!preview.built||!preview.built.ok){
    card.append(make('div','co co-rd',preview.built&&preview.built.message||'No se puede preparar el cierre.'));
    for(const error of arr(preview.built&&preview.built.errors).slice(0,6))card.append(make('div','hint','• '+(error.message||error.code)));
    return card;
  }

  const gateReport=preview.gate||{counts:{}},schemaErrors=arr(preview.schema&&preview.schema.errors);
  const blocking=Number(gateReport.counts&&gateReport.counts.blocking||0),warnings=Number(gateReport.counts&&gateReport.counts.warnings||0);
  const fieldExecution=root.NetWizardFieldExecution&&typeof root.NetWizardFieldExecution.build==='function'?root.NetWizardFieldExecution.build(project):null;
  const fieldCounts=fieldExecution&&fieldExecution.ok?fieldExecution.counts:null;
  head.append(make('span','b '+(preview.ok?'bac':'brd'),preview.ok?'Listo':'Revisar'));

  const stats=make('div','stats');
  for(const [v,l] of [
    [preview.built.summary.interventionActionCount||0,'Acciones'],
    [preview.built.summary.removedDevices||0,'Equipos que salen'],
    [preview.built.summary.removedPorts||0,'Puertos que salen'],
    [fieldCounts?`${fieldCounts.done}/${fieldCounts.total}`:'—','Campo'],
    [blocking,'Bloqueos'],
    [warnings,'Avisos']
  ]){
    const x=make('div');x.append(make('b','',v),make('span','',l));stats.append(x);
  }
  card.append(stats);

  if(blocking||schemaErrors.length){
    card.append(make('div','co co-rd',`No se puede cerrar todavía: ${blocking} bloqueo(s) físicos y ${schemaErrors.length} error(es) de contrato.`));
  }else if(fieldCounts&&fieldCounts.pending){
    card.append(make('div','co co-ac',`Progreso de campo: ${fieldCounts.done}/${fieldCounts.total}. Quedan ${fieldCounts.pending} acción(es) sin marcar. Esto no bloquea el cierre: confirma que el To-Be refleja lo realmente ejecutado.`));
  }else if(warnings){
    card.append(make('div','co co-yw',`El cierre es posible, pero quedan ${warnings} aviso(s) documentales. Revisa que sean aceptables.`));
  }else{
    card.append(make('div','co co-gn','El As-Built candidato no tiene bloqueos físicos ni errores de contrato.'));
  }

  const row=make('div','brow'),btn=make('button','btn bp','✅ Cerrar intervención → As-Built');
  btn.type='button';btn.disabled=!preview.ok;btn.onclick=closeIntervention;row.append(btn);card.append(row);
  return card;
}
function inject(){
  const d=doc();if(!d)return;
  let mount=d.getElementById('interventionCloseoutMount');
  if(!mount){
    const host=d.getElementById('pg-physical');if(!host)return;
    mount=d.createElement('div');mount.id='interventionCloseoutMount';
    const anchor=d.getElementById('physicalInterventionPlanMount');
    if(anchor&&anchor.parentNode===host)host.insertBefore(mount,anchor.nextSibling);
    else host.append(mount);
  }
  mount.textContent='';
  const project=snapshot();
  if(closeout()&&closeout().isDerivedDesign&&closeout().isDerivedDesign(project))mount.append(render(project));
}
const api={version:'netwizard-intervention-closeout-ui-v1',validateCandidate,closeIntervention,render,inject};
root.NetWizardInterventionCloseoutUi=api;
if(typeof module!=='undefined'&&module.exports)module.exports=api;
if(root.document){
  if(root.document.readyState==='loading')root.document.addEventListener('DOMContentLoaded',()=>root.setTimeout(inject,0));
  else root.setTimeout(inject,0);
  root.document.addEventListener('nw:project:changed',()=>root.setTimeout(inject,0));
}
})(typeof window!=='undefined'?window:globalThis);
