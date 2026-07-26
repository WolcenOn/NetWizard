/* NetWizard Production Gate Architecture Extension v3.49-dev */
(function initNetWizardProductionGateArchitecture(root){
'use strict';
function arr(v){return Array.isArray(v)?v:[];}
function tryRequire(p){try{return require(p);}catch{return null;}}
function load(globalName,file){return root[globalName]||(typeof require==='function'?tryRequire(file):null);}
function baseGate(){return load('NetWizardProductionGate','./netwizard-production-gate.js');}
function routingPlan(){return load('NetWizardRoutingPlan','./netwizard-routing-plan.js');}
function ensureScript(src,selector,key){if(!root.document||root.document.querySelector(selector))return;const s=root.document.createElement('script');s.src=src;s.dataset[key]='1';s.defer=false;root.document.head.appendChild(s);}
const integrations=[
['NetWizardRoutingPlan','./js/netwizard-routing-plan.js','netwizard-routing-plan','netwizardRoutingPlan'],
['NetWizardCapabilityRegistry','./js/netwizard-capability-registry.js','netwizard-capability-registry','netwizardCapabilityRegistry'],
['NetWizardCapabilityUi','./js/netwizard-capability-ui.js','netwizard-capability-ui','netwizardCapabilityUi'],
['NetWizardDeviceCapabilityForm','./js/netwizard-device-capability-form.js','netwizard-device-capability-form','netwizardDeviceCapabilityForm'],
['NetWizardPhysicalInventory','./js/netwizard-physical-inventory.js','netwizard-physical-inventory','netwizardPhysicalInventory'],
['NetWizardPhysicalInventoryUi','./js/netwizard-physical-inventory-ui.js','netwizard-physical-inventory-ui','netwizardPhysicalInventoryUi'],
['NetWizardPoeModel','./js/netwizard-poe-model.js','netwizard-poe-model','netwizardPoeModel'],
['NetWizardRackModel','./js/netwizard-rack-model.js','netwizard-rack-model','netwizardRackModel'],
['NetWizardRackUi','./js/netwizard-rack-ui.js','netwizard-rack-ui','netwizardRackUi'],
['NetWizardReportModel','./js/netwizard-report-model.js','netwizard-report-model','netwizardReportModel'],
['NetWizardResilienceTopology','./js/netwizard-resilience-topology.js','netwizard-resilience-topology','netwizardResilienceTopology'],
['NetWizardResilienceUi','./js/netwizard-resilience-ui.js','netwizard-resilience-ui','netwizardResilienceUi'],
['NetWizardWanCircuits','./js/netwizard-wan-circuits.js','netwizard-wan-circuits','netwizardWanCircuits'],
['NetWizardWanCircuitsUi','./js/netwizard-wan-circuits-ui.js','netwizard-wan-circuits-ui','netwizardWanCircuitsUi'],
['NetWizardTrafficCapacity','./js/netwizard-traffic-capacity.js','netwizard-traffic-capacity','netwizardTrafficCapacity'],
['NetWizardTrafficCapacityUi','./js/netwizard-traffic-capacity-ui.js','netwizard-traffic-capacity-ui','netwizardTrafficCapacityUi'],
['NetWizardInternalServices','./js/netwizard-internal-services.js','netwizard-internal-services','netwizardInternalServices'],
['NetWizardInternalServicesUi','./js/netwizard-internal-services-ui.js','netwizard-internal-services-ui','netwizardInternalServicesUi'],
['NetWizardWifiPlanning','./js/netwizard-wifi-planning.js','netwizard-wifi-planning','netwizardWifiPlanning'],
['NetWizardWifiPlanningUi','./js/netwizard-wifi-planning-ui.js','netwizard-wifi-planning-ui','netwizardWifiPlanningUi'],
['NetWizardIpv6Vrf','./js/netwizard-ipv6-vrf.js','netwizard-ipv6-vrf','netwizardIpv6Vrf'],
['NetWizardIpv6VrfUi','./js/netwizard-ipv6-vrf-ui.js','netwizard-ipv6-vrf-ui','netwizardIpv6VrfUi'],
['NetWizardFailureSimulation','./js/netwizard-failure-simulation.js','netwizard-failure-simulation','netwizardFailureSimulation'],
['NetWizardFailureSimulationUi','./js/netwizard-failure-simulation-ui.js','netwizard-failure-simulation-ui','netwizardFailureSimulationUi'],
['NetWizardObservedDrift','./js/netwizard-observed-drift.js','netwizard-observed-drift','netwizardObservedDrift'],
['NetWizardObservedDriftUi','./js/netwizard-observed-drift-ui.js','netwizard-observed-drift-ui','netwizardObservedDriftUi'],
['NetWizardDetailedReport','./js/netwizard-detailed-report.js','netwizard-detailed-report','netwizardDetailedReport'],
['NetWizardCiscoRoutingIntegration','./js/netwizard-cisco-routing-integration.js','netwizard-cisco-routing-integration','netwizardCiscoRoutingIntegration'],
['NetWizardMultivendorRoutingIntegration','./js/netwizard-multivendor-routing-integration.js','netwizard-multivendor-routing-integration','netwizardMultivendorRoutingIntegration'],
['NetWizardFirewallEdgeIntegration','./js/netwizard-firewall-edge-integration.js','netwizard-firewall-edge-integration','netwizardFirewallEdgeIntegration'],
['NetWizardSwitchingIntegration','./js/netwizard-switching-integration.js','netwizard-switching-integration','netwizardSwitchingIntegration'],
['NetWizardAccessSecurityIntegration','./js/netwizard-access-security-integration.js','netwizard-access-security-integration','netwizardAccessSecurityIntegration'],
['NetWizardManagementIntegration','./js/netwizard-management-integration.js','netwizard-management-integration','netwizardManagementIntegration'],
['NetWizardHaServicesIntegration','./js/netwizard-ha-services-integration.js','netwizard-ha-services-integration','netwizardHaServicesIntegration']
];
function ensureIntegrations(){for(const [name,src,tag,key] of integrations)if(!root[name])ensureScript(src,`script[data-${tag}]`,key);}
function mergeIssues(){const seen=new Set(),out=[];for(const group of arguments)for(const issue of arr(group)){const key=[issue&&issue.code,issue&&issue.severity,issue&&issue.category,issue&&issue.deviceId,issue&&issue.portId,issue&&issue.linkId,issue&&issue.rackId,issue&&issue.pduId,issue&&issue.message].join('\u0001');if(seen.has(key))continue;seen.add(key);out.push(issue);}return out;}
function runModule(name,file,project,fallback){const mod=load(name,file);if(!mod)return fallback;if(typeof mod.validateProject==='function')return mod.validateProject(project||{});if(typeof mod.validate==='function')return mod.validate(project||{});return fallback;}
function enhanceReport(project,options,baseReport){
 const gate=baseGate(),report=baseReport||(gate&&gate.runProductionGate?gate.runProductionGate(project,options||{}):{issues:[]});
 const architecture=runModule('NetWizardArchitectureValidator','./netwizard-architecture-validator.js',project,{issues:[]});
 const compatibility=runModule('NetWizardCapabilityRegistry','./netwizard-capability-registry.js',project,{issues:[],ok:true});
 const physicalInventory=runModule('NetWizardPhysicalInventory','./netwizard-physical-inventory.js',project,{issues:[],ok:true});
 const racks=runModule('NetWizardRackModel','./netwizard-rack-model.js',project,{issues:[],ok:true,racks:[],items:[]});
 const resilience=runModule('NetWizardResilienceTopology','./netwizard-resilience-topology.js',project,{issues:[],ok:true});
 const wan=runModule('NetWizardWanCircuits','./netwizard-wan-circuits.js',project,{issues:[],ok:true});
 const capacity=runModule('NetWizardTrafficCapacity','./netwizard-traffic-capacity.js',project,{issues:[],ok:true});
 const services=runModule('NetWizardInternalServices','./netwizard-internal-services.js',project,{issues:[],ok:true});
 const wifi=runModule('NetWizardWifiPlanning','./netwizard-wifi-planning.js',project,{issues:[],ok:true});
 const ipv6Vrf=runModule('NetWizardIpv6Vrf','./netwizard-ipv6-vrf.js',project,{issues:[],ok:true});
 const failureSimulation=runModule('NetWizardFailureSimulation','./netwizard-failure-simulation.js',project,{issues:[],ok:true,scenarios:[]});
 const observedDrift=runModule('NetWizardObservedDrift','./netwizard-observed-drift.js',project,{issues:[],ok:true,drift:[]});
 const issues=mergeIssues(report.issues,architecture.issues,compatibility.issues,physicalInventory.issues,racks.issues,resilience.issues,wan.issues,capacity.issues,services.issues,wifi.issues,ipv6Vrf.issues,failureSimulation.issues,observedDrift.issues);
 const counts=gate&&gate.summarizeCounts?gate.summarizeCounts(issues):{errors:issues.filter(i=>i&&i.severity==='error').length,warnings:issues.filter(i=>i&&i.severity==='warning').length,blocking:issues.filter(i=>i&&(i.blocking||i.severity==='error')).length,byCategory:{}};
 const blocking=issues.filter(i=>i&&(i.blocking||i.severity==='error')),status=blocking.length?'blocked':(counts.warnings>0?'review':'ready');
 const RP=routingPlan(),neutralRoutingPlan=RP&&typeof RP.build==='function'?RP.build(project||{}):null;
 return Object.assign({},report,{ok:!blocking.length,ready:status==='ready',canExport:!blocking.length,status,issues,counts,architecture,compatibility,physicalInventory,racks,resilience,wan,capacity,services,wifi,ipv6Vrf,failureSimulation,observedDrift,routingPlan:neutralRoutingPlan});
}
function install(){ensureIntegrations();const gate=baseGate();if(!gate||gate.__architectureExtensionInstalled)return gate;const originalRun=gate.runProductionGate.bind(gate);gate.runProductionGate=(project,options)=>enhanceReport(project,options,originalRun(project,options));gate.__architectureExtensionInstalled=true;gate.enhanceArchitectureReport=enhanceReport;root.NetWizardProductionGate=gate;return gate;}
function injectPanels(){for(const name of ['NetWizardCapabilityUi','NetWizardPhysicalInventoryUi','NetWizardRackUi','NetWizardResilienceUi','NetWizardWanCircuitsUi','NetWizardTrafficCapacityUi','NetWizardInternalServicesUi','NetWizardWifiPlanningUi','NetWizardIpv6VrfUi','NetWizardFailureSimulationUi','NetWizardObservedDriftUi','NetWizardDetailedReport']){const ui=root[name];if(ui&&typeof ui.inject==='function')ui.inject();}}
function bindBrowserUi(attempt){if(!root.document)return;ensureIntegrations();const gate=install(),state=root.NetWizardState,button=root.document.getElementById('btnProductionGate'),output=root.document.getElementById('productionGateOut');if(!gate||!state||!button||!output){if((attempt||0)<50&&root.setTimeout)root.setTimeout(()=>bindBrowserUi((attempt||0)+1),120);return;}function runEnhanced(){const productionMode=root.NetWizardAudit&&root.NetWizardAudit.isProduction?root.NetWizardAudit.isProduction():false,strict=!!root.document.getElementById('pgateStrict')?.checked,report=gate.runProductionGate(state.getSnapshot(),{productionMode,strict});output.textContent=gate.summarizeGate(report,{limit:80,remediationPreview:root.document.getElementById('pgateShowGuide')?.checked?6:0});root.NetWizardLastProductionGateReport=report;injectPanels();return report;}button.onclick=runEnhanced;root.document.addEventListener('nw:project:changed',()=>{try{runEnhanced();}catch{}});root.addEventListener&&root.addEventListener('nw:mode:changed',()=>{try{runEnhanced();}catch{}});try{runEnhanced();}catch{}}
const api={version:'netwizard-production-gate-architecture-v24',install,enhanceReport,mergeIssues,ensureIntegrations};root.NetWizardProductionGateArchitecture=api;if(typeof module!=='undefined'&&module.exports){install();module.exports=api;}if(root.document){if(root.document.readyState==='loading')root.document.addEventListener('DOMContentLoaded',()=>bindBrowserUi(0));else bindBrowserUi(0);}
})(typeof window!=='undefined'?window:globalThis);