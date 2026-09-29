'use strict';

const DeviceModel=require('../js/netwizard-device-model.js');

const VERSION='netwizard-private-vendor-capabilities-v1';

const DEFINITIONS=Object.freeze({
  cisco_ios:Object.freeze({mode:'cli',kinds:['router','switch'],extension:'cfg',certification:'dynamic'}),
  cisco_asa:Object.freeze({mode:'cli',kinds:['firewall'],extension:'cfg',certification:'review'}),
  juniper_junos:Object.freeze({mode:'cli',kinds:['router','switch'],extension:'set',certification:'review'}),
  huawei_vrp:Object.freeze({mode:'cli',kinds:['router','switch'],extension:'cfg',certification:'review'}),
  mikrotik_routeros:Object.freeze({mode:'cli',kinds:['router','switch'],extension:'rsc',certification:'review'}),
  fortinet:Object.freeze({mode:'cli',kinds:['firewall'],extension:'conf',certification:'review'}),
  aruba_aoss:Object.freeze({mode:'cli',kinds:['switch'],extension:'cfg',certification:'review'}),
  pfsense:Object.freeze({mode:'procedure',kinds:['firewall','router'],extension:'txt',certification:'procedure'}),
  ubiquiti_unifi:Object.freeze({mode:'procedure',kinds:['access_point','wlan_controller','switch'],extension:'txt',certification:'procedure'}),
  tplink_omada:Object.freeze({mode:'procedure',kinds:['access_point','wlan_controller','switch'],extension:'txt',certification:'procedure'}),
  galgus_cloud:Object.freeze({mode:'procedure',kinds:['access_point','wlan_controller'],extension:'txt',certification:'procedure'}),
  windows:Object.freeze({mode:'script',kinds:['server'],extension:'ps1',certification:'review'}),
  linux:Object.freeze({mode:'script',kinds:['server'],extension:'sh',certification:'review'})
});

function clean(v){return String(v==null?'':v).trim().toLowerCase();}
function kindOf(device){return DeviceModel.normalizeKind(device||{});}
function vendorOf(device){return DeviceModel.normalizeVendor(device&&device.vendorOs||'',clean(device&&device.vendorOs));}
function definition(vendor){return DEFINITIONS[clean(vendor)]||null;}
function capabilityFor(device){
  const vendor=vendorOf(device),kind=kindOf(device),def=definition(vendor);
  if(!def){
    return{vendor,kind,mode:'unsupported',supported:false,certification:'unsupported',reason:'Vendor/OS sin generador privado.'};
  }
  if(!def.kinds.includes(kind)){
    return{vendor,kind,mode:def.mode,supported:false,certification:'unsupported',reason:`El generador ${vendor} no cubre dispositivos de tipo ${kind}.`};
  }
  return{vendor,kind,mode:def.mode,supported:true,certification:def.certification,extension:def.extension};
}
function definitions(){
  return Object.fromEntries(Object.entries(DEFINITIONS).map(([k,v])=>[k,Object.assign({},v,{kinds:v.kinds.slice()})]));
}

module.exports={VERSION,DEFINITIONS,definition,capabilityFor,definitions};
