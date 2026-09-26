/* NetWizard Physical Inventory UI v2 */
(function initNetWizardPhysicalInventoryUi(root){
'use strict';

function el(id){return root.document&&root.document.getElementById(id);}
function make(tag,text){const n=root.document.createElement(tag);if(text!=null)n.textContent=String(text);return n;}
function clean(v){return String(v==null?'':v).trim();}
function arr(v){return Array.isArray(v)?v:[];}
function clone(v){return JSON.parse(JSON.stringify(v==null?null:v));}
function numberValue(id){const node=el(id);if(!node||clean(node.value)==='')return undefined;const n=Number(node.value);return Number.isFinite(n)?n:undefined;}
function textValue(id){const v=clean(el(id)?.value);return v||undefined;}
function field(id,label,type){
  const w=make('div'),l=make('label',label),i=make(type==='select'?'select':'input');
  l.className='fl';i.id=id;if(type&&type!=='select')i.type=type;w.append(l,i);return{wrap:w,input:i};
}
function snapshot(){return root.NetWizardState?.getSnapshot?.()||null;}
function selectedDevice(){
  const state=snapshot(),id=clean(el('devEditId')?.value);
  return state&&id?arr(state.devices).find(d=>d.id===id):null;
}
function selectedPort(){
  const state=snapshot(),id=clean(el('portEditId')?.value);
  return state&&id?arr(state.ports).find(p=>p.id===id):null;
}
function setOptions(selectNode,items,emptyLabel){
  if(!selectNode)return;
  const current=selectNode.value;selectNode.textContent='';
  if(emptyLabel){const o=make('option',emptyLabel);o.value='';selectNode.append(o);}
  for(const [value,label] of items){const o=make('option',label);o.value=value;selectNode.append(o);}
  if(items.some(x=>String(x[0])===String(current)))selectNode.value=current;
}
function fillPhysicalSelects(){
  const p=snapshot();if(!p)return;
  setOptions(el('devPhysicalLocation'),arr(p.physicalLocations).map(x=>[x.id,x.name||x.id]),'— sin ubicación —');
  setOptions(el('devRack'),arr(p.racks).map(x=>[x.id,x.name||x.id]),'— sin rack —');
}

function injectDeviceFields(){
  const notes=el('devNotes');if(!notes||el('nwPhysicalDeviceFields'))return;
  const box=make('div');box.id='nwPhysicalDeviceFields';box.className='card';box.style.margin='10px 0';
  const title=make('div','Inventario físico / As-Built');title.className='card-t';box.append(title);
  const hint=make('div','Completa solo lo observado. Si usas un modelo global/personalizado, los valores del modelo se conservan salvo que indiques un dato de instancia.');hint.className='hint';box.append(hint);

  const grid1=make('div');grid1.className='row';
  const manufacturer=field('devManufacturer','Fabricante','text'),serial=field('devSerialNumber','Número de serie','text'),asset=field('devAssetTag','Asset tag','text');
  [manufacturer,serial,asset].forEach(x=>grid1.append(x.wrap));box.append(grid1);

  const grid2=make('div');grid2.className='row';
  const location=field('devPhysicalLocation','Ubicación observada','select'),rack=field('devRack','Rack / armario','select'),unit=field('devRackUnit','Unidad inicial (U)','number'),height=field('devRackUnits','Altura (U)','number');
  [location,rack,unit,height].forEach(x=>grid2.append(x.wrap));box.append(grid2);

  const grid3=make('div');grid3.className='row';
  const budget=field('devPowerBudget','Presupuesto eléctrico (W)','number'),draw=field('devPowerDraw','Consumo observado/estimado (W)','number'),psu=field('devPsuCount','Número de PSU','number');
  [budget,draw,psu].forEach(x=>grid3.append(x.wrap));
  const redundant=make('label',' PSU redundantes');redundant.className='chk';const check=make('input');check.type='checkbox';check.id='devPsuRedundant';redundant.prepend(check);grid3.append(redundant);box.append(grid3);

  notes.parentElement.insertBefore(box,notes.previousElementSibling||notes);
  fillPhysicalSelects();
}
function injectPortFields(){
  const card=el('portFormCard');if(!card||el('nwAdvancedPortFields'))return;
  const box=make('div');box.id='nwAdvancedPortFields';box.style.marginTop='10px';
  const title=make('div','Propiedades físicas observadas');title.className='card-t';box.append(title);
  const grid=make('div');grid.className='row';
  const speed=field('pSpeedMax','Velocidad máxima Mbps','number'),neg=field('pNegotiatedSpeed','Velocidad negociada Mbps','number'),mtu=field('pMtu','MTU','number'),xcvr=field('pTransceiver','Transceptor','text'),conn=field('pConnector','Conector','text'),util=field('pUtilization','Utilización %','number'),admin=field('pAdminState','Estado administrativo','select'),oper=field('pOperState','Estado operativo','select');
  ['','up','down'].forEach(v=>{const o=make('option',v||'—');o.value=v;admin.input.append(o.cloneNode(true));oper.input.append(o);});
  [speed,neg,mtu,xcvr,conn,util,admin,oper].forEach(x=>grid.append(x.wrap));box.append(grid);card.append(box);
}
function readDevicePatch(){
  const p=snapshot()||{},patch={};
  const manufacturer=textValue('devManufacturer'),serial=textValue('devSerialNumber'),asset=textValue('devAssetTag');
  if(manufacturer!==undefined)patch.manufacturer=manufacturer;
  if(serial!==undefined)patch.serialNumber=serial;
  if(asset!==undefined)patch.assetTag=asset;

  const locationId=textValue('devPhysicalLocation');
  if(locationId){
    patch.locationId=locationId;
    patch.physicalLocation=arr(p.physicalLocations).find(x=>x.id===locationId)?.name||undefined;
  }
  const rackId=textValue('devRack');
  if(rackId){patch.rackId=rackId;patch.rack=rackId;}

  const rackUnit=numberValue('devRackUnit'),rackUnits=numberValue('devRackUnits'),budget=numberValue('devPowerBudget'),draw=numberValue('devPowerDraw');
  if(rackUnit!==undefined)patch.rackUnit=rackUnit;
  if(rackUnits!==undefined)patch.rackUnits=rackUnits;
  if(budget!==undefined)patch.powerBudgetWatts=budget;
  if(draw!==undefined)patch.powerDrawWatts=draw;

  const psuCount=numberValue('devPsuCount');
  if(psuCount!==undefined){
    const count=Math.max(0,Math.min(16,Math.floor(psuCount))),current=arr(selectedDevice()?.powerSupplies),redundant=!!el('devPsuRedundant')?.checked;
    patch.powerSupplies=Array.from({length:count},(_,i)=>Object.assign({},current[i]||{index:i},{index:i,redundant:count>1&&redundant}));
  }
  return patch;
}
function readPortPatch(){
  const patch={};
  const values={
    speedMaxMbps:numberValue('pSpeedMax'),
    negotiatedSpeedMbps:numberValue('pNegotiatedSpeed'),
    mtu:numberValue('pMtu'),
    utilizationPercent:numberValue('pUtilization')
  };
  for(const [key,value] of Object.entries(values))if(value!==undefined)patch[key]=value;
  const text={transceiver:textValue('pTransceiver'),connector:textValue('pConnector'),adminState:textValue('pAdminState'),operState:textValue('pOperState')};
  for(const [key,value] of Object.entries(text))if(value!==undefined)patch[key]=value;
  return patch;
}
function applyDevicePatchToProject(project,context,patch){
  const next=clone(project||{}),before=new Set(arr(context&&context.beforeIds));
  let target=null;
  if(context&&context.editId)target=arr(next.devices).find(d=>d.id===context.editId)||null;
  if(!target)target=arr(next.devices).find(d=>!before.has(d.id))||null;
  if(!target&&context&&context.name)target=arr(next.devices).slice().reverse().find(d=>clean(d.name)===clean(context.name))||null;
  if(!target)return{project:next,targetId:null};
  Object.assign(target,patch||{});
  return{project:next,targetId:target.id};
}
function applyPortPatchToProject(project,context,patch){
  const next=clone(project||{}),before=new Set(arr(context&&context.beforeIds));
  let target=null;
  if(context&&context.editId)target=arr(next.ports).find(p=>p.id===context.editId)||null;
  if(!target)target=arr(next.ports).find(p=>!before.has(p.id))||null;
  if(!target&&context&&context.deviceId&&context.name)target=arr(next.ports).slice().reverse().find(p=>p.deviceId===context.deviceId&&clean(p.name)===clean(context.name))||null;
  if(!target)return{project:next,targetId:null};
  Object.assign(target,patch||{});
  return{project:next,targetId:target.id};
}
function clearDeviceFields(){
  for(const id of ['devManufacturer','devSerialNumber','devAssetTag','devPhysicalLocation','devRack','devRackUnit','devRackUnits','devPowerBudget','devPowerDraw','devPsuCount'])if(el(id))el(id).value='';
  if(el('devPsuRedundant'))el('devPsuRedundant').checked=false;
  fillPhysicalSelects();
}
function clearPortFields(){
  for(const id of ['pSpeedMax','pNegotiatedSpeed','pMtu','pTransceiver','pConnector','pUtilization','pAdminState','pOperState'])if(el(id))el(id).value='';
}
function loadDevice(){
  fillPhysicalSelects();
  const d=selectedDevice();if(!d)return;
  const locationId=d.locationId||d.physicalLocationId||arr(snapshot()?.physicalLocations).find(x=>clean(x.name).toLowerCase()===clean(d.physicalLocation).toLowerCase())?.id||'';
  const map={devManufacturer:d.manufacturer,devSerialNumber:d.serialNumber,devAssetTag:d.assetTag,devPhysicalLocation:locationId,devRack:d.rackId||d.rack,devRackUnit:d.rackUnit,devRackUnits:d.rackUnits,devPowerBudget:d.powerBudgetWatts,devPowerDraw:d.powerDrawWatts,devPsuCount:arr(d.powerSupplies).length};
  Object.entries(map).forEach(([id,v])=>{if(el(id))el(id).value=v==null?'':v;});
  if(el('devPsuRedundant'))el('devPsuRedundant').checked=arr(d.powerSupplies).length>1&&arr(d.powerSupplies).some(x=>x&&x.redundant===true);
}
function loadPort(){
  const p=selectedPort();if(!p)return;
  const map={pSpeedMax:p.speedMaxMbps,pNegotiatedSpeed:p.negotiatedSpeedMbps,pMtu:p.mtu,pTransceiver:p.transceiver,pConnector:p.connector,pUtilization:p.utilizationPercent,pAdminState:p.adminState,pOperState:p.operState};
  Object.entries(map).forEach(([id,v])=>{if(el(id))el(id).value=v==null?'':v;});
}
function wrapDeviceSave(){
  const b=el('btnAddDev');if(!b||typeof b.onclick!=='function')return false;if(b.__nwPhysicalWrapped)return true;
  const original=b.onclick;
  b.onclick=function(event){
    const before=snapshot()||{},context={editId:clean(el('devEditId')?.value),name:clean(el('devName')?.value),beforeIds:arr(before.devices).map(d=>d.id)},patch=readDevicePatch();
    const result=original.call(this,event);
    root.setTimeout(()=>{
      const after=snapshot();if(!after)return;
      const successful=context.editId?clean(el('devEditId')?.value)!==context.editId:arr(after.devices).some(d=>!new Set(context.beforeIds).has(d.id));
      if(!successful)return;
      const applied=applyDevicePatchToProject(after,context,patch);
      if(applied.targetId&&root.NetWizardState?.replaceProject)root.NetWizardState.replaceProject(applied.project,{source:'physical-inventory-device'});
      clearDeviceFields();
    },0);
    return result;
  };
  b.__nwPhysicalWrapped=true;return true;
}
function wrapPortSave(){
  const b=el('btnAddPort');if(!b||typeof b.onclick!=='function')return false;if(b.__nwPhysicalWrapped)return true;
  const original=b.onclick;
  b.onclick=function(event){
    const before=snapshot()||{},context={editId:clean(el('portEditId')?.value),deviceId:clean(el('pDev')?.value),name:clean(el('pName')?.value),beforeIds:arr(before.ports).map(p=>p.id)},patch=readPortPatch();
    const result=original.call(this,event);
    root.setTimeout(()=>{
      const after=snapshot();if(!after)return;
      const successful=context.editId?clean(el('portEditId')?.value)!==context.editId:arr(after.ports).some(p=>!new Set(context.beforeIds).has(p.id));
      if(!successful)return;
      const applied=applyPortPatchToProject(after,context,patch);
      if(applied.targetId&&root.NetWizardState?.replaceProject)root.NetWizardState.replaceProject(applied.project,{source:'physical-inventory-port'});
      clearPortFields();
    },0);
    return result;
  };
  b.__nwPhysicalWrapped=true;return true;
}
function bindEditSync(){
  root.document.addEventListener('click',event=>{
    const button=event.target&&event.target.closest&&event.target.closest('button');if(!button)return;
    root.setTimeout(()=>{
      if(clean(el('devEditId')?.value))loadDevice();
      if(clean(el('portEditId')?.value))loadPort();
    },0);
  });
  el('btnCancelDevEdit')?.addEventListener('click',clearDeviceFields);
  el('btnCancelPortEdit')?.addEventListener('click',clearPortFields);
}
function bind(attempt){
  injectDeviceFields();injectPortFields();fillPhysicalSelects();
  const deviceWrapped=wrapDeviceSave(),portWrapped=wrapPortSave();
  if((!deviceWrapped||!portWrapped)&&(attempt||0)<40){root.setTimeout(()=>bind((attempt||0)+1),100);return false;}
  if(!root.document.__nwPhysicalEditSync){root.document.__nwPhysicalEditSync=true;bindEditSync();}
  if(!root.document.__nwPhysicalProjectChange){
    root.document.__nwPhysicalProjectChange=true;
    root.document.addEventListener('nw:project:changed',()=>{fillPhysicalSelects();if(clean(el('devEditId')?.value))loadDevice();if(clean(el('portEditId')?.value))loadPort();});
  }
  loadDevice();loadPort();return true;
}

const api={
  version:'netwizard-physical-inventory-ui-v2',
  injectDeviceFields,injectPortFields,readDevicePatch,readPortPatch,
  applyDevicePatchToProject,applyPortPatchToProject,loadDevice,loadPort,bind
};
root.NetWizardPhysicalInventoryUi=api;
if(typeof module!=='undefined'&&module.exports)module.exports=api;
if(root.document){if(root.document.readyState==='loading')root.document.addEventListener('DOMContentLoaded',()=>bind(0));else bind(0);}
})(typeof window!=='undefined'?window:globalThis);
