'use strict';

const {createPipeline}=require('../js/netwizard-config-pipeline.js');
const Vendor=require('../js/netwizard-vendor-config-generators.js');
const Switching=require('../js/netwizard-switching-generator.js');
const Firewall=require('../js/netwizard-firewall-edge-generator.js');
const CiscoRouting=require('../js/netwizard-cisco-routing-generator.js');
const MultiRouting=require('../js/netwizard-multivendor-routing-generator.js');
const Access=require('../js/netwizard-access-security-generator.js');
const Management=require('../js/netwizard-management-generator.js');
const Ha=require('../js/netwizard-ha-services-generator.js');
const Legacy=require('./legacy-vendor-generators.js');
const Policy=require('../js/netwizard-policy-utils.js');
const Network=require('../js/netwizard-network-utils.js');
const Capabilities=require('./vendor-config-capabilities.js');
const VtpVerification=require('../js/netwizard-vtp-production-verification.js');
const RoutingPlan=require('../js/netwizard-routing-plan.js');
const Ospf=require('../js/netwizard-ospf.js');
const SiteVpn=require('../js/netwizard-site-to-site-vpn.js');
const SiteVpnGenerator=require('./site-to-site-vpn-generator.js');
const WanResilience=require('../js/netwizard-wan-resilience.js');
const CiscoSegmentation=require('./cisco-vlan-segmentation.js');

const CONTRACT_VERSION='netwizard-private-vendor-config-v1';
const MODULAR_VENDORS=new Set([
  'cisco_ios','juniper_junos','huawei_vrp','mikrotik_routeros','fortinet','pfsense',
  'aruba_aoss','ubiquiti_unifi','tplink_omada','galgus_cloud'
]);
const PRIVATE_VENDORS=new Set([...MODULAR_VENDORS,'cisco_asa','windows','linux']);
const EXTENSIONS={
  cisco_ios:'cfg',cisco_asa:'cfg',juniper_junos:'set',huawei_vrp:'cfg',
  mikrotik_routeros:'rsc',fortinet:'conf',aruba_aoss:'cfg',pfsense:'php',
  ubiquiti_unifi:'txt',tplink_omada:'txt',galgus_cloud:'txt',windows:'ps1',linux:'sh'
};

function arr(v){return Array.isArray(v)?v:[];}
function obj(v){return v&&typeof v==='object'&&!Array.isArray(v)?v:{};}
function clean(v,max){return String(v==null?'':v).trim().slice(0,max||240);}
function safeName(v,fallback){
  const source=clean(v,120),ascii=source.normalize?source.normalize('NFD').replace(/[\u0300-\u036f]/g,''):source;
  return ascii.replace(/[^A-Za-z0-9_.-]+/g,'-').replace(/^[.-]+|[.-]+$/g,'').slice(0,100)||fallback||'device';
}
function isSwitch(device){return !!device&&/switch/i.test(clean(device.kind||device.type));}
function subnetOwnerId(subnet){
  return clean(subnet&&(subnet.gatewayDeviceRef||subnet.gatewayDeviceId||subnet.ownerDeviceRef||subnet.routingDeviceRef),256);
}
function policyRuleOwner(project,rule){
  const p=obj(project),r=obj(rule);
  let subnet=null;
  if(clean(r.vlanRef,256))subnet=arr(p.subnets).find(s=>s&&s.vlanRef===r.vlanRef)||null;
  if(!subnet&&clean(r.src,120))subnet=arr(p.subnets).find(s=>s&&clean(s.cidr,120)===clean(r.src,120))||null;
  const explicit=subnetOwnerId(subnet);
  if(explicit)return explicit;
  const legacyGw=clean(obj(p.roas).gwId,256);
  return subnet&&legacyGw?legacyGw:'';
}
function manualPolicyRulesForDevice(project,deviceId){
  return arr(project&&project.fwRules).filter(r=>r&&r.enabled!==false&&policyRuleOwner(project,r)===deviceId);
}
function unboundManualPolicyRules(project){
  return arr(project&&project.fwRules).filter(r=>r&&r.enabled!==false&&!policyRuleOwner(project,r));
}
function effectivePolicyRulesForDevice(project,deviceId){
  return Policy.mergeWithManualRules(project)
    .filter(r=>r&&r.enabled!==false&&policyRuleOwner(project,r)===deviceId);
}
function policyRuleVlanRef(project,rule){
  const p=obj(project),r=obj(rule);
  if(clean(r.vlanRef,256))return clean(r.vlanRef,256);
  const subnet=arr(p.subnets).find(s=>s&&clean(s.cidr,120)===clean(r.src,120));
  return clean(subnet&&subnet.vlanRef,256);
}
function canonicalWanContext(project,device){
  const p=obj(project),d=obj(device);
  const circuits=arr(p.wanCircuits).filter(x=>x&&x.enabled!==false&&x.deviceId===d.id);
  const primary=circuits.find(x=>clean(x.role,40).toLowerCase()==='primary')||circuits[0]||null;
  const port=primary?arr(p.ports).find(x=>x&&x.id===primary.portId&&x.deviceId===d.id):null;
  const haDevice=obj(obj(p.highAvailability).devices)[d.id]||{};
  const routes=arr(haDevice.defaultRoutes);
  const route=(primary&&routes.find(x=>x&&x.circuitRef===primary.id))||routes.slice().sort((a,b)=>(Number(a&&a.distance)||1)-(Number(b&&b.distance)||1))[0]||null;
  return{primary,port,route};
}
function formatWild(cidr){
  const parsed=Network.parseCidr(cidr);
  if(!parsed)return clean(cidr,120);
  return Network.ip4s(parsed.net)+' '+Network.ip4s((~parsed.mask)>>>0);
}
function maskForCidr(cidr){
  const parsed=Network.parseCidr(cidr);
  return parsed?Network.ip4s(parsed.mask):'255.255.255.0';
}
function interfaceBlock(text,name){
  const source=String(text||''),needle='interface '+clean(name,120),start=source.indexOf(needle);
  if(start<0)return'';
  const next=source.indexOf('\ninterface ',start+needle.length);
  return source.slice(start,next<0?source.length:next);
}
function ipv6NetworkForVlan(project,vlanRef){
  return arr(project&&project.ipv6Networks).find(n=>n&&n.vlanRef===vlanRef)||null;
}
function ipv6PrefixLength(prefix){
  const m=clean(prefix,160).match(/\/(\d{1,3})$/),n=m?Number(m[1]):64;
  return Number.isInteger(n)&&n>=0&&n<=128?n:64;
}
function ipv6Endpoint(project,value,vlanRef){
  const raw=clean(value,160);
  if(!raw||raw==='any'||raw==='0.0.0.0/0'||raw==='::/0')return'any';
  if(raw.includes(':'))return raw.includes('/')?raw:'host '+raw;
  let ref=clean(vlanRef,256);
  if(!ref){
    const subnet=arr(project&&project.subnets).find(s=>s&&clean(s.cidr,160)===raw);
    ref=clean(subnet&&subnet.vlanRef,256);
  }
  const network=ref?ipv6NetworkForVlan(project,ref):null;
  return network&&clean(network.prefix,160)?clean(network.prefix,160):null;
}
function canonicalWanBindings(project,device){
  const p=obj(project),d=obj(device),seen=new Set(),out=[];
  for(const circuit of arr(p.wanCircuits).filter(x=>x&&x.enabled!==false&&x.deviceId===d.id)){
    const port=arr(p.ports).find(x=>x&&x.id===circuit.portId&&x.deviceId===d.id);
    if(!port||seen.has(port.id))continue;
    seen.add(port.id);out.push({circuit,port});
  }
  return out;
}
function ownedIpv6Networks(project,deviceId){
  const p=obj(project),out=[];
  for(const network of arr(p.ipv6Networks)){
    const subnet=arr(p.subnets).find(s=>s&&s.vlanRef===network.vlanRef);
    if(subnet&&subnetOwnerId(subnet)===deviceId)out.push({network,subnet,vlan:arr(p.vlans).find(v=>v&&v.id===network.vlanRef)||null});
  }
  return out;
}
function splitPorts(value){return String(value||'any').split(',').map(x=>x.trim()).filter(Boolean);}
function finalizeCiscoIosConfig(config){
  const lines=String(config||'').replace(/\r/g,'').split('\n');
  const leading=[];
  let i=0;
  while(i<lines.length){
    const t=lines[i].trim();
    if(t==='configure terminal')break;
    if(t===''||t.startsWith('!')){leading.push(lines[i]);i++;continue;}
    break;
  }
  const body=[];
  for(;i<lines.length;i++){
    const line=lines[i],t=line.trim().toLowerCase();
    if(t==='configure terminal'||t==='end'||t==='write memory'||t==='copy running-config startup-config')continue;
    body.push(line);
  }
  while(body.length&&!body[body.length-1].trim())body.pop();
  const prefix=leading.length?leading:[];
  const out=[...prefix,'configure terminal',...body,'end','write memory','!'];
  return out.join('\n').replace(/\n{3,}/g,'\n\n')+'\n';
}
function finalizeCiscoAsaConfig(config){
  const lines=String(config||'').replace(/\r/g,'').split('\n'),body=[];
  for(const line of lines){
    const t=line.trim().toLowerCase();
    if(t==='configure terminal'||t==='conf t'||t==='end'||t==='write memory'||t==='copy running-config startup-config')continue;
    body.push(line);
  }
  while(body.length&&!body[body.length-1].trim())body.pop();
  return ['configure terminal',...body,'end','write memory','!'].join('\n').replace(/\n{3,}/g,'\n\n')+'\n';
}
function finalizeJunosConfig(config){
  const lines=String(config||'').replace(/\r/g,'').split('\n'),body=[];
  for(const line of lines){
    const t=line.trim().toLowerCase();
    if(t==='configure'||t==='commit'||t==='commit check'||t==='commit and-quit'||t==='exit')continue;
    body.push(line);
  }
  while(body.length&&!body[body.length-1].trim())body.pop();
  return ['configure',...body,'commit check','commit and-quit'].join('\n').replace(/\n{3,}/g,'\n\n')+'\n';
}
function finalizeHuaweiConfig(config){
  const lines=String(config||'').replace(/\r/g,'').split('\n'),body=[];
  for(const line of lines){
    const t=line.trim().toLowerCase();
    if(t==='system-view'||t==='return'||t==='save'||t==='save force')continue;
    body.push(line);
  }
  while(body.length&&!body[body.length-1].trim())body.pop();
  return ['system-view',...body,'return','save'].join('\n').replace(/\n{3,}/g,'\n\n')+'\n';
}
function finalizeArubaAosConfig(config){
  const lines=String(config||'').replace(/\r/g,'').split('\n'),body=[];
  for(const line of lines){
    const t=line.trim().toLowerCase();
    if(t==='configure terminal'||t==='write memory')continue;
    body.push(line);
  }
  while(body.length&&!body[body.length-1].trim())body.pop();
  return ['configure terminal',...body,'exit','write memory'].join('\n').replace(/\n{3,}/g,'\n\n')+'\n';
}
function finalizeVendorConfig(vendor,config){
  if(vendor==='cisco_ios')return finalizeCiscoIosConfig(config);
  if(vendor==='cisco_asa')return finalizeCiscoAsaConfig(config);
  if(vendor==='juniper_junos')return finalizeJunosConfig(config);
  if(vendor==='huawei_vrp')return finalizeHuaweiConfig(config);
  if(vendor==='aruba_aoss')return finalizeArubaAosConfig(config);
  return String(config||'');
}
function configReadiness(project,device,output){
  const p=obj(project),d=obj(device),vendor=clean(d.vendorOs,80),text=String(output||''),reasons=[];
  const capability=Capabilities.capabilityFor(d);
  if(!capability.supported){
    return{status:'review-required',reasons:[capability.reason||'Combinación vendor/tipo no soportada por el generador privado.']};
  }
  if(capability.mode==='procedure'){
    return{status:'procedure-only',reasons:['La plataforma se configura mediante controlador, GUI/API o procedimiento específico; el artefacto no es una CLI universal para pegar directamente.']};
  }
  if(capability.mode==='script'){
    return{status:'review-required',reasons:['El Private Engine genera un script por sistema operativo, pero necesita asociación inequívoca al host/dispositivo y revisión de interfaz/servicios antes de ejecución.']};
  }
  const vpnPlan=SiteVpn.buildDevicePlan(p,d.id);
  const vpnBlocking=arr(vpnPlan&&vpnPlan.issues).filter(issue=>issue&&issue.blocking).map(issue=>'VPN site-to-site: '+clean(issue.message,300));
  const resiliencePlan=WanResilience.validateDevice(p,d.id);
  const resilienceBlocking=arr(resiliencePlan&&resiliencePlan.issues).filter(issue=>issue&&issue.blocking).map(issue=>'Resiliencia WAN: '+clean(issue.message,300));
  if(vendor!=='cisco_ios'){
    const family=clean(d.model,120),vendorReasons=[`Se generó CLI vendor-specific y se normalizó su cierre, pero ${vendor} requiere certificar familia/modelo${family?' '+family:''} y versión antes de marcarlo apply-ready.`];
    if(arr(vpnPlan&&vpnPlan.tunnels).length&&!['fortinet'].includes(vendor))vendorReasons.push('La VPN site-to-site todavía no tiene generador privado para '+vendor+'.');
    vendorReasons.push(...vpnBlocking,...resilienceBlocking);
    return{status:'review-required',reasons:vendorReasons};
  }
  reasons.push(...vpnBlocking,...resilienceBlocking);
  if(vendor==='cisco_ios'&&!isSwitch(d)){
    const segmentation=CiscoSegmentation.validateDevice(p,d.id);
    for(const issue of arr(segmentation&&segmentation.issues).filter(x=>x&&x.blocking))reasons.push('Segmentación inter-VLAN: '+clean(issue.message,300));
  }
  if(/\$\{SECRET:[^}]+\}/.test(text))reasons.push('La configuración contiene alias de secretos que deben resolverse antes de aplicar.');
  if(isSwitch(d)){
    const vtpCheck=VtpVerification.evaluateDevice(p,d.id);
    if(vtpCheck&&!vtpCheck.ok)reasons.push(...arr(vtpCheck.reasons));
    if(clean(d.mgmtIp,80)){
      const mgmtVlan=arr(p.vlans).find(v=>clean(v&&v.intent&&v.intent.type,40).toLowerCase()==='management');
      const mgmtSubnet=mgmtVlan?arr(p.subnets).find(s=>s&&s.vlanRef===mgmtVlan.id):null;
      if(!mgmtVlan||!mgmtSubnet||!clean(mgmtSubnet.cidr,80)||!clean(mgmtSubnet.gateway,80)){
        reasons.push('El switch tiene mgmtIp pero no existe una VLAN/subnet de gestión canónica con gateway.');
      }else{
        const block=interfaceBlock(text,'Vlan'+mgmtVlan.vlanId);
        if(!block||!block.includes('ip address '+clean(d.mgmtIp,80)+' '+maskForCidr(mgmtSubnet.cidr))){
          reasons.push('El switch no configura su SVI de gestión con la mgmtIp declarada.');
        }
        if(!text.includes('ip default-gateway '+clean(mgmtSubnet.gateway,80))){
          reasons.push('El switch no configura el gateway de la red de gestión.');
        }
      }
    }
  }
  if(/gateway RoaS inferido automáticamente/i.test(text))reasons.push('La interfaz/gateway RoaS fue inferida; debe declararse explícitamente para una aplicación automática.');
  if(/NEXT_HOP|TODO|REVISAR|VALIDAR/i.test(text))reasons.push('La configuración contiene placeholders o instrucciones de revisión manual.');
  if(String(d.internetEdge||'').toLowerCase()==='yes'){
    const wan=canonicalWanContext(p,d),roas=obj(p.roas),bindings=canonicalWanBindings(p,d);
    const canonicalAddress=wan.port&&clean(wan.port.l3Ip||wan.port.routedIp,80)&&clean(wan.port.l3Cidr||wan.port.routedCidr,80);
    const legacyAddress=clean(roas.wanCidr,80);
    if(!canonicalAddress&&!legacyAddress)reasons.push('El equipo edge no tiene WAN CIDR explícita en su circuito/puerto canónico.');
    if(!(wan.route&&clean(wan.route.nextHop,80))&&!clean(roas.wanNh,80))reasons.push('El equipo edge no tiene next-hop WAN explícito en highAvailability.');
    for(const binding of bindings){
      const ifName=clean(binding.port&&binding.port.name,120),block=interfaceBlock(text,ifName);
      if(!block.includes('ip nat outside'))reasons.push('La WAN '+clean(binding.circuit&&binding.circuit.id,120)+' no está marcada como NAT outside.');
      if(!text.includes('ip nat inside source list 100 interface '+ifName+' overload'))reasons.push('La WAN '+clean(binding.circuit&&binding.circuit.id,120)+' no tiene NAT overload para failover.');
    }
  }
  if(!isSwitch(d)){
    const localPolicyRules=manualPolicyRulesForDevice(p,d.id),unboundPolicyRules=unboundManualPolicyRules(p);
    if(unboundPolicyRules.length)reasons.push('Existen políticas firewall con origen no resoluble a una VLAN/gateway concreto; revisar binding de ACL.');
    if(localPolicyRules.length&&!/ip access-group FW_POLICY in/i.test(text))reasons.push('Existen políticas firewall locales, pero no se generó una vinculación ACL inbound a las subinterfaces de origen.');
    const v6=ownedIpv6Networks(p,d.id);
    if(v6.length){
      if(!/^ipv6 unicast-routing$/m.test(text))reasons.push('El dispositivo tiene redes IPv6 canónicas pero no habilita ipv6 unicast-routing.');
      for(const item of v6){
        if(!item.vlan)continue;
        const block=interfaceBlock(text,(arr(p.ports).find(x=>x&&x.deviceId===d.id&&x.mode==='trunk'&&/lan|inside/i.test(clean(x.role||x.desc||x.name,120)))||{}).name+'.'+item.vlan.vlanId);
        const expected=clean(item.network.gateway,120)+'/'+ipv6PrefixLength(item.network.prefix);
        if(!block||!block.includes('ipv6 address '+expected))reasons.push('La VLAN '+item.vlan.vlanId+' no configura su gateway IPv6 '+expected+'.');
      }
      const ipv6Acl=firewallIpv6Acl(p,d.id);
      if(ipv6Acl.unsupported.length)reasons.push('Hay '+ipv6Acl.unsupported.length+' reglas IPv4 sin traducción inequívoca a la política IPv6.');
      if(effectivePolicyRulesForDevice(p,d.id).length){
        if(!/ipv6 access-list FW_POLICY_V6/m.test(text))reasons.push('Existe política inter-VLAN con IPv6, pero no se generó FW_POLICY_V6.');
        for(const ref of ipv6Acl.vlanRefs.filter(ref=>ipv6NetworkForVlan(p,ref))){
          const vlan=arr(p.vlans).find(v=>v&&v.id===ref);
          if(!vlan)continue;
          const trunk=arr(p.ports).find(x=>x&&x.deviceId===d.id&&x.mode==='trunk'&&/lan|inside/i.test(clean(x.role||x.desc||x.name,120)));
          const block=trunk?interfaceBlock(text,trunk.name+'.'+vlan.vlanId):'';
          if(!block.includes('ipv6 traffic-filter FW_POLICY_V6 in'))reasons.push('La VLAN '+vlan.vlanId+' no vincula la ACL IPv6 inbound.');
        }
      }
    }
  }
  if(!isSwitch(d)&&RoutingPlan.strategyFor(p)==='static'){
    const plan=RoutingPlan.build(p),devicePlan=arr(plan&&plan.devices).find(item=>item&&item.deviceId===d.id);
    for(const issue of arr(devicePlan&&devicePlan.staticRouteIssues))reasons.push('Routing estático: '+clean(issue&&issue.message,300));
  }
  if(!isSwitch(d)&&RoutingPlan.strategyFor(p)==='ospf'){
    const validation=Ospf.validateProject(p);
    for(const issue of arr(validation&&validation.issues).filter(item=>item&&item.deviceId===d.id)){
      reasons.push('OSPF: '+clean(issue.message,300));
    }
  }
  if((text.match(/^configure terminal$/gm)||[]).length!==1)reasons.push('La configuración no contiene exactamente una entrada a config mode.');
  if((text.match(/^end$/gm)||[]).length!==1)reasons.push('La configuración no contiene exactamente un cierre de config mode.');
  if((text.match(/^write memory$/gm)||[]).length!==1)reasons.push('La configuración no contiene exactamente un guardado final.');
  const endAt=text.lastIndexOf('\nend\n'),saveAt=text.lastIndexOf('\nwrite memory\n');
  if(endAt<0||saveAt<0||saveAt<endAt)reasons.push('El cierre/guardado de Cisco IOS no está en orden aplicable.');
  return{status:reasons.length?'review-required':'apply-ready',reasons};
}
function firewallAcl(project,deviceId){
  const p=obj(project);
  let rules=deviceId
    ?effectivePolicyRulesForDevice(p,deviceId)
    :Policy.mergeWithManualRules(p).filter(x=>x&&x.enabled!==false);
  rules=Policy.enrichPolicyRules(p,rules.sort((a,b)=>(a.prio||100)-(b.prio||100)));
  const matrixPolicies=deviceId?arr(CiscoSegmentation.sourcePolicies(p,deviceId)):[];
  if(!rules.length&&!matrixPolicies.length)return'';
  const lines=['!','! FW Policy ACL unified (intent/manual + vlanMatrix)','ip access-list extended FW_POLICY'];
  for(const policy of matrixPolicies){
    for(const dst of arr(policy.blocked)){
      lines.push(' deny ip '+policy.sourceNetwork+' '+policy.sourceWildcard+' '+dst.network+' '+dst.wildcard+' ! vlanMatrix '+policy.sourceVlanId+'->'+dst.vlanId);
    }
  }
  for(const rule of rules){
    const action=rule.action==='deny'?'deny':'permit';
    const proto=rule.proto==='any'?'ip':(rule.proto==='tcp_udp'?null:rule.proto);
    const src=rule.src==='any'?'any':String(rule.src||'').includes('/')?formatWild(rule.src):'host '+rule.src;
    const dst=rule.dst==='any'?'any':String(rule.dst||'').includes('/')?formatWild(rule.dst):'host '+rule.dst;
    const ports=(rule.port&&rule.port!=='any')?splitPorts(rule.port):[''];
    for(const portValue of ports){
      const port=portValue?' eq '+portValue:'';
      const label=clean(rule.name,80);
      if(proto)lines.push(' '+action+' '+proto+' '+src+' '+dst+port+(rule.action==='log'?' log':'')+' ! '+label);
      else{
        lines.push(' '+action+' tcp '+src+' '+dst+port+' ! '+label+' [TCP]');
        lines.push(' '+action+' udp '+src+' '+dst+port+' ! '+label+' [UDP]');
      }
    }
  }
  lines.push(' deny ip any any log ! Implicit deny');
  return lines.join('\n');
}
function firewallIpv6Acl(project,deviceId){
  const p=obj(project);
  if(!arr(p.ipv6Networks).length)return{text:'',unsupported:[],vlanRefs:[]};
  let rules=deviceId
    ?effectivePolicyRulesForDevice(p,deviceId)
    :Policy.mergeWithManualRules(p).filter(x=>x&&x.enabled!==false);
  rules=Policy.enrichPolicyRules(p,rules.sort((a,b)=>(a.prio||100)-(b.prio||100)));
  const matrixPolicies=deviceId?arr(CiscoSegmentation.sourcePolicies(p,deviceId)):[];
  if(!rules.length&&!matrixPolicies.length)return{text:'',unsupported:[],vlanRefs:[]};
  const lines=['!','! FW Policy ACL IPv6 unified (intent/manual + vlanMatrix)','ipv6 access-list FW_POLICY_V6'],unsupported=[],vlanRefs=new Set();
  for(const policy of matrixPolicies){
    const srcNet=ipv6NetworkForVlan(p,policy.sourceVlanRef);
    if(!srcNet||!clean(srcNet.prefix,160))continue;
    vlanRefs.add(policy.sourceVlanRef);
    for(const dstPolicy of arr(policy.blocked)){
      const dstNet=ipv6NetworkForVlan(p,dstPolicy.vlanRef);
      if(!dstNet||!clean(dstNet.prefix,160))continue;
      lines.push(' deny ipv6 '+clean(srcNet.prefix,160)+' '+clean(dstNet.prefix,160)+' ! vlanMatrix '+policy.sourceVlanId+'->'+dstPolicy.vlanId);
    }
  }
  for(const rule of rules){
    const sourceVlan=policyRuleVlanRef(p,rule);
    if(sourceVlan)vlanRefs.add(sourceVlan);
    const src=ipv6Endpoint(p,rule.src,sourceVlan);
    const dstSubnet=arr(p.subnets).find(s=>s&&clean(s.cidr,160)===clean(rule.dst,160));
    const dst=ipv6Endpoint(p,rule.dst,clean(dstSubnet&&dstSubnet.vlanRef,256));
    if(!src||!dst){
      unsupported.push({ruleId:clean(rule.id,120),name:clean(rule.name,120),src:clean(rule.src,160),dst:clean(rule.dst,160)});
      continue;
    }
    const action=rule.action==='deny'?'deny':'permit';
    const proto=rule.proto==='any'?'ipv6':(rule.proto==='tcp_udp'?null:rule.proto);
    const ports=(rule.port&&rule.port!=='any')?splitPorts(rule.port):[''];
    for(const portValue of ports){
      const port=portValue?' eq '+portValue:'',label=clean(rule.name,80),log=rule.action==='log'?' log':'';
      if(proto)lines.push(' '+action+' '+proto+' '+src+' '+dst+port+log+' ! '+label);
      else{
        lines.push(' '+action+' tcp '+src+' '+dst+port+' ! '+label+' [TCP]');
        lines.push(' '+action+' udp '+src+' '+dst+port+' ! '+label+' [UDP]');
      }
    }
  }
  lines.push(' deny ipv6 any any log ! Implicit deny');
  return{text:lines.join('\n'),unsupported,vlanRefs:Array.from(vlanRefs)};
}
function extension(vendor){
  const id=clean(vendor,80),cap=Capabilities.definition(id);
  return (cap&&cap.extension)||EXTENSIONS[id]||'txt';
}
function configPath(device,index){
  const vendor=clean(device&&device.vendorOs,80)||'generic';
  return 'configs/'+String(index+1).padStart(2,'0')+'-'+safeName(device&&device.name,'device')+'-'+safeName(device&&device.id,'id')+'-'+safeName(vendor,'vendor')+'.'+extension(vendor);
}
function create(project){
  const p=obj(project);
  const fallback=(deviceId,format)=>{
    const device=arr(p.devices).find(x=>x&&x.id===deviceId);
    const vendor=clean(format||(device&&device.vendorOs),80);
    return '! Vendor/OS todavía no implementado en Private Engine: '+vendor+'\n';
  };
  const pipeline=createPipeline({baseGenerator:fallback,getProject:()=>p});
  const enhanced=Vendor.createEnhancedGenConfig({
    originalGenConfig:fallback,
    getProject:()=>p,
    getFwAcl:(deviceId)=>{
      const ipv6=firewallIpv6Acl(p,deviceId);
      return{
        text:firewallAcl(p,deviceId),
        ipv6Text:ipv6.text,
        ipv6Unsupported:ipv6.unsupported,
        vlanRefs:[...new Set([
          ...effectivePolicyRulesForDevice(p,deviceId).map(rule=>policyRuleVlanRef(p,rule)).filter(Boolean),
          ...arr(CiscoSegmentation.sourcePolicies(p,deviceId)).map(x=>x.sourceVlanRef).filter(Boolean)
        ])]
      };
    },
    netUtils:Network
  });
  pipeline.registerRenderer({
    id:'vendor.base',priority:100,
    supports(ctx){return MODULAR_VENDORS.has(ctx.vendor);},
    render(ctx){return enhanced(ctx.deviceId,ctx.vendor||ctx.format);}
  });
  pipeline.registerRenderer({
    id:'legacy.private',priority:275,
    supports(ctx){return ['cisco_asa','windows','linux'].includes(ctx.vendor);},
    render(ctx){return Legacy.render(ctx.project,ctx.deviceId,ctx.vendor);}
  });
  pipeline.registerRenderer({
    id:'device.switching',priority:250,
    supports(ctx){return isSwitch(ctx.device)&&PRIVATE_VENDORS.has(ctx.vendor);},
    render(ctx){return Switching.render(ctx.project,ctx.deviceId,ctx.vendor);}
  });
  pipeline.registerRenderer({
    id:'edge.firewall',priority:300,
    supports(ctx){return ctx.vendor==='fortinet'||ctx.vendor==='pfsense';},
    render(ctx){return Firewall.render(ctx.project,ctx.deviceId,ctx.vendor);}
  });
  pipeline.registerStage({
    id:'routing.cisco',order:100,
    supports(ctx){return ctx.vendor==='cisco_ios'&&!isSwitch(ctx.device);},
    apply(config,ctx){return CiscoRouting.appendToConfig(config,ctx.project,ctx.deviceId);}
  });
  pipeline.registerStage({
    id:'routing.multivendor',order:110,
    supports(ctx){return ['juniper_junos','huawei_vrp','mikrotik_routeros'].includes(ctx.vendor)&&!isSwitch(ctx.device);},
    apply(config,ctx){return MultiRouting.appendToConfig(config,ctx.project,ctx.deviceId,ctx.vendor);}
  });
  pipeline.registerStage({
    id:'segmentation.cisco',order:130,
    supports(ctx){return ctx.vendor==='cisco_ios'&&!isSwitch(ctx.device);},
    apply(config,ctx){
      if(String(config||'').includes('FW Policy ACL unified (intent/manual + vlanMatrix)'))return config;
      return CiscoSegmentation.append(config,ctx.project,ctx.deviceId);
    }
  });
  pipeline.registerStage({
    id:'vpn.site-to-site',order:150,
    supports(ctx){return ['cisco_ios','fortinet'].includes(ctx.vendor)&&!isSwitch(ctx.device);},
    apply(config,ctx){return SiteVpnGenerator.append(config,ctx.project,ctx.deviceId,ctx.vendor);}
  });
  pipeline.registerStage({
    id:'security.access',order:200,
    supports(ctx){return isSwitch(ctx.device);},
    apply(config,ctx){return Access.appendToConfig(config,ctx.project,ctx.deviceId,ctx.vendor);}
  });
  pipeline.registerStage({
    id:'management.baseline',order:300,
    supports(ctx){return MODULAR_VENDORS.has(ctx.vendor);},
    apply(config,ctx){return Management.append(config,ctx.project,ctx.deviceId,ctx.vendor);}
  });
  pipeline.registerStage({
    id:'ha.services',order:400,
    supports(ctx){return MODULAR_VENDORS.has(ctx.vendor);},
    apply(config,ctx){return Ha.append(config,ctx.project,ctx.deviceId,ctx.vendor);}
  });
  return pipeline;
}
function generateAll(project){
  const p=obj(project),pipeline=create(p);
  const configs={},paths={},artifacts=[],issues=[],sources={},readiness={},capabilities={};
  for(const [index,device] of arr(p.devices).entries()){
    const id=clean(device&&device.id,256),vendor=clean(device&&device.vendorOs,80);
    if(!id)continue;
    const path=configPath(device,index);
    paths[id]=path;
    const capability=Capabilities.capabilityFor(device);
    capabilities[id]=capability;
    if(capability.supported&&PRIVATE_VENDORS.has(vendor)){
      let output=String(pipeline.generate(id,vendor)||'');
      output=finalizeVendorConfig(vendor,output);
      if(!output.trim()||/todavía no implementado en Private Engine/i.test(output)){
        issues.push({code:'NW-PRIVATE-CONFIG-002',severity:'error',blocking:true,category:'private-vendor-generation',deviceId:id,vendor,message:(device.name||id)+': Private Engine no produjo una configuración utilizable.'});
        continue;
      }
      configs[id]=output;
      sources[id]='private';
      readiness[id]=configReadiness(p,device,output);
      artifacts.push({path,content:output.endsWith('\n')?output:output+'\n',mime:'text/plain;charset=utf-8'});
      continue;
    }
    const code=Capabilities.definition(vendor)?'NW-PRIVATE-CONFIG-004':'NW-PRIVATE-CONFIG-003';
    issues.push({code,severity:'error',blocking:true,category:'private-vendor-generation',deviceId:id,vendor,message:(device.name||id)+': '+(capability.reason||('vendor '+(vendor||'sin asignar')+' no tiene generación privada.'))});
  }
  return {
    contractVersion:CONTRACT_VERSION,
    ok:!issues.some(x=>x.blocking),
    configs,configPaths:paths,artifacts,issues,sources,configReadiness:readiness,configCapabilities:capabilities,
    pipeline:pipeline.inspect()
  };
}

module.exports={
  CONTRACT_VERSION,MODULAR_VENDORS,PRIVATE_VENDORS,
  create,generateAll,configPath,extension,firewallAcl,firewallIpv6Acl,
  finalizeCiscoIosConfig,finalizeCiscoAsaConfig,finalizeJunosConfig,finalizeHuaweiConfig,finalizeArubaAosConfig,finalizeVendorConfig,
  configReadiness
};
