/* NetWizard canonical PoE model */
(function initNetWizardPoeModel(root){
'use strict';
const arr=v=>Array.isArray(v)?v:[];
const lower=v=>String(v==null?'':v).toLowerCase();
const num=v=>{const n=Number(v);return Number.isFinite(n)?n:null;};
const round1=v=>Math.round(Number(v||0)*10)/10;
const STANDARD_WATTS={none:0,af:15.4,at:30,bt:60,bt60:60,bt90:90,passive24:12,passive:12,auto:null,required:null};
const DEFAULT_HOST_WATTS={ap:18,camera:12,phone:7,iot:5};
function normalizePoeMode(value){
 const s=lower(value||'auto').replace(/[^a-z0-9]/g,'');
 if(['no','off','none','disabled','disable'].includes(s))return'none';
 if(['yes','required','require','on','enabled','enable'].includes(s))return'required';
 if(['8023af','poe','af'].includes(s))return'af';
 if(['8023at','poeplus','at'].includes(s))return'at';
 if(['8023bt','bt','bt60','poeplusplus'].includes(s))return'bt';
 if(['bt90','upoe','upoeplus'].includes(s))return'bt90';
 if(['passive24','passive'].includes(s))return s;
 return'auto';
}
function defaultPowerForHostType(type){return DEFAULT_HOST_WATTS[lower(type)]||0;}
function hostPortId(host){return host&&(host.portRef||host.portId||host.connectedPortId)||null;}
function hostDeviceId(host,port){return host&&(host.deviceId||host.connectedDeviceId)||(port&&port.deviceId)||null;}
function hostRequiresPoe(host){
 const mode=normalizePoeMode(host&&(host.poeMode||host.poe));
 if(mode==='none')return false;
 if(mode==='required')return true;
 if(host&&(host.poeRequired===true||host.poeRequired==='true'||host.poeRequired===1||host.poeRequired==='1'))return true;
 if(host&&(host.poeRequired===false||host.poeRequired==='false'||host.poeRequired===0||host.poeRequired==='0'))return false;
 return defaultPowerForHostType(host&&host.type)>0;
}
function hostPowerWatts(host){
 const explicit=num(host&&(host.poeWatts!=null?host.poeWatts:host.powerWatts));
 if(explicit!==null&&explicit>=0)return{watts:round1(explicit),source:'explicit'};
 const inferred=defaultPowerForHostType(host&&host.type);
 return{watts:round1(inferred),source:inferred>0?'host-type':'unknown'};
}
function portPoeCapacity(port){
 const fields=['poeWattsMax','poeBudgetW','poeAvailableWatts','powerAvailableWatts'];
 for(const field of fields){const n=num(port&&port[field]);if(n!==null&&n>=0)return{watts:round1(n),source:'explicit',field};}
 const mode=normalizePoeMode(port&&(port.poeStandard||port.poeMode||port.poe));
 const watts=STANDARD_WATTS[mode];
 return{watts:watts==null?null:round1(watts),source:watts==null?'unknown':'standard',mode};
}
function devicePoeBudget(device){
 for(const field of ['poeBudgetW','poeBudgetWatts','poeAvailableWatts']){const n=num(device&&device[field]);if(n!==null&&n>=0)return{watts:round1(n),source:'explicit',field};}
 return{watts:null,source:'unknown'};
}
function byId(list,id){return arr(list).find(x=>x&&x.id===id)||null;}
function resolvePoeContext(project,host){
 const portId=hostPortId(host);const port=byId(project&&project.ports,portId);const device=byId(project&&project.devices,hostDeviceId(host,port));
 return{host,port,device,portId,required:hostRequiresPoe(host),demand:hostPowerWatts(host),portCapacity:portPoeCapacity(port),deviceBudget:devicePoeBudget(device)};
}
function collect(project){
 const contexts=arr(project&&project.hosts).map(h=>resolvePoeContext(project,h)).filter(c=>c.required);
 const loadsByPort={};const loadsByDevice={};
 for(const c of contexts){if(c.portId)loadsByPort[c.portId]=round1((loadsByPort[c.portId]||0)+c.demand.watts);if(c.device&&c.device.id)loadsByDevice[c.device.id]=round1((loadsByDevice[c.device.id]||0)+c.demand.watts);}
 return{contexts,loadsByPort,loadsByDevice};
}
const api={version:'netwizard-poe-model-v1',normalizePoeMode,defaultPowerForHostType,hostPortId,hostDeviceId,hostRequiresPoe,hostPowerWatts,portPoeCapacity,devicePoeBudget,resolvePoeContext,collect};
root.NetWizardPoeModel=api;if(typeof module!=='undefined'&&module.exports)module.exports=api;
})(typeof window!=='undefined'?window:globalThis);
