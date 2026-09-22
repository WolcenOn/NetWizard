/* NetWizard Rack / report production integration */
(function(root){
'use strict';
const arr=v=>Array.isArray(v)?v:[];
function issueKey(i){return [i&&i.code,i&&i.severity,i&&i.category,i&&i.deviceId,i&&i.portId,i&&i.linkId,i&&i.rackId,i&&i.pduId,i&&i.message].join('\u0001');}
function mergeIssues(){
  const seen=new Set(),out=[];
  for(const group of arguments)for(const issue of arr(group)){const key=issueKey(issue);if(seen.has(key))continue;seen.add(key);out.push(issue);}
  return out;
}
function install(){
  const gate=root.NetWizardProductionGate,rack=root.NetWizardRackModel,cabling=root.NetWizardStructuredCabling;
  if(!gate||!rack||!cabling||typeof gate.runProductionGate!=='function'||gate.__rackExtensionInstalled)return false;
  const original=gate.runProductionGate.bind(gate);
  gate.runProductionGate=(project,options)=>{
    const report=original(project,options),rackReport=rack.validate(project||{}),cablingReport=cabling.validate(project||{});
    const issues=mergeIssues(report.issues,rackReport.issues,cablingReport.issues);
    const counts=typeof gate.summarizeCounts==='function'?gate.summarizeCounts(issues):{errors:issues.filter(i=>i&&i.severity==='error').length,warnings:issues.filter(i=>i&&i.severity==='warning').length,blocking:issues.filter(i=>i&&(i.blocking||i.severity==='error')).length,byCategory:{}};
    const blocking=issues.filter(i=>i&&(i.blocking||i.severity==='error'));
    const status=blocking.length?'blocked':((counts.warnings||0)>0?'review':'ready');
    return Object.assign({},report,{ok:!blocking.length,ready:status==='ready',canExport:!blocking.length,status,issues,counts,racks:rackReport,structuredCabling:cablingReport});
  };
  gate.__rackExtensionInstalled=true;
  return true;
}
function inject(){
  for(const name of ['NetWizardRackUi','NetWizardCompactReport']){
    const mod=root[name];
    if(mod&&typeof mod.inject==='function'){try{mod.inject();}catch(_e){}}
  }
}
function boot(attempt){
  if(install()){inject();return;}
  if((attempt||0)<60&&root.setTimeout)root.setTimeout(()=>boot((attempt||0)+1),100);
}
const api={version:'netwizard-rack-production-integration-v2',install,mergeIssues,boot};
root.NetWizardRackProductionIntegration=api;
if(typeof module!=='undefined'&&module.exports)module.exports=api;
if(root.document){
  if(root.document.readyState==='complete')boot(0);
  else root.addEventListener('load',()=>boot(0),{once:true});
}
})(typeof window!=='undefined'?window:globalThis);
