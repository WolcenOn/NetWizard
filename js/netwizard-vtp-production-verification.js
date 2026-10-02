/* NetWizard VTP production verification v1
   Desired authority remains project.vtp.
   Observed evidence is stored under project.observedState.vtpDevices[deviceId].
*/
(function initNetWizardVtpProductionVerification(root){
'use strict';

const arr=v=>Array.isArray(v)?v:[];
const obj=v=>v&&typeof v==='object'&&!Array.isArray(v)?v:{};
const clean=v=>String(v==null?'':v).trim();
const integer=v=>{const n=Number(v);return Number.isInteger(n)&&n>=0?n:null;};
const activeRole=role=>['server','client','transparent'].includes(clean(role).toLowerCase());

function observedMap(project){
  return obj(obj(project&&project.observedState).vtpDevices);
}
function desiredRole(project,deviceId){
  return clean(obj(obj(project&&project.vtp).roles)[deviceId]).toLowerCase();
}
function serverIds(project){
  const roles=obj(obj(project&&project.vtp).roles);
  return arr(project&&project.devices)
    .filter(d=>d&&clean(d.vendorOs)==='cisco_ios'&&clean(d.kind||d.type).toLowerCase().includes('switch')&&clean(roles[d.id]).toLowerCase()==='server')
    .map(d=>clean(d.id)).filter(Boolean);
}
function evaluateDevice(project,deviceId){
  const p=obj(project),id=clean(deviceId),vtp=obj(p.vtp),role=desiredRole(p,id),observed=observedMap(p),evidence=obj(observed[id]),reasons=[];
  if(!activeRole(role))return{ok:true,status:'not-required',deviceId:id,role,reasons:[],evidence:null};
  if(!Object.keys(evidence).length){
    return{ok:false,status:'missing-observation',deviceId:id,role,evidence:null,reasons:[`VTP ${role} está activo, pero falta verificación observada del estado VTP para este switch.`]};
  }

  const desiredDomain=clean(vtp.domain),desiredVersion=clean(vtp.version);
  const actualDomain=clean(evidence.domain),actualVersion=clean(evidence.version),actualMode=clean(evidence.mode).toLowerCase();
  if(!desiredDomain)reasons.push('VTP está activo sin dominio explícito en el diseño.');
  if(actualDomain!==desiredDomain)reasons.push(`Dominio VTP observado "${actualDomain||'—'}" no coincide con el deseado "${desiredDomain||'—'}".`);
  if(actualVersion!==desiredVersion)reasons.push(`Versión VTP observada "${actualVersion||'—'}" no coincide con la deseada "${desiredVersion||'—'}".`);
  if(actualMode!==role)reasons.push(`Modo VTP observado "${actualMode||'—'}" no coincide con el rol deseado "${role}".`);
  if(integer(evidence.revision)===null)reasons.push('Configuration revision VTP observada ausente o inválida.');
  if(evidence.primaryConflict===true)reasons.push('Se ha observado conflicto de primary server VTPv3.');
  const digestErrors=integer(evidence.digestErrors),revisionErrors=integer(evidence.revisionErrors);
  if(digestErrors===null)reasons.push('Contador de errores digest VTP no verificado.');
  else if(digestErrors>0)reasons.push(`VTP presenta ${digestErrors} error(es) digest observados.`);
  if(revisionErrors===null)reasons.push('Contador de errores de revision VTP no verificado.');
  else if(revisionErrors>0)reasons.push(`VTP presenta ${revisionErrors} error(es) de revision observados.`);

  if(desiredVersion==='3'){
    const servers=serverIds(p),primaries=servers.filter(serverId=>obj(observed[serverId]).primary===true);
    if(servers.length&&primaries.length!==1){
      reasons.push(primaries.length===0
        ? 'VTPv3 requiere confirmar exactamente un primary server para el dominio antes del cambio.'
        : 'VTPv3 tiene más de un primary server marcado en la evidencia observada.');
    }
    if(role==='server'&&evidence.primary===true&&!clean(evidence.primaryId)){
      reasons.push('El primary server VTPv3 confirmado no tiene Primary ID observado.');
    }
  }

  return{ok:reasons.length===0,status:reasons.length?'review-required':'verified',deviceId:id,role,evidence,reasons};
}
function evaluateProject(project){
  const p=obj(project),roles=obj(obj(p.vtp).roles),results={};
  for(const id of Object.keys(roles))if(activeRole(roles[id]))results[id]=evaluateDevice(p,id);
  const failed=Object.values(results).filter(r=>!r.ok);
  return{ok:failed.length===0,results,failed};
}

function el(tag,attrs,text){
  const node=root.document.createElement(tag);
  Object.entries(attrs||{}).forEach(([k,v])=>{
    if(k==='className')node.className=v;
    else if(k==='htmlFor')node.htmlFor=v;
    else if(k==='checked')node.checked=!!v;
    else if(v!=null)node.setAttribute(k,String(v));
  });
  if(text!=null)node.textContent=String(text);
  return node;
}
function option(value,label){return el('option',{value},label);}
function state(){return root.NetWizardState&&root.NetWizardState.getSnapshot?root.NetWizardState.getSnapshot():{};}
function update(updater,source){
  if(!root.NetWizardState||typeof root.NetWizardState.updateProject!=='function')throw new Error('NetWizardState unavailable');
  return root.NetWizardState.updateProject(updater,{source:source||'vtp-production-verification'});
}
function input(id,label,type){
  const w=el('div'),n=el('input',{id,type:type||'text'});
  w.append(el('label',{className:'fl',htmlFor:id},label),n);return w;
}
function selectField(id,label,items){
  const w=el('div'),s=el('select',{id});
  items.forEach(([v,l])=>s.appendChild(option(v,l)));
  w.append(el('label',{className:'fl',htmlFor:id},label),s);return w;
}
function selectedId(){return clean(root.document.getElementById('vtpObsDevice')?.value);}
function paintForm(){
  const p=state(),id=selectedId(),ev=obj(observedMap(p)[id]);
  if(!id)return;
  root.document.getElementById('vtpObsDomain').value=clean(ev.domain)||clean(obj(p.vtp).domain);
  root.document.getElementById('vtpObsVersion').value=clean(ev.version)||clean(obj(p.vtp).version)||'3';
  root.document.getElementById('vtpObsMode').value=clean(ev.mode)||desiredRole(p,id)||'client';
  root.document.getElementById('vtpObsRevision').value=integer(ev.revision)===null?'':String(ev.revision);
  root.document.getElementById('vtpObsPrimary').value=ev.primary===true?'yes':'no';
  root.document.getElementById('vtpObsPrimaryId').value=clean(ev.primaryId);
  root.document.getElementById('vtpObsConflict').value=ev.primaryConflict===true?'yes':'no';
  root.document.getElementById('vtpObsDigestErrors').value=integer(ev.digestErrors)===null?'':String(ev.digestErrors);
  root.document.getElementById('vtpObsRevisionErrors').value=integer(ev.revisionErrors)===null?'':String(ev.revisionErrors);
  paintStatus();
}
function paintStatus(){
  const node=root.document.getElementById('vtpObsStatus'),id=selectedId();
  if(!node)return;
  if(!id){node.textContent='Selecciona un switch con VTP activo.';node.className='co co-ac';return;}
  const r=evaluateDevice(state(),id);
  node.className=r.ok?'co co-gn':'co co-ac';
  node.textContent=r.ok?'✓ Evidencia VTP coherente: este control ya no fuerza review-required.':('Revisión pendiente: '+r.reasons.join(' '));
}
function saveEvidence(){
  const id=selectedId();if(!id)return root.alert&&root.alert('Selecciona un switch VTP.');
  const revision=integer(root.document.getElementById('vtpObsRevision').value);
  const digestErrors=integer(root.document.getElementById('vtpObsDigestErrors').value);
  const revisionErrors=integer(root.document.getElementById('vtpObsRevisionErrors').value);
  if(revision===null||digestErrors===null||revisionErrors===null)return root.alert&&root.alert('Revision y contadores deben ser enteros mayores o iguales a cero.');
  const now=new Date().toISOString();
  const evidence={
    domain:clean(root.document.getElementById('vtpObsDomain').value),
    version:clean(root.document.getElementById('vtpObsVersion').value),
    mode:clean(root.document.getElementById('vtpObsMode').value).toLowerCase(),
    revision,
    primary:root.document.getElementById('vtpObsPrimary').value==='yes',
    primaryId:clean(root.document.getElementById('vtpObsPrimaryId').value),
    primaryConflict:root.document.getElementById('vtpObsConflict').value==='yes',
    digestErrors,
    revisionErrors,
    observedAt:now
  };
  update(project=>{
    const observed=JSON.parse(JSON.stringify(obj(project.observedState)));
    observed.observedAt=now;
    observed.vtpDevices=obj(observed.vtpDevices);
    observed.vtpDevices[id]=evidence;
    return{observedState:observed};
  },'vtp-observation-save');
}
function clearEvidence(){
  const id=selectedId();if(!id)return;
  update(project=>{
    const observed=JSON.parse(JSON.stringify(obj(project.observedState)));
    observed.vtpDevices=obj(observed.vtpDevices);
    delete observed.vtpDevices[id];
    observed.observedAt=new Date().toISOString();
    return{observedState:observed};
  },'vtp-observation-clear');
}
function render(){
  if(!root.document)return;
  const select=root.document.getElementById('vtpObsDevice');if(!select)return;
  const p=state(),current=select.value,roles=obj(obj(p.vtp).roles);
  const devices=arr(p.devices).filter(d=>d&&clean(d.vendorOs)==='cisco_ios'&&activeRole(roles[d.id]));
  select.textContent='';select.appendChild(option('','— switch VTP —'));
  devices.forEach(d=>select.appendChild(option(d.id,(d.name||d.id)+' · '+clean(roles[d.id]))));
  if(current&&devices.some(d=>d.id===current))select.value=current;
  else if(devices.length)select.value=devices[0].id;
  paintForm();
}
function install(){
  if(!root.document||root.document.getElementById('nwVtpVerificationCard'))return;
  const anchor=root.document.getElementById('btnSaveVtp')?.closest('.card');
  if(!anchor)return;
  const card=el('div',{className:'card',id:'nwVtpVerificationCard',style:'margin-top:12px;'});
  const head=el('div',{className:'card-h'});
  head.append(el('div',{className:'card-t'},'🔎 Verificación VTP para producción'),el('span',{className:'b bac'},'Observed'));
  card.append(head,el('div',{className:'hint',style:'margin-bottom:10px;'},'Registra evidencia obtenida del estado real del switch. No almacena contraseñas. El Private Engine compara estos datos con el VTP deseado antes de certificar apply-ready.'));
  card.appendChild(selectField('vtpObsDevice','Switch VTP',[]));
  const g1=el('div',{className:'g2'});
  g1.append(input('vtpObsDomain','Dominio observado'),selectField('vtpObsVersion','Versión observada',[['1','1'],['2','2'],['3','3']]));
  card.appendChild(g1);
  const g2=el('div',{className:'g2'});
  g2.append(selectField('vtpObsMode','Modo observado',[['server','Server'],['client','Client'],['transparent','Transparent']]),input('vtpObsRevision','Configuration revision','number'));
  card.appendChild(g2);
  const g3=el('div',{className:'g2'});
  g3.append(selectField('vtpObsPrimary','Primary VTPv3',[['no','No'],['yes','Sí']]),input('vtpObsPrimaryId','Primary ID observado'));
  card.appendChild(g3);
  const g4=el('div',{className:'g2'});
  g4.append(selectField('vtpObsConflict','Conflicto primary',[['no','No'],['yes','Sí']]),input('vtpObsDigestErrors','Digest errors','number'));
  card.appendChild(g4);
  card.appendChild(input('vtpObsRevisionErrors','Revision errors','number'));
  const buttons=el('div',{className:'brow'});
  buttons.append(el('button',{className:'btn bp',type:'button',id:'vtpObsSave'},'✔ Guardar evidencia'),el('button',{className:'btn bs',type:'button',id:'vtpObsClear'},'Limpiar evidencia'));
  card.append(buttons,el('div',{className:'co co-ac',id:'vtpObsStatus'},'Selecciona un switch con VTP activo.'));
  anchor.insertAdjacentElement('afterend',card);
  root.document.getElementById('vtpObsDevice').onchange=paintForm;
  root.document.getElementById('vtpObsSave').onclick=saveEvidence;
  root.document.getElementById('vtpObsClear').onclick=clearEvidence;
  render();
}
const api={version:'netwizard-vtp-production-verification-v1',evaluateDevice,evaluateProject,observedMap,install,render};
root.NetWizardVtpProductionVerification=api;
if(typeof module!=='undefined'&&module.exports)module.exports=api;
if(root.document){
  const active=()=>root.document.getElementById('pg-vlan')?.classList.contains('on');
  const refresh=()=>{if(active()){try{install();render();}catch(err){if(root.console)root.console.error('NetWizard VTP verification',err);}}};
  if(root.document.readyState==='loading')root.document.addEventListener('DOMContentLoaded',refresh);
  else refresh();
  root.document.addEventListener('nw:project:changed',refresh);
  root.document.addEventListener('nw:view:changed',event=>{if(event.detail?.step==='vlan')refresh();});
}
})(typeof window!=='undefined'?window:globalThis);
