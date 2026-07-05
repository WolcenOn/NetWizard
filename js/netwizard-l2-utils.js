/* =========================================================
   NetWizard L2 Utils v3.27
   Auditoría avanzada de switching: trunks, VLAN nativa,
   PortFast/BPDU Guard, uplinks y continuidad VLAN-gateway.
   Cargable en navegador clásico y en Node.js.
========================================================= */

/*
Mantenimiento:
- La auditoría L2 trabaja con señales de diseño, no con estado real de switches.
- Mantener las reglas como warnings cuando dependan de supuestos físicos; usar error
  solo cuando el modelo demuestra una incompatibilidad clara.
- Las funciones portCarriesVlan() y auditGatewayContinuity() son críticas para producción.
*/
(function initNetWizardL2Utils(root){
  'use strict';

  function arr(v){ return Array.isArray(v) ? v : []; }
  function obj(v){ return v && typeof v === 'object' && !Array.isArray(v) ? v : {}; }
  function clean(v){ return String(v == null ? '' : v).trim(); }
  function lc(v){ return clean(v).toLowerCase(); }
  function num(v, fallback){ const n = Number(v); return Number.isFinite(n) ? n : fallback; }
  function tryRequire(p){ try { return require(p); } catch { return null; } }
  function auditCore(){ return root.NetWizardAudit || (typeof require === 'function' ? tryRequire('./netwizard-audit.js') : null); }
  const NWA = auditCore();

  function mk(code, severity, message, extra){
    const base = Object.assign({code, severity, category:'l2', message, source:'l2-audit'}, extra || {});
    return NWA && NWA.createIssue ? NWA.createIssue(base) : Object.assign(base, {blocking:severity === 'error'});
  }

  function vlanLabel(v){ return v ? `VLAN ${v.vlanId || v.id}${v.name ? ' · ' + v.name : ''}` : 'VLAN desconocida'; }
  function devLabel(d){ return d ? `${d.name || d.id || '?'}` : 'dispositivo desconocido'; }
  function portLabel(p, devicesById){ const d = devicesById.get(p && p.deviceId); return `${devLabel(d)}:${p && p.name || p && p.id || '?'}`; }
  function isSwitch(d){ return lc(d && d.type) === 'switch' || lc(d && d.type).includes('switch'); }
  function isL3Capable(d){ const t = lc(d && d.type); return t === 'router' || t === 'firewall' || t === 'l3switch' || t === 'l3_switch' || (t.includes('switch') && (d && (d.l3 === true || d.layer3 === true || d.routing === true || /l3|layer ?3|core/i.test(clean(d.role || d.model || d.notes))))); }
  function isAccess(p){ return lc(p && p.mode) === 'access'; }
  function isTrunk(p){ return lc(p && p.mode) === 'trunk'; }
  function isRouted(p){ return lc(p && p.mode) === 'routed' || clean(p && (p.l3Ip || p.routedIp)); }
  function isHostPort(p, hostsByPort){ return hostsByPort.has(p && p.id); }
  function isUplinkCandidate(p){ return p && (p.uplink === true || p.isUplink === true || /uplink|trunk|core|dist|router|firewall|wan/i.test(clean(p.desc || p.role || p.name))); }
  function allVlanIds(project){ return new Set(arr(project.vlans).map(v => num(v.vlanId, null)).filter(n => n != null)); }

  function allowedSet(port, project){
    if(!isTrunk(port)) return new Set();
    const all = allVlanIds(project);
    const raw = port.allowedVlans != null ? port.allowedVlans : port.allowed;
    if(raw == null || raw === '' || raw === 'all') return new Set(all);
    let list = [];
    if(Array.isArray(raw)) list = raw;
    else if(typeof raw === 'string'){
      raw.split(',').forEach(part => {
        const s = clean(part);
        if(!s) return;
        if(/^all$/i.test(s)){ list.push(...Array.from(all)); return; }
        const m = s.match(/^(\d+)\s*-\s*(\d+)$/);
        if(m){ const a = Number(m[1]), b = Number(m[2]); for(let i=Math.min(a,b); i<=Math.max(a,b); i++) list.push(i); }
        else list.push(Number(s));
      });
    }else list = [raw];
    return new Set(list.map(x => num(x, null)).filter(n => n != null && n >= 1 && n <= 4094));
  }

  function nativeVlanId(port, vlansById){
    if(!isTrunk(port)) return null;
    const ref = clean(port.nativeVlanRef || port.nativeVlan || '');
    if(!ref) return null;
    if(vlansById.has(ref)) return num(vlansById.get(ref).vlanId, null);
    const n = num(ref, null);
    return n != null ? n : null;
  }

  function accessVlanId(port, vlansById){
    const ref = clean(port && port.accessVlanRef || '');
    if(ref && vlansById.has(ref)) return num(vlansById.get(ref).vlanId, null);
    return num(ref, null);
  }

  function portCarriesVlan(port, vlan, project, vlansById){
    const vid = num(vlan && vlan.vlanId, null);
    if(vid == null || !port) return false;
    if(isAccess(port)) return accessVlanId(port, vlansById) === vid;
    if(isTrunk(port)) return allowedSet(port, project).has(vid) || nativeVlanId(port, vlansById) === vid;
    return false;
  }

  function collectMaps(project){
    const p = project || {};
    const devicesById = new Map(arr(p.devices).map(d => [d.id, d]));
    const portsById = new Map(arr(p.ports).map(pt => [pt.id, pt]));
    const vlansById = new Map(arr(p.vlans).map(v => [v.id, v]));
    const vlansByVid = new Map(arr(p.vlans).map(v => [num(v.vlanId, null), v]).filter(x => x[0] != null));
    const hostsByPort = new Map();
    arr(p.hosts).forEach(h => { if(h && h.portRef){ const list = hostsByPort.get(h.portRef) || []; list.push(h); hostsByPort.set(h.portRef, list); } });
    const portsByDev = new Map();
    arr(p.ports).forEach(pt => { const list = portsByDev.get(pt.deviceId) || []; list.push(pt); portsByDev.set(pt.deviceId, list); });
    return {devicesById, portsById, vlansById, vlansByVid, hostsByPort, portsByDev};
  }

  function findGatewayCandidates(project, vlan, maps){
    const vid = num(vlan && vlan.vlanId, null);
    const candidates = new Set();
    const gateway = arr(project.subnets).find(s => s && s.vlanRef === vlan.id && clean(s.gateway));
    if(!gateway) return candidates;
    for(const pt of arr(project.ports)){
      const d = maps.devicesById.get(pt.deviceId);
      if(!d) continue;
      if(!isL3Capable(d)) continue;
      if(isTrunk(pt) && portCarriesVlan(pt, vlan, project, maps.vlansById)) candidates.add(pt.id);
      if(isAccess(pt) && accessVlanId(pt, maps.vlansById) === vid && isL3Capable(d)) candidates.add(pt.id);
      if(isRouted(pt) && clean(pt.transitVlanRef || pt.routedVlanRef) === vlan.id) candidates.add(pt.id);
    }
    return candidates;
  }

  function deviceInternalPortsForVlan(device, vlan, project, maps){
    const pts = arr(maps.portsByDev.get(device && device.id));
    if(!device) return [];
    if(isSwitch(device)) return pts.filter(pt => portCarriesVlan(pt, vlan, project, maps.vlansById));
    if(isL3Capable(device)) return pts.filter(pt => portCarriesVlan(pt, vlan, project, maps.vlansById));
    return [];
  }

  function vlanReachablePorts(project, vlan, startPortIds, maps){
    const q = Array.from(startPortIds || []);
    const seen = new Set(q);
    const linkPairs = [];
    arr(project.links).forEach(l => { if(l && l.aPortId && l.bPortId) linkPairs.push([l.aPortId, l.bPortId]); });
    for(let qi=0; qi<q.length; qi++){
      const pid = q[qi];
      const p = maps.portsById.get(pid);
      if(!p) continue;
      const d = maps.devicesById.get(p.deviceId);
      for(const ip of deviceInternalPortsForVlan(d, vlan, project, maps)){
        if(!seen.has(ip.id)){ seen.add(ip.id); q.push(ip.id); }
      }
      for(const [a,b] of linkPairs){
        const other = a === pid ? b : b === pid ? a : null;
        if(!other || seen.has(other)) continue;
        const op = maps.portsById.get(other);
        if(op && portCarriesVlan(op, vlan, project, maps.vlansById)) { seen.add(other); q.push(other); }
      }
    }
    return seen;
  }

  function auditTrunkBasics(project, maps, issues){
    for(const p of arr(project.ports)){
      if(!isTrunk(p)) continue;
      const d = maps.devicesById.get(p.deviceId);
      const label = portLabel(p, maps.devicesById);
      const allowed = allowedSet(p, project);
      const all = allVlanIds(project);
      if(!allowed.size){ issues.push(mk('NW-L2-001','warning',`${label}: trunk sin VLANs permitidas. Si no es intencionado, no transportará ninguna VLAN.`)); }
      if(all.size && allowed.size === all.size){ issues.push(mk('NW-L2-002','warning',`${label}: trunk permite todas las VLANs del proyecto. Limita allowed VLANs a las necesarias.`)); }
      const native = nativeVlanId(p, maps.vlansById);
      if(native == null){ issues.push(mk('NW-L2-003','warning',`${label}: trunk sin VLAN nativa definida. Define una VLAN nativa no usada por usuarios si aplica.`)); }
      else if(native === 1){ issues.push(mk('NW-L2-004','warning',`${label}: usa VLAN 1 como nativa. En producción se recomienda una VLAN nativa dedicada/no usada.`)); }
      else if(allowed.size && !allowed.has(native)){ issues.push(mk('NW-L2-005','warning',`${label}: VLAN nativa ${native} no está incluida en allowed VLANs.`)); }
      if(isSwitch(d) && !isUplinkCandidate(p)) issues.push(mk('NW-L2-006','info',`${label}: puerto trunk sin marca/descripcion de uplink. Revisa si realmente debe ser trunk.`));
    }
  }

  function auditAccessProtection(project, maps, issues){
    for(const p of arr(project.ports)){
      if(!isAccess(p)) continue;
      const label = portLabel(p, maps.devicesById);
      const hasHost = isHostPort(p, maps.hostsByPort);
      const isUplink = isUplinkCandidate(p);
      if(isUplink){ issues.push(mk('NW-L2-010','warning',`${label}: parece uplink pero está en modo access. Revisa si debería ser trunk o routed.`)); continue; }
      if(hasHost){
        if(p.portfast === false || p.portFast === false) issues.push(mk('NW-L2-011','info',`${label}: puerto access con host sin PortFast. Se recomienda PortFast en puertos finales.`));
        if(p.bpduGuard === false || p.bpduguard === false) issues.push(mk('NW-L2-012','warning',`${label}: puerto access con host sin BPDU Guard. Se recomienda BPDU Guard para evitar loops por switches no autorizados.`));
      }
    }
  }

  function auditTrunkLinks(project, maps, issues){
    for(const l of arr(project.links)){
      const a = maps.portsById.get(l && l.aPortId), b = maps.portsById.get(l && l.bPortId);
      if(!a || !b) continue;
      const la = portLabel(a, maps.devicesById), lb = portLabel(b, maps.devicesById);
      if(isTrunk(a) && isTrunk(b)){
        const aa = allowedSet(a, project), bb = allowedSet(b, project);
        const common = Array.from(aa).filter(v => bb.has(v));
        if(!common.length) issues.push(mk('NW-L2-020','error',`${la} ↔ ${lb}: trunks sin VLANs permitidas en común.`));
        const na = nativeVlanId(a, maps.vlansById), nb = nativeVlanId(b, maps.vlansById);
        if(na != null && nb != null && na !== nb) issues.push(mk('NW-L2-021','error',`${la} ↔ ${lb}: mismatch de VLAN nativa (${na} vs ${nb}).`));
      }else if(isTrunk(a) !== isTrunk(b)){
        issues.push(mk('NW-L2-022','warning',`${la} ↔ ${lb}: trunk conectado a puerto no trunk. Revisa modo de ambos extremos.`));
      }
    }
  }

  function auditUplinks(project, maps, issues){
    for(const d of arr(project.devices)){
      if(!isSwitch(d)) continue;
      const pts = arr(maps.portsByDev.get(d.id));
      const linked = pts.filter(pt => arr(project.links).some(l => l.aPortId === pt.id || l.bPortId === pt.id));
      const uplinks = linked.filter(pt => isTrunk(pt) || isRouted(pt) || isUplinkCandidate(pt));
      const accessHosts = pts.some(pt => isAccess(pt) && maps.hostsByPort.has(pt.id));
      if(accessHosts && !uplinks.length) issues.push(mk('NW-L2-030','warning',`${devLabel(d)}: tiene hosts en access pero no se detecta uplink/trunk/routed enlazado.`));
    }
  }

  function auditVlanGatewayContinuity(project, maps, issues){
    for(const v of arr(project.vlans)){
      const vid = num(v.vlanId, null); if(vid == null) continue;
      const label = vlanLabel(v);
      const hasSubnetGw = arr(project.subnets).some(s => s && s.vlanRef === v.id && clean(s.gateway));
      const start = new Set();
      for(const h of arr(project.hosts)){
        if(h && h.vlanRef === v.id && h.portRef) start.add(h.portRef);
      }
      for(const pt of arr(project.ports)){
        if(isAccess(pt) && accessVlanId(pt, maps.vlansById) === vid && maps.hostsByPort.has(pt.id)) start.add(pt.id);
      }
      if(!start.size) continue;
      if(!hasSubnetGw){ issues.push(mk('NW-L2-040','warning',`${label}: tiene hosts/puertos access, pero no hay gateway en su subnet.`)); continue; }
      const candidates = findGatewayCandidates(project, v, maps);
      if(!candidates.size){ issues.push(mk('NW-L2-041','warning',`${label}: tiene gateway IP definido, pero no se detecta router/firewall/switch L3 que transporte esa VLAN.`)); continue; }
      const reached = vlanReachablePorts(project, v, start, maps);
      const ok = Array.from(candidates).some(pid => reached.has(pid));
      if(!ok){ issues.push(mk('NW-L2-042','error',`${label}: no se encuentra continuidad L2 desde hosts/access hasta un puerto gateway/trunk L3 para esa VLAN.`)); }
    }
  }

  function auditL2(project, options){
    const p = project || {};
    const maps = collectMaps(p);
    const issues = [];
    auditTrunkBasics(p, maps, issues);
    auditAccessProtection(p, maps, issues);
    auditTrunkLinks(p, maps, issues);
    auditUplinks(p, maps, issues);
    auditVlanGatewayContinuity(p, maps, issues);
    if(!issues.length) issues.push(mk('NW-L2-OK','info','Switching L2: sin riesgos evidentes con los datos actuales.'));
    const split = NWA ? NWA.splitIssues(issues) : {
      ok: !issues.some(i => i.severity === 'error'),
      errors: issues.filter(i=>i.severity==='error').map(i=>`[${i.code}] ${i.message}`),
      warnings: issues.filter(i=>i.severity==='warning').map(i=>`[${i.code}] ${i.message}`),
      info: issues.filter(i=>i.severity==='info').map(i=>`[${i.code}] ${i.message}`),
      issues
    };
    split.maps = maps;
    return split;
  }

  function summarizeL2Audit(audit){
    const a = audit || {errors:[],warnings:[],info:[]};
    const lines = ['Auditoría L2 avanzada'];
    if(arr(a.errors).length) lines.push('\nERRORES:\n' + arr(a.errors).map(x=>'• '+x).join('\n'));
    if(arr(a.warnings).length) lines.push('\nAVISOS:\n' + arr(a.warnings).map(x=>'• '+x).join('\n'));
    if(arr(a.info).length) lines.push('\nINFO:\n' + arr(a.info).map(x=>'• '+x).join('\n'));
    return lines.join('\n').trim();
  }


  function recommendPortL2(port, project){
    const p = port || {};
    const maps = collectMaps(project || {});
    const recs = [];
    if(isTrunk(p)){
      const allowed = allowedSet(p, project || {});
      const all = allVlanIds(project || {});
      if(all.size && (!allowed.size || allowed.size === all.size)) recs.push({field:'allowedVlans', severity:'warning', message:'Limita las VLANs permitidas del trunk a las realmente necesarias.'});
      const native = nativeVlanId(p, maps.vlansById);
      if(native == null) recs.push({field:'nativeVlanRef', severity:'warning', message:'Define una VLAN nativa explícita, preferiblemente no usada por usuarios.'});
      else if(native === 1) recs.push({field:'nativeVlanRef', severity:'warning', message:'Evita VLAN 1 como nativa en producción.'});
      if(p.uplink !== true && isUplinkCandidate(p)) recs.push({field:'uplink', severity:'info', message:'Marca este puerto como uplink para mejorar auditorías L2.'});
    }
    if(isAccess(p)){
      if(p.uplink === true) recs.push({field:'mode', severity:'warning', message:'Un puerto marcado como uplink normalmente no debería ser access.'});
      const hasHost = maps.hostsByPort.has(p.id);
      if(hasHost && p.portFast === false) recs.push({field:'portFast', severity:'info', message:'Activa PortFast en puertos finales con hosts.'});
      if(hasHost && p.bpduGuard === false) recs.push({field:'bpduGuard', severity:'warning', message:'Activa BPDU Guard en puertos access con hosts.'});
    }
    return recs;
  }

  function summarizePortL2Recommendations(port, project){
    const recs = recommendPortL2(port, project);
    if(!recs.length) return 'Sin recomendaciones L2 específicas para este puerto.';
    return recs.map(r => `• ${r.severity.toUpperCase()} · ${r.message}`).join('\n');
  }

  function projectSnapshot(){
    if(root.NetWizardState && root.NetWizardState.getSnapshot) return root.NetWizardState.getSnapshot();
    return root.S || {};
  }

  function bindBrowserUi(){
    if(!root.document) return;
    const doc = root.document;
    const $ = id => doc.getElementById(id);
    function ensure(){
      const pg = $('pg-dash');
      if(!pg || $('nwL2AuditCard')) return;
      const card = doc.createElement('div');
      card.className = 'card';
      card.id = 'nwL2AuditCard';
      const staticHtml = '<div class="card-h"><div class="card-t">🔀 Auditoría L2 avanzada</div><span class="b bac">v3.27</span></div><div class="co co-ac">Revisa trunks, VLAN nativa, allowed VLANs, PortFast/BPDU Guard, uplinks y continuidad de VLANs hacia su gateway. La edición completa está en Puertos & Interfaces.</div><div class="brow"><button class="btn bs" id="btnL2Audit">Auditar L2</button></div><pre class="cfg" id="nwL2AuditOut" style="min-height:120px;white-space:pre-wrap;"></pre>'; card.appendChild(doc.createRange().createContextualFragment(staticHtml));
      pg.appendChild(card);
      $('btnL2Audit').onclick = function(){ $('nwL2AuditOut').textContent = summarizeL2Audit(auditL2(projectSnapshot())); };
    }
    if(doc.readyState === 'loading') doc.addEventListener('DOMContentLoaded', ensure);
    else setTimeout(ensure, 0);
  }

  const api = {version:'netwizard-l2-utils-v3.27', auditL2, summarizeL2Audit, allowedSet, nativeVlanId, portCarriesVlan, recommendPortL2, summarizePortL2Recommendations};
  root.NetWizardL2Utils = api;
  if(typeof module !== 'undefined' && module.exports) module.exports = api;
  bindBrowserUi();
})(typeof window !== 'undefined' ? window : globalThis);
