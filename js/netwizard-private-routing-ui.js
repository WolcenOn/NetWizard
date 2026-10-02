/* NetWizard Cloud Private Routing UI v1 */
(function initNetWizardPrivateRoutingUi(root){
'use strict';

const SUPPORTED_VENDORS=new Set(['cisco_ios','juniper_junos','huawei_vrp','mikrotik_routeros']);
const clean=v=>String(v==null?'':v).trim();

function authState(){
  const auth=root.NetWizardAuth;
  return auth&&typeof auth.state==='function'?auth.state():{authenticated:false,capabilities:{},user:null};
}
function project(){
  const state=root.NetWizardState;
  return state&&typeof state.getSnapshot==='function'?state.getSnapshot():{};
}
function supportedDevices(p){
  return (Array.isArray(p&&p.devices)?p.devices:[])
    .filter(d=>d&&SUPPORTED_VENDORS.has(clean(d.vendorOs))&&!/switch/i.test(clean(d.type||d.kind)))
    .slice()
    .sort((a,b)=>clean(a.name||a.id).localeCompare(clean(b.name||b.id),'es',{numeric:true}));
}
function el(tag,attrs,text){
  const n=root.document.createElement(tag);
  for(const [k,v] of Object.entries(attrs||{})){
    if(k==='className')n.className=v;
    else if(k==='dataset')Object.assign(n.dataset,v);
    else n.setAttribute(k,String(v));
  }
  if(text!=null)n.textContent=String(text);
  return n;
}
function ensureMount(){
  if(!root.document)return null;
  let card=root.document.getElementById('nwPrivateRoutingCard');
  if(card)return card;
  const page=root.document.getElementById('pg-cfg');
  if(!page)return null;
  card=el('div',{className:'card',id:'nwPrivateRoutingCard'});
  const heading=page.querySelector('.ph');
  if(heading&&heading.nextSibling)page.insertBefore(card,heading.nextSibling);
  else page.appendChild(card);
  return card;
}
function setStatus(message,kind){
  const node=root.document&&root.document.getElementById('nwPrivateRoutingStatus');
  if(!node)return;
  node.className='co '+(kind==='error'?'co-rd':kind==='ok'?'co-gn':'co-ac');
  node.textContent=message;
}
function render(){
  const card=ensureMount();
  if(!card)return false;
  const auth=authState(),caps=auth.capabilities||{};
  const cloudAvailable=!!(caps.authEnforced&&(caps.remoteProjectWrites||caps.privateRouting));
  card.style.display=cloudAvailable?'':'none';
  if(!cloudAvailable)return false;

  const remote=root.NetWizardRemoteProject;
  const ctx=remote&&typeof remote.context==='function'?remote.context():null;
  const devices=supportedDevices(project());
  const previousProjectId=clean(root.document.getElementById('nwRemoteProjectId')?.value);
  const previousDevice=clean(root.document.getElementById('nwPrivateRoutingDevice')?.value);

  card.textContent='';
  const head=el('div',{className:'card-h'});
  head.append(
    el('div',{className:'card-t'},'☁ Proyecto cloud · Private Engine routing'),
    el('span',{className:'b bac'},ctx?('v'+ctx.currentVersion):'sin contexto')
  );
  card.appendChild(head);

  const info=el('div',{className:'hint'},
    'El contexto SaaS vive solo en memoria. Antes de generar routing privado se sincroniza el snapshot actual con control optimista; el proyecto portable no recibe projectId ni currentVersion.');
  card.appendChild(info);

  const projectRow=el('div',{className:'row'});
  const projectCol=el('div');
  projectCol.append(el('label',{className:'fl',for:'nwRemoteProjectId'},'Project ID'));
  const projectInput=el('input',{id:'nwRemoteProjectId',placeholder:'prj_…'});
  let queryId='';
  try{queryId=clean(new URLSearchParams(root.location&&root.location.search||'').get('projectId'));}catch{}
  projectInput.value=ctx&&ctx.projectId||previousProjectId||queryId;
  projectCol.appendChild(projectInput);
  const actionCol=el('div');
  actionCol.append(el('label',{className:'fl'},'Proyecto remoto'));
  const openButton=el('button',{type:'button',className:'btn bs',id:'nwRemoteProjectOpen'},ctx?'↻ Recargar proyecto cloud':'☁ Abrir proyecto cloud');
  openButton.disabled=!auth.authenticated;
  actionCol.appendChild(openButton);
  projectRow.append(projectCol,actionCol);
  card.appendChild(projectRow);

  const routeRow=el('div',{className:'row'});
  const deviceCol=el('div');
  deviceCol.append(el('label',{className:'fl',for:'nwPrivateRoutingDevice'},'Dispositivo de routing'));
  const select=el('select',{id:'nwPrivateRoutingDevice'});
  if(!devices.length){
    const option=el('option',{value:''},'Sin routers compatibles');
    select.appendChild(option);
  }else{
    for(const d of devices){
      const option=el('option',{value:d.id},(d.name||d.id)+' · '+d.vendorOs);
      select.appendChild(option);
    }
    if(devices.some(d=>d.id===previousDevice))select.value=previousDevice;
  }
  deviceCol.appendChild(select);
  const genCol=el('div');
  genCol.append(el('label',{className:'fl'},'Private Engine'));
  const generate=el('button',{type:'button',className:'btn bp',id:'nwPrivateRoutingGenerate'},'☁ Sincronizar y generar routing privado');
  generate.disabled=!(remote&&remote.canUsePrivateRouting&&remote.canUsePrivateRouting()&&select.value);
  genCol.appendChild(generate);
  routeRow.append(deviceCol,genCol);
  card.appendChild(routeRow);

  const status=el('div',{className:'co co-ac',id:'nwPrivateRoutingStatus'});
  status.textContent=ctx
    ? ('Proyecto '+(ctx.name||ctx.projectId)+' · versión remota '+ctx.currentVersion+'.')
    : (auth.authenticated?'Abre un proyecto SaaS para activar el Private Engine.':'Inicia sesión para abrir un proyecto SaaS.');
  card.appendChild(status);

  const output=el('textarea',{className:'cfg',id:'nwPrivateRoutingOutput',readonly:'readonly',style:'min-height:180px;margin-top:8px;',placeholder:'La salida de routing privado aparecerá aquí.'});
  card.appendChild(output);
  const actions=el('div',{className:'brow'});
  const copy=el('button',{type:'button',className:'btn bs bsm',id:'nwPrivateRoutingCopy'},'Copiar routing');
  copy.disabled=true;
  actions.appendChild(copy);
  card.appendChild(actions);

  openButton.onclick=async()=>{
    const id=clean(projectInput.value);
    if(!id)return setStatus('Introduce un projectId válido.','error');
    if(!remote||typeof remote.open!=='function')return setStatus('Cliente SaaS remoto no disponible.','error');
    openButton.disabled=true;
    setStatus('Cargando proyecto remoto…','info');
    try{
      const loaded=await remote.open(id,{replaceState:true});
      setStatus('Proyecto cloud cargado · versión '+loaded.context.currentVersion+'.','ok');
      render();
    }catch(err){
      setStatus('No se pudo abrir el proyecto: '+(err&&err.message||'error desconocido')+'.','error');
      openButton.disabled=false;
    }
  };

  generate.onclick=async()=>{
    const deviceId=clean(select.value);
    if(!deviceId)return;
    generate.disabled=true;copy.disabled=true;output.value='';
    setStatus('Sincronizando revisión y ejecutando Private Engine…','info');
    try{
      const result=await remote.syncAndGenerateRouting(deviceId);
      render();
      const liveOutput=root.document.getElementById('nwPrivateRoutingOutput');
      const liveCopy=root.document.getElementById('nwPrivateRoutingCopy');
      if(liveOutput)liveOutput.value=result.output||'';
      if(liveCopy)liveCopy.disabled=!(result.output||'');
      const warnings=Array.isArray(result.warnings)&&result.warnings.length?' · '+result.warnings.length+' aviso(s)':'';
      const latest=remote.context();
      setStatus('Routing privado generado · '+result.vendor+' · versión remota '+(latest&&latest.currentVersion||'?')+warnings+'.','ok');
    }catch(err){
      const conflict=err&&[409,412].includes(err.status);
      const suffix=conflict?' Recarga el proyecto cloud antes de reintentar.':'';
      setStatus('No se pudo generar routing privado: '+(err&&err.message||'error desconocido')+'.'+suffix,'error');
    }finally{
      const liveGenerate=root.document.getElementById('nwPrivateRoutingGenerate');
      const liveSelect=root.document.getElementById('nwPrivateRoutingDevice');
      if(liveGenerate)liveGenerate.disabled=!(remote&&remote.canUsePrivateRouting&&remote.canUsePrivateRouting()&&liveSelect&&liveSelect.value);
    }
  };

  copy.onclick=()=>{
    if(!output.value)return;
    if(root.navigator&&root.navigator.clipboard&&root.navigator.clipboard.writeText)root.navigator.clipboard.writeText(output.value);
  };
  return true;
}
function install(){
  if(!root.document)return false;
  const active=()=>root.document.getElementById('pg-cfg')?.classList.contains('on');
  const rerender=()=>{if(!active())return;try{render();}catch(err){if(root.console)root.console.error('NetWizard private routing UI',err);}};
  for(const name of ['nw:auth:changed','nw:remote-project:changed'])root.addEventListener&&root.addEventListener(name,rerender);
  root.document.addEventListener&&root.document.addEventListener('nw:project:changed',rerender);
  root.document.addEventListener('nw:view:changed',event=>{if(event.detail?.step==='cfg')rerender();});
  if(root.document.readyState==='loading')root.document.addEventListener('DOMContentLoaded',rerender,{once:true});else rerender();
  return true;
}

const api={version:'netwizard-private-routing-ui-v1',supportedDevices,render,install};
root.NetWizardPrivateRoutingUi=api;
if(typeof module!=='undefined'&&module.exports)module.exports=api;
if(root.document)install();
})(typeof window!=='undefined'?window:globalThis);
