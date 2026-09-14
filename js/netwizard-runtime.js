/* NetWizard browser runtime verification v1 */
(function initNetWizardRuntime(root){
  'use strict';

  const requiredGlobals = [
    'NetWizardState',
    'NetWizardPlanner',
    'NetWizardProjectSchema',
    'NetWizardVendorConfigGenerators',
    'NetWizardArchitectureValidator',
    'NetWizardProductionGate',
    'NetWizardProductionGateArchitecture',
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
    const generatorReady = typeof root.genConfig === 'function';
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
      ok: !missing.length && !duplicates.length && !missingPipelineStages.length && generatorReady && architectureReady,
      version: '3.48.0',
      missing,
      duplicateScripts: duplicates,
      missingPipelineStages,
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
