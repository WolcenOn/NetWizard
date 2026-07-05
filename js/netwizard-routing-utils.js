/* =========================================================
   NetWizard Routing Utils v3.14
   Inferencia prudente de rutas estáticas para enlaces de tránsito L3.
   No modifica el proyecto: solo propone rutas exportables por vendor.
========================================================= */
(function initNetWizardRoutingUtils(root){
  'use strict';

  const NWU = root.NetWizardNetworkUtils || (typeof require === 'function' ? require('./netwizard-network-utils.js') : {});
  const NWL3 = root.NetWizardL3ConfigUtils || (typeof require === 'function' ? require('./netwizard-l3-config-utils.js') : {});
  const parseCidr = NWU.parseCidr;
  const ip4s = NWU.ip4s;

  function arr(v){ return Array.isArray(v) ? v : []; }
  function clean(v){ return String(v == null ? '' : v).trim(); }
  function deviceById(project, id){ return arr(project && project.devices).find(d => d.id === id) || null; }
  function portById(project, id){ return arr(project && project.ports).find(p => p.id === id) || null; }
  function subnetByVlan(project, ref){ return arr(project && project.subnets).find(s => s.vlanRef === ref) || null; }
  function vlanByRef(project, ref){ return arr(project && project.vlans).find(v => v.id === ref) || null; }
  function normCidr(cidr){ const ci = parseCidr ? parseCidr(cidr) : null; return ci ? ci.cidr : ''; }
  function isTransitVlan(v){
    const intent = v && v.intent ? v.intent : {};
    const txt = `${clean(v && v.name)} ${clean(intent.type)} ${clean(intent.notes)}`.toLowerCase();
    return intent.type === 'transit' || /transit|tránsito|p2p|point.?to.?point|uplink|wan/.test(txt);
  }
  function isFirewallLike(d){
    const t = clean(d && d.type).toLowerCase();
    const vo = clean(d && d.vendorOs).toLowerCase();
    return t === 'firewall' || vo === 'cisco_asa' || vo === 'pfsense' || vo === 'fortinet';
  }
  function isRoutedGatewayDevice(project, device){
    if(!device) return false;
    const roas = project && project.roas ? project.roas : {};
    return roas.gwId === device.id || isFirewallLike(device) || clean(device.l3Capable).toLowerCase() === 'yes' || ['router','l3switch','switch_l3'].includes(clean(device.type).toLowerCase());
  }

  function deviceL3Interfaces(project, deviceId){
    if(NWL3 && typeof NWL3.collectDeviceL3Interfaces === 'function') return NWL3.collectDeviceL3Interfaces(project, deviceId);
    return arr(project && project.ports).filter(p => p.deviceId === deviceId && (p.l3Ip || p.routedIp) && (p.l3Cidr || p.routedCidr)).map(p => ({portId:p.id, portName:p.name || p.id, ip:p.l3Ip || p.routedIp, cidr:p.l3Cidr || p.routedCidr, peerDeviceId:'', peerIp:''}));
  }

  function enrichPeerIds(project, iface){
    const port = portById(project, iface.portId);
    const link = arr(project && project.links).find(l => l.aPortId === iface.portId || l.bPortId === iface.portId);
    if(!port || !link) return Object.assign({}, iface, { peerDeviceId:'', peerPortId:'', peerIp:'' });
    const peerPortId = link.aPortId === iface.portId ? link.bPortId : link.aPortId;
    const peerPort = portById(project, peerPortId);
    const peerIface = peerPort ? deviceL3Interfaces(project, peerPort.deviceId).find(x => x.portId === peerPort.id) : null;
    return Object.assign({}, iface, {
      peerDeviceId: peerPort ? peerPort.deviceId : '',
      peerPortId: peerPort ? peerPort.id : '',
      peerIp: peerIface ? clean(peerIface.ip) : clean(peerPort && (peerPort.l3Ip || peerPort.routedIp))
    });
  }

  function collectLocalNetworks(project, deviceId, options){
    const p = project || {};
    const dev = deviceById(p, deviceId);
    const opts = options || {};
    const out = [];
    for(const it of deviceL3Interfaces(p, deviceId)){
      const cidr = normCidr(it.cidr);
      if(cidr) out.push({ cidr, type:'connected-l3', vlanRef:it.vlanRef || '', vlanId:it.vlanId || null, source:'interface', portId:it.portId });
    }
    const ownsVlans = (p && p.roas && p.roas.gwId === deviceId) || isFirewallLike(dev) || clean(dev && dev.vlanGateway).toLowerCase() === 'yes';
    if(ownsVlans){
      for(const sn of arr(p.subnets)){
        const v = vlanByRef(p, sn.vlanRef);
        if(!sn || !sn.cidr) continue;
        if(!opts.includeTransit && v && isTransitVlan(v)) continue;
        const cidr = normCidr(sn.cidr);
        if(cidr) out.push({ cidr, type:'local-vlan', vlanRef:sn.vlanRef || '', vlanId:v ? v.vlanId : null, source:'vlan-gateway' });
      }
    }
    const seen = new Set();
    return out.filter(n => {
      if(!n.cidr || seen.has(n.cidr)) return false;
      seen.add(n.cidr);
      return true;
    }).sort((a,b)=>a.cidr.localeCompare(b.cidr));
  }

  function maskFor(cidr){ const ci = parseCidr ? parseCidr(cidr) : null; return ci && ip4s ? ip4s(ci.mask) : ''; }
  function networkFor(cidr){ const ci = parseCidr ? parseCidr(cidr) : null; return ci && ip4s ? ip4s(ci.net) : ''; }
  function prefixFor(cidr){ const ci = parseCidr ? parseCidr(cidr) : null; return ci ? ci.pfx : null; }

  function inferStaticRoutes(project, deviceId, options){
    const p = project || {};
    const opts = options || {};
    const local = collectLocalNetworks(p, deviceId, {includeTransit:true});
    const localSet = new Set(local.map(n => n.cidr));
    const routes = [];
    const seen = new Set();
    for(const rawIface of deviceL3Interfaces(p, deviceId)){
      const iface = enrichPeerIds(p, rawIface);
      if(!iface.peerDeviceId || !iface.peerIp) continue;
      const peerDev = deviceById(p, iface.peerDeviceId);
      if(!isRoutedGatewayDevice(p, peerDev)) continue;
      const peerLocal = collectLocalNetworks(p, iface.peerDeviceId, {includeTransit:false});
      for(const target of peerLocal){
        if(!target.cidr || localSet.has(target.cidr)) continue;
        const key = `${target.cidr}|${iface.peerIp}`;
        if(seen.has(key)) continue;
        seen.add(key);
        routes.push({
          destination: target.cidr,
          network: networkFor(target.cidr),
          mask: maskFor(target.cidr),
          prefix: prefixFor(target.cidr),
          nextHop: iface.peerIp,
          outPortId: iface.portId,
          outPortName: iface.portName || '',
          peerDeviceId: iface.peerDeviceId,
          peerDeviceName: peerDev ? clean(peerDev.name || peerDev.id) : '',
          peerPortName: iface.peerPortName || '',
          vlanRef: target.vlanRef || '',
          vlanId: target.vlanId || null,
          reason: `Red local en ${peerDev ? clean(peerDev.name || peerDev.id) : iface.peerDeviceId}`
        });
      }
    }
    if(opts.includeDefaultRoute){
      // Reservado para futuras políticas WAN; por ahora no inventamos default routes.
    }
    return routes.sort((a,b)=>a.destination.localeCompare(b.destination) || a.nextHop.localeCompare(b.nextHop));
  }

  function summarizeRoutes(routes){
    const rs = arr(routes);
    if(!rs.length) return 'No se han inferido rutas estáticas básicas para este dispositivo.';
    return rs.map(r => `${r.destination} vía ${r.nextHop}${r.peerDeviceName ? ' ('+r.peerDeviceName+')' : ''}`).join('\n');
  }

  const api = { version:'netwizard-routing-utils-v1', collectLocalNetworks, inferStaticRoutes, summarizeRoutes, maskFor, networkFor, prefixFor };
  root.NetWizardRoutingUtils = api;
  if(typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
