/* NetWizard Switching Integration v0.1 */
(function initNetWizardSwitchingIntegration(root){
  'use strict';
  function ensure(src,attr,globalName){ if(!root.document||root[globalName]||root.document.querySelector(`script[${attr}]`))return; const s=root.document.createElement('script'); s.src=src; s.setAttribute(attr,'1'); s.async=false; s.defer=false; root.document.head.appendChild(s); }
  function install(attempt){
    if(!root.document)return false;
    ensure('./js/netwizard-switching-generator.js','data-netwizard-switching-generator','NetWizardSwitchingGenerator');
    if(root.__netwizardSwitchingInstalled)return true;
    const pipeline=root.NetWizardConfigPipeline;
    const original=root.genConfig, state=root.NetWizardState, generator=root.NetWizardSwitchingGenerator;
    if(!generator||(!pipeline&&(typeof original!=='function'||!state))){ if((attempt||0)<80&&root.setTimeout)root.setTimeout(()=>install((attempt||0)+1),100); return false; }
    if(pipeline&&typeof pipeline.registerRenderer==='function'){
      pipeline.registerRenderer({id:'device.switching',priority:250,description:'Renderer especializado para switches.',supports(ctx){const model=root.NetWizardDeviceModel;return !!ctx.device&&(model?model.isSwitching(ctx.device):/switch/i.test(String(ctx.device.kind||ctx.device.type||'')));},render(ctx){return generator.render(ctx.project,ctx.deviceId,ctx.vendor);}});
      root.__netwizardSwitchingInstalled=true;
      return true;
    }
    root.genConfig=function netwizardSwitchingGenConfig(deviceId,format){ const project=state.getSnapshot(); const d=(project.devices||[]).find(x=>x.id===deviceId); const model=root.NetWizardDeviceModel; if(d&&(model?model.isSwitching(d):/switch/i.test(String(d.kind||d.type||'')))){ const out=generator.render(project,deviceId,format||d.vendorOs); if(out)return out; } return original(deviceId,format); };
    root.__netwizardSwitchingInstalled=true; return true;
  }
  const api={version:'netwizard-switching-integration-v1',install}; root.NetWizardSwitchingIntegration=api; if(typeof module!=='undefined'&&module.exports)module.exports=api;
  if(root.document){ if(root.document.readyState==='loading')root.document.addEventListener('DOMContentLoaded',()=>install(0)); else install(0); }
})(typeof window!=='undefined'?window:globalThis);
