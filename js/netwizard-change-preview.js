/* =========================================================
   NetWizard Change Preview Utils v3.19
   Diff/preview conservador para automatismos: VLSM, DHCP e IPs L3.
   Cargable tanto en navegador clásico como en Node.js.
========================================================= */

/*
Mantenimiento:
- Este módulo solo calcula diferencias; no debe escribir en localStorage ni modificar S.
- Sus resúmenes alimentan UI y tests, por lo que conviene mantener textos estables.
*/
(function initNetWizardChangePreview(root){
  'use strict';

  function clone(v){ return JSON.parse(JSON.stringify(v == null ? null : v)); }
  function arr(v){ return Array.isArray(v) ? v : []; }
  function obj(v){ return v && typeof v === 'object' && !Array.isArray(v) ? v : {}; }
  function tryRequire(p){ try { return require(p); } catch { return null; } }
  function planner(){ return root.NetWizardPlanner || (typeof require === 'function' ? tryRequire('./netwizard-vlsm-physical-planner.js') : null); }
  function dhcp(){ return root.NetWizardDhcpUtils || (typeof require === 'function' ? tryRequire('./netwizard-dhcp-utils.js') : null); }
  function clean(v){ return (v == null ? '' : String(v)).trim(); }
  function same(a,b){ return clean(a) === clean(b); }

  function pushChange(diff, type, scope, id, before, after, detail){
    diff[type].push({ scope, id: clean(id), before: before == null ? '' : before, after: after == null ? '' : after, detail: detail || '' });
  }

  function emptyDiff(kind){ return { kind, add:[], change:[], remove:[], keep:[], warnings:[] }; }

  function summarizeChange(c){
    const id = c.id ? ` ${c.id}` : '';
    const tail = c.detail ? ` · ${c.detail}` : '';
    if(c.before !== '' && c.after !== '' && c.before !== c.after) return `${c.scope}${id}: ${c.before} → ${c.after}${tail}`;
    if(c.after !== '') return `${c.scope}${id}: ${c.after}${tail}`;
    if(c.before !== '') return `${c.scope}${id}: ${c.before}${tail}`;
    return `${c.scope}${id}${tail}`;
  }

  function summarizeDiff(diff, title){
    const lines = [];
    lines.push(title || `Vista previa de cambios: ${diff.kind || 'general'}`);
    lines.push('');
    if(diff.warnings && diff.warnings.length){
      lines.push('Avisos:');
      diff.warnings.forEach(w => lines.push(`! ${w}`));
      lines.push('');
    }
    const groups = [
      ['add', '+ Añadir'],
      ['change', '~ Cambiar'],
      ['remove', '- Retirar'],
      ['keep', '= Sin cambios']
    ];
    let total = 0;
    for(const [key, label] of groups){
      const items = arr(diff[key]);
      total += key === 'keep' ? 0 : items.length;
      if(!items.length) continue;
      lines.push(`${label} (${items.length})`);
      items.slice(0, 80).forEach(c => lines.push(`${label[0]} ${summarizeChange(c)}`));
      if(items.length > 80) lines.push(`${label[0]} ... ${items.length - 80} cambios más`);
      lines.push('');
    }
    if(!total) lines.push('No se aplicarían cambios.');
    else lines.push(`Total de cambios aplicables: ${total}`);
    return lines.join('\n');
  }

  function subnetKey(s){ return s && (s.vlanRef || s.id || s.cidr || ''); }
  function mapBy(items, fn){ const m=new Map(); for(const item of arr(items)){ const k=fn(item); if(k) m.set(String(k), item); } return m; }

  function computeVlsmDiff(project, planResult, options){
    const diff = emptyDiff('vlsm');
    const p = clone(project || {});
    const pl = planner();
    if(!pl || !pl.applyVlsmPlan){ diff.warnings.push('Módulo VLSM no disponible.'); return diff; }
    if(!planResult || !planResult.ok){ diff.warnings.push((planResult && planResult.msg) || 'Plan VLSM inválido o no calculado.'); return diff; }
    const next = pl.applyVlsmPlan(p, planResult, options || {});

    const beforeSub = mapBy(p.subnets, subnetKey);
    const afterSub = mapBy(next.subnets, subnetKey);
    for(const [key, sn] of afterSub.entries()){
      const old = beforeSub.get(key);
      const label = vlanLabel(next, sn.vlanRef) || sn.vlanRef || key;
      if(!old){ pushChange(diff, 'add', 'Subnet', label, '', `${sn.cidr || '—'} GW ${sn.gateway || '—'}`); continue; }
      const before = `${old.cidr || '—'} GW ${old.gateway || '—'}`;
      const after = `${sn.cidr || '—'} GW ${sn.gateway || '—'}`;
      if(before !== after) pushChange(diff, 'change', 'Subnet', label, before, after);
      else pushChange(diff, 'keep', 'Subnet', label, before, after);
    }
    for(const [key, old] of beforeSub.entries()){
      if(!afterSub.has(key)) pushChange(diff, 'remove', 'Subnet', vlanLabel(p, old.vlanRef) || old.vlanRef || key, `${old.cidr || '—'} GW ${old.gateway || '—'}`, '');
    }

    const beforeHosts = mapBy(p.hosts, h => h && h.id);
    const afterHosts = mapBy(next.hosts, h => h && h.id);
    for(const [id, h] of afterHosts.entries()){
      const old = beforeHosts.get(id);
      if(!old) continue;
      const before = `${old.ipMode || ''} ${old.staticIp || ''}`.trim();
      const after = `${h.ipMode || ''} ${h.staticIp || ''}`.trim();
      if(before !== after) pushChange(diff, 'change', 'Host IP', h.name || id, before || '—', after || '—');
    }

    const beforePorts = mapBy(p.ports, x => x && x.id);
    const afterPorts = mapBy(next.ports, x => x && x.id);
    for(const [id, port] of afterPorts.entries()){
      const old = beforePorts.get(id);
      if(!old) continue;
      const before = `${old.l3Ip || old.routedIp || ''}${old.l3Cidr || old.routedCidr ? '/' + String(old.l3Cidr || old.routedCidr).split('/')[1] : ''}`;
      const after = `${port.l3Ip || port.routedIp || ''}${port.l3Cidr || port.routedCidr ? '/' + String(port.l3Cidr || port.routedCidr).split('/')[1] : ''}`;
      if(before !== after) pushChange(diff, 'change', 'Interfaz L3', portLabel(next, port), before || '—', after || '—');
    }
    return diff;
  }

  function computeTransitIpDiff(project, options){
    const diff = emptyDiff('transit-ip');
    const pl = planner();
    if(!pl || !pl.assignTransitInterfaceIps){ diff.warnings.push('Módulo de asignación L3 no disponible.'); return diff; }
    const p = clone(project || {});
    const res = pl.assignTransitInterfaceIps(p, options || {});
    if(res.warnings) diff.warnings.push(...res.warnings);
    const beforePorts = mapBy(p.ports, x => x && x.id);
    const afterPorts = mapBy((res.project || {}).ports, x => x && x.id);
    for(const [id, port] of afterPorts.entries()){
      const old = beforePorts.get(id);
      if(!old) continue;
      const before = `${old.l3Ip || old.routedIp || ''}${old.l3Cidr || old.routedCidr ? '/' + String(old.l3Cidr || old.routedCidr).split('/')[1] : ''}`;
      const after = `${port.l3Ip || port.routedIp || ''}${port.l3Cidr || port.routedCidr ? '/' + String(port.l3Cidr || port.routedCidr).split('/')[1] : ''}`;
      if(before !== after) pushChange(diff, before ? 'change' : 'add', 'Interfaz L3', portLabel(res.project, port), before || '—', after || '—');
    }
    return diff;
  }

  function computeDhcpDiff(project, options){
    const diff = emptyDiff('dhcp');
    const dh = dhcp();
    if(!dh || !dh.proposeDhcpForProject || !dh.normalizeDhcpConfig){ diff.warnings.push('Módulo DHCP no disponible.'); return diff; }
    const p = clone(project || {});
    const res = dh.proposeDhcpForProject(p, options || {});
    if(res.changes) diff.warnings.push(...res.changes.filter(x => /^No /.test(x)));
    const keys = new Set([...Object.keys(obj(p.dhcp)), ...Object.keys(obj((res.project || {}).dhcp))]);
    for(const key of Array.from(keys).sort((a,b)=>Number(a)-Number(b))){
      const beforeCfg = dh.normalizeDhcpConfig(obj(p.dhcp)[key] || {});
      const afterCfg = dh.normalizeDhcpConfig(obj((res.project || {}).dhcp)[key] || {});
      const before = dhcpSummary(beforeCfg);
      const after = dhcpSummary(afterCfg);
      const label = vlanLabelByNumber(res.project || p, key) || `VLAN ${key}`;
      if(before !== after){
        const type = beforeCfg.enabled || beforeCfg.start || beforeCfg.end ? 'change' : 'add';
        pushChange(diff, type, 'DHCP', label, before || '—', after || '—');
      } else if(afterCfg.enabled){
        pushChange(diff, 'keep', 'DHCP', label, after, after);
      }
    }
    return diff;
  }

  function dhcpSummary(cfg){
    if(!cfg || !cfg.enabled) return 'desactivado';
    const parts = [`activo ${cfg.start || '?'}-${cfg.end || '?'}`];
    if(cfg.dns) parts.push(`DNS ${cfg.dns}`);
    if(cfg.domain) parts.push(`dominio ${cfg.domain}`);
    if(cfg.lease) parts.push(`lease ${cfg.lease}d`);
    const ex = arr(cfg.exclusions).length;
    const rs = arr(cfg.reservations).length;
    if(ex) parts.push(`${ex} exclusiones`);
    if(rs) parts.push(`${rs} reservas`);
    return parts.join(' · ');
  }

  function vlanLabel(project, vlanRef){
    const v = arr((project||{}).vlans).find(x => x && x.id === vlanRef);
    return v ? `VLAN ${v.vlanId} ${v.name || ''}`.trim() : '';
  }
  function vlanLabelByNumber(project, vlanId){
    const v = arr((project||{}).vlans).find(x => x && String(x.vlanId) === String(vlanId));
    return v ? `VLAN ${v.vlanId} ${v.name || ''}`.trim() : '';
  }
  function portLabel(project, port){
    const d = arr((project||{}).devices).find(x => x && x.id === port.deviceId);
    return `${d ? d.name : port.deviceId || '?'} ${port.name || port.id || ''}`.trim();
  }

  const api = {
    version:'netwizard-change-preview-v3.19',
    computeVlsmDiff,
    computeTransitIpDiff,
    computeDhcpDiff,
    summarizeDiff,
    summarizeChangeDiff:summarizeDiff
  };
  root.NetWizardChangePreview = api;
  if(typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
