/* NetWizard browser runtime verification v1 */
(function initNetWizardRuntime(root){
  'use strict';

  const requiredGlobals = [
    'NetWizardState',
    'NetWizardPlanner',
    'NetWizardDeviceModel',
    'NetWizardProjectSchema',
    'NetWizardConfigPipeline',
    'NetWizardVendorConfigGenerators',
    'NetWizardArchitectureValidator',
    'NetWizardProductionGate',
    'NetWizardProductionGateArchitecture',
    'NetWizardChangeSet',
    'NetWizardDeploymentRunbook',
    'NetWizardDeploymentBundle',
    'NetWizardCapabilityRegistry',
    'NetWizardCapabilityUi',
    'NetWizardDeviceCapabilityForm',
    'NetWizardPhysicalInventory',
    'NetWizardPhysicalInventoryUi',
    'NetWizardResilienceTopology',
    'NetWizardResilienceUi',
    'NetWizardWanCircuits',
    'NetWizardWanCircuitsUi',
    'NetWizardTrafficCapacity',
    'NetWizardTrafficCapacityUi',
    'NetWizardInternalServices',
    'NetWizardInternalServicesUi',
    'NetWizardWifiPlanning',
    'NetWizardWifiPlanningUi',
    'NetWizardIpv6Vrf',
    'NetWizardIpv6VrfUi',
    'NetWizardFailureSimulation',
    'NetWizardFailureSimulationUi',
    'NetWizardObservedDrift',
    'NetWizardObservedDriftUi',
    'NetWizardDetailedReport',
    'NetWizardCiscoRoutingGenerator',
    'NetWizardMultivendorRoutingGenerator',
    'NetWizardFirewallEdgeGenerator',
    'NetWizardSwitchingGenerator',
    'NetWizardAccessSecurityGenerator',
    'NetWizardManagementGenerator',
    'NetWizardHaServicesGenerator',
    'NetWizardCiscoRoutingIntegration',
    'NetWizardMultivendorRoutingIntegration',
    'NetWizardFirewallEdgeIntegration',
    'NetWizardSwitchingIntegration',
    'NetWizardAccessSecurityIntegration',
    'NetWizardManagementIntegration',
    'NetWizardHaServicesIntegration'
  ];

  function duplicateScripts(){
    if(!root.document) return [];
    const counts = new Map();
    for(const script of root.document.scripts){
      if(!script.src) continue;
      const path = new URL(script.src, root.location && root.location.href || undefined).pathname;
      counts.set(path, (counts.get(path) || 0) + 1);
    }
    return Array.from(counts.entries()).filter(([, count]) => count > 1).map(([path]) => path);
  }

  function verify(){
    const missing = requiredGlobals.filter(name => !root[name]);
    const duplicates = duplicateScripts();
    const pipeline = root.NetWizardConfigPipeline;
    const registry = pipeline && typeof pipeline.inspect === 'function' ? pipeline.inspect() : {renderers:[],stages:[]};
    const requiredRenderers = ['edge.firewall','device.switching','vendor.base'];
    const requiredStages = ['routing.cisco','routing.multivendor','security.access','management.baseline','ha.services'];
    const registeredRenderers = registry.renderers.map(item => item.id);
    const registeredStages = registry.stages.map(item => item.id);
    const missingRegistryEntries = requiredRenderers.filter(id => !registeredRenderers.includes(id))
      .concat(requiredStages.filter(id => !registeredStages.includes(id)));
    const generatorReady = !!(pipeline && root.genConfig === pipeline.generate && root.genConfig.__netwizardConfigPipeline);
    const architectureReady = !!(root.NetWizardProductionGate && root.NetWizardProductionGate.__architectureExtensionInstalled);
    const pipelineFlags = [
      '__netwizardCiscoRoutingInstalled',
      '__netwizardMultivendorRoutingInstalled',
      '__netwizardFirewallEdgeInstalled',
      '__netwizardSwitchingInstalled',
      '__netwizardAccessSecurityInstalled',
      '__netwizardManagementInstalled',
      '__netwizardHaServicesInstalled'
    ];
    const missingPipelineStages = pipelineFlags.filter(name => !root[name]);
    return {
      ok: !missing.length && !duplicates.length && !missingPipelineStages.length && !missingRegistryEntries.length && generatorReady && architectureReady,
      version: '3.50.0',
      missing,
      duplicateScripts: duplicates,
      missingPipelineStages,
      missingRegistryEntries,
      configPipeline: registry,
      generatorReady,
      architectureReady
    };
  }

  function verifyAndReport(){
    const status = verify();
    api.status = status;
    if(!status.ok && root.console) root.console.error('NetWizard: runtime incompleto', status);
    return status;
  }

  const api = { version:'netwizard-runtime-v1', requiredGlobals:requiredGlobals.slice(), verify, verifyAndReport, status:null };
  root.NetWizardRuntime = api;
  if(typeof module !== 'undefined' && module.exports) module.exports = api;
  if(root.document){
    if(root.document.readyState === 'loading') root.document.addEventListener('DOMContentLoaded', () => root.setTimeout(verifyAndReport, 0));
    else root.setTimeout(verifyAndReport, 0);
  }
})(typeof window !== 'undefined' ? window : globalThis);
