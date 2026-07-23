/* =========================================================
   NetWizard Device Capability Form v0.1
   Amplía el formulario clásico de dispositivos sin modificar su núcleo.
========================================================= */
(function initNetWizardDeviceCapabilityForm(root){
'use strict';
function arr(v){return Array.isArray(v)?v:[];}
function clean(v){return String(v==null?'':v).trim();}
function registry(){return root.NetWizardCapabilityRegistry||null;}
function state(){return root.NetWizardState||null;}
function el(id){return root.document&&root.document.getElementById(id);}
function make(tag,attrs,text){const n=root.document.createElement(tag);for(const [k,v] of Object.entries(attrs||{})){if(k==='className')n.className=v;else if(k==='htmlFor')n.htmlFor=v;else n.setAttribute(k,v);}if(text!=null)n.textContent=String(text);return n;}
function normalizeRequested(value){const out={};if(Array.isArray(value)){value.forEach(id=>{id=clean(id);if(id)out[id]=true;});return out;}if(value&&typeof value==='object'){for(const [id,enabled] of Object.entries(value))if(enabled)out[clean(id)]=enabled===true?true:enabled;}return out;}
function selectedCapabilities(container){const out={};if(!container)return out;container.querySelectorAll('input[type="checkbox"][data-capability]').forEach(cb=>{if(cb.checked)out[cb.dataset.capability]=true;});return out;}
function statusLabel(status){return status==='supported'?'Disponible':status==='partial'?'Parcial':status==='planned'?'Planificada':'No compatible';}
function statusClass(status){return status==='supported'?'bgn':status==='partial'?'byw':status==='planned'?'bac':'brd';}
function platformForVendor(vendor){const R=registry();if(!R)return null;return R.resolvePlatform({vendorOs:vendor})||null;}
function ensureFields(){
 const vendor=el('devVendor'),model=el('devModel');if(!vendor||!model||el('devCompatibilityFields'))return false;
 const host=make('div',{id:'devCompatibilityFields'});
 const row=make('div',{className:'row'});
 const versionWrap=make('div');versionWrap.append(make('label',{className:'fl',htmlFor:'devOsVersion'},'Versión de firmware / OS'),make('input',{id:'devOsVersion',placeholder:'17.9.4, 7.2.8, 10.13...'}));
 const licenseWrap=make('div');licenseWrap.append(make('label',{className:'fl',htmlFor:'devLicense'},'Licencia / nivel'),make('input',{id:'devLicense',placeholder:'network-advantage, enterprise, utm...'}));
 row.append(versionWrap,licenseWrap);
 const title=make('label',{className:'fl'},'Capacidades solicitadas');
 const caps=make('div',{id:'devCapabilityChoices',className:'co co-ac'});
 const hint=make('div',{id:'devCapabilitySelectionHint',className:'hint'});
 host.append(row,title,caps,hint);
 const modelHint=el('devModelHint');(modelHint&&modelHint.parentNode?modelHint.parentNode:model.parentNode).insertBefore(host,modelHint||null);
 vendor.addEventListener('change',renderChoices);
 return true;
}
function renderChoices(){
 const box=el('devCapabilityChoices'),hint=el('devCapabilitySelectionHint');if(!box)return;
 box.textContent='';if(hint)hint.textContent='';
 const platform=platformForVendor(el('devVendor')&&el('devVendor').value);
 if(!platform){box.append(make('span',{className:'hint'},'Selecciona una plataforma registrada para ver sus capacidades.'));return;}
 const current=normalizeRequested((box.dataset.requested&&JSON.parse(box.dataset.requested))||{});
 const entries=Object.entries(platform.capabilities||{}).sort((a,b)=>a[0].localeCompare(b[0]));
 const grid=make('div');grid.style.display='grid';grid.style.gridTemplateColumns='repeat(auto-fit,minmax(190px,1fr))';grid.style.gap='6px';
 entries.forEach(([id,cap])=>{const label=make('label');label.style.display='flex';label.style.alignItems='center';label.style.gap='6px';label.style.padding='6px';label.style.border='1px solid var(--bd)';label.style.borderRadius='8px';const cb=make('input',{type:'checkbox','data-capability':id});cb.checked=!!current[id];cb.disabled=cap.status==='unsupported';const badge=make('span',{className:`b ${statusClass(cap.status)}`},statusLabel(cap.status));label.append(cb,make('span',{},id),badge);if(cap.minVersion)label.title=`Versión mínima: ${cap.minVersion}`;grid.append(label);});
 box.append(grid);if(hint)hint.textContent=`${platform.label} · ${entries.length} capacidades registradas. Las parciales requieren revisión; las planificadas bloquearán producción si se solicitan.`;
}
function loadDeviceFields(device){
 if(!ensureFields())return;
 el('devOsVersion').value=clean(device&&device.osVersion);
 el('devLicense').value=clean(device&&device.license);
 const box=el('devCapabilityChoices');box.dataset.requested=JSON.stringify(normalizeRequested(device&&device.capabilitiesRequested));
 renderChoices();
}
function clearFields(){if(!ensureFields())return;el('devOsVersion').value='';el('devLicense').value='';const box=el('devCapabilityChoices');box.dataset.requested='{}';renderChoices();}
function persistFields(context){
 const S=state();if(!S||!S.getSnapshot||!S.replaceProject)return;
 const snap=S.getSnapshot(),devices=arr(snap.devices);let target=null;
 if(context.editId)target=devices.find(d=>d.id===context.editId);
 if(!target)target=devices.slice().reverse().find(d=>clean(d.name)===context.name&&clean(d.vendorOs)===context.vendor);
 if(!target)return;
 target.platform=clean(context.vendor)||null;
 target.osVersion=clean(context.osVersion)||null;
 target.license=clean(context.license)||null;
 target.capabilitiesRequested=normalizeRequested(context.capabilitiesRequested);
 S.replaceProject(snap,{source:'device-capability-form',skipRefresh:false});
}
function wrapSaveButton(){
 const button=el('btnAddDev');if(!button||button.__nwCapabilityWrapped||typeof button.onclick!=='function')return false;
 const original=button.onclick;
 button.onclick=function(event){
   const context={editId:clean(el('devEditId')&&el('devEditId').value),name:clean(el('devName')&&el('devName').value),vendor:clean(el('devVendor')&&el('devVendor').value),osVersion:clean(el('devOsVersion')&&el('devOsVersion').value),license:clean(el('devLicense')&&el('devLicense').value),capabilitiesRequested:selectedCapabilities(el('devCapabilityChoices'))};
   const result=original.call(this,event);
   root.setTimeout(()=>persistFields(context),0);
   return result;
 };
 button.__nwCapabilityWrapped=true;return true;
}
function bindEditClicks(){
 root.document.addEventListener('click',event=>{const button=event.target&&event.target.closest&&event.target.closest('[data-edit-device],button');if(!button)return;root.setTimeout(()=>{const id=clean(el('devEditId')&&el('devEditId').value);if(!id)return;const S=state(),snap=S&&S.getSnapshot?S.getSnapshot():null;const d=arr(snap&&snap.devices).find(x=>x.id===id);if(d)loadDeviceFields(d);},0);});
 const cancel=el('btnCancelDevEdit');if(cancel)cancel.addEventListener('click',()=>root.setTimeout(clearFields,0));
}
function install(attempt){
 if(!root.document)return false;
 ensureFields();
 const wrapped=wrapSaveButton();
 if(!wrapped&&(attempt||0)<50){root.setTimeout(()=>install((attempt||0)+1),100);return false;}
 bindEditClicks();clearFields();return true;
}
const api={version:'netwizard-device-capability-form-v1',install,normalizeRequested,selectedCapabilities,platformForVendor,loadDeviceFields};
root.NetWizardDeviceCapabilityForm=api;
if(typeof module!=='undefined'&&module.exports)module.exports=api;
if(root.document){if(root.document.readyState==='loading')root.document.addEventListener('DOMContentLoaded',()=>install(0));else install(0);}
})(typeof window!=='undefined'?window:globalThis);
