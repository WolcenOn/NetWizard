/* NetWizard Physical Intervention Plan v1 */
(function initNetWizardPhysicalInterventionPlan(root){
'use strict';

const arr=v=>Array.isArray(v)?v:[];
const obj=v=>v&&typeof v==='object'&&!Array.isArray(v)?v:{};
const clean=v=>String(v==null?'':v).trim();
const clone=v=>JSON.parse(JSON.stringify(v==null?null:v));

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

function deviceActions(project,baseline){
  const current=arr(project&&project.devices),base=baselineMap(baseline.devices),seen=new Set(),actions=[];
  for(const d of current){
    const origin=clean(d.originRef),id=clean(d.id),disp=clean(d.designDisposition)||(origin?'keep':'add');
    if(origin)seen.add(origin);
    if(disp==='add'){
      actions.push(action(`device:add:${id}`,'device','add-device',`Instalar ${label(d,id)}`,[d.rackId||d.rack,d.rackUnit!=null?`U${d.rackUnit}`:null].filter(Boolean).join(' · '),{deviceId:id}));
      continue;
    }
    if(disp==='retire'){
      actions.push(action(`device:retire:${origin||id}`,'device','retire-device',`Retirar ${label(d,id)}`,'Equipo existente marcado para retirada.',{deviceId:id,originRef:origin||id}));
      continue;
    }
    if(disp==='replace'){
      actions.push(action(`device:replace:${origin||id}`,'device','replace-device',`Reemplazar ${label(d,id)}`,clean(d.replacementNote)||'Sustituir el equipo manteniendo la referencia de origen.',{deviceId:id,originRef:origin||id,replacementDeviceRef:clean(d.replacementDeviceRef)||null}));
    }
    const b=base.get(origin||id);
    if(b&&differs(b,d,['locationId','rackId','rackUnit','rackUnits'])){
      const from=[b.rackId||b.rack,b.rackUnit!=null?`U${b.rackUnit}`:null].filter(Boolean).join(' · ')||'sin rack';
      const to=[d.rackId||d.rack,d.rackUnit!=null?`U${d.rackUnit}`:null].filter(Boolean).join(' · ')||'sin rack';
      actions.push(action(`device:move:${origin||id}`,'device','move-device',`Mover ${label(d,id)}`,`${from} → ${to}`,{deviceId:id,originRef:origin||id,before:clone(b),after:pick(d,['locationId','rackId','rackUnit','rackUnits'])}));
    }
  }
  for(const [id,b] of base){
    if(!seen.has(id)&&!current.some(d=>d&&d.id===id)){
      actions.push(action(`device:missing:${id}`,'device','retire-device',`Retirar ${label(b,id)}`,'El equipo existía en el As-Built y ya no aparece en el To-Be.',{originRef:id,implicit:true}));
    }
  }
  return actions;
}

function build(project){
  const p=project||{},workflow=obj(p.workflow),baseline=obj(workflow.interventionBaseline);
  if(baseline.version!=='netwizard-physical-intervention-baseline-v1'){
    return{ok:false,version:'netwizard-physical-intervention-plan-v1',code:'baseline_missing',message:'El diseño no contiene línea base física de intervención.',actions:[],counts:{total:0}};
  }
  const actions=[];
  actions.push(...deviceActions(p,baseline));
  actions.push(...diffCollection({
    category:'rack',baseline:baseline.racks,current:p.racks,
    keys:['locationId','rackUnits','numberingDirection'],
    addType:'add-rack',removeType:'remove-rack',changeType:'modify-rack',
    addVerb:'Instalar rack',removeVerb:'Retirar rack',changeVerb:'Modificar rack',
    changeDetails:(b,c)=>`${b.rackUnits||'—'}U → ${c.rackUnits||'—'}U`
  }));
  actions.push(...diffCollection({
    category:'pdu',baseline:baseline.pdus,current:p.pdus,
    keys:['rackId','feed','mounting','outletCount','voltage','maxCurrentAmps','maxPowerWatts'],
    addType:'add-pdu',removeType:'remove-pdu',changeType:'modify-pdu',
    addVerb:'Instalar PDU',removeVerb:'Retirar PDU',changeVerb:'Modificar PDU'
  }));
  actions.push(...diffCollection({
    category:'power',baseline:baseline.powerConnections,current:p.powerConnections,
    keys:['deviceId','pduId','outlet','powerSupplyIndex','feed'],
    addType:'connect-power',removeType:'disconnect-power',changeType:'reconnect-power',
    addVerb:'Conectar alimentación',removeVerb:'Desconectar alimentación',changeVerb:'Reconectar alimentación',
    changeDetails:(b,c)=>`${b.pduId||'—'} / toma ${b.outlet||'—'} → ${c.pduId||'—'} / toma ${c.outlet||'—'}`
  }));
  actions.push(...diffCollection({
    category:'cable',baseline:baseline.cableRuns,current:p.cableRuns,
    keys:['label','patchPanelId','patchPort','outletId','outletPort','cableType','lengthM','route'],
    addType:'install-cable',removeType:'remove-cable',changeType:'replace-or-reroute-cable',
    addVerb:'Instalar cable',removeVerb:'Retirar cable',changeVerb:'Sustituir/reencaminar cable',
    changeDetails:(b,c)=>`${b.cableType||'—'} ${b.route||''} → ${c.cableType||'—'} ${c.route||''}`.trim()
  }));
  actions.push(...diffCollection({
    category:'patch',baseline:baseline.patchConnections,current:p.patchConnections,
    keys:['patchPanelId','patchPort','switchPortId','patchCordLengthM'],
    addType:'add-patch',removeType:'remove-patch',changeType:'repatch',
    addVerb:'Añadir latiguillo rack',removeVerb:'Retirar latiguillo rack',changeVerb:'Repatch'
  }));
  actions.push(...diffCollection({
    category:'host-patch',baseline:baseline.hostOutletConnections,current:p.hostOutletConnections,
    keys:['hostId','outletId','outletPort','patchCordLengthM'],
    addType:'add-host-patch',removeType:'remove-host-patch',changeType:'repatch-host',
    addVerb:'Conectar toma a host',removeVerb:'Desconectar toma de host',changeVerb:'Reconectar toma de host'
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
function buildChecklist(project){
  const plan=build(project);
  if(!plan.ok)return plan;
  const order=['disconnect-power','remove-patch','remove-host-patch','remove-cable','retire-device','move-device','remove-pdu','remove-rack','add-rack','add-pdu','add-device','replace-device','modify-rack','modify-pdu','install-cable','replace-or-reroute-cable','add-patch','repatch','add-host-patch','repatch-host','connect-power','reconnect-power'];
  const rank=new Map(order.map((x,i)=>[x,i]));
  return Object.assign({},plan,{actions:plan.actions.slice().sort((a,b)=>(rank.get(a.type)??999)-(rank.get(b.type)??999)||a.title.localeCompare(b.title))});
}

const api={version:'netwizard-physical-intervention-plan-v1',captureBaseline,build,buildChecklist};
root.NetWizardPhysicalInterventionPlan=api;
if(typeof module!=='undefined'&&module.exports)module.exports=api;
})(typeof window!=='undefined'?window:globalThis);
