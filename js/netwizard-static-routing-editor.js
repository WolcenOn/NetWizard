/* NetWizard static inter-site routing editor v1
   Canonical To-Be authority: project.routing.staticRoutesByDevice[deviceId].
   Default routes remain under highAvailability.devices[deviceId].defaultRoutes.
*/
(function initNetWizardStaticRoutingEditor(root){
'use strict';

const arr=v=>Array.isArray(v)?v:[];
const obj=v=>v&&typeof v==='object'&&!Array.isArray(v)?v:{};
const clean=v=>String(v==null?'':v).trim();
function uid(prefix){
  if(root.crypto&&typeof root.crypto.randomUUID==='function')return prefix+'_'+root.crypto.randomUUID().replace(/-/g,'').slice(0,12);
  return prefix+'_'+Date.now().toString(36)+'_'+Math.random().toString(36).slice(2,8);
}
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
function state(){return root.NetWizardState&&root.NetWizardState.getSnapshot?root.NetWizardState.getSnapshot():{};}
function update(updater,source){
  if(!root.NetWizardState||typeof root.NetWizardState.updateProject!=='function')throw new Error('NetWizardState unavailable');
  return root.NetWizardState.updateProject(updater,{source:source||'static-routing-editor'});
}
function routingUtils(){return root.NetWizardRoutingUtils||null;}
function isRoutingDevice(d){
  const type=clean(d&&d.type).toLowerCase(),kind=clean(d&&d.kind).toLowerCase(),vendor=clean(d&&d.vendorOs).toLowerCase();
  return ['router','firewall','l3switch','switch_l3'].includes(type)||['router','firewall','l3switch','switch_l3'].includes(kind)||
    ['fortinet','pfsense','cisco_asa'].includes(vendor)||clean(d&&d.l3Capable).toLowerCase()==='yes';
}
function deviceLabel(p,id){const d=arr(p.devices).find(x=>x.id===id);return d?(d.name||d.id):id||'—';}
function currentDevice(){return clean(root.document.getElementById('nwStaticRouteDevice')?.value);}
function routeMap(project){return obj(obj(project&&project.routing).staticRoutesByDevice);}
function field(id,label,placeholder,type){
  const w=el('div');w.append(el('label',{className:'fl',htmlFor:id},label),el('input',{id,placeholder:placeholder||'',type:type||'text'}));return w;
}
function selectField(id,label){
  const w=el('div'),s=el('select',{id});w.append(el('label',{className:'fl',htmlFor:id},label),s);return w;
}
function refillDevices(){
  const p=state(),s=root.document.getElementById('nwStaticRouteDevice');if(!s)return;
  const devices=arr(p.devices).filter(isRoutingDevice),current=s.value;
  s.textContent='';s.appendChild(option('','— dispositivo L3 —'));
  devices.forEach(d=>s.appendChild(option(d.id,d.name||d.id)));
  if(current&&devices.some(d=>d.id===current))s.value=current;
  else if(devices.length)s.value=devices[0].id;
}
function validateInput(project,deviceId,destination,nextHop,distance){
  const errors=[],NWU=root.NetWizardNetworkUtils,RU=routingUtils();
  const parsed=NWU&&typeof NWU.parseCidr==='function'?NWU.parseCidr(destination):null;
  if(!parsed)errors.push('Destino CIDR inválido.');
  else if(parsed.cidr==='0.0.0.0/0')errors.push('La ruta por defecto se configura en HA/routing services.');
  if(!/^\d{1,3}(?:\.\d{1,3}){3}$/.test(nextHop))errors.push('Next-hop IPv4 inválido.');
  const n=Number(distance);if(!Number.isInteger(n)||n<1||n>255)errors.push('Distancia administrativa fuera de 1–255.');
  const interfaces=arr(project.ports).filter(p=>p.deviceId===deviceId&&p.mode==='routed'&&clean(p.l3Cidr||p.routedCidr));
  if(RU&&typeof RU.cidrContainsIp==='function'&&nextHop&&!interfaces.some(p=>RU.cidrContainsIp(p.l3Cidr||p.routedCidr,nextHop)))errors.push('El next-hop no está en una red routed directamente conectada.');
  return errors;
}
function addRoute(){
  const p=state(),deviceId=currentDevice(),destination=clean(root.document.getElementById('nwStaticRouteDestination').value);
  const nextHop=clean(root.document.getElementById('nwStaticRouteNextHop').value),distance=Number(root.document.getElementById('nwStaticRouteDistance').value||1);
  const description=clean(root.document.getElementById('nwStaticRouteDescription').value);
  if(!deviceId)return root.alert&&root.alert('Selecciona un dispositivo L3.');
  const currentStrategy=clean(obj(p.routing).protocol||obj(p.routing).strategy||obj(p.routing).mode).toLowerCase();
  if(currentStrategy&&currentStrategy!=='static')return root.alert&&root.alert('El proyecto usa '+currentStrategy.toUpperCase()+'. Este editor solo modifica routing estático.');
  const errors=validateInput(p,deviceId,destination,nextHop,distance);
  if(errors.length)return root.alert&&root.alert(errors.join('\n'));
  update(project=>{
    const routing=JSON.parse(JSON.stringify(obj(project.routing)));
    routing.strategy='static';
    routing.staticRoutesByDevice=obj(routing.staticRoutesByDevice);
    const list=arr(routing.staticRoutesByDevice[deviceId]).slice();
    list.push({id:uid('route'),destination,nextHop,distance,description});
    routing.staticRoutesByDevice[deviceId]=list;
    return{routing};
  },'static-route-add');
  root.document.getElementById('nwStaticRouteDestination').value='';
  root.document.getElementById('nwStaticRouteNextHop').value='';
  root.document.getElementById('nwStaticRouteDescription').value='';
}
function deleteRoute(routeId){
  const deviceId=currentDevice();if(!deviceId)return;
  update(project=>{
    const routing=JSON.parse(JSON.stringify(obj(project.routing)));
    routing.staticRoutesByDevice=obj(routing.staticRoutesByDevice);
    routing.staticRoutesByDevice[deviceId]=arr(routing.staticRoutesByDevice[deviceId]).filter(r=>clean(r&&r.id)!==routeId);
    return{routing};
  },'static-route-delete');
}
function renderSuggested(project,deviceId){
  const host=root.document.getElementById('nwStaticRouteSuggestions');if(!host)return;
  host.textContent='';
  const RU=routingUtils(),suggestions=RU&&typeof RU.inferStaticRoutes==='function'?RU.inferStaticRoutes(project,deviceId):[];
  if(!deviceId){host.appendChild(el('div',{className:'hint'},'Selecciona un dispositivo para ver rutas inferibles desde vecinos directamente conectados.'));return;}
  if(!suggestions.length){host.appendChild(el('div',{className:'hint'},'No hay rutas vecinas inferibles. Las rutas multi-hop se declaran explícitamente arriba.'));return;}
  host.appendChild(el('div',{className:'hint'},'Inferencia de vecino directo (no sustituye las rutas multi-hop explícitas):'));
  suggestions.slice(0,12).forEach(r=>host.appendChild(el('div',{className:'hint mono'},r.destination+' → '+r.nextHop+(r.peerDeviceName?' · '+r.peerDeviceName:''))));
}
function renderRoutes(){
  const p=state(),deviceId=currentDevice(),host=root.document.getElementById('nwStaticRouteList'),status=root.document.getElementById('nwStaticRouteStatus');
  if(!host)return;
  host.textContent='';
  const routes=arr(routeMap(p)[deviceId]);
  if(!deviceId){host.appendChild(el('div',{className:'hint'},'Selecciona un router/firewall.'));if(status)status.textContent='';renderSuggested(p,'');return;}
  const RU=routingUtils(),check=RU&&typeof RU.explicitStaticRoutes==='function'?RU.explicitStaticRoutes(p,deviceId):{routes:[],issues:[]};
  const validById=new Map(arr(check.routes).map(r=>[clean(r.id),r]));
  if(!routes.length)host.appendChild(el('div',{className:'hint'},'Sin rutas estáticas explícitas. El plan puede seguir mostrando inferencias de vecinos directos.'));
  routes.forEach(r=>{
    const row=el('div',{className:'hrow'}),resolved=validById.get(clean(r.id));
    const info=el('div',{className:'hinfo'});
    const hop=clean(r.destination)+' → '+clean(r.nextHop)+' · AD '+String(r.distance==null?1:r.distance);
    const path=resolved&&resolved.outPortName?('Camino inmediato: '+deviceLabel(p,deviceId)+' → '+resolved.outPortName+' → '+resolved.nextHop):(clean(r.description)||'Ruta remota explícita');
    info.append(el('div',{className:'hn mono'},hop),el('div',{className:'hm'},path+(r.description?' · '+clean(r.description):'')));
    const del=el('button',{className:'btn bd bxs',type:'button'},'✕');del.onclick=()=>deleteRoute(clean(r.id));row.append(info,del);host.appendChild(row);
  });
  if(status){
    const issues=arr(check.issues);
    status.className=issues.length?'co co-rd':'co co-gn';
    status.textContent=issues.length?('Revisa: '+issues.map(i=>i.message).join(' ')):'✓ Rutas explícitas válidas para '+deviceLabel(p,deviceId)+'.';
  }
  renderSuggested(p,deviceId);
}
function render(){refillDevices();renderRoutes();}
function install(){
  if(!root.document||root.document.getElementById('nwStaticRoutingCard'))return;
  const host=root.document.getElementById('pg-dev');if(!host)return;
  const card=el('div',{className:'card',id:'nwStaticRoutingCard',style:'margin-top:12px;'});
  const head=el('div',{className:'card-h'});head.append(el('div',{className:'card-t'},'🧭 Routing estático inter-sede'),el('span',{className:'b bac'},'routing'));
  card.append(head,el('div',{className:'hint',style:'margin-bottom:10px;'},'Declara prefijos remotos por dispositivo. El next-hop debe estar directamente conectado. Las rutas por defecto permanecen en HA/routing services.'));
  card.appendChild(selectField('nwStaticRouteDevice','Router / firewall'));
  const g1=el('div',{className:'g2'});g1.append(field('nwStaticRouteDestination','Prefijo destino','10.64.1.128/25'),field('nwStaticRouteNextHop','Next-hop','10.255.0.1'));
  const g2=el('div',{className:'g2'});g2.append(field('nwStaticRouteDistance','Distancia administrativa','1','number'),field('nwStaticRouteDescription','Descripción','Sede Norte vía Central'));
  card.append(g1,g2);
  const actions=el('div',{className:'brow'});actions.appendChild(el('button',{className:'btn bp',type:'button',id:'nwStaticRouteAdd'},'➕ Añadir ruta'));card.appendChild(actions);
  card.append(el('div',{id:'nwStaticRouteStatus',className:'co co-gn',style:'margin-top:8px;'}),el('div',{id:'nwStaticRouteList',style:'margin-top:8px;'}),el('div',{id:'nwStaticRouteSuggestions',style:'margin-top:8px;'}));
  host.appendChild(card);
  root.document.getElementById('nwStaticRouteDevice').onchange=renderRoutes;
  root.document.getElementById('nwStaticRouteAdd').onclick=addRoute;
  render();
}
const api={version:'netwizard-static-routing-editor-v1',install,render,isRoutingDevice,validateInput};
root.NetWizardStaticRoutingEditor=api;
if(typeof module!=='undefined'&&module.exports)module.exports=api;
if(root.document){
  if(root.document.readyState==='loading')root.document.addEventListener('DOMContentLoaded',install);
  else install();
  root.document.addEventListener('nw:project:changed',()=>{try{render();}catch(err){if(root.console)root.console.error('NetWizard static routing editor',err);}});
}
})(typeof window!=='undefined'?window:globalThis);
