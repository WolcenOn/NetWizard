'use strict';

const assert=require('assert');
const fs=require('fs');
const path=require('path');
const root=path.resolve(__dirname,'..');

require(path.join(root,'js','netwizard-audit.js'));
require(path.join(root,'js','netwizard-network-utils.js'));
require(path.join(root,'js','netwizard-l3-config-utils.js'));
require(path.join(root,'js','netwizard-routing-utils.js'));
const Schema=require(path.join(root,'js','netwizard-project-schema.js'));
const Architecture=require(path.join(root,'js','netwizard-architecture-validator.js'));
const Cabling=require(path.join(root,'js','netwizard-structured-cabling.js'));
const Rack=require(path.join(root,'js','netwizard-rack-model.js'));
const Connectivity=require(path.join(root,'js','netwizard-connectivity-model.js'));
const Ospf=require(path.join(root,'js','netwizard-ospf.js'));
const Wan=require(path.join(root,'js','netwizard-wan-circuits.js'));
const Resilience=require(path.join(root,'js','netwizard-wan-resilience.js'));
const Reach=require(path.join(root,'js','netwizard-inter-site-reachability.js'));
const Vtp=require(path.join(root,'js','netwizard-vtp-production-verification.js'));
const Wifi=require(path.join(root,'js','netwizard-wifi-planning.js'));
const Ipv6Vrf=require(path.join(root,'js','netwizard-ipv6-vrf.js'));
const Services=require(path.join(root,'js','netwizard-internal-services.js'));
const Capacity=require(path.join(root,'js','netwizard-traffic-capacity.js'));
const Failure=require(path.join(root,'js','netwizard-failure-simulation.js'));
const Access=require(path.join(root,'js','netwizard-access-security-plan.js'));
const Management=require(path.join(root,'js','netwizard-management-plan.js'));
const Ha=require(path.join(root,'js','netwizard-ha-services-plan.js'));
const PhysicalPlan=require(path.join(root,'js','netwizard-physical-intervention-plan.js'));
global.NetWizardPhysicalInterventionPlan=PhysicalPlan;
global.NetWizardObservedDrift=require(path.join(root,'js','netwizard-observed-drift.js'));
const Execution=require(path.join(root,'js','netwizard-intervention-execution.js'));
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

const samplePath=path.join(root,'samples','golden-path-multisite-clean.json');
const payload=JSON.parse(fs.readFileSync(samplePath,'utf8'));
const prepared=Schema.prepareImport(payload,{defaults});
assert.strictEqual(prepared.ok,true,(prepared.errors||[]).join('\n'));
const p=prepared.project;

assert.strictEqual(p.projName,'Golden Path Multisede Seguro · 4 sedes');
assert.strictEqual(p.devices.length,12);
assert.strictEqual(p.devices.filter(x=>x.type==='router').length,4);
assert.strictEqual(p.devices.filter(x=>x.type==='switch').length,8);
assert.strictEqual(p.vlans.length,32);
assert.strictEqual(p.subnets.length,28);
assert.strictEqual(p.hosts.length,24);
assert.strictEqual(p.links.length,16);
assert.strictEqual(p.wanCircuits.length,8);
assert.strictEqual(p.wifiAccessPoints.length,8);
assert.strictEqual(p.vrfs.length,0);
assert.strictEqual(p.ipv6Networks.length,12);
assert.strictEqual(p.racks.length,4);
assert.strictEqual(p.pdus.length,8);
assert.strictEqual(p.powerConnections.length,12);
assert.strictEqual(p.patchPanels.length,4);
assert.strictEqual(p.telecomOutlets.length,24);
assert.strictEqual(p.cableRuns.length,24);
assert.strictEqual(p.patchConnections.length,24);
assert.strictEqual(p.hostOutletConnections.length,24);
assert.strictEqual(p.failureScenarios.length,4);



const cabling=Cabling.validate(p);
assert.strictEqual(cabling.ok,true,cabling.issues.map(x=>x.code+': '+x.message).join('\n'));
assert.strictEqual(cabling.counts.blocking,0);
assert.strictEqual(cabling.counts.warnings,0);
assert.strictEqual(cabling.paths.length,24);
assert.ok(cabling.paths.every(x=>x.complete),'Los 24 hosts deben tener trazabilidad física completa');

const rack=Rack.validate(p);
assert.strictEqual(rack.ok,true,rack.issues.map(x=>x.code+': '+x.message).join('\n'));
assert.strictEqual(rack.counts.blocking,0);
assert.strictEqual(rack.counts.warnings,0);

const architecture=Architecture.validate(p);
assert.strictEqual(architecture.ok,true,architecture.issues.map(x=>x.code+': '+x.message).join('\n'));
assert.deepStrictEqual(architecture.warnings,[],'El Golden limpio no debe tener warnings de arquitectura');

const ospf=Ospf.validateProject(p);
assert.strictEqual(ospf.ok,true,ospf.issues.map(x=>x.code+': '+x.message).join('\n'));
assert.strictEqual(ospf.counts.blocking,0);
assert.strictEqual(ospf.counts.warnings,0);
assert.strictEqual(ospf.neighbors.length,8,'Cuatro enlaces routed deben producir ocho vecinos dirigidos');
for(const id of ['hq_rtr','north_rtr','east_rtr','south_rtr']){
  const observed=Ospf.compareObserved(p,id);
  assert.strictEqual(observed.ok,true,id+': OSPF observado debe coincidir con el To-Be');
  assert.strictEqual(observed.counts.expected,2,id+': cada router debe tener dos vecinos');
  assert.strictEqual(observed.counts.full,2,id+': ambos vecinos deben estar FULL');
}

const userSubnets=['hq_sn_users','north_sn_users','east_sn_users','south_sn_users'];
for(let i=0;i<userSubnets.length;i++){
  for(let j=i+1;j<userSubnets.length;j++){
    const r=Reach.analyze(p,userSubnets[i],userSubnets[j],'icmp');
    assert.strictEqual(r.reachable,true,userSubnets[i]+' -> '+userSubnets[j]+': '+r.reason);
    assert.strictEqual(r.forward.strategy,'ospf');
    assert.strictEqual(r.reverse.strategy,'ospf');
    assert.strictEqual(r.forward.confidence,'observed');
    assert.strictEqual(r.reverse.confidence,'observed');
  }
}

const degraded=JSON.parse(JSON.stringify(p));
degraded.links=degraded.links.filter(x=>x.id!=='link_hq_north');
const alternate=Reach.analyze(degraded,'hq_sn_users','north_sn_users','icmp');
assert.strictEqual(alternate.reachable,true,'HQ y Norte deben seguir comunicando tras perder un lado del anillo');
const alternateDevices=alternate.forward.hops.filter(x=>x.kind==='device').map(x=>x.deviceId);
assert.ok(alternateDevices.includes('south_rtr')&&alternateDevices.includes('east_rtr'),'La ruta alternativa debe rodear el anillo por Sur y Levante');

const allowed=Connectivity.simulate(p,'host:hq_user','host:south_server','https');
assert.strictEqual(allowed.ok,true,allowed.steps.map(x=>x.msg).join(' | '));
assert.strictEqual(allowed.partial,false);

const blockedGuest=Connectivity.simulate(p,'host:hq_guest','host:south_user','https');
assert.strictEqual(blockedGuest.ok,false);
assert.strictEqual(blockedGuest.blockage&&blockedGuest.blockage.kind,'policy');

const blockedCamera=Connectivity.simulate(p,'host:hq_camera','host:north_user','https');
assert.strictEqual(blockedCamera.ok,false);
assert.strictEqual(blockedCamera.blockage&&blockedCamera.blockage.kind,'policy');

const allowedUserService=Connectivity.simulate(p,'host:hq_user','host:east_server','https');
assert.strictEqual(allowedUserService.ok,true,'Usuarios deben poder consumir servicios publicados');

const blockedUserMgmt=Connectivity.simulate(p,'host:hq_user','host:east_admin','https');
assert.strictEqual(blockedUserMgmt.ok,false,'Usuarios no deben alcanzar la red de gestión');
assert.strictEqual(blockedUserMgmt.blockage&&blockedUserMgmt.blockage.kind,'policy');

const allowedMgmtService=Connectivity.simulate(p,'host:hq_admin','host:east_server','https');
assert.strictEqual(allowedMgmtService.ok,true,'Gestión debe poder alcanzar servicios internos');


const wan=Wan.validateProject(p);
assert.strictEqual(wan.ok,true,wan.issues.map(x=>x.code+': '+x.message).join('\n'));
assert.strictEqual(wan.counts.blocking,0);
assert.strictEqual(wan.counts.warnings,0);

const resilience=Resilience.validateProject(p);
assert.strictEqual(resilience.ok,true,resilience.issues.map(x=>x.code+': '+x.message).join('\n'));
assert.strictEqual(resilience.counts.blocking,0);
assert.strictEqual(resilience.counts.warnings,0);

for(const id of ['hq_rtr','north_rtr','east_rtr','south_rtr']){
  const ha=Ha.build(p,id);
  assert.strictEqual(ha.defaultRoutes.length,2,id+': primary + floating backup');
  assert.strictEqual(ha.tracking.length,1,id+': tracking del circuito principal');
}

const wifi=Wifi.validateProject(p);
assert.strictEqual(wifi.ok,true,wifi.issues.map(x=>x.code+': '+x.message).join('\n'));
assert.strictEqual(wifi.counts.blocking,0);
assert.strictEqual(wifi.counts.warnings,0);
assert.strictEqual(wifi.summary.controllers,2);
assert.strictEqual(wifi.summary.accessPoints,8);
assert.strictEqual(wifi.summary.ssids,8);


const ipv6=Ipv6Vrf.validateProject(p);
assert.strictEqual(ipv6.ok,true,ipv6.issues.map(x=>x.code+': '+x.message).join('\n'));
assert.strictEqual(ipv6.counts.blocking,0);
assert.strictEqual(ipv6.counts.warnings,0);
assert.ok(p.ipv6Networks.every(x=>!x.vrfRef),'IPv6 debe quedar validado sin activar VRF parcial en este Golden READY');

const services=Services.validateProject(p);
assert.strictEqual(services.ok,true,services.issues.map(x=>x.code+': '+x.message).join('\n'));
assert.strictEqual(services.counts.blocking,0);
assert.strictEqual(services.counts.warnings,0);

const capacity=Capacity.validateProject(p);
assert.strictEqual(capacity.ok,true,capacity.issues.map(x=>x.code+': '+x.message).join('\n'));
assert.strictEqual(capacity.counts.blocking,0);
assert.strictEqual(capacity.counts.warnings,0);

const failure=Failure.validateProject(p);
assert.strictEqual(failure.ok,true,failure.issues.map(x=>x.code+': '+x.message).join('\n'));
assert.strictEqual(failure.counts.blocking,0);
assert.strictEqual(failure.counts.warnings,0);
assert.ok(failure.scenarios.every(x=>x.status!=='failed'),'Los cuatro fallos de enlace deben sobrevivir por el camino alternativo OSPF');

const vtp=Vtp.evaluateProject(p);
assert.strictEqual(vtp.ok,true,(vtp.issues||[]).map(x=>x.message).join('\n'));

const access=Access.build(p);
assert.strictEqual(access.ok,true,(access.warnings||[]).join('\n'));
assert.deepStrictEqual(access.warnings||[],[]);

for(const d of p.devices){
  const mgmt=Management.build(p,d.id);
  assert.ok(mgmt,d.id+': debe tener plan de gestión');
  assert.deepStrictEqual(mgmt.warnings||[],[],d.id+': gestión sin warnings');
}



const fieldPlan=PhysicalPlan.buildChecklist(p);
assert.strictEqual(fieldPlan.ok,true,fieldPlan.message);
assert.deepStrictEqual(
  fieldPlan.actions.map(x=>x.id).sort(),
  ['device:add:south_access','power:add:south_pwr_south_access'],
  'La intervención Golden debe ser pequeña, explícita y completamente trazable'
);

const execution=Execution.build(p);
assert.strictEqual(execution.ok,true);
assert.strictEqual(execution.counts.total,2);
assert.strictEqual(execution.counts.done,2);
assert.strictEqual(execution.counts.pending,0);
assert.strictEqual(execution.counts.blocked,0);
assert.strictEqual(execution.counts.percent,100);

const acceptance=Execution.acceptanceChecks(p);
assert.strictEqual(acceptance.ready,true,acceptance.issues.map(x=>x.code+': '+x.message).join('\n'));
assert.strictEqual(acceptance.counts.blocking,0);
assert.strictEqual(acceptance.counts.warnings,0);

const budgetValidation=Budget.validateProject(p);
assert.strictEqual(budgetValidation.ok,true,budgetValidation.issues.map(x=>x.code+': '+x.message).join('\n'));
assert.strictEqual(budgetValidation.counts.blocking,0);
assert.strictEqual(budgetValidation.counts.warnings,0);
assert.strictEqual(budgetValidation.counts.unpriced,0,'Toda la BOM derivada debe estar valorada');
const budget=Budget.build(p);
assert.strictEqual(budget.counts.unpriced,0);
assert.ok(budget.totals.year1Price>budget.totals.year1Cost,'El presupuesto debe conservar margen positivo');
assert.ok(budget.totals.year1CustomerTotal>budget.totals.year1Price,'El total cliente debe incluir impuestos');

const privateResult=PrivateWorker.handle({project:p,generatedAt:'2026-10-01T20:10:00.000Z'});
assert.strictEqual(privateResult.ok,true,'Private Engine debe generar todos los artefactos');
assert.strictEqual(privateResult.productionStatus,'ready',privateResult.productionGate.summaryMarkdown);
assert.strictEqual(privateResult.productionReady,true);
assert.strictEqual(privateResult.productionGate.counts.errors,0);
assert.strictEqual(privateResult.productionGate.counts.warnings,0);
assert.strictEqual(privateResult.productionGate.counts.blocking,0);
for(const d of p.devices){
  assert.strictEqual(privateResult.configReadiness[d.id].status,'apply-ready',d.id+': '+JSON.stringify(privateResult.configReadiness[d.id].reasons));
}

const hqConfigPath=privateResult.configPaths.hq_rtr;
const hqConfigArtifact=privateResult.artifacts.find(x=>x.path===hqConfigPath);
assert.ok(hqConfigArtifact&&hqConfigArtifact.content,'Debe existir configuración privada para HQ router');
const hqConfig=hqConfigArtifact.content;
assert.match(hqConfig,/ip access-list extended NW_SEG_V110/);
assert.match(hqConfig,/deny ip 10\.10\.10\.0 0\.0\.0\.255 10\.30\.60\.0 0\.0\.0\.255/);
assert.match(hqConfig,/interface GigabitEthernet0\/1\.110[\s\S]*ip access-group NW_SEG_V110 in/);
assert.match(hqConfig,/ip access-list standard NW_MGMT_SOURCES/);
assert.match(hqConfig,/line vty 0 15[\s\S]*access-class NW_MGMT_SOURCES in[\s\S]*transport input ssh/);
assert.match(hqConfig,/ip access-list extended FW_POLICY/,'La política FW debe generarse por router');
assert.match(hqConfig,/interface GigabitEthernet0\/1\.140[\s\S]*ip access-group FW_POLICY in/,'La ACL FW debe quedar vinculada inbound a la subinterfaz de origen');

console.log('✓ Golden Path Multisede limpio: 4 routers en anillo, OSPF redundante, segmentación y Production Gate READY');
