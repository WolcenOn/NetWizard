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
  function isSwitch(d){ return !!d && /switch/i.test(clean(d.type)); }
  function cisco(project,d){
    const L=['!','! NetWizard switching profesional','configure terminal',`hostname ${token(d.name,'switch')}`,'spanning-tree mode rapid-pvst','spanning-tree portfast default','spanning-tree bpduguard default','no ip http server','ip ssh version 2'];
    arr(project.vlans).slice().sort((a,b)=>(a.vlanId||0)-(b.vlanId||0)).forEach(v=>L.push(`vlan ${v.vlanId}`,` name ${token(v.name,'VLAN'+v.vlanId)}`,' exit'));
    ports(project,d.id).forEach(p=>{ L.push(`interface ${clean(p.name||p.id)}`); if(p.desc)L.push(` description ${clean(p.desc)}`); if(p.mode==='trunk'){L.push(' switchport mode trunk',` switchport trunk native vlan ${nativeVid(project,p)}`,` switchport trunk allowed vlan ${allowed(project,p).join(',')}`,' spanning-tree guard root');} else if(p.mode==='access'){L.push(' switchport mode access',` switchport access vlan ${accessVid(project,p)}`,' spanning-tree portfast',' spanning-tree bpduguard enable',' storm-control broadcast level 1.00 0.50',' storm-control multicast level 1.00 0.50');} L.push(' no shutdown',' exit'); });
    L.push('end','write memory','!'); return L.join('\n')+'\n';
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
  function render(project,deviceId,vendor){ const d=device(project,deviceId); if(!isSwitch(d))return ''; const v=clean(vendor||d.vendorOs); if(v==='cisco_ios')return cisco(project,d); if(v==='juniper_junos')return junos(project,d); if(v==='huawei_vrp')return huawei(project,d); if(v==='mikrotik_routeros')return mikrotik(project,d); if(v==='aruba_aoss')return aruba(project,d); return ''; }
  const api={version:'netwizard-switching-generator-v1',render,cisco,junos,huawei,mikrotik,aruba}; root.NetWizardSwitchingGenerator=api; if(typeof module!=='undefined'&&module.exports)module.exports=api;
})(typeof window!=='undefined'?window:globalThis);
