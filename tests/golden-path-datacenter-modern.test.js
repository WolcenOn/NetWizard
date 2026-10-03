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
const Architecture=require(path.join(root,'js','netwizard-architecture-validator.js'));
const Cabling=require(path.join(root,'js','netwizard-structured-cabling.js'));
const Rack=require(path.join(root,'js','netwizard-rack-model.js'));
const TopologyResilience=require(path.join(root,'js','netwizard-resilience-topology.js'));
const Ospf=require(path.join(root,'js','netwizard-ospf.js'));
const Reach=require(path.join(root,'js','netwizard-inter-site-reachability.js'));
const Vtp=require(path.join(root,'js','netwizard-vtp-production-verification.js'));
const Ipv6=require(path.join(root,'js','netwizard-ipv6-vrf.js'));
const Services=require(path.join(root,'js','netwizard-internal-services.js'));
const Capacity=require(path.join(root,'js','netwizard-traffic-capacity.js'));
const Failure=require(path.join(root,'js','netwizard-failure-simulation.js'));
const Access=require(path.join(root,'js','netwizard-access-security-plan.js'));
const Management=require(path.join(root,'js','netwizard-management-plan.js'));
const Budget=require(path.join(root,'js','netwizard-budget.js'));
const Gate=require(path.join(root,'js','netwizard-production-gate.js'));
const PrivateWorker=require(path.join(root,'private','deployment-worker.js'));
const PrivateEngine=require(path.join(root,'private','vendor-config-engine.js'));

const payload=JSON.parse(fs.readFileSync(path.join(root,'samples','golden-path-datacenter-modern.json'),'utf8'));
assert.strictEqual(payload.format,'netwizard-project');
assert.strictEqual(payload.schemaVersion,'3.50.0');

const defaults=()=>({
  _schemaVersion:'3.50.0',step:'dash',projName:'',workflow:{mode:'design'},
  devices:[],ports:[],vlans:[],subnets:[],hosts:[],links:[],fwRules:[],
  vlanMatrix:{},dhcp:{},security:{},roas:{},vtp:{roles:{}},observedState:null,topo:{pos:{}},
  visual:{locs:[],assign:{devices:{},hosts:{}},pos:{},view:{}},
  iot:{accessNodes:[],devices:[],map:{show:{}}},
  physicalLocations:[],hostPhysicalLocations:[],uiSort:{},
  racks:[],rackItems:[],pdus:[],powerConnections:[],patchPanels:[],telecomOutlets:[],
  cableRuns:[],patchConnections:[],hostOutletConnections:[],
  wanCircuits:[],linkAggregations:[],trafficProfiles:[],internalServices:[],
  wifiControllers:[],wifiAccessPoints:[],wifiSsids:[],vrfs:[],ipv6Networks:[],failureScenarios:[],
  stacks:[],mlagDomains:[],haGroups:[],diversityPolicies:[],
  customDeviceModels:[],routing:{},highAvailability:{},accessSecurity:{},management:{}
});
const prepared=Schema.prepareImport(payload,{defaults});
assert.strictEqual(prepared.ok,true,(prepared.errors||[]).join('\n'));
const p=prepared.project;

assert.strictEqual(p.projName,'Golden Path · Datacenter leaf-spine moderno');
assert.strictEqual(p.devices.length,4);
assert.deepStrictEqual(p.devices.map(d=>d.name).sort(),['DC-LEAF-01','DC-LEAF-02','DC-SPINE-01','DC-SPINE-02']);
assert.ok(p.devices.every(d=>d.kind==='switch'&&d.l3Capable==='yes'&&d.vendorOs==='cisco_ios'));
assert.strictEqual(p.routing.strategy,'ospf');
assert.strictEqual(p.routing.protocol,'ospf');
assert.strictEqual(p.links.length,4);
assert.ok(p.links.every(l=>l.speed==='40G'&&String(l.medium).toLowerCase()==='fiber'&&String(l.cableType).toLowerCase()==='om4'));
assert.strictEqual(p.vlans.length,10);
assert.strictEqual(p.subnets.length,9);
assert.strictEqual(p.ipv6Networks.length,9);
assert.strictEqual(p.hosts.length,9);
assert.strictEqual(p.wanCircuits.length,0,'El Golden DC no inventa una WAN/edge fuera de su alcance');
assert.strictEqual(p.wifiSsids.length,0,'Wi-Fi no forma parte del fabric Datacenter de referencia');
assert.strictEqual(p.mlagDomains.length,0,'MLAG no debe fingirse sin generación canónica');
assert.strictEqual(p.vrfs.length,0,'VRF avanzada queda fuera del alcance de esta Golden');
assert.ok(!JSON.stringify(p).match(/\b(?:bgp|evpn|vxlan)\b/i),'BGP/EVPN/VXLAN no deben activarse sin soporte canónico');

for(const id of ['dc_spine1','dc_spine2','dc_leaf1','dc_leaf2']){
  assert.ok(p.ports.some(pt=>pt.deviceId===id&&pt.name==='Loopback0'&&pt.mode==='routed'),id+' debe tener loopback OSPF');
}
assert.strictEqual(p.ports.filter(pt=>pt.role==='transit'&&pt.mode==='routed').length,8,'Cuatro enlaces underlay tienen dos extremos L3');
assert.strictEqual(p.racks.length,2);
assert.strictEqual(p.pdus.length,4);
assert.strictEqual(p.powerConnections.length,8);
assert.strictEqual(p.telecomOutlets.length,9);
assert.strictEqual(p.cableRuns.length,9);

assert.strictEqual(p.vlanMatrix.dc_v110_dc_v121,true,'Frontend puede llegar al tier Backend');
assert.strictEqual(p.vlanMatrix.dc_v110_dc_v131,false,'Frontend no puede saltar directamente a Database');
assert.strictEqual(p.vlanMatrix.dc_v110_dc_v141,false,'Frontend no puede saltar directamente a Storage');
assert.strictEqual(p.vlanMatrix.dc_v160_dc_v131,true,'Gestión puede administrar Database');
assert.ok(p.fwRules.filter(r=>r.action==='allow'&&r.dst==='any').length>=9,'Cada VLAN enrutable conserva permit final tras los denies east-west');

const cabling=Cabling.validate(p);
assert.strictEqual(cabling.ok,true,cabling.issues.map(x=>x.code+': '+x.message).join('\n'));
assert.strictEqual(cabling.counts.blocking,0);
assert.strictEqual(cabling.counts.warnings,0);

const rack=Rack.validate(p);
assert.strictEqual(rack.ok,true,rack.issues.map(x=>x.code+': '+x.message).join('\n'));
assert.strictEqual(rack.counts.blocking,0);
assert.strictEqual(rack.counts.warnings,0);

const arch=Architecture.validate(p);
assert.strictEqual(arch.ok,true,arch.issues.map(x=>x.code+': '+x.message).join('\n'));
assert.deepStrictEqual(arch.warnings,[]);

const topology=TopologyResilience.validateProject(p);
assert.strictEqual(topology.ok,true,topology.issues.map(x=>x.code+': '+x.message).join('\n'));
assert.strictEqual(topology.counts.blocking,0);
assert.strictEqual(topology.counts.warnings,0);
assert.strictEqual(p.diversityPolicies.length,2);

const ospf=Ospf.validateProject(p);
assert.strictEqual(ospf.ok,true,ospf.issues.map(x=>x.code+': '+x.message).join('\n'));
assert.strictEqual(ospf.counts.blocking,0);
assert.strictEqual(ospf.counts.warnings,0);
assert.strictEqual(ospf.neighbors.length,8,'Cuatro enlaces producen ocho adyacencias dirigidas');
for(const id of ['dc_spine1','dc_spine2','dc_leaf1','dc_leaf2']){
  const observed=Ospf.compareObserved(p,id);
  assert.strictEqual(observed.ok,true,id+': '+JSON.stringify(observed));
  assert.strictEqual(observed.counts.missing,0);
  assert.strictEqual(observed.counts.mismatch,0);
  assert.strictEqual(observed.counts.unexpected,0);
}
const redundantPath=Ospf.adjacencyPath(p,'dc_leaf1','dc_leaf2',{useObserved:true});
assert.ok(redundantPath,'Los leaves deben estar unidos por underlay OSPF');
assert.strictEqual(redundantPath.confidence,'observed');
assert.strictEqual(redundantPath.devices.length,3,'Leaf → spine → leaf');

const allowed=Reach.analyze(p,'dc_s110','dc_s121','https');
assert.strictEqual(allowed.reachable,true,'Frontend-A → Backend-B HTTPS debe estar permitido: '+allowed.reason);
assert.strictEqual(allowed.forward.strategy,'ospf');
assert.strictEqual(allowed.forward.confidence,'observed');
assert.strictEqual(allowed.policy.explicit,true);
assert.strictEqual(allowed.policy.allowed,true);

const blocked=Reach.analyze(p,'dc_s110','dc_s131','https');
assert.strictEqual(blocked.reachable,false,'Frontend-A → Database-B debe estar bloqueado');
assert.strictEqual(blocked.policy.explicit,true);
assert.strictEqual(blocked.policy.allowed,false);

const vtp=Vtp.evaluateProject(p);
assert.strictEqual(vtp.ok,true,(vtp.issues||[]).map(x=>x.message).join('\n'));

const ipv6=Ipv6.validateProject(p);
assert.strictEqual(ipv6.ok,true,ipv6.issues.map(x=>x.code+': '+x.message).join('\n'));
assert.strictEqual(ipv6.counts.blocking,0);
assert.strictEqual(ipv6.counts.warnings,0);

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
assert.ok(failure.scenarios.every(x=>x.status!=='failed'));

const access=Access.build(p);
assert.strictEqual(access.ok,true,(access.warnings||[]).join('\n'));
assert.deepStrictEqual(access.warnings||[],[]);
assert.ok(access.devices.every(x=>x.accessPorts.every(pt=>pt.portSecurity===true)),'Los puertos server access conservan port-security');

for(const d of p.devices){
  const mgmt=Management.build(p,d.id);
  assert.ok(mgmt,d.id+': falta plan de gestión');
  assert.deepStrictEqual(mgmt.warnings||[],[],d.id+': gestión con warnings');
}

const budgetValidation=Budget.validateProject(p);
assert.strictEqual(budgetValidation.ok,true,budgetValidation.issues.map(x=>x.code+': '+x.message).join('\n'));
assert.strictEqual(budgetValidation.counts.blocking,0);
assert.strictEqual(budgetValidation.counts.warnings,0);
assert.strictEqual(budgetValidation.counts.unpriced,0);
const budget=Budget.build(p);
assert.strictEqual(budget.counts.unpriced,0);
assert.ok(budget.totals.year1Price>budget.totals.year1Cost);

const gate=Gate.runProductionGate(p,{productionMode:true,strict:true});
assert.strictEqual(gate.status,'ready',Gate.summarizeGate(gate));
assert.strictEqual(gate.ready,true,Gate.summarizeGate(gate));
assert.strictEqual(gate.counts.blocking,0,Gate.summarizeGate(gate));
assert.strictEqual(gate.counts.warnings,0,Gate.summarizeGate(gate));

const privateResult=PrivateWorker.handle({project:p,generatedAt:'2026-10-03T18:30:00.000Z'});
assert.strictEqual(privateResult.ok,true,privateResult.productionGateSummaryMarkdown);
assert.strictEqual(privateResult.productionStatus,'ready',privateResult.productionGateSummaryMarkdown);
assert.strictEqual(privateResult.productionReady,true,privateResult.productionGateSummaryMarkdown);
for(const d of p.devices){
  assert.strictEqual(privateResult.configReadiness[d.id].status,'apply-ready',d.id+': '+JSON.stringify(privateResult.configReadiness[d.id].reasons));
}

const generated=PrivateEngine.generateAll(p);
assert.strictEqual(generated.ok,true,JSON.stringify(generated.issues));
for(const id of ['dc_spine1','dc_spine2','dc_leaf1','dc_leaf2']){
  const cfg=generated.configs[id];
  assert.match(cfg,/^ip routing$/m);
  assert.match(cfg,/router ospf 10/);
  assert.match(cfg,/no passive-interface FortyGigabitEthernet/);
  assert.strictEqual((cfg.match(/^configure terminal$/gm)||[]).length,1,id+' configure terminal');
  assert.strictEqual((cfg.match(/^end$/gm)||[]).length,1,id+' end');
  assert.strictEqual((cfg.match(/^write memory$/gm)||[]).length,1,id+' write memory');
  assert.doesNotMatch(cfg,/\b(?:bgp|evpn|vxlan)\b/i);
  assert.doesNotMatch(cfg,/ip access-list extended NW_SEG_/);
}
for(const id of ['dc_leaf1','dc_leaf2']){
  const cfg=generated.configs[id];
  assert.match(cfg,/ip access-list extended FW_POLICY/);
  assert.match(cfg,/ipv6 access-list FW_POLICY_V6/);
  assert.match(cfg,/^ipv6 unicast-routing$/m);
  assert.match(cfg,/no switchport/);
}
assert.match(generated.configs.dc_leaf1,/interface Vlan110[\s\S]*ip address 10\.90\.10\.1 255\.255\.255\.128[\s\S]*ipv6 address 2001:db8:90:110::1\/64[\s\S]*ip access-group FW_POLICY in[\s\S]*ipv6 traffic-filter FW_POLICY_V6 in/);
assert.match(generated.configs.dc_leaf2,/interface Vlan131[\s\S]*ip address 10\.90\.31\.1 255\.255\.255\.192[\s\S]*ipv6 address 2001:db8:90:131::1\/64[\s\S]*ip access-group FW_POLICY in[\s\S]*ipv6 traffic-filter FW_POLICY_V6 in/);
const leaf1=generated.configs.dc_leaf1;
const feDbDeny=' deny ip 10.90.10.0 0.0.0.127 10.90.31.0 0.0.0.63 ! vlanMatrix 110->131';
const feCatchAll=' permit ip 10.90.10.0 0.0.0.127 any ! Permitir tráfico no bloqueado desde dc_v110';
assert.ok(leaf1.includes(feDbDeny),'FW_POLICY debe contener el bloqueo Frontend→Database');
assert.ok(leaf1.includes(feCatchAll),'FW_POLICY debe conservar el permit final de Frontend');
assert.ok(leaf1.indexOf(feDbDeny)<leaf1.indexOf(feCatchAll),'El deny east-west debe preceder al permit final');

console.log('✓ Golden Datacenter: leaf-spine L3, OSPF redundante, east-west dual-stack, físico A/B y Production Gate READY');
