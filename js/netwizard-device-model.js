/* =========================================================
   NetWizard Device Model v3.50
   Vocabulario canónico de dispositivos, compatibilidad legacy y vendors.
   Cargable tanto en navegador clásico como en Node.js.
========================================================= */
(function initNetWizardDeviceModel(root){
  'use strict';

  const KINDS = Object.freeze([
    Object.freeze({id:'switch',label:'Switch',icon:'🔀',switching:true,edge:false}),
    Object.freeze({id:'router',label:'Router',icon:'🌐',switching:false,edge:true}),
    Object.freeze({id:'firewall',label:'Firewall',icon:'🛡',switching:false,edge:true}),
    Object.freeze({id:'access_point',label:'Punto de acceso',icon:'📡',switching:false,edge:false,wireless:true,uplink:true}),
    Object.freeze({id:'wlan_controller',label:'Controlador WLAN',icon:'📶',switching:false,edge:false,wireless:true,uplink:true}),
    Object.freeze({id:'server',label:'Servidor gestionado',icon:'🗄',switching:false,edge:false,endpoint:true,uplink:true}),
    Object.freeze({id:'appliance',label:'Appliance',icon:'🧩',switching:false,edge:false,uplink:true})
  ]);

  const VENDORS = Object.freeze([
    Object.freeze({id:'generic_network',l:'Genérico / por definir'}),
    Object.freeze({id:'cisco_ios',l:'Cisco IOS'}),
    Object.freeze({id:'cisco_asa',l:'Cisco ASA'}),
    Object.freeze({id:'fortinet',l:'Fortinet FortiGate'}),
    Object.freeze({id:'pfsense',l:'pfSense'}),
    Object.freeze({id:'mikrotik_routeros',l:'MikroTik RouterOS'}),
    Object.freeze({id:'huawei_vrp',l:'Huawei VRP'}),
    Object.freeze({id:'juniper_junos',l:'Juniper Junos'}),
    Object.freeze({id:'aruba_aoss',l:'Aruba AOS-Switch'}),
    Object.freeze({id:'ubiquiti_unifi',l:'Ubiquiti UniFi'}),
    Object.freeze({id:'tplink_omada',l:'TP-Link Omada'}),
    Object.freeze({id:'galgus_cloud',l:'Galgus Cloud'}),
    Object.freeze({id:'windows',l:'Windows Server'}),
    Object.freeze({id:'linux',l:'Linux'})
  ]);

  const VENDOR_ALIASES = Object.freeze({
    generic:'generic_network', generic_network:'generic_network',
    ios:'cisco_ios', iosxe:'cisco_ios', cisco_ios:'cisco_ios',
    asa:'cisco_asa', cisco_asa:'cisco_asa',
    fortigate:'fortinet', fortios:'fortinet', fortinet:'fortinet',
    pfsense:'pfsense', routeros:'mikrotik_routeros', mikrotik:'mikrotik_routeros', mikrotik_routeros:'mikrotik_routeros',
    vrp:'huawei_vrp', huawei:'huawei_vrp', huawei_vrp:'huawei_vrp',
    junos:'juniper_junos', juniper:'juniper_junos', juniper_junos:'juniper_junos',
    'aos-switch':'aruba_aoss', aruba:'aruba_aoss', aruba_aoss:'aruba_aoss',
    unifi:'ubiquiti_unifi', ubiquiti:'ubiquiti_unifi', ubiquiti_unifi:'ubiquiti_unifi',
    omada:'tplink_omada', 'tp-link_omada':'tplink_omada', tplink_omada:'tplink_omada',
    galgus:'galgus_cloud', galgus_cloud:'galgus_cloud',
    windows_server:'windows', windows:'windows', linux:'linux'
  });

  const byKind = new Map(KINDS.map(item => [item.id,item]));
  const kindIds = KINDS.map(item => item.id);

  function clean(value){ return String(value == null ? '' : value).trim().toLowerCase(); }

  function normalizeKind(value){
    const device=value && typeof value === 'object' ? value : null;
    const wifiRole=clean(device && (device.wifiRole || device.wirelessRole));
    // Las versiones anteriores modelaban AP/controladores como switches. El rol
    // inalámbrico explícito corrige también proyectos ya saneados con kind=switch.
    if(wifiRole==='ap' || wifiRole==='access_point') return 'access_point';
    if(wifiRole==='controller' || wifiRole==='wlan_controller') return 'wlan_controller';
    const explicit=clean(device ? device.kind : value);
    if(byKind.has(explicit)) return explicit;
    const legacy=clean(device ? device.type : value);
    if(byKind.has(legacy)) return legacy;
    if(legacy==='ap' || /access[ _-]?point/.test(legacy)) return 'access_point';
    if(/controller|wlc/.test(legacy)) return 'wlan_controller';
    if(/firewall|utm/.test(legacy)) return 'firewall';
    if(/router|gateway/.test(legacy)) return 'router';
    if(/switch/.test(legacy)) return 'switch';
    if(/server|servidor/.test(legacy)) return 'server';
    return 'appliance';
  }

  function normalizeVendor(value, fallback){
    const raw=clean(value);
    if(VENDOR_ALIASES[raw]) return VENDOR_ALIASES[raw];
    if(VENDORS.some(item => item.id===raw)) return raw;
    return fallback === undefined ? raw : fallback;
  }

  function definition(value){ return byKind.get(normalizeKind(value)) || byKind.get('appliance'); }
  function label(value){ return definition(value).label; }
  function icon(value){ return definition(value).icon; }
  function isSwitching(value){ return definition(value).switching === true; }
  function isEdgeCapable(value){ return definition(value).edge === true; }
  function isWireless(value){ return definition(value).wireless === true; }
  function isEndpointKind(value){ return definition(value).endpoint === true; }
  function usesUplinkPorts(value){ return definition(value).uplink === true; }
  function normalizeDevice(device){
    const out=Object.assign({},device || {});
    const kind=normalizeKind(out);
    out.kind=kind;
    // type se conserva durante 3.50 como espejo compatible para módulos y proyectos antiguos.
    out.type=kind;
    out.vendorOs=normalizeVendor(out.vendorOs || out.platform || out.os || 'generic_network');
    if(!isEdgeCapable(kind)){
      out.internetEdge='no';
      out.wanIf=null;
    }
    return out;
  }
  function kindOptions(){ return KINDS.map(item => ({value:item.id,label:`${item.icon} ${item.label}`})); }
  function vendors(){ return VENDORS.map(item => ({id:item.id,l:item.l})); }
  function hasVendor(value){ return VENDORS.some(item => item.id===normalizeVendor(value)); }

  const api=Object.freeze({
    version:'netwizard-device-model-v3.50',
    kinds:kindIds.slice(),
    definitions:KINDS,
    vendorDefinitions:VENDORS,
    normalizeKind,normalizeVendor,normalizeDevice,definition,label,icon,isSwitching,isEdgeCapable,isWireless,isEndpointKind,usesUplinkPorts,kindOptions,vendors,hasVendor
  });
  root.NetWizardDeviceModel=api;
  if(!Array.isArray(root.ALL_VENDORS)) root.ALL_VENDORS=vendors();
  if(typeof module !== 'undefined' && module.exports) module.exports=api;
})(typeof window !== 'undefined' ? window : globalThis);
