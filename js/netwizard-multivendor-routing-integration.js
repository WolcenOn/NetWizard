/* =========================================================
   NetWizard Multivendor Routing Integration v0.1
   Añade routing neutral a Junos, Huawei VRP y MikroTik RouterOS.
========================================================= */
(function initNetWizardMultivendorRoutingIntegration(root){
  'use strict';

  function ensureScript(src, marker){
    if(!root.document || root.document.querySelector(`script[${marker}]`)) return;
    const script = root.document.createElement('script');
    script.src = src;
    script.setAttribute(marker, '1');
    script.defer = false;
    root.document.head.appendChild(script);
  }

  function install(attempt){
    if(!root.document) return false;
    ensureScript('./js/netwizard-routing-plan.js', 'data-netwizard-routing-plan-multivendor');
    ensureScript('./js/netwizard-multivendor-routing-generator.js', 'data-netwizard-multivendor-routing-generator');

    if(root.__netwizardMultivendorRoutingInstalled) return true;
    const original = root.genConfig;
    const translator = root.NetWizardMultivendorRoutingGenerator;
    const state = root.NetWizardState;
    if(typeof original !== 'function' || !translator || !state || typeof state.getSnapshot !== 'function'){
      if((attempt || 0) < 80 && root.setTimeout) root.setTimeout(() => install((attempt || 0) + 1), 100);
      return false;
    }

    root.genConfig = function enhancedMultivendorRoutingGenConfig(deviceId, format){
      const config = original(deviceId, format);
      const project = state.getSnapshot();
      const device = (project.devices || []).find(item => item.id === deviceId);
      const vendor = format || (device && device.vendorOs) || '';
      if(!['juniper_junos','huawei_vrp','mikrotik_routeros'].includes(vendor)) return config;
      return translator.appendToConfig(config, project, deviceId, vendor);
    };
    root.__netwizardMultivendorRoutingInstalled = true;
    return true;
  }

  const api = {version:'netwizard-multivendor-routing-integration-v1', install};
  root.NetWizardMultivendorRoutingIntegration = api;
  if(typeof module !== 'undefined' && module.exports) module.exports = api;
  if(root.document){
    if(root.document.readyState === 'loading') root.document.addEventListener('DOMContentLoaded', () => install(0));
    else install(0);
  }
})(typeof window !== 'undefined' ? window : globalThis);
