'use strict';

const assert=require('assert');
const fs=require('fs');
const path=require('path');
const root=path.resolve(__dirname,'..');

require(path.join(root,'js','netwizard-audit.js'));
require(path.join(root,'js','netwizard-network-utils.js'));
require(path.join(root,'js','netwizard-l3-config-utils.js'));
require(path.join(root,'js','netwizard-routing-utils.js'));
const Connectivity=require(path.join(root,'js','netwizard-connectivity-model.js'));

const Schema=require(path.join(root,'js','netwizard-project-schema.js'));
const Architecture=require(path.join(root,'js','netwizard-architecture-validator.js'));
const Cabling=require(path.join(root,'js','netwizard-structured-cabling.js'));
const Rack=require(path.join(root,'js','netwizard-rack-model.js'));
const Poe=require(path.join(root,'js','netwizard-poe-model.js'));
const Vtp=require(path.join(root,'js','netwizard-vtp-production-verification.js'));
const Ospf=require(path.join(root,'js','netwizard-ospf.js'));
const Reach=require(path.join(root,'js','netwizard-inter-site-reachability.js'));
const Wifi=require(path.join(root,'js','netwizard-wifi-planning.js'));
const Ipv6Vrf=require(path.join(root,'js','netwizard-ipv6-vrf.js'));
const Services=require(path.join(root,'js','netwizard-internal-services.js'));
const Capacity=require(path.join(root,'js','netwizard-traffic-capacity.js'));
const Access=require(path.join(root,'js','netwizard-access-security-plan.js'));
const Management=require(path.join(root,'js','netwizard-management-plan.js'));
global.NetWizardFieldInterventionPackage=require(path.join(root,'js','netwizard-field-intervention-package.js'));
global.NetWizardXlsxWriter=require(path.join(root,'js','netwizard-xlsx-writer.js'));
const Budget=require(path.join(root,'js','netwizard-budget.js'));
const PrivateWorker=require(path.join(root,'private','deployment-worker.js'));

const defaults=()=>({
  _schemaVersion:'3.50.0',step:'dash',projName:'',
  devices:[],ports:[],vlans:[],subnets:[],hosts:[],links:[],fwRules:[],
  vlanMatrix:{},dhcp:{},security:{},roas:{},vtp:{roles:{}},observedState:null,topo:{pos:{}},
  visual:{locs:[],assign:{devices:{},hosts:{}},pos:{},view:{}},
  iot:{accessNodes:[],devices:[],map:{show:{}}},
  physicalLocations:[],hostPhysicalLocations:[],uiSort:{},
  racks:[],rackItems:[],pdus:[],powerConnections:[],patchPanels:[],telecomOutlets:[],
  cableRuns:[],patchConnections:[],hostOutletConnections:[],
  wanCircuits:[],linkAggregations:[],trafficProfiles:[],internalServices:[],
  wifiControllers:[],wifiAccessPoints:[],wifiSsids:[],vrfs:[],ipv6Networks:[],failureScenarios:[],
  customDeviceModels:[]
});

const samplePath=path.join(root,'samples','golden-path-enterprise-complete.json');
const payload=JSON.parse(fs.readFileSync(samplePath,'utf8'));
assert.strictEqual(payload.format,'netwizard-project');
assert.strictEqual(payload.schemaVersion,'3.50.0');

const prepared=Schema.prepareImport(payload,{defaults});
assert.strictEqual(prepared.ok,true,(prepared.errors||[]).join('\n'));
const p=prepared.project;

assert.strictEqual(p.projName,'Golden Path Multisite Secure · 4 sedes');
assert.strictEqual(p.devices.length,12);
assert.strictEqual(p.devices.filter(d=>d.type==='router').length,4);
assert.strictEqual(p.devices.filter(d=>d.type==='switch').length,8);
assert.strictEqual(p.vlans.length,24);
assert.strictEqual(p.subnets.length,24);
assert.strictEqual(p.hosts.length,20);
assert.strictEqual(p.fwRules.length,116);
assert.strictEqual(p.linkAggregations.length,4);
assert.strictEqual(p.wifiAccessPoints.length,4);
assert.strictEqual(p.ipv6Networks.length,8);

const architecture=Architecture.validate(p);
assert.strictEqual(architecture.ok,true,architecture.errors.join('\n'));
assert.deepStrictEqual(architecture.warnings,[],'El golden principal no debe tener warnings arquitectónicos');

const cabling=Cabling.validate(p);
assert.strictEqual(cabling.ok,true,cabling.issues.map(x=>x.code+': '+x.message).join('\n'));
assert.strictEqual(cabling.paths.length,16);
assert.ok(cabling.paths.every(x=>x.complete));

const rack=Rack.validate(p);
assert.strictEqual(rack.ok,true,rack.issues.map(x=>x.code+': '+x.message).join('\n'));

const poe=Poe.collect({devices:p.devices,ports:p.ports,hosts:p.hosts});
for(const id of ['hq_access','north_access','east_access','south_access'])assert.strictEqual(poe.loadsByDevice[id],39,id+' PoE');

const vtp=Vtp.evaluateProject(p);
assert.strictEqual(vtp.ok,true,(vtp.issues||[]).map(x=>x.message).join('\n'));
assert.strictEqual((vtp.issues||[]).length,0);
assert.strictEqual(Object.keys(p.observedState.vtpDevices).length,8);

const ospf=Ospf.validateProject(p);
assert.strictEqual(ospf.ok,true,ospf.issues.map(x=>x.code+': '+x.message).join('\n'));
assert.strictEqual(ospf.issues.length,0);
assert.strictEqual(ospf.neighbors.length,8);
for(const id of ['hq_rtr','north_rtr','east_rtr','south_rtr'])assert.strictEqual(Ospf.compareObserved(p,id).ok,true,id+' OSPF observed');

for(const [src,dst] of [
  ['hq_sn_users','north_sn_users'],
  ['hq_sn_users','east_sn_users'],
  ['north_sn_servers','south_sn_servers'],
  ['east_sn_mgmt','hq_sn_mgmt']
]){
  const result=Reach.analyze(p,src,dst,'icmp');
  assert.strictEqual(result.reachable,true,src+' -> '+dst+': '+result.reason);
  assert.strictEqual(result.forward.strategy,'ospf');
  assert.strictEqual(result.forward.confidence,'observed');
  assert.strictEqual(result.reverse.confidence,'observed');
}

const appFlow=Connectivity.simulate(p,'hq_users_host','east_servers_host','https');
assert.strictEqual(appFlow.ok,true,appFlow.steps.map(x=>x.msg).join('\n'));
assert.strictEqual(appFlow.partial,false);

const blockedMgmt=Connectivity.simulate(p,'north_users_host','hq_mgmt_host','https');
assert.strictEqual(blockedMgmt.ok,false,'Usuarios no deben alcanzar MGMT');
assert.strictEqual(blockedMgmt.blockage.kind,'policy');

const blockedCctv=Connectivity.simulate(p,'hq_users_host','south_cctv_host','rtsp');
assert.strictEqual(blockedCctv.ok,false,'Usuarios no deben alcanzar CCTV');
assert.ok(['policy','firewall'].includes(blockedCctv.blockage.kind));

const degraded=JSON.parse(JSON.stringify(p));
degraded.links=degraded.links.filter(x=>x.id!=='link_hq_north');
degraded.observedState.ospfNeighbors.hq_rtr=degraded.observedState.ospfNeighbors.hq_rtr.filter(x=>x.localPortId!=='hq_north_a');
degraded.observedState.ospfNeighbors.north_rtr=degraded.observedState.ospfNeighbors.north_rtr.filter(x=>x.localPortId!=='hq_north_b');
const degradedOspf=Ospf.validateProject(degraded);
assert.strictEqual(degradedOspf.ok,true,degradedOspf.issues.map(x=>x.message).join('\n'));
const alternate=Reach.analyze(degraded,'hq_sn_users','north_sn_users','icmp');
assert.strictEqual(alternate.reachable,true,alternate.reason);
assert.ok(alternate.forward.hops.some(x=>x.peerDeviceId==='south_rtr'||x.deviceId==='south_rtr'),'El camino alternativo debe usar el lado SUR/LEVANTE del anillo');

const wifi=Wifi.validateProject(p);
assert.strictEqual(wifi.ok,true,wifi.issues.map(x=>x.code+': '+x.message).join('\n'));
assert.strictEqual(wifi.issues.length,0);
assert.strictEqual(wifi.summary.controllers,2);
assert.strictEqual(wifi.summary.accessPoints,4);
assert.strictEqual(wifi.summary.ssids,4);

const ipv6=Ipv6Vrf.validateProject(p);
assert.strictEqual(ipv6.ok,true,ipv6.issues.map(x=>x.code+': '+x.message).join('\n'));
assert.strictEqual(ipv6.issues.length,0);

const services=Services.validateProject(p);
assert.strictEqual(services.ok,true,services.issues.map(x=>x.code+': '+x.message).join('\n'));
assert.strictEqual(services.issues.length,0);

const capacity=Capacity.validateProject(p);
assert.strictEqual(capacity.ok,true,capacity.issues.map(x=>x.code+': '+x.message).join('\n'));
assert.strictEqual(capacity.issues.length,0);

const access=Access.build(p);
assert.strictEqual(access.ok,true,access.warnings.join('\n'));
assert.deepStrictEqual(access.warnings,[]);
assert.strictEqual(access.devices.length,8);

for(const id of ['hq_rtr','north_rtr','east_rtr','south_rtr','hq_core','north_core','east_core','south_core']){
  const mgmt=Management.build(p,id);
  assert.ok(mgmt);
  assert.deepStrictEqual(mgmt.warnings,[],id+' management debe quedar sin avisos');
}

const budgetValidation=Budget.validateProject(p);
assert.strictEqual(budgetValidation.ok,true,budgetValidation.issues.map(x=>x.code+': '+x.message).join('\n'));
assert.strictEqual(budgetValidation.issues.length,0);
const budget=Budget.build(p);
assert.strictEqual(budget.counts.unpriced,0,'Toda la BOM del golden debe tener precio');
assert.ok(budget.totals.year1Price>budget.totals.year1Cost);
assert.ok(budget.totals.monthlyRecurringPrice>0);

const privateResult=PrivateWorker.handle({project:p,generatedAt:'2026-10-02T00:55:00.000Z'});
assert.strictEqual(privateResult.ok,true,'El Private Engine debe generar todos los equipos del golden');
for(const d of p.devices){
  assert.strictEqual(privateResult.configReadiness[d.id].status,'apply-ready',d.id+': '+JSON.stringify(privateResult.configReadiness[d.id].reasons));
}
assert.strictEqual(privateResult.productionStatus,'ready');
assert.strictEqual(privateResult.productionReady,true);
assert.strictEqual(privateResult.productionGate.issues.length,0);

for(const id of ['hq_rtr','north_rtr','east_rtr','south_rtr']){
  const cfg=privateResult.configs[id];
  assert.match(cfg,/router ospf 10/);
  assert.match(cfg,/ip access-list extended NW_V/);
  assert.match(cfg,/ip access-group NW_V\d+_IN in/);
  assert.strictEqual((cfg.match(/^configure terminal$/gm)||[]).length,1);
  assert.strictEqual((cfg.match(/^end$/gm)||[]).length,1);
  assert.strictEqual((cfg.match(/^write memory$/gm)||[]).length,1);
}

console.log('✓ Golden Path Multisite Secure: 4 sedes, anillo OSPF, segmentación ACL, seguridad L2 y Production Gate READY');
