/* NetWizard inter-site L3 transit editor v1
   Canonical model: existing project.ports + project.links.
   No parallel inter-site collection is introduced.
*/
(function initNetWizardInterSiteTransitEditor(root){
'use strict';

const arr=v=>Array.isArray(v)?v:[];
const clean=v=>String(v==null?'':v).trim();
function obj(v){return v&&typeof v==='object'&&!Array.isArray(v)?v:{};}
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
  return root.NetWizardState.updateProject(updater,{source:source||'inter-site-l3-transit'});
}
function isRoutingDevice(d){
  const type=clean(d&&d.type).toLowerCase(),kind=clean(d&&d.kind).toLowerCase(),vendor=clean(d&&d.vendorOs).toLowerCase();
  return ['router','firewall','l3switch','switch_l3'].includes(type)||['router','firewall','l3switch','switch_l3'].includes(kind)||
    ['pfsense','fortinet','cisco_asa'].includes(vendor)||clean(d&&d.l3Capable).toLowerCase()==='yes';
}
function ipv4Int(value){
  const parts=clean(value).split('.');
  if(parts.length!==4)return null;
  let n=0;
  for(const part of parts){
    if(!/^\d{1,3}$/.test(part))return null;
    const oct=Number(part);if(oct<0||oct>255)return null;
    n=(n<<8)|oct;
  }
  return n>>>0;
}
function parseCidr(cidr){
  const m=clean(cidr).match(/^(\d{1,3}(?:\.\d{1,3}){3})\/(\d|[12]\d|3[0-2])$/);
  if(!m)return null;
  const ip=ipv4Int(m[1]),prefix=Number(m[2]);if(ip==null)return null;
  const mask=prefix===0?0:(0xffffffff<<(32-prefix))>>>0;
  return{network:(ip&mask)>>>0,mask,prefix};
}
function contains(cidr,ip){
  const c=parseCidr(cidr),n=ipv4Int(ip);
  return !!(c&&n!=null&&((n&c.mask)>>>0)===c.network);
}
function deviceLabel(p,id){const d=arr(p.devices).find(x=>x.id===id);return d?(d.name||d.id):id;}
function field(id,label,placeholder){
  const w=el('div');w.append(el('label',{className:'fl',htmlFor:id},label),el('input',{id,placeholder:placeholder||''}));return w;
}
function selectField(id,label){
  const w=el('div'),s=el('select',{id});w.append(el('label',{className:'fl',htmlFor:id},label),s);return w;
}
function fillDevices(){
  const p=state(),devices=arr(p.devices).filter(isRoutingDevice);
  for(const id of ['nwTransitDeviceA','nwTransitDeviceB']){
    const s=root.document.getElementById(id);if(!s)continue;
    const current=s.value;s.textContent='';s.appendChild(option('','— dispositivo L3 —'));
    devices.forEach(d=>s.appendChild(option(d.id,d.name||d.id)));
    if(current&&devices.some(d=>d.id===current))s.value=current;
  }
}
function createTransit(){
  const p=state(),aId=clean(root.document.getElementById('nwTransitDeviceA').value),bId=clean(root.document.getElementById('nwTransitDeviceB').value);
  const aName=clean(root.document.getElementById('nwTransitPortA').value),bName=clean(root.document.getElementById('nwTransitPortB').value);
  const cidr=clean(root.document.getElementById('nwTransitCidr').value),aIp=clean(root.document.getElementById('nwTransitIpA').value),bIp=clean(root.document.getElementById('nwTransitIpB').value);
  const name=clean(root.document.getElementById('nwTransitName').value)||[deviceLabel(p,aId),deviceLabel(p,bId)].filter(Boolean).join(' ↔ ');
  const notes=clean(root.document.getElementById('nwTransitNotes').value)||'Tránsito L3 inter-sede';
  if(!aId||!bId||aId===bId)return root.alert&&root.alert('Selecciona dos dispositivos L3 distintos.');
  if(!aName||!bName)return root.alert&&root.alert('Indica el nombre de interfaz en ambos extremos.');
  if(!parseCidr(cidr))return root.alert&&root.alert('Indica una red de tránsito CIDR válida, por ejemplo 10.255.0.0/30.');
  if(!contains(cidr,aIp)||!contains(cidr,bIp)||aIp===bIp)return root.alert&&root.alert('Las dos IP deben ser distintas y pertenecer a la red de tránsito.');
  if(arr(p.ports).some(x=>x.deviceId===aId&&clean(x.name)===aName))return root.alert&&root.alert('La interfaz A ya existe en ese dispositivo.');
  if(arr(p.ports).some(x=>x.deviceId===bId&&clean(x.name)===bName))return root.alert&&root.alert('La interfaz B ya existe en ese dispositivo.');

  const portA=uid('port'),portB=uid('port'),linkId=uid('lnk');
  update(project=>({
    ports:arr(project.ports).concat(
      {id:portA,deviceId:aId,name:aName,mode:'routed',role:'transit',media:'GE',l3Ip:aIp,l3Cidr:cidr,desc:'Tránsito inter-sede a '+deviceLabel(project,bId)},
      {id:portB,deviceId:bId,name:bName,mode:'routed',role:'transit',media:'GE',l3Ip:bIp,l3Cidr:cidr,desc:'Tránsito inter-sede a '+deviceLabel(project,aId)}
    ),
    links:arr(project.links).concat({id:linkId,name,aPortId:portA,bPortId:portB,notes,medium:'logical',cableType:'provider',lengthM:null,speed:'auto'})
  }),'inter-site-transit-create');
}
function renderList(){
  const p=state(),host=root.document.getElementById('nwTransitList');if(!host)return;
  host.textContent='';
  const portById=new Map(arr(p.ports).map(x=>[x.id,x]));
  const items=arr(p.links).filter(l=>{
    const a=portById.get(l.aPortId),b=portById.get(l.bPortId);
    return a&&b&&a.mode==='routed'&&b.mode==='routed'&&(a.role==='transit'||b.role==='transit');
  });
  if(!items.length){host.appendChild(el('div',{className:'hint'},'Todavía no hay enlaces routed de tránsito inter-sede.'));return;}
  items.forEach(l=>{
    const a=portById.get(l.aPortId),b=portById.get(l.bPortId);
    const row=el('div',{className:'hrow'});
    const info=el('div',{className:'hinfo'});
    info.append(el('div',{className:'hn'},l.name||l.id),el('div',{className:'hm'},`${deviceLabel(p,a.deviceId)} ${a.name} ${a.l3Ip} ↔ ${deviceLabel(p,b.deviceId)} ${b.name} ${b.l3Ip} · ${a.l3Cidr||b.l3Cidr}`));
    row.appendChild(info);host.appendChild(row);
  });
}
function render(){fillDevices();renderList();}
function install(){
  if(!root.document||root.document.getElementById('nwInterSiteTransitCard'))return;
  const host=root.document.getElementById('pg-links');if(!host)return;
  const card=el('div',{className:'card',id:'nwInterSiteTransitCard',style:'margin-top:12px;'});
  const head=el('div',{className:'card-h'});head.append(el('div',{className:'card-t'},'🌐 Tránsito L3 inter-sede'),el('span',{className:'b bac'},'ports + links'));
  card.append(head,el('div',{className:'hint',style:'margin-bottom:10px;'},'Crea un enlace routed punto a punto entre dos routers/firewalls usando las autoridades existentes de puertos y enlaces. Las VLAN permanecen locales a cada sede.'));
  const g1=el('div',{className:'g2'});g1.append(selectField('nwTransitDeviceA','Dispositivo A'),field('nwTransitPortA','Interfaz A','GigabitEthernet0/1'));
  const g2=el('div',{className:'g2'});g2.append(selectField('nwTransitDeviceB','Dispositivo B'),field('nwTransitPortB','Interfaz B','GigabitEthernet0/1'));
  const g3=el('div',{className:'g2'});g3.append(field('nwTransitCidr','Red de tránsito','10.255.0.0/30'),field('nwTransitName','Nombre del enlace','CENTRAL ↔ NORTE'));
  const g4=el('div',{className:'g2'});g4.append(field('nwTransitIpA','IP A','10.255.0.1'),field('nwTransitIpB','IP B','10.255.0.2'));
  card.append(g1,g2,g3,g4,field('nwTransitNotes','Servicio / notas','MPLS, Ethernet privado, VPN overlay...'));
  const actions=el('div',{className:'brow'});actions.appendChild(el('button',{className:'btn bp',type:'button',id:'nwTransitCreate'},'➕ Crear tránsito L3'));card.appendChild(actions);
  card.appendChild(el('div',{id:'nwTransitList',style:'margin-top:10px;'}));
  host.appendChild(card);
  root.document.getElementById('nwTransitCreate').onclick=createTransit;
  render();
}
const api={version:'netwizard-inter-site-transit-editor-v1',install,render,isRoutingDevice,parseCidr,contains};
root.NetWizardInterSiteTransitEditor=api;
if(typeof module!=='undefined'&&module.exports)module.exports=api;
if(root.document){
  const active=()=>root.document.getElementById('pg-links')?.classList.contains('on');
  const refresh=()=>{if(active()){try{install();render();}catch(err){if(root.console)root.console.error('NetWizard inter-site transit',err);}}};
  if(root.document.readyState==='loading')root.document.addEventListener('DOMContentLoaded',refresh);
  else refresh();
  root.document.addEventListener('nw:project:changed',refresh);
  root.document.addEventListener('nw:view:changed',event=>{if(event.detail?.step==='links')refresh();});
}
})(typeof window!=='undefined'?window:globalThis);
