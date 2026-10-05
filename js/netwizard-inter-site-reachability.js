/* NetWizard Inter-site Reachability v1
   Derived analysis only. Does not persist reachability state.
*/
(function initNetWizardInterSiteReachability(root){
'use strict';
const arr=v=>Array.isArray(v)?v:[];
const obj=v=>v&&typeof v==='object'&&!Array.isArray(v)?v:{};
const clean=v=>String(v==null?'':v).trim();
function setReason(target,key,params,message){target.reason=message;target.reasonKey=key;target.reasonParams=params||{};return target;}
function reasoned(fields,key,params,message){return Object.assign({},fields||{},{reason:message,reasonKey:key,reasonParams:params||{}});}
function labeled(fields,key,params,label){return Object.assign({},fields||{},{label,labelKey:key,labelParams:params||{}});}
function tryRequire(path){try{return require(path);}catch{return null;}}
function routingUtils(){return root.NetWizardRoutingUtils||(typeof require==='function'?tryRequire('./netwizard-routing-utils.js'):null);}
function connectivityModel(){return root.NetWizardConnectivityModel||(typeof require==='function'?tryRequire('./netwizard-connectivity-model.js'):null);}
function siteVpn(){return root.NetWizardSiteToSiteVpn||(typeof require==='function'?tryRequire('./netwizard-site-to-site-vpn.js'):null);}
function ospfModel(){return root.NetWizardOspf||(typeof require==='function'?tryRequire('./netwizard-ospf.js'):null);}
function ipv4Int(value){const parts=clean(value).split('.');if(parts.length!==4)return null;let n=0;for(const part of parts){if(!/^\d{1,3}$/.test(part))return null;const oct=Number(part);if(oct<0||oct>255)return null;n=(n<<8)|oct;}return n>>>0;}
function ip4(n){return[(n>>>24)&255,(n>>>16)&255,(n>>>8)&255,n&255].join('.');}
function parseCidr(cidr){const m=clean(cidr).match(/^(\d{1,3}(?:\.\d{1,3}){3})\/(\d|[12]\d|3[0-2])$/);if(!m)return null;const ip=ipv4Int(m[1]),prefix=Number(m[2]);if(ip==null)return null;const mask=prefix===0?0:(0xffffffff<<(32-prefix))>>>0;const network=(ip&mask)>>>0;return{cidr:ip4(network)+'/'+prefix,ip,network,mask,prefix};}
function cidrContainsCidr(routeCidr,targetCidr){const route=parseCidr(routeCidr),target=parseCidr(targetCidr);return !!(route&&target&&route.prefix<=target.prefix&&((target.network&route.mask)>>>0)===route.network);}
function subnetOwner(project,subnet){const explicit=clean(subnet&&(subnet.gatewayDeviceRef||subnet.gatewayDeviceId||subnet.ownerDeviceRef||subnet.routingDeviceRef));if(explicit)return explicit;const roas=obj(project&&project.roas);return clean(roas.gwId);}
function subnetById(project,id){return arr(project&&project.subnets).find(s=>s&&s.id===id)||null;}
function vlanByRef(project,ref){return arr(project&&project.vlans).find(v=>v&&v.id===ref)||null;}
function deviceById(project,id){return arr(project&&project.devices).find(d=>d&&d.id===id)||null;}
function portById(project,id){return arr(project&&project.ports).find(p=>p&&p.id===id)||null;}
function portIp(port){return clean(port&&(port.l3Ip||port.routedIp||(clean(port.l3Cidr||port.routedCidr).split('/')[0])));}
function labelSubnet(project,sn){const v=vlanByRef(project,sn&&sn.vlanRef);return v?('VLAN '+v.vlanId+' '+clean(v.name)).trim():clean(sn&&sn.cidr)||clean(sn&&sn.id);}
function labelDevice(project,id){const d=deviceById(project,id);return d?clean(d.name||d.id):id;}
function selectRoute(project,deviceId,targetCidr){const RU=routingUtils();const resolved=RU&&typeof RU.resolveStaticRoutes==='function'?RU.resolveStaticRoutes(project,deviceId):{routes:[],issues:[]};const candidates=arr(resolved.routes).filter(r=>cidrContainsCidr(r.destination,targetCidr)).sort((a,b)=>{const pa=parseCidr(a.destination),pb=parseCidr(b.destination);return (pb?pb.prefix:-1)-(pa?pa.prefix:-1)||Number(a.distance||1)-Number(b.distance||1);});return{route:candidates[0]||null,issues:arr(resolved.issues)};}
function peerForNextHop(project,currentDeviceId,route){const nextHop=clean(route&&route.nextHop),outPort=portById(project,route&&route.outPortId);if(!nextHop||!outPort)return null;const peerPort=arr(project&&project.ports).find(p=>p&&p.deviceId!==currentDeviceId&&portIp(p)===nextHop);if(!peerPort)return null;const link=arr(project&&project.links).find(l=>{const a=clean(l&&l.aPortId),b=clean(l&&l.bPortId);return(a===outPort.id&&b===peerPort.id)||(b===outPort.id&&a===peerPort.id);});if(!link)return null;return{deviceId:peerPort.deviceId,portId:peerPort.id,portName:clean(peerPort.name||peerPort.id),linkId:link.id||'',link};}
function traceDirection(project,sourceSubnet,targetSubnet){
  const strategy=clean(obj(project&&project.routing).protocol||obj(project&&project.routing).strategy||obj(project&&project.routing).mode).toLowerCase();
  const sourceOwner=subnetOwner(project,sourceSubnet),targetOwner=subnetOwner(project,targetSubnet);
  const result={ok:false,strategy,sourceSubnetId:sourceSubnet&&sourceSubnet.id||'',targetSubnetId:targetSubnet&&targetSubnet.id||'',sourceOwner,targetOwner,hops:[],reason:''};
  if(!['static','ospf'].includes(strategy)){return setReason(result,'validation.reach.reason.strategy',{},'El análisis inter-sede requiere routing.strategy static u ospf.');}
  if(!sourceOwner){return setReason(result,'validation.reach.reason.sourceOwner',{},'La subnet origen no tiene gatewayDeviceRef/owner de routing explícito.');}
  if(!targetOwner){return setReason(result,'validation.reach.reason.targetOwner',{},'La subnet destino no tiene gatewayDeviceRef/owner de routing explícito.');}
  if(!parseCidr(sourceSubnet&&sourceSubnet.cidr)||!parseCidr(targetSubnet&&targetSubnet.cidr)){return setReason(result,'validation.reach.reason.invalidCidr',{},'Origen o destino no tiene un CIDR IPv4 válido.');}
  if(strategy==='ospf'){
    const OSPF=ospfModel();
    if(!OSPF){return setReason(result,'validation.reach.reason.ospfUnavailable',{},'Modelo OSPF no disponible.');}
    const validation=OSPF.validateProject(project);
    const deviceIssues=arr(validation.issues).filter(x=>x&&x.blocking&&[sourceOwner,targetOwner].includes(x.deviceId));
    if(deviceIssues.length){return setReason(result,'validation.reach.reason.ospfInvalid',{details:deviceIssues.map(x=>clean(x.message)).join(' ')},'Intención OSPF inválida: '+deviceIssues.map(x=>clean(x.message)).join(' '));}
    const targetPlan=arr(validation.plans).find(x=>x.deviceId===targetOwner);
    if(!targetPlan||!arr(targetPlan.networks).some(n=>clean(n.cidr)===clean(targetSubnet.cidr))){
      return setReason(result,'validation.reach.reason.ospfNotAdvertised',{cidr:targetSubnet.cidr},'El router destino no anuncia '+targetSubnet.cidr+' por OSPF.');
    }
    const path=OSPF.adjacencyPath(project,sourceOwner,targetOwner,{useObserved:true});
    if(!path){
      const planned=OSPF.adjacencyPath(project,sourceOwner,targetOwner,{useObserved:false});
      return setReason(result,planned?'validation.reach.reason.ospfObservedMissing':'validation.reach.reason.ospfNoPath',{},planned?'El camino OSPF existe en To-Be, pero la evidencia Observed no confirma adyacencias FULL.':'No existe un camino de adyacencias OSPF compatible entre los routers.');
    }
    result.hops.push({kind:'device',deviceId:sourceOwner,label:labelDevice(project,sourceOwner)});
    for(const edge of arr(path.edges)){
      const n=edge.neighbor;
      result.hops.push(labeled({kind:'ospf',deviceId:n.deviceId,peerDeviceId:n.peerDeviceId,localPortId:n.localPortId,area:n.area,state:edge.state},'validation.reach.ospfHop',{area:n.area,port:n.localPortName,peer:labelDevice(project,n.peerDeviceId)},'OSPF área '+n.area+' · '+n.localPortName+' → '+labelDevice(project,n.peerDeviceId)));
      result.hops.push({kind:'device',deviceId:n.peerDeviceId,label:labelDevice(project,n.peerDeviceId)});
    }
    result.ok=true;result.confidence=path.confidence;
    return setReason(result,path.confidence==='observed'?'validation.reach.reason.ospfObserved':'validation.reach.reason.ospfPlanned',{},path.confidence==='observed'?'Camino OSPF confirmado por vecinos Observed FULL.':'Camino OSPF coherente con el To-Be; faltan evidencias Observed FULL en algún salto.');
  }

  let current=sourceOwner;const visited=new Set();
  for(let depth=0;depth<16;depth++){
    if(visited.has(current))return setReason(result,'validation.reach.reason.loop',{device:labelDevice(project,current)},'Se detectó un bucle de routing en '+labelDevice(project,current)+'.');
    visited.add(current);result.hops.push({kind:'device',deviceId:current,label:labelDevice(project,current)});
    if(current===targetOwner){result.ok=true;return setReason(result,'validation.reach.reason.targetOwnsSubnet',{},'El router destino posee la subnet remota.');}
    const VPN=siteVpn();
    if(VPN&&typeof VPN.findOverlay==='function'){
      const overlay=VPN.findOverlay(project,current,targetOwner,sourceSubnet.cidr,targetSubnet.cidr);
      if(overlay&&overlay.matched){
        if(!overlay.available)return setReason(result,'validation.reach.reason.vpnUnavailable',{vpn:clean(overlay.plan&&overlay.plan.name||overlay.plan&&overlay.plan.id),details:clean(overlay.reason)},'VPN '+clean(overlay.plan&&overlay.plan.name||overlay.plan&&overlay.plan.id)+': '+clean(overlay.reason));
        result.hops.push({
          kind:'vpn',tunnelId:overlay.plan.id,label:'VPN '+clean(overlay.plan.name||overlay.plan.id),
          localEndpoint:overlay.plan.localEndpoint,remoteEndpoint:overlay.plan.remoteEndpoint,
          observedStatus:overlay.status,detail:overlay.reason
        });
        current=targetOwner;
        continue;
      }
    }
    const selected=selectRoute(project,current,targetSubnet.cidr);
    if(selected.issues.length)return setReason(result,'validation.reach.reason.routingInvalid',{device:labelDevice(project,current),details:selected.issues.map(i=>clean(i.message)).join(' ')},'Routing inválido en '+labelDevice(project,current)+': '+selected.issues.map(i=>clean(i.message)).join(' '));
    const route=selected.route;
    if(!route)return setReason(result,'validation.reach.reason.noRoute',{cidr:targetSubnet.cidr,device:labelDevice(project,current)},'No existe ruta hacia '+targetSubnet.cidr+' en '+labelDevice(project,current)+'.');
    const peer=peerForNextHop(project,current,route);
    result.hops.push({kind:'route',deviceId:current,destination:route.destination,nextHop:route.nextHop,outPortId:route.outPortId||'',outPortName:route.outPortName||'',source:route.source||'inferred',distance:Number(route.distance||1),label:route.destination+' → '+route.nextHop});
    if(!peer)return setReason(result,'validation.reach.reason.nextHopUnresolved',{nextHop:route.nextHop,device:labelDevice(project,current),interface:route.outPortName||route.outPortId||'la interfaz de salida'},'El next-hop '+route.nextHop+' de '+labelDevice(project,current)+' no resuelve a un vecino enlazado por '+(route.outPortName||route.outPortId||'la interfaz de salida')+'.');
    result.hops.push({kind:'link',linkId:peer.linkId,fromDeviceId:current,toDeviceId:peer.deviceId,label:labelDevice(project,current)+' → '+labelDevice(project,peer.deviceId)});
    current=peer.deviceId;
  }
  return setReason(result,'validation.reach.reason.hopLimit',{},'Se superó el máximo de saltos permitido para el análisis.');
}
function policyDecision(project,sourceSubnet,targetSubnet,serviceId){const p=project||{},matrix=obj(p.vlanMatrix),key=clean(sourceSubnet&&sourceSubnet.vlanRef)+'_'+clean(targetSubnet&&targetSubnet.vlanRef),hasMatrix=Object.prototype.hasOwnProperty.call(matrix,key);if(hasMatrix&&matrix[key]===false)return reasoned({allowed:false,explicit:true,matched:{id:key,source:'vlanMatrix',action:'deny'},profile:null},'validation.reach.policy.matrixDeny',{},'La matriz inter-VLAN bloquea explícitamente este flujo.');const CM=connectivityModel();if(!CM||typeof CM.firewallDecision!=='function')return reasoned({allowed:true,explicit:hasMatrix,matched:hasMatrix?{id:key,source:'vlanMatrix',action:'allow'}:null},hasMatrix?'validation.reach.policy.matrixAllow':'validation.reach.policy.unavailable',{},hasMatrix?'La matriz inter-VLAN permite explícitamente este flujo.':'Modelo de política no disponible; reachability L3 calculada sin política.');const a={vlanRef:sourceSubnet.vlanRef||null,ip:clean(sourceSubnet.gateway)};const b={vlanRef:targetSubnet.vlanRef||null,ip:clean(targetSubnet.gateway)};const decision=CM.firewallDecision(p,a,b,serviceId||'icmp');if(decision.matched)return{allowed:decision.allowed!==false,explicit:true,reason:decision.reason||'',reasonKey:decision.reasonKey||'',reasonParams:decision.reasonParams||{},matched:decision.matched,profile:decision.profile||null};if(hasMatrix)return reasoned({allowed:true,explicit:true,matched:{id:key,source:'vlanMatrix',action:'allow'},profile:decision.profile||null},'validation.reach.policy.matrixAllow',{},'La matriz inter-VLAN permite explícitamente este flujo.');return{allowed:decision.allowed!==false,explicit:false,reason:decision.reason||'',reasonKey:decision.reasonKey||'',reasonParams:decision.reasonParams||{},matched:null,profile:decision.profile||null};}
function analyze(project,sourceSubnetId,targetSubnetId,serviceId){const p=project||{},source=subnetById(p,sourceSubnetId),target=subnetById(p,targetSubnetId);if(!source||!target)return reasoned({status:'blocked',reachable:false,forward:null,reverse:null,policy:null},'validation.reach.reason.selectTwo',{},'Selecciona dos subnets válidas.');if(source.id===target.id)return reasoned({status:'blocked',reachable:false,source,target,forward:null,reverse:null,policy:null},'validation.reach.reason.distinctSubnets',{},'Origen y destino deben ser subnets distintas.');const forward=traceDirection(p,source,target),reverse=traceDirection(p,target,source),policy=policyDecision(p,source,target,serviceId||'icmp');let key='',params={},reason='';if(!forward.ok){key='validation.reach.forwardPrefix';params={reason:forward.reason};reason='IDA: '+forward.reason;}else if(!reverse.ok){key='validation.reach.reversePrefix';params={reason:reverse.reason};reason='RETORNO: '+reverse.reason;}else if(!policy.allowed){key='validation.reach.policyPrefix';params={reason:policy.reason};reason='POLÍTICA: '+policy.reason;}else if(policy.explicit){key='validation.reach.successExplicit';reason='Ruta bidireccional y política explícita permiten el flujo.';}else{key='validation.reach.successImplicit';reason='Ruta bidireccional disponible; no se detecta un bloqueo explícito de política.';}const reachable=forward.ok&&reverse.ok&&policy.allowed;return reasoned({version:'netwizard-inter-site-reachability-v1',status:reachable?'reachable':'blocked',reachable,source:Object.assign({},source,{label:labelSubnet(p,source)}),target:Object.assign({},target,{label:labelSubnet(p,target)}),serviceId:serviceId||'icmp',forward,reverse,policy},key,params,reason);}
function analyzeAll(project,serviceId){const subs=arr(project&&project.subnets).filter(s=>s&&parseCidr(s.cidr)&&subnetOwner(project,s));const results=[];for(let i=0;i<subs.length;i++)for(let j=i+1;j<subs.length;j++)results.push(analyze(project,subs[i].id,subs[j].id,serviceId||'icmp'));return results;}
const api={version:'netwizard-inter-site-reachability-v1',analyze,analyzeAll,traceDirection,selectRoute,peerForNextHop,subnetOwner,cidrContainsCidr};
root.NetWizardInterSiteReachability=api;if(typeof module!=='undefined'&&module.exports)module.exports=api;
})(typeof window!=='undefined'?window:globalThis);
