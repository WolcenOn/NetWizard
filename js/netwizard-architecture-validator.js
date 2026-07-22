/* =========================================================
   NetWizard Architecture Validator v3.49-dev
   Reglas de coherencia arquitectónica independientes del vendor.
   Cargable en navegador clásico y en Node.js.
========================================================= */
(function initNetWizardArchitectureValidator(root){
  'use strict';

  function arr(v){ return Array.isArray(v) ? v : []; }
  function clean(v){ return String(v == null ? '' : v).trim(); }
  function tryRequire(p){ try { return require(p); } catch { return null; } }
  function auditCore(){ return root.NetWizardAudit || (typeof require === 'function' ? tryRequire('./netwizard-audit.js') : null); }

  function makeIssue(input){
    const audit = auditCore();
    const base = Object.assign({
      code:'NW-ARCH-000', severity:'warning', blocking:false,
      category:'architecture', source:'architecture-validator'
    }, input || {});
    if(audit && typeof audit.createIssue === 'function') return audit.createIssue(base);
    return base;
  }

  function endpointLabel(port, devicesById){
    const device = devicesById.get(port && port.deviceId);
    const deviceName = clean(device && device.name) || clean(port && port.deviceId) || 'dispositivo desconocido';
    const portName = clean(port && port.name) || clean(port && port.id) || 'puerto desconocido';
    return `${deviceName} / ${portName}`;
  }

  function normalizedMode(port){
    const mode = clean(port && (port.mode || port.role)).toLowerCase();
    return mode === 'l3' ? 'routed' : mode;
  }

  function ipOnly(value){
    const raw = clean(value);
    return raw ? raw.split('/')[0].trim() : '';
  }

  function isRoutingDevice(device){
    const type = clean(device && device.type).toLowerCase();
    const vendor = clean(device && device.vendorOs).toLowerCase();
    return ['router','firewall','l3switch','switch_l3'].includes(type) ||
      ['cisco_asa','fortinet','pfsense'].includes(vendor) ||
      clean(device && device.l3Capable).toLowerCase() === 'yes';
  }

  function routedDeviceEdges(project){
    const p = project || {};
    const portsById = new Map(arr(p.ports).map(port => [port.id, port]));
    const devicesById = new Map(arr(p.devices).map(device => [device.id, device]));
    const edges = [];
    for(const link of arr(p.links)){
      const a = portsById.get(link.aPortId || link.a);
      const b = portsById.get(link.bPortId || link.b);
      if(!a || !b || normalizedMode(a) !== 'routed' || normalizedMode(b) !== 'routed') continue;
      const da = devicesById.get(a.deviceId);
      const db = devicesById.get(b.deviceId);
      if(!isRoutingDevice(da) || !isRoutingDevice(db) || !da || !db || da.id === db.id) continue;
      edges.push({link, a, b, da, db});
    }
    return edges;
  }

  function validateLinkCompatibility(project){
    const p = project || {};
    const portsById = new Map(arr(p.ports).map(port => [port.id, port]));
    const devicesById = new Map(arr(p.devices).map(device => [device.id, device]));
    const issues = [];
    for(const link of arr(p.links)){
      const a = portsById.get(link.aPortId || link.a);
      const b = portsById.get(link.bPortId || link.b);
      if(!a || !b) continue;
      const aMode = normalizedMode(a), bMode = normalizedMode(b);
      if(!((aMode === 'trunk' && bMode === 'routed') || (aMode === 'routed' && bMode === 'trunk'))) continue;
      const aLabel = endpointLabel(a, devicesById), bLabel = endpointLabel(b, devicesById);
      issues.push(makeIssue({
        code:'NW-LINK-001', severity:'error', blocking:true, category:'layer2-layer3',
        title:'Extremos de enlace incompatibles',
        message:`El enlace ${clean(link.id) || '(sin id)'} conecta ${aLabel} (${aMode}) con ${bLabel} (${bMode}).`,
        why:'Un puerto trunk transporta tramas Ethernet etiquetadas 802.1Q, mientras que un puerto routed espera una interfaz de capa 3. Ambos extremos deben compartir el mismo modelo de enlace.',
        impact:'El enlace no puede proporcionar conectividad coherente y las VLAN o la red de tránsito pueden quedar inoperativas.',
        affectedObjects:[clean(link.id), clean(a.id), clean(b.id)].filter(Boolean),
        suggestions:[
          {label:'Convertir el enlace en tránsito L3', steps:[`Configura ${aLabel} y ${bLabel} como routed.`, 'Asigna a ambos extremos direcciones de la misma red /30 o /31.', 'Añade las rutas necesarias hacia las redes remotas.']},
          {label:'Usar trunk con subinterfaces', steps:[`Mantén ${aLabel} y ${bLabel} como trunk.`, 'Elimina la dirección IP directa de la interfaz física.', 'Crea subinterfaces 802.1Q o interfaces VLAN compatibles en el equipo que realizará routing.']}
        ]
      }));
    }
    return issues;
  }

  function validateDuplicateInterfaceIps(project){
    const p = project || {};
    const devicesById = new Map(arr(p.devices).map(device => [device.id, device]));
    const ownersByIp = new Map();
    const issues = [];
    for(const port of arr(p.ports)){
      const ip = ipOnly(port.l3Ip || port.routedIp || port.l3Cidr || port.routedCidr);
      if(!ip || ip === '0.0.0.0') continue;
      if(!ownersByIp.has(ip)) ownersByIp.set(ip, []);
      ownersByIp.get(ip).push(port);
    }
    for(const [ip, owners] of ownersByIp.entries()){
      if(owners.length < 2) continue;
      const labels = owners.map(port => endpointLabel(port, devicesById));
      issues.push(makeIssue({
        code:'NW-IP-001', severity:'error', blocking:true, category:'ip',
        title:'Dirección IP duplicada en interfaces',
        message:`La dirección ${ip} está asignada a ${labels.join(' y ')}.`,
        why:'Dos interfaces del mismo proyecto no deben utilizar la misma dirección IP dentro del mismo dominio de routing.',
        impact:'Puede provocar conflictos ARP, rutas inestables y pérdida intermitente o total de conectividad.',
        affectedObjects:owners.map(port => clean(port.id)).filter(Boolean),
        suggestions:[{label:'Asignar direcciones únicas', steps:['Identifica qué interfaz debe conservar la dirección.', 'Asigna a la otra interfaz una IP libre perteneciente a su subnet.', 'Revisa rutas, gateways y referencias que utilicen la dirección anterior.']}]
      }));
    }
    return issues;
  }

  function validateInternetEdges(project){
    const edges = arr(project && project.devices).filter(device => clean(device.internetEdge).toLowerCase() === 'yes' || device.internetEdge === true);
    if(edges.length <= 1) return [];
    const names = edges.map(device => clean(device.name) || clean(device.id) || 'dispositivo sin nombre');
    return [makeIssue({
      code:'NW-ARCH-002', severity:'warning', blocking:false, category:'architecture',
      title:'Varios bordes de Internet declarados',
      message:`Hay ${edges.length} dispositivos marcados como borde de Internet: ${names.join(', ')}.`,
      why:'Más de un borde puede ser válido con alta disponibilidad o multihoming, pero requiere declarar roles, prioridades y routing de salida explícitos.',
      impact:'Sin una arquitectura de redundancia definida, pueden generarse rutas por defecto, NAT o políticas contradictorias.',
      affectedObjects:edges.map(device => clean(device.id)).filter(Boolean),
      suggestions:[
        {label:'Mantener un único borde', steps:['Selecciona el firewall o router que conecta realmente con el ISP.', 'Desmarca internetEdge en los equipos internos.', 'Configura en los routers internos una ruta por defecto hacia el borde.']},
        {label:'Documentar redundancia o multihoming', steps:['Define el protocolo de redundancia o routing utilizado.', 'Asigna prioridades, tracking y rutas por defecto coherentes.', 'Verifica NAT y políticas en todos los bordes.']}
      ]
    })];
  }

  function declaredRoutingStrategy(project){
    const r = project && project.routing ? project.routing : {};
    const dynamic = project && project.dynamicRouting ? project.dynamicRouting : {};
    return clean(r.strategy || r.protocol || r.mode || dynamic.protocol || dynamic.mode).toLowerCase();
  }

  function validateRoutingStrategy(project){
    const p = project || {};
    const routingDevices = arr(p.devices).filter(isRoutingDevice);
    const edges = routedDeviceEdges(p);
    if(routingDevices.length < 3 || edges.length < 2) return [];
    const strategy = declaredRoutingStrategy(p);
    const explicitStatic = arr(p.staticRoutes).length > 0 || arr(p.routes).length > 0;
    if(strategy || explicitStatic) return [];
    return [makeIssue({
      code:'NW-ROUTE-001', severity:'error', blocking:true, category:'routing',
      title:'Estrategia de routing entre sedes no declarada',
      message:`La topología contiene ${routingDevices.length} equipos L3 y ${edges.length} enlaces enrutados, pero no declara rutas estáticas ni un protocolo dinámico.`,
      why:'Las interfaces /30 o /31 solo crean conectividad con el vecino directo. Las redes LAN remotas necesitan rutas conocidas por cada router.',
      impact:'Las sedes pueden alcanzar el siguiente salto, pero no las VLAN o subredes situadas detrás de otros routers.',
      affectedObjects:routingDevices.map(device => clean(device.id)).filter(Boolean),
      suggestions:[
        {label:'Usar OSPF para la red interna', steps:['Declara routing.protocol = "ospf".', 'Define un router-id único por dispositivo.', 'Publica únicamente redes LAN y enlaces de tránsito necesarios.', 'Haz pasivas las interfaces LAN y autentica las adyacencias cuando el vendor lo permita.']},
        {label:'Usar rutas estáticas controladas', steps:['Declara routing.strategy = "static".', 'Añade las redes remotas y su next hop en cada router.', 'Configura una ruta por defecto en las delegaciones hacia HQ.', 'Añade tracking o rutas flotantes si existe enlace de respaldo.']}
      ]
    })];
  }

  function validateRoutingResilience(project){
    const p = project || {};
    const edges = routedDeviceEdges(p);
    const deviceIds = new Set();
    const degree = new Map();
    for(const edge of edges){
      deviceIds.add(edge.da.id); deviceIds.add(edge.db.id);
      degree.set(edge.da.id, (degree.get(edge.da.id) || 0) + 1);
      degree.set(edge.db.id, (degree.get(edge.db.id) || 0) + 1);
    }
    if(deviceIds.size < 4 || edges.length !== deviceIds.size - 1) return [];
    const hub = Array.from(deviceIds).find(id => (degree.get(id) || 0) === deviceIds.size - 1);
    if(!hub) return [];
    const device = arr(p.devices).find(d => d.id === hub);
    const name = clean(device && device.name) || hub;
    return [makeIssue({
      code:'NW-HA-001', severity:'warning', blocking:false, category:'availability',
      title:'Punto único de fallo en el núcleo de routing',
      message:`${name} concentra todos los enlaces L3 hacia los otros ${deviceIds.size - 1} equipos de routing y no existe un camino alternativo.`,
      why:'Una topología hub-and-spoke simple es funcional, pero la caída del hub aísla simultáneamente todas las sedes.',
      impact:'Un único fallo de router, alimentación, interfaz o mantenimiento puede interrumpir conectividad WAN, acceso a servicios e Internet.',
      affectedObjects:[hub],
      suggestions:[
        {label:'Añadir redundancia de núcleo', steps:['Incorpora un segundo router o firewall de núcleo.', 'Distribuye enlaces de sedes entre ambos equipos o añade enlaces de respaldo.', 'Usa OSPF con costes coherentes, ECMP cuando proceda y convergencia probada.']},
        {label:'Añadir respaldo por sede', steps:['Crea un segundo enlace WAN, VPN o SD-WAN.', 'Configura tracking de salud y rutas de mayor distancia administrativa.', 'Prueba la conmutación y la recuperación sin intervención manual.']}
      ]
    })];
  }

  function validate(project){
    const issues = []
      .concat(validateLinkCompatibility(project))
      .concat(validateDuplicateInterfaceIps(project))
      .concat(validateInternetEdges(project))
      .concat(validateRoutingStrategy(project))
      .concat(validateRoutingResilience(project));
    return {
      ok: !issues.some(issue => issue.blocking || issue.severity === 'error'),
      issues,
      errors: issues.filter(issue => issue.severity === 'error').map(issue => `[${issue.code}] ${issue.message}`),
      warnings: issues.filter(issue => issue.severity === 'warning').map(issue => `[${issue.code}] ${issue.message}`)
    };
  }

  const api = {
    version:'netwizard-architecture-validator-v3', validate,
    validateLinkCompatibility, validateDuplicateInterfaceIps, validateInternetEdges,
    validateRoutingStrategy, validateRoutingResilience, routedDeviceEdges
  };
  root.NetWizardArchitectureValidator = api;
  if(typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
