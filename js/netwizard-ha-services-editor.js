/* NetWizard HA/routing services canonical editor v1
   Canonical To-Be editor for existing 3.50 field:
   - project.highAvailability.devices[deviceId]
*/
(function initNetWizardHaServicesEditor(root){
'use strict';

const arr=v=>Array.isArray(v)?v:[];
const obj=v=>v&&typeof v==='object'&&!Array.isArray(v)?v:{};
const clean=v=>String(v==null?'':v).trim();
const num=(v,fallback=null)=>{const n=Number(v);return Number.isFinite(n)?n:fallback;};
function uid(prefix){
  if(root.crypto&&typeof root.crypto.randomUUID==='function')return prefix+'_'+root.crypto.randomUUID().replace(/-/g,'').slice(0,12);
  return prefix+'_'+Date.now().toString(36)+'_'+Math.random().toString(36).slice(2,8);
}
function el(tag,attrs,text){
  const node=root.document.createElement(tag);
  Object.entries(attrs||{}).forEach(([k,v])=>{
    if(k==='className')node.className=v;
    else if(k==='htmlFor')node.htmlFor=v;
    else if(k==='checked')node.checked=!!v;
    else if(k==='multiple')node.multiple=!!v;
    else if(v!=null)node.setAttribute(k,String(v));
  });
  if(text!=null)node.textContent=String(text);
  return node;
}
function option(value,label,selected){
  const o=el('option',{value},label);
  o.selected=!!selected;
  return o;
}
function state(){return root.NetWizardState&&root.NetWizardState.getSnapshot?root.NetWizardState.getSnapshot():{};}
function update(updater,source){
  if(!root.NetWizardState||typeof root.NetWizardState.updateProject!=='function')throw new Error('NetWizardState unavailable');
  return root.NetWizardState.updateProject(updater,{source:source||'ha-services-editor'});
}
function deviceLabel(project,id){
  const d=arr(project.devices).find(x=>x.id===id);
  return d?(d.name||d.id):id||'—';
}
function portLabel(project,id){
  const p=arr(project.ports).find(x=>x.id===id);
  if(!p)return id||'—';
  return deviceLabel(project,p.deviceId)+' · '+(p.name||p.id);
}
function setSelectOptions(select,items,placeholder){
  if(!select)return;
  const current=select.value;
  select.textContent='';
  if(placeholder!=null)select.appendChild(option('',placeholder,false));
  items.forEach(item=>select.appendChild(option(item.value,item.label,item.value===current)));
  if(current&&Array.from(select.options).some(o=>o.value===current))select.value=current;
}
function selectedValues(select){return Array.from(select&&select.selectedOptions||[]).map(o=>o.value).filter(Boolean);}
function field(id,label,placeholder){
  const w=el('div');
  w.append(el('label',{className:'fl',htmlFor:id},label),el('input',{id,placeholder:placeholder||''}));
  return w;
}
function numberField(id,label,placeholder){
  const w=el('div');
  w.append(el('label',{className:'fl',htmlFor:id},label),el('input',{id,type:'number',min:'0',step:'0.1',placeholder:placeholder||''}));
  return w;
}
function selectField(id,label,items){
  const w=el('div'),s=el('select',{id});
  items.forEach(([v,l])=>s.appendChild(option(v,l)));
  w.append(el('label',{className:'fl',htmlFor:id},label),s);
  return w;
}

// ---------------- HA services ----------------
function haCard(){
  const host=root.document&&root.document.getElementById('pg-dev');
  if(!host)return null;
  let card=root.document.getElementById('nwHaServicesEditorCard');
  if(card)return card;
  card=el('div',{className:'card',id:'nwHaServicesEditorCard',style:'margin-top:12px;'});
  const hd=el('div',{className:'card-h'});hd.append(el('div',{className:'card-t'},'🛡 HA, routing y servicios por dispositivo'),el('span',{className:'b bac'},'To-Be → CLI'));
  card.appendChild(hd);
  card.appendChild(el('div',{className:'hint',style:'margin-bottom:10px;'},'Estos datos alimentan directamente el generador privado: rutas por defecto, tracking, DHCP relay y HSRP/VRRP.'));
  card.appendChild(selectField('haDevice','Dispositivo objetivo',[]));
  card.appendChild(field('haRelayServers','DHCP relay servers (coma)','10.0.0.10,10.0.0.11'));

  const g=el('div',{className:'g2'});
  const route=el('div');
  route.appendChild(el('div',{className:'card-t',style:'margin-top:10px;'},'Ruta por defecto'));
  route.append(field('haRouteNextHop','Next-hop','203.0.113.1'),numberField('haRouteDistance','Distancia','1'),numberField('haRouteTrack','Track ID','1'),selectField('haRouteCircuit','Circuito WAN',[]),field('haRouteDesc','Descripción','ISP principal'));
  route.appendChild(el('button',{className:'btn bs bsm',type:'button',id:'haAddRoute'},'➕ Añadir ruta'));
  route.appendChild(el('div',{id:'haRouteList',style:'margin-top:6px;'}));
  const probe=el('div');
  probe.appendChild(el('div',{className:'card-t',style:'margin-top:10px;'},'Tracking / probe'));
  probe.append(field('haProbeTarget','Destino','1.1.1.1'),field('haProbeSource','Interfaz origen','GigabitEthernet0/0'),selectField('haProbeCircuit','Circuito WAN',[]),numberField('haProbeFrequency','Frecuencia s','5'),numberField('haProbeTimeout','Timeout ms','1000'));
  probe.appendChild(el('button',{className:'btn bs bsm',type:'button',id:'haAddProbe'},'➕ Añadir probe'));
  probe.appendChild(el('div',{id:'haProbeList',style:'margin-top:6px;'}));
  g.append(route,probe);card.appendChild(g);

  const fh=el('div',{style:'margin-top:12px;'});
  fh.appendChild(el('div',{className:'card-t'},'Redundancia de primer salto'));
  const row=el('div',{className:'row'});
  row.append(selectField('haFhrpProtocol','Protocolo',[['vrrp','VRRP'],['hsrp','HSRP']]),numberField('haFhrpGroup','Grupo','1'),field('haFhrpInterface','Interfaz','Vlan10'),field('haFhrpVip','IP virtual','10.10.10.1'));
  fh.appendChild(row);
  const row2=el('div',{className:'row'});
  row2.append(numberField('haFhrpPriority','Prioridad','110'),field('haFhrpTrackIf','Track interfaz','GigabitEthernet0/0'),numberField('haFhrpDecrement','Decremento','20'));
  const pre=el('div');const preLabel=el('label',{className:'chk'});preLabel.append(el('input',{id:'haFhrpPreempt',type:'checkbox',checked:true}),root.document.createTextNode(' Preempt'));pre.appendChild(preLabel);row2.appendChild(pre);fh.appendChild(row2);
  fh.appendChild(el('button',{className:'btn bs bsm',type:'button',id:'haAddFhrp'},'➕ Añadir grupo'));
  fh.appendChild(el('div',{id:'haFhrpList',style:'margin-top:6px;'}));card.appendChild(fh);
  const save=el('div',{className:'brow'});save.appendChild(el('button',{className:'btn bp',type:'button',id:'haSaveRelays'},'💾 Guardar DHCP relay'));card.appendChild(save);
  host.appendChild(card);

  root.document.getElementById('haDevice').onchange=renderHa;
  root.document.getElementById('haSaveRelays').onclick=saveRelays;
  root.document.getElementById('haAddRoute').onclick=addRoute;
  root.document.getElementById('haAddProbe').onclick=addProbe;
  root.document.getElementById('haAddFhrp').onclick=addFhrp;
  return card;
}
function selectedHaDevice(){return clean(root.document.getElementById('haDevice')?.value);}
function mutateHaDevice(mutator,source){
  const deviceId=selectedHaDevice();if(!deviceId)return root.alert&&root.alert('Selecciona un dispositivo objetivo.');
  update(project=>{
    const ha=JSON.parse(JSON.stringify(obj(project.highAvailability)));
    ha.devices=obj(ha.devices);
    const current=JSON.parse(JSON.stringify(obj(ha.devices[deviceId])));
    mutator(current);
    ha.devices[deviceId]=current;
    return{highAvailability:ha};
  },source);
}
function saveRelays(){
  const values=clean(root.document.getElementById('haRelayServers').value).split(',').map(clean).filter(Boolean);
  mutateHaDevice(x=>{x.dhcpRelayServers=values;},'ha-relays-save');
}
function addRoute(){
  const nextHop=clean(root.document.getElementById('haRouteNextHop').value);if(!nextHop)return root.alert&&root.alert('Indica next-hop.');
  const trackId=clean(root.document.getElementById('haRouteTrack').value);
  if(trackId&&!/^\d+$/.test(trackId))return root.alert&&root.alert('Track ID debe ser un entero positivo.');
  const distance=Math.max(1,Math.min(255,Math.trunc(num(root.document.getElementById('haRouteDistance').value,1)||1)));
  const rec={nextHop,distance,trackId,circuitRef:clean(root.document.getElementById('haRouteCircuit').value),description:clean(root.document.getElementById('haRouteDesc').value)};
  mutateHaDevice(x=>{x.defaultRoutes=arr(x.defaultRoutes).concat(rec);},'ha-route-add');
}
function addProbe(){
  const target=clean(root.document.getElementById('haProbeTarget').value);if(!target)return root.alert&&root.alert('Indica destino del probe.');
  mutateHaDevice(x=>{
    const list=arr(x.tracking).slice();
    const maxId=list.reduce((max,item)=>Math.max(max,Number.parseInt(item&&item.id,10)||0),0);
    const rec={id:String(maxId+1),target,sourceInterface:clean(root.document.getElementById('haProbeSource').value),circuitRef:clean(root.document.getElementById('haProbeCircuit').value),frequency:num(root.document.getElementById('haProbeFrequency').value,5)||5,timeout:num(root.document.getElementById('haProbeTimeout').value,1000)||1000};
    x.tracking=list.concat(rec);
  },'ha-probe-add');
}
function addFhrp(){
  const interfaceName=clean(root.document.getElementById('haFhrpInterface').value),virtualIp=clean(root.document.getElementById('haFhrpVip').value);
  if(!interfaceName||!virtualIp)return root.alert&&root.alert('Interfaz e IP virtual son obligatorias.');
  const group=Math.trunc(num(root.document.getElementById('haFhrpGroup').value,1)||1);
  const priority=Math.trunc(num(root.document.getElementById('haFhrpPriority').value,100)||100);
  const decrement=Math.trunc(num(root.document.getElementById('haFhrpDecrement').value,20)||20);
  if(group<1||group>255)return root.alert&&root.alert('Grupo HSRP/VRRP debe estar entre 1 y 255.');
  if(priority<1||priority>255)return root.alert&&root.alert('Prioridad HSRP/VRRP debe estar entre 1 y 255.');
  if(decrement<1||decrement>255)return root.alert&&root.alert('Decremento de tracking debe estar entre 1 y 255.');
  const rec={protocol:clean(root.document.getElementById('haFhrpProtocol').value)||'vrrp',group,interfaceName,virtualIp,priority,preempt:!!root.document.getElementById('haFhrpPreempt').checked,trackInterface:clean(root.document.getElementById('haFhrpTrackIf').value),decrement};
  mutateHaDevice(x=>{x.firstHopGroups=arr(x.firstHopGroups).concat(rec);},'ha-fhrp-add');
}
function deleteHa(kind,index){
  mutateHaDevice(x=>{x[kind]=arr(x[kind]).filter((_,i)=>i!==index);},'ha-entry-delete');
}
function renderMiniList(hostId,rows,kind,labeler){
  const host=root.document.getElementById(hostId);if(!host)return;host.textContent='';
  if(!rows.length){host.appendChild(el('div',{className:'hint'},'Sin entradas.'));return;}
  rows.forEach((item,index)=>{
    const row=el('div',{className:'hrow'}),info=el('div',{className:'hinfo'}),name=el('div',{className:'hn'},labeler(item,index)),del=el('button',{className:'btn bd bxs',type:'button'},'✕');
    info.appendChild(name);del.onclick=()=>deleteHa(kind,index);row.append(info,del);host.appendChild(row);
  });
}
function renderHa(){
  if(!haCard())return;
  const p=state(),devices=arr(p.devices).filter(d=>['router','firewall','switch'].includes(clean(d.kind||d.type))).map(d=>({value:d.id,label:(d.name||d.id)+' · '+(d.vendorOs||'sin vendor')}));
  const sel=root.document.getElementById('haDevice'),prev=sel.value;setSelectOptions(sel,devices,'— selecciona dispositivo —');
  if(prev&&devices.some(x=>x.value===prev))sel.value=prev;else if(devices.length&&!sel.value)sel.value=devices[0].value;
  const deviceId=selectedHaDevice(),ha=obj(obj(p.highAvailability).devices),cfg=obj(ha[deviceId]);
  const wanItems=arr(p.wanCircuits).filter(c=>c&&c.deviceId===deviceId&&c.enabled!==false).map(c=>({value:c.id,label:(c.name||c.id)+' · '+(c.provider||'sin proveedor')+' · '+(c.role||'—')}));
  setSelectOptions(root.document.getElementById('haRouteCircuit'),wanItems,'— circuito WAN —');
  setSelectOptions(root.document.getElementById('haProbeCircuit'),wanItems,'— circuito WAN —');
  root.document.getElementById('haRelayServers').value=arr(cfg.dhcpRelayServers).join(',');
  renderMiniList('haRouteList',arr(cfg.defaultRoutes),'defaultRoutes',r=>`${r.nextHop||'—'} · dist ${r.distance||1}${r.trackId?' · track '+r.trackId:''}${r.circuitRef?' · '+r.circuitRef:''}`);
  renderMiniList('haProbeList',arr(cfg.tracking),'tracking',r=>`${r.target||'—'} · ${r.frequency||5}s${r.sourceInterface?' · '+r.sourceInterface:''}${r.circuitRef?' · '+r.circuitRef:''}`);
  renderMiniList('haFhrpList',arr(cfg.firstHopGroups),'firstHopGroups',r=>`${String(r.protocol||'vrrp').toUpperCase()} ${r.group||1} · ${r.interfaceName||'—'} · VIP ${r.virtualIp||'—'} · prio ${r.priority||100}`);
}
function renderAll(){renderHa();}
function install(){
  if(!root.document)return false;
  const active=()=>root.document.getElementById('pg-dev')?.classList.contains('on');
  const refresh=()=>{if(active()){haCard();renderAll();}};
  root.document.addEventListener('nw:project:changed',refresh);
  root.document.addEventListener('nw:view:changed',event=>{if(event.detail?.step==='dev')refresh();});
  if(root.document.readyState==='loading')root.document.addEventListener('DOMContentLoaded',()=>root.setTimeout(refresh,80),{once:true});else root.setTimeout(refresh,0);
  return true;
}
const api={version:'netwizard-ha-services-editor-v1',renderAll,renderHa,saveRelays,addRoute,addProbe,addFhrp};
root.NetWizardHaServicesEditor=api;
if(typeof module!=='undefined'&&module.exports)module.exports=api;
if(root.document)install();
})(typeof window!=='undefined'?window:globalThis);
