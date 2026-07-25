/* NetWizard unified report model */
(function initNetWizardReportModel(root){
'use strict';
const arr=v=>Array.isArray(v)?v:[];
const POE=root.NetWizardPoeModel||(typeof require==='function'?require('./netwizard-poe-model.js'):null);
const RACK=root.NetWizardRackModel||(typeof require==='function'?require('./netwizard-rack-model.js'):null);
const byId=(list,id)=>arr(list).find(x=>x&&x.id===id)||null;
function labelDevice(project,id){const d=byId(project&&project.devices,id);return d?d.name||d.id:'Sin equipo asignado';}
function labelPort(project,id){const p=byId(project&&project.ports,id);return p?`${labelDevice(project,p.deviceId)} · ${p.name||p.id}`:'Sin puerto asignado';}
function connectivity(project){return arr(project&&project.links).map(link=>({id:link.id,name:link.name||'Enlace',aPort:labelPort(project,link.aPortId),bPort:labelPort(project,link.bPortId),media:link.media||link.cableType||'No documentado',capacityMbps:link.capacityMbps||null,physicalPath:link.physicalPath||'No documentada',cableId:link.cableId||null}));}
function inventory(project){return arr(project&&project.devices).map(d=>({id:d.id,name:d.name||d.id,type:d.type||'unknown',vendor:d.vendor||d.vendorOs||d.platform||'',model:d.model||'',rackId:d.rackId||d.rack||null,rackUnit:d.rackUnit||null,heightUnits:d.rackUnits||d.heightU||1,powerDrawWatts:d.powerDrawWatts||null,poeBudgetWatts:d.poeBudgetW||d.poeBudgetWatts||null}));}
function build(project,options){project=project||{};options=options||{};const gate=options.gateReport||{issues:[],counts:{}};const poe=POE?POE.collect(project):{contexts:[],loadsByPort:{},loadsByDevice:{}};const racks=RACK?RACK.validate(project):{racks:[],items:[],issues:[]};const materials=RACK?RACK.billOfMaterials(project):[];return{version:'netwizard-report-model-v1',project:{name:project.projName||project.name||'Red',schemaVersion:project._schemaVersion||null},summary:{devices:arr(project.devices).length,ports:arr(project.ports).length,links:arr(project.links).length,hosts:arr(project.hosts).length,vlans:arr(project.vlans).length,racks:racks.racks.length,wanCircuits:arr(project.wanCircuits).length,poeLoadWatts:Object.values(poe.loadsByDevice).reduce((a,b)=>a+Number(b||0),0)},connectivity:connectivity(project),inventory:inventory(project),materials,racks,poe,findings:arr(gate.issues)};}
const api={version:'netwizard-report-model-v1',build,connectivity,inventory,labelDevice,labelPort};root.NetWizardReportModel=api;if(typeof module!=='undefined'&&module.exports)module.exports=api;
})(typeof window!=='undefined'?window:globalThis);
