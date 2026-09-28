'use strict';

const assert=require('assert');
const fs=require('fs');
const path=require('path');
const vm=require('vm');

const source=fs.readFileSync(path.join(__dirname,'..','js','netwizard-production-gate-architecture.js'),'utf8');
const all=[
  'js/netwizard-browser-modules.js',
  'js/netwizard-architecture-validator.js',
  'js/netwizard-routing-plan.js',
  'js/netwizard-capability-registry.js',
  'js/netwizard-capability-ui.js',
  'js/netwizard-device-capability-form.js',
  'js/netwizard-physical-inventory.js',
  'js/netwizard-physical-inventory-ui.js',
  'js/netwizard-resilience-topology.js',
  'js/netwizard-resilience-ui.js',
  'js/netwizard-wan-circuits.js',
  'js/netwizard-wan-circuits-ui.js',
  'js/netwizard-traffic-capacity.js',
  'js/netwizard-traffic-capacity-ui.js',
  'js/netwizard-internal-services.js',
  'js/netwizard-internal-services-ui.js',
  'js/netwizard-wifi-planning.js',
  'js/netwizard-wifi-planning-ui.js',
  'js/netwizard-ipv6-vrf.js',
  'js/netwizard-ipv6-vrf-ui.js',
  'js/netwizard-failure-simulation.js',
  'js/netwizard-failure-simulation-ui.js',
  'js/netwizard-observed-drift.js',
  'js/netwizard-observed-drift-ui.js',
  'js/netwizard-detailed-report-v2.js',
  'js/netwizard-cisco-routing-integration.js',
  'js/netwizard-multivendor-routing-integration.js',
  'js/netwizard-firewall-edge-integration.js',
  'js/netwizard-switching-integration.js',
  'js/netwizard-access-security-integration.js',
  'js/netwizard-management-integration.js',
  'js/netwizard-ha-services-integration.js',
  'js/netwizard-production-gate-architecture.js'
];
const privatePaths=new Set([
  'js/netwizard-routing-plan.js',
  'js/netwizard-cisco-routing-integration.js',
  'js/netwizard-multivendor-routing-integration.js'
]);
const production=all.filter(x=>!privatePaths.has(x));
const appended=[];
const scripts=[
  {src:'https://example.test/js/netwizard-browser-modules.js'},
  {src:'https://example.test/js/netwizard-firewall-edge-integration.js'},
  {src:'https://example.test/js/netwizard-production-gate-architecture.js'}
];

const document={
  scripts,
  readyState:'loading',
  querySelector(){return null;},
  createElement(tag){
    assert.strictEqual(tag,'script');
    return {dataset:{},src:'',async:true,defer:true};
  },
  head:{appendChild(node){appended.push(node.src);scripts.push({src:new URL(node.src,'https://example.test/').href});}},
  addEventListener(){}
};

const root={
  console,
  URL,
  document,
  location:{href:'https://example.test/index.html'},
  setTimeout(){},
  addEventListener(){},
  NetWizardBrowserModules:{
    paths(options){return options&&options.production?production.slice():all.slice();}
  },
  NetWizardProductionGate:{runProductionGate(){return{issues:[]};},summarizeCounts(){return{};}}
};

for(const name of [
  'NetWizardArchitectureValidator','NetWizardCapabilityRegistry','NetWizardCapabilityUi','NetWizardDeviceCapabilityForm',
  'NetWizardPhysicalInventory','NetWizardPhysicalInventoryUi','NetWizardResilienceTopology','NetWizardResilienceUi',
  'NetWizardWanCircuits','NetWizardWanCircuitsUi','NetWizardTrafficCapacity','NetWizardTrafficCapacityUi',
  'NetWizardInternalServices','NetWizardInternalServicesUi','NetWizardWifiPlanning','NetWizardWifiPlanningUi',
  'NetWizardIpv6Vrf','NetWizardIpv6VrfUi','NetWizardFailureSimulation','NetWizardFailureSimulationUi',
  'NetWizardObservedDrift','NetWizardObservedDriftUi','NetWizardDetailedReport',
  'NetWizardSwitchingIntegration','NetWizardAccessSecurityIntegration','NetWizardManagementIntegration','NetWizardHaServicesIntegration'
]) root[name]={};

const context=vm.createContext({
  window:root,globalThis:root,console,URL,
  module:undefined,require:undefined
});
vm.runInContext(source,context,{filename:'netwizard-production-gate-architecture.js'});
const api=root.NetWizardProductionGateArchitecture;

assert.ok(api);
assert.strictEqual(api.sourceProfile(),false,'Sin scripts privados debe detectarse perfil production');
assert.strictEqual(api.moduleAllowed('./js/netwizard-routing-plan.js'),false);
assert.strictEqual(api.moduleAllowed('./js/netwizard-cisco-routing-integration.js'),false);
assert.strictEqual(api.moduleAllowed('./js/netwizard-firewall-edge-integration.js'),true);
assert.strictEqual(api.scriptPresent('./js/netwizard-firewall-edge-integration.js'),true);

delete root.NetWizardFirewallEdgeIntegration;
api.ensureIntegrations();

assert.ok(!appended.some(x=>x.includes('netwizard-routing-plan.js')),'No debe reinsertar routing plan privado');
assert.ok(!appended.some(x=>x.includes('netwizard-cisco-routing-integration.js')),'No debe reinsertar Cisco routing privado');
assert.ok(!appended.some(x=>x.includes('netwizard-multivendor-routing-integration.js')),'No debe reinsertar routing multivendor privado');
assert.ok(!appended.some(x=>x.includes('netwizard-firewall-edge-integration.js')),'No debe duplicar scripts ya presentes por src');

scripts.push({src:'https://example.test/js/netwizard-routing-plan.js'});
assert.strictEqual(api.sourceProfile(),true,'Con un módulo privado presente debe reconocerse perfil source');
assert.strictEqual(api.moduleAllowed('./js/netwizard-routing-plan.js'),true);

console.log('✓ El fallback de arquitectura respeta perfiles del manifiesto y evita scripts duplicados');
