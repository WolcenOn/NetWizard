/* NetWizard Site-to-Site VPN UI v1 */
(function initNetWizardSiteToSiteVpnUi(root){
'use strict';

let editingId='';
const arr=v=>Array.isArray(v)?v:[];
const obj=v=>v&&typeof v==='object'&&!Array.isArray(v)?v:{};
const clean=v=>String(v==null?'':v).trim();

function el(tag,attrs,text){
  const node=root.document.createElement(tag);
  Object.entries(attrs||{}).forEach(([k,v])=>{
    if(k==='className')node.className=v;
    else if(k==='htmlFor')node.htmlFor=v;
    else if(v!=null)node.setAttribute(k,String(v));
  });
  if(text!=null)node.textContent=String(text);
  return node;
}
function option(value,label){return el('option',{value},label);}
function field(label,control){const w=el('div');const l=el('label',{className:'fl'},label);if(control.id)l.htmlFor=control.id;w.append(l,control);return w;}
function input(id,placeholder,type){return el('input',{id,type:type||'text',placeholder:placeholder||''});}
function select(id){return el('select',{id});}
function state(){return root.NetWizardState&&root.NetWizardState.getSnapshot?root.NetWizardState.getSnapshot():{};}
function update(updater,source){
  if(!root.NetWizardState||typeof root.NetWizardState.updateProject!=='function')throw new Error('NetWizardState unavailable');
  return root.NetWizardState.updateProject(updater,{source:source||'site-to-site-vpn-editor'});
}
function uid(){
  if(root.crypto&&typeof root.crypto.randomUUID==='function')return'vpn_'+root.crypto.randomUUID().replace(/-/g,'').slice(0,12);
  return'vpn_'+Date.now().toString(36)+'_'+Math.random().toString(36).slice(2,8);
}
function clone(v){return JSON.parse(JSON.stringify(v==null?{}:v));}
function engine(){return root.NetWizardSiteToSiteVpn;}
function tunnels(p){return arr(obj(p&&p.routing).siteToSiteVpns);}
function current(p){return tunnels(p).find(x=>clean(x&&x.id)===editingId)||null;}
function deviceLabel(d){return d?clean(d.name||d.id):'';}
function circuitLabel(c){return c?clean(c.name||c.id)+' · '+clean(c.provider||'sin proveedor'):'';}
function prefixesForDevice(p,deviceId){
  return arr(p.subnets).filter(sn=>clean(sn.gatewayDeviceRef||sn.gatewayDeviceId||sn.ownerDeviceRef||sn.routingDeviceRef||obj(p.roas).gwId)===deviceId&&clean(sn.cidr)).map(sn=>clean(sn.cidr)).sort();
}
function circuitsForDevice(p,deviceId){
  return arr(p.wanCircuits).filter(c=>clean(c.deviceId)===deviceId&&c.enabled!==false);
}
function eligibleDevices(p){
  const ids=new Set(arr(p.wanCircuits).filter(c=>c.enabled!==false).map(c=>clean(c.deviceId)).filter(Boolean));
  return arr(p.devices).filter(d=>ids.has(clean(d.id))).sort((a,b)=>deviceLabel(a).localeCompare(deviceLabel(b),'es'));
}
function setOptions(selectEl,items,preferred,emptyLabel){
  selectEl.textContent='';
  if(emptyLabel)selectEl.appendChild(option('',emptyLabel));
  items.forEach(item=>selectEl.appendChild(option(item.value,item.label)));
  if(preferred&&items.some(x=>x.value===preferred))selectEl.value=preferred;
}
function parsePrefixInput(value){return String(value||'').split(/[\s,;]+/).map(clean).filter(Boolean);}

function observedStatus(p,id){
  const map=obj(obj(p.observedState).siteToSiteVpns),o=obj(map[id]);
  return clean(o.status||'unknown').toLowerCase()||'unknown';
}
function setObserved(id,status){
  const p=state(),validation=engine().validateProject(p),plan=validation.plans.find(x=>x.id===id);
  if(!plan)return;
  const now=new Date().toISOString();
  update(project=>{
    const observed=clone(project.observedState||{});
    observed.observedAt=now;
    observed.siteToSiteVpns=obj(observed.siteToSiteVpns);
    observed.siteToSiteVpns[id]={
      status,
      localEndpoint:plan.localEndpoint,
      remoteEndpoint:plan.remoteEndpoint,
      phase1:status==='up'?'up':status==='down'?'down':'unknown',
      phase2:status==='up'?'up':status==='down'?'down':'unknown',
      observedAt:now
    };
    return{observedState:observed};
  },'site-to-site-vpn-observed');
}
function clearObserved(id){
  update(project=>{
    const observed=clone(project.observedState||{});
    observed.siteToSiteVpns=obj(observed.siteToSiteVpns);
    delete observed.siteToSiteVpns[id];
    return{observedState:observed};
  },'site-to-site-vpn-observed-clear');
}

function render(){
  if(!root.document||!engine())return;
  const host=root.document.getElementById('pg-links');if(!host)return;
  let mount=root.document.getElementById('nwSiteToSiteVpnMount');
  if(!mount){mount=el('div',{id:'nwSiteToSiteVpnMount'});const wan=root.document.getElementById('nwWanCircuitsEditorMount');if(wan&&wan.parentNode===host)wan.insertAdjacentElement('afterend',mount);else host.appendChild(mount);}
  const p=state();
  if(editingId&&!current(p))editingId='';
  mount.textContent='';

  const card=el('div',{className:'card',id:'nwSiteToSiteVpnEditor',style:'margin-top:12px;'});
  const head=el('div',{className:'card-h'});
  head.append(el('div',{className:'card-t'},'🔐 VPN site-to-site'),el('span',{className:'b bac'},'routing.siteToSiteVpns'));
  card.append(head,el('div',{className:'hint'},'Overlay IKEv2/IPsec sobre circuitos WAN existentes. Guarda solo alias de secretos; nunca una PSK real. Los prefijos deben pertenecer a subnets de cada edge.'));

  const form={
    name:input('nwVpnName','HQ ↔ Norte'),role:select('nwVpnRole'),priority:input('nwVpnPriority','10','number'),
    localDevice:select('nwVpnLocalDevice'),localCircuit:select('nwVpnLocalCircuit'),
    remoteDevice:select('nwVpnRemoteDevice'),remoteCircuit:select('nwVpnRemoteCircuit'),
    localPrefixes:input('nwVpnLocalPrefixes','10.10.0.0/24, 10.10.1.0/24'),
    remotePrefixes:input('nwVpnRemotePrefixes','10.20.0.0/24'),
    secretAlias:input('nwVpnSecretAlias','VPN_HQ_NORTE_PSK'),
    ikeLifetime:input('nwVpnIkeLifetime','28800','number'),
    ipsecLifetime:input('nwVpnIpsecLifetime','3600','number'),
    description:input('nwVpnDescription','VPN corporativa sobre Internet')
  };
  form.role.append(option('primary','Principal'),option('backup','Backup'));
  form.role.value='primary';form.priority.value='10';form.ikeLifetime.value='28800';form.ipsecLifetime.value='3600';

  const devices=eligibleDevices(p).map(d=>({value:d.id,label:deviceLabel(d)}));
  setOptions(form.localDevice,devices,'','— edge local —');
  setOptions(form.remoteDevice,devices,'','— edge remoto —');

  function refillCircuit(which,preferred){
    const dev=which==='local'?form.localDevice.value:form.remoteDevice.value;
    const target=which==='local'?form.localCircuit:form.remoteCircuit;
    const items=circuitsForDevice(p,dev).map(c=>({value:c.id,label:circuitLabel(c)}));
    setOptions(target,items,preferred||'','— circuito WAN —');
  }
  function autofillPrefixes(which){
    const dev=which==='local'?form.localDevice.value:form.remoteDevice.value;
    const target=which==='local'?form.localPrefixes:form.remotePrefixes;
    if(!clean(target.value))target.value=prefixesForDevice(p,dev).join(', ');
  }
  form.localDevice.onchange=()=>{refillCircuit('local','');autofillPrefixes('local');};
  form.remoteDevice.onchange=()=>{refillCircuit('remote','');autofillPrefixes('remote');};

  const existing=current(p);
  if(existing){
    form.name.value=existing.name||'';form.role.value=existing.role||'primary';form.priority.value=existing.priority||10;
    form.localDevice.value=existing.localDeviceId||'';
    form.remoteDevice.value=existing.remoteDeviceId||'';
    refillCircuit('local',existing.localCircuitRef||'');
    refillCircuit('remote',existing.remoteCircuitRef||'');
    form.localPrefixes.value=arr(existing.localPrefixes).join(', ');
    form.remotePrefixes.value=arr(existing.remotePrefixes).join(', ');
    form.secretAlias.value=existing.secretAlias||'';
    form.ikeLifetime.value=existing.ikeLifetimeSeconds||28800;
    form.ipsecLifetime.value=existing.ipsecLifetimeSeconds||3600;
    form.description.value=existing.description||'';
  }else{
    refillCircuit('local','');refillCircuit('remote','');
  }

  const g1=el('div',{className:'g4'});g1.append(field('Nombre',form.name),field('Rol',form.role),field('Prioridad',form.priority),field('Alias de PSK',form.secretAlias));
  const g2=el('div',{className:'g2'});g2.append(field('Edge local',form.localDevice),field('Circuito local',form.localCircuit));
  const g3=el('div',{className:'g2'});g3.append(field('Edge remoto',form.remoteDevice),field('Circuito remoto',form.remoteCircuit));
  const g4=el('div',{className:'g2'});g4.append(field('Prefijos locales',form.localPrefixes),field('Prefijos remotos',form.remotePrefixes));
  const g5=el('div',{className:'g2'});g5.append(field('Lifetime IKEv2 (s)',form.ikeLifetime),field('Lifetime IPsec (s)',form.ipsecLifetime));
  card.append(g1,g2,g3,g4,g5,field('Descripción',form.description));
  card.appendChild(el('div',{className:'hint'},'Perfil inicial fijo: IKEv2 · AES-256 · SHA-256 · DH14 · PFS14. Los algoritmos adicionales se ampliarán solo con casos reales/vendor verificados.'));

  const status=el('div',{id:'nwVpnEditorStatus',className:'hint'});card.appendChild(status);
  const actions=el('div',{className:'brow'});
  const save=el('button',{className:'btn bp',type:'button',id:'nwVpnSave'},existing?'💾 Guardar VPN':'➕ Añadir VPN');
  const cancel=el('button',{className:'btn bs',type:'button',id:'nwVpnCancel'},'Cancelar');cancel.style.display=existing?'':'none';
  actions.append(save,cancel);card.appendChild(actions);

  save.onclick=()=>{
    try{
      const snap=state(),old=current(snap);
      const payload={
        id:old&&old.id||uid(),name:clean(form.name.value)||'VPN site-to-site',enabled:true,role:clean(form.role.value)||'primary',priority:Number(form.priority.value||10),
        localDeviceId:clean(form.localDevice.value),remoteDeviceId:clean(form.remoteDevice.value),
        localCircuitRef:clean(form.localCircuit.value),remoteCircuitRef:clean(form.remoteCircuit.value),
        localPrefixes:parsePrefixInput(form.localPrefixes.value),remotePrefixes:parsePrefixInput(form.remotePrefixes.value),
        ikeVersion:'2',encryption:'aes256',integrity:'sha256',dhGroup:14,pfsGroup:14,
        ikeLifetimeSeconds:Number(form.ikeLifetime.value||28800),ipsecLifetimeSeconds:Number(form.ipsecLifetime.value||3600),
        secretAlias:clean(form.secretAlias.value),description:clean(form.description.value)
      };
      const check=engine().validateTunnel(snap,payload,tunnels(snap).findIndex(x=>x.id===payload.id));
      const blocking=arr(check.issues).filter(x=>x.blocking);
      if(blocking.length)throw new Error(blocking.map(x=>x.message).join('\n'));
      editingId='';
      update(project=>{
        const routing=clone(obj(project.routing));
        routing.siteToSiteVpns=arr(routing.siteToSiteVpns).slice();
        const at=routing.siteToSiteVpns.findIndex(x=>x.id===payload.id);
        if(at>=0)routing.siteToSiteVpns[at]=payload;else routing.siteToSiteVpns.push(payload);
        return{routing};
      },old?'site-to-site-vpn-update':'site-to-site-vpn-add');
    }catch(error){status.className='co co-rd';status.textContent=error&&error.message||String(error);}
  };
  cancel.onclick=()=>{editingId='';render();};

  const list=el('div',{className:'card',id:'nwSiteToSiteVpnList',style:'margin-top:12px;'});
  const validation=engine().validateProject(p);
  const lh=el('div',{className:'card-h'});lh.append(el('div',{className:'card-t'},'Túneles definidos'),el('span',{className:'b bgr'},String(validation.plans.length)));
  list.appendChild(lh);
  if(!validation.plans.length)list.appendChild(el('div',{className:'empty'},'No hay VPN site-to-site definidas.'));
  validation.plans.forEach(plan=>{
    const issues=validation.issues.filter(x=>x.tunnelId===plan.id),blocked=issues.some(x=>x.blocking),obs=observedStatus(p,plan.id);
    const row=el('div',{style:'padding:10px 0;border-top:1px solid rgba(127,127,127,.2);display:flex;gap:10px;justify-content:space-between;align-items:flex-start;'});
    const info=el('div',{className:'hinfo'});
    info.append(
      el('div',{className:'hn'},plan.name+' · '+plan.localEndpoint+' ↔ '+plan.remoteEndpoint),
      el('div',{className:'hm'},plan.localPrefixes.join(', ')+' ↔ '+plan.remotePrefixes.join(', ')+' · '+String(plan.role||'primary').toUpperCase()+' · prio '+String(plan.priority||100)),
      el('div',{className:'hm'},'To-Be: '+(blocked?'BLOQUEADO':'válido')+' · Observed: '+obs.toUpperCase()+(issues.length?' · '+issues.map(x=>x.message).join(' '):''))
    );
    const buttons=el('div',{className:'brow',style:'margin:0;flex-wrap:wrap;'});
    const edit=el('button',{className:'btn bs bsm',type:'button'},'Editar');
    const up=el('button',{className:'btn bs bsm',type:'button'},'Observed UP');
    const down=el('button',{className:'btn bs bsm',type:'button'},'Observed DOWN');
    const clear=el('button',{className:'btn bs bsm',type:'button'},'Limpiar Observed');
    const del=el('button',{className:'btn br bsm',type:'button'},'Eliminar');
    edit.onclick=()=>{editingId=plan.id;render();root.document.getElementById('nwSiteToSiteVpnEditor')?.scrollIntoView?.({behavior:'smooth',block:'start'});};
    up.onclick=()=>setObserved(plan.id,'up');
    down.onclick=()=>setObserved(plan.id,'down');
    clear.onclick=()=>clearObserved(plan.id);
    del.onclick=()=>{
      if(root.confirm&&!root.confirm('¿Eliminar la VPN "'+plan.name+'"?'))return;
      if(editingId===plan.id)editingId='';
      update(project=>{
        const routing=clone(obj(project.routing));routing.siteToSiteVpns=arr(routing.siteToSiteVpns).filter(x=>x.id!==plan.id);
        const observed=clone(project.observedState||{});observed.siteToSiteVpns=obj(observed.siteToSiteVpns);delete observed.siteToSiteVpns[plan.id];
        return{routing,observedState:observed};
      },'site-to-site-vpn-delete');
    };
    buttons.append(edit,up,down,clear,del);row.append(info,buttons);list.appendChild(row);
  });

  mount.append(card,list);
}
function install(){
  if(!root.document)return false;
  document.addEventListener('nw:project:changed',render);
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>setTimeout(render,100));else setTimeout(render,0);
  return true;
}
const api={version:'netwizard-site-to-site-vpn-ui-v1',render,install,setObserved,clearObserved};
root.NetWizardSiteToSiteVpnUi=api;
if(typeof module!=='undefined'&&module.exports)module.exports=api;
if(root.document)install();
})(typeof window!=='undefined'?window:globalThis);
