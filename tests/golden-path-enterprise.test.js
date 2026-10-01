'use strict';

const assert=require('assert');
const fs=require('fs');
const path=require('path');
const root=path.resolve(__dirname,'..');

require(path.join(root,'js','netwizard-audit.js'));
require(path.join(root,'js','netwizard-network-utils.js'));
require(path.join(root,'js','netwizard-l3-config-utils.js'));
require(path.join(root,'js','netwizard-routing-utils.js'));
require(path.join(root,'js','netwizard-connectivity-model.js'));

const Schema=require(path.join(root,'js','netwizard-project-schema.js'));
const Cabling=require(path.join(root,'js','netwizard-structured-cabling.js'));
const Rack=require(path.join(root,'js','netwizard-rack-model.js'));
const Poe=require(path.join(root,'js','netwizard-poe-model.js'));
const Wan=require(path.join(root,'js','netwizard-wan-circuits.js'));
const Vtp=require(path.join(root,'js','netwizard-vtp-production-verification.js'));
const Ospf=require(path.join(root,'js','netwizard-ospf.js'));
const Reach=require(path.join(root,'js','netwizard-inter-site-reachability.js'));
const Vpn=require(path.join(root,'js','netwizard-site-to-site-vpn.js'));
const Resilience=require(path.join(root,'js','netwizard-wan-resilience.js'));
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

const samplePath=path.join(root,'samples','golden-path-enterprise-complete.json');
const payload=JSON.parse(fs.readFileSync(samplePath,'utf8'));
assert.strictEqual(payload.format,'netwizard-project');
assert.strictEqual(payload.schemaVersion,'3.50.0');

const prepared=Schema.prepareImport(payload,{defaults});
assert.strictEqual(prepared.ok,true,(prepared.errors||[]).join('\n'));
const p=prepared.project;

assert.strictEqual(p.projName,'Golden Path Enterprise · HQ + Sucursal');
assert.strictEqual(p.devices.length,11);
assert.strictEqual(p.ports.length,58);
assert.strictEqual(p.vlans.length,12);
assert.strictEqual(p.subnets.length,12);
assert.strictEqual(p.hosts.length,22);
assert.strictEqual(p.wanCircuits.length,4);
assert.strictEqual(p.linkAggregations.length,3);
assert.strictEqual(p.wifiAccessPoints.length,4);
assert.strictEqual(p.ipv6Networks.length,6);
assert.strictEqual(p.internalServices.length,4);
assert.strictEqual(p.cableRuns.length,18);

const cabling=Cabling.validate(p);
assert.strictEqual(cabling.ok,true,cabling.issues.map(x=>x.code+': '+x.message).join('\n'));
assert.strictEqual(cabling.paths.length,18);
assert.ok(cabling.paths.every(x=>x.complete));

const rack=Rack.validate(p);
assert.strictEqual(rack.ok,true,rack.issues.map(x=>x.code+': '+x.message).join('\n'));

const poe=Poe.collect({devices:p.devices,ports:p.ports,hosts:p.hosts});
assert.strictEqual(poe.loadsByDevice.hq_access1,78);
assert.strictEqual(poe.loadsByDevice.br_access1,78);
assert.strictEqual(poe.loadsByDevice.br_access2||0,0);

const wan=Wan.validateProject(p);
assert.strictEqual(wan.ok,true,wan.issues.map(x=>x.code+': '+x.message).join('\n'));

const vtp=Vtp.evaluateProject(p);
assert.strictEqual(vtp.ok,true,(vtp.issues||[]).map(x=>x.message).join('\n'));
assert.strictEqual(Object.keys(p.observedState.vtpDevices).length,5);

const ospf=Ospf.validateProject(p);
assert.strictEqual(ospf.ok,true,ospf.issues.map(x=>x.code+': '+x.message).join('\n'));
assert.strictEqual(ospf.neighbors.length,2);
assert.strictEqual(Ospf.compareObserved(p,'hq_rtr').ok,true);
assert.strictEqual(Ospf.compareObserved(p,'br_rtr').ok,true);

const reach=Reach.analyze(p,'hq_sn_users','br_sn_users','icmp');
assert.strictEqual(reach.reachable,true,reach.reason);
assert.strictEqual(reach.forward.strategy,'ospf');
assert.strictEqual(reach.forward.confidence,'observed');
assert.strictEqual(reach.reverse.confidence,'observed');

const vpn=Vpn.validateProject(p);
assert.strictEqual(vpn.ok,true,vpn.issues.map(x=>x.code+': '+x.message).join('\n'));
assert.strictEqual(vpn.plans.length,2);
assert.strictEqual(vpn.plans.filter(x=>x.role==='primary').length,1);
assert.strictEqual(vpn.plans.filter(x=>x.role==='backup').length,1);

const resilience=Resilience.validateProject(p);
assert.strictEqual(resilience.ok,true,resilience.issues.map(x=>x.code+': '+x.message).join('\n'));
assert.strictEqual(resilience.vpnGroups.length,1);
assert.strictEqual(resilience.vpnGroups[0].redundant,true);

const wifi=Wifi.validateProject(p);
assert.strictEqual(wifi.ok,true,wifi.issues.map(x=>x.code+': '+x.message).join('\n'));
assert.strictEqual(wifi.summary.controllers,2);
assert.strictEqual(wifi.summary.accessPoints,4);
assert.strictEqual(wifi.summary.ssids,2);

const ipv6=Ipv6Vrf.validateProject(p);
assert.strictEqual(ipv6.ok,true,ipv6.issues.map(x=>x.code+': '+x.message).join('\n'));

const services=Services.validateProject(p);
assert.strictEqual(services.ok,true,services.issues.map(x=>x.code+': '+x.message).join('\n'));

const capacity=Capacity.validateProject(p);
assert.strictEqual(capacity.ok,true,capacity.issues.map(x=>x.code+': '+x.message).join('\n'));

const failure=Failure.validateProject(p);
assert.strictEqual(failure.ok,true,failure.issues.map(x=>x.code+': '+x.message).join('\n'));
assert.strictEqual(failure.scenarios.length,2);
assert.ok(failure.scenarios.every(x=>x.status!=='failed'));

const access=Access.build(p);
assert.strictEqual(access.ok,true,access.warnings.join('\n'));
assert.strictEqual(access.devices.length,5);

for(const id of ['hq_rtr','br_rtr','hq_core','br_core']){
  const mgmt=Management.build(p,id);
  assert.ok(mgmt);
  assert.deepStrictEqual(mgmt.warnings,[],id+' management debe quedar sin avisos');
}
for(const id of ['hq_rtr','br_rtr']){
  const ha=Ha.build(p,id);
  assert.strictEqual(ha.defaultRoutes.length,2,id+' debe tener primary + floating backup');
  assert.strictEqual(ha.tracking.length,1,id+' debe tener probe de tracking');
}

const fieldPlan=PhysicalPlan.buildChecklist(p);
assert.strictEqual(fieldPlan.ok,true,fieldPlan.message);
assert.deepStrictEqual(fieldPlan.actions.map(x=>x.id).sort(),['device:add:br_access2','power:add:br_pwr_access2']);

const acceptance=Execution.acceptanceChecks(p);
assert.strictEqual(acceptance.ready,true,acceptance.issues.map(x=>x.code+': '+x.message).join('\n'));
assert.strictEqual(acceptance.execution.counts.done,2);
assert.strictEqual(acceptance.execution.counts.pending,0);

const budgetValidation=Budget.validateProject(p);
assert.strictEqual(budgetValidation.ok,true,budgetValidation.issues.map(x=>x.code+': '+x.message).join('\n'));
const budget=Budget.build(p);
assert.strictEqual(budget.counts.unpriced,0,'Toda la BOM del golden debe tener referencia económica');
assert.ok(budget.totals.year1Price>budget.totals.year1Cost);
assert.ok(budget.totals.monthlyRecurringPrice>0);
assert.ok(budget.totals.grossMarginPct>0);

const privateResult=PrivateWorker.handle({project:p,generatedAt:'2026-10-01T16:20:00.000Z'});
assert.strictEqual(privateResult.ok,true,'El Private Engine debe generar configs/change set/runbook aunque el gate bloquee secretos');
for(const id of ['hq_core','hq_access1','br_core','br_access1','br_access2']){
  assert.strictEqual(privateResult.configReadiness[id].status,'apply-ready',id+' debe quedar apply-ready');
}
for(const id of ['hq_rtr','br_rtr']){
  assert.strictEqual(privateResult.configReadiness[id].status,'review-required',id+' debe exigir resolución de secretos VPN');
  assert.ok(privateResult.configReadiness[id].reasons.some(x=>/alias de secretos/i.test(x)),id+' debe explicar el alias no resuelto');
}
assert.strictEqual(privateResult.productionStatus,'blocked');
assert.strictEqual(privateResult.productionReady,false);
assert.ok(privateResult.productionGate.issues.some(x=>x.code==='NW-PRIVATE-GATE-010'&&x.deviceId==='hq_rtr'));
assert.ok(privateResult.productionGate.issues.some(x=>x.code==='NW-PRIVATE-GATE-010'&&x.deviceId==='br_rtr'));

console.log('✓ Golden Path Enterprise: físico + L2/L3 + OSPF + VPN + WAN + Wi-Fi + IPv6/VRF + servicios + ejecución + presupuesto');
