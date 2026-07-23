/* =========================================================
   NetWizard Access Security Generator v0.1
   Traduce el plan neutral de acceso a Cisco, Junos, Huawei,
   MikroTik y Aruba AOS-Switch.
========================================================= */
(function initNetWizardAccessSecurityGenerator(root){
  'use strict';
  function arr(v){ return Array.isArray(v)?v:[]; }
  function clean(v){ return String(v==null?'':v).trim(); }
  function tryRequire(p){ try{return require(p);}catch{return null;} }
  function planner(){ return root.NetWizardAccessSecurityPlan || (typeof require==='function'?tryRequire('./netwizard-access-security-plan.js'):null); }
  function devicePlan(project,id,supplied){ const p=supplied||(planner()&&planner().build?planner().build(project||{}):null); return p&&arr(p.devices).find(x=>x.deviceId===id)||null; }
  function vlans(plan){ return arr(plan&&plan.protectedVlans).join(','); }

  function cisco(plan){
    const L=['!','! LACP y seguridad de acceso generados desde plan neutral'];
    if(plan.dhcpSnooping&&plan.protectedVlans.length)L.push('ip dhcp snooping',`ip dhcp snooping vlan ${vlans(plan)}`,'no ip dhcp snooping information option');
    if(plan.arpInspection&&plan.protectedVlans.length)L.push(`ip arp inspection vlan ${vlans(plan)}`);
    for(const p of arr(plan.trustedPorts))L.push(`interface ${p.name}`,' ip dhcp snooping trust',' ip arp inspection trust',' exit');
    for(const p of arr(plan.accessPorts)){
      L.push(`interface ${p.name}`);
      if(plan.dhcpSnooping)L.push(` ip dhcp snooping limit rate ${p.dhcpRateLimit}`);
      if(p.portSecurity){L.push(' switchport port-security',` switchport port-security maximum ${p.maxMac}`,` switchport port-security violation ${p.violation}`);if(p.sticky)L.push(' switchport port-security mac-address sticky');}
      L.push(' exit');
    }
    for(const g of arr(plan.aggregates)){
      for(const name of g.memberPortNames)L.push(`interface ${name}`,` channel-group ${g.number} mode ${g.mode==='passive'?'passive':'active'}`,' exit');
      L.push(`interface Port-channel${g.number}`);
      if(g.trunk)L.push(' switchport mode trunk');
      if(g.nativeVlan)L.push(` switchport trunk native vlan ${g.nativeVlan}`);
      if(g.allowedVlans.length)L.push(` switchport trunk allowed vlan ${g.allowedVlans.join(',')}`);
      L.push(' exit');
    }
    return L.join('\n');
  }

  function junos(plan){
    const L=['# LACP y seguridad de acceso generados desde plan neutral'];
    for(const g of arr(plan.aggregates)){
      L.push(`set chassis aggregated-devices ethernet device-count ${Math.max(g.number,1)}`);
      for(const name of g.memberPortNames)L.push(`set interfaces ${name} ether-options 802.3ad ae${g.number}`);
      L.push(`set interfaces ae${g.number} aggregated-ether-options lacp ${g.mode==='passive'?'passive':'active'}`);
      if(g.trunk)L.push(`set interfaces ae${g.number} unit 0 family ethernet-switching interface-mode trunk`);
      for(const v of g.allowedVlans)L.push(`set interfaces ae${g.number} unit 0 family ethernet-switching vlan members VLAN${v}`);
    }
    if(plan.dhcpSnooping)L.push('set ethernet-switching-options secure-access-port dhcp-trusted server');
    for(const p of arr(plan.trustedPorts))L.push(`set ethernet-switching-options secure-access-port interface ${p.name} dhcp-trusted`);
    for(const p of arr(plan.accessPorts))if(p.portSecurity)L.push(`set ethernet-switching-options secure-access-port interface ${p.name} mac-limit ${p.maxMac} action drop`);
    L.push('# DAI y DHCP security varían entre EX classic y ELS; validar sintaxis según Junos/modelo.');
    return L.join('\n');
  }

  function huawei(plan){
    const L=['# LACP y seguridad de acceso generados desde plan neutral','system-view'];
    if(plan.dhcpSnooping)L.push('dhcp snooping enable');
    for(const p of arr(plan.trustedPorts))L.push(`interface ${p.name}`,' dhcp snooping trusted','quit');
    for(const p of arr(plan.accessPorts)){
      L.push(`interface ${p.name}`);
      if(p.portSecurity)L.push(' port-security enable',` port-security max-mac-num ${p.maxMac}`);
      L.push('quit');
    }
    for(const g of arr(plan.aggregates)){
      L.push(`interface Eth-Trunk${g.number}`,' mode lacp-static');
      if(g.trunk)L.push(' port link-type trunk');
      if(g.allowedVlans.length)L.push(` port trunk allow-pass vlan ${g.allowedVlans.join(' ')}`);
      L.push('quit');
      for(const name of g.memberPortNames)L.push(`interface ${name}`,` eth-trunk ${g.number}`,'quit');
    }
    if(plan.arpInspection)L.push('# Habilitar ARP anti-attack/DAI según versión VRP y tabla de bindings disponible.');
    return L.join('\n');
  }

  function mikrotik(plan){
    const L=['# LACP y seguridad de acceso generados desde plan neutral'];
    for(const g of arr(plan.aggregates))L.push(`/interface/bonding/add name=bond${g.number} mode=802.3ad slaves=${g.memberPortNames.join(',')} lacp-rate=1sec transmit-hash-policy=layer-2-and-3`);
    L.push('# RouterOS bridge ofrece DHCP snooping en versiones compatibles; validar hardware offload y versión antes de activar.');
    if(plan.dhcpSnooping)L.push('/interface/bridge/set [find name="bridge-lan"] dhcp-snooping=yes add-dhcp-option82=no');
    for(const p of arr(plan.trustedPorts))L.push(`/interface/bridge/port/set [find interface="${p.name}"] trusted=yes`);
    L.push('# Port-security MAC-limit no es equivalente directo; usar bridge host learning, ACL/switch rules o 802.1X según hardware.');
    return L.join('\n');
  }

  function aruba(plan){
    const L=['; LACP y seguridad de acceso generados desde plan neutral','configure terminal'];
    if(plan.dhcpSnooping&&plan.protectedVlans.length)L.push('dhcp-snooping',`dhcp-snooping vlan ${plan.protectedVlans.join(' ')}`);
    for(const p of arr(plan.trustedPorts))L.push(`interface ${p.name}`,' dhcp-snooping trust',' exit');
    for(const g of arr(plan.aggregates))L.push(`trunk ${g.memberPortNames.join(',')} trk${g.number} lacp`);
    for(const p of arr(plan.accessPorts))if(p.portSecurity)L.push(`port-security ${p.name} learn-mode limited-continuous address-limit ${p.maxMac} action send-disable`);
    if(plan.arpInspection)L.push('; Dynamic ARP protection depende de familia ArubaOS-Switch/Aruba CX; validar plataforma.');
    L.push('write memory');
    return L.join('\n');
  }

  function render(project,deviceId,vendor,supplied){
    const plan=devicePlan(project,deviceId,supplied); if(!plan)return '';
    const v=clean(vendor||plan.vendorOs);
    if(v==='cisco_ios')return cisco(plan);
    if(v==='juniper_junos')return junos(plan);
    if(v==='huawei_vrp')return huawei(plan);
    if(v==='mikrotik_routeros')return mikrotik(plan);
    if(v==='aruba_aoss')return aruba(plan);
    return '';
  }
  function appendToConfig(config,project,deviceId,vendor,supplied){
    const block=render(project,deviceId,vendor,supplied); if(!block)return String(config||'');
    const marker='LACP y seguridad de acceso generados desde plan neutral';
    const text=String(config||''); if(text.includes(marker))return text;
    return text.replace(/\s*$/,'')+'\n'+block+'\n';
  }
  const api={version:'netwizard-access-security-generator-v1',render,appendToConfig,cisco,junos,huawei,mikrotik,aruba};
  root.NetWizardAccessSecurityGenerator=api;
  if(typeof module!=='undefined'&&module.exports)module.exports=api;
})(typeof window!=='undefined'?window:globalThis);
