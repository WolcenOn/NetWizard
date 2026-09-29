/* NetWizard Inventory Gate v1 */
(function(root){
'use strict';
const arr=v=>Array.isArray(v)?v:[];
const clean=v=>String(v==null?'':v).trim();
const fallbackPhysical=typeof require==='function'?require('./netwizard-physical-inventory.js'):null;
const fallbackRack=typeof require==='function'?require('./netwizard-rack-model.js'):null;
const fallbackCabling=typeof require==='function'?require('./netwizard-structured-cabling.js'):null;
const physical=()=>root.NetWizardPhysicalInventory||fallbackPhysical;
const rack=()=>root.NetWizardRackModel||fallbackRack;
const cabling=()=>root.NetWizardStructuredCabling||fallbackCabling;
function issue(code,severity,blocking,message,extra){return Object.assign({code,severity,blocking:!!blocking,category:'inventory',message},extra||{});}
function validate(project){
 const p=project||{},issues=[];
 if(!arr(p.physicalLocations).length)issues.push(issue('NW-INV-001','warning',false,'No hay ubicaciones físicas documentadas.'));
 if(!arr(p.racks).length)issues.push(issue('NW-INV-002','warning',false,'No hay racks o armarios documentados.'));
 if(!arr(p.devices).length)issues.push(issue('NW-INV-003','warning',false,'No hay equipos documentados.'));
 for(const d of arr(p.devices)){
   if(!clean(d.manufacturer)&&!clean(d.vendor)&&!clean(d.vendorOs))issues.push(issue('NW-INV-010','warning',false,`${d.name||d.id}: falta fabricante/vendor.`,{deviceId:d.id}));
   if(!clean(d.model))issues.push(issue('NW-INV-011','warning',false,`${d.name||d.id}: falta modelo.`,{deviceId:d.id}));
   if((d.rackId||d.rack)&&!(d.rackUnit||d.rackUnit===0))issues.push(issue('NW-INV-012','warning',false,`${d.name||d.id}: está asociado a rack pero no tiene U inicial.`,{deviceId:d.id}));
   if(!clean(d.serialNumber)&&!clean(d.assetTag))issues.push(issue('NW-INV-013','info',false,`${d.name||d.id}: no tiene número de serie ni asset tag.`,{deviceId:d.id}));
 }
 for(const pdu of arr(p.pdus)){
   if(!pdu.rackId)issues.push(issue('NW-INV-020','warning',false,`${pdu.name||pdu.id}: PDU sin rack asociado.`,{pduId:pdu.id}));
 }
 for(const pp of arr(p.patchPanels)){
   if(!pp.rackId)issues.push(issue('NW-INV-030','warning',false,`${pp.name||pp.id}: patch panel sin rack asociado.`,{patchPanelId:pp.id}));
 }
 const phy=physical(),rk=rack(),cab=cabling();
 if(phy&&phy.validateProject)issues.push(...arr(phy.validateProject(p).issues));
 if(rk&&rk.validate)issues.push(...arr(rk.validate(p).issues));
 if(cab&&cab.validate)issues.push(...arr(cab.validate(p).issues));
 const seen=new Set(),dedup=[];
 for(const i of issues){const k=[i.code,i.deviceId,i.portId,i.rackId,i.pduId,i.patchPanelId,i.message].join('|');if(seen.has(k))continue;seen.add(k);dedup.push(i);}
 const blocking=dedup.filter(i=>i.blocking||i.severity==='error').length;
 const warnings=dedup.filter(i=>i.severity==='warning').length;
 const info=dedup.filter(i=>i.severity==='info').length;
 const placedDeviceIds=new Set(arr(p.rackItems).filter(x=>x&&x.type==='device'&&x.deviceId).map(x=>x.deviceId));
 const score={
   locations:arr(p.physicalLocations).length,
   racks:arr(p.racks).length,
   rackItems:arr(p.rackItems).length,
   devices:arr(p.devices).length,
   placedDevices:placedDeviceIds.size,
   ports:arr(p.ports).length,
   pdus:arr(p.pdus).length,
   powerConnections:arr(p.powerConnections).length,
   patchPanels:arr(p.patchPanels).length,
   cableRuns:arr(p.cableRuns).length
 };
 return{version:'netwizard-inventory-gate-v1',ok:blocking===0,status:blocking?'blocked':warnings?'review':'ready',issues:dedup,counts:{blocking,warnings,info},score};
}
const api={version:'netwizard-inventory-gate-v1',validate};
root.NetWizardInventoryGate=api;
if(typeof module!=='undefined'&&module.exports)module.exports=api;
})(typeof window!=='undefined'?window:globalThis);
