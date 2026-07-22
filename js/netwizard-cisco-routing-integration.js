/* =========================================================
   NetWizard Cisco Routing Integration v0.1
   Añade el bloque de routing neutral al generador Cisco del navegador.
========================================================= */
(function initNetWizardCiscoRoutingIntegration(root){
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
    ensureScript('./js/netwizard-routing-plan.js', 'data-netwizard-routing-plan-browser');
    ensureScript('./js/netwizard-cisco-routing-generator.js', 'data-netwizard-cisco-routing-generator');

    if(root.__netwizardCiscoRoutingInstalled) return true;
    const original = root.genConfig;
    const translator = root.NetWizardCiscoRoutingGenerator;
    const state = root.NetWizardState;
    if(typeof original !== 'function' || !translator || !state || typeof state.getSnapshot !== 'function'){
      if((attempt || 0) < 80 && root.setTimeout) root.setTimeout(() => install((attempt || 0) + 1), 100);
      return false;
    }

    root.genConfig = function enhancedCiscoRoutingGenConfig(deviceId, format){
      const config = original(deviceId, format);
      const project = state.getSnapshot();
      const device = (project.devices || []).find(item => item.id === deviceId);
      const vendor = format || (device && device.vendorOs) || '';
      if(vendor !== 'cisco_ios') return config;
      return translator.appendToConfig(config, project, deviceId);
    };
    root.__netwizardCiscoRoutingInstalled = true;
    return true;
  }

  const api = {version:'netwizard-cisco-routing-integration-v1', install};
  root.NetWizardCiscoRoutingIntegration = api;
  if(typeof module !== 'undefined' && module.exports) module.exports = api;
  if(root.document){
    if(root.document.readyState === 'loading') root.document.addEventListener('DOMContentLoaded', () => install(0));
    else install(0);
  }
})(typeof window !== 'undefined' ? window : globalThis);
