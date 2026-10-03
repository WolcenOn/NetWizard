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
const Wan=require(path.join(root,'js','netwizard-wan-circuits.js'));
const Resilience=require(path.join(root,'js','netwizard-wan-resilience.js'));
const Wifi=require(path.join(root,'js','netwizard-wifi-planning.js'));
const Ipv6=require(path.join(root,'js','netwizard-ipv6-vrf.js'));
const Services=require(path.join(root,'js','netwizard-internal-services.js'));
const Capacity=require(path.join(root,'js','netwizard-traffic-capacity.js'));
const Failure=require(path.join(root,'js','netwizard-failure-simulation.js'));
const Access=require(path.join(root,'js','netwizard-access-security-plan.js'));
const Management=require(path.join(root,'js','netwizard-management-plan.js'));
const Budget=require(path.join(root,'js','netwizard-budget.js'));
const Vtp=require(path.join(root,'js','netwizard-vtp-production-verification.js'));
const Gate=require(path.join(root,'js','netwizard-production-gate.js'));
const PrivateWorker=require(path.join(root,'private','deployment-worker.js'));
const PrivateEngine=require(path.join(root,'private','vendor-config-engine.js'));

const payload=JSON.parse(fs.readFileSync(path.join(root,'samples','golden-path-corp-modern.json'),'utf8'));
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
  customDeviceModels:[],routing:{},highAvailability:{},accessSecurity:{},management:{}
});
const prepared=Schema.prepareImport(payload,{defaults});
assert.strictEqual(prepared.ok,true,(prepared.errors||[]).join('\n'));
const p=prepared.project;

assert.strictEqual(p.projName,'Golden Path · Empresa mediana moderna');
assert.strictEqual(p.devices.length,3);
assert.strictEqual(p.devices.filter(x=>x.type==='router').length,1);
assert.strictEqual(p.devices.filter(x=>x.type==='switch').length,2);
assert.strictEqual(p.vlans.length,8);
assert.strictEqual(p.routing.strategy,'static','Collapsed-core de una sede no necesita OSPF artificial');
assert.strictEqual(p.vlans.find(v=>v.id==='corp_v170').intent.type,'voice');
assert.strictEqual(p.vlans.find(v=>v.id==='corp_v110').name,'CORP-Finanzas-RRHH');
assert.strictEqual(p.vlans.find(v=>v.id==='corp_v130').name,'CORP-Usuarios-Operaciones');
assert.strictEqual(p.subnets.length,7);
assert.strictEqual(p.hosts.length,7);
assert.strictEqual(p.wanCircuits.length,2);
assert.strictEqual(p.linkAggregations.length,1);
assert.strictEqual(p.wifiAccessPoints.length,2);
assert.strictEqual(p.wifiSsids.length,2);
assert.strictEqual(p.ipv6Networks.length,7);
assert.strictEqual(p.failureScenarios.length,2);
assert.strictEqual(p.telecomOutlets.length,9);
assert.strictEqual(p.cableRuns.length,9);

const trusted=p.wifiSsids.find(x=>x.id==='ssid_corp_staff');
const guest=p.wifiSsids.find(x=>x.id==='ssid_corp_guest');
assert.strictEqual(trusted.security,'wpa3-enterprise');
assert.strictEqual(trusted.radiusServiceRef,'radius');
assert.strictEqual(trusted.clientIsolation,false);
assert.strictEqual(guest.security,'wpa3-personal');
assert.strictEqual(guest.clientIsolation,true);
assert.ok(p.wifiAccessPoints.every(ap=>ap.radios.some(r=>r.band==='6GHz')),'Los AP deben representar 6 GHz');
assert.ok(p.wifiAccessPoints.every(ap=>ap.radios.some(r=>r.band==='6GHz'&&r.channelWidthMHz===80)),'6 GHz debe usar 80 MHz para favorecer reutilización de canal');

assert.strictEqual(p.vlanMatrix['corp_v140_corp_v110'],false);
assert.strictEqual(p.vlanMatrix['corp_v140_corp_v160'],false);
assert.strictEqual(p.vlanMatrix['corp_v150_corp_v120'],false);
assert.strictEqual(p.vlanMatrix['corp_v130_corp_v110'],false);
assert.strictEqual(p.vlanMatrix['corp_v110_corp_v130'],false);
assert.strictEqual(p.vlanMatrix['corp_v110_corp_v140'],false);
assert.strictEqual(p.vlanMatrix['corp_v110_corp_v160'],false);
assert.strictEqual(p.vlanMatrix['corp_v110_corp_v170'],false);
assert.strictEqual(p.vlanMatrix['corp_v170_corp_v120'],true);
assert.strictEqual(p.vlanMatrix['corp_v160_corp_v170'],true);

assert.strictEqual(p.accessSecurity.dhcpSnooping,true);
assert.strictEqual(p.accessSecurity.arpInspection,true);
assert.strictEqual(p.accessSecurity.portSecurity,true);
assert.deepStrictEqual(p.management.sourceNetworks,['10.80.60.0/24']);
assert.strictEqual(p.management.ssh,true);
assert.strictEqual(p.management.aaa,false);
assert.strictEqual(p.management.snmpv3,false);

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

const wan=Wan.validateProject(p);
assert.strictEqual(wan.ok,true,wan.issues.map(x=>x.code+': '+x.message).join('\n'));
assert.strictEqual(wan.counts.blocking,0);
assert.strictEqual(wan.counts.warnings,0);

const resilience=Resilience.validateProject(p);
assert.strictEqual(resilience.ok,true,resilience.issues.map(x=>x.code+': '+x.message).join('\n'));
assert.strictEqual(resilience.counts.blocking,0);
assert.strictEqual(resilience.counts.warnings,0);

const wifi=Wifi.validateProject(p);
assert.strictEqual(wifi.ok,true,wifi.issues.map(x=>x.code+': '+x.message).join('\n'));
assert.strictEqual(wifi.counts.blocking,0);
assert.strictEqual(wifi.counts.warnings,0);
assert.strictEqual(wifi.summary.expectedClients,116);

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

const vtp=Vtp.evaluateProject(p);
assert.strictEqual(vtp.ok,true,(vtp.issues||[]).map(x=>x.message).join('\n'));

const access=Access.build(p);
assert.strictEqual(access.ok,true,(access.warnings||[]).join('\n'));
assert.deepStrictEqual(access.warnings||[],[]);

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

const privateResult=PrivateWorker.handle({project:p,generatedAt:'2026-10-03T12:00:00.000Z'});
assert.strictEqual(privateResult.ok,true,privateResult.productionGateSummaryMarkdown);
assert.strictEqual(privateResult.productionStatus,'ready',privateResult.productionGateSummaryMarkdown);
assert.strictEqual(privateResult.productionReady,true,privateResult.productionGateSummaryMarkdown);
for(const d of p.devices){
  assert.strictEqual(privateResult.configReadiness[d.id].status,'apply-ready',d.id+': '+JSON.stringify(privateResult.configReadiness[d.id].reasons));
}

const generated=PrivateEngine.generateAll(p);
assert.strictEqual(generated.ok,true,JSON.stringify(generated.issues));
const routerCfg=generated.configs.corp_rtr;
assert.match(routerCfg,/ip nat inside source list 100 interface GigabitEthernet0\/0 overload/);
assert.match(routerCfg,/ip nat inside source list 100 interface GigabitEthernet0\/4 overload/);
assert.match(routerCfg,/ip access-list extended FW_POLICY/);
assert.doesNotMatch(routerCfg,/ip access-list extended NW_SEG_/);
const cameraDnsV4=' permit udp 10.80.40.0 0.0.0.255 10.80.20.0 0.0.0.255 eq 53';
const cameraServicesDenyV4=' deny ip 10.80.40.0 0.0.0.255 10.80.20.0 0.0.0.255';
assert.ok(routerCfg.includes(cameraDnsV4),'Cámaras deben poder resolver DNS interno antes del aislamiento lateral');
assert.ok(routerCfg.indexOf(cameraDnsV4)<routerCfg.indexOf(cameraServicesDenyV4),'El permit DNS de cámaras debe preceder al deny hacia servicios');
assert.match(routerCfg,/^ipv6 unicast-routing$/m);
assert.match(routerCfg,/ipv6 access-list FW_POLICY_V6/);
const cameraDnsV6=' permit udp 2001:db8:80:40::/64 2001:db8:80:20::/64 eq 53';
const cameraServicesDenyV6=' deny ipv6 2001:db8:80:40::/64 2001:db8:80:20::/64';
assert.ok(routerCfg.includes(cameraDnsV6),'La excepción DNS interna debe conservar paridad IPv6');
assert.ok(routerCfg.indexOf(cameraDnsV6)<routerCfg.indexOf(cameraServicesDenyV6),'El permit DNS IPv6 debe preceder al deny lateral IPv6');
assert.match(generated.configs.corp_core,/interface Vlan160[\s\S]*ip address 10\.70\.60\.10 255\.255\.255\.0/);
assert.match(generated.configs.corp_access,/interface Vlan160[\s\S]*ip address 10\.70\.60\.11 255\.255\.255\.0/);

console.log('✓ Golden Empresa mediana: departamentos segmentados, voz, Wi-Fi corporativa, dual-stack, dual-WAN y Production Gate READY');
