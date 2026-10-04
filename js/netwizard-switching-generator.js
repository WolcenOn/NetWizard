/* =========================================================
   NetWizard Switching Generator v0.1
   Genera bloques L2 prudentes para switches multivendor.
========================================================= */
(function initNetWizardSwitchingGenerator(root){
  'use strict';
  function arr(v){ return Array.isArray(v)?v:[]; }
  function clean(v){ return String(v==null?'':v).trim(); }
  function token(v,fallback){ return (clean(v||fallback).replace(/[^A-Za-z0-9_.-]/g,'_')||fallback); }
  function device(project,id){ return arr(project&&project.devices).find(d=>d.id===id)||null; }
  function ports(project,id){ return arr(project&&project.ports).filter(p=>p.deviceId===id); }
  function vlan(project,ref){ return arr(project&&project.vlans).find(v=>v.id===ref)||null; }
  function vids(list){ return arr(list).map(Number).filter(Number.isFinite).sort((a,b)=>a-b); }
  function allowed(project,p){ const explicit=vids(p.allowedVlans); return explicit.length?explicit:arr(project&&project.vlans).map(v=>Number(v.vlanId)).filter(Number.isFinite).sort((a,b)=>a-b); }
  function accessVid(project,p){ const v=vlan(project,p.accessVlanRef); return v&&v.vlanId?Number(v.vlanId):Number(p.accessVlan||1); }
  function nativeVid(project,p){ const v=vlan(project,p.nativeVlanRef); return v&&v.vlanId?Number(v.vlanId):Number(p.nativeVlan||999); }
  function ipv4Mask(cidr){
    const m=clean(cidr).match(/\/(\d|[12]\d|3[0-2])$/);const pfx=m?Number(m[1]):24;
    const mask=pfx===0?0:(0xffffffff<<(32-pfx))>>>0;
    return [24,16,8,0].map(b=>(mask>>>b)&255).join('.');
  }
  function ip4num(value){
    const parts=clean(value).split('.').map(Number);
    if(parts.length!==4||parts.some(n=>!Number.isInteger(n)||n<0||n>255))return null;
    return (((parts[0]<<24)>>>0)+(parts[1]<<16)+(parts[2]<<8)+parts[3])>>>0;
  }
  function subnetContains(cidr,ip){
    const m=clean(cidr).match(/^(\d{1,3}(?:\.\d{1,3}){3})\/(\d|[12]\d|3[0-2])$/);
    if(!m)return false;
    const netIp=ip4num(m[1]),candidate=ip4num(ip);if(netIp==null||candidate==null)return false;
    const pfx=Number(m[2]),mask=pfx===0?0:(0xffffffff<<(32-pfx))>>>0;
    return (netIp&mask)===(candidate&mask);
  }
  function management(project,d){
    const ip=clean(d&&d.mgmtIp);if(!ip)return null;
    let v=arr(project&&project.vlans).find(x=>clean(x&&x.intent&&x.intent.type).toLowerCase()==='management')||null;
    let sn=v?arr(project&&project.subnets).find(x=>x&&x.vlanRef===v.id):null;
    if(!sn){
      sn=arr(project&&project.subnets).find(x=>x&&subnetContains(x.cidr,ip))||null;
      v=sn?vlan(project,sn.vlanRef):null;
    }
    if(!v||!sn||!clean(sn.cidr)||!clean(sn.gateway))return null;
    return{vlan:v,subnet:sn,ip};
  }
  function deviceModel(){ try{return root.NetWizardDeviceModel || (typeof require==='function'&&require('./netwizard-device-model.js'));}catch{return null;} }
  function isSwitch(d){ const model=deviceModel(); return !!d && (model ? model.isSwitching(d) : /switch/i.test(clean(d.kind||d.type))); }
  function isL3Switch(d){
    const type=clean(d&&(d.type||d.kind)).toLowerCase();
    return isSwitch(d)&&(['l3switch','switch_l3'].includes(type)||d.l3===true||d.layer3===true||d.routing===true||clean(d.l3Capable).toLowerCase()==='yes');
  }
  function subnetOwner(sn){ return clean(sn&&(sn.gatewayDeviceRef||sn.gatewayDeviceId||sn.ownerDeviceRef||sn.routingDeviceRef)); }
  function ownedGatewayVlans(project,d){
    return arr(project&&project.subnets).map(sn=>({subnet:sn,vlan:vlan(project,sn&&sn.vlanRef)}))
      .filter(x=>x.vlan&&subnetOwner(x.subnet)===d.id&&clean(x.subnet.gateway)&&clean(x.subnet.cidr)&&clean(x.vlan&&x.vlan.intent&&x.vlan.intent.type).toLowerCase()!=='transit')
      .sort((a,b)=>(a.vlan.vlanId||0)-(b.vlan.vlanId||0));
  }
  function ipv6ForVlan(project,ref){ return arr(project&&project.ipv6Networks).find(n=>n&&n.vlanRef===ref)||null; }
  function ipv6PrefixLength(prefix){ const m=clean(prefix).match(/\/(\d{1,3})$/),n=m?Number(m[1]):64; return Number.isInteger(n)&&n>=0&&n<=128?n:64; }
  function ciscoVtp(project,d){
    const raw=project&&project.vtp&&typeof project.vtp==='object'?project.vtp:{};
    const roles=raw.roles&&typeof raw.roles==='object'?raw.roles:{};
    const role=clean(roles[d.id]||'off').toLowerCase();
    const supported=['server','client','transparent'].includes(role)?role:'off';
    const version=['1','2','3'].includes(String(raw.version||''))?String(raw.version):'';
    return{role:supported,domain:clean(raw.domain),passwordRequired:!!clean(raw.password),version,pruning:raw.pruning==='yes'};
  }
  function cisco(project,d,options){
    const opts=options||{},l3=isL3Switch(d),owned=ownedGatewayVlans(project,d);
    const ipv4Acl=String(opts.ipv4Acl||'').trim(),ipv6Acl=String(opts.ipv6Acl||'').trim();
    const policyRefs=new Set(arr(opts.policyVlanRefs).filter(Boolean));
    const hasIpv6=owned.some(x=>{const n=ipv6ForVlan(project,x.vlan.id);return n&&clean(n.prefix)&&clean(n.gateway);});
    const L=['!','! NetWizard switching profesional','configure terminal',`hostname ${token(d.name,'switch')}`,'spanning-tree mode rapid-pvst','spanning-tree portfast default','spanning-tree bpduguard default','no ip http server','ip ssh version 2'];
    if(l3)L.push('ip routing');
    if(hasIpv6)L.push('ipv6 unicast-routing');
    const vtp=ciscoVtp(project,d);
    if(vtp.role!=='off'){
      L.push('!','! VTP — revisión obligatoria antes de producción');
      if(vtp.domain)L.push(`vtp domain ${token(vtp.domain,'VTP_DOMAIN')}`);
      if(vtp.passwordRequired)L.push('vtp password ${SECRET:VTP_PASSWORD}');
      L.push(`vtp mode ${vtp.role}`);
      if(vtp.version)L.push(`vtp version ${vtp.version}`);
      if(vtp.pruning)L.push('vtp pruning');
    }
    if(vtp.role!=='client'){
      arr(project.vlans).slice().sort((a,b)=>(a.vlanId||0)-(b.vlanId||0)).forEach(v=>L.push(`vlan ${v.vlanId}`,` name ${token(v.name,'VLAN'+v.vlanId)}`,' exit'));
    }
    if(ipv4Acl)L.push('',ipv4Acl);
    if(ipv6Acl)L.push('',ipv6Acl);
    const renderedSvis=new Set();
    if(l3){
      for(const item of owned){
        const v=item.vlan,sn=item.subnet,v6=ipv6ForVlan(project,v.id);
        L.push('!',`interface Vlan${v.vlanId}`,` description GW_${token(v.name,'VLAN'+v.vlanId)}`,` ip address ${clean(sn.gateway)} ${ipv4Mask(sn.cidr)}`);
        if(v6&&clean(v6.gateway)&&clean(v6.prefix))L.push(` ipv6 address ${clean(v6.gateway)}/${ipv6PrefixLength(v6.prefix)}`);
        if(policyRefs.has(v.id)&&ipv4Acl)L.push(' ip access-group FW_POLICY in');
        if(policyRefs.has(v.id)&&ipv6Acl&&v6)L.push(' ipv6 traffic-filter FW_POLICY_V6 in');
        L.push(' no shutdown',' exit');
        renderedSvis.add(v.id);
      }
    }
    const mgmt=management(project,d);
    if(mgmt){
      if(renderedSvis.has(mgmt.vlan.id)){
        const ownedItem=owned.find(x=>x.vlan.id===mgmt.vlan.id);
        if(ownedItem&&clean(ownedItem.subnet.gateway)!==mgmt.ip){
          L.push(`interface Vlan${mgmt.vlan.vlanId}`,` ip address ${mgmt.ip} ${ipv4Mask(mgmt.subnet.cidr)} secondary`,' exit');
        }
      }else{
        L.push('!','! Management SVI',`interface Vlan${mgmt.vlan.vlanId}`,` description Management_${token(mgmt.vlan.name,'MGMT')}`,` ip address ${mgmt.ip} ${ipv4Mask(mgmt.subnet.cidr)}`,' no shutdown',' exit');
      }
      if(!l3)L.push(`ip default-gateway ${clean(mgmt.subnet.gateway)}`);
    }
    ports(project,d.id).forEach(p=>{
      L.push(`interface ${clean(p.name||p.id)}`);
      if(p.desc)L.push(` description ${clean(p.desc)}`);
      if(p.mode==='trunk'){
        L.push(' switchport mode trunk',` switchport trunk native vlan ${nativeVid(project,p)}`,` switchport trunk allowed vlan ${allowed(project,p).join(',')}`,' spanning-tree guard root');
      }else if(p.mode==='access'){
        L.push(' switchport mode access',` switchport access vlan ${accessVid(project,p)}`,' spanning-tree portfast',' spanning-tree bpduguard enable',' storm-control broadcast level 1.00 0.50',' storm-control multicast level 1.00 0.50');
      }else if(p.mode==='routed'){
        if(!/^loopback/i.test(clean(p.name||p.id)))L.push(' no switchport');
        if(clean(p.l3Ip||p.routedIp)&&clean(p.l3Cidr||p.routedCidr))L.push(` ip address ${clean(p.l3Ip||p.routedIp)} ${ipv4Mask(p.l3Cidr||p.routedCidr)}`);
      }
      L.push(' no shutdown',' exit');
    });
    L.push('end','write memory','!');
    return L.join('\n')+'\n';
  }
  function junos(project,d){
    const L=['# NetWizard switching profesional',`set system host-name ${token(d.name,'switch')}`,'set protocols rstp interface all'];
    arr(project.vlans).forEach(v=>L.push(`set vlans ${token(v.name,'VLAN'+v.vlanId)} vlan-id ${v.vlanId}`));
    ports(project,d.id).forEach(p=>{ const n=clean(p.name||p.id); if(p.desc)L.push(`set interfaces ${n} description "${clean(p.desc).replace(/"/g,"'")}"`); if(p.mode==='trunk'){L.push(`set interfaces ${n} unit 0 family ethernet-switching interface-mode trunk`,`set interfaces ${n} unit 0 family ethernet-switching native-vlan-id ${nativeVid(project,p)}`); allowed(project,p).forEach(id=>L.push(`set interfaces ${n} unit 0 family ethernet-switching vlan members ${id}`));} else if(p.mode==='access'){L.push(`set interfaces ${n} unit 0 family ethernet-switching interface-mode access`,`set interfaces ${n} unit 0 family ethernet-switching vlan members ${accessVid(project,p)}`,`set protocols rstp interface ${n} edge`,`set ethernet-switching-options secure-access-port interface ${n} mac-limit 8`);} }); return L.join('\n')+'\n';
  }
  function huawei(project,d){
    const L=['# NetWizard switching profesional','system-view',`sysname ${token(d.name,'switch')}`,'stp enable','stp mode rstp']; const all=arr(project.vlans).map(v=>v.vlanId).filter(Boolean); if(all.length)L.push(`vlan batch ${all.join(' ')}`);
    ports(project,d.id).forEach(p=>{ const n=clean(p.name||p.id); L.push(`interface ${n}`); if(p.desc)L.push(` description ${clean(p.desc)}`); if(p.mode==='trunk'){L.push(' port link-type trunk',` port trunk pvid vlan ${nativeVid(project,p)}`,` port trunk allow-pass vlan ${allowed(project,p).join(' ')}`,' stp root-protection');} else if(p.mode==='access'){L.push(' port link-type access',` port default vlan ${accessVid(project,p)}`,' stp edged-port enable',' stp bpdu-protection',' storm-control broadcast min-rate 64 max-rate 128');} L.push(' undo shutdown','quit'); }); L.push('return','save'); return L.join('\n')+'\n';
  }
  function mikrotik(project,d){
    const bridge='bridge-lan'; const L=['# NetWizard switching profesional',`/system identity set name="${token(d.name,'switch')}"`,`/interface bridge add name=${bridge} vlan-filtering=yes protocol-mode=rstp`];
    ports(project,d.id).forEach(p=>{ const n=clean(p.name||p.id); if(p.mode==='access')L.push(`/interface bridge port add bridge=${bridge} interface=${n} pvid=${accessVid(project,p)} edge=yes bpdu-guard=yes broadcast-flood=no`); else if(p.mode==='trunk')L.push(`/interface bridge port add bridge=${bridge} interface=${n} frame-types=admit-only-vlan-tagged ingress-filtering=yes`); });
    arr(project.vlans).forEach(v=>{ const tagged=ports(project,d.id).filter(p=>p.mode==='trunk'&&allowed(project,p).includes(Number(v.vlanId))).map(p=>clean(p.name||p.id)); const untagged=ports(project,d.id).filter(p=>p.mode==='access'&&accessVid(project,p)===Number(v.vlanId)).map(p=>clean(p.name||p.id)); L.push(`/interface bridge vlan add bridge=${bridge} vlan-ids=${v.vlanId}${tagged.length?` tagged=${bridge},${tagged.join(',')}`:` tagged=${bridge}`}${untagged.length?` untagged=${untagged.join(',')}`:''}`); }); return L.join('\n')+'\n';
  }
  function aruba(project,d){
    const L=[`; NetWizard switching profesional`,`hostname "${clean(d.name||'switch')}"`,'spanning-tree','spanning-tree mode rapid-pvst']; arr(project.vlans).forEach(v=>L.push(`vlan ${v.vlanId}`,` name "${clean(v.name||'VLAN')}"`,' exit'));
    ports(project,d.id).forEach(p=>{ const n=clean(p.name||p.id); if(p.mode==='trunk')L.push(`interface ${n}`,` tagged vlan ${allowed(project,p).join(',')}`,` untagged vlan ${nativeVid(project,p)}`,' spanning-tree root-guard',' exit'); else if(p.mode==='access')L.push(`interface ${n}`,` untagged vlan ${accessVid(project,p)}`,' spanning-tree admin-edge-port',' spanning-tree bpdu-protection',' exit'); }); return L.join('\n')+'\n';
  }
  function render(project,deviceId,vendor,options){ const d=device(project,deviceId); if(!isSwitch(d))return ''; const v=clean(vendor||d.vendorOs); if(v==='cisco_ios')return cisco(project,d,options); if(v==='juniper_junos')return junos(project,d); if(v==='huawei_vrp')return huawei(project,d); if(v==='mikrotik_routeros')return mikrotik(project,d); if(v==='aruba_aoss')return aruba(project,d); return ''; }
  const api={version:'netwizard-switching-generator-v1',render,cisco,ciscoVtp,junos,huawei,mikrotik,aruba,isL3Switch,ownedGatewayVlans}; root.NetWizardSwitchingGenerator=api; if(typeof module!=='undefined'&&module.exports)module.exports=api;
})(typeof window!=='undefined'?window:globalThis);
