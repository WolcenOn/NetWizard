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

const CONTRACT_VERSION='netwizard-private-vendor-config-v1';
const PRIVATE_VENDORS=new Set([
  'cisco_ios','juniper_junos','huawei_vrp','mikrotik_routeros','fortinet','pfsense',
  'aruba_aoss','ubiquiti_unifi','tplink_omada','galgus_cloud'
]);
const LEGACY_CLIENT_FALLBACK_VENDORS=new Set(['cisco_asa','windows','linux']);
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
function extension(vendor){return EXTENSIONS[clean(vendor,80)]||'txt';}
function configPath(device,index){
  const vendor=clean(device&&device.vendorOs,80)||'generic';
  return 'configs/'+String(index+1).padStart(2,'0')+'-'+safeName(device&&device.name,'device')+'-'+safeName(device&&device.id,'id')+'-'+safeName(vendor,'vendor')+'.'+extension(vendor);
}
function unsupportedIssue(device){
  const vendor=clean(device&&device.vendorOs,80)||'generic_network';
  return {
    code:'NW-PRIVATE-CONFIG-001',severity:'warning',blocking:false,category:'private-vendor-generation',
    deviceId:clean(device&&device.id,256),vendor,
    message:(device&&device.name||device&&device.id||'device')+': vendor '+vendor+' todavía depende del generador legacy cliente.'
  };
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
    getFwAcl:()=> '',
    netUtils:require('../js/netwizard-network-utils.js')
  });
  pipeline.registerRenderer({
    id:'vendor.base',priority:100,
    supports(ctx){return PRIVATE_VENDORS.has(ctx.vendor);},
    render(ctx){return enhanced(ctx.deviceId,ctx.vendor||ctx.format);}
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
    supports(ctx){return PRIVATE_VENDORS.has(ctx.vendor);},
    apply(config,ctx){return Management.append(config,ctx.project,ctx.deviceId,ctx.vendor);}
  });
  pipeline.registerStage({
    id:'ha.services',order:400,
    supports(ctx){return PRIVATE_VENDORS.has(ctx.vendor);},
    apply(config,ctx){return Ha.append(config,ctx.project,ctx.deviceId,ctx.vendor);}
  });
  return pipeline;
}
function generateAll(project,legacyDesiredConfigs){
  const p=obj(project),pipeline=create(p),fallbacks=obj(legacyDesiredConfigs);
  const configs={},paths={},artifacts=[],issues=[],sources={};
  for(const [index,device] of arr(p.devices).entries()){
    const id=clean(device&&device.id,256),vendor=clean(device&&device.vendorOs,80);
    if(!id)continue;
    const path=configPath(device,index);
    paths[id]=path;
    if(PRIVATE_VENDORS.has(vendor)){
      const output=String(pipeline.generate(id,vendor)||'');
      if(!output.trim()||/todavía no implementado en Private Engine/i.test(output)){
        issues.push({code:'NW-PRIVATE-CONFIG-002',severity:'error',blocking:true,category:'private-vendor-generation',deviceId:id,vendor,message:(device.name||id)+': Private Engine no produjo una configuración utilizable.'});
        continue;
      }
      configs[id]=output;
      sources[id]='private';
      artifacts.push({path,content:output.endsWith('\n')?output:output+'\n',mime:'text/plain;charset=utf-8'});
      continue;
    }
    if(LEGACY_CLIENT_FALLBACK_VENDORS.has(vendor)&&typeof fallbacks[id]==='string'&&fallbacks[id].trim()){
      configs[id]=fallbacks[id];
      sources[id]='legacy-client-fallback';
      artifacts.push({path,content:fallbacks[id].endsWith('\n')?fallbacks[id]:fallbacks[id]+'\n',mime:'text/plain;charset=utf-8'});
      issues.push(unsupportedIssue(device));
      continue;
    }
    issues.push({code:'NW-PRIVATE-CONFIG-003',severity:'error',blocking:true,category:'private-vendor-generation',deviceId:id,vendor,message:(device.name||id)+': vendor '+(vendor||'sin asignar')+' no tiene generación privada ni fallback compatible.'});
  }
  return {
    contractVersion:CONTRACT_VERSION,
    ok:!issues.some(x=>x.blocking),
    configs,configPaths:paths,artifacts,issues,sources,
    pipeline:pipeline.inspect()
  };
}

module.exports={
  CONTRACT_VERSION,PRIVATE_VENDORS,LEGACY_CLIENT_FALLBACK_VENDORS,
  create,generateAll,configPath,extension
};
