/* NetWizard OSPF Intent v1
   Canonical To-Be authority: project.routing.ospf.devices[deviceId].
   Observed authority: project.observedState.ospfNeighbors[deviceId].
*/
(function initNetWizardOspf(root){
'use strict';

const arr=v=>Array.isArray(v)?v:[];
const obj=v=>v&&typeof v==='object'&&!Array.isArray(v)?v:{};
const clean=v=>String(v==null?'':v).trim();
function tryRequire(path){try{return require(path);}catch{return null;}}
function routingUtils(){return root.NetWizardRoutingUtils||(typeof require==='function'?tryRequire('./netwizard-routing-utils.js'):null);}
function networkUtils(){return root.NetWizardNetworkUtils||(typeof require==='function'?tryRequire('./netwizard-network-utils.js'):null);}

function deviceById(project,id){return arr(project&&project.devices).find(d=>d&&d.id===id)||null;}
function portById(project,id){return arr(project&&project.ports).find(p=>p&&p.id===id)||null;}
function ipOnly(value){return clean(value).split('/')[0].trim();}
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
function validRouterId(value){const n=ipv4Int(value);return n!=null&&n!==0&&n!==0xffffffff;}
function normalizeArea(value){
  const raw=clean(value||'0');
  if(/^\d+$/.test(raw)){
    const n=Number(raw);return Number.isInteger(n)&&n>=0&&n<=4294967295?String(n):'';
  }
  const n=ipv4Int(raw);return n==null?'':raw;
}
function routedPorts(project,deviceId){
  return arr(project&&project.ports).filter(p=>p&&p.deviceId===deviceId&&clean(p.mode||p.role).toLowerCase()==='routed'&&clean(p.l3Cidr||p.routedCidr));
}
function legacyRouterId(project,deviceId){
  const routing=obj(project&&project.routing),device=deviceById(project,deviceId);
  const explicit=clean(obj(routing.routerIds)[deviceId]||device&&device.routerId);
  if(explicit)return explicit;
  const loopback=routedPorts(project,deviceId).find(p=>/loopback/i.test(clean(p.name)));
  if(loopback)return ipOnly(loopback.l3Ip||loopback.routedIp||loopback.l3Cidr||loopback.routedCidr);
  const ips=routedPorts(project,deviceId).map(p=>ipOnly(p.l3Ip||p.routedIp||p.l3Cidr||p.routedCidr)).filter(x=>ipv4Int(x)!=null).sort((a,b)=>(ipv4Int(a)>>>0)-(ipv4Int(b)>>>0));
  return ips.length?ips[ips.length-1]:'';
}
function deviceConfig(project,deviceId){
  const routing=obj(project&&project.routing),ospf=obj(routing.ospf),devices=obj(ospf.devices),explicit=obj(devices[deviceId]);
  const hasExplicit=Object.keys(explicit).length>0;
  const defaultArea=normalizeArea(explicit.defaultArea||ospf.defaultArea||routing.area||routing.ospfArea||'0')||'0';
  const processId=Number(explicit.processId||ospf.processId||routing.processId||1);
  const routerId=clean(explicit.routerId||legacyRouterId(project,deviceId));
  const passiveDefault=explicit.passiveDefault==null?(ospf.passiveDefault==null?routing.passiveDefault!==false:ospf.passiveDefault!==false):explicit.passiveDefault!==false;
  const interfaces=obj(explicit.interfaces);
  return{hasExplicit,processId,routerId,defaultArea,passiveDefault,interfaces,summaries:arr(explicit.summaries||ospf.summaries)};
}
function interfaceConfig(project,deviceId,port){
  const cfg=deviceConfig(project,deviceId),raw=obj(cfg.interfaces[port.id]);
  const enabled=cfg.hasExplicit?raw.enabled===true:!/loopback/i.test(clean(port.name));
  return{
    portId:port.id,
    portName:clean(port.name||port.id),
    cidr:clean(port.l3Cidr||port.routedCidr),
    ip:ipOnly(port.l3Ip||port.routedIp||port.l3Cidr||port.routedCidr),
    enabled,
    area:normalizeArea(raw.area||cfg.defaultArea)||cfg.defaultArea,
    passive:raw.passive==null?false:raw.passive===true,
    cost:raw.cost==null||raw.cost===''?null:Number(raw.cost)
  };
}
function localNetworks(project,deviceId){
  const RU=routingUtils();
  return RU&&typeof RU.collectLocalNetworks==='function'?RU.collectLocalNetworks(project,deviceId,{includeTransit:true}):[];
}
function buildDeviceIntent(project,deviceId){
  const p=project||{},cfg=deviceConfig(p,deviceId),interfaces=routedPorts(p,deviceId).map(port=>interfaceConfig(p,deviceId,port));
  const issues=[];
  if(!Number.isInteger(cfg.processId)||cfg.processId<1||cfg.processId>65535)issues.push({code:'NW-OSPF-001',message:'processId OSPF debe estar entre 1 y 65535.',blocking:true});
  if(!validRouterId(cfg.routerId))issues.push({code:'NW-OSPF-002',message:'router-id OSPF inválido o ausente.',blocking:true});
  if(!normalizeArea(cfg.defaultArea))issues.push({code:'NW-OSPF-003',message:'Área OSPF por defecto inválida.',blocking:true});
  for(const iface of interfaces){
    if(!iface.enabled)continue;
    if(!normalizeArea(iface.area))issues.push({code:'NW-OSPF-004',portId:iface.portId,message:'Área OSPF inválida en '+iface.portName+'.',blocking:true});
    if(iface.cost!=null&&(!Number.isInteger(iface.cost)||iface.cost<1||iface.cost>65535))issues.push({code:'NW-OSPF-005',portId:iface.portId,message:'Coste OSPF debe estar entre 1 y 65535 en '+iface.portName+'.',blocking:true});
  }
  const networks=[];
  for(const iface of interfaces.filter(x=>x.enabled)){
    const NWU=networkUtils(),parsed=NWU&&NWU.parseCidr?NWU.parseCidr(iface.cidr):null;
    if(!parsed){issues.push({code:'NW-OSPF-006',portId:iface.portId,message:'CIDR routed inválido en '+iface.portName+'.',blocking:true});continue;}
    networks.push({
      cidr:parsed.cidr,area:iface.area,passive:iface.passive,source:'interface',
      portId:iface.portId,portName:iface.portName,cost:iface.cost
    });
  }
  const enabledCidrs=new Set(networks.map(x=>x.cidr));
  for(const net of localNetworks(p,deviceId)){
    if(net.type!=='local-vlan'||enabledCidrs.has(net.cidr))continue;
    networks.push({cidr:net.cidr,area:cfg.defaultArea,passive:true,source:net.source||'local-vlan',portId:'',portName:'',cost:null});
  }
  return{
    version:'netwizard-ospf-device-intent-v1',deviceId,processId:cfg.processId,routerId:cfg.routerId,
    defaultArea:cfg.defaultArea,passiveDefault:cfg.passiveDefault,interfaces,networks,summaries:cfg.summaries,issues,
    ok:!issues.some(x=>x.blocking)
  };
}
function linkPeer(project,portId){
  const link=arr(project&&project.links).find(l=>l&&(l.aPortId===portId||l.bPortId===portId));
  if(!link)return null;
  const peerPortId=link.aPortId===portId?link.bPortId:link.aPortId,peer=portById(project,peerPortId);
  return peer?{linkId:link.id||'',peerPortId,peerDeviceId:peer.deviceId,peerPort:peer}:null;
}
function expectedNeighbors(project){
  const p=project||{},routing=obj(p.routing);
  const strategy=clean(routing.protocol||routing.strategy||routing.mode).toLowerCase();
  if(strategy!=='ospf')return[];
  const deviceIds=arr(p.devices).map(d=>d.id),plans=new Map(deviceIds.map(id=>[id,buildDeviceIntent(p,id)]));
  const out=[],seen=new Set();
  for(const [deviceId,plan] of plans){
    for(const iface of plan.interfaces.filter(x=>x.enabled&&!x.passive)){
      const peer=linkPeer(p,iface.portId);if(!peer)continue;
      const peerPlan=plans.get(peer.peerDeviceId);if(!peerPlan||!peerPlan.ok)continue;
      const peerIface=peerPlan.interfaces.find(x=>x.portId===peer.peerPortId&&x.enabled&&!x.passive);
      if(!peerIface||peerIface.area!==iface.area)continue;
      const key=[deviceId,iface.portId,peer.peerDeviceId,peer.peerPortId].join('|');if(seen.has(key))continue;seen.add(key);
      out.push({
        deviceId,localPortId:iface.portId,localPortName:iface.portName,area:iface.area,
        routerId:plan.routerId,peerDeviceId:peer.peerDeviceId,peerPortId:peer.peerPortId,peerPortName:peerIface.portName,
        peerRouterId:peerPlan.routerId,linkId:peer.linkId
      });
    }
  }
  return out;
}
function observedNeighbors(project,deviceId){
  return arr(obj(obj(project&&project.observedState).ospfNeighbors)[deviceId]);
}
function compareObserved(project,deviceId){
  const expected=expectedNeighbors(project).filter(x=>x.deviceId===deviceId),observed=observedNeighbors(project,deviceId),rows=[];
  for(const exp of expected){
    const obs=observed.find(x=>
      (clean(x.localPortId)&&clean(x.localPortId)===exp.localPortId)&&
      ((clean(x.peerRouterId)&&clean(x.peerRouterId)===exp.peerRouterId)||(!clean(x.peerRouterId)&&clean(x.peerDeviceId)===exp.peerDeviceId))
    )||null;
    const state=clean(obs&&obs.state||'missing').toLowerCase();
    rows.push({...exp,observed:obs,status:!obs?'missing':state==='full'?'full':'mismatch',observedState:state});
  }
  const unexpected=observed.filter(obs=>!expected.some(exp=>clean(obs.localPortId)===exp.localPortId&&(clean(obs.peerRouterId)===exp.peerRouterId||clean(obs.peerDeviceId)===exp.peerDeviceId)));
  return{
    version:'netwizard-ospf-observed-compare-v1',deviceId,expected:rows,unexpected,
    ok:rows.every(x=>x.status==='full')&&!unexpected.length,
    counts:{expected:rows.length,full:rows.filter(x=>x.status==='full').length,missing:rows.filter(x=>x.status==='missing').length,mismatch:rows.filter(x=>x.status==='mismatch').length,unexpected:unexpected.length}
  };
}
function validateProject(project){
  const p=project||{},routing=obj(p.routing),strategy=clean(routing.protocol||routing.strategy||routing.mode).toLowerCase();
  const plans=arr(p.devices).map(d=>buildDeviceIntent(p,d.id)),issues=[];
  if(strategy!=='ospf')return{version:'netwizard-ospf-project-v1',ok:true,active:false,plans:[],neighbors:[],issues:[],counts:{blocking:0,warnings:0}};
  const routerIds=new Map();
  for(const plan of plans){
    issues.push(...plan.issues.map(x=>({...x,deviceId:plan.deviceId})));
    if(validRouterId(plan.routerId)){
      if(routerIds.has(plan.routerId))issues.push({code:'NW-OSPF-007',deviceId:plan.deviceId,blocking:true,message:'router-id OSPF duplicado '+plan.routerId+' entre '+routerIds.get(plan.routerId)+' y '+plan.deviceId+'.'});
      else routerIds.set(plan.routerId,plan.deviceId);
    }
  }
  const neighbors=expectedNeighbors(p);
  for(const plan of plans.filter(x=>x.ok)){
    const active=plan.interfaces.filter(x=>x.enabled&&!x.passive);
    for(const iface of active){
      if(!neighbors.some(n=>n.deviceId===plan.deviceId&&n.localPortId===iface.portId)){
        issues.push({code:'NW-OSPF-008',deviceId:plan.deviceId,portId:iface.portId,blocking:false,message:'Interfaz OSPF activa '+iface.portName+' no tiene vecino esperado compatible en el enlace documentado.'});
      }
    }
  }
  return{
    version:'netwizard-ospf-project-v1',active:true,plans,neighbors,issues,
    ok:!issues.some(x=>x.blocking),
    counts:{blocking:issues.filter(x=>x.blocking).length,warnings:issues.filter(x=>!x.blocking).length}
  };
}
function adjacencyPath(project,fromDeviceId,toDeviceId,options){
  if(!fromDeviceId||!toDeviceId)return null;
  if(fromDeviceId===toDeviceId)return{devices:[fromDeviceId],edges:[],confidence:'planned'};
  const expected=expectedNeighbors(project),graph=new Map(),opts=options||{},useObserved=opts.useObserved!==false;
  const add=(from,edge)=>{const list=graph.get(from)||[];list.push(edge);graph.set(from,list);};
  for(const n of expected){
    let state='planned';
    if(useObserved){
      const observed=observedNeighbors(project,n.deviceId),hasAny=observed.length>0;
      if(hasAny){
        const obs=observed.find(x=>clean(x.localPortId)===n.localPortId&&(clean(x.peerRouterId)===n.peerRouterId||clean(x.peerDeviceId)===n.peerDeviceId));
        state=obs&&clean(obs.state).toLowerCase()==='full'?'full':'down';
      }
    }
    if(state==='down')continue;
    add(n.deviceId,{to:n.peerDeviceId,neighbor:n,state});
  }
  const queue=[fromDeviceId],seen=new Set([fromDeviceId]),prev=new Map();
  while(queue.length){
    const cur=queue.shift();
    for(const edge of graph.get(cur)||[]){
      if(seen.has(edge.to))continue;
      seen.add(edge.to);prev.set(edge.to,{from:cur,edge});
      if(edge.to===toDeviceId){
        const devices=[toDeviceId],edges=[];let node=toDeviceId;
        while(node!==fromDeviceId){const x=prev.get(node);if(!x)return null;edges.unshift(x.edge);node=x.from;devices.unshift(node);}
        return{devices,edges,confidence:edges.every(x=>x.state==='full')?'observed':'planned'};
      }
      queue.push(edge.to);
    }
  }
  return null;
}

const api={
  version:'netwizard-ospf-v1',deviceConfig,interfaceConfig,buildDeviceIntent,validateProject,
  expectedNeighbors,observedNeighbors,compareObserved,adjacencyPath,normalizeArea,validRouterId,routedPorts
};
root.NetWizardOspf=api;
if(typeof module!=='undefined'&&module.exports)module.exports=api;
})(typeof window!=='undefined'?window:globalThis);
