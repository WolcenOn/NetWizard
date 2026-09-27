/* NetWizard As-Built Export Pack v1 */
(function initNetWizardAsBuiltExports(root){
'use strict';

const arr=v=>Array.isArray(v)?v:[];
const obj=v=>v&&typeof v==='object'&&!Array.isArray(v)?v:{};
const clean=v=>String(v==null?'':v).trim();
const clone=v=>JSON.parse(JSON.stringify(v==null?null:v));
const byId=(list,id)=>arr(list).find(x=>x&&x.id===id)||null;
const docs=()=>root.NetWizardDocumentationUtils||(typeof require==='function'?require('./netwizard-documentation-utils.js'):null);
const racks=()=>root.NetWizardRackModel||(typeof require==='function'?require('./netwizard-rack-model.js'):null);
const fieldPkg=()=>root.NetWizardFieldInterventionPackage||(typeof require==='function'?require('./netwizard-field-intervention-package.js'):null);

function locationPath(project,locationId){
  const locations=new Map(arr(project&&project.physicalLocations).filter(Boolean).map(x=>[x.id,x]));
  const names=[],seen=new Set();let id=clean(locationId),guard=0;
  while(id&&locations.has(id)&&!seen.has(id)&&guard++<32){
    seen.add(id);const loc=locations.get(id);names.unshift(clean(loc.name)||id);id=clean(loc.parentId);
  }
  return names.join(' / ');
}
function deviceRows(project){
  const p=obj(project);
  return arr(p.devices).map(d=>({
    id:d.id||'',
    name:d.name||'',
    kind:d.kind||d.type||'',
    manufacturer:d.manufacturer||'',
    model:d.model||'',
    serialNumber:d.serialNumber||'',
    assetTag:d.assetTag||'',
    vendorOs:d.vendorOs||'',
    mgmtIp:d.mgmtIp||'',
    location:locationPath(p,d.locationId)||d.physicalLocation||'',
    rackId:d.rackId||d.rack||'',
    rackUnit:d.rackUnit??'',
    rackUnits:d.rackUnits??d.heightU??'',
    powerDrawWatts:d.powerDrawWatts??'',
    powerMaxWatts:d.powerMaxWatts??'',
    poeBudgetW:d.poeBudgetW??'',
    notes:d.notes||''
  }));
}
function portRows(project){
  const p=obj(project),devices=new Map(arr(p.devices).map(d=>[d.id,d])),links=arr(p.links);
  const peers=new Map();
  for(const l of links){
    const a=l.aPortId||l.a||l.fromPortId||l.from,b=l.bPortId||l.b||l.toPortId||l.to;
    if(a&&b){peers.set(a,{peerPortId:b,link:l});peers.set(b,{peerPortId:a,link:l});}
  }
  const ports=new Map(arr(p.ports).map(x=>[x.id,x]));
  return arr(p.ports).map(pt=>{
    const d=devices.get(pt.deviceId)||{},peer=peers.get(pt.id),peerPort=peer?ports.get(peer.peerPortId):null,peerDevice=peerPort?devices.get(peerPort.deviceId):null;
    return{
      portId:pt.id||'',deviceId:pt.deviceId||'',device:d.name||pt.deviceId||'',port:pt.name||'',
      mode:pt.mode||'',media:pt.media||'',speedMaxMbps:pt.speedMaxMbps??'',negotiatedSpeedMbps:pt.negotiatedSpeedMbps??'',
      adminState:pt.adminState||'',operState:pt.operState||'',poeMode:pt.poeMode||'',poeWattsMax:pt.poeWattsMax??'',
      accessVlanRef:pt.accessVlanRef||pt.vlanRef||'',nativeVlanRef:pt.nativeVlanRef||'',
      allowedVlans:arr(pt.allowedVlans).join(';'),l3Ip:pt.l3Ip||pt.routedIp||'',l3Cidr:pt.l3Cidr||pt.routedCidr||'',
      peerDevice:peerDevice&&peerDevice.name||'',peerPort:peerPort&&peerPort.name||'',linkId:peer&&peer.link&&peer.link.id||'',
      transceiver:pt.transceiver||'',description:pt.desc||pt.description||pt.notes||''
    };
  });
}
function cableRows(project){
  const p=obj(project),panels=new Map(arr(p.patchPanels).map(x=>[x.id,x])),outlets=new Map(arr(p.telecomOutlets).map(x=>[x.id,x]));
  return arr(p.cableRuns).map(c=>({
    id:c.id||'',label:c.label||'',cableType:c.cableType||'',lengthM:c.lengthM??'',route:c.route||c.physicalPath||'',
    patchPanel:panels.get(c.patchPanelId)?.name||c.patchPanelId||'',patchPort:c.patchPort??'',
    outlet:outlets.get(c.outletId)?.name||c.outletId||'',outletPort:c.outletPort??'',
    outletLocation:locationPath(p,outlets.get(c.outletId)?.locationId||'')
  }));
}
function powerRows(project){
  const p=obj(project),devices=new Map(arr(p.devices).map(x=>[x.id,x])),pdus=new Map(arr(p.pdus).map(x=>[x.id,x]));
  return arr(p.powerConnections).map(c=>({
    id:c.id||'',device:devices.get(c.deviceId)?.name||c.deviceId||'',deviceId:c.deviceId||'',
    pdu:pdus.get(c.pduId)?.name||c.pduId||'',pduId:c.pduId||'',feed:c.feed||pdus.get(c.pduId)?.feed||'',
    outlet:c.outlet??'',powerSupplyIndex:c.powerSupplyIndex??'',rackId:pdus.get(c.pduId)?.rackId||devices.get(c.deviceId)?.rackId||''
  }));
}
function pduRows(project){
  return arr(project&&project.pdus).map(p=>({
    id:p.id||'',name:p.name||'',rackId:p.rackId||'',feed:p.feed||'',mounting:p.mounting||'',
    voltage:p.voltage??'',maxCurrentAmps:p.maxCurrentAmps??'',maxPowerWatts:p.maxPowerWatts??'',outletCount:p.outletCount??''
  }));
}
function rackRows(project){
  const p=obj(project),R=racks(),items=R&&R.allRackItems?R.allRackItems(p):arr(p.rackItems);
  const result=[];
  for(const rack of arr(p.racks)){
    const own=items.filter(i=>i&&i.rackId===rack.id).slice().sort((a,b)=>(Number(b.startUnit)||0)-(Number(a.startUnit)||0));
    if(!own.length)result.push({rackId:rack.id||'',rack:rack.name||'',location:locationPath(p,rack.locationId),startUnit:'',heightUnits:'',face:'',type:'',label:'',deviceId:''});
    else for(const item of own)result.push({
      rackId:rack.id||'',rack:rack.name||'',location:locationPath(p,rack.locationId),
      startUnit:item.startUnit??'',heightUnits:item.heightUnits??'',face:item.face||'',type:item.type||'',
      label:item.label||item.name||'',deviceId:item.deviceId||''
    });
  }
  return result;
}
function bomRows(project){
  const R=racks(),rows=R&&R.billOfMaterials?R.billOfMaterials(project):[];
  return arr(rows).map((x,i)=>({row:i+1,kind:x.kind||'',description:x.description||'',quantity:x.quantity??1,rackId:x.rackId||'',locationId:x.locationId||''}));
}
function differentialBomRows(project){
  const P=fieldPkg();
  if(!P||typeof P.build!=='function')return[];
  const pkg=P.build(project);if(!pkg||!pkg.ok)return[];
  const out=[];
  for(const [bucket,list] of Object.entries(pkg.bom||{}))for(const x of arr(list))out.push({
    action:bucket,kind:x.kind||'',description:x.description||'',quantity:x.quantity??1,
    currentId:x.currentId||'',originRef:x.originRef||''
  });
  return out;
}
function buildTables(project){
  const p=clone(project||{});
  return{
    devices:deviceRows(p),
    ports:portRows(p),
    cables:cableRows(p),
    pdus:pduRows(p),
    power:powerRows(p),
    racks:rackRows(p),
    bom:bomRows(p),
    differentialBom:differentialBomRows(p)
  };
}
function manifest(project,tables){
  const p=obj(project),t=tables||buildTables(p);
  return{
    version:'netwizard-asbuilt-export-pack-v1',
    projectName:clean(p.projName)||'NetWizard',
    workflowMode:clean(obj(p.workflow).mode)||'design',
    generatedAt:new Date().toISOString(),
    sheets:Object.fromEntries(Object.entries(t).map(([k,v])=>[k,arr(v).length]))
  };
}
function toCsv(rows){
  const D=docs();if(D&&typeof D.toCsv==='function')return D.toCsv(rows);
  const list=arr(rows),cols=list[0]?Object.keys(list[0]):[];
  const q=v=>{const s=String(v==null?'':v);return /[",\n;]/.test(s)?'"'+s.replace(/"/g,'""')+'"':s;};
  return [cols.join(','),...list.map(r=>cols.map(c=>q(r[c])).join(','))].join('\n');
}
function buildCsvPack(project){
  const tables=buildTables(project),m=manifest(project,tables),files={};
  for(const [name,rows] of Object.entries(tables))files[`${name}.csv`]=toCsv(rows);
  files['manifest.json']=JSON.stringify(m,null,2);
  return{version:m.version,manifest:m,tables,files};
}
function markdown(project){
  const pack=buildCsvPack(project),lines=[`# As-Built Export Pack — ${pack.manifest.projectName}`,'',
    `- Workflow: ${pack.manifest.workflowMode}`,`- Generado: ${pack.manifest.generatedAt}`,'','## Contenido',''];
  for(const [name,count] of Object.entries(pack.manifest.sheets))lines.push(`- ${name}: ${count} filas`);
  if(pack.tables.differentialBom.length){lines.push('','## BOM diferencial','',...pack.tables.differentialBom.map(x=>`- ${x.action}: ${x.quantity} × ${x.kind} — ${x.description}`));}
  return lines.join('\n')+'\n';
}
const api={version:'netwizard-asbuilt-export-pack-v1',locationPath,deviceRows,portRows,cableRows,pduRows,powerRows,rackRows,bomRows,differentialBomRows,buildTables,buildCsvPack,manifest,markdown,toCsv};
root.NetWizardAsBuiltExports=api;
if(typeof module!=='undefined'&&module.exports)module.exports=api;
})(typeof window!=='undefined'?window:globalThis);
