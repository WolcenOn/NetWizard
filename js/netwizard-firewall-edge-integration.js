/* =========================================================
   NetWizard Firewall Edge Integration v0.1
   Añade FortiGate/pfSense edge output al generador del navegador.
========================================================= */
(function initNetWizardFirewallEdgeIntegration(root){
  'use strict';

  function ensureScript(src, marker){
    if(!root.document || root.document.querySelector(`script[${marker}]`)) return;
    const script=root.document.createElement('script'); script.src=src; script.setAttribute(marker,'1'); script.defer=false; root.document.head.appendChild(script);
  }

  function install(attempt){
    if(!root.document) return false;
    ensureScript('./js/netwizard-routing-plan.js','data-netwizard-routing-plan-edge');
    ensureScript('./js/netwizard-firewall-edge-generator.js','data-netwizard-firewall-edge-generator');
    if(root.__netwizardFirewallEdgeInstalled) return true;
    const original=root.genConfig, generator=root.NetWizardFirewallEdgeGenerator, state=root.NetWizardState;
    if(typeof original!=='function'||!generator||!state||typeof state.getSnapshot!=='function'){
      if((attempt||0)<80&&root.setTimeout) root.setTimeout(()=>install((attempt||0)+1),100);
      return false;
    }
    root.genConfig=function enhancedFirewallEdgeGenConfig(deviceId,format){
      const project=state.getSnapshot();
      const dev=(project.devices||[]).find(item=>item.id===deviceId);
      const vendor=String(format||(dev&&dev.vendorOs)||'').toLowerCase();
      if(vendor==='fortinet'||vendor==='pfsense'){
        const generated=generator.render(project,deviceId,vendor);
        if(generated) return generated;
      }
      return original(deviceId,format);
    };
    root.__netwizardFirewallEdgeInstalled=true;
    return true;
  }

  const api={version:'netwizard-firewall-edge-integration-v1',install};
  root.NetWizardFirewallEdgeIntegration=api;
  if(typeof module!=='undefined'&&module.exports) module.exports=api;
  if(root.document){ if(root.document.readyState==='loading') root.document.addEventListener('DOMContentLoaded',()=>install(0)); else install(0); }
})(typeof window!=='undefined'?window:globalThis);
