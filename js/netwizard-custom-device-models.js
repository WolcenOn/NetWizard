/* NetWizard Custom Device Models v1 */
(function initNetWizardCustomDeviceModels(root){
'use strict';

function arr(v){return Array.isArray(v)?v:[];}
function obj(v){return v&&typeof v==='object'&&!Array.isArray(v)?v:{};}
function clean(v){return String(v==null?'':v).trim();}
function clone(v){return JSON.parse(JSON.stringify(v==null?null:v));}
function num(v){const n=Number(v);return Number.isFinite(n)?n:null;}

function list(project){
  return arr(project&&project.customDeviceModels).map(clone);
}

function get(project,id){
  const key=clean(id);
  const found=arr(project&&project.customDeviceModels).find(x=>x&&clean(x.id)===key);
  return found?clone(found):null;
}

function expandPortGroups(model){
  const ports=[];
  for(const group of arr(model&&model.portGroups)){
    const count=Math.max(0,Math.floor(num(group.count)||0));
    const start=Math.max(0,Math.floor(num(group.startIndex)||1));
    const pattern=clean(group.namePattern)||'port{n}';
    for(let i=0;i<count;i++){
      const n=start+i;
      ports.push({
        groupId:group.id||null,
        name:pattern.replace(/\{n\}/g,String(n)),
        media:group.media||'',
        speedMaxMbps:num(group.speedMaxMbps),
        supportedSpeedsMbps:arr(group.supportedSpeedsMbps).map(Number).filter(Number.isFinite),
        poeCapable:group.poeCapable===true
      });
    }
  }
  return ports;
}

function resolve(project,device,options){
  const d=obj(device),source=clean(d.modelSource||'manual').toLowerCase(),ref=clean(d.modelRef);
  if(source==='custom'){
    const model=get(project,ref);
    return model?{source:'custom',ref,model}:{source:'custom',ref,model:null,error:'custom_model_not_found'};
  }
  if(source==='global'){
    const lookup=options&&typeof options.globalLookup==='function'?options.globalLookup:null;
    const model=lookup&&ref?lookup(ref):null;
    return model?{source:'global',ref,model:clone(model)}:{source:'global',ref,model:null,error:'global_model_not_found'};
  }
  return {
    source:'manual',
    ref:null,
    model:{
      id:null,
      manufacturer:d.manufacturer||'',
      model:d.model||'',
      kind:d.kind||d.type||'appliance',
      rackUnits:d.rackUnits==null?null:d.rackUnits,
      weightKg:d.weightKg==null?null:d.weightKg,
      powerTypicalWatts:d.powerDrawWatts==null?null:d.powerDrawWatts,
      poeBudgetWatts:d.poeBudgetW==null?null:d.poeBudgetW,
      portGroups:[]
    }
  };
}

function applyModel(device,model,options){
  const d=Object.assign({},device||{}),m=obj(model),overwrite=!!(options&&options.overwrite);
  const put=(key,value)=>{
    if(value==null||value==='')return;
    if(overwrite||d[key]==null||d[key]==='')d[key]=clone(value);
  };
  put('manufacturer',m.manufacturer);
  put('model',m.model);
  put('kind',m.kind);
  put('type',m.kind);
  put('rackUnits',m.rackUnits);
  put('weightKg',m.weightKg);
  put('powerDrawWatts',m.powerTypicalWatts);
  put('powerMaxWatts',m.powerMaxWatts);
  put('poeBudgetW',m.poeBudgetWatts);
  if(m.id){
    d.modelSource='custom';
    d.modelRef=m.id;
  }
  return d;
}

const api={version:'netwizard-custom-device-models-v1',list,get,resolve,expandPortGroups,applyModel};
root.NetWizardCustomDeviceModels=api;
if(typeof module!=='undefined'&&module.exports)module.exports=api;
})(typeof window!=='undefined'?window:globalThis);
