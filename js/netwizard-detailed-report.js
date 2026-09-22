/* NetWizard Detailed Network Report compatibility entrypoint */
(function(root){
'use strict';
if(typeof module!=='undefined'&&module.exports){module.exports=require('./netwizard-detailed-report-v2.js');return;}
if(root.NetWizardDetailedReport)return;
if(!root.document)return;
const script=root.document.createElement('script');
script.src='./js/netwizard-detailed-report-v2.js';
script.defer=false;
script.dataset.netwizardDetailedReportV2='1';
root.document.head.appendChild(script);
})(typeof window!=='undefined'?window:globalThis);
