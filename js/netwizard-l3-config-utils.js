/* =========================================================
   NetWizard L3 Config Utils v3.13
   Helpers puros para proyectar IPs de tránsito L3 en generadores vendor.
   Cargable en navegador clásico y en Node.js para tests.
========================================================= */
(function initNetWizardL3ConfigUtils(root){
  'use strict';

  const NWU = root.NetWizardNetworkUtils || (typeof require === 'function' ? require('./netwizard-network-utils.js') : {});
  const parseCidr = NWU.parseCidr;
  const ip4s = NWU.ip4s;

  function arr(v){ return Array.isArray(v) ? v : []; }
  function clean(v){ return String(v == null ? '' : v).trim(); }
  function deviceById(project, id){ return arr(project && project.devices).find(d => d.id === id) || null; }
  function portById(project, id){ return arr(project && project.ports).find(p => p.id === id) || null; }
  function vlanByRef(project, ref){ return arr(project && project.vlans).find(v => v.id === ref) || null; }
  function subnetByVlan(project, ref){ return arr(project && project.subnets).find(s => s.vlanRef === ref) || null; }
  function linkTransitVlanRef(link, aPort, bPort){
    return (link && (link.transitVlanRef || link.vlanRef || link.l3VlanRef)) ||
      (aPort && (aPort.routedVlanRef || aPort.transitVlanRef)) ||
      (bPort && (bPort.routedVlanRef || bPort.transitVlanRef)) || '';
  }

  function maskFromCidr(cidr){
    const ci = parseCidr ? parseCidr(cidr) : null;
    return ci && ip4s ? ip4s(ci.mask) : '';
  }
  function prefixFromCidr(cidr){
    const ci = parseCidr ? parseCidr(cidr) : null;
    return ci ? ci.pfx : null;
  }

  function collectDeviceL3Interfaces(project, deviceId){
    const p = project || {};
    const links = arr(p.links);
    const result = [];
    for(const port of arr(p.ports).filter(x => x.deviceId === deviceId)){
      const ip = clean(port.l3Ip || port.routedIp);
      const cidr = clean(port.l3Cidr || port.routedCidr);
      if(!ip || !cidr) continue;
      const link = links.find(l => l.aPortId === port.id || l.bPortId === port.id) || null;
      const otherPortId = link ? (link.aPortId === port.id ? link.bPortId : link.aPortId) : '';
      const peerPort = otherPortId ? portById(p, otherPortId) : null;
      const peerDev = peerPort ? deviceById(p, peerPort.deviceId) : null;
      const vlanRef = linkTransitVlanRef(link, port, peerPort);
      const vlan = vlanRef ? vlanByRef(p, vlanRef) : null;
      const subnet = vlanRef ? subnetByVlan(p, vlanRef) : null;
      result.push({
        portId: port.id,
        portName: clean(port.name || port.id),
        description: clean(port.desc),
        ip,
        cidr,
        mask: maskFromCidr(cidr),
        prefix: prefixFromCidr(cidr),
        mode: clean(port.mode || port.role),
        vlanRef: vlanRef || '',
        vlanId: vlan ? vlan.vlanId : null,
        vlanName: vlan ? clean(vlan.name) : '',
        subnetCidr: subnet ? clean(subnet.cidr) : '',
        peerDeviceName: peerDev ? clean(peerDev.name || peerDev.id) : '',
        peerPortName: peerPort ? clean(peerPort.name || peerPort.id) : ''
      });
    }
    return result.sort((a,b) => a.portName.localeCompare(b.portName));
  }

  function peerDescription(item){
    if(!item) return '';
    const peer = [item.peerDeviceName, item.peerPortName].filter(Boolean).join(' ');
    const vlan = item.vlanId ? `VLAN${item.vlanId}${item.vlanName ? ' '+item.vlanName : ''}` : '';
    return [peer ? `Transit to ${peer}` : 'Transit L3', vlan].filter(Boolean).join(' · ');
  }

  const api = { collectDeviceL3Interfaces, maskFromCidr, prefixFromCidr, peerDescription, linkTransitVlanRef };
  root.NetWizardL3ConfigUtils = api;
  if(typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
