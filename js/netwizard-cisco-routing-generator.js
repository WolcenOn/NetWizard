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
      const distance=Number(route.distance),suffix=route.source==='explicit'&&Number.isInteger(distance)?` ${distance}`:'';
      lines.push(`ip route ${route.network} ${route.mask} ${route.nextHop}${suffix}`);
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
    for(const iface of arr(ospf.interfaces)){
      if(!iface.enabled||!clean(iface.portName)||!Number.isInteger(Number(iface.cost))) continue;
      lines.push(`interface ${clean(iface.portName)}`,` ip ospf cost ${Number(iface.cost)}`,' exit');
    }
    return lines;
  }

  function localeOf(options){ const explicit=options&&options.locale; if(String(explicit||'').trim())return String(explicit).trim().toLowerCase()==='en'?'en':'es'; const i18n=root.NetWizardI18n; return i18n&&typeof i18n.getReportLocale==='function'&&i18n.getReportLocale()==='en'?'en':'es'; }
  function pick(options,es,en){ return localeOf(options)==='en'?en:es; }

  function render(project, deviceId, suppliedPlan, options){
    const plan = devicePlan(project, deviceId, suppliedPlan);
    if(!plan) return '';
    const lines = [];
    if(plan.strategy === 'static') lines.push(...renderStatic(plan));
    else if(plan.strategy === 'ospf') lines.push(...renderOspf(plan));
    if(!lines.length) return '';
    return ['!','! NW-ROUTING — '+pick(options,'instala rutas estáticas u OSPF calculados desde el modelo; revisa next-hop, interfaces y métricas antes de aplicar.','installs static routes or OSPF derived from the model; review next hops, interfaces, and metrics before applying.'),...lines].join('\n');
  }

  function appendToConfig(config, project, deviceId, suppliedPlan, options){
    const block = render(project, deviceId, suppliedPlan, options);
    if(!block) return config || '';
    const text = String(config || '');
    const marker = '! NW-ROUTING';
    if(text.includes(marker)) return text;
    const endIndex = text.lastIndexOf('\nend');
    if(endIndex >= 0) return text.slice(0,endIndex) + '\n' + block + text.slice(endIndex);
    return text.replace(/\s*$/, '') + '\n' + block + '\n';
  }

  const api = {version:'netwizard-cisco-routing-generator-v1', render, renderStatic, renderOspf, appendToConfig, wildcardFor};
  root.NetWizardCiscoRoutingGenerator = api;
  if(typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
