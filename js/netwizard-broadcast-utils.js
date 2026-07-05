/* NetWizard Broadcast Domain Utils v3.24
   Auditoría prudente de dominios de broadcast/multicast/ARP por VLAN.
   No mide tráfico real: estima riesgo según tamaño, densidad, intención, IoT/cámaras/voz y trunks.
*/
(function(root){
  'use strict';

  const NWU = root.NetWizardNetworkUtils || (typeof require === 'function' ? require('./netwizard-network-utils.js') : {});
  const NWA = root.NetWizardAudit || (typeof require === 'function' ? require('./netwizard-audit.js') : null);
  const parseCidr = NWU.parseCidr;

  function arr(x){ return Array.isArray(x) ? x : []; }
  function clean(s){ return String(s == null ? '' : s).trim(); }
  function lower(s){ return clean(s).toLowerCase(); }
  function num(x){ const n = Number(x); return Number.isFinite(n) ? n : 0; }
  function isObj(x){ return x && typeof x === 'object' && !Array.isArray(x); }
  function vlanKey(v){ return v && (v.id || String(v.vlanId || '')); }
  function vlanLabel(v){ return v ? `VLAN ${v.vlanId || v.id || '?'}${v.name ? ' · '+v.name : ''}` : 'VLAN ?'; }
  function intentOf(v){ return isObj(v && v.intent) ? v.intent : {}; }
  function subnetFor(project, vlanRef){ return arr(project && project.subnets).find(s => s && s.vlanRef === vlanRef) || null; }

  function usableHostsFromCidr(cidr){
    const ci = parseCidr ? parseCidr(cidr) : null;
    if(!ci) return null;
    const prefix = Number(ci.prefix);
    if(prefix >= 32) return 1;
    if(prefix === 31) return 2;
    return Math.max(0, Math.pow(2, 32 - prefix) - 2);
  }

  function hostTypeWeight(type){
    const t = lower(type);
    if(/camera|camara|cctv|nvr/.test(t)) return 1.8;
    if(/iot|sensor|gateway|mqtt|zigbee|lora|ble|thread/.test(t)) return 1.5;
    if(/phone|voip|voz/.test(t)) return 1.3;
    if(/printer|impresora/.test(t)) return 1.2;
    return 1;
  }

  function collectVlanStats(project){
    const p = project || {};
    const vlans = arr(p.vlans);
    const stats = new Map();
    for(const v of vlans){
      const intent = intentOf(v);
      const sn = subnetFor(p, v.id);
      const usable = sn && sn.cidr ? usableHostsFromCidr(sn.cidr) : null;
      stats.set(v.id, {
        vlan:v,
        vlanRef:v.id,
        label:vlanLabel(v),
        subnet:sn,
        usableHosts:usable,
        hostCount:0,
        accessPorts:0,
        weightedEndpoints:0,
        expectedHosts:Math.max(0, num(intent.expectedHosts || intent.hosts || intent.capacityHosts)),
        growthHosts:Math.max(0, num(intent.growthHosts || intent.growth || intent.reserveHosts)),
        iotCount:0,
        cameraCount:0,
        voiceCount:0,
        trunkAppearances:0,
        allVlanTrunks:0,
        recommendations:[],
        riskScore:0,
        level:'info'
      });
    }
    function st(ref){ return stats.get(ref) || null; }

    for(const port of arr(p.ports)){
      if(port && port.mode === 'access' && port.vlanRef && st(port.vlanRef)){
        st(port.vlanRef).accessPorts += 1;
      }
      if(port && port.mode === 'trunk'){
        let allowed = [];
        if(Array.isArray(port.allowedVlans)) allowed = port.allowedVlans;
        else if(typeof port.allowed === 'string') allowed = port.allowed.split(/[ ,;]+/).filter(Boolean);
        else if(typeof port.allowedVlans === 'string') allowed = port.allowedVlans.split(/[ ,;]+/).filter(Boolean);
        if(!allowed.length || /all|todos|any/.test(lower(port.allowed || port.allowedVlans || ''))){
          for(const s of stats.values()){ s.allVlanTrunks += 1; s.trunkAppearances += 1; }
        } else {
          for(const token of allowed){
            const match = vlans.find(v => String(v.vlanId) === String(token) || v.id === token);
            if(match && st(match.id)) st(match.id).trunkAppearances += 1;
          }
        }
      }
    }

    for(const h of arr(p.hosts)){
      const s = st(h && h.vlanRef);
      if(!s) continue;
      s.hostCount += 1;
      s.weightedEndpoints += hostTypeWeight(h.type || h.role || h.name);
      const t = lower(`${h.type || ''} ${h.name || ''}`);
      if(/iot|sensor|zigbee|lora|ble|thread|mqtt/.test(t)) s.iotCount += 1;
      if(/camera|camara|cctv|nvr/.test(t)) s.cameraCount += 1;
      if(/phone|voip|voz/.test(t)) s.voiceCount += 1;
    }

    const iot = p.iot || {};
    for(const d of arr(iot.devices)){
      const ref = d.vlanRef || d.vlanId || d.networkVlanRef;
      const match = stats.get(ref) || vlans.find(v => String(v.vlanId) === String(ref));
      const s = match && stats.get(match.id || match);
      if(!s) continue;
      s.iotCount += 1; s.hostCount += 1; s.weightedEndpoints += 1.5;
    }

    for(const s of stats.values()){
      const intent = intentOf(s.vlan);
      const type = lower(intent.type || s.vlan.name || '');
      if(/iot/.test(type)) s.iotCount = Math.max(s.iotCount, s.hostCount || s.expectedHosts);
      if(/camera|camara|cctv/.test(type)) s.cameraCount = Math.max(s.cameraCount, s.hostCount || s.expectedHosts);
      if(/voice|voz/.test(type)) s.voiceCount = Math.max(s.voiceCount, s.hostCount || s.expectedHosts);
      const planned = Math.max(s.hostCount, s.accessPorts, s.expectedHosts + s.growthHosts);
      s.plannedEndpoints = planned;
      s.weightedEndpoints = Math.max(s.weightedEndpoints, planned);
    }
    return Array.from(stats.values());
  }

  function assessVlanRisk(stat, options){
    const opts = options || {};
    const s = Object.assign({}, stat);
    const rec = [];
    const issues = [];
    let score = 0;
    const mk = (code, severity, message) => NWA ? NWA.createIssue({code, severity, category:'broadcast', message, vlanRef:s.vlanRef, source:'broadcast'}) : {code,severity,category:'broadcast',message,blocking:severity==='error'};
    const endpoints = Math.max(s.plannedEndpoints || 0, s.hostCount || 0, s.accessPorts || 0);
    const usable = s.usableHosts;
    const label = s.label;
    const type = lower((s.vlan && s.vlan.intent && s.vlan.intent.type) || (s.vlan && s.vlan.name) || '');

    if(usable !== null){
      if(usable >= 1000){ score += 35; issues.push(mk('NW-BCAST-001','warning',`${label}: subred muy grande (${usable} hosts útiles). Riesgo de dominio broadcast amplio; considera segmentar o usar VLSM más ajustado.`)); }
      else if(usable >= 500){ score += 24; issues.push(mk('NW-BCAST-002','warning',`${label}: subred grande (${usable} hosts útiles). Revisa ARP/broadcast y segmentación.`)); }
      else if(usable >= 250){ score += 12; issues.push(mk('NW-BCAST-003','info',`${label}: subred mediana-grande (${usable} hosts útiles). Vigila crecimiento y tráfico broadcast.`)); }
    } else {
      score += 8; issues.push(mk('NW-BCAST-010','info',`${label}: sin subnet definida; no se puede estimar tamaño del dominio broadcast.`));
    }
    if(endpoints >= 250){ score += 35; issues.push(mk('NW-BCAST-004','warning',`${label}: ${endpoints} endpoints previstos/encontrados. Considera dividir por función, planta, SSID o zona.`)); }
    else if(endpoints >= 120){ score += 22; issues.push(mk('NW-BCAST-005','warning',`${label}: ${endpoints} endpoints previstos/encontrados. Puede generar bastante ARP/broadcast en horas punta.`)); }
    else if(endpoints >= 60){ score += 10; issues.push(mk('NW-BCAST-006','info',`${label}: ${endpoints} endpoints. Tamaño razonable, pero conviene vigilar crecimiento.`)); }

    if(s.iotCount >= 50){ score += 18; issues.push(mk('NW-BCAST-020','warning',`${label}: muchos dispositivos IoT (${s.iotCount}). Se recomienda VLAN IoT dedicada, mDNS/SSDP controlado y ACLs restrictivas.`)); }
    if(s.cameraCount >= 20){ score += 18; issues.push(mk('NW-BCAST-021','warning',`${label}: muchas cámaras (${s.cameraCount}). Se recomienda VLAN de cámaras dedicada y tráfico solo hacia NVR/gestión.`)); }
    if(s.voiceCount >= 30){ score += 10; issues.push(mk('NW-BCAST-022','info',`${label}: voz/telefonía numerosa (${s.voiceCount}). Revisa VLAN de voz, QoS y DHCP options.`)); }
    if((s.iotCount || s.cameraCount) && !/(iot|camera|camara|cctv|voice|voz)/.test(type)){
      score += 14; issues.push(mk('NW-BCAST-023','warning',`${label}: mezcla IoT/cámaras con una VLAN no especializada. Puede aumentar broadcast/multicast y superficie de ataque.`));
    }
    if(s.allVlanTrunks >= 2){ score += 14; issues.push(mk('NW-BCAST-030','warning',`${label}: aparece en ${s.allVlanTrunks} trunks que parecen transportar todas las VLANs. Limita VLANs permitidas en trunks para reducir propagación innecesaria.`)); }
    else if(s.trunkAppearances >= 4){ score += 8; issues.push(mk('NW-BCAST-031','info',`${label}: presente en ${s.trunkAppearances} trunks. Revisa si todos son necesarios.`)); }

    if(score >= 70){ s.level = 'alto'; rec.push('Segmentar la VLAN o reducir el tamaño de subnet.'); rec.push('Limitar VLANs permitidas en trunks.'); rec.push('Separar IoT/cámaras/voz si están mezclados.'); }
    else if(score >= 35){ s.level = 'medio'; rec.push('Revisar crecimiento, trunks y separación por función.'); }
    else { s.level = 'bajo'; rec.push('Sin señales fuertes de riesgo broadcast; mantener monitorización.'); }
    s.riskScore = Math.min(100, Math.round(score));
    s.recommendations = rec;
    s.issues = issues;
    return s;
  }

  function auditBroadcastDomains(project, options){
    const stats = collectVlanStats(project).map(s => assessVlanRisk(s, options));
    const issues = stats.flatMap(s => s.issues || []);
    if(!issues.length){
      const msg = 'Dominios broadcast: sin riesgos evidentes con los datos actuales.';
      issues.push(NWA ? NWA.createIssue({code:'NW-BCAST-OK', severity:'info', category:'broadcast', message:msg, source:'broadcast'}) : {code:'NW-BCAST-OK', severity:'info', category:'broadcast', message:msg});
    }
    const split = NWA ? NWA.splitIssues(issues) : {
      ok: !issues.some(i => i.severity === 'error'),
      errors: issues.filter(i=>i.severity==='error').map(i=>`[${i.code}] ${i.message}`),
      warnings: issues.filter(i=>i.severity==='warning').map(i=>`[${i.code}] ${i.message}`),
      info: issues.filter(i=>i.severity==='info').map(i=>`[${i.code}] ${i.message}`),
      issues
    };
    split.stats = stats;
    return split;
  }

  function summarizeBroadcastAudit(audit){
    const a = audit || {stats:[],issues:[]};
    const lines = ['Auditoría de dominios broadcast'];
    for(const s of arr(a.stats).sort((x,y)=>(y.riskScore||0)-(x.riskScore||0))){
      lines.push(`\n${s.level === 'alto' ? '🔴' : s.level === 'medio' ? '🟠' : '🟢'} ${s.label} · riesgo ${s.riskScore}/100 · endpoints ${s.plannedEndpoints || 0}${s.usableHosts != null ? ' · subnet útil '+s.usableHosts : ''}`);
      if(s.recommendations && s.recommendations.length) lines.push('  Recomendación: '+s.recommendations.join(' '));
    }
    const warnings = arr(a.warnings), errors = arr(a.errors), info = arr(a.info);
    if(errors.length) lines.push('\nERRORES:\n'+errors.map(x=>'• '+x).join('\n'));
    if(warnings.length) lines.push('\nAVISOS:\n'+warnings.map(x=>'• '+x).join('\n'));
    if(!errors.length && !warnings.length && info.length) lines.push('\n'+info.join('\n'));
    return lines.join('\n').trim();
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
      if(!pg || $('nwBroadcastCard')) return;
      const card = doc.createElement('div');
      card.className = 'card';
      card.id = 'nwBroadcastCard';
      const staticHtml = '<div class="card-h"><div class="card-t">📡 Riesgo broadcast</div><span class="b bac">v3.24</span></div><div class="co co-ac">Estima dominios broadcast grandes o poco eficientes por VLAN: tamaño de subnet, endpoints, IoT/cámaras/voz y trunks demasiado abiertos.</div><div class="brow"><button class="btn bs" id="btnBroadcastAudit">Auditar broadcast</button></div><pre class="cfg" id="nwBroadcastOut" style="min-height:120px;white-space:pre-wrap;"></pre>'; card.appendChild(doc.createRange().createContextualFragment(staticHtml));
      pg.appendChild(card);
      $('btnBroadcastAudit').onclick = function(){
        $('nwBroadcastOut').textContent = summarizeBroadcastAudit(auditBroadcastDomains(projectSnapshot()));
      };
    }
    if(doc.readyState === 'loading') doc.addEventListener('DOMContentLoaded', ensure);
    else setTimeout(ensure, 0);
  }

  const api = {version:'netwizard-broadcast-utils-v3.24', usableHostsFromCidr, collectVlanStats, assessVlanRisk, auditBroadcastDomains, summarizeBroadcastAudit};
  if(typeof module !== 'undefined' && module.exports) module.exports = api;
  root.NetWizardBroadcastUtils = api;
  bindBrowserUi();
})(typeof window !== 'undefined' ? window : globalThis);
