/* NetWizard OSPF Editor v1
   Edits project.routing.ospf.devices[deviceId] and observedState.ospfNeighbors.
*/
(function initNetWizardOspfEditor(root){
'use strict';

const arr=v=>Array.isArray(v)?v:[];
const obj=v=>v&&typeof v==='object'&&!Array.isArray(v)?v:{};
const clean=v=>String(v==null?'':v).trim();

function el(tag,attrs,text){
  const node=root.document.createElement(tag);
  Object.entries(attrs||{}).forEach(([k,v])=>{
    if(k==='className')node.className=v;
    else if(k==='htmlFor')node.htmlFor=v;
    else if(k==='checked')node.checked=!!v;
    else if(k==='value')node.value=v==null?'':String(v);
    else if(v!=null)node.setAttribute(k,String(v));
  });
  if(text!=null)node.textContent=String(text);
  return node;
}
function option(value,label){return el('option',{value},label);}
function clone(v){return JSON.parse(JSON.stringify(v==null?{}:v));}
function state(){return root.NetWizardState&&root.NetWizardState.getSnapshot?root.NetWizardState.getSnapshot():{};}
function update(updater,source){
  if(!root.NetWizardState||typeof root.NetWizardState.updateProject!=='function')throw new Error('NetWizardState unavailable');
  return root.NetWizardState.updateProject(updater,{source:source||'ospf-editor'});
}
function model(){return root.NetWizardOspf;}
function isRoutingDevice(d){
  const type=clean(d&&d.type||d&&d.kind).toLowerCase(),vendor=clean(d&&d.vendorOs).toLowerCase();
  return ['router','firewall','l3switch','switch_l3'].includes(type)||['fortinet','pfsense','cisco_asa'].includes(vendor)||clean(d&&d.l3Capable).toLowerCase()==='yes';
}
function devices(p){return arr(p&&p.devices).filter(isRoutingDevice).sort((a,b)=>clean(a.name||a.id).localeCompare(clean(b.name||b.id),'es'));}
function currentDeviceId(){return clean(root.document.getElementById('nwOspfDevice')?.value);}
function field(label,control){const w=el('div');const l=el('label',{className:'fl'},label);if(control.id)l.htmlFor=control.id;w.append(l,control);return w;}
function input(id,value,type){return el('input',{id,type:type||'text',value:value==null?'':value});}
function select(id){return el('select',{id});}

function observedFor(p,deviceId){
  return arr(obj(obj(p&&p.observedState).ospfNeighbors)[deviceId]);
}
function setObservedNeighbor(exp,stateValue){
  const now=new Date().toISOString();
  update(project=>{
    const observed=clone(project.observedState||{});
    observed.observedAt=now;
    observed.ospfNeighbors=obj(observed.ospfNeighbors);
    const list=arr(observed.ospfNeighbors[exp.deviceId]).filter(x=>!(clean(x.localPortId)===exp.localPortId&&(clean(x.peerRouterId)===exp.peerRouterId||clean(x.peerDeviceId)===exp.peerDeviceId)));
    if(stateValue){
      list.push({
        localPortId:exp.localPortId,peerDeviceId:exp.peerDeviceId,peerRouterId:exp.peerRouterId,
        area:exp.area,state:stateValue,observedAt:now
      });
    }
    observed.ospfNeighbors[exp.deviceId]=list;
    return{observedState:observed};
  },'ospf-observed-neighbor');
}
function renderNeighbors(p,deviceId,host){
  host.textContent='';
  if(!deviceId)return;
  const expected=model().expectedNeighbors(p).filter(x=>x.deviceId===deviceId);
  const compared=model().compareObserved(p,deviceId);
  const title=el('div',{className:'card-t',style:'font-size:12px;margin-top:12px;'},'Vecinos esperados ↔ Observed');
  host.appendChild(title);
  if(!expected.length){host.appendChild(el('div',{className:'hint'},'No hay vecinos OSPF esperados. Activa interfaces enlazadas y usa la misma área en ambos extremos.'));return;}
  for(const exp of expected){
    const rowStatus=compared.expected.find(x=>x.localPortId===exp.localPortId&&x.peerDeviceId===exp.peerDeviceId);
    const row=el('div',{className:'hrow'});
    const info=el('div',{className:'hinfo'});
    const status=rowStatus?.status||'missing';
    info.append(
      el('div',{className:'hn'},exp.localPortName+' ↔ '+(arr(p.devices).find(d=>d.id===exp.peerDeviceId)?.name||exp.peerDeviceId)),
      el('div',{className:'hm'},'Área '+exp.area+' · peer router-id '+exp.peerRouterId+' · Observed '+status.toUpperCase())
    );
    const actions=el('div',{className:'brow',style:'margin:0;'});
    const full=el('button',{className:'btn bs bxs',type:'button'},'FULL');
    const down=el('button',{className:'btn bs bxs',type:'button'},'DOWN');
    const clear=el('button',{className:'btn bs bxs',type:'button'},'Limpiar');
    full.onclick=()=>setObservedNeighbor(exp,'full');
    down.onclick=()=>setObservedNeighbor(exp,'down');
    clear.onclick=()=>setObservedNeighbor(exp,'');
    actions.append(full,down,clear);row.append(info,actions);host.appendChild(row);
  }
}
function renderForm(){
  const p=state(),deviceId=currentDeviceId(),body=root.document.getElementById('nwOspfBody');if(!body)return;
  body.textContent='';
  if(!deviceId){body.appendChild(el('div',{className:'hint'},'Selecciona un dispositivo L3.'));return;}
  const cfg=model().deviceConfig(p,deviceId),intent=model().buildDeviceIntent(p,deviceId);
  const processId=input('nwOspfProcessId',cfg.processId,'number');processId.min='1';processId.max='65535';
  const routerId=input('nwOspfRouterId',cfg.routerId||'1.1.1.1');
  const defaultArea=input('nwOspfDefaultArea',cfg.defaultArea||'0');
  const passiveDefault=input('nwOspfPassiveDefault','','checkbox');passiveDefault.checked=cfg.passiveDefault!==false;
  const top=el('div',{className:'g4'});top.append(field('Process ID',processId),field('Router ID',routerId),field('Área por defecto',defaultArea),field('Passive default',passiveDefault));
  body.appendChild(top);

  const portWrap=el('div',{id:'nwOspfInterfaces'});
  const routed=model().routedPorts(p,deviceId);
  if(!routed.length)portWrap.appendChild(el('div',{className:'hint'},'Este dispositivo no tiene puertos routed con CIDR.'));
  for(const port of routed){
    const icfg=model().interfaceConfig(p,deviceId,port);
    const row=el('div',{className:'card',style:'padding:9px;margin-top:7px;'});
    const enabled=input('','','checkbox');enabled.checked=icfg.enabled;enabled.dataset.ospfEnabled=port.id;
    const area=input('',icfg.area);area.dataset.ospfArea=port.id;
    const passive=input('','','checkbox');passive.checked=icfg.passive;passive.dataset.ospfPassive=port.id;
    const cost=input('',icfg.cost==null?'':icfg.cost,'number');cost.min='1';cost.max='65535';cost.dataset.ospfCost=port.id;
    const grid=el('div',{className:'g4'});
    grid.append(
      field((port.name||port.id)+' · '+icfg.cidr,enabled),
      field('Área',area),
      field('Passive',passive),
      field('Coste',cost)
    );
    row.appendChild(grid);portWrap.appendChild(row);
  }
  body.appendChild(portWrap);

  const status=el('div',{id:'nwOspfStatus',className:intent.ok?'co co-gn':'co co-rd',style:'margin-top:8px;'},
    intent.ok?'✓ Intención OSPF válida para este dispositivo.':intent.issues.map(x=>x.message).join(' '));
  body.appendChild(status);

  const actions=el('div',{className:'brow'});
  const save=el('button',{className:'btn bp',type:'button',id:'nwOspfSave'},'💾 Activar / guardar OSPF');
  actions.appendChild(save);body.appendChild(actions);

  const neighbors=el('div',{id:'nwOspfNeighbors'});
  body.appendChild(neighbors);
  renderNeighbors(p,deviceId,neighbors);

  save.onclick=()=>{
    const process=Number(processId.value),rid=clean(routerId.value),areaDefault=clean(defaultArea.value);
    const interfaces={};
    for(const port of routed){
      const enabledEl=body.querySelector('[data-ospf-enabled="'+port.id+'"]');
      const areaEl=body.querySelector('[data-ospf-area="'+port.id+'"]');
      const passiveEl=body.querySelector('[data-ospf-passive="'+port.id+'"]');
      const costEl=body.querySelector('[data-ospf-cost="'+port.id+'"]');
      interfaces[port.id]={
        enabled:!!enabledEl?.checked,
        area:clean(areaEl?.value)||areaDefault,
        passive:!!passiveEl?.checked,
        cost:clean(costEl?.value)===''?null:Number(costEl.value)
      };
    }
    const candidate=clone(p);
    candidate.routing=obj(candidate.routing);
    candidate.routing.protocol='ospf';candidate.routing.strategy='ospf';
    candidate.routing.ospf=obj(candidate.routing.ospf);candidate.routing.ospf.devices=obj(candidate.routing.ospf.devices);
    candidate.routing.ospf.devices[deviceId]={
      processId:process,routerId:rid,defaultArea:areaDefault,passiveDefault:!!passiveDefault.checked,interfaces
    };
    const check=model().buildDeviceIntent(candidate,deviceId);
    if(!check.ok){
      status.className='co co-rd';status.textContent=check.issues.filter(x=>x.blocking).map(x=>x.message).join(' ');return;
    }
    update(project=>{
      const routing=clone(obj(project.routing));
      routing.protocol='ospf';routing.strategy='ospf';
      routing.ospf=obj(routing.ospf);routing.ospf.devices=obj(routing.ospf.devices);
      routing.ospf.devices[deviceId]={
        processId:process,routerId:rid,defaultArea:areaDefault,passiveDefault:!!passiveDefault.checked,interfaces
      };
      return{routing};
    },'ospf-device-save');
  };
}
function render(){
  if(!root.document||!model())return;
  const host=root.document.getElementById('pg-dev');if(!host)return;
  let card=root.document.getElementById('nwOspfCard');
  if(!card){
    card=el('div',{className:'card',id:'nwOspfCard',style:'margin-top:12px;'});
    const head=el('div',{className:'card-h'});head.append(el('div',{className:'card-t'},'🧭 OSPF dinámico'),el('span',{className:'b bac'},'routing.ospf'));
    const intro=el('div',{className:'hint'},'Configura OSPF por router e interfaz. Las LAN locales se anuncian pasivas; las interfaces de tránsito forman vecinos solo cuando ambos extremos están activos y comparten área.');
    const dev=select('nwOspfDevice');dev.appendChild(option('','— dispositivo L3 —'));
    card.append(head,intro,field('Dispositivo',dev),el('div',{id:'nwOspfBody'}));host.appendChild(card);
    dev.onchange=renderForm;
  }
  const devSel=root.document.getElementById('nwOspfDevice'),current=devSel.value,p=state(),items=devices(p);
  devSel.textContent='';devSel.appendChild(option('','— dispositivo L3 —'));items.forEach(d=>devSel.appendChild(option(d.id,d.name||d.id)));
  if(current&&items.some(d=>d.id===current))devSel.value=current;
  else if(items.length)devSel.value=items[0].id;
  renderForm();
}
function install(){
  if(!root.document)return false;
  const active=()=>root.document.getElementById('pg-dev')?.classList.contains('on');
  const refresh=()=>{if(active()){try{render();}catch(err){root.console?.error('NetWizard OSPF editor',err);}}};
  root.document.addEventListener('nw:project:changed',refresh);
  root.document.addEventListener('nw:view:changed',event=>{if(event.detail?.step==='dev')refresh();});
  if(root.document.readyState==='loading')root.document.addEventListener('DOMContentLoaded',refresh);else refresh();
  return true;
}
const api={version:'netwizard-ospf-editor-v1',render,install,setObservedNeighbor};
root.NetWizardOspfEditor=api;
if(typeof module!=='undefined'&&module.exports)module.exports=api;
if(root.document)install();
})(typeof window!=='undefined'?window:globalThis);
