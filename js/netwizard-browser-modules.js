/* NetWizard browser module manifest v1 */
(function initNetWizardBrowserModules(root){
'use strict';
const modules=[
  {
    "path": "js/netwizard-browser-modules.js",
    "requiredGlobal": "NetWizardBrowserModules"
  },
  {
    "path": "js/netwizard-core-utils.js"
  },
  {
    "path": "js/netwizard-security-utils.js"
  },
  {
    "path": "js/netwizard-i18n.js"
  },
  {
    "path": "js/netwizard-auth-client.js"
  },
  {
    "path": "js/netwizard-network-utils.js"
  },
  {
    "path": "js/netwizard-device-model.js",
    "requiredGlobal": "NetWizardDeviceModel"
  },
  {
    "path": "js/netwizard-project-schema.js",
    "dependsOn": [
      "js/netwizard-device-model.js"
    ],
    "requiredGlobal": "NetWizardProjectSchema"
  },
  {
    "path": "js/netwizard-audit.js"
  },
  {
    "path": "js/netwizard-l3-config-utils.js"
  },
  {
    "path": "js/netwizard-routing-utils.js"
  },
  {
    "path": "js/netwizard-dhcp-utils.js"
  },
  {
    "path": "js/netwizard-change-preview.js"
  },
  {
    "path": "js/netwizard-policy-utils.js"
  },
  {
    "path": "js/netwizard-v5-core.js"
  },
  {
    "path": "js/netwizard-v5-renderer.js",
    "dependsOn": [
      "js/netwizard-v5-core.js"
    ]
  },
  {
    "path": "js/netwizard-v5-interaction.js",
    "dependsOn": [
      "js/netwizard-v5-core.js"
    ]
  },
  {
    "path": "js/netwizard-v5-scene.js",
    "dependsOn": [
      "js/netwizard-v5-core.js",
      "js/netwizard-v5-renderer.js",
      "js/netwizard-v5-interaction.js"
    ]
  },
  {
    "path": "js/netwizard-v5-drag-controller.js",
    "dependsOn": [
      "js/netwizard-v5-interaction.js"
    ]
  },
  {
    "path": "js/netwizard-v5-location-transactions.js"
  },
  {
    "path": "js/netwizard-v5-commands.js",
    "dependsOn": [
      "js/netwizard-v5-location-transactions.js"
    ]
  },
  {
    "path": "js/netwizard-v5-panel.js"
  },
  {
    "path": "js/netwizard-v5-controls.js"
  },
  {
    "path": "js/netwizard-wizard-presets.js"
  },
  {
    "path": "js/netwizard.js",
    "requiredGlobal": "NetWizardState"
  },
  {
    "path": "js/netwizard-design-requirements.js",
    "requiredGlobal": "NetWizardDesignRequirements"
  },
  {
    "path": "js/netwizard-design-requirements-ui.js",
    "dependsOn": [
      "js/netwizard-design-requirements.js",
      "js/netwizard.js"
    ],
    "requiredGlobal": "NetWizardDesignRequirementsUi"
  },
  {
    "path": "js/netwizard-v5-bridge.js",
    "dependsOn": [
      "js/netwizard.js",
      "js/netwizard-v5-core.js",
      "js/netwizard-v5-renderer.js",
      "js/netwizard-v5-interaction.js",
      "js/netwizard-v5-scene.js",
      "js/netwizard-v5-commands.js"
    ]
  },
  {
    "path": "js/netwizard-sample-four-sites.js"
  },
  {
    "path": "js/netwizard-bulk-port-editor.js"
  },
  {
    "path": "js/netwizard-config-pipeline.js",
    "requiredGlobal": "NetWizardConfigPipeline"
  },
  {
    "path": "js/netwizard-vendor-config-generators.js",
    "dependsOn": [
      "js/netwizard-config-pipeline.js",
      "js/netwizard.js"
    ],
    "requiredGlobal": "NetWizardVendorConfigGenerators"
  },
  {
    "path": "js/netwizard-bridge.js"
  },
  {
    "path": "js/netwizard-bridge-ui.js"
  },
  {
    "path": "js/netwizard-graph-viewer.js"
  },
  {
    "path": "js/netwizard-iot-publisher.js"
  },
  {
    "path": "js/netwizard-iot-embedded.js"
  },
  {
    "path": "js/netwizard-unified-config-map.js"
  },
  {
    "path": "js/netwizard-v5-iot-extension.js"
  },
  {
    "path": "js/netwizard-v5-layout-manager.js"
  },
  {
    "path": "js/netwizard-cabling-utils.js"
  },
  {
    "path": "js/netwizard-poe-utils.js"
  },
  {
    "path": "js/netwizard-poe-model.js"
  },
  {
    "path": "js/netwizard-broadcast-utils.js"
  },
  {
    "path": "js/netwizard-l2-utils.js"
  },
  {
    "path": "js/netwizard-vlsm-physical-planner.js",
    "requiredGlobal": "NetWizardPlanner"
  },
  {
    "path": "js/netwizard-vlan-intent.js"
  },
  {
    "path": "js/netwizard-history.js"
  },
  {
    "path": "js/netwizard-change-plan.js"
  },
  {
    "path": "js/netwizard-documentation-utils.js"
  },
  {
    "path": "js/netwizard-vendor-hardening.js"
  },
  {
    "path": "js/netwizard-production-gate.js",
    "requiredGlobal": "NetWizardProductionGate"
  },
  {
    "path": "js/netwizard-connectivity-model.js"
  },
  {
    "path": "js/netwizard-connectivity-checker.js"
  },
  {
    "path": "js/netwizard-v5-connectivity-trace.js"
  },
  {
    "path": "js/netwizard-architecture-validator.js",
    "requiredGlobal": "NetWizardArchitectureValidator"
  },
  {
    "path": "js/netwizard-routing-plan.js",
    "production": false
  },
  {
    "path": "js/netwizard-capability-registry.js",
    "requiredGlobal": "NetWizardCapabilityRegistry"
  },
  {
    "path": "js/netwizard-capability-ui.js",
    "requiredGlobal": "NetWizardCapabilityUi"
  },
  {
    "path": "js/netwizard-device-capability-form.js",
    "requiredGlobal": "NetWizardDeviceCapabilityForm"
  },
  {
    "path": "js/netwizard-custom-device-models.js"
  },
  {
    "path": "js/netwizard-global-device-catalog.js"
  },
  {
    "path": "js/netwizard-custom-device-model-ui.js"
  },
  {
    "path": "js/netwizard-physical-inventory.js",
    "requiredGlobal": "NetWizardPhysicalInventory"
  },
  {
    "path": "js/netwizard-structured-cabling.js",
    "requiredGlobal": "NetWizardStructuredCabling"
  },
  {
    "path": "js/netwizard-rack-model.js",
    "dependsOn": [
      "js/netwizard-structured-cabling.js"
    ],
    "requiredGlobal": "NetWizardRackModel"
  },
  {
    "path": "js/netwizard-rack-ui.js",
    "dependsOn": [
      "js/netwizard-rack-model.js",
      "js/netwizard.js"
    ],
    "requiredGlobal": "NetWizardRackUi"
  },
  {
    "path": "js/netwizard-structured-cabling-ui.js",
    "dependsOn": [
      "js/netwizard-structured-cabling.js",
      "js/netwizard.js"
    ],
    "requiredGlobal": "NetWizardStructuredCablingUi"
  },
  {
    "path": "js/netwizard-rack-production-integration.js",
    "dependsOn": [
      "js/netwizard-production-gate.js",
      "js/netwizard-rack-model.js",
      "js/netwizard-structured-cabling.js",
      "js/netwizard-rack-ui.js",
      "js/netwizard-structured-cabling-ui.js"
    ],
    "requiredGlobal": "NetWizardRackProductionIntegration"
  },
  {
    "path": "js/netwizard-report-model.js",
    "dependsOn": [
      "js/netwizard-poe-model.js",
      "js/netwizard-rack-model.js",
      "js/netwizard-structured-cabling.js"
    ],
    "requiredGlobal": "NetWizardReportModel"
  },
  {
    "path": "js/netwizard-inventory-gate.js",
    "dependsOn": [
      "js/netwizard-physical-inventory.js",
      "js/netwizard-rack-model.js",
      "js/netwizard-structured-cabling.js"
    ],
    "requiredGlobal": "NetWizardInventoryGate"
  },
  {
    "path": "js/netwizard-physical-inventory-ui.js",
    "requiredGlobal": "NetWizardPhysicalInventoryUi"
  },
  {
    "path": "js/netwizard-inventory-golden-path-ui.js",
    "requiredGlobal": "NetWizardInventoryGoldenPathUi"
  },
  {
    "path": "js/netwizard-physical-intervention-plan.js",
    "requiredGlobal": "NetWizardPhysicalInterventionPlan"
  },
  {
    "path": "js/netwizard-field-intervention-package.js",
    "requiredGlobal": "NetWizardFieldInterventionPackage"
  },
  {
    "path": "js/netwizard-intervention-closeout.js",
    "requiredGlobal": "NetWizardInterventionCloseout"
  },
  {
    "path": "js/netwizard-inventory-design-bridge.js",
    "requiredGlobal": "NetWizardInventoryDesignBridge"
  },
  {
    "path": "js/netwizard-inventory-design-bridge-ui.js",
    "requiredGlobal": "NetWizardInventoryDesignBridgeUi"
  },
  {
    "path": "js/netwizard-physical-intervention-ui.js",
    "requiredGlobal": "NetWizardPhysicalInterventionUi"
  },
  {
    "path": "js/netwizard-field-execution-ui.js"
  },
  {
    "path": "js/netwizard-intervention-closeout-ui.js",
    "requiredGlobal": "NetWizardInterventionCloseoutUi"
  },
  {
    "path": "js/netwizard-intervention-history.js"
  },
  {
    "path": "js/netwizard-intervention-history-ui.js"
  },
  {
    "path": "js/netwizard-xlsx-writer.js"
  },
  {
    "path": "js/netwizard-asbuilt-exports.js"
  },
  {
    "path": "js/netwizard-asbuilt-exports-ui.js"
  },
  {
    "path": "js/netwizard-resilience-topology.js",
    "requiredGlobal": "NetWizardResilienceTopology"
  },
  {
    "path": "js/netwizard-resilience-ui.js",
    "requiredGlobal": "NetWizardResilienceUi"
  },
  {
    "path": "js/netwizard-wan-circuits.js",
    "requiredGlobal": "NetWizardWanCircuits"
  },
  {
    "path": "js/netwizard-wan-circuits-ui.js",
    "requiredGlobal": "NetWizardWanCircuitsUi"
  },
  {
    "path": "js/netwizard-traffic-capacity.js",
    "requiredGlobal": "NetWizardTrafficCapacity"
  },
  {
    "path": "js/netwizard-traffic-capacity-ui.js",
    "requiredGlobal": "NetWizardTrafficCapacityUi"
  },
  {
    "path": "js/netwizard-internal-services.js",
    "requiredGlobal": "NetWizardInternalServices"
  },
  {
    "path": "js/netwizard-internal-services-ui.js",
    "requiredGlobal": "NetWizardInternalServicesUi"
  },
  {
    "path": "js/netwizard-wifi-planning.js",
    "requiredGlobal": "NetWizardWifiPlanning"
  },
  {
    "path": "js/netwizard-wifi-planning-ui.js",
    "requiredGlobal": "NetWizardWifiPlanningUi"
  },
  {
    "path": "js/netwizard-ipv6-vrf.js",
    "requiredGlobal": "NetWizardIpv6Vrf"
  },
  {
    "path": "js/netwizard-ipv6-vrf-ui.js",
    "requiredGlobal": "NetWizardIpv6VrfUi"
  },
  {
    "path": "js/netwizard-failure-simulation.js",
    "requiredGlobal": "NetWizardFailureSimulation"
  },
  {
    "path": "js/netwizard-failure-simulation-ui.js",
    "requiredGlobal": "NetWizardFailureSimulationUi"
  },
  {
    "path": "js/netwizard-observed-drift.js",
    "requiredGlobal": "NetWizardObservedDrift"
  },
  {
    "path": "js/netwizard-observed-drift-ui.js",
    "requiredGlobal": "NetWizardObservedDriftUi"
  },
  {
    "path": "js/netwizard-detailed-report-v2.js",
    "requiredGlobal": "NetWizardDetailedReport"
  },
  {
    "path": "js/netwizard-detailed-report-v3.js",
    "dependsOn": [
      "js/netwizard-report-model.js"
    ],
    "requiredGlobal": "NetWizardInstallationReport"
  },
  {
    "path": "js/netwizard-cisco-routing-generator.js",
    "production": false
  },
  {
    "path": "js/netwizard-multivendor-routing-generator.js",
    "production": false
  },
  {
    "path": "js/netwizard-firewall-edge-generator.js",
    "requiredGlobal": "NetWizardFirewallEdgeGenerator"
  },
  {
    "path": "js/netwizard-switching-generator.js",
    "requiredGlobal": "NetWizardSwitchingGenerator"
  },
  {
    "path": "js/netwizard-access-security-plan.js"
  },
  {
    "path": "js/netwizard-access-security-generator.js",
    "requiredGlobal": "NetWizardAccessSecurityGenerator"
  },
  {
    "path": "js/netwizard-management-plan.js"
  },
  {
    "path": "js/netwizard-management-generator.js",
    "requiredGlobal": "NetWizardManagementGenerator"
  },
  {
    "path": "js/netwizard-ha-services-plan.js"
  },
  {
    "path": "js/netwizard-ha-services-generator.js",
    "requiredGlobal": "NetWizardHaServicesGenerator"
  },
  {
    "path": "js/netwizard-cisco-routing-integration.js",
    "production": false
  },
  {
    "path": "js/netwizard-multivendor-routing-integration.js",
    "production": false
  },
  {
    "path": "js/netwizard-firewall-edge-integration.js",
    "requiredGlobal": "NetWizardFirewallEdgeIntegration"
  },
  {
    "path": "js/netwizard-switching-integration.js",
    "requiredGlobal": "NetWizardSwitchingIntegration"
  },
  {
    "path": "js/netwizard-access-security-integration.js",
    "requiredGlobal": "NetWizardAccessSecurityIntegration"
  },
  {
    "path": "js/netwizard-management-integration.js",
    "requiredGlobal": "NetWizardManagementIntegration"
  },
  {
    "path": "js/netwizard-ha-services-integration.js",
    "requiredGlobal": "NetWizardHaServicesIntegration"
  },
  {
    "path": "js/netwizard-production-gate-architecture.js",
    "dependsOn": [
      "js/netwizard-production-gate.js",
      "js/netwizard-architecture-validator.js"
    ],
    "requiredGlobal": "NetWizardProductionGateArchitecture"
  },
  {
    "path": "js/netwizard-change-set.js",
    "requiredGlobal": "NetWizardChangeSet"
  },
  {
    "path": "js/netwizard-incremental-generators.js",
    "requiredGlobal": "NetWizardIncrementalGenerators"
  },
  {
    "path": "js/netwizard-observed-config-ui.js"
  },
  {
    "path": "js/netwizard-deployment-runbook.js",
    "requiredGlobal": "NetWizardDeploymentRunbook"
  },
  {
    "path": "js/netwizard-deployment-bundle.js",
    "requiredGlobal": "NetWizardDeploymentBundle"
  },
  {
    "path": "js/netwizard-runtime.js",
    "dependsOn": [
      "js/netwizard-browser-modules.js",
      "js/netwizard-production-gate-architecture.js",
      "js/netwizard-rack-production-integration.js"
    ]
  }
];
function clone(v){return JSON.parse(JSON.stringify(v));}
function list(){return modules.map(clone);}
function paths(options){const production=!!(options&&options.production);return modules.filter(m=>!production||m.production!==false).map(m=>m.path);}
function requiredGlobals(){return modules.filter(m=>m.requiredGlobal).map(m=>({path:m.path,global:m.requiredGlobal}));}
function validate(input){
  const list=Array.isArray(input)?input:modules,errors=[],seen=new Set(),byPath=new Map();
  for(const item of list){const path=String(item&&item.path||'').trim();if(!path){errors.push('module path required');continue;}if(seen.has(path))errors.push('duplicate module: '+path);seen.add(path);byPath.set(path,item);}
  for(const item of list){const path=String(item&&item.path||'').trim();for(const dep of Array.isArray(item&&item.dependsOn)?item.dependsOn:[])if(!byPath.has(dep))errors.push(path+' depends on missing module '+dep);}
  const visiting=new Set(),visited=new Set();
  function visit(path,stack){if(visiting.has(path)){errors.push('dependency cycle: '+stack.concat(path).join(' -> '));return;}if(visited.has(path)||!byPath.has(path))return;visiting.add(path);const item=byPath.get(path);for(const dep of Array.isArray(item.dependsOn)?item.dependsOn:[])visit(dep,stack.concat(path));visiting.delete(path);visited.add(path);}
  for(const path of byPath.keys())visit(path,[]);
  const order=new Map(list.map((item,index)=>[item.path,index]));
  for(const item of list)for(const dep of Array.isArray(item&&item.dependsOn)?item.dependsOn:[])if(order.has(dep)&&order.get(dep)>order.get(item.path))errors.push('invalid order: '+dep+' must load before '+item.path);
  return{ok:errors.length===0,errors};
}
const api={version:'netwizard-browser-modules-v1',list,paths,requiredGlobals,validate};
root.NetWizardBrowserModules=api;
if(typeof module!=='undefined'&&module.exports)module.exports=api;
})(typeof window!=='undefined'?window:globalThis);
