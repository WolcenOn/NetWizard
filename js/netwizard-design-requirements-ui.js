/* NetWizard Design Golden Path UI v1
 * Integra el dimensionamiento por ubicación en Paso 0 · Ubicaciones.
 */
(function initNetWizardDesignRequirementsUi(root){
'use strict';

const arr=v=>Array.isArray(v)?v:[];
const obj=v=>v&&typeof v==='object'&&!Array.isArray(v)?v:{};
const clean=v=>String(v==null?'':v).trim();
const num=(v,fallback=0)=>{const n=Number(v);return Number.isFinite(n)?n:fallback;};
const clone=v=>JSON.parse(JSON.stringify(v==null?null:v));
const planner=()=>root.NetWizardDesignRequirements||null;
const state=()=>root.NetWizardState||null;
const el=id=>root.document&&root.document.getElementById(id);
let selectedLocationId='';

function uid(prefix){return prefix+'-'+Math.random().toString(36).slice(2,8)+Date.now().toString(36).slice(-5);}
function make(tag,attrs,text){
  const n=root.document.createElement(tag);
  for(const [k,v] of Object.entries(attrs||{})){
    if(k==='className')n.className=v;
    else if(k==='htmlFor')n.htmlFor=v;
    else if(k==='checked')n.checked=!!v;
    else if(k==='disabled')n.disabled=!!v;
    else n.setAttribute(k,v);
  }
  if(text!=null)n.textContent=String(text);
  return n;
}
function field(label,node){const w=make('div');w.append(make('label',{className:'fl'},label),node);return w;}
function option(value,label){return make('option',{value},label);}
function selectNode(id,items){const s=make('select',{id});for(const [v,l] of items)s.append(option(v,l));return s;}
function inputNode(id,type,placeholder){return make('input',{id,type:type||'text',placeholder:placeholder||''});}

function defaultLocationPlan(locationId){
  const P=planner(),d=P&&P.defaults||{};
  return {
    id:uid('location-plan'),
    locationId,
    rackMode:'own',
    servingLocationId:'',
    capacityPolicy:clone(d.capacityPolicy||{portGrowthPercent:20,minFreePorts:8,rackGrowthPercent:20,minFreeRackUnits:4}),
    rackPolicy:clone(d.rackPolicy||{patchPanelPorts:24,organizerPerSwitch:true,layoutPattern:'patch-manager-switch'}),
    demands:[]
  };
}
function projectRequirements(project){
  const P=planner();
  return P?P.normalizeRequirements(project):{version:'netwizard-design-requirements-v1',capacityPolicy:{},rackPolicy:{},locationPlans:[]};
}
function upsertLocationPlan(project,plan){
  const next=clone(project||{}),req=projectRequirements(next),list=arr(req.locationPlans).slice();
  const idx=list.findIndex(x=>x.locationId===plan.locationId);
  const normalized=planner().normalizeLocationPlan(Object.assign({},idx>=0?list[idx]:{},plan),idx>=0?idx:list.length);
  if(idx>=0)list[idx]=normalized;else list.push(normalized);
  next.designRequirements=Object.assign({},req,{locationPlans:list});
  return next;
}
function upsertDemand(project,locationId,demand){
  const req=projectRequirements(project),current=req.locationPlans.find(x=>x.locationId===locationId)||defaultLocationPlan(locationId);
  const demands=arr(current.demands).slice(),idx=demands.findIndex(x=>x.id===demand.id);
  const item=planner().normalizeDemand(demand,idx>=0?idx:demands.length);
  if(idx>=0)demands[idx]=item;else demands.push(item);
  return upsertLocationPlan(project,Object.assign({},current,{demands}));
}
function removeDemand(project,locationId,demandId){
  const req=projectRequirements(project),current=req.locationPlans.find(x=>x.locationId===locationId);
  if(!current)return clone(project||{});
  return upsertLocationPlan(project,Object.assign({},current,{demands:arr(current.demands).filter(x=>x.id!==demandId)}));
}

function getSnapshot(){return state()?.getSnapshot?.()||null;}
function locations(project){return arr(project&&project.physicalLocations);}
function locationLabel(project,id){const l=locations(project).find(x=>x.id===id);return l?l.name||l.id:id||'—';}
function currentPlan(project){
  const req=projectRequirements(project),found=req.locationPlans.find(x=>x.locationId===selectedLocationId);
  return found||defaultLocationPlan(selectedLocationId);
}
function valuesFromForm(project){
  const current=currentPlan(project);
  return Object.assign({},current,{
    rackMode:clean(el('nwReqRackMode')?.value)||'own',
    servingLocationId:clean(el('nwReqServingLocation')?.value),
    capacityPolicy:{
      portGrowthPercent:num(el('nwReqPortGrowth')?.value,20),
      minFreePorts:num(el('nwReqMinFreePorts')?.value,8),
      rackGrowthPercent:num(el('nwReqRackGrowth')?.value,20),
      minFreeRackUnits:num(el('nwReqMinFreeU')?.value,4)
    },
    rackPolicy:{
      patchPanelPorts:num(el('nwReqPatchPanelPorts')?.value,24),
      organizerPerSwitch:el('nwReqOrganizer')?.checked!==false,
      layoutPattern:clean(el('nwReqLayoutPattern')?.value)||'patch-manager-switch'
    }
  });
}
function saveCriteria(){
  const S=state(),snap=getSnapshot();if(!S||!snap||!selectedLocationId)return;
  S.replaceProject(upsertLocationPlan(snap,valuesFromForm(snap)),{source:'design-requirements-ui'});
}
function addDemand(){
  const S=state(),snap=getSnapshot();if(!S||!snap||!selectedLocationId)return;
  let next=upsertLocationPlan(snap,valuesFromForm(snap));
  const count=Math.max(0,Math.floor(num(el('nwReqDemandCount')?.value,0)));
  if(!count)return root.alert('Indica una cantidad mayor que 0.');
  const label=clean(el('nwReqDemandLabel')?.value)||clean(el('nwReqDemandCategory')?.selectedOptions?.[0]?.textContent)||'Conexiones';
  const poe=el('nwReqDemandPoe')?.checked===true;
  next=upsertDemand(next,selectedLocationId,{
    id:uid('demand'),label,category:clean(el('nwReqDemandCategory')?.value)||'other',count,
    media:clean(el('nwReqDemandMedia')?.value)||'copper',
    speedMinMbps:num(el('nwReqDemandSpeed')?.value,1000),
    poeRequired:poe,poeWattsEach:poe?Math.max(0,num(el('nwReqDemandPoeWatts')?.value,0)):0,
    notes:''
  });
  S.replaceProject(next,{source:'design-requirements-ui'});
}
function doMaterialize(){
  const S=state(),snap=getSnapshot(),P=planner();if(!S||!snap||!P||!selectedLocationId)return;
  const staged=upsertLocationPlan(snap,valuesFromForm(snap));
  const result=P.materializeLocationPlan(staged,selectedLocationId);
  if(!result.ok)return root.alert(result.message||'No se ha podido crear la infraestructura propuesta.');
  const c=result.created||{};
  const msg=[
    'Se crearán:',
    `${c.racks||0} rack(s)`,
    `${c.devices||0} switch(es)`,
    `${c.ports||0} puerto(s)`,
    `${c.patchPanels||0} patch panel(s)`,
    `${c.organizers||0} organizador(es)`,
    c.fiberPanels?`${c.fiberPanels} panel(es) de fibra`:null,
    '',
    'Los switches son propuestas genéricas. Después debes seleccionar los modelos reales.'
  ].filter(x=>x!=null).join('\n');
  if(!root.confirm(msg+'\n\n¿Crear esta infraestructura?'))return;
  S.replaceProject(result.project,{source:'design-requirements-materialize'});
}

function renderLocationOptions(project){
  const sel=el('nwReqLocation');if(!sel)return;
  const locs=locations(project),current=selectedLocationId;
  sel.textContent='';sel.append(option('','— selecciona ubicación —'));
  for(const l of locs)sel.append(option(l.id,l.name||l.id));
  if(current&&locs.some(l=>l.id===current))sel.value=current;
  else if(locs.length){selectedLocationId=locs[0].id;sel.value=selectedLocationId;}
}
function renderServingOptions(project,plan){
  const sel=el('nwReqServingLocation');if(!sel)return;
  sel.textContent='';sel.append(option('','— selecciona ubicación con rack —'));
  for(const l of locations(project).filter(x=>x.id!==selectedLocationId))sel.append(option(l.id,l.name||l.id));
  sel.value=plan.servingLocationId||'';
  const wrap=el('nwReqServingWrap');if(wrap)wrap.style.display=plan.rackMode==='served'?'':'none';
}
function fillPolicy(plan){
  const cp=plan.capacityPolicy||{},rp=plan.rackPolicy||{};
  el('nwReqRackMode').value=plan.rackMode||'own';
  el('nwReqPortGrowth').value=cp.portGrowthPercent??20;
  el('nwReqMinFreePorts').value=cp.minFreePorts??8;
  el('nwReqRackGrowth').value=cp.rackGrowthPercent??20;
  el('nwReqMinFreeU').value=cp.minFreeRackUnits??4;
  el('nwReqPatchPanelPorts').value=rp.patchPanelPorts??24;
  el('nwReqOrganizer').checked=rp.organizerPerSwitch!==false;
  el('nwReqLayoutPattern').value=rp.layoutPattern||'patch-manager-switch';
}
function renderDemands(project,plan){
  const host=el('nwReqDemandList');if(!host)return;host.textContent='';
  if(!arr(plan.demands).length){host.append(make('div',{className:'hint'},'Aún no hay conexiones necesarias definidas para esta ubicación.'));return;}
  for(const d of plan.demands){
    const row=make('div',{className:'hrow'});
    const info=make('div',{className:'hinfo'});
    info.append(make('div',{className:'hn'},`${d.label} · ${d.count}`));
    const meta=[
      d.media||'copper',`${d.speedMinMbps||1000} Mbps`,
      d.poeRequired?`PoE ${d.poeWattsEach||0} W/u`:'sin PoE'
    ].join(' · ');
    info.append(make('div',{className:'hm'},meta));
    const b=make('button',{type:'button',className:'btn bd bxs','data-demand-id':d.id},'🗑');
    b.onclick=()=>{
      const S=state(),snap=getSnapshot();if(!S||!snap)return;
      S.replaceProject(removeDemand(snap,selectedLocationId,d.id),{source:'design-requirements-ui'});
    };
    row.append(info,b);host.append(row);
  }
}
function switchDescription(sw,index){
  return `SW${index+1}: ${sw.ports}p ${sw.speedClass==='multigig'?'2.5G':'1G'}${sw.poeRequired?` PoE (≥${sw.poePortsRequired}p / ≥${sw.minimumPoeBudgetWatts}W`:'')${sw.poeRequired?')':''}`;
}
function renderSummary(project,plan){
  const host=el('nwReqSummary');if(!host)return;host.textContent='';
  const P=planner();if(!P||!selectedLocationId)return;
  const local=P.summarizeDemands(plan.demands,plan.capacityPolicy);
  const resolved=P.resolveServingLocation(project,selectedLocationId);
  const targetId=resolved.ok?resolved.locationId:null;
  const targetPlan=targetId?P.buildLocationPlan(project,targetId):null;
  const card=make('div',{className:'co co-ac'});
  if(plan.rackMode==='served'){
    card.append(make('b',{},targetId?`Esta ubicación será servida desde: ${locationLabel(project,targetId)}`:'Falta seleccionar la ubicación que dará servicio.'));
    card.append(make('div',{className:'hint'},`Demanda local: ${local.currentPorts} conexiones · objetivo local con margen: ${local.targetPorts}.`));
  }else if(plan.rackMode==='none'){
    card.append(make('b',{},'Sin rack ni dependencia de red local.'));
    card.append(make('div',{className:'hint'},`Demanda documentada: ${local.currentPorts} conexiones. No se materializará infraestructura.`));
  }else{
    card.append(make('b',{},`Capacidad objetivo: ${targetPlan.summary.targetPorts} puertos (${targetPlan.summary.currentPorts} actuales + ${targetPlan.summary.freePortReserve} de reserva)`));
  }
  if(targetPlan){
    const s=targetPlan.summary,r=targetPlan.rack;
    const stats=make('div',{className:'hint'});
    stats.textContent=[
      `Cobre objetivo: ${s.targetCopperPorts}`,
      `multigig: ${s.targetMultigigPorts}`,
      `PoE: ${s.targetPoePorts} puertos / ≥${s.targetPoeWatts} W`,
      `fibra: ${s.targetFiberPorts}`
    ].join(' · ');
    card.append(stats);
    const ul=make('ul');
    for(let i=0;i<targetPlan.switches.length;i++)ul.append(make('li',{},switchDescription(targetPlan.switches[i],i)));
    if(!targetPlan.switches.length)ul.append(make('li',{},'Sin switches de acceso necesarios.'));
    card.append(ul);
    card.append(make('div',{className:'hint'},`Rack: ${r.rackCount} × ${r.rackUnits}U · ${r.patchPanels} patch panel(s) · ${r.organizerUnits} organizador(es) · ${r.reserveUnits}U reservadas · ${r.freeRackUnits-r.reserveUnits}U libres adicionales.`));
    if(targetPlan.contributors.length>1)card.append(make('div',{className:'hint'},`Incluye demanda de: ${targetPlan.contributors.map(id=>locationLabel(project,id)).join(', ')}.`));
  }
  host.append(card);
  const materialize=el('nwReqMaterialize');
  if(materialize)materialize.disabled=plan.rackMode!=='own'||!targetPlan||!targetPlan.summary.targetPorts||plan.rackPolicy?.layoutPattern==='manual';
}
function render(){
  const snap=getSnapshot();if(!snap)return;
  const card=el('nwDesignGoldenPath');
  if(card)card.style.display=(snap.workflow&&snap.workflow.mode==='inventory')?'none':'';
  if(snap.workflow&&snap.workflow.mode==='inventory')return;
  const locs=locations(snap),empty=el('nwReqEmpty'),body=el('nwReqBody');
  if(empty)empty.style.display=locs.length?'none':'';
  if(body)body.style.display=locs.length?'':'none';
  if(!locs.length)return;
  renderLocationOptions(snap);
  const plan=currentPlan(snap);
  fillPolicy(plan);renderServingOptions(snap,plan);renderDemands(snap,plan);renderSummary(snap,plan);
}
function buildUi(){
  if(!root.document||el('nwDesignGoldenPath'))return !!el('nwDesignGoldenPath');
  const column=root.document.querySelector('#pg-loc .g2 > div:nth-child(2)');
  if(!column)return false;
  const card=make('div',{className:'card',id:'nwDesignGoldenPath'});
  const head=make('div',{className:'card-h'});
  head.append(make('div',{className:'card-t'},'⭐ Golden Path · Dimensionar por ubicación'));
  card.append(head,make('div',{className:'hint'},'Empieza por dónde está cada grupo de equipos. NetWizard calcula puertos, margen, switches, patch panels y rack antes del diseño lógico.'));
  const empty=make('div',{id:'nwReqEmpty',className:'co co-yw'},'Primero crea al menos una ubicación física.');
  card.append(empty);
  const body=make('div',{id:'nwReqBody'});

  const loc=selectNode('nwReqLocation',[]);
  const mode=selectNode('nwReqRackMode',[['own','Rack propio'],['served','Depende de otra ubicación/rack'],['none','Sin infraestructura local']]);
  const row1=make('div',{className:'row'});row1.append(field('Ubicación',loc),field('Infraestructura de red',mode));
  body.append(row1);
  const serving=selectNode('nwReqServingLocation',[]);
  const servingWrap=field('Servida desde',serving);servingWrap.id='nwReqServingWrap';body.append(servingWrap);

  body.append(make('div',{className:'card-t'},'Margen y organización'));
  const row2=make('div',{className:'row'});
  row2.append(field('Margen puertos %',inputNode('nwReqPortGrowth','number','20')),field('Mínimo puertos libres',inputNode('nwReqMinFreePorts','number','8')));
  body.append(row2);
  const row3=make('div',{className:'row'});
  row3.append(field('Margen rack %',inputNode('nwReqRackGrowth','number','20')),field('Mínimo U libres',inputNode('nwReqMinFreeU','number','4')));
  body.append(row3);
  const row4=make('div',{className:'row'});
  row4.append(field('Puertos por patch panel',inputNode('nwReqPatchPanelPorts','number','24')),field('Patrón rack',selectNode('nwReqLayoutPattern',[['patch-manager-switch','Patch panel + organizador + switch'],['patch-switch','Patch panel + switch'],['manual','Manual']])));
  body.append(row4);
  const organizer=make('label',{className:'chk'});organizer.append(make('input',{id:'nwReqOrganizer',type:'checkbox',checked:true}),root.document.createTextNode(' Reservar organizador horizontal por switch'));body.append(organizer);
  const save=make('button',{type:'button',className:'btn bs bsm',id:'nwReqSaveCriteria'},'💾 Guardar criterios');body.append(make('div',{className:'brow'},null));body.lastChild.append(save);

  body.append(make('div',{className:'card-t'},'Equipos / conexiones necesarias'));
  const row5=make('div',{className:'row'});
  row5.append(field('Tipo',selectNode('nwReqDemandCategory',[['user','Puestos/usuarios'],['phone','Teléfonos IP'],['access_point','AP WiFi'],['camera','Cámaras'],['printer','Impresoras'],['server','Servidores'],['access_control','Control de acceso'],['uplink','Uplink / troncal'],['other','Otro']])),field('Descripción',inputNode('nwReqDemandLabel','text','Puestos planta 1')));
  body.append(row5);
  const row6=make('div',{className:'row'});
  row6.append(field('Cantidad',inputNode('nwReqDemandCount','number','24')),field('Velocidad mínima Mbps',inputNode('nwReqDemandSpeed','number','1000')));
  body.append(row6);
  const row7=make('div',{className:'row'});
  row7.append(field('Medio',selectNode('nwReqDemandMedia',[['copper','Cobre'],['fiber','Fibra']])),field('PoE por equipo W',inputNode('nwReqDemandPoeWatts','number','15')));
  body.append(row7);
  const poe=make('label',{className:'chk'});poe.append(make('input',{id:'nwReqDemandPoe',type:'checkbox'}),root.document.createTextNode(' Requiere PoE'));body.append(poe);
  const add=make('button',{type:'button',className:'btn bp bsm',id:'nwReqAddDemand'},'➕ Añadir necesidad');const brow=make('div',{className:'brow'});brow.append(add);body.append(brow);
  body.append(make('div',{id:'nwReqDemandList'}));

  body.append(make('div',{className:'card-t'},'Propuesta de capacidad'));
  body.append(make('div',{id:'nwReqSummary'}));
  const materialize=make('button',{type:'button',className:'btn bp',id:'nwReqMaterialize'},'🏗 Crear infraestructura propuesta');
  const actions=make('div',{className:'brow'});actions.append(materialize);body.append(actions);
  body.append(make('div',{className:'hint'},'La creación es explícita: genera entidades canónicas (rack, switches, puertos, patch panels y organizadores). No crea VLANs, routing ni configuración lógica.'));

  card.append(body);column.append(card);

  loc.onchange=()=>{selectedLocationId=loc.value;render();};
  mode.onchange=()=>{const snap=getSnapshot();if(!snap)return;const p=valuesFromForm(snap);renderServingOptions(snap,p);renderSummary(upsertLocationPlan(snap,p),p);};
  serving.onchange=()=>{const snap=getSnapshot();if(!snap)return;const p=valuesFromForm(snap);renderSummary(upsertLocationPlan(snap,p),p);};
  for(const id of ['nwReqPortGrowth','nwReqMinFreePorts','nwReqRackGrowth','nwReqMinFreeU','nwReqPatchPanelPorts','nwReqLayoutPattern','nwReqOrganizer']){
    el(id)?.addEventListener('change',()=>{const snap=getSnapshot();if(!snap)return;const p=valuesFromForm(snap);renderSummary(upsertLocationPlan(snap,p),p);});
  }
  save.onclick=saveCriteria;add.onclick=addDemand;materialize.onclick=doMaterialize;
  return true;
}
function install(attempt){
  if(!root.document)return false;
  if(!buildUi()){
    if((attempt||0)<50)root.setTimeout(()=>install((attempt||0)+1),100);
    return false;
  }
  render();
  root.document.addEventListener('nw:project:changed',render);
  return true;
}

const api={version:'netwizard-design-requirements-ui-v1',defaultLocationPlan,projectRequirements,upsertLocationPlan,upsertDemand,removeDemand,install};
root.NetWizardDesignRequirementsUi=api;
if(typeof module!=='undefined'&&module.exports)module.exports=api;
if(root.document){if(root.document.readyState==='loading')root.document.addEventListener('DOMContentLoaded',()=>install(0));else install(0);}
})(typeof window!=='undefined'?window:globalThis);
