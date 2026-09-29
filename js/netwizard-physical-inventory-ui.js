/* NetWizard Physical Inventory UI v0.1 */
(function initNetWizardPhysicalInventoryUi(root){
'use strict';
function el(id){return root.document&&root.document.getElementById(id);} function make(tag,text){const n=root.document.createElement(tag);if(text!=null)n.textContent=String(text);return n;} function clean(v){return String(v==null?'':v).trim();}
function field(id,label,type){const w=make('div'),l=make('label',label),i=make(type==='select'?'select':'input');l.className='fl';i.id=id;if(type&&type!=='select')i.type=type;w.append(l,i);return{wrap:w,input:i};}
function selectedDevice(){const state=root.NetWizardState&&root.NetWizardState.getSnapshot?root.NetWizardState.getSnapshot():null,id=clean(el('devEditId')&&el('devEditId').value);return state&&id?state.devices.find(d=>d.id===id):null;}
function injectDeviceFields(){const notes=el('devNotes');if(!notes||el('nwPhysicalDeviceFields'))return;const box=make('div');box.id='nwPhysicalDeviceFields';box.className='card';box.style.margin='10px 0';box.append(make('div','Inventario del equipo'));const hint=make('div','La colocación física (rack, U y altura) se gestiona en Inventario físico para mantener una única fuente de verdad.');hint.className='hint';hint.style.margin='6px 0 9px';box.append(hint);const grid=make('div');grid.className='row';const serial=field('devSerialNumber','Número de serie','text'),budget=field('devPowerBudget','Presupuesto eléctrico (W)','number'),draw=field('devPowerDraw','Consumo estimado (W)','number');[serial,budget,draw].forEach(x=>grid.append(x.wrap));box.append(grid);notes.parentElement.insertBefore(box,notes.previousElementSibling||notes);}
function injectPortFields(){
  const card=el('portFormCard');if(!card||el('nwAdvancedPortFields'))return;
  const box=make('div');box.id='nwAdvancedPortFields';box.style.marginTop='10px';
  box.append(make('div','Propiedades avanzadas de interfaz'));
  const desired=make('div');desired.className='card';desired.style.margin='8px 0';
  desired.append(make('div','Capacidad y configuración'));
  const desiredHint=make('div','Datos propios del puerto o de su configuración objetivo. El estado administrativo expresa intención (To-Be).');desiredHint.className='hint';desiredHint.style.margin='5px 0 8px';desired.append(desiredHint);
  const desiredGrid=make('div');desiredGrid.className='row';
  const speed=field('pSpeedMax','Velocidad máxima Mbps','number'),mtu=field('pMtu','MTU','number'),xcvr=field('pTransceiver','Transceptor','text'),conn=field('pConnector','Conector','text'),admin=field('pAdminState','Estado administrativo (To-Be)','select');
  ['','up','down'].forEach(v=>{const o=make('option',v||'—');o.value=v;admin.input.append(o);});
  [speed,mtu,xcvr,conn,admin].forEach(x=>desiredGrid.append(x.wrap));desired.append(desiredGrid);
  const observed=make('div');observed.className='card';observed.style.margin='8px 0';
  observed.append(make('div','Observado / As-Built'));
  const observedHint=make('div','Valores medidos o vistos en campo. Documentan el estado real y no son órdenes de configuración.');observedHint.className='hint';observedHint.style.margin='5px 0 8px';observed.append(observedHint);
  const observedGrid=make('div');observedGrid.className='row';
  const neg=field('pNegotiatedSpeed','Velocidad negociada Mbps','number'),util=field('pUtilization','Utilización %','number'),oper=field('pOperState','Estado operativo observado','select');
  ['','up','down'].forEach(v=>{const o=make('option',v||'—');o.value=v;oper.input.append(o);});
  [neg,util,oper].forEach(x=>observedGrid.append(x.wrap));observed.append(observedGrid);
  box.append(desired,observed);card.append(box);
}
function readDevicePatch(){return{serialNumber:clean(el('devSerialNumber')?.value)||null,powerBudgetWatts:Number(el('devPowerBudget')?.value)||null,powerDrawWatts:Number(el('devPowerDraw')?.value)||null};}
function loadDevice(){const d=selectedDevice();if(!d)return;const map={devSerialNumber:d.serialNumber,devPowerBudget:d.powerBudgetWatts,devPowerDraw:d.powerDrawWatts};Object.entries(map).forEach(([id,v])=>{if(el(id))el(id).value=v==null?'':v;});}
function persistDevice(){const id=clean(el('devEditId')?.value);if(!id||!root.NetWizardState?.updateProject)return;root.NetWizardState.updateProject(project=>{const devices=(project.devices||[]).map(d=>d.id===id?Object.assign({},d,readDevicePatch()):d);return Object.assign({},project,{devices});},{source:'physical-inventory-ui'});}
function bind(){injectDeviceFields();injectPortFields();el('devEditId')?.addEventListener('change',loadDevice);el('btnAddDev')?.addEventListener('click',()=>setTimeout(persistDevice,0));root.document.addEventListener('nw:project:changed',loadDevice);loadDevice();return true;}
const api={version:'netwizard-physical-inventory-ui-v1',injectDeviceFields,injectPortFields,readDevicePatch,bind};root.NetWizardPhysicalInventoryUi=api;if(typeof module!=='undefined'&&module.exports)module.exports=api;if(root.document){if(root.document.readyState==='loading')root.document.addEventListener('DOMContentLoaded',bind);else bind();}
})(typeof window!=='undefined'?window:globalThis);
