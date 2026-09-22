/* NetWizard Detailed Network Report compatibility entrypoint */
(function(root){
'use strict';
if(typeof module!=='undefined'&&module.exports){module.exports=require('./netwizard-detailed-report-v3.js');return;}
if(root.NetWizardDetailedReport)return;
if(!root.document)return;
function load(src,key,next){if(root.document.querySelector(`script[data-${key}]`)){if(next)next();return;}const s=root.document.createElement('script');s.src=src;s.defer=false;s.dataset[key]='1';if(next)s.onload=next;root.document.head.appendChild(s);}
const ready=()=>load('./js/netwizard-detailed-report-v3.js','netwizardDetailedReportV3');
if(!root.NetWizardPoeModel)return load('./js/netwizard-poe-model.js','netwizardPoeModel',()=>load('./js/netwizard-rack-model.js','netwizardRackModel',()=>load('./js/netwizard-report-model.js','netwizardReportModel',ready)));
if(!root.NetWizardRackModel)return load('./js/netwizard-rack-model.js','netwizardRackModel',()=>load('./js/netwizard-report-model.js','netwizardReportModel',ready));
if(!root.NetWizardReportModel)return load('./js/netwizard-report-model.js','netwizardReportModel',ready);
ready();
})(typeof window!=='undefined'?window:globalThis);