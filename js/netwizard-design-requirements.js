/* NetWizard Design Requirements / Golden Path v1
 * Ubicación -> demanda -> capacidad -> switches -> rack.
 * Mantiene requisitos separados de las entidades canónicas y materializa solo bajo acción explícita.
 */
(function initNetWizardDesignRequirements(root){
'use strict';

const arr=v=>Array.isArray(v)?v:[];
const obj=v=>v&&typeof v==='object'&&!Array.isArray(v)?v:{};
const clean=v=>String(v==null?'':v).trim();
const num=(v,fallback=null)=>{const n=Number(v);return Number.isFinite(n)?n:fallback;};
const int=(v,fallback=0)=>{const n=Math.floor(num(v,fallback));return Number.isFinite(n)?n:fallback;};
const clone=v=>JSON.parse(JSON.stringify(v==null?null:v));
const DEFAULT_CAPACITY_POLICY=Object.freeze({portGrowthPercent:20,minFreePorts:8,rackGrowthPercent:20,minFreeRackUnits:4});
const DEFAULT_RACK_POLICY=Object.freeze({patchPanelPorts:24,organizerPerSwitch:true,layoutPattern:'patch-manager-switch'});
const STANDARD_RACK_UNITS=Object.freeze([6,9,12,15,18,22,24,27,32,36,42]);

function normalizeCapacityPolicy(value){
  const v=obj(value);
  return {
    portGrowthPercent:Math.max(0,Math.min(200,num(v.portGrowthPercent,DEFAULT_CAPACITY_POLICY.portGrowthPercent))),
    minFreePorts:Math.max(0,int(v.minFreePorts,DEFAULT_CAPACITY_POLICY.minFreePorts)),
    rackGrowthPercent:Math.max(0,Math.min(200,num(v.rackGrowthPercent,DEFAULT_CAPACITY_POLICY.rackGrowthPercent))),
    minFreeRackUnits:Math.max(0,int(v.minFreeRackUnits,DEFAULT_CAPACITY_POLICY.minFreeRackUnits))
  };
}
function normalizeRackPolicy(value){
  const v=obj(value),ports=Math.max(1,int(v.patchPanelPorts,DEFAULT_RACK_POLICY.patchPanelPorts));
  return {
    patchPanelPorts:Math.min(192,ports),
    organizerPerSwitch:v.organizerPerSwitch!==false,
    layoutPattern:['patch-manager-switch','patch-switch','manual'].includes(clean(v.layoutPattern))?clean(v.layoutPattern):DEFAULT_RACK_POLICY.layoutPattern
  };
}
function normalizeDemand(value,index){
  const v=obj(value),count=Math.max(0,int(v.count,0)),speed=Math.max(0,num(v.speedMinMbps,1000));
  return {
    id:clean(v.id)||`demand-${index+1}`,
    label:clean(v.label)||`Necesidad ${index+1}`,
    category:clean(v.category)||'other',
    count,
    media:clean(v.media||'copper').toLowerCase(),
    speedMinMbps:speed,
    poeRequired:v.poeRequired===true,
    poeWattsEach:Math.max(0,num(v.poeWattsEach,0)),
    notes:clean(v.notes)
  };
}
function normalizeLocationPlan(value,index){
  const v=obj(value),mode=clean(v.rackMode||'own').toLowerCase();
  return {
    id:clean(v.id)||`location-plan-${index+1}`,
    locationId:clean(v.locationId),
    rackMode:['own','served','none'].includes(mode)?mode:'own',
    servingLocationId:clean(v.servingLocationId),
    capacityPolicy:normalizeCapacityPolicy(v.capacityPolicy),
    rackPolicy:normalizeRackPolicy(v.rackPolicy),
    demands:arr(v.demands).map(normalizeDemand).filter(d=>d.count>0)
  };
}
function normalizeRequirements(project){
  const raw=obj(project&&project.designRequirements);
  return {
    version:'netwizard-design-requirements-v1',
    capacityPolicy:normalizeCapacityPolicy(raw.capacityPolicy),
    rackPolicy:normalizeRackPolicy(raw.rackPolicy),
    locationPlans:arr(raw.locationPlans).map(normalizeLocationPlan).filter(x=>x.locationId)
  };
}
function locationById(project,id){return arr(project&&project.physicalLocations).find(x=>x&&x.id===id)||null;}
function planByLocation(project,locationId){return normalizeRequirements(project).locationPlans.find(x=>x.locationId===locationId)||null;}

function resolveServingLocation(project,locationId){
  const req=normalizeRequirements(project),map=new Map(req.locationPlans.map(p=>[p.locationId,p]));
  const chain=[],seen=new Set();let current=clean(locationId);
  while(current){
    if(seen.has(current))return{ok:false,locationId:null,chain,code:'service_loop'};
    seen.add(current);chain.push(current);
    const p=map.get(current);
    if(!p||p.rackMode==='own')return{ok:true,locationId:current,chain};
    if(p.rackMode==='none')return{ok:true,locationId:null,chain};
    if(p.rackMode==='served'){
      if(!p.servingLocationId)return{ok:false,locationId:null,chain,code:'missing_serving_location'};
      current=p.servingLocationId;continue;
    }
  }
  return{ok:true,locationId:null,chain};
}

function reserveCount(count,growthPercent,minFree){
  const base=Math.max(0,int(count,0));
  return Math.max(base+Math.max(0,int(minFree,0)),Math.ceil(base*(1+Math.max(0,num(growthPercent,0))/100)));
}
function summarizeDemands(demands,policy){
  const p=normalizeCapacityPolicy(policy),list=arr(demands).map(normalizeDemand);
  let currentPorts=0,currentCopperPorts=0,currentFiberPorts=0,currentPoePorts=0,currentPoeWatts=0,currentMultigigPorts=0;
  for(const d of list){
    currentPorts+=d.count;
    const fiber=/fiber|fibre|sfp|optical|fibra/.test(d.media);
    if(fiber)currentFiberPorts+=d.count;else currentCopperPorts+=d.count;
    if(!fiber&&d.speedMinMbps>1000)currentMultigigPorts+=d.count;
    if(d.poeRequired){currentPoePorts+=d.count;currentPoeWatts+=d.count*d.poeWattsEach;}
  }
  const targetPorts=reserveCount(currentPorts,p.portGrowthPercent,p.minFreePorts);
  const targetFiberPorts=currentFiberPorts?reserveCount(currentFiberPorts,p.portGrowthPercent,0):0;
  const targetCopperPorts=Math.max(currentCopperPorts,targetPorts-targetFiberPorts);
  const targetMultigigPorts=currentMultigigPorts?reserveCount(currentMultigigPorts,p.portGrowthPercent,0):0;
  const targetPoePorts=currentPoePorts?reserveCount(currentPoePorts,p.portGrowthPercent,0):0;
  const targetPoeWatts=Math.ceil(currentPoeWatts*(1+p.portGrowthPercent/100));
  return{
    currentPorts,currentCopperPorts,currentFiberPorts,currentPoePorts,currentPoeWatts,currentMultigigPorts,
    targetPorts,targetCopperPorts,targetFiberPorts,targetPoePorts,targetPoeWatts,targetMultigigPorts,
    freePortReserve:Math.max(0,targetPorts-currentPorts),policy:p
  };
}
function aggregateDemandsForServiceLocation(project,serviceLocationId){
  const req=normalizeRequirements(project),demands=[],contributors=[];
  for(const p of req.locationPlans){
    const resolved=resolveServingLocation(project,p.locationId);
    if(resolved.ok&&resolved.locationId===serviceLocationId){
      demands.push(...p.demands.map(d=>Object.assign({},d,{sourceLocationId:p.locationId})));
      contributors.push(p.locationId);
    }
  }
  return{demands,contributors};
}

function suggestAccessSwitches(summary){
  const out=[];let remaining=Math.max(0,int(summary&&summary.targetCopperPorts,0));
  let multigig=Math.min(remaining,Math.max(0,int(summary&&summary.targetMultigigPorts,0)));
  while(multigig>0){
    const ports=24;
    out.push({ports,speedClass:'multigig',speedMaxMbps:2500,poeRequired:false,poePortsRequired:0,minimumPoeBudgetWatts:0});
    remaining=Math.max(0,remaining-ports);multigig=Math.max(0,multigig-ports);
  }
  while(remaining>0){
    const ports=remaining<=24?24:48;
    out.push({ports,speedClass:'1g',speedMaxMbps:1000,poeRequired:false,poePortsRequired:0,minimumPoeBudgetWatts:0});
    remaining=Math.max(0,remaining-ports);
  }
  let poePorts=Math.max(0,int(summary&&summary.targetPoePorts,0));
  const poeWatts=Math.max(0,num(summary&&summary.targetPoeWatts,0));
  const totalPoePorts=poePorts;
  for(const sw of out){
    if(poePorts<=0)break;
    const assigned=Math.min(sw.ports,poePorts);
    sw.poeRequired=true;sw.poePortsRequired=assigned;
    sw.minimumPoeBudgetWatts=totalPoePorts?Math.ceil(poeWatts*(assigned/totalPoePorts)):0;
    poePorts-=assigned;
  }
  return out;
}
function chooseRackUnits(required){
  const need=Math.max(1,int(required,1));
  return STANDARD_RACK_UNITS.find(u=>u>=need)||42;
}
function estimateRackPlan(summary,switches,rackPolicy,capacityPolicy){
  const rp=normalizeRackPolicy(rackPolicy),cp=normalizeCapacityPolicy(capacityPolicy);
  const switchUnits=arr(switches).length;
  const patchPanels=Math.ceil(Math.max(0,int(summary&&summary.targetCopperPorts,0))/rp.patchPanelPorts);
  const patchPanelUnits=patchPanels;
  const organizerUnits=(rp.layoutPattern==='patch-manager-switch'&&rp.organizerPerSwitch)?switchUnits:0;
  const fiberPanelUnits=(summary&&summary.targetFiberPorts)>0?1:0;
  const baseUnits=switchUnits+patchPanelUnits+organizerUnits+fiberPanelUnits;
  const reserveUnits=Math.max(cp.minFreeRackUnits,Math.ceil(baseUnits*cp.rackGrowthPercent/100));
  const requiredUnits=baseUnits+reserveUnits;
  const rackCount=requiredUnits<=42?1:Math.ceil(requiredUnits/42);
  const rackUnits=rackCount===1?chooseRackUnits(requiredUnits):42;
  return{
    switchUnits,patchPanels,patchPanelUnits,organizerUnits,fiberPanelUnits,baseUnits,reserveUnits,requiredUnits,
    rackCount,rackUnits,totalRackUnits:rackCount*rackUnits,freeRackUnits:rackCount*rackUnits-baseUnits,
    rackPolicy:rp,capacityPolicy:cp
  };
}
function buildLocationPlan(project,locationId){
  const req=normalizeRequirements(project),targetPlan=req.locationPlans.find(p=>p.locationId===locationId)||normalizeLocationPlan({locationId},0);
  const aggregate=aggregateDemandsForServiceLocation(project,locationId);
  const capacityPolicy=normalizeCapacityPolicy(Object.assign({},req.capacityPolicy,targetPlan.capacityPolicy));
  const rackPolicy=normalizeRackPolicy(Object.assign({},req.rackPolicy,targetPlan.rackPolicy));
  const summary=summarizeDemands(aggregate.demands,capacityPolicy);
  const switches=suggestAccessSwitches(summary);
  const rack=estimateRackPlan(summary,switches,rackPolicy,capacityPolicy);
  return{
    version:'netwizard-location-capacity-plan-v1',
    locationId,
    location:locationById(project,locationId),
    rackMode:targetPlan.rackMode,
    contributors:aggregate.contributors,
    demands:aggregate.demands,
    summary,switches,rack
  };
}

function slug(value){return clean(value).toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'').slice(0,48)||'location';}
function randomId(prefix){return prefix+'-'+Math.random().toString(36).slice(2,8)+Date.now().toString(36).slice(-5);}
function ensureArrays(project){
  for(const key of ['racks','rackItems','devices','ports','patchPanels'])if(!Array.isArray(project[key]))project[key]=[];
  return project;
}
function generatedFor(project,locationId){
  const match=x=>x&&x.planningSource==='design-requirements'&&x.planningLocationId===locationId;
  return{
    racks:arr(project.racks).filter(match),
    rackItems:arr(project.rackItems).filter(match),
    devices:arr(project.devices).filter(match),
    ports:arr(project.ports).filter(match),
    patchPanels:arr(project.patchPanels).filter(match)
  };
}
function materializeLocationPlan(project,locationId,options){
  const opts=options||{},next=ensureArrays(clone(project||{})),plan=buildLocationPlan(next,locationId),loc=plan.location;
  if(!loc)return{ok:false,code:'location_not_found',message:'La ubicación no existe.',project:next,plan};
  const req=planByLocation(next,locationId);
  if(!req||req.rackMode!=='own')return{ok:false,code:'rack_not_owned',message:'La ubicación debe estar configurada con rack propio para materializar su infraestructura.',project:next,plan};
  if(!plan.summary.targetPorts)return{ok:false,code:'no_demand',message:'No hay demanda de conexiones que materializar.',project:next,plan};
  if(plan.rack.rackPolicy.layoutPattern==='manual')return{ok:false,code:'manual_layout',message:'La política de rack está en modo manual. Cambia a un patrón automático o crea la infraestructura desde el editor de racks.',project:next,plan};
  const existing=generatedFor(next,locationId);
  if(existing.racks.length||existing.devices.length||existing.patchPanels.length)return{ok:false,code:'already_materialized',message:'Esta ubicación ya tiene infraestructura generada por el planificador. Revísala antes de volver a generar.',project:next,plan,existing};

  const idFactory=typeof opts.idFactory==='function'?opts.idFactory:randomId;
  const tag={planningSource:'design-requirements',planningLocationId:locationId};
  const rackRefs=[];
  for(let i=0;i<plan.rack.rackCount;i++){
    const id=idFactory('rack'),name=plan.rack.rackCount===1?`Rack ${loc.name}`:`Rack ${loc.name} ${i+1}`;
    const rack=Object.assign({id,name,locationId,rackUnits:plan.rack.rackUnits,numberingDirection:'bottom-up'},tag);
    next.racks.push(rack);rackRefs.push({rack,cursor:rack.rackUnits});
  }
  let rackIndex=0;
  function place(height){
    const h=Math.max(1,int(height,1));
    while(rackIndex<rackRefs.length&&rackRefs[rackIndex].cursor-h+1<1)rackIndex++;
    if(rackIndex>=rackRefs.length)return null;
    const ref=rackRefs[rackIndex],start=ref.cursor-h+1;ref.cursor=start-1;
    return{rackId:ref.rack.id,startUnit:start,heightUnits:h};
  }
  let fiberPanel=null;
  if(plan.rack.fiberPanelUnits){
    const pos=place(1);if(pos){
      fiberPanel=Object.assign({id:idFactory('rackitem'),type:'fiber-patch-panel',label:`Panel fibra · ${loc.name}`,face:'front'},pos,tag);
      next.rackItems.push(fiberPanel);
    }
  }

  let patchIndex=1,switchIndex=1;
  for(const sw of plan.switches){
    const panelCount=Math.ceil(sw.ports/plan.rack.rackPolicy.patchPanelPorts);
    for(let p=0;p<panelCount;p++){
      const pos=place(1);if(!pos)return{ok:false,code:'rack_capacity_error',message:'No hay espacio suficiente para colocar los patch panels propuestos.',project:clone(project),plan};
      const ppId=idFactory('patch'),pp=Object.assign({
        id:ppId,rackId:pos.rackId,rackUnit:pos.startUnit,name:`PP-${slug(loc.name).toUpperCase()}-${String(patchIndex).padStart(2,'0')}`,
        portCount:plan.rack.rackPolicy.patchPanelPorts,category:'Cat6A'
      },tag);
      next.patchPanels.push(pp);
      next.rackItems.push(Object.assign({id:idFactory('rackitem'),type:'patch-panel',patchPanelId:ppId,label:pp.name,face:'front'},pos,tag));
      patchIndex++;
    }
    if(plan.rack.rackPolicy.layoutPattern==='patch-manager-switch'&&plan.rack.rackPolicy.organizerPerSwitch){
      const pos=place(1);if(!pos)return{ok:false,code:'rack_capacity_error',message:'No hay espacio suficiente para colocar los organizadores propuestos.',project:clone(project),plan};
      next.rackItems.push(Object.assign({id:idFactory('rackitem'),type:'cable-manager',label:`Organizador horizontal ${switchIndex}`,face:'front'},pos,tag));
    }
    const pos=place(1);if(!pos)return{ok:false,code:'rack_capacity_error',message:'No hay espacio suficiente para colocar los switches propuestos.',project:clone(project),plan};
    const devId=idFactory('dev'),devName=`SW-${slug(loc.name).toUpperCase()}-${String(switchIndex).padStart(2,'0')}`;
    const device=Object.assign({
      id:devId,name:devName,type:'switch',kind:'switch',vendorOs:'generic_network',modelSource:'manual',
      model:`Genérico ${sw.ports}p ${sw.speedClass==='multigig'?'2.5G ':'1G '}${sw.poeRequired?'PoE':''}`.trim(),
      locationId,physicalLocation:loc.name,rackId:pos.rackId,rack:pos.rackId,rackUnit:pos.startUnit,rackUnits:1,rackFace:'front',
      requiredPoePorts:sw.poePortsRequired||0,requiredPoeBudgetWatts:sw.minimumPoeBudgetWatts||0,
      notes:'Propuesta generada desde requisitos de capacidad. Selecciona un modelo real antes de producción.'
    },tag);
    next.devices.push(device);
    next.rackItems.push(Object.assign({id:idFactory('rackitem'),type:'device',deviceId:devId,label:devName,face:'front'},pos,tag));
    for(let n=1;n<=sw.ports;n++){
      next.ports.push(Object.assign({
        id:idFactory('port'),deviceId:devId,name:`Gi1/0/${n}`,mode:'access',media:sw.speedClass==='multigig'?'2.5GE':'GE',
        speedMaxMbps:sw.speedMaxMbps,poeCapable:sw.poeRequired,poeMode:sw.poeRequired?'auto':'off',
        accessVlanRef:'',nativeVlanRef:'',allowedVlans:[],desc:'Puerto propuesto por dimensionamiento'
      },tag));
    }
    switchIndex++;
  }

  // Diferencia entre U realmente libres y U reservadas para crecimiento.
  let reserveLeft=plan.rack.reserveUnits,reservedBlocks=0;
  for(let i=rackRefs.length-1;i>=0&&reserveLeft>0;i--){
    const ref=rackRefs[i],available=Math.max(0,ref.cursor);
    const amount=Math.min(available,reserveLeft);
    if(amount>0){
      next.rackItems.push(Object.assign({
        id:idFactory('rackitem'),rackId:ref.rack.id,type:'reserved',label:'Reserva para crecimiento',
        startUnit:1,heightUnits:amount,face:'front',mounting:'reserved'
      },tag));
      reserveLeft-=amount;reservedBlocks++;
    }
  }
  return{
    ok:true,code:'materialized',project:next,plan,
    created:{racks:rackRefs.length,devices:plan.switches.length,ports:plan.switches.reduce((s,x)=>s+x.ports,0),patchPanels:patchIndex-1,organizers:plan.rack.organizerUnits,fiberPanels:fiberPanel?1:0,reservedBlocks}
  };
}

const api={
  version:'netwizard-design-requirements-v1',
  defaults:{capacityPolicy:clone(DEFAULT_CAPACITY_POLICY),rackPolicy:clone(DEFAULT_RACK_POLICY),standardRackUnits:STANDARD_RACK_UNITS.slice()},
  normalizeCapacityPolicy,normalizeRackPolicy,normalizeDemand,normalizeLocationPlan,normalizeRequirements,
  planByLocation,resolveServingLocation,summarizeDemands,aggregateDemandsForServiceLocation,suggestAccessSwitches,estimateRackPlan,buildLocationPlan,
  generatedFor,materializeLocationPlan
};
root.NetWizardDesignRequirements=api;
if(typeof module!=='undefined'&&module.exports)module.exports=api;
})(typeof window!=='undefined'?window:globalThis);
