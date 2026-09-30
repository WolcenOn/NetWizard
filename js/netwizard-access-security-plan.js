/* =========================================================
   NetWizard Access Security Plan v0.1
   Modelo neutral para LACP, DHCP snooping, DAI y port-security.
   No genera CLI ni modifica el proyecto.
========================================================= */
(function initNetWizardAccessSecurityPlan(root){
  'use strict';

  function arr(v){ return Array.isArray(v) ? v : []; }
  function obj(v){ return v && typeof v === 'object' && !Array.isArray(v) ? v : {}; }
  function clean(v){ return String(v == null ? '' : v).trim(); }
  function yes(v){ return v === true || ['yes','true','enabled','on'].includes(clean(v).toLowerCase()); }
  function hasOwn(value,key){ return !!value && Object.prototype.hasOwnProperty.call(value,key); }
  function isSwitch(d){ return /switch/i.test(clean(d && (d.kind||d.type))); }
  function vlanId(project, ref){ const v=arr(project && project.vlans).find(x=>x.id===ref); return v && Number(v.vlanId) || null; }

  function securityDefaults(project){
    const s=obj(project && project.accessSecurity),legacy=obj(project && project.security);
    const inherited=(key,legacyKey,fallback)=>{
      if(hasOwn(s,key))return s[key]!==false;
      if(hasOwn(legacy,legacyKey))return yes(legacy[legacyKey]);
      return fallback;
    };
    let protectedVlanIds=arr(s.protectedVlanIds).map(Number).filter(Number.isFinite);
    if(!protectedVlanIds.length&&clean(legacy.dsV)){
      protectedVlanIds=clean(legacy.dsV).split(',').map(v=>Number(v.trim())).filter(Number.isFinite);
    }
    return {
      dhcpSnooping:inherited('dhcpSnooping','ds',true),
      arpInspection:inherited('arpInspection','dai',true),
      portSecurity:inherited('portSecurity','ps',true),
      bpduGuard:inherited('bpduGuard','bpdu',true),
      portFast:inherited('portFast','bpdu',true),
      ipSourceGuard:inherited('ipSourceGuard','ipsg',false),
      protectedVlanIds:[...new Set(protectedVlanIds)].sort((a,b)=>a-b),
      quarantineVlanRef:clean(s.quarantineVlanRef||legacy.qV),
      maxMac:Number(s.maxMac || 2),
      violation:clean(s.violation || 'restrict').toLowerCase(),
      sticky:s.sticky !== false,
      rateLimit:Number(s.dhcpRateLimit || 15)
    };
  }

  function aggregateGroups(project, deviceId){
    const groups=[];
    for(const raw of arr(project && project.linkAggregations)){
      const g=obj(raw);
      const members=arr(g.memberPortIds || g.members).map(clean).filter(Boolean);
      const ports=arr(project && project.ports).filter(p=>p.deviceId===deviceId && members.includes(p.id));
      if(!ports.length) continue;
      groups.push({
        id:clean(g.id || `lag-${groups.length+1}`),
        number:Number(g.number || g.channelId || groups.length+1),
        name:clean(g.name || `LAG${Number(g.number || g.channelId || groups.length+1)}`),
        protocol:clean(g.protocol || 'lacp').toLowerCase(),
        mode:clean(g.mode || 'active').toLowerCase(),
        memberPortIds:ports.map(p=>p.id),
        memberPortNames:ports.map(p=>clean(p.name || p.id)),
        trunk:g.trunk !== false,
        nativeVlan:Number(g.nativeVlan || 0) || null,
        allowedVlans:arr(g.allowedVlans).map(Number).filter(Boolean)
      });
    }
    return groups;
  }

  function buildDevicePlan(project, device){
    const defaults=securityDefaults(project);
    const connectedPortIds=new Set();
    for(const link of arr(project&&project.links)){if(link&&link.aPortId)connectedPortIds.add(link.aPortId);if(link&&link.bPortId)connectedPortIds.add(link.bPortId);}
    for(const host of arr(project&&project.hosts)){if(host&&host.portRef)connectedPortIds.add(host.portRef);}
    const ports=arr(project && project.ports).filter(p=>p.deviceId===device.id);
    const trusted=[];
    const access=[];
    for(const p of ports){
      const mode=clean(p.mode || p.role).toLowerCase();
      const uplink=yes(p.uplink) || /uplink|trunk|peer|core|distribution/i.test(clean(`${p.role} ${p.desc} ${p.name}`));
      const entry={
        portId:clean(p.id),
        name:clean(p.name || p.id),
        mode,
        vlanId:vlanId(project,p.accessVlanRef),
        trusted:uplink || yes(p.dhcpTrusted) || yes(p.securityTrusted),
        portSecurity:p.portSecurity === false ? false : defaults.portSecurity,
        maxMac:Number(p.maxMac || defaults.maxMac),
        sticky:p.sticky === false ? false : defaults.sticky,
        violation:clean(p.violation || defaults.violation),
        dhcpRateLimit:Number(p.dhcpRateLimit || defaults.rateLimit),
        portFast:p.portFast === false ? false : defaults.portFast,
        bpduGuard:p.bpduGuard === false ? false : defaults.bpduGuard,
        ipSourceGuard:p.ipSourceGuard === false ? false : defaults.ipSourceGuard,
        unused:!connectedPortIds.has(p.id)
      };
      if(entry.trusted) trusted.push(entry);
      else if(mode === 'access') access.push(entry);
    }
    const allVlans=arr(project && project.vlans).map(v=>Number(v.vlanId)).filter(Boolean).sort((a,b)=>a-b);
    const protectedVlans=defaults.protectedVlanIds.length
      ? defaults.protectedVlanIds.filter(id=>allVlans.includes(id))
      : allVlans;
    return {
      deviceId:device.id,
      deviceName:clean(device.name || device.id),
      vendorOs:clean(device.vendorOs),
      dhcpSnooping:defaults.dhcpSnooping,
      arpInspection:defaults.arpInspection,
      bpduGuard:defaults.bpduGuard,
      portFast:defaults.portFast,
      ipSourceGuard:defaults.ipSourceGuard,
      quarantineVlanRef:defaults.quarantineVlanRef,
      quarantineVlanId:vlanId(project,defaults.quarantineVlanRef),
      protectedVlans,
      trustedPorts:trusted,
      accessPorts:access,
      aggregates:aggregateGroups(project,device.id),
      warnings:[]
    };
  }

  function build(project){
    const p=project || {};
    const devices=arr(p.devices).filter(isSwitch).map(d=>buildDevicePlan(p,d));
    const warnings=[];
    for(const plan of devices){
      if(plan.dhcpSnooping && !plan.protectedVlans.length) warnings.push(`${plan.deviceName}: DHCP snooping habilitado sin VLANs.`);
      if(plan.arpInspection && !plan.dhcpSnooping) warnings.push(`${plan.deviceName}: DAI requiere una fuente fiable de bindings, normalmente DHCP snooping.`);
      if(plan.ipSourceGuard && !plan.dhcpSnooping) warnings.push(`${plan.deviceName}: IP Source Guard requiere bindings fiables, normalmente DHCP snooping.`);
      plan.warnings.push(...warnings.filter(x=>x.startsWith(plan.deviceName+':')).map(x=>x.slice(plan.deviceName.length+2)));
    }
    return {version:'netwizard-access-security-plan-v1',ok:devices.every(d=>!d.warnings.length),devices,warnings};
  }

  const api={version:'netwizard-access-security-plan-v1',build,buildDevicePlan,aggregateGroups,securityDefaults};
  root.NetWizardAccessSecurityPlan=api;
  if(typeof module!=='undefined'&&module.exports) module.exports=api;
})(typeof window!=='undefined'?window:globalThis);
