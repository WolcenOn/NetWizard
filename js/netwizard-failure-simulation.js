/* NetWizard Failure Simulation v2
   Preserves the v1 API and enriches scenarios with derived traffic impact when WAN Resilience is available.
*/
(function initNetWizardFailureSimulation(root){
'use strict';

const arr=v=>Array.isArray(v)?v:[];
const clean=v=>String(v==null?'':v).trim();
function tryRequire(path){try{return require(path);}catch{return null;}}
function resilience(){return root.NetWizardWanResilience||(typeof require==='function'?tryRequire('./netwizard-wan-resilience.js'):null);}

function refs(project,type){
  if(type==='vpn')return arr(project&&project.routing&&project.routing.siteToSiteVpns);
  const map={device:'devices',link:'links',circuit:'wanCircuits',service:'internalServices'};
  return arr(project&&project[map[type]]);
}
function targetExists(project,event){
  const type=clean(event.type),id=clean(event.targetRef);
  if(['provider','rack','powerDomain','site'].includes(type))return !!id;
  return refs(project,type).some(x=>clean(x.id)===id);
}
function impactedDevices(project,event){
  const type=clean(event.type),id=clean(event.targetRef),out=new Set();
  if(type==='device')out.add(id);
  if(type==='link'){
    const l=arr(project.links).find(x=>x.id===id);
    if(l)for(const p of arr(project.ports))if([l.aPortId,l.bPortId,l.a,l.b].includes(p.id)&&p.deviceId)out.add(p.deviceId);
  }
  if(type==='circuit'){
    const c=arr(project.wanCircuits).find(x=>x.id===id);if(c&&c.deviceId)out.add(c.deviceId);
  }
  if(type==='provider')for(const c of arr(project.wanCircuits))if(clean(c.provider)===id&&c.deviceId)out.add(c.deviceId);
  if(type==='rack'||type==='powerDomain'||type==='site')for(const d of arr(project.devices))if(clean(d[type]||d.siteRef)===id)out.add(d.id);
  if(type==='vpn'){
    const t=arr(project&&project.routing&&project.routing.siteToSiteVpns).find(x=>x&&x.id===id);
    if(t){if(t.localDeviceId)out.add(t.localDeviceId);if(t.remoteDeviceId)out.add(t.remoteDeviceId);}
  }
  return out;
}
function serviceAvailable(project,service,failedDevices,failedServices){
  if(failedServices.has(service.id))return false;
  return arr(service.endpoints).some(e=>!e.deviceId||!failedDevices.has(e.deviceId));
}
function simulateScenario(project,scenario){
  const issues=[],failedDevices=new Set(),failedServices=new Set(),events=arr(scenario.events);
  for(const event of events){
    if(!targetExists(project,event)){
      issues.push({code:'NW-FAIL-001',severity:'error',blocking:true,category:'failure',scenarioId:scenario.id,message:(scenario.name||scenario.id)+': objetivo inexistente '+event.type+':'+event.targetRef+'.'});
      continue;
    }
    for(const id of impactedDevices(project,event))failedDevices.add(id);
    if(event.type==='service')failedServices.add(event.targetRef);
  }
  const unavailableServices=[];
  for(const svc of arr(project.internalServices))if(!serviceAvailable(project,svc,failedDevices,failedServices))unavailableServices.push(svc.id);
  let changed=true;
  while(changed){
    changed=false;
    for(const svc of arr(project.internalServices)){
      if(unavailableServices.includes(svc.id))continue;
      if(arr(svc.dependsOn).some(id=>unavailableServices.includes(id))){unavailableServices.push(svc.id);changed=true;}
    }
  }
  const activeCircuits=arr(project.wanCircuits).filter(c=>c.enabled!==false&&!failedDevices.has(c.deviceId)&&!events.some(e=>(e.type==='circuit'&&e.targetRef===c.id)||(e.type==='provider'&&clean(c.provider)===clean(e.targetRef))));
  const survivingLinks=arr(project.links).filter(l=>!events.some(e=>e.type==='link'&&e.targetRef===l.id));
  for(const expected of arr(scenario.mustSurvive)){
    const type=clean(expected.type),id=clean(expected.ref);let ok=true;
    if(type==='device')ok=!failedDevices.has(id);
    else if(type==='service')ok=!unavailableServices.includes(id);
    else if(type==='circuit')ok=activeCircuits.some(c=>c.id===id);
    else if(type==='wan')ok=activeCircuits.length>0;
    else if(type==='link')ok=survivingLinks.some(l=>l.id===id);
    if(!ok)issues.push({code:'NW-FAIL-002',severity:'error',blocking:true,category:'failure',scenarioId:scenario.id,message:(scenario.name||scenario.id)+': no sobrevive '+type+':'+(id||'conectividad')+'.'});
  }
  if(scenario.requireWan!==false&&arr(project.wanCircuits).length&&activeCircuits.length===0){
    issues.push({code:'NW-FAIL-003',severity:'error',blocking:true,category:'failure',scenarioId:scenario.id,message:(scenario.name||scenario.id)+': no queda ningún circuito WAN operativo.'});
  }
  for(const id of unavailableServices){
    const svc=arr(project.internalServices).find(s=>s.id===id);
    issues.push({code:'NW-FAIL-004',severity:svc&&svc.critical?'error':'warning',blocking:!!(svc&&svc.critical),category:'failure',scenarioId:scenario.id,serviceId:id,message:(scenario.name||scenario.id)+': servicio '+id+' queda no disponible.'});
  }

  let trafficImpact=null;
  const R=resilience();
  if(R&&typeof R.simulateEvents==='function'&&!issues.some(x=>x.code==='NW-FAIL-001')){
    trafficImpact=R.simulateEvents(project,events,scenario.name||scenario.id);
    if(trafficImpact.lostReachability.length){
      issues.push({code:'NW-FAIL-005',severity:'error',blocking:true,category:'failure',scenarioId:scenario.id,message:(scenario.name||scenario.id)+': se pierden '+trafficImpact.lostReachability.length+' pares de reachability que eran válidos en baseline.'});
    }
    if(trafficImpact.wanGroupsLost.length){
      issues.push({code:'NW-FAIL-006',severity:'error',blocking:true,category:'failure',scenarioId:scenario.id,message:(scenario.name||scenario.id)+': quedan sin circuito WAN los grupos '+trafficImpact.wanGroupsLost.join(', ')+'.'});
    }
  }

  const degraded=failedDevices.size>0||unavailableServices.length>0||activeCircuits.length<arr(project.wanCircuits).filter(c=>c.enabled!==false).length||
    !!(trafficImpact&&(trafficImpact.lostReachability.length||trafficImpact.wanGroupsLost.length));
  return{
    id:scenario.id,name:scenario.name||scenario.id,status:issues.some(i=>i.blocking)?'failed':degraded?'degraded':'survives',
    failedDevices:Array.from(failedDevices),unavailableServices,activeCircuitIds:activeCircuits.map(c=>c.id),issues,
    trafficImpact,
    lostReachability:trafficImpact?trafficImpact.lostReachability:[],
    survivingReachability:trafficImpact?trafficImpact.survivingReachability:[],
    wanGroupsLost:trafficImpact?trafficImpact.wanGroupsLost:[]
  };
}
function validateProject(project){
  const scenarios=arr(project&&project.failureScenarios).map(s=>simulateScenario(project||{},s)),issues=scenarios.flatMap(s=>s.issues);
  return{
    version:'netwizard-failure-simulation-v2',ok:!issues.some(i=>i.blocking),issues,
    counts:{blocking:issues.filter(i=>i.blocking).length,warnings:issues.filter(i=>i.severity==='warning').length},
    scenarios
  };
}
const api={version:'netwizard-failure-simulation-v2',simulateScenario,validateProject};
root.NetWizardFailureSimulation=api;
if(typeof module!=='undefined'&&module.exports)module.exports=api;
})(typeof window!=='undefined'?window:globalThis);
