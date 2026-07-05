#!/usr/bin/env node
'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.resolve(__dirname, '..');
const NWCore = require(path.join(root, 'js', 'netwizard-core-utils.js'));
const NWU = require(path.join(root, 'js', 'netwizard-network-utils.js'));
const NWSchema = require(path.join(root, 'js', 'netwizard-project-schema.js'));
const NWA = require(path.join(root, 'js', 'netwizard-audit.js'));
const NWDH = require(path.join(root, 'js', 'netwizard-dhcp-utils.js'));
const NWCAB = require(path.join(root, 'js', 'netwizard-cabling-utils.js'));
const NWPOE = require(path.join(root, 'js', 'netwizard-poe-utils.js'));
const NWBCAST = require(path.join(root, 'js', 'netwizard-broadcast-utils.js')); 
const NWL2 = require(path.join(root, 'js', 'netwizard-l2-utils.js'));

function test(name, fn){
  try { fn(); console.log(`✓ ${name}`); }
  catch (err) { console.error(`✗ ${name}`); throw err; }
}



test('Audit core normaliza incidencias, resume y eleva políticas de producción', () => {
  const issues = [
    NWA.createIssue({code:'NW-VLAN-001', severity:'warning', category:'design', message:'VLAN 10 sin subnet'}),
    NWA.createIssue({code:'NW-OK-001', severity:'info', message:'Info'})
  ];
  const prod = NWA.applyProductionPolicy(issues);
  assert.ok(prod.some(i => i.code === 'NW-VLAN-001' && i.severity === 'error' && i.blocking));
  const split = NWA.splitIssues(prod);
  assert.strictEqual(split.ok, false);
  assert.ok(split.errors.some(e => e.includes('[NW-VLAN-001]')));
  assert.ok(NWA.summarizeIssues(prod).includes('NW-VLAN-001'));
});


test('Project schema sanea texto, migra legacy y exporta payload versionado', () => {
  const defaults = () => ({ devices:[], ports:[], vlans:[], subnets:[], hosts:[], links:[], fwRules:[], vlanMatrix:{}, dhcp:{}, security:{}, roas:{}, vtp:{roles:{}}, topo:{pos:{}}, visual:{locs:[],assign:{devices:{},hosts:{}},pos:{},view:{}}, iot:{accessNodes:[],devices:[],map:{show:{}}}, physicalLocations:[], hostPhysicalLocations:[], uiSort:{} });
  const raw = { projName:'  Demo\u0000  ', devices:[{id:'sw 1', name:'  SW<Core>  ', type:'switch'}], vlans:[{id:'v10', vlanId:'10', name:'Users'}] };
  const prepared = NWSchema.prepareImport(raw, { defaults });
  assert.strictEqual(prepared.ok, true);
  assert.strictEqual(prepared.project._schemaVersion, '3.48.0');
  assert.strictEqual(prepared.project.projName, 'Demo');
  assert.strictEqual(prepared.project.devices[0].id, 'sw_1');
  assert.strictEqual(prepared.project.devices[0].name, 'SW<Core>');
  assert.ok(prepared.migrations.includes('legacy->3.48.0'));
  const exported = NWSchema.prepareExport(prepared.project, { defaults });
  assert.strictEqual(exported.format, 'netwizard-project');
  assert.strictEqual(exported.schemaVersion, '3.48.0');
  assert.ok(exported.project.iot);
});

test('Project schema bloquea referencias críticas inválidas en importación', () => {
  const defaults = () => ({ devices:[], ports:[], vlans:[], subnets:[], hosts:[], links:[], fwRules:[], vlanMatrix:{}, dhcp:{}, security:{}, roas:{}, vtp:{roles:{}}, topo:{pos:{}}, visual:{locs:[],assign:{devices:{},hosts:{}},pos:{},view:{}}, iot:{accessNodes:[],devices:[],map:{show:{}}}, physicalLocations:[], hostPhysicalLocations:[], uiSort:{} });
  const raw = { devices:[], ports:[{id:'p1', deviceId:'missing', name:'Gi0/1'}], vlans:[], subnets:[], hosts:[], links:[] };
  const prepared = NWSchema.prepareImport(raw, { defaults });
  assert.strictEqual(prepared.ok, false);
  assert.ok(prepared.errors.some(e => e.includes('deviceId inexistente')));
});

test('NetWizardCoreUtils expone helpers puros reutilizables', () => {
  assert.strictEqual(NWCore.cleanStr('  hola  '), 'hola');
  assert.strictEqual(NWCore.escapeHtml('<b>&"'), '&lt;b&gt;&amp;&quot;');
  assert.deepStrictEqual(NWCore.parseAllowed('10, 20, 20, x, 4095, 1'), [1,10,20]);
  assert.strictEqual(NWCore.buildPortName('cisco_ios', 'GE', 3, ''), 'GigabitEthernet0/3');
  assert.strictEqual(NWCore.safeCliText('desc\nconfigure terminal'), 'desc configure terminal');
  assert.strictEqual(NWCore.safeCliToken('SW Core 1; reload', 'dev'), 'SW_Core_1_reload');
});

test('normalizeProjectShape rellena ramas obligatorias sin pisar datos existentes', () => {
  const defaults = () => ({ vtp:{domain:'',password:'',version:'2',pruning:'no',roles:{}}, visual:{locs:[],assign:{devices:{},hosts:{}},pos:{},view:{px:60,py:50,zoom:1},sel:null}, iot:{accessNodes:[],devices:[],map:{show:{network:true},scale:1,panX:0,panY:0}} });
  const normalized = NWCore.normalizeProjectShape({ projName:'X', iot:{ devices:[{id:'iot1'}] } }, defaults);
  assert.strictEqual(normalized.projName, 'X');
  assert.deepStrictEqual(normalized.iot.devices, [{id:'iot1'}]);
  assert.deepStrictEqual(normalized.iot.accessNodes, []);
  assert.ok(normalized.visual.assign.devices);
  assert.ok(normalized.vtp.roles);
});



test('Cabling utils valida longitudes según medio y categoría', () => {
  assert.strictEqual(NWCAB.maxLengthM({medium:'copper', cableType:'cat6', speed:'1G'}), 100);
  assert.strictEqual(NWCAB.maxLengthM({medium:'copper', cableType:'cat6', speed:'10G'}), 55);
  assert.strictEqual(NWCAB.maxLengthM({medium:'dac', speed:'10G'}), 7);
  const project = {
    devices:[{id:'sw1',name:'SW1',type:'switch'}, {id:'sw2',name:'SW2',type:'switch'}],
    ports:[{id:'p1',deviceId:'sw1',name:'Gi0/1',media:'GE'}, {id:'p2',deviceId:'sw2',name:'Gi0/1',media:'GE'}],
    links:[{id:'l1',aPortId:'p1',bPortId:'p2',medium:'copper',cableType:'cat6',speed:'1G',lengthM:120}]
  };
  const audit = NWCAB.validateCabling(project);
  assert.strictEqual(audit.ok, true);
  assert.ok(audit.warnings.some(w => w.includes('supera el máximo')));
});



test('PoE utils detecta consumo superior a puerto y presupuesto de switch', () => {
  const project = {
    devices:[{id:'sw1', name:'SW1', type:'switch', poeBudgetW:20}],
    ports:[{id:'p1', deviceId:'sw1', name:'Gi0/1', media:'GE', poeMode:'af'}],
    hosts:[{id:'h1', name:'AP1', type:'ap', portRef:'p1', poeWatts:18}]
  };
  const audit = NWPOE.validatePoe(project);
  assert.strictEqual(audit.ok, false);
  assert.ok(audit.errors.some(e => e.includes('soporta 15.4 W')));
});

test('PoE utils detecta presupuesto total insuficiente del equipo', () => {
  const project = {
    devices:[{id:'sw1', name:'SW1', type:'switch', poeBudgetW:25}],
    ports:[
      {id:'p1', deviceId:'sw1', name:'Gi0/1', media:'GE', poeMode:'at'},
      {id:'p2', deviceId:'sw1', name:'Gi0/2', media:'GE', poeMode:'at'}
    ],
    hosts:[
      {id:'h1', name:'CAM1', type:'camera', portRef:'p1', poeWatts:12},
      {id:'h2', name:'AP1', type:'ap', portRef:'p2', poeWatts:18}
    ]
  };
  const audit = NWPOE.validatePoe(project);
  assert.strictEqual(audit.ok, false);
  assert.ok(audit.errors.some(e => e.includes('presupuesto del equipo')));
});

test('parseIp acepta 0.0.0.0 y 255.255.255.255', () => {
  assert.strictEqual(NWU.parseIp('0.0.0.0'), 0);
  assert.strictEqual(NWU.parseIp('255.255.255.255'), 4294967295);
});

test('ipInSn no falla con IP numérica 0', () => {
  assert.strictEqual(NWU.ipInSn('0.0.0.0', '0.0.0.0/0'), true);
  assert.strictEqual(NWU.ipInSn('10.0.0.5', '10.0.0.0/24'), true);
  assert.strictEqual(NWU.ipInSn('10.0.1.5', '10.0.0.0/24'), false);
});

test('parseCidr normaliza la dirección de red', () => {
  const c = NWU.parseCidr('10.10.10.25/24');
  assert.strictEqual(c.cidr, '10.10.10.0/24');
  assert.strictEqual(NWU.ip4s(c.net), '10.10.10.0');
  assert.strictEqual(NWU.ip4s(c.bc), '10.10.10.255');
});

test('cidrOverlaps detecta solapamientos reales y no falsos positivos', () => {
  assert.strictEqual(NWU.cidrOverlaps('10.0.0.0/24', '10.0.0.128/25'), true);
  assert.strictEqual(NWU.cidrOverlaps('10.0.0.0/24', '10.0.1.0/24'), false);
});

test('validateSubnetAssignment bloquea gateways fuera de rango, red/broadcast y solapamientos', () => {
  const subnets = [{ id: 'sn10', vlanRef: 'v10', cidr: '10.0.0.0/24', gateway: '10.0.0.1' }];
  assert.strictEqual(NWU.validateSubnetAssignment({ vlanRef:'v20', cidr:'10.0.1.0/24', gateway:'10.0.2.1' }, subnets).code, 'gateway_outside_subnet');
  assert.strictEqual(NWU.validateSubnetAssignment({ vlanRef:'v20', cidr:'10.0.1.0/24', gateway:'10.0.1.255' }, subnets).code, 'gateway_reserved');
  assert.strictEqual(NWU.validateSubnetAssignment({ vlanRef:'v20', cidr:'10.0.0.128/25', gateway:'10.0.0.129' }, subnets).code, 'subnet_overlap');
  const ok = NWU.validateSubnetAssignment({ vlanRef:'v20', cidr:'10.0.1.10/24', gateway:'10.0.1.1' }, subnets);
  assert.strictEqual(ok.ok, true);
  assert.strictEqual(ok.cidr, '10.0.1.0/24');
});

function loadBridgeWithProject(project){
  const context = {
    console,
    Date,
    JSON,
    structuredClone: global.structuredClone,
    localStorage: { setItem(){}, getItem(){ return null; } },
    Blob: function(){},
    URL: { createObjectURL(){ return 'blob:test'; }, revokeObjectURL(){} },
    document: { createElement(){ return { click(){}, remove(){}, set href(v){}, set download(v){} }; }, body:{ appendChild(){} } },
    CustomEvent: function(type, init){ return { type, detail:init && init.detail }; },
    window: {
      NetWizardState: { getSnapshot: () => JSON.parse(JSON.stringify(project)) },
      dispatchEvent(){}
    }
  };
  vm.createContext(context);
  const bridgeCode = fs.readFileSync(path.join(root, 'js', 'netwizard-bridge.js'), 'utf8');
  vm.runInContext(bridgeCode, context, { filename: 'netwizard-bridge.js' });
  return context.window.NetWizardBridge;
}

test('NetWizardBridge lee desde NetWizardState y genera grafo con IoT', () => {
  const project = {
    projName: 'Test',
    vlans: [{ id:'v10', vlanId:10, name:'LAN' }],
    subnets: [{ id:'sn10', vlanRef:'v10', cidr:'10.0.10.0/24', gateway:'10.0.10.1' }],
    devices: [{ id:'sw1', name:'SW1', type:'switch' }],
    ports: [{ id:'p1', deviceId:'sw1', name:'Gi0/1', mode:'access', accessVlanRef:'v10' }],
    hosts: [{ id:'h1', name:'PC1', type:'pc', vlanRef:'v10', portRef:'p1', ipMode:'static', staticIp:'10.0.10.10' }],
    links: [],
    iot: {
      accessNodes: [{ id:'ia1', name:'MQTT GW', type:'mqtt_gateway', parentDeviceId:'sw1', parentPortId:'p1' }],
      devices: [{ id:'id1', name:'Temp 1', type:'sensor', accessNodeId:'ia1', protocol:'mqtt' }]
    }
  };
  const bridge = loadBridgeWithProject(project);
  const snap = bridge.getProjectSnapshot();
  assert.strictEqual(snap.ok, true);
  assert.strictEqual(snap.project.iot.devices.length, 1);
  const graph = bridge.makeUnifiedGraph();
  assert.strictEqual(graph.ok, true);
  assert.ok(graph.nodes.some(n => n.id === 'ia1' && n.kind === 'iot_access'));
  assert.ok(graph.nodes.some(n => n.id === 'id1' && n.kind === 'iot_device'));
  assert.ok(graph.links.some(l => l.from === 'ia1' && l.to === 'id1')); 
});


const NWH = require(path.join(root, 'js', 'netwizard-history.js'));

test('History resume proyectos y mantiene metadatos de snapshot', () => {
  const summary = NWH.projectSummary({
    devices:[{}], ports:[{},{}], vlans:[{}], subnets:[{}], hosts:[{},{}], links:[{}], iot:{devices:[{}]}
  });
  assert.deepStrictEqual(summary, {devices:1, ports:2, vlans:1, subnets:1, hosts:2, links:1, iotDevices:1});
});

const NWP = require(path.join(root, 'js', 'netwizard-vlsm-physical-planner.js'));

test('VLSM calcula prefijos mínimos y asigna bloques sin solaparlos', () => {
  assert.strictEqual(NWP.prefixForHosts(1), 30);
  assert.strictEqual(NWP.prefixForHosts(60), 26);
  assert.strictEqual(NWP.usableHostsForPrefix(24), 254);
  const plan = NWP.buildVlsmPlan('10.0.0.0/24', [
    {vlanRef:'v10', vlanId:10, name:'Users', hostsRequired:50},
    {vlanRef:'v20', vlanId:20, name:'Servers', hostsRequired:10},
    {vlanRef:'v30', vlanId:30, name:'Mgmt', hostsRequired:2}
  ], {margin:0});
  assert.strictEqual(plan.ok, true);
  assert.deepStrictEqual(plan.plans.map(p=>p.cidr), ['10.0.0.0/26','10.0.0.64/28','10.0.0.80/30']);
  assert.strictEqual(plan.plans[0].gateway, '10.0.0.1');
});

test('VLSM avisa si el bloque base no tiene capacidad suficiente', () => {
  const plan = NWP.buildVlsmPlan('10.0.0.0/30', [
    {vlanRef:'v10', vlanId:10, name:'Users', hostsRequired:10}
  ]);
  assert.strictEqual(plan.ok, false);
  assert.strictEqual(plan.code, 'base_too_small');
});

test('Auditoría capa 1 detecta host en puerto trunk y VLAN inconsistente', () => {
  const project = {
    devices:[{id:'sw1',name:'SW1',type:'switch'}],
    ports:[{id:'p1',deviceId:'sw1',name:'Gi0/1',mode:'trunk',media:'GE',accessVlanRef:'v10'}],
    vlans:[{id:'v10',vlanId:10,name:'Users'},{id:'v20',vlanId:20,name:'Srv'}],
    hosts:[{id:'h1',name:'PC1',vlanRef:'v20',portRef:'p1'}],
    links:[], subnets:[]
  };
  const audit = NWP.validatePhysicalCompatibility(project);
  assert.strictEqual(audit.ok, false);
  assert.ok(audit.errors.some(e=>e.includes('puerto trunk')));
  assert.ok(audit.errors.some(e=>e.includes('no coincide')));
});

test('Aplicar VLSM actualiza subnets y asigna IPs a estáticos sin IP', () => {
  const project = {
    vlans:[{id:'v10',vlanId:10,name:'Users'}],
    subnets:[],
    hosts:[{id:'h1',name:'PC1',vlanRef:'v10',ipMode:'static',staticIp:''},{id:'h2',name:'PC2',vlanRef:'v10',ipMode:'dhcp',staticIp:''}]
  };
  const plan = NWP.buildVlsmPlan('192.168.1.0/24', [{vlanRef:'v10',vlanId:10,name:'Users',hostsRequired:10}]);
  const next = NWP.applyVlsmPlan(project, plan, {assignMode:'static_only'});
  assert.strictEqual(next.subnets[0].cidr, '192.168.1.0/28');
  assert.strictEqual(next.subnets[0].gateway, '192.168.1.1');
  assert.strictEqual(next.hosts[0].staticIp, '192.168.1.2');
  assert.strictEqual(next.hosts[1].staticIp, '');
});


test('Preflight de direccionamiento detecta IP duplicada, host fuera de subnet y choque con gateway', () => {
  const project = {
    vlans:[{id:'v10',vlanId:10,name:'Users'}],
    subnets:[{id:'sn10',vlanRef:'v10',cidr:'10.0.10.0/24',gateway:'10.0.10.1'}],
    hosts:[
      {id:'h1',name:'PC1',vlanRef:'v10',staticIp:'10.0.10.1'},
      {id:'h2',name:'PC2',vlanRef:'v10',staticIp:'10.0.11.5'},
      {id:'h3',name:'PC3',vlanRef:'v10',staticIp:'10.0.11.5'}
    ],
    devices:[], ports:[], links:[]
  };
  const issues = NWP.collectAddressingIssues(project);
  assert.strictEqual(issues.ok, false);
  assert.ok(issues.errors.some(e=>e.includes('coincide con el gateway')));
  assert.ok(issues.errors.some(e=>e.includes('fuera de')));
  assert.ok(issues.errors.some(e=>e.includes('IP duplicada')));
});

test('Aplicar VLSM preserva el id de subnet existente', () => {
  const project = {
    vlans:[{id:'v10',vlanId:10,name:'Users'}],
    subnets:[{id:'sn-existing',vlanRef:'v10',cidr:'10.0.0.0/24',gateway:'10.0.0.1'}],
    hosts:[]
  };
  const plan = NWP.buildVlsmPlan('172.16.0.0/24', [{vlanRef:'v10',vlanId:10,name:'Users',hostsRequired:20}]);
  const next = NWP.applyVlsmPlan(project, plan, {assignMode:'none'});
  assert.strictEqual(next.subnets.length, 1);
  assert.strictEqual(next.subnets[0].id, 'sn-existing');
  assert.strictEqual(next.subnets[0].cidr, '172.16.0.0/27');
});

test('Readiness audit eleva avisos críticos en modo producción', () => {
  const audit = NWP.readinessAudit({
    devices:[{id:'sw1', name:'SW1', type:'switch'}],
    ports:[],
    vlans:[{id:'v10', vlanId:10, name:'Usuarios'}, {id:'v20', vlanId:20, name:'Servidores'}],
    subnets:[],
    hosts:[{id:'h1', name:'PC1', vlanRef:'v10', ipMode:'static', staticIp:''}],
    links:[], dhcp:{}
  }, {productionMode:true});
  assert.strictEqual(audit.ok, false);
  assert.ok(audit.errors.some(e => e.includes('Producción')));
});


const NWIntent = require(path.join(root, 'js', 'netwizard-vlan-intent.js'));

test('VLAN intent infiere tipos, normaliza y genera necesidades para VLSM', () => {
  assert.strictEqual(NWIntent.inferTypeFromName('IoT Sensores'), 'iot');
  assert.strictEqual(NWIntent.inferTypeFromName('WiFi Invitados'), 'guests');
  const project = {
    vlans:[{id:'v10', vlanId:10, name:'Usuarios', intent:{type:'users', expectedHosts:80, growthHosts:20}}],
    hosts:[{id:'h1', vlanRef:'v10'}], ports:[], iot:{devices:[]}
  };
  const needs = NWIntent.inferVlanNeeds(project);
  assert.strictEqual(needs[0].hostsRequired, 100);
  assert.strictEqual(needs[0].intent.dhcp, true);
});

test('VLSM usa capacidad definida por intención de VLAN', () => {
  const project = {
    vlans:[{id:'v10', vlanId:10, name:'Usuarios', intent:{type:'users', expectedHosts:80, growthHosts:20}}],
    hosts:[], ports:[], iot:{devices:[]}
  };
  const needs = NWP.inferVlanNeeds(project, {minPerVlan:2});
  assert.strictEqual(needs[0].hostsRequired, 100);
  const plan = NWP.buildVlsmPlan('10.20.0.0/24', needs, {margin:0});
  assert.strictEqual(plan.ok, true);
  assert.strictEqual(plan.plans[0].prefix, 25);
});



test('VLSM trata VLANs de tránsito como redes punto a punto /30', () => {
  const project = {
    vlans:[{id:'v99', vlanId:99, name:'Transit R1-R2', intent:{type:'transit', expectedHosts:0, growthHosts:0}}],
    hosts:[], ports:[], iot:{devices:[]}
  };
  const needs = NWP.inferVlanNeeds(project, {minPerVlan:10});
  assert.strictEqual(needs[0].hostsRequired, 2);
  assert.strictEqual(needs[0].type, 'transit');
  const plan = NWP.buildVlsmPlan('10.255.0.0/24', needs, {margin:0});
  assert.strictEqual(plan.ok, true);
  assert.strictEqual(plan.plans[0].prefix, 30);
  assert.strictEqual(plan.plans[0].usableHosts, 2);
});

test('Auditoría avisa si un enlace L3 no tiene VLAN/red de tránsito', () => {
  const project = {
    devices:[{id:'r1',name:'R1',type:'router'}, {id:'r2',name:'R2',type:'router'}],
    ports:[{id:'p1',deviceId:'r1',name:'Gi0/0',mode:'routed',media:'GE'}, {id:'p2',deviceId:'r2',name:'Gi0/0',mode:'routed',media:'GE'}],
    links:[{id:'l1',aPortId:'p1',bPortId:'p2'}],
    vlans:[], subnets:[], hosts:[]
  };
  const audit = NWP.validatePhysicalCompatibility(project);
  assert.strictEqual(audit.ok, true);
  assert.ok(audit.warnings.some(e => e.includes('VLAN/red de tránsito')));
  const ready = NWP.readinessAudit(project, {productionMode:false});
  assert.ok(ready.warnings.some(e => e.includes('NW-L3-010')));
});

test('Auditoría acepta enlace L3 con VLAN de tránsito y subnet', () => {
  const project = {
    devices:[{id:'r1',name:'R1',type:'router'}, {id:'r2',name:'R2',type:'router'}],
    ports:[{id:'p1',deviceId:'r1',name:'Gi0/0',mode:'routed',media:'GE'}, {id:'p2',deviceId:'r2',name:'Gi0/0',mode:'routed',media:'GE'}],
    links:[{id:'l1',aPortId:'p1',bPortId:'p2',transitVlanRef:'v99'}],
    vlans:[{id:'v99',vlanId:99,name:'Transit R1-R2',intent:{type:'transit'}}],
    subnets:[{id:'sn99',vlanRef:'v99',cidr:'10.255.0.0/30',gateway:'10.255.0.1'}],
    hosts:[]
  };
  const audit = NWP.validatePhysicalCompatibility(project);
  assert.strictEqual(audit.ok, true);
  assert.ok(!audit.warnings.some(e => e.includes('VLAN/red de tránsito')));
});

test('VLAN intent propone DHCP y recomendaciones no destructivas', () => {
  const project = {
    vlans:[{id:'v30', vlanId:30, name:'Invitados', intent:{type:'guests', expectedHosts:20, growthHosts:10}}],
    subnets:[{id:'sn30', vlanRef:'v30', cidr:'10.30.0.0/27', gateway:'10.30.0.1'}],
    dhcp:{}
  };
  const rec = NWIntent.recommendProject(project);
  assert.ok(NWIntent.summarizeRecommendations(rec).includes('Bloquear acceso a redes internas'));
  const proposal = NWIntent.proposeDhcpUpdates(project);
  assert.strictEqual(proposal.project.dhcp['30'].enabled, true);
  assert.ok(proposal.changes.some(x => x.includes('Activar DHCP')));
});


test('Asignación de IPs a interfaces de tránsito L3', () => {
  const project = {
    devices:[{id:'r1',name:'R1',type:'router'}, {id:'r2',name:'R2',type:'router'}],
    ports:[{id:'p1',deviceId:'r1',name:'Gi0/0',mode:'routed',media:'GE'}, {id:'p2',deviceId:'r2',name:'Gi0/0',mode:'routed',media:'GE'}],
    links:[{id:'l1',aPortId:'p1',bPortId:'p2',transitVlanRef:'v99'}],
    vlans:[{id:'v99',vlanId:99,name:'Transit R1-R2',intent:{type:'transit'}}],
    subnets:[{id:'sn99',vlanRef:'v99',cidr:'10.255.0.0/30',gateway:''}],
    hosts:[]
  };
  const res = NWP.assignTransitInterfaceIps(project);
  assert.strictEqual(res.assigned.length, 2);
  const p1 = res.project.ports.find(p=>p.id==='p1');
  const p2 = res.project.ports.find(p=>p.id==='p2');
  assert.strictEqual(p1.l3Ip, '10.255.0.1');
  assert.strictEqual(p2.l3Ip, '10.255.0.2');
  assert.strictEqual(p1.l3Cidr, '10.255.0.0/30');
});

test('Schema conserva aPortId/bPortId y transitVlanRef en enlaces', () => {
  const prepared = NWSchema.prepareImport({
    devices:[{id:'r1'}, {id:'r2'}],
    ports:[{id:'p1',deviceId:'r1'}, {id:'p2',deviceId:'r2'}],
    vlans:[{id:'v99',vlanId:99}],
    links:[{id:'l1',aPortId:'p1',bPortId:'p2',transitVlanRef:'v99'}]
  }, {defaults: () => ({devices:[],ports:[],vlans:[],subnets:[],hosts:[],links:[],fwRules:[],physicalLocations:[],hostPhysicalLocations:[],security:{},roas:{},vtp:{roles:{}},topo:{pos:{}},visual:{locs:[],assign:{devices:{},hosts:{}},pos:{},view:{}},iot:{accessNodes:[],devices:[],map:{show:{}}},dhcp:{},vlanMatrix:{},uiSort:{}})});
  assert.strictEqual(prepared.ok, true);
  assert.strictEqual(prepared.project.links[0].aPortId, 'p1');
  assert.strictEqual(prepared.project.links[0].bPortId, 'p2');
  assert.strictEqual(prepared.project.links[0].transitVlanRef, 'v99');
});



const NWL3 = require(path.join(root, 'js', 'netwizard-l3-config-utils.js'));

test('L3 config utils recopila interfaces routed con peer, VLAN y máscara', () => {
  const project = {
    devices:[{id:'r1',name:'R1',type:'router'}, {id:'r2',name:'R2',type:'router'}],
    ports:[{id:'p1',deviceId:'r1',name:'Gi0/0',mode:'routed',l3Ip:'10.255.0.1',l3Cidr:'10.255.0.0/30'}, {id:'p2',deviceId:'r2',name:'Gi0/0',mode:'routed',l3Ip:'10.255.0.2',l3Cidr:'10.255.0.0/30'}],
    links:[{id:'l1',aPortId:'p1',bPortId:'p2',transitVlanRef:'v99'}],
    vlans:[{id:'v99',vlanId:99,name:'Transit R1-R2',intent:{type:'transit'}}],
    subnets:[{id:'sn99',vlanRef:'v99',cidr:'10.255.0.0/30'}]
  };
  const items = NWL3.collectDeviceL3Interfaces(project, 'r1');
  assert.strictEqual(items.length, 1);
  assert.strictEqual(items[0].ip, '10.255.0.1');
  assert.strictEqual(items[0].mask, '255.255.255.252');
  assert.strictEqual(items[0].prefix, 30);
  assert.strictEqual(items[0].vlanId, 99);
  assert.strictEqual(items[0].peerDeviceName, 'R2');
  assert.ok(NWL3.peerDescription(items[0]).includes('R2'));
});

console.log('\nTodos los tests han pasado.');

const NWR = require(path.join(root, 'js', 'netwizard-routing-utils.js'));

test('Routing utils infiere rutas estáticas por enlaces L3 de tránsito', () => {
  const project = {
    roas:{gwId:'r1'},
    devices:[{id:'r1',name:'R1',type:'router'}, {id:'r2',name:'R2',type:'router'}],
    ports:[
      {id:'p1',deviceId:'r1',name:'Gi0/0',mode:'routed',l3Ip:'10.255.0.1',l3Cidr:'10.255.0.0/30'},
      {id:'p2',deviceId:'r2',name:'Gi0/0',mode:'routed',l3Ip:'10.255.0.2',l3Cidr:'10.255.0.0/30'}
    ],
    links:[{id:'l1',aPortId:'p1',bPortId:'p2',transitVlanRef:'v99'}],
    vlans:[
      {id:'v10',vlanId:10,name:'Users'},
      {id:'v99',vlanId:99,name:'Transit R1-R2',intent:{type:'transit'}}
    ],
    subnets:[
      {id:'sn10',vlanRef:'v10',cidr:'10.10.10.0/24',gateway:'10.10.10.1'},
      {id:'sn99',vlanRef:'v99',cidr:'10.255.0.0/30'}
    ]
  };
  const routes = NWR.inferStaticRoutes(project, 'r2');
  assert.strictEqual(routes.length, 1);
  assert.strictEqual(routes[0].destination, '10.10.10.0/24');
  assert.strictEqual(routes[0].network, '10.10.10.0');
  assert.strictEqual(routes[0].mask, '255.255.255.0');
  assert.strictEqual(routes[0].nextHop, '10.255.0.1');
});

console.log('\nTests de routing v3.14 completados.');

test('DHCP utils propone pool, exclusiones y valida rangos', () => {
  const project = {
    vlans:[{id:'v10', vlanId:10, name:'Usuarios', intent:{type:'users', dhcp:true}}],
    subnets:[{id:'sn10', vlanRef:'v10', cidr:'10.10.10.0/24', gateway:'10.10.10.1'}],
    hosts:[{id:'h1', name:'Srv1', vlanRef:'v10', ipMode:'static', staticIp:'10.10.10.20'}],
    dhcp:{}
  };
  const res = NWDH.proposeDhcpForProject(project);
  const cfg = res.project.dhcp['10'];
  assert.strictEqual(cfg.enabled, true);
  assert.strictEqual(cfg.start, '10.10.10.11');
  assert.strictEqual(cfg.end, '10.10.10.254');
  assert.ok(cfg.exclusions.some(e => e.start === '10.10.10.1'));
  assert.ok(cfg.exclusions.some(e => e.start === '10.10.10.20'));
  const audit = NWDH.validateDhcpForProject(res.project);
  assert.strictEqual(audit.ok, true);
});

test('DHCP utils bloquea pools inválidos en gateway o fuera de subnet', () => {
  const project = {
    vlans:[{id:'v20', vlanId:20, name:'Invitados'}],
    subnets:[{id:'sn20', vlanRef:'v20', cidr:'192.168.20.0/24', gateway:'192.168.20.1'}],
    hosts:[],
    dhcp:{'20':{enabled:true,start:'192.168.20.1',end:'192.168.21.50',dns:'8.8.8.8',lease:1}}
  };
  const audit = NWDH.validateDhcpForProject(project);
  assert.strictEqual(audit.ok, false);
  assert.ok(audit.issues.some(i => i.code === 'NW-DHCP-014'));
  assert.ok(audit.issues.some(i => i.code === 'NW-DHCP-015'));
});

test('Schema conserva DHCP avanzado en import/export', () => {
  const defaults = () => ({ devices:[], ports:[], vlans:[], subnets:[], hosts:[], links:[], fwRules:[], vlanMatrix:{}, dhcp:{}, security:{}, roas:{}, vtp:{roles:{}}, topo:{pos:{}}, visual:{locs:[],assign:{devices:{},hosts:{}},pos:{},view:{}}, iot:{accessNodes:[],devices:[],map:{show:{}}}, physicalLocations:[], hostPhysicalLocations:[], uiSort:{} });
  const prepared = NWSchema.prepareImport({
    vlans:[{id:'v10',vlanId:10,name:'Users'}],
    dhcp:{'10':{enabled:true,start:'10.0.10.20',end:'10.0.10.200',domain:'corp.local',exclusions:[{start:'10.0.10.1',reason:'gw'}]}}
  }, {defaults});
  assert.strictEqual(prepared.project.dhcp['10'].start, '10.0.10.20');
  assert.strictEqual(prepared.project.dhcp['10'].end, '10.0.10.200');
  assert.strictEqual(prepared.project.dhcp['10'].domain, 'corp.local');
  assert.strictEqual(prepared.project.dhcp['10'].exclusions[0].reason, 'gw');
});

console.log('\nTests DHCP v3.15 completados.');


const NWPOL = require(path.join(root, 'js', 'netwizard-policy-utils.js'));

test('Policy utils genera aislamiento e Internet para VLAN invitados', () => {
  const project = {
    vlans:[
      {id:'v10', vlanId:10, name:'Usuarios', intent:{type:'users', isolation:'standard', internet:true}},
      {id:'v20', vlanId:20, name:'Invitados', intent:{type:'guests', isolation:'isolated', internet:true}}
    ],
    subnets:[
      {id:'sn10', vlanRef:'v10', cidr:'10.10.10.0/24', gateway:'10.10.10.1'},
      {id:'sn20', vlanRef:'v20', cidr:'10.20.20.0/24', gateway:'10.20.20.1'}
    ],
    fwRules:[]
  };
  const rules = NWPOL.buildIntentPolicyRules(project);
  assert.ok(rules.some(r => r.vlanRef === 'v20' && r.action === 'deny' && r.dst === '10.10.10.0/24'));
  assert.ok(rules.some(r => r.vlanRef === 'v20' && r.action === 'allow' && r.port === '80,443'));
});

test('Policy utils aplica reglas generadas sin duplicar reglas manuales equivalentes', () => {
  const project = {
    vlans:[{id:'v30', vlanId:30, name:'IoT', intent:{type:'iot', isolation:'isolated', internet:true}}],
    subnets:[{id:'sn30', vlanRef:'v30', cidr:'10.30.0.0/24', gateway:'10.30.0.1'}],
    fwRules:[{id:'manual1', name:'DNS IoT manual', action:'allow', src:'10.30.0.0/24', dst:'any', proto:'udp', port:'53', enabled:true}]
  };
  const res = NWPOL.applyGeneratedRules(project, {replaceExistingGenerated:true});
  const dnsRules = res.project.fwRules.filter(r => r.src === '10.30.0.0/24' && r.proto === 'udp' && r.port === '53');
  assert.strictEqual(dnsRules.length, 1);
  assert.ok(res.added > 0);
});

test('Policy utils valida VLAN aislada sin subnet como aviso exportable', () => {
  const project = { vlans:[{id:'v40', vlanId:40, name:'Cámaras', intent:{type:'cameras', isolation:'isolated'}}], subnets:[], fwRules:[] };
  const audit = NWPOL.validatePolicyForProject(project);
  assert.ok(audit.issues.some(i => i.code === 'NW-POL-003'));
});

console.log('\nTests policy v3.17 completados.');

test('Policy utils crea contexto con objetos, zonas e interfaces por VLAN', () => {
  const project = {
    vlans:[
      {id:'v10', vlanId:10, name:'Usuarios', intent:{type:'users'}},
      {id:'v20', vlanId:20, name:'Invitados', intent:{type:'guests', isolation:'isolated', internet:true}}
    ],
    subnets:[
      {id:'sn10', vlanRef:'v10', cidr:'10.10.10.0/24', gateway:'10.10.10.1'},
      {id:'sn20', vlanRef:'v20', cidr:'10.20.20.0/24', gateway:'10.20.20.1'}
    ]
  };
  const ctx = NWPOL.buildPolicyContext(project);
  const guest = ctx.vlanObjects.find(v => v.vlanRef === 'v20');
  assert.strictEqual(guest.zone, 'guest');
  assert.strictEqual(guest.interfaceName, 'VLAN20');
  assert.strictEqual(guest.network, '10.20.20.0');
  assert.strictEqual(guest.mask, '255.255.255.0');
  assert.ok(ctx.zones.some(z => z.zone === 'guest' && z.interfaces.includes('VLAN20')));
});

test('Policy utils enriquece reglas con address objects y servicios vendor-friendly', () => {
  const project = {
    vlans:[{id:'v20', vlanId:20, name:'Invitados', intent:{type:'guests', isolation:'isolated', internet:true}}],
    subnets:[{id:'sn20', vlanRef:'v20', cidr:'10.20.20.0/24', gateway:'10.20.20.1'}]
  };
  const rules = NWPOL.enrichPolicyRules(project, [{name:'Web Guest', action:'allow', src:'10.20.20.0/24', dst:'any', proto:'tcp', port:'80,443'}]);
  assert.strictEqual(rules[0].srcZone, 'guest');
  assert.strictEqual(rules[0].srcInterface, 'VLAN20');
  assert.deepStrictEqual(rules[0].serviceNames, ['HTTP','HTTPS']);
  assert.ok(rules[0].srcObject.startsWith('NW_VLAN20'));
  const objects = NWPOL.buildAddressObjects(project, rules);
  assert.ok(objects.some(o => o.name === rules[0].srcObject && o.subnet === '10.20.20.0'));
});

console.log('\nTests policy v3.17 object/zone completados.');

test('Policy diff previsualiza altas y retiradas antes de aplicar', () => {
  const project = {
    vlans:[
      {id:'v20', vlanId:20, name:'Invitados', intent:{type:'guests', isolation:'isolated', internet:true}},
      {id:'v30', vlanId:30, name:'IoT', intent:{type:'iot', isolation:'isolated', internet:false}}
    ],
    subnets:[
      {id:'sn20', vlanRef:'v20', cidr:'10.20.20.0/24', gateway:'10.20.20.1'},
      {id:'sn30', vlanRef:'v30', cidr:'10.30.30.0/24', gateway:'10.30.30.1'}
    ],
    fwRules:[
      {id:'oldgen', name:'Regla vieja generada', generatedFromIntent:true, action:'allow', src:'10.99.0.0/24', dst:'any', proto:'tcp', port:'443', enabled:true},
      {id:'manual1', name:'Manual DNS guest', action:'allow', src:'10.20.20.0/24', dst:'any', proto:'udp', port:'53', enabled:true}
    ]
  };
  const diff = NWPOL.computePolicyApplyDiff(project, {replaceExistingGenerated:true});
  assert.ok(diff.add.length > 0);
  assert.ok(diff.remove.some(r => r.id === 'oldgen'));
  assert.ok(!diff.add.some(r => r.src === '10.20.20.0/24' && r.proto === 'udp' && r.port === '53'));
  const text = NWPOL.summarizePolicyApplyDiff(diff);
  assert.ok(text.includes('Añadir'));
  assert.ok(text.includes('Retirar'));
});

test('Policy diff puede conservar reglas generadas antiguas si no se reemplazan', () => {
  const project = {
    vlans:[{id:'v20', vlanId:20, name:'Invitados', intent:{type:'guests', isolation:'isolated', internet:true}}],
    subnets:[{id:'sn20', vlanRef:'v20', cidr:'10.20.20.0/24', gateway:'10.20.20.1'}],
    fwRules:[{id:'oldgen', name:'Regla vieja generada', generatedFromIntent:true, action:'allow', src:'10.99.0.0/24', dst:'any', proto:'tcp', port:'443', enabled:true}]
  };
  const diff = NWPOL.computePolicyApplyDiff(project, {replaceExistingGenerated:false});
  assert.strictEqual(diff.remove.length, 0);
  const res = NWPOL.applyGeneratedRules(project, {replaceExistingGenerated:false});
  assert.ok(res.project.fwRules.some(r => r.id === 'oldgen'));
});

console.log('\nTests policy v3.18 diff/preview completados.');


const NWCP = require(path.join(root, 'js', 'netwizard-change-preview.js'));

test('Change preview calcula diff VLSM sin aplicar cambios', () => {
  const project = {
    vlans:[{id:'v10',vlanId:10,name:'Usuarios'}],
    subnets:[{id:'sn10',vlanRef:'v10',cidr:'10.0.0.0/24',gateway:'10.0.0.1'}],
    hosts:[{id:'h1',name:'PC1',vlanRef:'v10',ipMode:'static',staticIp:''}],
    ports:[]
  };
  const plan = NWP.buildVlsmPlan('192.168.50.0/24', [{vlanRef:'v10',vlanId:10,name:'Usuarios',hostsRequired:20}], {margin:0});
  const diff = NWCP.computeVlsmDiff(project, plan, {assignMode:'static_only'});
  assert.ok(diff.change.some(c => c.scope === 'Subnet' && String(c.after).includes('192.168.50.0/27')));
  assert.ok(diff.change.some(c => c.scope === 'Host IP' && String(c.after).includes('192.168.50.2')));
  assert.strictEqual(project.subnets[0].cidr, '10.0.0.0/24');
});

test('Change preview calcula diff DHCP antes de proponer pools', () => {
  const project = {
    vlans:[{id:'v10',vlanId:10,name:'Usuarios',intent:{type:'users',dhcp:true}}],
    subnets:[{id:'sn10',vlanRef:'v10',cidr:'10.10.10.0/24',gateway:'10.10.10.1'}],
    hosts:[], dhcp:{}
  };
  const diff = NWCP.computeDhcpDiff(project, {overwrite:false});
  assert.ok(diff.add.some(c => c.scope === 'DHCP' && String(c.after).includes('10.10.10.11')));
  assert.ok(NWCP.summarizeDiff(diff, 'DHCP').includes('Añadir'));
});

test('Change preview calcula diff de IPs L3 de tránsito', () => {
  const project = {
    devices:[{id:'r1',name:'R1',type:'router'}, {id:'r2',name:'R2',type:'router'}],
    ports:[{id:'p1',deviceId:'r1',name:'Gi0/0',mode:'routed'}, {id:'p2',deviceId:'r2',name:'Gi0/0',mode:'routed'}],
    links:[{id:'l1',aPortId:'p1',bPortId:'p2',transitVlanRef:'v99'}],
    vlans:[{id:'v99',vlanId:99,name:'Transit',intent:{type:'transit'}}],
    subnets:[{id:'sn99',vlanRef:'v99',cidr:'10.255.0.0/30'}], hosts:[]
  };
  const diff = NWCP.computeTransitIpDiff(project);
  assert.strictEqual(diff.add.filter(c => c.scope === 'Interfaz L3').length, 2);
  assert.ok(diff.add.some(c => String(c.after).includes('10.255.0.1/30')));
});

console.log('\nTests change preview/cabling/PoE/plan v3.22 completados.');


const NWPlan = require(path.join(root, 'js', 'netwizard-change-plan.js'));

test('Change Plan previsualiza VLSM, DHCP e IPs L3 sin modificar el proyecto original', () => {
  const project = {
    devices:[{id:'r1',name:'R1',type:'router'},{id:'r2',name:'R2',type:'router'}],
    ports:[
      {id:'p1',deviceId:'r1',name:'Gi0/0',mode:'routed'},
      {id:'p2',deviceId:'r2',name:'Gi0/0',mode:'routed'}
    ],
    links:[{id:'l1',aPortId:'p1',bPortId:'p2',transitVlanRef:'v99'}],
    vlans:[
      {id:'v10',vlanId:10,name:'Usuarios',intent:{type:'users',expectedHosts:20,growth:5,dhcp:true}},
      {id:'v99',vlanId:99,name:'Transit R1-R2',intent:{type:'transit'}}
    ],
    subnets:[],
    hosts:[{id:'h1',name:'PC1',type:'pc',vlanRef:'v10',ipMode:'dhcp'}],
    dhcp:{},
    fwRules:[]
  };
  const plan = NWPlan.buildPlan(project, {includeVlsm:true, includeDhcp:true, includeTransitIps:true, includePolicies:false, baseCidr:'10.50.0.0/24', margin:0});
  assert.strictEqual(plan.ok, true);
  assert.ok(plan.totalChanges > 0);
  assert.strictEqual(project.subnets.length, 0, 'la previsualización no debe mutar el proyecto original');
  assert.ok(plan.project.subnets.some(s => s.vlanRef === 'v10'));
  assert.ok(plan.project.subnets.some(s => s.vlanRef === 'v99' && /\/30$/.test(s.cidr)));
  assert.ok(plan.project.ports.some(p => p.id === 'p1' && p.l3Ip));
  assert.ok(plan.project.dhcp['10'] && plan.project.dhcp['10'].enabled);
});

test('Change Plan applyPlan devuelve proyecto actualizado y resumen legible', () => {
  const project = {devices:[], ports:[], links:[], vlans:[{id:'v10',vlanId:10,name:'Usuarios',intent:{type:'users',expectedHosts:10,dhcp:true}}], subnets:[], hosts:[], dhcp:{}, fwRules:[]};
  const res = NWPlan.applyPlan(project, {includeVlsm:true, includeDhcp:true, includeTransitIps:false, includePolicies:false, baseCidr:'10.60.0.0/24', margin:0});
  assert.strictEqual(res.ok, true);
  assert.ok(res.project.subnets.length >= 1);
  assert.ok(NWPlan.summarizePlan(res.plan).includes('Plan común de cambios'));
});

const NWDoc = require(path.join(root, 'js', 'netwizard-documentation-utils.js'));

test('Documentation utils exporta inventario y CSV con VLAN, host y firewall', () => {
  const project = {
    projName:'Demo Producción',
    devices:[{id:'sw1',name:'SW1',type:'switch',vendorOs:'ios'}],
    ports:[{id:'p1',deviceId:'sw1',name:'Gi1/0/1',mode:'access',vlanRef:'v10'}],
    vlans:[{id:'v10',vlanId:10,name:'Usuarios',intent:{type:'users',dhcp:true,internet:true}}],
    subnets:[{id:'sn10',vlanRef:'v10',cidr:'10.10.10.0/24',gateway:'10.10.10.1'}],
    hosts:[{id:'h1',name:'PC1',type:'pc',vlanRef:'v10',portId:'p1',ipMode:'dhcp'}],
    dhcp:{'10':{enabled:true,start:'10.10.10.20',end:'10.10.10.200',dns:['1.1.1.1']}},
    fwRules:[{id:'fw1',name:'Allow web',action:'allow',src:'10.10.10.0/24',dst:'any',proto:'tcp',port:'80,443',enabled:true}]
  };
  const rows = NWDoc.buildInventoryRows(project);
  assert.ok(rows.some(r => r.section === 'VLANs' && r.cidr === '10.10.10.0/24'));
  assert.ok(rows.some(r => r.section === 'Hosts' && r.name === 'PC1'));
  assert.ok(rows.some(r => r.section === 'Firewall' && r.action === 'allow'));
  const csv = NWDoc.toCsv(rows, NWDoc.INVENTORY_COLUMNS);
  assert.ok(csv.includes('Dispositivos'));
  assert.ok(csv.includes('10.10.10.0/24'));
});

test('Documentation utils genera matriz de conectividad prudente', () => {
  const project = {
    vlans:[
      {id:'v10',vlanId:10,name:'Usuarios',intent:{type:'users',internet:true}},
      {id:'v20',vlanId:20,name:'Invitados',intent:{type:'guests',internet:true,isolation:'isolated'}}
    ],
    subnets:[{vlanRef:'v10',cidr:'10.10.10.0/24'},{vlanRef:'v20',cidr:'10.20.20.0/24'}],
    vlanMatrix:{'v20_v10':false},
    fwRules:[]
  };
  const rows = NWDoc.buildConnectivityMatrix(project);
  assert.ok(rows.some(r => r.source.includes('20') && r.destination.includes('10') && r.action === 'DENY'));
  assert.ok(rows.some(r => r.destination === 'Internet/WAN' && r.action === 'ALLOW'));
  const summary = NWDoc.summarizeConnectivityMatrix(rows);
  assert.ok(summary.includes('Matriz de conectividad'));
});

test('Documentation utils genera documento Markdown con secciones principales', () => {
  const project = {projName:'Mi Red', devices:[], ports:[], links:[], vlans:[{id:'v1',vlanId:1,name:'Default'}], subnets:[], hosts:[], dhcp:{}, fwRules:[]};
  const md = NWDoc.buildMarkdownDocument(project);
  assert.ok(md.includes('# Documentación NetWizard'));
  assert.ok(md.includes('## Matriz de conectividad'));
  assert.ok(md.includes('## VLANs'));
});

console.log('\nTests documentación/matriz v3.23 completados.');


test('Broadcast utils detecta VLAN grande y muchos endpoints', () => {
  const project = {
    vlans:[{id:'v10',vlanId:10,name:'Usuarios',intent:{type:'users',expectedHosts:300,growthHosts:50}}],
    subnets:[{vlanRef:'v10',cidr:'10.10.0.0/22'}],
    hosts:[], ports:[], links:[]
  };
  const audit = NWBCAST.auditBroadcastDomains(project);
  assert.ok(audit.stats[0].riskScore >= 35);
  assert.ok(audit.warnings.some(w => w.includes('subred grande') || w.includes('endpoints')));
  assert.ok(NWBCAST.summarizeBroadcastAudit(audit).includes('riesgo'));
});

test('Broadcast utils avisa si IoT/cámaras están mezclados en VLAN no especializada', () => {
  const project = {
    vlans:[{id:'v20',vlanId:20,name:'Usuarios',intent:{type:'users'}}],
    subnets:[{vlanRef:'v20',cidr:'10.20.20.0/24'}],
    hosts:[{id:'h1',name:'Camara 1',type:'camera',vlanRef:'v20'},{id:'h2',name:'Sensor 1',type:'iot',vlanRef:'v20'}],
    ports:[], links:[]
  };
  const audit = NWBCAST.auditBroadcastDomains(project);
  assert.ok(audit.issues.some(i => i.code === 'NW-BCAST-023'));
});

test('Broadcast utils detecta trunks abiertos que transportan todas las VLANs', () => {
  const project = {
    vlans:[{id:'v10',vlanId:10,name:'Users'},{id:'v20',vlanId:20,name:'IoT'}],
    subnets:[{vlanRef:'v10',cidr:'10.10.10.0/24'},{vlanRef:'v20',cidr:'10.20.20.0/24'}],
    ports:[{id:'p1',mode:'trunk',allowed:'all'},{id:'p2',mode:'trunk'}],
    hosts:[], links:[]
  };
  const audit = NWBCAST.auditBroadcastDomains(project);
  assert.ok(audit.issues.some(i => i.code === 'NW-BCAST-030'));
});

console.log('\nTests broadcast v3.24 completados.');

const NWGate = require(path.join(root, 'js', 'netwizard-production-gate.js'));

test('Production Gate bloquea producción con VLAN/subnet sin gateway y DHCP inválido', () => {
  const project = {
    devices:[{id:'sw1',name:'SW1',type:'switch'}],
    ports:[], links:[],
    vlans:[{id:'v10',vlanId:10,name:'Usuarios',intent:{type:'users',expectedHosts:20,dhcp:true}}],
    subnets:[{id:'sn10',vlanRef:'v10',cidr:'10.10.10.0/24',gateway:''}],
    hosts:[{id:'h1',name:'PC1',vlanRef:'v10',ipMode:'dhcp'}],
    dhcp:{'10':{enabled:true,start:'10.10.9.20',end:'10.10.9.50'}},
    fwRules:[]
  };
  const gate = NWGate.runProductionGate(project, {productionMode:true, strict:true});
  assert.strictEqual(gate.status, 'blocked');
  assert.strictEqual(gate.canExport, false);
  assert.ok(gate.issues.some(i => i.code === 'NW-L3-020'));
  assert.ok(gate.issues.some(i => /^NW-DHCP-/.test(i.code)));
  assert.ok(NWGate.summarizeGate(gate).includes('BLOQUEADO'));
});

test('Production Gate permite exportar un proyecto mínimo coherente en modo producción', () => {
  const project = {
    devices:[{id:'r1',name:'R1',type:'router'}],
    ports:[{id:'p1',deviceId:'r1',name:'Gi0/0',mode:'access',accessVlanRef:'v10'}],
    links:[],
    vlans:[{id:'v10',vlanId:10,name:'Usuarios',intent:{type:'users',expectedHosts:10,dhcp:true,internet:true}}],
    subnets:[{id:'sn10',vlanRef:'v10',cidr:'10.10.10.0/24',gateway:'10.10.10.1'}],
    hosts:[{id:'h1',name:'PC1',vlanRef:'v10',portRef:'p1',ipMode:'dhcp'}],
    dhcp:{'10':{enabled:true,start:'10.10.10.20',end:'10.10.10.200',dns:['1.1.1.1'],exclusions:['10.10.10.1']}},
    fwRules:[{id:'fw1',name:'Users Internet',action:'allow',src:'10.10.10.0/24',dst:'any',proto:'tcp',port:'80,443',enabled:true,reviewed:true}]
  };
  const gate = NWGate.runProductionGate(project, {productionMode:true, strict:true});
  assert.notStrictEqual(gate.status, 'blocked');
  assert.strictEqual(gate.canExport, true);
  assert.ok(['ready','review'].includes(gate.status));
});

console.log('\nTests production gate v3.26 completados.');


test('L2 audit detecta mismatch de VLAN nativa entre trunks conectados', () => {
  const project = {
    devices:[{id:'sw1',name:'SW1',type:'switch'},{id:'sw2',name:'SW2',type:'switch'}],
    vlans:[{id:'v10',vlanId:10,name:'Users'},{id:'v999',vlanId:999,name:'Native'}],
    ports:[
      {id:'p1',deviceId:'sw1',name:'Gi0/1',mode:'trunk',allowedVlans:[10,999],nativeVlanRef:'v999'},
      {id:'p2',deviceId:'sw2',name:'Gi0/1',mode:'trunk',allowedVlans:[10,999],nativeVlanRef:'v10'}
    ],
    links:[{id:'l1',aPortId:'p1',bPortId:'p2'}], hosts:[], subnets:[]
  };
  const audit = NWL2.auditL2(project);
  assert.ok(audit.issues.some(i => i.code === 'NW-L2-021'));
});

test('L2 audit detecta trunks sin VLANs comunes', () => {
  const project = {
    devices:[{id:'sw1',name:'SW1',type:'switch'},{id:'sw2',name:'SW2',type:'switch'}],
    vlans:[{id:'v10',vlanId:10,name:'Users'},{id:'v20',vlanId:20,name:'IoT'}],
    ports:[
      {id:'p1',deviceId:'sw1',name:'Gi0/1',mode:'trunk',allowedVlans:[10],nativeVlanRef:'v10'},
      {id:'p2',deviceId:'sw2',name:'Gi0/1',mode:'trunk',allowedVlans:[20],nativeVlanRef:'v20'}
    ],
    links:[{id:'l1',aPortId:'p1',bPortId:'p2'}], hosts:[], subnets:[]
  };
  const audit = NWL2.auditL2(project);
  assert.ok(audit.issues.some(i => i.code === 'NW-L2-020'));
});

test('L2 audit valida continuidad desde host hasta gateway por trunk', () => {
  const project = {
    devices:[{id:'sw1',name:'SW1',type:'switch'},{id:'r1',name:'R1',type:'router'}],
    vlans:[{id:'v10',vlanId:10,name:'Users'}],
    subnets:[{id:'s10',vlanRef:'v10',cidr:'10.10.10.0/24',gateway:'10.10.10.1'}],
    ports:[
      {id:'pa',deviceId:'sw1',name:'Gi0/1',mode:'access',accessVlanRef:'v10',portfast:true,bpduGuard:true},
      {id:'pt',deviceId:'sw1',name:'Gi0/24',mode:'trunk',allowedVlans:[10],nativeVlanRef:'v10',desc:'uplink router'},
      {id:'pr',deviceId:'r1',name:'Gi0/0',mode:'trunk',allowedVlans:[10],nativeVlanRef:'v10'}
    ],
    hosts:[{id:'h1',name:'PC1',vlanRef:'v10',portRef:'pa'}],
    links:[{id:'l1',aPortId:'pt',bPortId:'pr'}]
  };
  const audit = NWL2.auditL2(project);
  assert.ok(!audit.issues.some(i => i.code === 'NW-L2-042'));
});

console.log('\nTests L2 avanzado v3.26 completados.');


test('L2 utils recomienda corregir trunk abierto y access sin protección', () => {
  const project = {
    devices:[{id:'sw1', name:'SW1', type:'switch'}],
    vlans:[{id:'v10', vlanId:10, name:'Users'}, {id:'v20', vlanId:20, name:'IoT'}],
    ports:[
      {id:'p1', deviceId:'sw1', name:'Gi0/1', mode:'trunk', allowedVlans:[10,20], nativeVlanRef:null, desc:'uplink core'},
      {id:'p2', deviceId:'sw1', name:'Gi0/2', mode:'access', accessVlanRef:'v10', portFast:false, bpduGuard:false}
    ],
    hosts:[{id:'h1', name:'PC1', portRef:'p2', vlanRef:'v10'}],
    links:[]
  };
  const trunkRecs = NWL2.recommendPortL2(project.ports[0], project);
  assert.ok(trunkRecs.some(r => r.field === 'allowedVlans'));
  assert.ok(trunkRecs.some(r => r.field === 'nativeVlanRef'));
  const accessRecs = NWL2.recommendPortL2(project.ports[1], project);
  assert.ok(accessRecs.some(r => r.field === 'portFast'));
  assert.ok(accessRecs.some(r => r.field === 'bpduGuard'));
});

test('Project schema conserva campos L2 editables del puerto', () => {
  const defaults = () => ({ devices:[], ports:[], vlans:[], subnets:[], hosts:[], links:[], fwRules:[], vlanMatrix:{}, dhcp:{}, security:{}, roas:{}, vtp:{roles:{}}, topo:{pos:{}}, visual:{locs:[],assign:{devices:{},hosts:{}},pos:{},view:{}}, iot:{accessNodes:[],devices:[],map:{show:{}}}, physicalLocations:[], hostPhysicalLocations:[], uiSort:{} });
  const raw = { devices:[{id:'sw1', name:'SW1', type:'switch'}], vlans:[{id:'v10', vlanId:10, name:'Users'}], ports:[{id:'p1', deviceId:'sw1', name:'Gi0/1', mode:'trunk', allowedVlans:[10], nativeVlanRef:'v10', uplink:true, portFast:false, bpduGuard:false}], subnets:[], hosts:[], links:[] };
  const prepared = NWSchema.prepareImport(raw, { defaults });
  assert.strictEqual(prepared.ok, true);
  assert.deepStrictEqual(prepared.project.ports[0].allowedVlans, [10]);
  assert.strictEqual(prepared.project.ports[0].nativeVlanRef, 'v10');
  assert.strictEqual(prepared.project.ports[0].uplink, true);
  assert.strictEqual(prepared.project.ports[0].portFast, false);
  assert.strictEqual(prepared.project.ports[0].bpduGuard, false);
});

function resolveSchemaRef(schema, ref){
  if(!ref || !ref.startsWith('#/')) throw new Error(`$ref no soportado: ${ref}`);
  return ref.slice(2).split('/').reduce((node, key) => node && node[key], schema);
}

function matchesJsonSchema(schema, value, rootSchema, pathLabel, errors){
  const label = pathLabel || '$';
  if(schema.$ref){
    const resolved = resolveSchemaRef(rootSchema, schema.$ref);
    if(!resolved){ errors.push(`${label}: $ref no resuelto ${schema.$ref}`); return false; }
    return matchesJsonSchema(resolved, value, rootSchema, label, errors);
  }
  if(schema.anyOf){
    const branchErrors = [];
    const ok = schema.anyOf.some((branch) => {
      const local = [];
      const result = matchesJsonSchema(branch, value, rootSchema, label, local);
      if(!result) branchErrors.push(local.join('; '));
      return result;
    });
    if(!ok) errors.push(`${label}: no cumple anyOf (${branchErrors.filter(Boolean).join(' | ')})`);
    return ok;
  }
  if(Object.prototype.hasOwnProperty.call(schema, 'const') && value !== schema.const){ errors.push(`${label}: esperado const ${schema.const}`); return false; }
  if(schema.enum && !schema.enum.includes(value)){ errors.push(`${label}: valor no permitido ${value}`); return false; }
  if(schema.type){
    const types = Array.isArray(schema.type) ? schema.type : [schema.type];
    const okType = types.some((t) => {
      if(t === 'array') return Array.isArray(value);
      if(t === 'null') return value === null;
      if(t === 'integer') return Number.isInteger(value);
      if(t === 'number') return typeof value === 'number' && Number.isFinite(value);
      if(t === 'object') return value && typeof value === 'object' && !Array.isArray(value);
      return typeof value === t;
    });
    if(!okType){ errors.push(`${label}: tipo inválido ${Array.isArray(value) ? 'array' : typeof value}, esperado ${types.join('|')}`); return false; }
  }
  if(typeof value === 'string'){
    if(schema.minLength != null && value.length < schema.minLength) errors.push(`${label}: longitud mínima ${schema.minLength}`);
    if(schema.maxLength != null && value.length > schema.maxLength) errors.push(`${label}: longitud máxima ${schema.maxLength}`);
    if(schema.pattern && !(new RegExp(schema.pattern).test(value))) errors.push(`${label}: no cumple patrón ${schema.pattern}`);
  }
  if(typeof value === 'number'){
    if(schema.minimum != null && value < schema.minimum) errors.push(`${label}: menor que ${schema.minimum}`);
    if(schema.maximum != null && value > schema.maximum) errors.push(`${label}: mayor que ${schema.maximum}`);
  }
  if(Array.isArray(value)){
    if(schema.uniqueItems){
      const seen = new Set(value.map((x)=>JSON.stringify(x)));
      if(seen.size !== value.length) errors.push(`${label}: elementos duplicados`);
    }
    if(schema.items){
      value.forEach((item, idx) => matchesJsonSchema(schema.items, item, rootSchema, `${label}[${idx}]`, errors));
    }
  }
  if(value && typeof value === 'object' && !Array.isArray(value)){
    for(const req of (schema.required || [])){
      if(!Object.prototype.hasOwnProperty.call(value, req)) errors.push(`${label}: falta requerido ${req}`);
    }
    const props = schema.properties || {};
    for(const [key, val] of Object.entries(value)){
      if(props[key]) matchesJsonSchema(props[key], val, rootSchema, `${label}.${key}`, errors);
      else if(schema.additionalProperties && typeof schema.additionalProperties === 'object') matchesJsonSchema(schema.additionalProperties, val, rootSchema, `${label}.${key}`, errors);
      else if(schema.additionalProperties === false) errors.push(`${label}.${key}: propiedad no permitida`);
    }
  }
  return errors.length === 0;
}

function validateAgainstSchema(schema, value){
  const errors = [];
  matchesJsonSchema(schema, value, schema, '$', errors);
  return errors;
}

test('JSON Schema externo valida exportaciones preparadas por NetWizardProjectSchema', () => {
  const schema = JSON.parse(fs.readFileSync(path.join(root, 'schemas', 'netwizard-project.schema.json'), 'utf8'));
  const defaults = () => ({ devices:[], ports:[], vlans:[], subnets:[], hosts:[], links:[], fwRules:[], vlanMatrix:{}, dhcp:{}, security:{}, roas:{}, vtp:{roles:{}}, topo:{pos:{}}, visual:{locs:[],assign:{devices:{},hosts:{}},pos:{},view:{}}, iot:{accessNodes:[],devices:[],map:{show:{}}}, physicalLocations:[], hostPhysicalLocations:[], uiSort:{} });
  const exported = NWSchema.prepareExport({
    projName:'Schema Test',
    devices:[{id:'sw1',name:'SW1',type:'switch'}],
    ports:[{id:'p1',deviceId:'sw1',name:'Gi0/1',mode:'access',accessVlanRef:'v10',portFast:true,bpduGuard:true}],
    vlans:[{id:'v10',vlanId:10,name:'Users'}],
    subnets:[{id:'s10',vlanRef:'v10',cidr:'10.10.10.0/24',gateway:'10.10.10.1'}],
    hosts:[{id:'h1',name:'PC1',type:'pc',vlanRef:'v10',portRef:'p1',ipMode:'dhcp'}],
    links:[], fwRules:[], dhcp:{}, iot:{accessNodes:[],devices:[],map:{show:{}}}
  }, { defaults });
  const errors = validateAgainstSchema(schema, exported);
  assert.deepStrictEqual(errors, []);
});

test('Samples oficiales cumplen JSON Schema externo y prepareImport', () => {
  const schema = JSON.parse(fs.readFileSync(path.join(root, 'schemas', 'netwizard-project.schema.json'), 'utf8'));
  const sampleDir = path.join(root, 'samples');
  const files = fs.readdirSync(sampleDir).filter(f => f.endsWith('.json')).sort();
  assert.ok(files.length >= 4);
  const defaults = () => ({ devices:[], ports:[], vlans:[], subnets:[], hosts:[], links:[], fwRules:[], vlanMatrix:{}, dhcp:{}, security:{}, roas:{}, vtp:{roles:{}}, topo:{pos:{}}, visual:{locs:[],assign:{devices:{},hosts:{}},pos:{},view:{}}, iot:{accessNodes:[],devices:[],map:{show:{}}}, physicalLocations:[], hostPhysicalLocations:[], uiSort:{} });
  for(const file of files){
    const payload = JSON.parse(fs.readFileSync(path.join(sampleDir, file), 'utf8'));
    const schemaErrors = validateAgainstSchema(schema, payload);
    assert.deepStrictEqual(schemaErrors, [], `${file}: ${schemaErrors.join('\n')}`);
    const prepared = NWSchema.prepareImport(payload, { defaults });
    assert.strictEqual(prepared.ok, true, `${file}: ${prepared.errors.join('\n')}`);
  }
});

console.log('\nTests schema externo y samples v3.48 completados.');

const NWVH = require(path.join(root, 'js', 'netwizard-vendor-hardening.js'));
const NWPG = require(path.join(root, 'js', 'netwizard-production-gate.js'));

test('Vendor hardening bloquea trunk Cisco abierto en producción', () => {
  const project = {
    devices:[{id:'sw1', name:'SW1', type:'switch', vendorOs:'cisco_ios'}],
    ports:[{id:'p1', deviceId:'sw1', name:'Gi0/1', mode:'trunk', allowedVlans:[]}],
    vlans:[{id:'v10', vlanId:10, name:'Users'}], subnets:[], hosts:[], links:[], fwRules:[], dhcp:{}, roas:{}, iot:{accessNodes:[],devices:[],map:{}}
  };
  const report = NWVH.validateAllExports(project, {productionMode:true});
  assert.strictEqual(report.canExport, false);
  assert.ok(report.issues.some(i => i.code === 'NW-CISCO-TRUNK-001' && i.severity === 'error'));
});

test('Vendor hardening bloquea firewall con VLAN sin gateway', () => {
  const project = {
    devices:[{id:'fw1', name:'FW1', type:'firewall', vendorOs:'fortinet'}],
    ports:[{id:'p1', deviceId:'fw1', name:'port1', mode:'trunk', allowedVlans:[10], nativeVlanRef:'v10'}],
    vlans:[{id:'v10', vlanId:10, name:'Users'}], subnets:[{id:'s10', vlanRef:'v10', cidr:'10.10.10.0/24', gateway:''}], hosts:[], links:[], fwRules:[], dhcp:{}, roas:{}, iot:{accessNodes:[],devices:[],map:{}}
  };
  const issues = NWVH.validateDeviceExport(project, project.devices[0], {productionMode:true});
  assert.ok(issues.some(i => i.code === 'NW-FW-002' && i.severity === 'error'));
});

test('Production gate incluye hardening vendor en modo producción', () => {
  const project = {
    _schemaVersion:'3.48.0', projName:'Hardening Test',
    devices:[{id:'sw1', name:'SW1', type:'switch', vendorOs:'cisco_ios'}],
    ports:[{id:'p1', deviceId:'sw1', name:'Gi0/1', mode:'trunk', allowedVlans:[]}],
    vlans:[{id:'v10', vlanId:10, name:'Users'}], subnets:[], hosts:[], links:[], fwRules:[], dhcp:{}, roas:{}, vtp:{roles:{}}, topo:{pos:{}}, visual:{locs:[],assign:{devices:{},hosts:{}},pos:{},view:{}}, iot:{accessNodes:[],devices:[],map:{show:{}}}, physicalLocations:[], hostPhysicalLocations:[], uiSort:{}
  };
  const gate = NWPG.runProductionGate(project, {productionMode:true, strict:true});
  assert.strictEqual(gate.canExport, false);
  assert.ok(gate.issues.some(i => i.code === 'NW-CISCO-TRUNK-001'));
});

console.log('\nTests hardening vendor v3.48 completados.');


test('Production gate genera guía de corrección con sección, impacto y pasos', () => {
  const issue = NWA.createIssue({code:'NW-L2-042', severity:'error', category:'l2', message:'VLAN 20 sin continuidad hasta gateway'});
  const report = {status:'blocked', productionMode:true, strict:true, issues:[issue], counts:NWPG.summarizeCounts([issue]), generatedAt:'2026-05-25T00:00:00.000Z'};
  const guide = NWPG.buildRemediationGuide(report);
  assert.strictEqual(guide.length, 1);
  assert.strictEqual(guide[0].section, 'Puertos & Interfaces · Auditoría L2 avanzada');
  assert.ok(guide[0].why.includes('continuidad L2'));
  assert.ok(guide[0].steps.some(s => s.includes('allowed VLANs')));
  const text = NWPG.summarizeRemediationGuide(report);
  assert.ok(text.includes('Guía de corrección priorizada'));
  assert.ok(text.includes('NW-L2-042'));
});

test('Production gate exporta checklist Markdown priorizado', () => {
  const issues = [
    NWA.createIssue({code:'NW-DHCP-014', severity:'error', category:'dhcp', message:'Pool incluye gateway'}),
    NWA.createIssue({code:'NW-BCAST-004', severity:'warning', category:'broadcast', message:'Demasiados endpoints'})
  ];
  const report = {status:'blocked', productionMode:true, strict:true, issues, counts:NWPG.summarizeCounts(issues), generatedAt:'2026-05-25T00:00:00.000Z'};
  const md = NWPG.exportChecklistMarkdown(report);
  assert.ok(md.startsWith('# Checklist de producción NetWizard'));
  assert.ok(md.includes('NW-DHCP-014'));
  assert.ok(md.includes('VLANs & Subnets · DHCP'));
  assert.ok(md.includes('- [ ] La puerta de producción no está BLOQUEADA.'));
});

console.log('\nTests UX producción v3.48 completados.');

test('V5 unified details evita innerHTML para datos de proyecto', () => {
  const src = fs.readFileSync(path.join(root, 'js', 'netwizard-v5-layout-manager.js'), 'utf8');
  assert.ok(src.includes('function renderUnifiedDetails(node)'), 'renderUnifiedDetails debe existir');
  assert.ok(src.includes('createTextNode') || src.includes('textContent'), 'debe existir renderizado DOM/textContent');
  assert.ok(src.includes('addKv(kv'), 'debe usar helper de DOM para pares clave/valor');
  const start = src.indexOf('function renderUnifiedDetails(node)');
  const next = src.indexOf('function installUnifiedInteraction', start);
  const fn = src.slice(start, next);
  assert.ok(!fn.includes('innerHTML=`'), 'renderUnifiedDetails no debe interpolar plantilla HTML con datos del proyecto');
});


console.log('\nTests RC hardening v3.48 completados.');

const NWSec = require(path.join(root, 'js', 'netwizard-security-utils.js'));

test('Security utils escapa HTML, atributos y plantillas por defecto', () => {
  const payload = '<img src=x onerror=alert(1)>"\'';
  assert.strictEqual(NWSec.escapeHtml(payload), '&lt;img src=x onerror=alert(1)&gt;&quot;&#039;');
  assert.strictEqual(NWSec.escapeAttr(payload), '&lt;img src=x onerror=alert(1)&gt;&quot;&#039;');
  const out = NWSec.html`<div data-x="${payload}">${payload}</div>`;
  assert.ok(out.includes('&lt;img'));
  assert.ok(!out.includes('<img'));
  assert.ok(!out.includes('onerror=alert(1)>'));
});

test('IoT y V5 extension usan escape centralizado y atributos escapados', () => {
  const iot = fs.readFileSync(path.join(root, 'js', 'netwizard-iot-embedded.js'), 'utf8');
  assert.ok(iot.includes('NetWizardSecurityUtils') || iot.includes('NetWizardCoreUtils'));
  assert.ok(iot.includes('dataset.editAccess'), 'IoT access actions deben usar dataset DOM');
  assert.ok(iot.includes('dataset.delDevice'), 'IoT device actions deben usar dataset DOM');
  const v5iot = fs.readFileSync(path.join(root, 'js', 'netwizard-v5-iot-extension.js'), 'utf8');
  assert.ok(v5iot.includes('NetWizardSecurityUtils') || v5iot.includes('NetWizardCoreUtils'));
  assert.ok(v5iot.includes('&quot;'));
});

console.log('\nTests hardening XSS v3.48 completados.');

test('Security utils escapa literales JS inline para atributos legacy', () => {
  const payload = "abc');alert(1);//\n\"<img src=x onerror=alert(1)>";
  const escaped = NWSec.inlineJsString(payload);
  assert.ok(!escaped.includes("');alert"), 'no debe permitir cerrar el literal JS sin escape');
  assert.ok(escaped.includes("\\&#039;"), 'debe escapar comilla simple y atributo HTML');
  assert.ok(escaped.includes('&lt;img'), 'debe escapar HTML dentro del atributo');
});

test('V5 panel clásico usa construcción DOM en vez de handlers inline sensibles', () => {
  const src = fs.readFileSync(path.join(root, 'js', 'netwizard.js'), 'utf8');
  assert.ok(src.includes('function v5Button('), 'debe existir helper de botones DOM V5');
  assert.ok(src.includes("addEventListener('click',fn)"), 'los botones V5 deben usar listeners normales');
  assert.ok(src.includes('function renderPortEditorDom'), 'el editor de puertos V5 debe renderizar DOM seguro');
  assert.ok(src.includes('v5ListItem('), 'las listas V5 deben crear nodos, no handlers inline');
  assert.ok(!src.includes('function renderPortEditorHtml'), 'no debe quedar editor de puertos V5 HTML legacy');
});

console.log('\nTests revisión XSS detallada v3.48 completados.');

const NWI18n = require(path.join(root, 'js', 'netwizard-i18n.js'));

test('i18n ES/EN mantiene paridad de claves y fallback seguro', () => {
  const esKeys = Object.keys(NWI18n.dictionaries.es).sort();
  const enKeys = Object.keys(NWI18n.dictionaries.en).sort();
  assert.deepStrictEqual(enKeys, esKeys);
  assert.strictEqual(NWI18n.t('nav.dash', {}, 'en'), 'Dashboard');
  assert.strictEqual(NWI18n.t('nav.dash', {}, 'es'), 'Panel');
  assert.strictEqual(NWI18n.t('missing.key', {}, 'en'), 'missing.key');
});

test('i18n no introduce HTML peligroso en diccionarios', () => {
  assert.strictEqual(NWI18n.isPlainTextDictionary('es'), true);
  assert.strictEqual(NWI18n.isPlainTextDictionary('en'), true);
});

test('i18n interpola variables en informes', () => {
  assert.strictEqual(NWI18n.t('doc.title', {project:'Demo'}, 'en'), 'NetWizard documentation — Demo');
  assert.strictEqual(NWI18n.t('doc.title', {project:'Demo'}, 'es'), 'Documentación NetWizard — Demo');
});

console.log('\nTests i18n ES/EN v3.48 completados.');

const NWDocI18n = require(path.join(root, 'js', 'netwizard-documentation-utils.js'));
const NWGateI18n = require(path.join(root, 'js', 'netwizard-production-gate.js'));

test('i18n genera checklist de producción en inglés', () => {
  const report = {status:'blocked', productionMode:true, strict:true, generatedAt:'2026-01-01T00:00:00Z', issues:[{code:'NW-IP-001', severity:'error', category:'ip', message:'IP conflict', blocking:true}]};
  const md = NWGateI18n.exportChecklistMarkdown(report, {locale:'en'});
  assert.ok(md.includes('# NetWizard production checklist'));
  assert.ok(md.includes('Status: **BLOCKED**'));
  assert.ok(md.includes('Recommended fixes'));
  assert.ok(md.includes('Exit criteria'));
});

test('i18n localiza matriz de conectividad básica en inglés', () => {
  const project = {vlans:[{id:'v1', vlanId:10, name:'Users', intent:{type:'users', internet:true}},{id:'v2', vlanId:20, name:'Guests', intent:{type:'guests', internet:false, isolation:'isolated'}}], subnets:[], fwRules:[], vlanMatrix:{}};
  const rows = NWDocI18n.buildConnectivityMatrix(project, {locale:'en'});
  assert.ok(rows.some(r => r.destination === 'Internet/WAN' && r.reason === 'VLAN intent allows Internet access'));
  assert.ok(rows.some(r => r.reason.includes('recommends lateral isolation')));
});

console.log('\nTests i18n informes/auditoría v3.48 completados.');

test('i18n permite registrar nuevos idiomas sin tocar el modelo interno', () => {
  const before = NWI18n.supportedLocales().length;
  NWI18n.registerLocale('zz', Object.assign({}, NWI18n.dictionaries.en, {'nav.dash':'ZZ Dashboard'}), {code:'zz', label:'ZZ', nativeName:'ZZ'});
  assert.ok(NWI18n.supportedLocales().includes('zz'));
  assert.strictEqual(NWI18n.t('nav.dash', {}, 'zz'), 'ZZ Dashboard');
  assert.strictEqual(NWI18n.t('devices', {}, 'zz'), 'devices');
  assert.ok(NWI18n.supportedLocales().length >= before + 1);
});

test('i18n dispone de manifiesto de idiomas ampliable', () => {
  const manifest = JSON.parse(fs.readFileSync(path.join(root, 'i18n', 'locales.json'), 'utf8'));
  assert.ok(manifest.some(x => x.code === 'es'));
  assert.ok(manifest.some(x => x.code === 'en'));
  assert.ok(manifest.every(x => x.code && x.nativeName));
});

console.log('\nTests sistema i18n ampliable v3.48 completados.');
