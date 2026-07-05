/* =========================================================
   NetWizard DHCP Utils v3.15
   Pools DHCP avanzados, rangos, exclusiones, reservas y validación.
   Cargable tanto en navegador clásico como en Node.js.
========================================================= */

/*
Mantenimiento:
- proposeDhcpForProject() propone rangos conservadores: no debe pisar gateway ni IPs estáticas.
- validateDhcpForProject() debe ejecutarse antes de exportar scopes en modo producción.
- Mantener compatibilidad con scopes legacy simples por VLAN.
*/
(function initNetWizardDhcpUtils(root){
  'use strict';

  function clone(v){ return JSON.parse(JSON.stringify(v == null ? null : v)); }
  function arr(v){ return Array.isArray(v) ? v : []; }
  function obj(v){ return v && typeof v === 'object' && !Array.isArray(v) ? v : {}; }

  function nw(){
    return root.NetWizardNetworkUtils || (typeof require === 'function' ? tryRequire('./netwizard-network-utils.js') : null);
  }
  function tryRequire(p){ try { return require(p); } catch { return null; } }
  function cleanText(value, maxLen){
    const max = Number.isFinite(maxLen) ? maxLen : 240;
    return (value ?? '').toString().replace(/[\u0000-\u001F\u007F]/g, ' ').trim().slice(0, max);
  }
  function cleanIp(value){ return cleanText(value, 80); }
  function ipToNum(ip){ const u=nw(); return u ? u.parseIp(ip) : null; }
  function ip4s(n){ const u=nw(); return u ? u.ip4s(n) : String(n); }
  function parseCidr(cidr){ const u=nw(); return u ? u.parseCidr(cidr) : null; }
  function within(n, ci){ return ci && Number.isFinite(n) && n >= ci.net && n <= ci.bc; }
  function usableWithin(n, ci){ return ci && Number.isFinite(n) && (ci.pfx >= 31 ? within(n, ci) : n > ci.net && n < ci.bc); }
  function rangeOverlaps(aStart, aEnd, bStart, bEnd){ return aStart <= bEnd && bStart <= aEnd; }

  function normalizeDhcpConfig(raw){
    const cfg = obj(raw);
    const dnsRaw = Array.isArray(cfg.dns) ? cfg.dns.join(',') : (cfg.dns || '');
    return {
      enabled: cfg.enabled === true || cfg.enabled === 'true' || cfg.enabled === '1' || cfg.enabled === 1,
      dns: cleanText(dnsRaw, 160) || '8.8.8.8',
      domain: cleanText(cfg.domain || '', 120),
      lease: Math.max(1, Math.min(365, parseInt(cfg.lease, 10) || 1)),
      start: cleanIp(cfg.start || cfg.poolStart || ''),
      end: cleanIp(cfg.end || cfg.poolEnd || ''),
      exclusions: arr(cfg.exclusions).map(x => ({
        start: cleanIp((x && (x.start || x.ip)) || ''),
        end: cleanIp((x && (x.end || x.start || x.ip)) || ''),
        reason: cleanText((x && x.reason) || '', 120)
      })).filter(x => x.start),
      reservations: arr(cfg.reservations).map(x => ({
        name: cleanText((x && x.name) || '', 80),
        ip: cleanIp((x && x.ip) || ''),
        mac: cleanText((x && x.mac) || '', 80),
        hostRef: cleanText((x && x.hostRef) || '', 120)
      })).filter(x => x.ip || x.mac || x.hostRef)
    };
  }

  function subnetForVlan(project, vlanRef){
    return arr((project||{}).subnets).find(s => s && s.vlanRef === vlanRef) || null;
  }

  function staticHosts(project, vlanRef){
    return arr((project||{}).hosts).filter(h => h && h.vlanRef === vlanRef && h.ipMode === 'static' && h.staticIp);
  }

  function proposePoolForSubnet(subnet, options){
    const ci = parseCidr(subnet && subnet.cidr);
    if(!ci || ci.pfx >= 31 || !ci.fh || !ci.lh) return null;
    const opts = options || {};
    const reserveStart = Math.max(0, parseInt(opts.reserveStart, 10) || 10);
    let start = ci.fh + reserveStart;
    if(start > ci.lh) start = ci.fh;
    const endReserve = Math.max(0, parseInt(opts.reserveEnd, 10) || 0);
    let end = ci.lh - endReserve;
    if(end < start) end = ci.lh;
    return { start: ip4s(start), end: ip4s(end), ci };
  }

  function buildExclusions(project, vlan, subnet, cfg){
    const out = [];
    const seen = new Set();
    function add(start, end, reason){
      if(!start) return;
      const s = cleanIp(start); const e = cleanIp(end || start);
      const key = `${s}-${e}`;
      if(seen.has(key)) return;
      seen.add(key); out.push({start:s, end:e, reason:cleanText(reason||'', 120)});
    }
    if(subnet && subnet.gateway) add(subnet.gateway, subnet.gateway, 'gateway');
    for(const h of staticHosts(project, vlan.id)) add(h.staticIp, h.staticIp, h.name ? `static:${h.name}` : 'static-host');
    for(const ex of arr((cfg||{}).exclusions)) add(ex.start || ex.ip, ex.end || ex.start || ex.ip, ex.reason || 'manual');
    return out;
  }

  function proposeDhcpForProject(project, options){
    const next = clone(project || {});
    next.dhcp = obj(next.dhcp);
    const changes = [];
    const opts = options || {};
    for(const vlan of arr(next.vlans)){
      const key = String(vlan.vlanId);
      const intent = obj(vlan.intent);
      const type = cleanText(intent.type || '', 40);
      const defaultDhcpByType = {users:true, iot:true, guests:true, voice:true, cameras:true, servers:false, management:false, dmz:false, transit:false};
      const hasDhcpFlag = Object.prototype.hasOwnProperty.call(intent, 'dhcp');
      const wantsDhcp = (hasDhcpFlag ? intent.dhcp === true : defaultDhcpByType[type] === true) || (!intent.type && obj(next.dhcp[key]).enabled === true);
      const shouldDisable = ['servers','management','dmz','transit'].includes(type) && intent.dhcp !== true;
      const before = normalizeDhcpConfig(next.dhcp[key] || {});
      const sn = subnetForVlan(next, vlan.id);
      const proposed = sn ? proposePoolForSubnet(sn, opts) : null;
      let after = { ...before };
      if(wantsDhcp){
        after.enabled = true;
        after.dns = after.dns || '8.8.8.8';
        after.lease = after.lease || (type === 'guests' ? 8 : 1);
        if(proposed && (!after.start || opts.overwrite)) after.start = proposed.start;
        if(proposed && (!after.end || opts.overwrite)) after.end = proposed.end;
        after.exclusions = buildExclusions(next, vlan, sn, after);
        changes.push(before.enabled ? `VLAN ${vlan.vlanId}: DHCP actualizado${proposed ? ` (${proposed.start} - ${proposed.end})` : ''}.` : `Activar DHCP en VLAN ${vlan.vlanId}${proposed ? ` (${proposed.start} - ${proposed.end})` : ''}.`);
      } else if(shouldDisable && before.enabled){
        after.enabled = false;
        changes.push(`VLAN ${vlan.vlanId}: DHCP desactivado por intención ${type}.`);
      } else if(before.enabled && proposed){
        if(!after.start || opts.overwrite) after.start = proposed.start;
        if(!after.end || opts.overwrite) after.end = proposed.end;
        after.exclusions = buildExclusions(next, vlan, sn, after);
        changes.push(`VLAN ${vlan.vlanId}: pool DHCP completado (${after.start} - ${after.end}).`);
      }
      next.dhcp[key] = after;
    }
    return { project: next, changes };
  }

  function validateDhcpForProject(project){
    const p = project || {};
    const issues = [];
    const vlansById = new Map(arr(p.vlans).map(v => [String(v.vlanId), v]));
    const hostStaticIps = new Map();
    for(const h of arr(p.hosts)){
      if(h && h.staticIp) hostStaticIps.set(h.staticIp, h);
    }
    for(const [key, rawCfg] of Object.entries(obj(p.dhcp))){
      const cfg = normalizeDhcpConfig(rawCfg);
      if(!cfg.enabled) continue;
      const vlan = vlansById.get(String(key));
      if(!vlan){ issues.push({code:'NW-DHCP-010', severity:'error', category:'dhcp', message:`Scope DHCP para VLAN ${key} sin VLAN existente.`, blocking:true}); continue; }
      const sn = subnetForVlan(p, vlan.id);
      const ci = parseCidr(sn && sn.cidr);
      if(!sn || !ci){ issues.push({code:'NW-DHCP-011', severity:'error', category:'dhcp', message:`VLAN ${vlan.vlanId}: DHCP activo sin subnet válida.`, blocking:true}); continue; }
      const start = ipToNum(cfg.start);
      const end = ipToNum(cfg.end);
      if(start === null || end === null){ issues.push({code:'NW-DHCP-012', severity:'error', category:'dhcp', message:`VLAN ${vlan.vlanId}: rango DHCP inválido o incompleto.`, blocking:true}); continue; }
      if(start > end){ issues.push({code:'NW-DHCP-013', severity:'error', category:'dhcp', message:`VLAN ${vlan.vlanId}: inicio del pool DHCP posterior al final.`, blocking:true}); }
      if(!usableWithin(start, ci) || !usableWithin(end, ci)){ issues.push({code:'NW-DHCP-014', severity:'error', category:'dhcp', message:`VLAN ${vlan.vlanId}: pool DHCP fuera de la subnet ${ci.cidr}.`, blocking:true}); }
      const gw = ipToNum(sn.gateway);
      if(gw !== null && rangeOverlaps(start, end, gw, gw)) issues.push({code:'NW-DHCP-015', severity:'error', category:'dhcp', message:`VLAN ${vlan.vlanId}: el pool DHCP incluye el gateway ${sn.gateway}.`, blocking:true});
      for(const h of staticHosts(p, vlan.id)){
        const hip = ipToNum(h.staticIp);
        if(hip !== null && rangeOverlaps(start, end, hip, hip)) issues.push({code:'NW-DHCP-016', severity:'warning', category:'dhcp', message:`VLAN ${vlan.vlanId}: el pool DHCP incluye IP estática ${h.staticIp} (${h.name || h.id}).`});
      }
      for(const ex of cfg.exclusions){
        const xs = ipToNum(ex.start); const xe = ipToNum(ex.end || ex.start);
        if(xs === null || xe === null || xs > xe) issues.push({code:'NW-DHCP-017', severity:'warning', category:'dhcp', message:`VLAN ${vlan.vlanId}: exclusión DHCP inválida ${ex.start}${ex.end?`-${ex.end}`:''}.`});
        else if(!within(xs, ci) || !within(xe, ci)) issues.push({code:'NW-DHCP-018', severity:'warning', category:'dhcp', message:`VLAN ${vlan.vlanId}: exclusión fuera de subnet ${ex.start}${ex.end?`-${ex.end}`:''}.`});
      }
      for(const r of cfg.reservations){
        const rip = ipToNum(r.ip);
        if(r.ip && (rip === null || !usableWithin(rip, ci))) issues.push({code:'NW-DHCP-019', severity:'warning', category:'dhcp', message:`VLAN ${vlan.vlanId}: reserva DHCP fuera de subnet (${r.ip}).`});
      }
    }
    return { ok: !issues.some(i => i.severity === 'error' || i.blocking), issues };
  }

  function excludedRangesForCisco(project, vlan, cfg){
    const sn = subnetForVlan(project, vlan.id);
    const ci = parseCidr(sn && sn.cidr);
    const ncfg = normalizeDhcpConfig(cfg);
    const out = [];
    function add(start, end){ if(start) out.push({start, end:end||start}); }
    for(const ex of buildExclusions(project, vlan, sn, ncfg)) add(ex.start, ex.end);
    const ps = ipToNum(ncfg.start), pe = ipToNum(ncfg.end);
    if(ci && ps !== null && pe !== null && ci.fh && ci.lh){
      if(ps > ci.fh) add(ip4s(ci.fh), ip4s(ps - 1));
      if(pe < ci.lh) add(ip4s(pe + 1), ip4s(ci.lh));
    }
    const seen = new Set();
    return out.filter(r => { const k=`${r.start}-${r.end}`; if(seen.has(k)) return false; seen.add(k); return true; });
  }

  function describeScope(project, vlan){
    const cfg = normalizeDhcpConfig(obj((project||{}).dhcp)[String(vlan.vlanId)] || {});
    const sn = subnetForVlan(project, vlan.id);
    return { vlanId:vlan.vlanId, vlanName:vlan.name, enabled:cfg.enabled, cidr:sn && sn.cidr, gateway:sn && sn.gateway, ...cfg };
  }

  const api = { version:'netwizard-dhcp-utils-v3.15', normalizeDhcpConfig, proposePoolForSubnet, proposeDhcpForProject, validateDhcpForProject, excludedRangesForCisco, describeScope };
  root.NetWizardDhcpUtils = api;
  if(typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
