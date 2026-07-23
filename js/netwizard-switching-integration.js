/* NetWizard Switching Integration v0.1 */
(function initNetWizardSwitchingIntegration(root){
  'use strict';
  function ensure(src,attr){ if(!root.document||root.document.querySelector(`script[${attr}]`))return; const s=root.document.createElement('script'); s.src=src; s.setAttribute(attr,'1'); s.defer=false; root.document.head.appendChild(s); }
  function install(attempt){
    if(!root.document)return false;
    ensure('./js/netwizard-switching-generator.js','data-netwizard-switching-generator');
    if(root.__netwizardSwitchingInstalled)return true;
    const original=root.genConfig, state=root.NetWizardState, generator=root.NetWizardSwitchingGenerator;
    if(typeof original!=='function'||!state||!generator){ if((attempt||0)<80&&root.setTimeout)root.setTimeout(()=>install((attempt||0)+1),100); return false; }
    root.genConfig=function netwizardSwitchingGenConfig(deviceId,format){ const project=state.getSnapshot(); const d=(project.devices||[]).find(x=>x.id===deviceId); if(d&&/switch/i.test(String(d.type||''))){ const out=generator.render(project,deviceId,format||d.vendorOs); if(out)return out; } return original(deviceId,format); };
    root.__netwizardSwitchingInstalled=true; return true;
  }
  const api={version:'netwizard-switching-integration-v1',install}; root.NetWizardSwitchingIntegration=api; if(typeof module!=='undefined'&&module.exports)module.exports=api;
  if(root.document){ if(root.document.readyState==='loading')root.document.addEventListener('DOMContentLoaded',()=>install(0)); else install(0); }
})(typeof window!=='undefined'?window:globalThis);
