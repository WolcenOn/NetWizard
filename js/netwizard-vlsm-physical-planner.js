/* =========================================================
   NetWizard VLSM + Physical Planner v3.24
   Planificación VLSM, auditoría de capa 1 y asignación automática de IPs.
   Cargable en navegador clásico y en Node.js para tests.
========================================================= */

/*
Mantenimiento:
- buildVlsmPlan() y preflightProject() deben seguir siendo deterministas y testeables.
- No sobrescribir IPs existentes salvo opción explícita de usuario.
- Las validaciones de capa física delegan en módulos especializados cuando existen
  (cabling, PoE, L2, broadcast) para evitar duplicar reglas.
*/
(function initNetWizardPlanner(root){
  'use strict';

  const NWU = root.NetWizardNetworkUtils || (typeof require==='function' ? require('./netwizard-network-utils.js') : {});
  const parseIp = NWU.parseIp;
  const ip4s = NWU.ip4s;
  const parseCidr = NWU.parseCidr;
  const ipInSn = NWU.ipInSn;
  const cidrOverlaps = NWU.cidrOverlaps;
  const NWA = root.NetWizardAudit || (typeof require==='function' ? require('./netwizard-audit.js') : null);
  const NWC = root.NetWizardCablingUtils || (typeof require==='function' ? require('./netwizard-cabling-utils.js') : null);

  function cleanStr(v){ return String(v==null?'':v).trim(); }
  function uid(prefix){ return prefix + Math.random().toString(36).slice(2) + Date.now().toString(36); }
  function isArray(v){ return Array.isArray(v) ? v : []; }
  function clone(v){ return JSON.parse(JSON.stringify(v)); }
  function vlanByRef(project, ref){ return isArray(project.vlans).find(v=>v.id===ref) || null; }
  function portById(project, id){ return isArray(project.ports).find(p=>p.id===id) || null; }
  function devById(project, id){ return isArray(project.devices).find(d=>d.id===id) || null; }
  function subnetByVlan(project, vlanRef){ return isArray(project.subnets).find(s=>s.vlanRef===vlanRef) || null; }
  function deviceType(dev){ return String((dev && dev.type) || '').toLowerCase(); }
  function isSwitch(dev){ return ['switch','l2switch','l3switch','switch_l3'].includes(deviceType(dev)); }
  function isL3Device(dev){ return ['router','firewall','l3switch','switch_l3'].includes(deviceType(dev)) || String((dev && dev.l3Capable) || '').toLowerCase() === 'yes'; }
  function isNetworkDevice(dev){ return isSwitch(dev) || isL3Device(dev) || ['ap','wireless_ap','iot_gateway'].includes(deviceType(dev)); }
  function isTransitVlan(vlan){
    const intent = vlan && vlan.intent && typeof vlan.intent === 'object' ? vlan.intent : {};
    const txt = `${intent.type || ''} ${vlan && vlan.name || ''}`.toLowerCase();
    return intent.type === 'transit' || /transit|tránsito|p2p|point.?to.?point|uplink|wan/.test(txt);
  }
  function linkTransitVlanRef(link, aPort, bPort){
    return (link && (link.transitVlanRef || link.vlanRef || link.l3VlanRef)) ||
      (aPort && (aPort.routedVlanRef || aPort.transitVlanRef)) ||
      (bPort && (bPort.routedVlanRef || bPort.transitVlanRef)) || '';
  }
  function isLayer3TransitLink(link, aPort, bPort, aDev, bDev){
    const modes = [String((aPort && aPort.mode) || 'access'), String((bPort && bPort.mode) || 'access')];
    if(modes.includes('routed')) return isL3Device(aDev) || isL3Device(bDev);
    if(isL3Device(aDev) && isL3Device(bDev)) return true;
    if((isL3Device(aDev) && isSwitch(bDev)) || (isL3Device(bDev) && isSwitch(aDev))){
      return modes.includes('trunk') || !!linkTransitVlanRef(link, aPort, bPort);
    }
    return false;
  }

  function vlanLabel(project, vlanRef){
    const v = vlanByRef(project, vlanRef);
    return v ? `VLAN ${v.vlanId}${v.name ? ' · '+v.name : ''}` : `VLAN ${vlanRef||'?'}`;
  }

  function collectAddressingIssues(project){
    const errors = [];
    const warnings = [];
    const info = [];
    const subnets = isArray(project.subnets);
    const seenCidrs = [];
    for(const sn of subnets){
      const ci = parseCidr ? parseCidr(sn.cidr) : null;
      if(!ci){ errors.push(`Subnet inválida en ${vlanLabel(project, sn.vlanRef)}: ${sn.cidr||'(vacía)'}.`); continue; }
      for(const prev of seenCidrs){
        if(cidrOverlaps && cidrOverlaps(prev.cidr, ci.cidr)){
          errors.push(`Subredes solapadas: ${prev.label} ${prev.cidr} se solapa con ${vlanLabel(project, sn.vlanRef)} ${ci.cidr}.`);
        }
      }
      seenCidrs.push({cidr:ci.cidr, label:vlanLabel(project, sn.vlanRef)});
      const gw = cleanStr(sn.gateway);
      if(gw){
        const gip = parseIp ? parseIp(gw) : null;
        if(gip===null) errors.push(`Gateway inválido en ${vlanLabel(project, sn.vlanRef)}: ${gw}.`);
        else if(!(ipInSn && ipInSn(gw, ci.cidr))) errors.push(`Gateway fuera de subnet en ${vlanLabel(project, sn.vlanRef)}: ${gw} no pertenece a ${ci.cidr}.`);
        else if(gip===ci.net || gip===ci.bc) errors.push(`Gateway reservado en ${vlanLabel(project, sn.vlanRef)}: ${gw} es red o broadcast.`);
      }
    }

    const ipOwners = new Map();
    for(const h of isArray(project.hosts)){
      const ip = cleanStr(h.staticIp);
      if(!ip) continue;
      const parsed = parseIp ? parseIp(ip) : null;
      if(parsed===null){ errors.push(`Host ${h.name||h.id||'?'}: IP estática inválida (${ip}).`); continue; }
      if(ipOwners.has(ip)) errors.push(`IP duplicada ${ip}: ${ipOwners.get(ip)} y ${h.name||h.id||'?'}.`);
      else ipOwners.set(ip, h.name||h.id||'?');
      const sn = subnetByVlan(project, h.vlanRef);
      if(!sn){ warnings.push(`Host ${h.name||h.id||'?'}: tiene IP ${ip}, pero su VLAN no tiene subnet definida.`); continue; }
      const ci = parseCidr ? parseCidr(sn.cidr) : null;
      if(ci && !(ipInSn && ipInSn(ip, ci.cidr))) errors.push(`Host ${h.name||h.id||'?'}: IP ${ip} fuera de ${ci.cidr}.`);
      if(ci && (parsed===ci.net || parsed===ci.bc)) errors.push(`Host ${h.name||h.id||'?'}: IP ${ip} es dirección de red o broadcast.`);
      const gw = cleanStr(sn.gateway);
      if(gw && ip===gw) errors.push(`Host ${h.name||h.id||'?'}: IP ${ip} coincide con el gateway de ${vlanLabel(project, h.vlanRef)}.`);
    }
    for(const port of isArray(project.ports)){
      const ip = cleanStr(port.l3Ip || port.routedIp);
      const cidr = cleanStr(port.l3Cidr || port.routedCidr);
      if(!ip && !cidr) continue;
      const dev = devById(project, port.deviceId);
      const label = `${dev ? dev.name : '?'} ${port.name || port.id || '?'}`;
      if(ip && (!parseIp || parseIp(ip)===null)) errors.push(`Interfaz ${label}: IP L3 inválida (${ip}).`);
      if(cidr){
        const ci = parseCidr ? parseCidr(cidr) : null;
        if(!ci) errors.push(`Interfaz ${label}: CIDR L3 inválido (${cidr}).`);
        else if(ip && !(ipInSn && ipInSn(ip, ci.cidr))) errors.push(`Interfaz ${label}: IP ${ip} fuera de ${ci.cidr}.`);
      }
      if(ip){
        if(ipOwners.has(ip)) errors.push(`IP duplicada ${ip}: ${ipOwners.get(ip)} y ${label}.`);
        else ipOwners.set(ip, label);
      }
    }

    if(!errors.length && !warnings.length) info.push('El direccionamiento actual no muestra problemas evidentes.');
    return {ok:errors.length===0, errors, warnings, info};
  }

  function summarizeIssues(title, issues){
    if(NWA && issues && Array.isArray(issues.issues)) return NWA.summarizeIssues(issues.issues, {title, empty:title||'Sin resultados.'});
    const lines = [];
    if(title) lines.push(title);
    if(issues.errors && issues.errors.length) lines.push('ERRORES:\n' + issues.errors.map(x=>'• '+x).join('\n'));
    if(issues.warnings && issues.warnings.length) lines.push('AVISOS:\n' + issues.warnings.map(x=>'• '+x).join('\n'));
    if(issues.info && issues.info.length) lines.push(issues.info.join('\n'));
    return lines.join('\n\n') || (title || 'Sin resultados.');
  }

  function preflightProject(project){
    const physical = validatePhysicalCompatibility(project);
    const addressing = collectAddressingIssues(project);
    return {ok:physical.ok && addressing.ok, physical, addressing};
  }

  function readinessAudit(project, options){
    const opts = options || {};
    const p = project || {};
    const preflight = preflightProject(p);
    const issues = [];
    const mk = (code, severity, category, message) => NWA ? NWA.createIssue({code, severity, category, message}) : {code, severity, category, message, blocking:severity==='error'};

    for(const msg of preflight.physical.errors) issues.push(mk('NW-L1-000', 'error', 'physical', msg));
    for(const msg of preflight.physical.warnings) issues.push(mk('NW-L1-100', 'warning', 'physical', msg));
    for(const msg of preflight.addressing.errors) issues.push(mk('NW-IP-000', 'error', 'addressing', msg));
    for(const msg of preflight.addressing.warnings) issues.push(mk('NW-IP-100', 'warning', 'addressing', msg));

    const vlans = isArray(p.vlans);
    const subnets = isArray(p.subnets);
    const ports = isArray(p.ports);
    const devices = isArray(p.devices);
    const hosts = isArray(p.hosts);
    const links = isArray(p.links);
    if(!vlans.length) issues.push(mk('NW-VLAN-000', 'error', 'design', 'No hay VLANs definidas.'));
    for(const v of vlans){
      if(!subnets.some(sn=>sn.vlanRef===v.id)) issues.push(mk('NW-VLAN-001', 'warning', 'design', `VLAN ${v.vlanId||v.id}: no tiene subnet/gateway definido.`));
    }
    const hasInterVlanCapable = devices.some(d=>['router','firewall','l3switch','switch_l3'].includes(String(d.type||'').toLowerCase()) || String(d.l3Capable||'').toLowerCase()==='yes');
    const hasMultipleVlans = vlans.length > 1;
    if(hasMultipleVlans && !hasInterVlanCapable) issues.push(mk('NW-L3-001', 'warning', 'routing', 'Hay varias VLANs, pero no se identifica router/firewall/switch L3 para routing inter-VLAN.'));
    const trunkCount = ports.filter(p=>p.mode==='trunk').length;
    if(hasMultipleVlans && links.length && trunkCount===0) issues.push(mk('NW-L2-001', 'warning', 'switching', 'Hay varias VLANs y enlaces físicos, pero no hay puertos trunk definidos.'));
    for(const l of links){
      const a = portById(p, l.aPortId), b = portById(p, l.bPortId);
      const da = a ? devById(p, a.deviceId) : null, db = b ? devById(p, b.deviceId) : null;
      if(a && b && da && db && isLayer3TransitLink(l, a, b, da, db)){
        const transitRef = linkTransitVlanRef(l, a, b);
        if(!transitRef) issues.push(mk('NW-L3-010', 'warning', 'routing', `Enlace L3 ${da.name || da.id} ↔ ${db.name || db.id}: falta VLAN/red de tránsito para direccionamiento VLSM.`));
        else {
          const tv = vlanByRef(p, transitRef);
          if(!tv) issues.push(mk('NW-L3-011', 'error', 'routing', `Enlace L3 ${da.name || da.id} ↔ ${db.name || db.id}: VLAN de tránsito inexistente (${transitRef}).`));
          else if(!isTransitVlan(tv)) issues.push(mk('NW-L3-012', 'warning', 'routing', `VLAN ${tv.vlanId || tv.id}: debería marcarse como Tránsito L3 para enlaces entre dispositivos.`));
          else if(!subnetByVlan(p, transitRef)) issues.push(mk('NW-L3-013', 'warning', 'routing', `VLAN de tránsito ${tv.vlanId || tv.id}: falta subnet /30 o /31.`));
        }
      }
    }
    const staticHosts = hosts.filter(h=>h.ipMode==='static');
    for(const h of staticHosts){
      if(!cleanStr(h.staticIp)) issues.push(mk('NW-IP-004', 'warning', 'addressing', `Host ${h.name||h.id||'?'}: está en modo estático pero no tiene IP.`));
    }
    const dhcpEnabled = Object.values(p.dhcp||{}).some(cfg=>cfg && cfg.enabled);
    if(hosts.some(h=>h.ipMode==='dhcp') && !dhcpEnabled) issues.push(mk('NW-DHCP-001', 'warning', 'dhcp', 'Hay hosts en DHCP, pero no se ha definido ningún scope DHCP habilitado.'));
    const DH = root.NetWizardDhcpUtils || (typeof require === 'function' ? tryRequireDhcpUtils() : null);
    if(DH){
      const dhAudit = DH.validateDhcpForProject(p);
      for(const issue of dhAudit.issues || []) issues.push(mk(issue.code, issue.severity || 'warning', issue.category || 'dhcp', issue.message));
    }
    const POL = root.NetWizardPolicyUtils || (typeof require === 'function' ? tryRequirePolicyUtils() : null);
    if(POL){
      const polAudit = POL.validatePolicyForProject(p);
      for(const issue of polAudit.issues || []) issues.push(mk(issue.code, issue.severity || 'warning', issue.category || 'policy', issue.message));
    }
    const BCAST = root.NetWizardBroadcastUtils || (typeof require === 'function' ? tryRequireBroadcastUtils() : null);
    if(BCAST){
      const bcAudit = BCAST.auditBroadcastDomains(p);
      for(const issue of bcAudit.issues || []) issues.push(mk(issue.code, issue.severity || 'info', issue.category || 'broadcast', issue.message));
    }

    const finalIssues = (opts.productionMode && NWA) ? NWA.applyProductionPolicy(issues) : issues;
    if(!finalIssues.length) finalIssues.push(mk('NW-OK-001', 'info', 'readiness', 'La auditoría de preparación no ha encontrado bloqueos ni avisos relevantes.'));
    const split = NWA ? NWA.splitIssues(finalIssues) : {
      ok: !finalIssues.some(i=>i.severity==='error'),
      errors: finalIssues.filter(i=>i.severity==='error').map(i=>`[${i.code}] ${i.message}`),
      warnings: finalIssues.filter(i=>i.severity==='warning').map(i=>`[${i.code}] ${i.message}`),
      info: finalIssues.filter(i=>i.severity==='info').map(i=>`[${i.code}] ${i.message}`),
      issues: finalIssues
    };
    split.physical = preflight.physical;
    split.addressing = preflight.addressing;
    return split;
  }
  function tryRequireDhcpUtils(){
    try { return require('./netwizard-dhcp-utils.js'); } catch { return null; }
  }
  function tryRequirePolicyUtils(){
    try { return require('./netwizard-policy-utils.js'); } catch { return null; }
  }
  function tryRequireBroadcastUtils(){
    try { return require('./netwizard-broadcast-utils.js'); } catch { return null; }
  }

  function usedStaticIps(project){
    const s = new Set();
    for(const h of isArray(project.hosts)){
      const ip = cleanStr(h.staticIp);
      if(ip && parseIp && parseIp(ip)!==null) s.add(ip);
    }
    return s;
  }

  function usableHostsForPrefix(prefix){
    const p = Number(prefix);
    if(!Number.isFinite(p) || p<0 || p>32) return 0;
    if(p>=31) return 0;
    return Math.max(0, Math.pow(2, 32-p)-2);
  }

  function prefixForHosts(requiredHosts){
    const need = Math.max(0, Math.ceil(Number(requiredHosts)||0));
    if(need<=0) return 32;
    for(let p=30;p>=0;p--){
      if(usableHostsForPrefix(p)>=need) return p;
    }
    return null;
  }

  function blockSize(prefix){ return Math.pow(2, 32-prefix); }
  function alignUp(n, size){ return Math.ceil(n / size) * size; }

  function buildVlsmPlan(baseCidr, vlanNeeds, options){
    const opts = options || {};
    const base = parseCidr ? parseCidr(baseCidr) : null;
    if(!base) return {ok:false, code:'invalid_base', msg:'Bloque base inválido. Usa formato tipo 10.10.0.0/16.', plans:[], warnings:[]};
    const margin = Math.max(0, Math.ceil(Number(opts.margin)||0));
    const needs = isArray(vlanNeeds).map(n=>({
      vlanRef:n.vlanRef,
      vlanId:n.vlanId,
      name:n.name || '',
      hostsRequired:Math.max(0, Math.ceil(Number(n.hostsRequired)||0)),
      notes:n.notes || ''
    })).filter(n=>n.vlanRef);
    const sorted = needs.slice().sort((a,b)=>{
      const pa = prefixForHosts(a.hostsRequired + margin);
      const pb = prefixForHosts(b.hostsRequired + margin);
      return (pa==null?99:pa) - (pb==null?99:pb) || (a.vlanId||99999)-(b.vlanId||99999);
    });
    const plans = [];
    const warnings = [];
    let cursor = base.net;
    for(const n of sorted){
      const required = n.hostsRequired + margin;
      const pfx = prefixForHosts(required);
      if(pfx===null){
        return {ok:false, code:'too_many_hosts', msg:`La VLAN ${n.vlanId||n.vlanRef} necesita demasiados hosts.`, plans, warnings};
      }
      const size = blockSize(pfx);
      const net = alignUp(cursor, size) >>> 0;
      const bc = (net + size - 1) >>> 0;
      if(net < base.net || bc > base.bc || net > bc){
        return {ok:false, code:'base_too_small', msg:`El bloque ${base.cidr} no tiene espacio para asignar la VLAN ${n.vlanId||n.vlanRef} con /${pfx}.`, plans, warnings};
      }
      const gatewayMode = opts.gatewayMode || 'first';
      const gateway = pfx>=31 ? '' : (gatewayMode==='last' ? ip4s(bc-1) : ip4s(net+1));
      plans.push({
        vlanRef:n.vlanRef,
        vlanId:n.vlanId,
        name:n.name,
        hostsRequired:n.hostsRequired,
        margin,
        requiredWithMargin:required,
        prefix:pfx,
        cidr:`${ip4s(net)}/${pfx}`,
        gateway,
        firstHost:pfx>=31?'':ip4s(net+1),
        lastHost:pfx>=31?'':ip4s(bc-1),
        usableHosts:usableHostsForPrefix(pfx)
      });
      cursor = (bc + 1) >>> 0;
    }
    return {ok:true, base:base.cidr, plans, warnings};
  }

  function inferVlanNeeds(project, options){
    const opts = options || {};
    const minPerVlan = Math.max(0, Math.ceil(Number(opts.minPerVlan)||2));
    const multiplier = Math.max(1, Number(opts.growthMultiplier)||1);
    return isArray(project.vlans).map(v=>{
      const hosts = isArray(project.hosts).filter(h=>h.vlanRef===v.id).length;
      const ports = isArray(project.ports).filter(p=>p.mode==='access' && p.accessVlanRef===v.id).length;
      const iot = project.iot ? isArray(project.iot.devices).filter(d=>d.vlanRef===v.id || d.segmentVlanRef===v.id).length : 0;
      const intent = v.intent && typeof v.intent === 'object' ? v.intent : null;
      const intentNeed = intent ? (Math.max(0, Math.ceil(Number(intent.expectedHosts)||0)) + Math.max(0, Math.ceil(Number(intent.growthHosts)||0))) : 0;
      const transit = isTransitVlan(v);
      const effectiveMin = transit ? 2 : minPerVlan;
      const baseNeed = Math.max(effectiveMin, hosts + iot, Math.ceil(ports * 0.75), intentNeed);
      return { vlanRef:v.id, vlanId:v.vlanId, name:v.name, hostsRequired:Math.ceil(baseNeed * multiplier), type: transit ? 'transit' : (intent && intent.type) || '', notes:`hosts=${hosts}, puertos access=${ports}, iot=${iot}${intent?`, intención=${intentNeed}`:''}${transit?', tránsito L3':''}` };
    });
  }

  function validatePhysicalCompatibility(project){
    const errors = [];
    const warnings = [];
    const info = [];
    const usedPorts = new Map();
    for(const l of isArray(project.links)){
      const a = portById(project,l.aPortId), b = portById(project,l.bPortId);
      if(!a || !b){ errors.push(`Enlace ${l.id||''}: puerto inexistente.`); continue; }
      const da = devById(project,a.deviceId), db = devById(project,b.deviceId);
      if(!da || !db){ errors.push(`Enlace ${l.id||''}: dispositivo inexistente.`); continue; }
      if(a.id===b.id) errors.push(`Enlace ${da.name} ${a.name}: un puerto no puede conectarse consigo mismo.`);
      if(a.deviceId===b.deviceId) warnings.push(`Enlace ${da.name}: ${a.name} ↔ ${b.name} conecta puertos del mismo equipo; comprueba que no sea un loop accidental.`);
      for(const p of [a,b]){
        if(usedPorts.has(p.id)) errors.push(`Puerto ${devById(project,p.deviceId)?.name||'?'} ${p.name} aparece en más de un enlace.`);
        usedPorts.set(p.id,l.id||true);
      }
      const ma = String(a.media||'').toUpperCase(), mb = String(b.media||'').toUpperCase();
      const fiberA = ma.includes('SFP') || ma.includes('10GE');
      const fiberB = mb.includes('SFP') || mb.includes('10GE');
      if(fiberA !== fiberB) warnings.push(`Medio posiblemente incompatible: ${da.name} ${a.name} (${ma||'?'}) ↔ ${db.name} ${b.name} (${mb||'?'}).`);
      const modes = [a.mode||'access', b.mode||'access'];
      if(modes.includes('trunk')){
        const devTypes = [da.type, db.type];
        if(!(devTypes.includes('switch') && (devTypes.includes('switch') || devTypes.includes('router') || devTypes.includes('firewall')))){
          warnings.push(`Trunk sospechoso entre ${da.name} y ${db.name}; normalmente debe ser switch-switch o switch-router/firewall.`);
        }
        if(a.mode==='trunk' && b.mode==='access') warnings.push(`Trunk conectado a access: ${da.name} ${a.name} ↔ ${db.name} ${b.name}.`);
        if(b.mode==='trunk' && a.mode==='access') warnings.push(`Access conectado a trunk: ${da.name} ${a.name} ↔ ${db.name} ${b.name}.`);
      }
      if(modes.includes('routed') && modes.includes('access')) warnings.push(`Puerto routed conectado a access: ${da.name} ${a.name} ↔ ${db.name} ${b.name}.`);
      if(isLayer3TransitLink(l, a, b, da, db)){
        const transitRef = linkTransitVlanRef(l, a, b);
        if(!transitRef){
          warnings.push(`Enlace L3/transito ${da.name} ${a.name} ↔ ${db.name} ${b.name}: define una VLAN/red de tránsito dedicada para que VLSM pueda asignarle una subred /30 o equivalente.`);
        } else {
          const tv = vlanByRef(project, transitRef);
          if(!tv) errors.push(`Enlace L3/transito ${da.name} ${a.name} ↔ ${db.name} ${b.name}: referencia una VLAN de tránsito inexistente (${transitRef}).`);
          else if(!isTransitVlan(tv)) warnings.push(`Enlace L3/transito ${da.name} ${a.name} ↔ ${db.name} ${b.name}: la VLAN ${tv.vlanId || tv.id} debería marcarse con intención "Tránsito L3".`);
          else if(!subnetByVlan(project, transitRef)) warnings.push(`Enlace L3/transito ${da.name} ${a.name} ↔ ${db.name} ${b.name}: la VLAN de tránsito ${tv.vlanId || tv.id} todavía no tiene subnet.`);
        }
      }
    }
    if(NWC && typeof NWC.validateCabling === 'function'){
      const cab = NWC.validateCabling(project);
      for(const msg of isArray(cab.errors)) errors.push(msg);
      for(const msg of isArray(cab.warnings)) warnings.push(msg);
      for(const msg of isArray(cab.info)) info.push(msg);
    }
    const NWPoe = root.NetWizardPoeUtils || (typeof require==='function' ? (()=>{try{return require('./netwizard-poe-utils.js')}catch{return null}})() : null);
    if(NWPoe && typeof NWPoe.validatePoe === 'function'){
      const poe = NWPoe.validatePoe(project);
      for(const msg of isArray(poe.errors)) errors.push(msg);
      for(const msg of isArray(poe.warnings)) warnings.push(msg);
      for(const msg of isArray(poe.info)) info.push(msg);
    }

    for(const h of isArray(project.hosts)){
      if(!h.portRef) continue;
      const p = portById(project,h.portRef);
      if(!p){ errors.push(`Host ${h.name}: puerto físico inexistente.`); continue; }
      const d = devById(project,p.deviceId);
      if(p.mode==='trunk') errors.push(`Host ${h.name}: está conectado a un puerto trunk (${d?.name||'?'} ${p.name}).`);
      if(p.mode==='routed') warnings.push(`Host ${h.name}: está conectado a un puerto routed; normalmente debería ser access.`);
      if(h.vlanRef && p.accessVlanRef && h.vlanRef!==p.accessVlanRef){
        const hv = vlanByRef(project,h.vlanRef), pv = vlanByRef(project,p.accessVlanRef);
        errors.push(`Host ${h.name}: VLAN del host (${hv?.vlanId||'?'}) no coincide con la VLAN access del puerto (${pv?.vlanId||'?'}).`);
      }
    }
    const vlansWithHosts = new Set(isArray(project.hosts).map(h=>h.vlanRef).filter(Boolean));
    for(const vRef of vlansWithHosts){
      if(!subnetByVlan(project,vRef)) warnings.push(`VLAN ${vlanByRef(project,vRef)?.vlanId||vRef}: tiene hosts pero no tiene subnet.`);
    }
    if(!errors.length && !warnings.length) info.push('La auditoría de capa 1 no ha encontrado incompatibilidades evidentes.');
    return {ok:errors.length===0, errors, warnings, info};
  }

  function nextUsableIp(ci, used, gateway){
    if(!ci || ci.pfx>=31) return '';
    const gw = gateway && parseIp ? parseIp(gateway) : null;
    for(let n=ci.net+1; n<=ci.bc-1; n++){
      const ip = ip4s(n>>>0);
      if(gw!==null && n===gw) continue;
      if(used.has(ip)) continue;
      used.add(ip);
      return ip;
    }
    return '';
  }

  function assignTransitInterfaceIps(project, options){
    const opts = options || {};
    const next = clone(project || {});
    const overwrite = opts.overwrite === true;
    const used = usedStaticIps(next);
    for(const port of isArray(next.ports)){
      const ip = cleanStr(port.l3Ip || port.routedIp);
      if(ip) used.add(ip);
    }
    const assigned = [];
    const warnings = [];
    for(const link of isArray(next.links)){
      const a = portById(next, link.aPortId), b = portById(next, link.bPortId);
      const da = a ? devById(next, a.deviceId) : null, db = b ? devById(next, b.deviceId) : null;
      if(!a || !b || !da || !db) continue;
      if(!isLayer3TransitLink(link, a, b, da, db)) continue;
      const vlanRef = linkTransitVlanRef(link, a, b);
      if(!vlanRef) { warnings.push(`Enlace ${da.name || da.id} ↔ ${db.name || db.id}: no tiene VLAN/red de tránsito.`); continue; }
      const sn = subnetByVlan(next, vlanRef);
      const ci = sn && parseCidr ? parseCidr(sn.cidr) : null;
      if(!ci) { warnings.push(`Enlace ${da.name || da.id} ↔ ${db.name || db.id}: la red de tránsito no tiene CIDR válido.`); continue; }
      if(ci.pfx >= 31){ warnings.push(`Enlace ${da.name || da.id} ↔ ${db.name || db.id}: /31 o /32 aún no se asigna automáticamente por prudencia.`); continue; }
      const endpoints = [a, b];
      for(const port of endpoints){
        if(!overwrite && cleanStr(port.l3Ip || port.routedIp)) continue;
        const ip = nextUsableIp(ci, used, sn.gateway);
        if(!ip){ warnings.push(`No quedan IPs libres en ${ci.cidr} para ${port.name || port.id}.`); continue; }
        port.l3Ip = ip;
        port.l3Cidr = ci.cidr;
        port.routedIp = ip;
        port.routedCidr = ci.cidr;
        assigned.push({portId:port.id, ip, cidr:ci.cidr, vlanRef});
      }
    }
    return {project:next, assigned, warnings, ok:warnings.length===0};
  }

  function applyVlsmPlan(project, planResult, options){
    if(!planResult || planResult.ok===false) throw new Error('No se puede aplicar un plan VLSM inválido.');
    const opts = options || {};
    const next = clone(project || {});
    const currentSubnets = isArray(next.subnets);
    next.subnets = currentSubnets.filter(sn=>!isArray(planResult.plans).some(p=>p.vlanRef===sn.vlanRef));
    for(const p of isArray(planResult.plans)){
      const existing = currentSubnets.find(sn=>sn.vlanRef===p.vlanRef);
      next.subnets.push({id:existing?.id || uid('sn'), vlanRef:p.vlanRef, cidr:p.cidr, gateway:p.gateway});
    }
    const assignMode = opts.assignMode || 'static_only';
    const used = usedStaticIps(next);
    for(const p of isArray(planResult.plans)){
      const ci = parseCidr(p.cidr);
      for(const h of isArray(next.hosts).filter(h=>h.vlanRef===p.vlanRef)){
        const shouldAssign = assignMode==='all_hosts' || (h.ipMode==='static' && !cleanStr(h.staticIp));
        if(!shouldAssign) continue;
        const ip = nextUsableIp(ci, used, p.gateway);
        if(ip){ h.ipMode='static'; h.staticIp=ip; }
      }
    }
    if(opts.assignTransitInterfaces){
      const transit = assignTransitInterfaceIps(next, {overwrite: !!opts.overwriteTransitIps});
      return transit.project;
    }
    return next;
  }

  function summarizeAudit(audit){ return summarizeIssues('', audit); }
  function summarizeReadiness(audit){ return summarizeIssues('', audit); }

  function bindBrowserUi(){
    if(!root.document || !root.NetWizardState) return;
    const doc = root.document;
    const $ = id => doc.getElementById(id);
    function project(){ return root.NetWizardState.getSnapshot(); }
    function ensureVlsmCard(){
      const pg = $('pg-vlan');
      if(!pg || $('vlsmBase')) return;
      const left = pg.querySelector('.g2 > div');
      if(!left) return;
      const card = doc.createElement('div');
      card.className = 'card';
      const staticHtml = '<div class="card-t" style="margin-bottom:11px;">🧮 VLSM automático por necesidad</div>'+
        '<div class="co co-ac" style="margin-bottom:9px;">Calcula subredes de tamaño variable según hosts, puertos access, IoT e intención por VLAN; las VLANs de Tránsito L3 se dimensionan como redes punto a punto. Antes de aplicar, audita la capa 1 y el direccionamiento actual.</div>'+
        '<div class="row"><div><label class="fl">Bloque base</label><input id="vlsmBase" value="10.10.0.0/16"/></div><div><label class="fl">Reserva crecimiento por VLAN</label><input id="vlsmMargin" type="number" min="0" value="5"/></div></div>'+
        '<div class="row"><div><label class="fl">Gateway</label><select id="vlsmGw"><option value="first">Primera IP usable</option><option value="last">Última IP usable</option></select></div><div><label class="fl">Asignar IPs a hosts</label><select id="vlsmAssign"><option value="static_only">Solo estáticos sin IP</option><option value="all_hosts">Todos los hosts de VLAN</option><option value="none">No tocar hosts</option></select></div></div>'+
        '<div class="brow"><button class="btn bs" id="btnVlsmPreview">👁 Previsualizar VLSM</button><button class="btn bs" id="btnVlsmDiff">🧾 Ver diff</button><button class="btn bp" id="btnVlsmApply">✔ Aplicar VLSM + IPs</button></div>'+
        '<pre class="cfg" id="vlsmOut" style="min-height:120px;white-space:pre-wrap;"></pre>';
      card.appendChild(doc.createRange().createContextualFragment(staticHtml));
      left.appendChild(card);
      $('btnVlsmPreview').onclick = () => runVlsm(false);
      $('btnVlsmDiff').onclick = runVlsmDiff;
      $('btnVlsmApply').onclick = () => runVlsm(true);
    }
    function ensureReadinessCard(){
      const pg = $('pg-dash');
      if(!pg || $('readinessAuditOut')) return;
      const target = pg.querySelector('.g2 > div:last-child') || pg;
      const card = doc.createElement('div');
      card.className = 'card';
      const staticHtml = '<div class="card-h"><div class="card-t">✅ Preparación para producción</div><button class="btn bs bsm" id="btnReadinessAudit">Auditar</button></div>'+
        '<div class="co co-ac">Revisa errores y avisos globales antes de exportar configuraciones o aplicar cambios automáticos.</div>'+
        '<label class="chk"><input type="checkbox" id="readinessProdMode"> Modo producción: convertir avisos críticos en errores</label>'+
        '<pre class="cfg" id="readinessAuditOut" style="min-height:140px;white-space:pre-wrap;"></pre>';
      card.appendChild(doc.createRange().createContextualFragment(staticHtml));
      target.appendChild(card);
      $('btnReadinessAudit').onclick = runReadiness;
      if($('readinessProdMode') && NWA){ $('readinessProdMode').checked = NWA.isProduction(); $('readinessProdMode').onchange = () => NWA.setMode($('readinessProdMode').checked ? 'production' : 'demo'); }
    }
    function ensureAuditCard(){
      const pg = $('pg-links');
      if(!pg || $('phyAuditOut')) return;
      const right = pg.querySelector('.g2 > div:last-child');
      if(!right) return;
      const card = doc.createElement('div');
      card.className = 'card';
      const staticHtml = '<div class="card-h"><div class="card-t">🧪 Auditoría capa 1</div><button class="btn bs bsm" id="btnPhyAudit">Auditar</button></div>'+
        '<div class="co co-ac">Valida enlaces físicos, medios, trunks/access/routed y coherencia host↔puerto↔VLAN antes de direccionar.</div>'+
        '<div class="brow"><button class="btn bs bsm" id="btnTransitDiff">🧾 Ver diff IPs L3</button><button class="btn bs bsm" id="btnTransitIps">🌐 Asignar IPs a enlaces L3</button><label class="chk"><input type="checkbox" id="transitOverwrite"> Sobrescribir IPs existentes</label></div>'+
        '<pre class="cfg" id="phyAuditOut" style="min-height:140px;white-space:pre-wrap;"></pre>';
      card.appendChild(doc.createRange().createContextualFragment(staticHtml));
      right.appendChild(card);
      $('btnPhyAudit').onclick = runAudit;
      $('btnTransitDiff').onclick = runTransitIpDiff;
      $('btnTransitIps').onclick = runTransitIpAssignment;
    }
    function formatVlsm(res){
      if(!res.ok) return res.msg;
      return ['Base: '+res.base, '', 'VLAN\tNecesidad\tCIDR\tGateway\tRango usable'].concat(res.plans.map(p=>`${p.vlanId||''} ${p.name||''}\t${p.hostsRequired}+${p.margin}\t${p.cidr}\t${p.gateway||'—'}\t${p.firstHost||'—'} - ${p.lastHost||'—'}`)).join('\n');
    }
    function runAudit(){
      const audit = validatePhysicalCompatibility(project());
      if($('phyAuditOut')) $('phyAuditOut').textContent = summarizeAudit(audit);
      return audit;
    }
    function runReadiness(){
      const audit = readinessAudit(project(), {productionMode: $('readinessProdMode') ? !!$('readinessProdMode').checked : !!(NWA && NWA.isProduction())});
      if($('readinessAuditOut')) $('readinessAuditOut').textContent = summarizeReadiness(audit);
      return audit;
    }

    function buildCurrentVlsmPlan(){
      const p = project();
      const needs = inferVlanNeeds(p, {minPerVlan:2});
      return buildVlsmPlan(($('vlsmBase')?.value||'').trim(), needs, {margin:$('vlsmMargin')?.value||0, gatewayMode:$('vlsmGw')?.value||'first'});
    }
    function runVlsmDiff(){
      const p = project();
      const cp = root.NetWizardChangePreview;
      const assignMode = $('vlsmAssign')?.value || 'static_only';
      const plan = buildCurrentVlsmPlan();
      if(!cp){ if($('vlsmOut')) $('vlsmOut').textContent = 'Módulo de diff no disponible.'; return; }
      const diff = cp.computeVlsmDiff(p, plan, {assignMode});
      if($('vlsmOut')) $('vlsmOut').textContent = cp.summarizeDiff(diff, 'Diff antes de aplicar VLSM');
      return diff;
    }
    function runTransitIpDiff(){
      const cp = root.NetWizardChangePreview;
      if(!cp){ if($('phyAuditOut')) $('phyAuditOut').textContent = 'Módulo de diff no disponible.'; return; }
      const diff = cp.computeTransitIpDiff(project(), {overwrite: !!($('transitOverwrite') && $('transitOverwrite').checked)});
      if($('phyAuditOut')) $('phyAuditOut').textContent = cp.summarizeDiff(diff, 'Diff antes de asignar IPs L3');
      return diff;
    }

    function runTransitIpAssignment(){
      const p = project();
      const res = assignTransitInterfaceIps(p, {overwrite: !!($('transitOverwrite') && $('transitOverwrite').checked)});
      const lines = [];
      if(res.assigned.length){
        lines.push('IPs asignadas a interfaces L3:');
        for(const a of res.assigned){
          const port = isArray(res.project.ports).find(x=>x.id===a.portId);
          const dev = port ? isArray(res.project.devices).find(d=>d.id===port.deviceId) : null;
          lines.push(`• ${dev ? dev.name : '?'} ${port ? port.name : a.portId}: ${a.ip}/${(a.cidr||'').split('/')[1]}`);
        }
      } else lines.push('No se asignó ninguna IP nueva.');
      if(res.warnings.length) lines.push('', 'Avisos:', ...res.warnings.map(w=>'• '+w));
      if($('phyAuditOut')) $('phyAuditOut').textContent = lines.join('\n');
      if(res.assigned.length){
        try{ if(root.NetWizardHistory) root.NetWizardHistory.createSnapshot('Antes de asignar IPs L3', {source:'pre-transit-ip', project:p}); }catch(_e){}
        root.NetWizardState.replaceProject(res.project, {source:'transit-ip-assignment'});
      }
      return res;
    }
    function runVlsm(apply){
      const p = project();
      const preflight = preflightProject(p);
      if($('phyAuditOut')) $('phyAuditOut').textContent = summarizeAudit(preflight.physical);
      if(apply && preflight.physical.errors.length){
        alert('No se puede aplicar el plan IP porque hay errores de capa 1. Revisa la auditoría.');
        return;
      }
      const plan = buildCurrentVlsmPlan();
      const report = [formatVlsm(plan), '', summarizeIssues('Preflight direccionamiento actual', preflight.addressing)].join('\n');
      if($('vlsmOut')) $('vlsmOut').textContent = report;
      if(!plan.ok || !apply) return;
      const assignMode = $('vlsmAssign')?.value || 'static_only';
      if(assignMode!=='all_hosts' && preflight.addressing.errors.length){
        alert('Hay errores de direccionamiento actual. Usa "Todos los hosts de VLAN" para reasignar o corrige esos hosts antes de aplicar.');
        return;
      }
      const next = applyVlsmPlan(p, plan, {assignMode});
      const postAddressing = collectAddressingIssues(next);
      if(postAddressing.errors.length){
        if($('vlsmOut')) $('vlsmOut').textContent = [report, '', summarizeIssues('Preflight tras aplicar el plan (bloqueado)', postAddressing)].join('\n');
        alert('El plan no se ha aplicado porque todavía quedaban errores de direccionamiento tras simularlo. Revisa el informe.');
        return;
      }
      try{
        if(root.localStorage) root.localStorage.setItem('nwp_pre_vlsm_backup', JSON.stringify({ts:new Date().toISOString(), project:p}));
        if(root.NetWizardHistory && typeof root.NetWizardHistory.createSnapshot==='function') root.NetWizardHistory.createSnapshot('Antes de aplicar VLSM', {source:'pre-vlsm', project:p});
      }catch(_e){}
      root.NetWizardState.replaceProject(next, {source:'vlsm-physical-planner'});
      alert('Plan VLSM aplicado. Se guardó una copia previa en historial y en localStorage como nwp_pre_vlsm_backup.');
    }
    function boot(){ ensureVlsmCard(); ensureAuditCard(); ensureReadinessCard(); }
    if(doc.readyState==='loading') doc.addEventListener('DOMContentLoaded', boot); else boot();
    doc.addEventListener('nw:project:changed', ()=>{ setTimeout(()=>{ ensureVlsmCard(); ensureAuditCard(); ensureReadinessCard(); }, 0); });
    root.addEventListener && root.addEventListener('nw:mode:changed', ()=>{ if($('readinessProdMode') && NWA) $('readinessProdMode').checked = NWA.isProduction(); });
  }

  const api = {version:'netwizard-vlsm-physical-planner-v8', usableHostsForPrefix, prefixForHosts, buildVlsmPlan, inferVlanNeeds, validatePhysicalCompatibility, collectAddressingIssues, preflightProject, readinessAudit, assignTransitInterfaceIps, applyVlsmPlan, summarizeAudit, summarizeReadiness};
  root.NetWizardPlanner = api;
  if(typeof module!=='undefined' && module.exports) module.exports = api;
  bindBrowserUi();
})(typeof window!=='undefined'?window:globalThis);
