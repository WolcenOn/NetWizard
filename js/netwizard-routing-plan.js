/* =========================================================
   NetWizard Routing Plan v0.1
   Construye un plan neutral de routing antes de traducirlo a vendors.
   No genera CLI ni modifica el proyecto.
========================================================= */
(function initNetWizardRoutingPlan(root){
  'use strict';

  function arr(v){ return Array.isArray(v) ? v : []; }
  function obj(v){ return v && typeof v === 'object' && !Array.isArray(v) ? v : {}; }
  function clean(v){ return String(v == null ? '' : v).trim(); }
  function tryRequire(p){ try { return require(p); } catch { return null; } }
  function routingUtils(){ return root.NetWizardRoutingUtils || (typeof require === 'function' ? tryRequire('./netwizard-routing-utils.js') : null); }

  function strategyFor(project){
    const r = obj(project && project.routing);
    return clean(r.protocol || r.strategy || r.mode).toLowerCase();
  }

  function isRoutingDevice(device){
    const type = clean(device && device.type).toLowerCase();
    const vendor = clean(device && device.vendorOs).toLowerCase();
    return ['router','firewall','l3switch','switch_l3'].includes(type) || ['fortinet','pfsense','cisco_asa'].includes(vendor) || clean(device && device.l3Capable).toLowerCase() === 'yes';
  }

  function ipOnly(value){
    const raw = clean(value);
    return raw ? raw.split('/')[0].trim() : '';
  }

  function connectedInterfaces(project, deviceId){
    return arr(project && project.ports)
      .filter(port => port && port.deviceId === deviceId && clean(port.mode || port.role).toLowerCase() === 'routed')
      .map(port => ({
        portId:clean(port.id),
        name:clean(port.name || port.id),
        ip:ipOnly(port.l3Ip || port.routedIp || port.l3Cidr || port.routedCidr),
        cidr:clean(port.l3Cidr || port.routedCidr),
        role:clean(port.role),
        passive:false
      }))
      .filter(item => item.ip && item.cidr);
  }

  function routerIdFor(project, device, interfaces){
    const r = obj(project && project.routing);
    const explicit = obj(r.routerIds)[device.id] || device.routerId;
    if(clean(explicit)) return clean(explicit);
    const loopback = arr(project && project.ports).find(port => port && port.deviceId === device.id && /loopback/i.test(clean(port.name)) && ipOnly(port.l3Ip || port.l3Cidr));
    if(loopback) return ipOnly(loopback.l3Ip || loopback.l3Cidr);
    return interfaces.length ? interfaces.map(item => item.ip).sort().slice(-1)[0] : '';
  }

  function buildDevicePlan(project, device, strategy){
    const RU = routingUtils();
    const interfaces = connectedInterfaces(project, device.id);
    const localNetworks = RU && RU.collectLocalNetworks ? RU.collectLocalNetworks(project, device.id, {includeTransit:true}) : [];
    const base = {
      deviceId:device.id,
      deviceName:clean(device.name || device.id),
      vendorOs:clean(device.vendorOs),
      strategy,
      interfaces,
      localNetworks,
      staticRoutes:[],
      ospf:null,
      warnings:[]
    };

    if(strategy === 'static'){
      base.staticRoutes = RU && RU.inferStaticRoutes ? RU.inferStaticRoutes(project, device.id) : [];
      if(!base.staticRoutes.length && interfaces.length > 1) base.warnings.push('No se pudieron inferir rutas estáticas hacia redes remotas.');
      return base;
    }

    if(strategy === 'ospf'){
      const routing = obj(project && project.routing);
      const area = clean(routing.area || routing.ospfArea || '0');
      const routerId = routerIdFor(project, device, interfaces);
      base.ospf = {
        processId:Number(routing.processId || 1),
        area,
        routerId,
        passiveDefault:routing.passiveDefault !== false,
        networks:localNetworks.map(network => ({
          cidr:network.cidr,
          area,
          passive:network.type === 'local-vlan',
          source:network.source || network.type || ''
        }))
      };
      if(!routerId) base.warnings.push('No se pudo determinar router-id; define routing.routerIds para este dispositivo.');
      if(!base.ospf.networks.length) base.warnings.push('No hay redes conectadas que anunciar por OSPF.');
      return base;
    }

    base.warnings.push('Estrategia de routing no soportada por el plan neutral.');
    return base;
  }

  function build(project){
    const p = project || {};
    const strategy = strategyFor(p);
    const devices = arr(p.devices).filter(isRoutingDevice);
    const plans = devices.map(device => buildDevicePlan(p, device, strategy));
    const warnings = [];
    if(!['static','ospf'].includes(strategy)) warnings.push('Declara routing.strategy como "static" o routing.protocol como "ospf".');
    plans.forEach(plan => plan.warnings.forEach(message => warnings.push(`${plan.deviceName}: ${message}`)));
    return {
      version:'netwizard-routing-plan-v1',
      strategy,
      ok:['static','ospf'].includes(strategy) && !plans.some(plan => !plan.interfaces.length && plan.localNetworks.length),
      devices:plans,
      warnings
    };
  }

  const api = {version:'netwizard-routing-plan-v1', build, buildDevicePlan, strategyFor, connectedInterfaces, routerIdFor};
  root.NetWizardRoutingPlan = api;
  if(typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
