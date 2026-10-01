/* NetWizard Site-to-Site VPN v1
   Canonical optional authority: project.routing.siteToSiteVpns[].
   WAN circuits remain transport; this module models the encrypted overlay.
*/
(function initNetWizardSiteToSiteVpn(root){
'use strict';

const arr=v=>Array.isArray(v)?v:[];
const obj=v=>v&&typeof v==='object'&&!Array.isArray(v)?v:{};
const clean=v=>String(v==null?'':v).trim();

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
function ip4(n){return[(n>>>24)&255,(n>>>16)&255,(n>>>8)&255,n&255].join('.');}
function parseCidr(cidr){
  const m=clean(cidr).match(/^(\d{1,3}(?:\.\d{1,3}){3})\/(\d|[12]\d|3[0-2])$/);
  if(!m)return null;
  const ip=ipv4Int(m[1]),prefix=Number(m[2]);if(ip==null)return null;
  const mask=prefix===0?0:(0xffffffff<<(32-prefix))>>>0,network=(ip&mask)>>>0;
  return{cidr:ip4(network)+'/'+prefix,ip,network,mask,prefix};
}
function cidrContains(superCidr,subCidr){
  const a=parseCidr(superCidr),b=parseCidr(subCidr);
  return !!(a&&b&&a.prefix<=b.prefix&&((b.network&a.mask)>>>0)===a.network);
}
function normalizeCidrs(value){
  const raw=Array.isArray(value)?value:String(value||'').split(/[\s,;]+/);
  const out=[],seen=new Set();
  for(const item of raw){
    const parsed=parseCidr(item);
    if(!parsed||seen.has(parsed.cidr))continue;
    seen.add(parsed.cidr);out.push(parsed.cidr);
  }
  return out.sort();
}
function tunnels(project){return arr(obj(project&&project.routing).siteToSiteVpns);}
function device(project,id){return arr(project&&project.devices).find(x=>x&&x.id===id)||null;}
function circuit(project,id){return arr(project&&project.wanCircuits).find(x=>x&&x.id===id)||null;}
function port(project,id){return arr(project&&project.ports).find(x=>x&&x.id===id)||null;}
function portIp(p){
  if(!p)return'';
  const direct=clean(p.l3Ip||p.routedIp);if(ipv4Int(direct)!=null)return direct;
  const cidr=clean(p.l3Cidr||p.routedCidr);return parseCidr(cidr)?cidr.split('/')[0]:'';
}
function circuitEndpoint(project,circuitRef){
  const c=circuit(project,circuitRef),p=c&&port(project,c.portId);
  return{circuit:c,port:p,ip:portIp(p)};
}
function subnetOwner(project,sn){
  const explicit=clean(sn&&(sn.gatewayDeviceRef||sn.gatewayDeviceId||sn.ownerDeviceRef||sn.routingDeviceRef));
  if(explicit)return explicit;
  return clean(obj(project&&project.roas).gwId);
}
function selectorOwnedByDevice(project,cidr,deviceId){
  return arr(project&&project.subnets).some(sn=>subnetOwner(project,sn)===deviceId&&parseCidr(sn.cidr)&&cidrContains(sn.cidr,cidr));
}
function observedFor(project,tunnelId){
  const state=obj(project&&project.observedState),map=obj(state.siteToSiteVpns);
  return obj(map[tunnelId]);
}
function safeAlias(value){return /^[A-Za-z0-9_.:-]{3,120}$/.test(clean(value));}
function normalizeTunnel(project,raw,index){
  const t=obj(raw),local=circuitEndpoint(project,t.localCircuitRef),remote=circuitEndpoint(project,t.remoteCircuitRef);
  return{
    id:clean(t.id||('vpn-'+String((index||0)+1))),
    name:clean(t.name||t.id||('VPN '+String((index||0)+1))),
    enabled:t.enabled!==false,
    role:clean(t.role||'primary').toLowerCase(),
    priority:Number(t.priority==null||t.priority===''?((index||0)+1)*10:t.priority),
    localDeviceId:clean(t.localDeviceId),
    remoteDeviceId:clean(t.remoteDeviceId),
    localCircuitRef:clean(t.localCircuitRef),
    remoteCircuitRef:clean(t.remoteCircuitRef),
    localEndpoint:local.ip,
    remoteEndpoint:remote.ip,
    localWanPortId:local.port&&local.port.id||'',
    remoteWanPortId:remote.port&&remote.port.id||'',
    localWanPortName:clean(local.port&&(local.port.name||local.port.id)),
    remoteWanPortName:clean(remote.port&&(remote.port.name||remote.port.id)),
    localPrefixes:normalizeCidrs(t.localPrefixes),
    remotePrefixes:normalizeCidrs(t.remotePrefixes),
    ikeVersion:clean(t.ikeVersion||'2'),
    encryption:clean(t.encryption||'aes256').toLowerCase(),
    integrity:clean(t.integrity||'sha256').toLowerCase(),
    dhGroup:Number(t.dhGroup||14),
    pfsGroup:Number(t.pfsGroup||14),
    ikeLifetimeSeconds:Number(t.ikeLifetimeSeconds||28800),
    ipsecLifetimeSeconds:Number(t.ipsecLifetimeSeconds||3600),
    secretAlias:clean(t.secretAlias),
    description:clean(t.description),
    observed:observedFor(project,t.id)
  };
}
function issue(code,message,blocking,tunnelId,side){return{code,severity:blocking?'error':'warning',blocking:!!blocking,category:'site-to-site-vpn',tunnelId,side:side||'',message};}
function validateTunnel(project,raw,index){
  const p=project||{},plan=normalizeTunnel(p,raw,index),issues=[],id=plan.id||('vpn-'+String((index||0)+1));
  const localDev=device(p,plan.localDeviceId),remoteDev=device(p,plan.remoteDeviceId);
  const localCircuit=circuit(p,plan.localCircuitRef),remoteCircuit=circuit(p,plan.remoteCircuitRef);
  if(!plan.id)issues.push(issue('NW-VPN-001','VPN sin id.',true,id));
  if(!localDev)issues.push(issue('NW-VPN-002',plan.name+': dispositivo local inexistente.',true,id,'local'));
  if(!remoteDev)issues.push(issue('NW-VPN-003',plan.name+': dispositivo remoto inexistente.',true,id,'remote'));
  if(plan.localDeviceId&&plan.remoteDeviceId&&plan.localDeviceId===plan.remoteDeviceId)issues.push(issue('NW-VPN-004',plan.name+': los extremos deben ser dispositivos distintos.',true,id));
  if(!localCircuit)issues.push(issue('NW-VPN-005',plan.name+': circuito WAN local inexistente.',true,id,'local'));
  if(!remoteCircuit)issues.push(issue('NW-VPN-006',plan.name+': circuito WAN remoto inexistente.',true,id,'remote'));
  if(localCircuit&&localCircuit.deviceId!==plan.localDeviceId)issues.push(issue('NW-VPN-007',plan.name+': el circuito local no termina en el dispositivo local.',true,id,'local'));
  if(remoteCircuit&&remoteCircuit.deviceId!==plan.remoteDeviceId)issues.push(issue('NW-VPN-008',plan.name+': el circuito remoto no termina en el dispositivo remoto.',true,id,'remote'));
  if(localCircuit&&localCircuit.enabled===false)issues.push(issue('NW-VPN-010',plan.name+': el circuito WAN local está deshabilitado.',true,id,'local'));
  if(remoteCircuit&&remoteCircuit.enabled===false)issues.push(issue('NW-VPN-011',plan.name+': el circuito WAN remoto está deshabilitado.',true,id,'remote'));
  if(ipv4Int(plan.localEndpoint)==null)issues.push(issue('NW-VPN-012',plan.name+': la interfaz del circuito local necesita IPv4 routed explícita.',true,id,'local'));
  if(ipv4Int(plan.remoteEndpoint)==null)issues.push(issue('NW-VPN-013',plan.name+': la interfaz del circuito remoto necesita IPv4 routed explícita.',true,id,'remote'));
  if(!plan.localPrefixes.length)issues.push(issue('NW-VPN-014',plan.name+': no hay selectores/prefijos locales.',true,id,'local'));
  if(!plan.remotePrefixes.length)issues.push(issue('NW-VPN-015',plan.name+': no hay selectores/prefijos remotos.',true,id,'remote'));
  for(const cidr of plan.localPrefixes){
    if(cidr==='0.0.0.0/0')issues.push(issue('NW-VPN-016',plan.name+': 0.0.0.0/0 no se acepta como selector local en esta implementación.',true,id,'local'));
    else if(!selectorOwnedByDevice(p,cidr,plan.localDeviceId))issues.push(issue('NW-VPN-017',plan.name+': selector local '+cidr+' no pertenece a una subnet del dispositivo local.',true,id,'local'));
  }
  for(const cidr of plan.remotePrefixes){
    if(cidr==='0.0.0.0/0')issues.push(issue('NW-VPN-018',plan.name+': 0.0.0.0/0 no se acepta como selector remoto en esta implementación.',true,id,'remote'));
    else if(!selectorOwnedByDevice(p,cidr,plan.remoteDeviceId))issues.push(issue('NW-VPN-019',plan.name+': selector remoto '+cidr+' no pertenece a una subnet del dispositivo remoto.',true,id,'remote'));
  }
  const rawObj=obj(raw);
  if(clean(rawObj.psk||rawObj.preSharedKey||rawObj.password))issues.push(issue('NW-VPN-020',plan.name+': no almacenes una PSK real; usa secretAlias.',true,id));
  if(!safeAlias(plan.secretAlias))issues.push(issue('NW-VPN-021',plan.name+': secretAlias ausente o inválido.',true,id));
  if(plan.ikeVersion!=='2')issues.push(issue('NW-VPN-022',plan.name+': esta versión soporta únicamente IKEv2.',true,id));
  if(plan.encryption!=='aes256')issues.push(issue('NW-VPN-023',plan.name+': cifrado no soportado; usa aes256.',true,id));
  if(plan.integrity!=='sha256')issues.push(issue('NW-VPN-024',plan.name+': integridad no soportada; usa sha256.',true,id));
  if(plan.dhGroup!==14)issues.push(issue('NW-VPN-025',plan.name+': grupo DH no soportado; usa 14.',true,id));
  if(plan.pfsGroup!==14)issues.push(issue('NW-VPN-026',plan.name+': PFS no soportado; usa grupo 14.',true,id));
  if(!Number.isInteger(plan.ikeLifetimeSeconds)||plan.ikeLifetimeSeconds<300||plan.ikeLifetimeSeconds>86400)issues.push(issue('NW-VPN-027',plan.name+': lifetime IKE debe estar entre 300 y 86400 segundos.',true,id));
  if(!Number.isInteger(plan.ipsecLifetimeSeconds)||plan.ipsecLifetimeSeconds<300||plan.ipsecLifetimeSeconds>86400)issues.push(issue('NW-VPN-028',plan.name+': lifetime IPsec debe estar entre 300 y 86400 segundos.',true,id));
  if(!['primary','backup'].includes(plan.role))issues.push(issue('NW-VPN-033',plan.name+': role debe ser primary o backup.',true,id));
  if(!Number.isInteger(plan.priority)||plan.priority<1||plan.priority>65535)issues.push(issue('NW-VPN-034',plan.name+': priority debe ser un entero entre 1 y 65535.',true,id));

  const observed=plan.observed;
  if(Object.keys(observed).length){
    const status=clean(observed.status).toLowerCase();
    if(status&&!['up','down','unknown'].includes(status))issues.push(issue('NW-VPN-029',plan.name+': estado observado no reconocido.',false,id));
    if(observed.localEndpoint&&clean(observed.localEndpoint)!==plan.localEndpoint)issues.push(issue('NW-VPN-030',plan.name+': endpoint local observado difiere del To-Be.',false,id,'local'));
    if(observed.remoteEndpoint&&clean(observed.remoteEndpoint)!==plan.remoteEndpoint)issues.push(issue('NW-VPN-031',plan.name+': endpoint remoto observado difiere del To-Be.',false,id,'remote'));
  }
  return{plan,issues,ok:!issues.some(x=>x.blocking)};
}
function validateProject(project){
  const list=tunnels(project),issues=[],plans=[];
  const seen=new Set();
  list.forEach((raw,index)=>{
    const result=validateTunnel(project,raw,index);
    if(seen.has(result.plan.id))result.issues.push(issue('NW-VPN-032','VPN id duplicado: '+result.plan.id+'.',true,result.plan.id));
    seen.add(result.plan.id);plans.push(result.plan);issues.push(...result.issues);
  });
  return{
    version:'netwizard-site-to-site-vpn-v1',
    ok:!issues.some(x=>x.blocking),plans,issues,
    counts:{blocking:issues.filter(x=>x.blocking).length,warnings:issues.filter(x=>!x.blocking).length}
  };
}
function orient(plan,deviceId){
  if(plan.localDeviceId===deviceId)return Object.assign({},plan,{direction:'local'});
  if(plan.remoteDeviceId===deviceId)return{
    ...plan,direction:'remote',
    localDeviceId:plan.remoteDeviceId,remoteDeviceId:plan.localDeviceId,
    localCircuitRef:plan.remoteCircuitRef,remoteCircuitRef:plan.localCircuitRef,
    localEndpoint:plan.remoteEndpoint,remoteEndpoint:plan.localEndpoint,
    localWanPortId:plan.remoteWanPortId,remoteWanPortId:plan.localWanPortId,
    localWanPortName:plan.remoteWanPortName,remoteWanPortName:plan.localWanPortName,
    localPrefixes:plan.remotePrefixes.slice(),remotePrefixes:plan.localPrefixes.slice()
  };
  return null;
}
function buildDevicePlan(project,deviceId){
  const validation=validateProject(project),oriented=[];
  validation.plans.forEach((plan,index)=>{
    const side=orient(plan,deviceId);
    if(side)oriented.push(Object.assign({sequence:Number(plan.priority||((index+1)*10))},side));
  });
  oriented.sort((a,b)=>Number(a.priority||a.sequence||100)-Number(b.priority||b.sequence||100));
  const ids=new Set(oriented.map(x=>x.id));
  const issues=validation.issues.filter(x=>ids.has(x.tunnelId));
  return{version:'netwizard-site-to-site-vpn-device-plan-v1',deviceId,tunnels:oriented,issues,ok:!issues.some(x=>x.blocking)};
}
function selectorCovers(selectors,cidr){return arr(selectors).some(selector=>cidrContains(selector,cidr));}
function findOverlay(project,fromDeviceId,toDeviceId,sourceCidr,targetCidr){
  const validation=validateProject(project),matches=[];
  for(const plan of validation.plans){
    if(!plan.enabled)continue;
    const side=orient(plan,fromDeviceId);
    if(!side||side.remoteDeviceId!==toDeviceId)continue;
    if(!selectorCovers(side.localPrefixes,sourceCidr)||!selectorCovers(side.remotePrefixes,targetCidr))continue;
    const tunnelIssues=validation.issues.filter(x=>x.tunnelId===plan.id);
    const observed=observedFor(project,plan.id),status=clean(observed.status||'unknown').toLowerCase()||'unknown';
    const blocking=tunnelIssues.some(x=>x.blocking),available=!blocking&&status!=='down';
    matches.push({
      matched:true,available,plan:side,issues:tunnelIssues,observed,status,
      reason:blocking?tunnelIssues.filter(x=>x.blocking).map(x=>x.message).join(' '):
        status==='down'?'El túnel figura DOWN en estado observado.':
        status==='up'?'El túnel figura UP en estado observado.':'El túnel es válido en To-Be; no hay evidencia Observed UP.'
    });
  }
  matches.sort((a,b)=>Number(a.plan.priority||100)-Number(b.plan.priority||100)||
    (a.plan.role==='primary'?-1:1)-(b.plan.role==='primary'?-1:1));
  const available=matches.find(x=>x.available);
  if(available)return Object.assign({},available,{alternatives:matches});
  if(matches.length)return Object.assign({},matches[0],{available:false,alternatives:matches,reason:matches.map(x=>(x.plan.name||x.plan.id)+': '+x.reason).join(' | ')});
  return{matched:false,available:false,plan:null,issues:[],observed:{},status:'unknown',reason:'No existe VPN site-to-site que cubra ambos prefijos.',alternatives:[]};
}

const api={
  version:'netwizard-site-to-site-vpn-v1',
  tunnels,normalizeTunnel,validateTunnel,validateProject,buildDevicePlan,findOverlay,
  orient,selectorCovers,selectorOwnedByDevice,circuitEndpoint,observedFor,parseCidr,cidrContains,normalizeCidrs
};
root.NetWizardSiteToSiteVpn=api;
if(typeof module!=='undefined'&&module.exports)module.exports=api;
})(typeof window!=='undefined'?window:globalThis);
