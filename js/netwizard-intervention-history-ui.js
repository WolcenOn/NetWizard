/* NetWizard Intervention History UI v1 */
(function initNetWizardInterventionHistoryUi(root){
'use strict';

const arr=v=>Array.isArray(v)?v:[];
const doc=()=>root.document||null;
const journal=()=>root.NetWizardInterventionHistory||null;

function make(tag,cls,text){
  const d=doc(),n=d.createElement(tag);
  if(cls)n.className=cls;
  if(text!=null)n.textContent=String(text);
  return n;
}
function formatDate(value){
  if(!value)return '—';
  try{return new Date(value).toLocaleString();}catch(_e){return String(value);}
}
function render(){
  const J=journal(),card=make('div','card nw-card-wide');
  const data=J&&J.build?J.build():{count:0,entries:[]};
  const head=make('div','card-h');
  head.append(make('div','card-t','🧾 Historial de intervenciones'),make('span','b bac',String(data.count||0)));
  card.append(head);
  card.append(make('p','hint','Journal derivado de snapshots y procedencia de cierre. No duplica inventarios ni crea un tercer modo de workflow.'));

  if(!data.count){
    card.append(make('div','empty','Todavía no hay intervenciones cerradas registradas en el historial disponible.'));
    return card;
  }

  const wrap=make('div','tw'),table=make('table');
  const thead=make('thead'),trh=make('tr');
  ['Cierre','Origen As-Built','Diseño ejecutado','Acciones','Aceptación','Resultado'].forEach(x=>trh.append(make('th','',x)));
  thead.append(trh);table.append(thead);
  const tbody=make('tbody');
  for(const e of arr(data.entries)){
    const tr=make('tr');
    const date=make('td','mono',formatDate(e.closedAt));tr.append(date);
    tr.append(make('td','',e.sourceProjectName||e.sourceInventorySnapshotId||'—'));
    tr.append(make('td','',e.designProjectName||e.designSnapshotId||'—'));
    tr.append(make('td','',String(e.completedActionCount||e.interventionActionCount||0)+'/'+String(e.interventionActionCount||0)));
    const acceptance=make('td');acceptance.append(make('b','',e.acceptedBy||'—'));
    if(e.evidenceCount!=null)acceptance.append(make('div','hint','Evidencias: '+String(e.evidenceCount||0)));
    if(e.observedAt)acceptance.append(make('div','hint','Observed '+formatDate(e.observedAt)));
    tr.append(acceptance);
    const result=make('td');
    result.append(make('b','',e.resultingProjectName||'As-Built actualizado'));
    if(e.current)result.append(make('div','hint','Estado actual'));
    else if(e.snapshotLabel)result.append(make('div','hint',e.snapshotLabel));
    tr.append(result);
    tbody.append(tr);
  }
  table.append(tbody);wrap.append(table);card.append(wrap);
  return card;
}
function inject(){
  const d=doc();if(!d)return;
  const host=d.getElementById('pg-physical');if(!host)return;
  let mount=d.getElementById('interventionHistoryMount');
  if(!mount){
    mount=d.createElement('div');mount.id='interventionHistoryMount';
    const anchor=d.getElementById('interventionCloseoutMount');
    if(anchor&&anchor.parentNode===host)host.insertBefore(mount,anchor.nextSibling);
    else host.append(mount);
  }
  mount.textContent='';
  mount.append(render());
}
const api={version:'netwizard-intervention-history-ui-v2',render,inject};
root.NetWizardInterventionHistoryUi=api;
if(typeof module!=='undefined'&&module.exports)module.exports=api;
if(root.document){
  if(root.document.readyState==='loading')root.document.addEventListener('DOMContentLoaded',()=>root.setTimeout(inject,0));
  else root.setTimeout(inject,0);
  root.document.addEventListener('nw:project:changed',()=>root.setTimeout(inject,0));
  root.document.addEventListener('nw:history:changed',()=>root.setTimeout(inject,0));
}
})(typeof window!=='undefined'?window:globalThis);
