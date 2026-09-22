/* NetWizard PoE compatibility loader */
(function loadNetWizardPoe(root){
'use strict';
if(typeof module!=='undefined'&&module.exports){module.exports=require('./netwizard-poe-utils-v2.js');return;}
if(root.NetWizardPoeUtils&&root.NetWizardPoeUtils.version==='netwizard-poe-utils-v3.22')return;
if(!root.document)return;
function load(src,done){const existing=root.document.querySelector(`script[data-netwizard-poe-src="${src}"]`);if(existing){if(existing.dataset.loaded==='yes')done();else existing.addEventListener('load',done,{once:true});return;}const s=root.document.createElement('script');s.src=src;s.async=false;s.dataset.netwizardPoeSrc=src;s.onload=()=>{s.dataset.loaded='yes';done();};s.onerror=()=>{throw new Error(`No se pudo cargar ${src}`);};(root.document.head||root.document.documentElement).appendChild(s);}
load('./js/netwizard-poe-model.js',()=>load('./js/netwizard-poe-utils-v2.js',()=>{
  const bootRack=()=>load('./js/netwizard-structured-cabling.js',()=>load('./js/netwizard-rack-model.js',()=>load('./js/netwizard-report-model.js',()=>load('./js/netwizard-rack-ui.js',()=>load('./js/netwizard-detailed-report-v3.js',()=>load('./js/netwizard-rack-production-integration.js',()=>{}))))));
  if(root.document.readyState==='complete')bootRack();
  else root.addEventListener('load',bootRack,{once:true});
}));
})(typeof window!=='undefined'?window:globalThis);
