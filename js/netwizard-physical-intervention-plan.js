/* NetWizard Physical Intervention Plan v1 */
(function initNetWizardPhysicalInterventionPlan(root){
'use strict';

const arr=v=>Array.isArray(v)?v:[];
const obj=v=>v&&typeof v==='object'&&!Array.isArray(v)?v:{};
const clean=v=>String(v==null?'':v).trim();
const clone=v=>JSON.parse(JSON.stringify(v==null?null:v));
function localeOf(options){const explicit=clean(options&&options.locale);if(explicit)return explicit.toLowerCase()==='en'?'en':'es';const i18n=root.NetWizardI18n;const current=i18n&&typeof i18n.getReportLocale==='function'?i18n.getReportLocale():i18n&&typeof i18n.getLocale==='function'?i18n.getLocale():'es';return clean(current).toLowerCase()==='en'?'en':'es';}
function tr(locale,es,en){return locale==='en'?en:es;}

function pick(source,keys){
  const s=obj(source),out={};
  for(const key of keys){
    const value=s[key];
    if(value!==undefined&&value!==null&&value!=='')out[key]=value;
  }
  return out;
}
function baseRecord(item,keys){
  return Object.assign({id:clean(item&&item.id),name:clean(item&&item.name||item&&item.label)},pick(item,keys));
}
function captureBaseline(project,options){
  const p=project||{},opts=obj(options);
  return{
    version:'netwizard-physical-intervention-baseline-v1',
    capturedAt:clean(opts.capturedAt)||new Date().toISOString(),
    racks:arr(p.racks).map(x=>baseRecord(x,['locationId','rackUnits','numberingDirection'])),
    devices:arr(p.devices).map(x=>baseRecord(x,['locationId','rackId','rack','rackUnit','rackUnits','manufacturer','model'])),
    pdus:arr(p.pdus).map(x=>baseRecord(x,['rackId','feed','mounting','outletCount','voltage','maxCurrentAmps','maxPowerWatts'])),
    powerConnections:arr(p.powerConnections).map(x=>baseRecord(x,['deviceId','pduId','outlet','powerSupplyIndex','feed'])),
    cableRuns:arr(p.cableRuns).map(x=>baseRecord(x,['label','patchPanelId','patchPort','outletId','outletPort','cableType','lengthM','route'])),
    patchConnections:arr(p.patchConnections).map(x=>baseRecord(x,['patchPanelId','patchPort','switchPortId','patchCordLengthM'])),
    hostOutletConnections:arr(p.hostOutletConnections).map(x=>baseRecord(x,['hostId','outletId','outletPort','patchCordLengthM']))
  };
}
function value(v){return v==null?'':String(v);}
function differs(a,b,keys){return keys.some(k=>value(a&&a[k])!==value(b&&b[k]));}
function currentMap(list){
  const map=new Map();
  for(const item of arr(list)){
    const key=clean(item&&item.originRef)||clean(item&&item.id);
    if(key)map.set(key,item);
  }
  return map;
}
function baselineMap(list){return new Map(arr(list).filter(x=>x&&x.id).map(x=>[x.id,x]));}
function action(id,category,type,title,details,extra){
  return Object.assign({id,category,type,title,details:details||'',blocking:false},extra||{});
}
function label(item,fallback){return clean(item&&item.name||item&&item.label||fallback)||fallback;}

function diffCollection(options){
  const o=obj(options),baseline=baselineMap(o.baseline),current=currentMap(o.current),actions=[];
  for(const [id,b] of baseline){
    const cur=current.get(id);
    if(!cur){
      actions.push(action(`${o.category}:remove:${id}`,o.category,o.removeType||'remove',`${o.removeVerb||'Retirar'} ${label(b,id)}`,o.removeDetails?o.removeDetails(b):'',{originRef:id}));
      continue;
    }
    if(differs(b,cur,o.keys||[])){
      actions.push(action(`${o.category}:change:${id}`,o.category,o.changeType||'change',`${o.changeVerb||'Modificar'} ${label(cur,id)}`,o.changeDetails?o.changeDetails(b,cur):'',{originRef:id,currentId:cur.id||id,before:clone(b),after:pick(cur,o.keys||[])}));
    }
  }
  for(const cur of arr(o.current)){
    const origin=clean(cur&&cur.originRef);
    if(origin)continue;
    const id=clean(cur&&cur.id);
    if(!id||baseline.has(id))continue;
    actions.push(action(`${o.category}:add:${id}`,o.category,o.addType||'add',`${o.addVerb||'Añadir'} ${label(cur,id)}`,o.addDetails?o.addDetails(cur):'',{currentId:id}));
  }
  return actions;
}

function deviceActions(project,baseline,options){const locale=localeOf(options);
  const current=arr(project&&project.devices),base=baselineMap(baseline.devices),seen=new Set(),actions=[];
  for(const d of current){
    const origin=clean(d.originRef),id=clean(d.id),disp=clean(d.designDisposition)||(origin?'keep':'add');
    if(origin)seen.add(origin);
    if(disp==='add'){
      actions.push(action(`device:add:${id}`,'device','add-device',`${tr(locale,'Instalar','Install')} ${label(d,id)}`,[d.rackId||d.rack,d.rackUnit!=null?`U${d.rackUnit}`:null].filter(Boolean).join(' · '),{deviceId:id}));
      continue;
    }
    if(disp==='retire'){
      actions.push(action(`device:retire:${origin||id}`,'device','retire-device',`${tr(locale,'Retirar','Remove')} ${label(d,id)}`,'Equipo existente marcado para retirada.',{deviceId:id,originRef:origin||id}));
      continue;
    }
    if(disp==='replace'){
      actions.push(action(`device:replace:${origin||id}`,'device','replace-device',`${tr(locale,'Reemplazar','Replace')} ${label(d,id)}`,clean(d.replacementNote)||tr(locale,'Sustituir el equipo manteniendo la referencia de origen.','Replace the device while preserving the source reference.'),{deviceId:id,originRef:origin||id,replacementDeviceRef:clean(d.replacementDeviceRef)||null}));
    }
    const b=base.get(origin||id);
    if(b&&differs(b,d,['locationId','rackId','rackUnit','rackUnits'])){
      const from=[b.rackId||b.rack,b.rackUnit!=null?`U${b.rackUnit}`:null].filter(Boolean).join(' · ')||tr(locale,'sin rack','no rack');
      const to=[d.rackId||d.rack,d.rackUnit!=null?`U${d.rackUnit}`:null].filter(Boolean).join(' · ')||'sin rack';
      actions.push(action(`device:move:${origin||id}`,'device','move-device',`${tr(locale,'Mover','Move')} ${label(d,id)}`,`${from} → ${to}`,{deviceId:id,originRef:origin||id,before:clone(b),after:pick(d,['locationId','rackId','rackUnit','rackUnits'])}));
    }
  }
  for(const [id,b] of base){
    if(!seen.has(id)&&!current.some(d=>d&&d.id===id)){
      actions.push(action(`device:missing:${id}`,'device','retire-device',`Retirar ${label(b,id)}`,tr(locale,'El equipo existía en el As-Built y ya no aparece en el To-Be.','The device existed in the As-Built and no longer appears in the To-Be.'),{originRef:id,implicit:true}));
    }
  }
  return actions;
}

function build(project,options){const locale=localeOf(options);
  const p=project||{},workflow=obj(p.workflow),baseline=obj(workflow.interventionBaseline);
  if(baseline.version!=='netwizard-physical-intervention-baseline-v1'){
    return{ok:false,version:'netwizard-physical-intervention-plan-v1',code:'baseline_missing',message:tr(locale,'El diseño no contiene línea base física de intervención.','The design does not contain a physical intervention baseline.'),actions:[],counts:{total:0}};
  }
  const actions=[];
  actions.push(...deviceActions(p,baseline,{locale}));
  actions.push(...diffCollection({
    category:'rack',baseline:baseline.racks,current:p.racks,
    keys:['locationId','rackUnits','numberingDirection'],
    addType:'add-rack',removeType:'remove-rack',changeType:'modify-rack',
    addVerb:tr(locale,'Instalar rack','Install rack'),removeVerb:tr(locale,'Retirar rack','Remove rack'),changeVerb:tr(locale,'Modificar rack','Modify rack'),
    changeDetails:(b,c)=>`${b.rackUnits||'—'}U → ${c.rackUnits||'—'}U`
  }));
  actions.push(...diffCollection({
    category:'pdu',baseline:baseline.pdus,current:p.pdus,
    keys:['rackId','feed','mounting','outletCount','voltage','maxCurrentAmps','maxPowerWatts'],
    addType:'add-pdu',removeType:'remove-pdu',changeType:'modify-pdu',
    addVerb:tr(locale,'Instalar PDU','Install PDU'),removeVerb:tr(locale,'Retirar PDU','Remove PDU'),changeVerb:tr(locale,'Modificar PDU','Modify PDU')
  }));
  actions.push(...diffCollection({
    category:'power',baseline:baseline.powerConnections,current:p.powerConnections,
    keys:['deviceId','pduId','outlet','powerSupplyIndex','feed'],
    addType:'connect-power',removeType:'disconnect-power',changeType:'reconnect-power',
    addVerb:tr(locale,'Conectar alimentación','Connect power'),removeVerb:tr(locale,'Desconectar alimentación','Disconnect power'),changeVerb:tr(locale,'Reconectar alimentación','Reconnect power'),
    changeDetails:(b,c)=>`${b.pduId||'—'} / ${tr(locale,'toma','outlet')} ${b.outlet||'—'} → ${c.pduId||'—'} / ${tr(locale,'toma','outlet')} ${c.outlet||'—'}`
  }));
  actions.push(...diffCollection({
    category:'cable',baseline:baseline.cableRuns,current:p.cableRuns,
    keys:['label','patchPanelId','patchPort','outletId','outletPort','cableType','lengthM','route'],
    addType:'install-cable',removeType:'remove-cable',changeType:'replace-or-reroute-cable',
    addVerb:tr(locale,'Instalar cable','Install cable'),removeVerb:tr(locale,'Retirar cable','Remove cable'),changeVerb:tr(locale,'Sustituir/reencaminar cable','Replace/reroute cable'),
    changeDetails:(b,c)=>`${b.cableType||'—'} ${b.route||''} → ${c.cableType||'—'} ${c.route||''}`.trim()
  }));
  actions.push(...diffCollection({
    category:'patch',baseline:baseline.patchConnections,current:p.patchConnections,
    keys:['patchPanelId','patchPort','switchPortId','patchCordLengthM'],
    addType:'add-patch',removeType:'remove-patch',changeType:'repatch',
    addVerb:tr(locale,'Añadir latiguillo rack','Add rack patch cord'),removeVerb:tr(locale,'Retirar latiguillo rack','Remove rack patch cord'),changeVerb:'Repatch'
  }));
  actions.push(...diffCollection({
    category:'host-patch',baseline:baseline.hostOutletConnections,current:p.hostOutletConnections,
    keys:['hostId','outletId','outletPort','patchCordLengthM'],
    addType:'add-host-patch',removeType:'remove-host-patch',changeType:'repatch-host',
    addVerb:tr(locale,'Conectar toma a host','Connect outlet to host'),removeVerb:tr(locale,'Desconectar toma de host','Disconnect outlet from host'),changeVerb:tr(locale,'Reconectar toma de host','Reconnect host outlet')
  }));
  const counts={total:actions.length,devices:0,racks:0,pdus:0,power:0,cabling:0};
  for(const a of actions){
    if(a.category==='device')counts.devices++;
    else if(a.category==='rack')counts.racks++;
    else if(a.category==='pdu')counts.pdus++;
    else if(a.category==='power')counts.power++;
    else counts.cabling++;
  }
  return{
    ok:true,
    version:'netwizard-physical-intervention-plan-v1',
    source:obj(workflow.derivedFrom),
    baselineCapturedAt:clean(baseline.capturedAt),
    counts,
    actions
  };
}
function buildChecklist(project,options){
  const plan=build(project,options);
  if(!plan.ok)return plan;
  const order=['disconnect-power','remove-patch','remove-host-patch','remove-cable','retire-device','move-device','remove-pdu','remove-rack','add-rack','add-pdu','add-device','replace-device','modify-rack','modify-pdu','install-cable','replace-or-reroute-cable','add-patch','repatch','add-host-patch','repatch-host','connect-power','reconnect-power'];
  const rank=new Map(order.map((x,i)=>[x,i]));
  return Object.assign({},plan,{actions:plan.actions.slice().sort((a,b)=>(rank.get(a.type)??999)-(rank.get(b.type)??999)||a.title.localeCompare(b.title))});
}

const api={version:'netwizard-physical-intervention-plan-v1',captureBaseline,build,buildChecklist};
root.NetWizardPhysicalInterventionPlan=api;
if(typeof module!=='undefined'&&module.exports)module.exports=api;
})(typeof window!=='undefined'?window:globalThis);
