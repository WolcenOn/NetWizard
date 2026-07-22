/* NetWizard WAN Circuits v1 */
(function initNetWizardWanCircuits(root){
'use strict';
function arr(v){return Array.isArray(v)?v:[];}
function clean(v){return String(v==null?'':v).trim();}
function num(v){const n=Number(v);return Number.isFinite(n)?n:null;}
function circuitDevice(project,c){return arr(project&&project.devices).find(d=>d.id===c.deviceId)||null;}
function circuitPort(project,c){return arr(project&&project.ports).find(p=>p.id===c.portId)||null;}
function requestedMbps(project,c){const direct=num(c.expectedPeakMbps);if(direct!=null)return direct;return arr(project&&project.trafficProfiles).filter(p=>!p.circuitRef||p.circuitRef===c.id).reduce((s,p)=>s+(num(p.peakMbps)||0),0);}
function validateCircuit(project,c){const issues=[],id=clean(c.id),label=clean(c.name||id||'Circuito WAN'),down=num(c.bandwidthDownMbps),up=num(c.bandwidthUpMbps),lat=num(c.latencyTargetMs),loss=num(c.lossTargetPercent),sla=num(c.slaAvailability),peak=requestedMbps(project,c);const base={category:'wan',circuitId:id};
if(!clean(c.provider))issues.push({...base,code:'NW-WAN-001',severity:'warning',blocking:false,message:`${label}: proveedor no indicado.`});
if(!down||down<=0||!up||up<=0)issues.push({...base,code:'NW-WAN-002',severity:'error',blocking:true,message:`${label}: ancho de banda de bajada/subida inválido.`});
if(c.deviceId&&!circuitDevice(project,c))issues.push({...base,code:'NW-WAN-003',severity:'error',blocking:true,message:`${label}: dispositivo de terminación inexistente (${c.deviceId}).`});
if(c.portId&&!circuitPort(project,c))issues.push({...base,code:'NW-WAN-004',severity:'error',blocking:true,message:`${label}: interfaz WAN inexistente (${c.portId}).`});
if(lat!=null&&(lat<0||lat>1000))issues.push({...base,code:'NW-WAN-005',severity:'warning',blocking:false,message:`${label}: objetivo de latencia anómalo (${lat} ms).`});
if(loss!=null&&(loss<0||loss>100))issues.push({...base,code:'NW-WAN-006',severity:'error',blocking:true,message:`${label}: pérdida objetivo inválida (${loss}%).`});
if(sla!=null&&(sla<0||sla>100))issues.push({...base,code:'NW-WAN-007',severity:'error',blocking:true,message:`${label}: disponibilidad SLA inválida (${sla}%).`});
if(up&&peak>up)issues.push({...base,code:'NW-WAN-008',severity:'error',blocking:true,message:`${label}: demanda pico ${peak} Mbps supera la subida contratada ${up} Mbps.`});
else if(up&&peak>up*.8)issues.push({...base,code:'NW-WAN-009',severity:'warning',blocking:false,message:`${label}: demanda pico ${peak} Mbps supera el 80% de la subida ${up} Mbps.`});
return issues;}
function validateFailover(project,circuits){const issues=[];const groups=new Map();for(const c of circuits){const key=clean(c.siteRef||c.deviceId||'global');if(!groups.has(key))groups.set(key,[]);groups.get(key).push(c);}for(const [key,list] of groups){const enabled=list.filter(c=>c.enabled!==false);if(enabled.length<2)continue;const providers=new Set(enabled.map(c=>clean(c.provider)).filter(Boolean));const paths=new Set(enabled.map(c=>clean(c.physicalPath||c.demarcLocation)).filter(Boolean));if(providers.size<2)issues.push({code:'NW-WAN-010',severity:'warning',blocking:false,category:'wan',siteRef:key,message:`WAN ${key}: múltiples circuitos comparten proveedor; la redundancia comercial es limitada.`});if(paths.size&&paths.size<2)issues.push({code:'NW-WAN-011',severity:'warning',blocking:false,category:'wan',siteRef:key,message:`WAN ${key}: los circuitos comparten demarcación o recorrido físico.`});const primary=enabled.find(c=>clean(c.role)==='primary')||enabled[0],backups=enabled.filter(c=>c!==primary),demand=requestedMbps(project,primary),backupCapacity=backups.reduce((s,c)=>s+(num(c.bandwidthUpMbps)||0),0);if(demand>backupCapacity)issues.push({code:'NW-WAN-012',severity:'warning',blocking:false,category:'wan',siteRef:key,message:`WAN ${key}: capacidad de respaldo ${backupCapacity} Mbps insuficiente para el pico ${demand} Mbps.`});}
return issues;}
function validateProject(project){const circuits=arr(project&&project.wanCircuits),issues=[];for(const c of circuits)issues.push(...validateCircuit(project||{},c));issues.push(...validateFailover(project||{},circuits));return{version:'netwizard-wan-circuits-v1',ok:!issues.some(i=>i.blocking),issues,counts:{blocking:issues.filter(i=>i.blocking).length,warnings:issues.filter(i=>i.severity==='warning').length},circuits:circuits.map(c=>({id:c.id,name:c.name,provider:c.provider,role:c.role,bandwidthDownMbps:c.bandwidthDownMbps,bandwidthUpMbps:c.bandwidthUpMbps,expectedPeakMbps:requestedMbps(project||{},c)}))};}
const api={version:'netwizard-wan-circuits-v1',validateCircuit,validateProject,requestedMbps};root.NetWizardWanCircuits=api;if(typeof module!=='undefined'&&module.exports)module.exports=api;
})(typeof window!=='undefined'?window:globalThis);
