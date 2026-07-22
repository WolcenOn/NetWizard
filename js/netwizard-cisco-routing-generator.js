/* =========================================================
   NetWizard Cisco Routing Generator v0.1
   Traduce el plan neutral de routing a Cisco IOS.
   No calcula topología: solo transforma un plan ya construido.
========================================================= */
(function initNetWizardCiscoRoutingGenerator(root){
  'use strict';

  function arr(v){ return Array.isArray(v) ? v : []; }
  function clean(v){ return String(v == null ? '' : v).trim(); }
  function tryRequire(p){ try { return require(p); } catch { return null; } }
  function routingPlan(){ return root.NetWizardRoutingPlan || (typeof require === 'function' ? tryRequire('./netwizard-routing-plan.js') : null); }
  function networkUtils(){ return root.NetWizardNetworkUtils || (typeof require === 'function' ? tryRequire('./netwizard-network-utils.js') : null); }

  function devicePlan(project, deviceId, suppliedPlan){
    const plan = suppliedPlan || (routingPlan() && routingPlan().build ? routingPlan().build(project || {}) : null);
    return plan && arr(plan.devices).find(item => item.deviceId === deviceId) || null;
  }

  function wildcardFor(cidr){
    const NWU = networkUtils();
    const parsed = NWU && NWU.parseCidr ? NWU.parseCidr(cidr) : null;
    if(!parsed) return '';
    const wildcard = (~parsed.mask) >>> 0;
    return NWU.ip4s ? NWU.ip4s(wildcard) : [wildcard>>>24&255,wildcard>>>16&255,wildcard>>>8&255,wildcard&255].join('.');
  }

  function renderStatic(plan){
    const lines = [];
    for(const route of arr(plan && plan.staticRoutes)){
      if(!clean(route.network) || !clean(route.mask) || !clean(route.nextHop)) continue;
      lines.push(`ip route ${route.network} ${route.mask} ${route.nextHop}`);
    }
    return lines;
  }

  function renderOspf(plan){
    const ospf = plan && plan.ospf;
    if(!ospf) return [];
    const lines = [`router ospf ${Number(ospf.processId || 1)}`];
    if(clean(ospf.routerId)) lines.push(` router-id ${clean(ospf.routerId)}`);
    if(ospf.passiveDefault) lines.push(' passive-interface default');

    const activePorts = new Set();
    for(const network of arr(ospf.networks)){
      const wildcard = wildcardFor(network.cidr);
      const NWU = networkUtils();
      const parsed = NWU && NWU.parseCidr ? NWU.parseCidr(network.cidr) : null;
      if(!parsed || !wildcard) continue;
      const networkIp = NWU.ip4s ? NWU.ip4s(parsed.net) : clean(network.cidr).split('/')[0];
      lines.push(` network ${networkIp} ${wildcard} area ${clean(network.area || ospf.area || '0')}`);
      if(network.passive === false && clean(network.portName)) activePorts.add(clean(network.portName));
    }
    for(const portName of activePorts) lines.push(` no passive-interface ${portName}`);
    lines.push(' exit');
    return lines;
  }

  function render(project, deviceId, suppliedPlan){
    const plan = devicePlan(project, deviceId, suppliedPlan);
    if(!plan) return '';
    const lines = [];
    if(plan.strategy === 'static') lines.push(...renderStatic(plan));
    else if(plan.strategy === 'ospf') lines.push(...renderOspf(plan));
    if(!lines.length) return '';
    return ['!','! Routing generado desde plan neutral',...lines].join('\n');
  }

  function appendToConfig(config, project, deviceId, suppliedPlan){
    const block = render(project, deviceId, suppliedPlan);
    if(!block) return config || '';
    const text = String(config || '');
    const marker = '! Routing generado desde plan neutral';
    if(text.includes(marker)) return text;
    const endIndex = text.lastIndexOf('\nend');
    if(endIndex >= 0) return text.slice(0,endIndex) + '\n' + block + text.slice(endIndex);
    return text.replace(/\s*$/, '') + '\n' + block + '\n';
  }

  const api = {version:'netwizard-cisco-routing-generator-v1', render, renderStatic, renderOspf, appendToConfig, wildcardFor};
  root.NetWizardCiscoRoutingGenerator = api;
  if(typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
