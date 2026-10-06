/* NetWizard WAN Resilience v1
   Derived analysis across canonical wanCircuits, highAvailability, routing/VPN and Reachability.
   Does not persist simulation results.
*/
(function initNetWizardWanResilience(root){
'use strict';

const arr=v=>Array.isArray(v)?v:[];
const obj=v=>v&&typeof v==='object'&&!Array.isArray(v)?v:{};
const clean=v=>String(v==null?'':v).trim();
function tryRequire(path){try{return require(path);}catch{return null;}}
function wanModel(){return root.NetWizardWanCircuits||(typeof require==='function'?tryRequire('./netwizard-wan-circuits.js'):null);}
function reachability(){return root.NetWizardInterSiteReachability||(typeof require==='function'?tryRequire('./netwizard-inter-site-reachability.js'):null);}
function vpnModel(){return root.NetWizardSiteToSiteVpn||(typeof require==='function'?tryRequire('./netwizard-site-to-site-vpn.js'):null);}

function clone(v){return JSON.parse(JSON.stringify(v==null?{}:v));}
function device(project,id){return arr(project&&project.devices).find(x=>x&&x.id===id)||null;}
function port(project,id){return arr(project&&project.ports).find(x=>x&&x.id===id)||null;}
function circuit(project,id){return arr(project&&project.wanCircuits).find(x=>x&&x.id===id)||null;}
function deviceHa(project,deviceId){return obj(obj(obj(project&&project.highAvailability).devices)[deviceId]);}
function circuitGroup(c){const WAN=wanModel();return WAN&&WAN.failoverGroupKey?WAN.failoverGroupKey(c):clean(c&&(c.siteRef||c.wanGroupRef||c.failoverGroupRef||c.locationRef||'global'));}
function circuitLabel(c){return clean(c&&(c.name||c.id))||'circuito';}
function issue(code,message,blocking,extra){const meta=extra||{};return Object.assign({code,severity:blocking?'error':'warning',blocking:!!blocking,category:'wan-resilience',message,messageKey:'validation.issue.wan.'+code,messageParams:Object.assign({},meta)},meta);}
function scenario(id,key,params,name,events){return{id,name,nameKey:key,nameParams:params||{},events,source:'derived'};}
function legacyReason(key,params,message){void key;void params;return message;}

function circuitBySourceInterface(project,deviceId,name){
  const target=clean(name);if(!target)return null;
  const p=arr(project&&project.ports).find(x=>x&&x.deviceId===deviceId&&clean(x.name||x.id)===target);
  return p?arr(project&&project.wanCircuits).find(c=>c&&c.deviceId===deviceId&&c.portId===p.id)||null:null;
}
function normalizeDeviceBindings(project,deviceId){
  const ha=deviceHa(project,deviceId),probes=arr(ha.tracking),routes=arr(ha.defaultRoutes);
  const normalizedProbes=probes.map((probe,index)=>{
    let c=probe.circuitRef?circuit(project,probe.circuitRef):null;
    if(!c)c=circuitBySourceInterface(project,deviceId,probe.sourceInterface);
    return{
      id:clean(probe.id||String(index+1)),target:clean(probe.target),sourceInterface:clean(probe.sourceInterface),
      circuitRef:clean(probe.circuitRef||c&&c.id),explicitCircuitRef:!!clean(probe.circuitRef),raw:probe
    };
  });
  const probeById=new Map(normalizedProbes.map(p=>[p.id,p]));
  const normalizedRoutes=routes.map((route,index)=>{
    const probe=probeById.get(clean(route.trackId)),explicit=clean(route.circuitRef);
    let c=explicit?circuit(project,explicit):null;
    if(!c&&probe&&probe.circuitRef)c=circuit(project,probe.circuitRef);
    return{
      index,nextHop:clean(route.nextHop),distance:Number(route.distance||route.metric||1),trackId:clean(route.trackId),
      circuitRef:clean(explicit||c&&c.id),explicitCircuitRef:!!explicit,description:clean(route.description),raw:route
    };
  });
  return{deviceId,routes:normalizedRoutes,probes:normalizedProbes};
}

function validateDevice(project,deviceId){
  const p=project||{},bindings=normalizeDeviceBindings(p,deviceId),issues=[];
  const circuits=arr(p.wanCircuits).filter(c=>c&&c.deviceId===deviceId&&c.enabled!==false);
  const groups=new Map();
  for(const c of circuits){const key=circuitGroup(c);if(!groups.has(key))groups.set(key,[]);groups.get(key).push(c);}

  for(const probe of bindings.probes){
    if(probe.raw.circuitRef&&!circuit(p,probe.raw.circuitRef))issues.push(issue('NW-RES-001','Probe '+probe.id+': circuitRef inexistente '+probe.raw.circuitRef+'.',true,{deviceId,circuitRef:probe.raw.circuitRef}));
    const c=probe.circuitRef&&circuit(p,probe.circuitRef);
    if(c&&c.deviceId!==deviceId)issues.push(issue('NW-RES-002','Probe '+probe.id+': el circuito '+circuitLabel(c)+' no termina en este dispositivo.',true,{deviceId,circuitRef:c.id}));
  }
  for(const route of bindings.routes){
    if(route.raw.circuitRef&&!circuit(p,route.raw.circuitRef))issues.push(issue('NW-RES-003','Ruta por defecto '+route.nextHop+': circuitRef inexistente '+route.raw.circuitRef+'.',true,{deviceId,circuitRef:route.raw.circuitRef}));
    const c=route.circuitRef&&circuit(p,route.circuitRef);
    if(c&&c.deviceId!==deviceId)issues.push(issue('NW-RES-004','Ruta por defecto '+route.nextHop+': el circuito '+circuitLabel(c)+' no termina en este dispositivo.',true,{deviceId,circuitRef:c.id}));
  }

  for(const [groupRef,list] of groups){
    if(list.length<2)continue;
    const primaries=list.filter(c=>clean(c.role).toLowerCase()==='primary'),backups=list.filter(c=>clean(c.role).toLowerCase()==='backup');
    if(primaries.length!==1)issues.push(issue('NW-RES-005','WAN '+groupRef+': debe existir exactamente un circuito primary entre los enlaces redundantes.',true,{deviceId,groupRef}));
    if(!backups.length)issues.push(issue('NW-RES-006','WAN '+groupRef+': faltan circuitos con rol backup.',true,{deviceId,groupRef}));

    const groupRoutes=bindings.routes.filter(r=>r.circuitRef&&list.some(c=>c.id===r.circuitRef));
    if(bindings.routes.length&&groupRoutes.length<list.length){
      for(const c of list.filter(c=>!groupRoutes.some(r=>r.circuitRef===c.id))){
        issues.push(issue('NW-RES-007','WAN '+groupRef+': '+circuitLabel(c)+' no tiene una ruta por defecto vinculada mediante circuitRef.',true,{deviceId,groupRef,circuitRef:c.id}));
      }
    }
    if(groupRoutes.length){
      const primaryRoute=groupRoutes.find(r=>primaries.some(c=>c.id===r.circuitRef));
      const backupRoutes=groupRoutes.filter(r=>backups.some(c=>c.id===r.circuitRef));
      if(primaryRoute&&backupRoutes.some(r=>r.distance<=primaryRoute.distance)){
        issues.push(issue('NW-RES-008','WAN '+groupRef+': la ruta backup debe tener distancia mayor que la ruta primary.',true,{deviceId,groupRef}));
      }
      if(primaryRoute){
        if(!primaryRoute.trackId)issues.push(issue('NW-RES-009','WAN '+groupRef+': la ruta primary no tiene tracking/IP-SLA asociado.',true,{deviceId,groupRef,circuitRef:primaryRoute.circuitRef}));
        else{
          const probe=bindings.probes.find(x=>x.id===primaryRoute.trackId);
          if(!probe)issues.push(issue('NW-RES-010','WAN '+groupRef+': track '+primaryRoute.trackId+' no tiene probe definido.',true,{deviceId,groupRef,circuitRef:primaryRoute.circuitRef}));
          else if(probe.circuitRef!==primaryRoute.circuitRef)issues.push(issue('NW-RES-011','WAN '+groupRef+': el probe '+probe.id+' no está vinculado al mismo circuito que la ruta primary.',true,{deviceId,groupRef,circuitRef:primaryRoute.circuitRef}));
        }
      }
    }
  }
  return{version:'netwizard-wan-resilience-device-v1',deviceId,bindings,circuits,issues,ok:!issues.some(x=>x.blocking)};
}

function vpnSignature(plan){
  const pair=[plan.localDeviceId,plan.remoteDeviceId].sort().join('|');
  const selectors=[arr(plan.localPrefixes).join(','),arr(plan.remotePrefixes).join(',')].sort().join('<>');
  return pair+'|'+selectors;
}
function validateVpnRedundancy(project){
  const VPN=vpnModel();if(!VPN||typeof VPN.validateProject!=='function')return{groups:[],issues:[]};
  const report=VPN.validateProject(project||{}),groups=new Map(),issues=[];
  for(const plan of report.plans){
    const key=vpnSignature(plan);if(!groups.has(key))groups.set(key,[]);groups.get(key).push(plan);
  }
  const out=[];
  for(const [key,list] of groups){
    const sorted=list.slice().sort((a,b)=>Number(a.priority||100)-Number(b.priority||100));
    const circuitPairs=new Set(sorted.map(x=>[x.localCircuitRef,x.remoteCircuitRef].sort().join('|')));
    if(sorted.length>1&&circuitPairs.size<sorted.length)issues.push(issue('NW-RES-020','VPN redundante '+key+': dos túneles reutilizan el mismo par de circuitos WAN.',true,{vpnGroup:key}));
    if(sorted.length>1){
      const priorities=sorted.map(x=>Number(x.priority||100));
      if(new Set(priorities).size!==priorities.length)issues.push(issue('NW-RES-021','VPN redundante '+key+': las prioridades deben ser distintas para definir el orden de failover.',true,{vpnGroup:key}));
      const primaries=sorted.filter(x=>clean(x.role).toLowerCase()==='primary'),backups=sorted.filter(x=>clean(x.role).toLowerCase()==='backup');
      if(primaries.length!==1)issues.push(issue('NW-RES-022','VPN redundante '+key+': debe existir exactamente un túnel primary.',true,{vpnGroup:key}));
      if(!backups.length)issues.push(issue('NW-RES-023','VPN redundante '+key+': falta al menos un túnel backup.',true,{vpnGroup:key}));
    }
    out.push({key,tunnels:sorted,redundant:sorted.length>1,circuitPairs:Array.from(circuitPairs)});
  }
  return{groups:out,issues};
}

function validateProject(project){
  const p=project||{},issues=[];
  const WAN=wanModel(),wan= WAN&&WAN.validateProject?WAN.validateProject(p):{issues:[]};
  issues.push(...arr(wan.issues));
  const deviceIds=new Set(arr(p.wanCircuits).map(c=>clean(c.deviceId)).filter(Boolean));
  const devices=[];
  for(const id of deviceIds){const report=validateDevice(p,id);devices.push(report);issues.push(...report.issues);}
  const vpn=validateVpnRedundancy(p);issues.push(...vpn.issues);
  return{
    version:'netwizard-wan-resilience-v1',ok:!issues.some(x=>x.blocking),issues,devices,vpnGroups:vpn.groups,
    counts:{blocking:issues.filter(x=>x.blocking).length,warnings:issues.filter(x=>!x.blocking).length}
  };
}

function applyEvents(project,events){
  const p=clone(project||{}),evs=arr(events),failedDeviceIds=new Set(),failedLinkIds=new Set(),failedVpnIds=new Set();
  for(const event of evs){
    const type=clean(event&&event.type),ref=clean(event&&(event.targetRef||event.ref));
    if(type==='circuit'){
      const c=arr(p.wanCircuits).find(x=>x.id===ref);if(c)c.enabled=false;
    }else if(type==='provider'){
      arr(p.wanCircuits).filter(c=>clean(c.provider)===ref).forEach(c=>c.enabled=false);
    }else if(type==='device'){
      failedDeviceIds.add(ref);
      arr(p.wanCircuits).filter(c=>c.deviceId===ref).forEach(c=>c.enabled=false);
    }else if(type==='link'){
      failedLinkIds.add(ref);
    }else if(type==='vpn'){
      failedVpnIds.add(ref);
    }else if(type==='site'){
      arr(p.wanCircuits).filter(c=>circuitGroup(c)===ref||clean(c.siteRef)===ref).forEach(c=>c.enabled=false);
      arr(p.devices).filter(d=>clean(d.siteRef||d.site)===ref).forEach(d=>failedDeviceIds.add(d.id));
    }
  }
  if(failedDeviceIds.size){
    const failedPortIds=new Set(arr(p.ports).filter(x=>failedDeviceIds.has(x.deviceId)).map(x=>x.id));
    p.devices=arr(p.devices).filter(x=>!failedDeviceIds.has(x.id));
    p.ports=arr(p.ports).filter(x=>!failedDeviceIds.has(x.deviceId));
    p.links=arr(p.links).filter(l=>!failedPortIds.has(l.aPortId)&&!failedPortIds.has(l.bPortId));
  }
  if(failedLinkIds.size)p.links=arr(p.links).filter(l=>!failedLinkIds.has(l.id));
  if(failedVpnIds.size){
    p.observedState=obj(p.observedState);
    p.observedState.siteToSiteVpns=obj(p.observedState.siteToSiteVpns);
    for(const id of failedVpnIds)p.observedState.siteToSiteVpns[id]=Object.assign({},obj(p.observedState.siteToSiteVpns[id]),{status:'down',phase1:'down',phase2:'down'});
  }
  return p;
}
function reachMap(project){
  const Reach=reachability();if(!Reach||typeof Reach.analyzeAll!=='function')return new Map();
  const map=new Map();
  for(const result of Reach.analyzeAll(project||{},'icmp')){
    if(!result.source||!result.target)continue;
    const key=[result.source.id,result.target.id].sort().join('|');map.set(key,result);
  }
  return map;
}
function activeCircuitSummary(project){
  const groups=new Map();
  for(const c of arr(project&&project.wanCircuits).filter(c=>c.enabled!==false)){
    const key=circuitGroup(c);if(!groups.has(key))groups.set(key,[]);groups.get(key).push(c.id);
  }
  return Object.fromEntries(Array.from(groups.entries()));
}
function simulateEvents(project,events,name){
  const baseline=reachMap(project),degradedProject=applyEvents(project,events),after=reachMap(degradedProject);
  const baselineReachable=Array.from(baseline.entries()).filter(([,r])=>r.reachable);
  const lost=[],surviving=[];
  for(const [key,before] of baselineReachable){
    const now=after.get(key);
    if(now&&now.reachable)surviving.push({key,source:before.source,target:before.target,after:now});
    else lost.push({key,source:before.source,target:before.target,after:now||null,reason:now?now.reason:legacyReason('validation.wan.reason.degradedUnevaluable',{},'El par ya no puede evaluarse con la topología degradada.'),reasonKey:now&&now.reasonKey||'validation.wan.reason.degradedUnevaluable',reasonParams:now&&now.reasonParams||{}});
  }
  const active=activeCircuitSummary(degradedProject);
  const groupsBefore=activeCircuitSummary(project),wanLost=[];
  for(const key of Object.keys(groupsBefore))if(!arr(active[key]).length)wanLost.push(key);
  return{
    version:'netwizard-wan-resilience-simulation-v1',name:name||'Escenario de fallo',events:clone(events),
    status:lost.length||wanLost.length?'failed':events&&events.length?'survives':'baseline',
    baselineReachablePairs:baselineReachable.length,survivingReachablePairs:surviving.length,
    lostReachability:lost,survivingReachability:surviving,wanGroupsLost:wanLost,activeCircuitsByGroup:active,
    degradedProject
  };
}
function automaticScenarios(project){
  const p=project||{},out=[];
  for(const c of arr(p.wanCircuits).filter(c=>c.enabled!==false))out.push(scenario('auto-circuit-'+c.id,'validation.wan.scenario.circuit',{name:circuitLabel(c)},'Caída circuito '+circuitLabel(c),[{type:'circuit',targetRef:c.id}]));
  const providers=Array.from(new Set(arr(p.wanCircuits).filter(c=>c.enabled!==false).map(c=>clean(c.provider)).filter(Boolean)));
  providers.forEach(provider=>out.push(scenario('auto-provider-'+provider,'validation.wan.scenario.provider',{name:provider},'Caída proveedor '+provider,[{type:'provider',targetRef:provider}])));
  const routingDevices=new Set(arr(p.wanCircuits).map(c=>clean(c.deviceId)).filter(Boolean));
  arr(p.links).forEach(l=>{
    const a=port(p,l.aPortId),b=port(p,l.bPortId);
    if(a&&a.deviceId)routingDevices.add(a.deviceId);if(b&&b.deviceId)routingDevices.add(b.deviceId);
  });
  for(const id of routingDevices){const d=device(p,id);if(d)out.push(scenario('auto-device-'+id,'validation.wan.scenario.device',{name:clean(d.name||id)},'Caída equipo '+clean(d.name||id),[{type:'device',targetRef:id}]));}
  const VPN=vpnModel();if(VPN&&typeof VPN.tunnels==='function')for(const t of VPN.tunnels(p).filter(x=>x&&x.enabled!==false))out.push(scenario('auto-vpn-'+t.id,'validation.wan.scenario.vpn',{name:clean(t.name||t.id)},'Caída VPN '+clean(t.name||t.id),[{type:'vpn',targetRef:t.id}]));
  return out;
}
function analyzeProject(project){
  const validation=validateProject(project||{}),scenarios=automaticScenarios(project||{}).map(s=>Object.assign({},s,simulateEvents(project,s.events,s.name)));
  const singlePoints=scenarios.filter(s=>s.status==='failed').map(s=>({
    scenarioId:s.id,name:s.name,lostPairs:s.lostReachability.length,wanGroupsLost:s.wanGroupsLost.slice(),
    reason:s.lostReachability.length?('Pierde '+s.lostReachability.length+' pares de reachability.'):('Deja sin WAN los grupos '+s.wanGroupsLost.join(', ')+'.'),reasonKey:s.lostReachability.length?'validation.wan.spof.lostPairs':'validation.wan.spof.wanGroupsLost',reasonParams:s.lostReachability.length?{count:s.lostReachability.length}:{groups:s.wanGroupsLost.join(', ')}
  }));
  return{
    version:'netwizard-wan-resilience-analysis-v1',validation,scenarios,singlePoints,
    resilient:validation.ok&&!singlePoints.length
  };
}

const api={
  version:'netwizard-wan-resilience-v1',normalizeDeviceBindings,validateDevice,validateVpnRedundancy,validateProject,
  applyEvents,simulateEvents,automaticScenarios,analyzeProject,activeCircuitSummary,circuitGroup
};
root.NetWizardWanResilience=api;
if(typeof module!=='undefined'&&module.exports)module.exports=api;
})(typeof window!=='undefined'?window:globalThis);
