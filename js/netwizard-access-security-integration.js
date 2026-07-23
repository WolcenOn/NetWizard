/* NetWizard Access Security Integration v0.1 */
(function initNetWizardAccessSecurityIntegration(root){
  'use strict';
  function ensure(src,attr){if(!root.document||root.document.querySelector(`script[${attr}]`))return;const s=root.document.createElement('script');s.src=src;s.setAttribute(attr,'1');s.defer=false;root.document.head.appendChild(s);}
  function install(attempt){
    if(!root.document)return false;
    ensure('./js/netwizard-access-security-plan.js','data-netwizard-access-security-plan');
    ensure('./js/netwizard-access-security-generator.js','data-netwizard-access-security-generator');
    if(root.__netwizardAccessSecurityInstalled)return true;
    const original=root.genConfig, gen=root.NetWizardAccessSecurityGenerator, state=root.NetWizardState;
    if(typeof original!=='function'||!gen||!state||typeof state.getSnapshot!=='function'){
      if((attempt||0)<80&&root.setTimeout)root.setTimeout(()=>install((attempt||0)+1),100);
      return false;
    }
    root.genConfig=function netwizardAccessSecurityGenConfig(deviceId,format){
      const project=state.getSnapshot();
      const device=(project.devices||[]).find(x=>x.id===deviceId);
      const out=original(deviceId,format);
      if(!device||!/switch/i.test(String(device.type||'')))return out;
      return gen.appendToConfig(out,project,deviceId,format||device.vendorOs);
    };
    root.__netwizardAccessSecurityInstalled=true;
    return true;
  }
  const api={version:'netwizard-access-security-integration-v1',install};
  root.NetWizardAccessSecurityIntegration=api;
  if(typeof module!=='undefined'&&module.exports)module.exports=api;
  if(root.document){if(root.document.readyState==='loading')root.document.addEventListener('DOMContentLoaded',()=>install(0));else install(0);}
})(typeof window!=='undefined'?window:globalThis);
