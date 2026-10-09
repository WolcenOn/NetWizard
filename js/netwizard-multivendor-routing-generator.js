/* =========================================================
   NetWizard Multivendor Routing Generator v0.1
   Traduce el plan neutral a Junos, Huawei VRP y MikroTik RouterOS v7.
   No calcula topología ni modifica el proyecto.
========================================================= */
(function initNetWizardMultivendorRoutingGenerator(root){
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

  function parsed(cidr){
    const NWU = networkUtils();
    return NWU && NWU.parseCidr ? NWU.parseCidr(cidr) : null;
  }

  function ip4(value){
    const NWU = networkUtils();
    return NWU && NWU.ip4s ? NWU.ip4s(value >>> 0) : [value>>>24&255,value>>>16&255,value>>>8&255,value&255].join('.');
  }

  function networkFor(cidr){ const p = parsed(cidr); return p ? ip4(p.net) : ''; }
  function maskFor(cidr){ const p = parsed(cidr); return p ? ip4(p.mask) : ''; }
  function wildcardFor(cidr){ const p = parsed(cidr); return p ? ip4((~p.mask) >>> 0) : ''; }

  function interfaceForNetwork(plan, cidr){
    const target = parsed(cidr);
    if(!target) return '';
    const match = arr(plan && plan.interfaces).find(iface => {
      const p = parsed(iface.cidr);
      return p && p.net === target.net && p.pfx === target.pfx;
    });
    return clean(match && match.name);
  }

  function renderJunos(plan){
    const lines = [];
    if(plan.strategy === 'static'){
      arr(plan.staticRoutes).forEach(route => {
        if(clean(route.destination) && clean(route.nextHop)){
          lines.push(`set routing-options static route ${clean(route.destination)} next-hop ${clean(route.nextHop)}`);
          const distance=Number(route.distance);if(route.source==='explicit'&&Number.isInteger(distance))lines.push(`set routing-options static route ${clean(route.destination)} preference ${distance}`);
        }
      });
    }else if(plan.strategy === 'ospf' && plan.ospf){
      if(clean(plan.ospf.routerId)) lines.push(`set routing-options router-id ${clean(plan.ospf.routerId)}`);
      arr(plan.ospf.networks).forEach(network => {
        const iface = clean(network.portName) || interfaceForNetwork(plan, network.cidr);
        if(!iface) return;
        const area = clean(network.area || plan.ospf.area || '0.0.0.0');
        lines.push(`set protocols ospf area ${area} interface ${iface}`);
        if(network.passive) lines.push(`set protocols ospf area ${area} interface ${iface} passive`);
        const cost=Number(network.cost);if(Number.isInteger(cost)) lines.push(`set protocols ospf area ${area} interface ${iface} metric ${cost}`);
      });
    }
    return lines;
  }

  function renderHuawei(plan){
    const lines = [];
    if(plan.strategy === 'static'){
      arr(plan.staticRoutes).forEach(route => {
        const network = clean(route.network) || networkFor(route.destination);
        const mask = clean(route.mask) || maskFor(route.destination);
        if(network && mask && clean(route.nextHop)){const distance=Number(route.distance),suffix=route.source==='explicit'&&Number.isInteger(distance)?` preference ${distance}`:'';lines.push(`ip route-static ${network} ${mask} ${clean(route.nextHop)}${suffix}`);}
      });
    }else if(plan.strategy === 'ospf' && plan.ospf){
      const processId = Number(plan.ospf.processId || 1);
      lines.push(`ospf ${processId}${clean(plan.ospf.routerId) ? ` router-id ${clean(plan.ospf.routerId)}` : ''}`);
      const areas = new Map();
      arr(plan.ospf.networks).forEach(network => {
        const area = clean(network.area || plan.ospf.area || '0.0.0.0');
        if(!areas.has(area)) areas.set(area, []);
        const net = networkFor(network.cidr), wc = wildcardFor(network.cidr);
        if(net && wc) areas.get(area).push({net,wc,passive:!!network.passive,iface:clean(network.portName) || interfaceForNetwork(plan, network.cidr)});
      });
      for(const [area, networks] of areas){
        lines.push(` area ${area}`);
        networks.forEach(n => lines.push(`  network ${n.net} ${n.wc}`));
        lines.push(' quit');
      }
      if(plan.ospf.passiveDefault) lines.push(' silent-interface all');
      arr(plan.ospf.networks).filter(n => n.passive === false).forEach(network => {
        const iface = clean(network.portName) || interfaceForNetwork(plan, network.cidr);
        if(iface) lines.push(` undo silent-interface ${iface}`);
      });
      lines.push('quit');
      arr(plan.ospf.interfaces).forEach(iface=>{
        const cost=Number(iface.cost);if(!iface.enabled||!clean(iface.portName)||!Number.isInteger(cost))return;
        lines.push(`interface ${clean(iface.portName)}`,` ospf cost ${cost}`,'quit');
      });
    }
    return lines;
  }

  function renderMikrotik(plan){
    const lines = [];
    if(plan.strategy === 'static'){
      arr(plan.staticRoutes).forEach(route => {
        if(clean(route.destination) && clean(route.nextHop)){const distance=Number(route.distance),suffix=route.source==='explicit'&&Number.isInteger(distance)?` distance=${distance}`:'';lines.push(`/ip/route/add dst-address=${clean(route.destination)} gateway=${clean(route.nextHop)}${suffix} comment="NetWizard neutral routing"`);}
      });
    }else if(plan.strategy === 'ospf' && plan.ospf){
      const instance = `nw-ospf-${Number(plan.ospf.processId || 1)}`;
      const area = 'nw-backbone';
      lines.push(`/routing/ospf/instance/add name=${instance} version=2${clean(plan.ospf.routerId) ? ` router-id=${clean(plan.ospf.routerId)}` : ''}`);
      lines.push(`/routing/ospf/area/add name=${area} instance=${instance} area-id=${clean(plan.ospf.area || '0.0.0.0')}`);
      arr(plan.ospf.networks).forEach(network => {
        if(!clean(network.cidr)) return;
        const cost=Number(network.cost),costArg=Number.isInteger(cost)?` cost=${cost}`:'';
        lines.push(`/routing/ospf/interface-template/add area=${area} networks=${clean(network.cidr)} passive=${network.passive ? 'yes' : 'no'}${costArg} comment="NetWizard neutral routing"`);
      });
    }
    return lines;
  }

  function localeOf(options){ const explicit=options&&options.locale; if(String(explicit||'').trim())return String(explicit).trim().toLowerCase()==='en'?'en':'es'; const i18n=root.NetWizardI18n; return i18n&&typeof i18n.getReportLocale==='function'&&i18n.getReportLocale()==='en'?'en':'es'; }
  function pick(options,es,en){ return localeOf(options)==='en'?en:es; }
  function markerFor(){ return '# NW-ROUTING'; }

  function render(project, deviceId, vendor, suppliedPlan, options){
    const plan = devicePlan(project, deviceId, suppliedPlan);
    if(!plan) return '';
    let lines = [];
    if(vendor === 'juniper_junos') lines = renderJunos(plan);
    else if(vendor === 'huawei_vrp') lines = renderHuawei(plan);
    else if(vendor === 'mikrotik_routeros') lines = renderMikrotik(plan);
    if(!lines.length) return '';
    return [markerFor(), '# '+pick(options,'Instala rutas estáticas u OSPF derivados del modelo; revisa next-hop, interfaces y métricas antes de aplicar.','Installs static routes or OSPF derived from the model; review next hops, interfaces, and metrics before applying.'), ...lines].join('\n');
  }

  function appendToConfig(config, project, deviceId, vendor, suppliedPlan, options){
    const block = render(project, deviceId, vendor, suppliedPlan, options);
    if(!block) return String(config || '');
    const text = String(config || '');
    if(text.includes(markerFor())) return text;
    if(vendor === 'juniper_junos'){
      const commitIndex = text.lastIndexOf('\ncommit');
      if(commitIndex >= 0) return text.slice(0, commitIndex) + '\n' + block + text.slice(commitIndex);
    }
    if(vendor === 'huawei_vrp'){
      const saveIndex = text.lastIndexOf('\nsave');
      if(saveIndex >= 0) return text.slice(0, saveIndex) + '\n' + block + text.slice(saveIndex);
    }
    return text.replace(/\s*$/, '') + '\n' + block + '\n';
  }

  const api = {
    version:'netwizard-multivendor-routing-generator-v1',
    render, appendToConfig, renderJunos, renderHuawei, renderMikrotik,
    networkFor, maskFor, wildcardFor, interfaceForNetwork
  };
  root.NetWizardMultivendorRoutingGenerator = api;
  if(typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
