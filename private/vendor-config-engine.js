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
function formatWild(cidr){
  const parsed=Network.parseCidr(cidr);
  if(!parsed)return clean(cidr,120);
  return Network.ip4s(parsed.net)+' '+Network.ip4s((~parsed.mask)>>>0);
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
  if(vendor!=='cisco_ios'){
    const family=clean(d.model,120);
    return{status:'review-required',reasons:[`Se generó CLI vendor-specific y se normalizó su cierre, pero ${vendor} requiere certificar familia/modelo${family?' '+family:''} y versión antes de marcarlo apply-ready.`]};
  }
  if(/\$\{SECRET:[^}]+\}/.test(text))reasons.push('La configuración contiene alias de secretos que deben resolverse antes de aplicar.');
  if(/gateway RoaS inferido automáticamente/i.test(text))reasons.push('La interfaz/gateway RoaS fue inferida; debe declararse explícitamente para una aplicación automática.');
  if(/NEXT_HOP|TODO|REVISAR|VALIDAR/i.test(text))reasons.push('La configuración contiene placeholders o instrucciones de revisión manual.');
  if(String(d.internetEdge||'').toLowerCase()==='yes'){
    const roas=obj(p.roas);
    if(!clean(roas.wanCidr,80))reasons.push('El equipo edge no tiene WAN CIDR explícita.');
    if(!clean(roas.wanNh,80))reasons.push('El equipo edge no tiene next-hop WAN explícito.');
  }
  if(!isSwitch(d)&&arr(p.fwRules).some(rule=>rule&&rule.enabled!==false)){
    reasons.push('Existen políticas firewall, pero Cisco IOS router aún no tiene una vinculación inequívoca de cada ACL a interfaz/dirección; revisar antes de aplicar.');
  }
  if((text.match(/^configure terminal$/gm)||[]).length!==1)reasons.push('La configuración no contiene exactamente una entrada a config mode.');
  if((text.match(/^end$/gm)||[]).length!==1)reasons.push('La configuración no contiene exactamente un cierre de config mode.');
  if((text.match(/^write memory$/gm)||[]).length!==1)reasons.push('La configuración no contiene exactamente un guardado final.');
  const endAt=text.lastIndexOf('\nend\n'),saveAt=text.lastIndexOf('\nwrite memory\n');
  if(endAt<0||saveAt<0||saveAt<endAt)reasons.push('El cierre/guardado de Cisco IOS no está en orden aplicable.');
  return{status:reasons.length?'review-required':'apply-ready',reasons};
}
function firewallAcl(project){
  let rules=Policy.mergeWithManualRules(project).filter(x=>x&&x.enabled!==false).sort((a,b)=>(a.prio||100)-(b.prio||100));
  rules=Policy.enrichPolicyRules(project,rules);
  if(!rules.length)return'';
  const lines=['!','! FW Policy ACL','ip access-list extended FW_POLICY'];
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
function extension(vendor){return EXTENSIONS[clean(vendor,80)]||'txt';}
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
    getFwAcl:()=>firewallAcl(p),
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
  create,generateAll,configPath,extension,firewallAcl,
  finalizeCiscoIosConfig,finalizeCiscoAsaConfig,finalizeJunosConfig,finalizeHuaweiConfig,finalizeArubaAosConfig,finalizeVendorConfig,
  configReadiness
};
