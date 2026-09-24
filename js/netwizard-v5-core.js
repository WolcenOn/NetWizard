/* =========================================================
   NetWizard V5 Core v1
   Modelo/contrato puro para estado visual, filtros, topología
   y geometría. Sin DOM, canvas ni persistencia.
========================================================= */
(function initNetWizardV5Core(root,factory){
  'use strict';
  const api=factory();
  root.NetWizardV5Core=api;
  if(typeof module!=='undefined'&&module.exports)module.exports=api;
})(typeof window!=='undefined'?window:globalThis,function(){
  'use strict';

  const FILTER_DEFAULTS=Object.freeze({
    switch:true,router:true,firewall:true,hosts:true,server:true,camera:true,ap:true,
    iotCandidate:true,iotAccess:true,iotDevice:true,wifi:true,lora:true,zigbee:true,
    thread:true,mqtt:true,ble:true,ethernet:true
  });
  const DEFAULT_METRICS=Object.freeze({locHead:36,devW:176,devH:62,hstW:158,hstH:42,colW:190});

  const arr=v=>Array.isArray(v)?v:[];
  const clean=v=>String(v==null?'':v).trim();
  const lower=v=>clean(v).toLowerCase();

  function ensureVisualState(project){
    project=project||{};
    if(!project.visual||typeof project.visual!=='object')project.visual={};
    const v=project.visual;
    if(!Array.isArray(v.locs))v.locs=[];
    if(!v.assign||typeof v.assign!=='object')v.assign={};
    if(!v.assign.devices||typeof v.assign.devices!=='object')v.assign.devices={};
    if(!v.assign.hosts||typeof v.assign.hosts!=='object')v.assign.hosts={};
    if(!v.pos||typeof v.pos!=='object')v.pos={};
    if(!v.view||typeof v.view!=='object')v.view={px:60,py:50,zoom:1};
    if(!Number.isFinite(Number(v.view.px)))v.view.px=60;
    if(!Number.isFinite(Number(v.view.py)))v.view.py=50;
    if(!Number.isFinite(Number(v.view.zoom))||Number(v.view.zoom)<=0)v.view.zoom=1;
    if(!Object.prototype.hasOwnProperty.call(v,'sel'))v.sel=null;
    if(!Object.prototype.hasOwnProperty.call(v,'fs'))v.fs=false;
    if(!Object.prototype.hasOwnProperty.call(v,'compactLabels'))v.compactLabels=true;
    if(!Object.prototype.hasOwnProperty.call(v,'proMode'))v.proMode=true;
    if(!v.proBounds||typeof v.proBounds!=='object')v.proBounds={};
    return v;
  }

  function ensureFilters(visual){
    visual=visual||{};
    visual.filters={...FILTER_DEFAULTS,...(visual.filters||{})};
    return visual.filters;
  }
  function filterOn(visual,key){return ensureFilters(visual)[key]!==false;}
  function hostFilterKey(host){
    const t=lower(host&&host.type)||'host';
    if(t==='iot')return'iotCandidate';
    if(t==='server')return'server';
    if(t==='camera')return'camera';
    if(t==='ap')return'ap';
    return'hosts';
  }
  function showDevice(visual,device){return !!device&&filterOn(visual,lower(device.type)||'switch');}
  function showHost(visual,host,deviceExists){
    if(!host)return false;
    if(host.deviceRef&&typeof deviceExists==='function'&&deviceExists(host.deviceRef))return false;
    return filterOn(visual,'hosts')&&filterOn(visual,hostFilterKey(host));
  }

  function locations(visual){return arr(visual&&visual.locs);}
  function locById(visual,id){return locations(visual).find(x=>x&&x.id===id)||null;}
  function locChildren(visual,id){return locations(visual).filter(x=>x&&(x.parentId||'')===id);}
  function locRoots(visual){return locations(visual).filter(x=>!x.parentId||!locById(visual,x.parentId));}
  function locDepth(visual,id){
    let depth=0,cur=locById(visual,id),guard=0;
    while(cur&&cur.parentId&&guard++<20){
      const p=locById(visual,cur.parentId);if(!p)break;
      depth++;cur=p;
    }
    return depth;
  }
  function rootLocationId(visual,id){
    let loc=locById(visual,id),guard=0;
    while(loc&&loc.parentId&&guard++<20)loc=locById(visual,loc.parentId)||loc;
    return loc?loc.id:id||'';
  }

  function deviceVisualLoc(visual,id){return visual&&visual.assign&&visual.assign.devices&&visual.assign.devices[id]||'';}
  function hostVisualLoc(visual,id){return visual&&visual.assign&&visual.assign.hosts&&visual.assign.hosts[id]||'';}
  function setDeviceVisualLoc(visual,id,locId){ensureVisualContainers(visual);visual.assign.devices[id]=locId||'';return visual.assign.devices[id];}
  function setHostVisualLoc(visual,id,locId){ensureVisualContainers(visual);visual.assign.hosts[id]=locId||'';return visual.assign.hosts[id];}
  function ensureVisualContainers(visual){
    if(!visual.assign)visual.assign={devices:{},hosts:{}};
    if(!visual.assign.devices)visual.assign.devices={};
    if(!visual.assign.hosts)visual.assign.hosts={};
    if(!visual.pos)visual.pos={};
    return visual;
  }

  function metrics(value){return{...DEFAULT_METRICS,...(value||{})};}
  function nodeBounds(visual,kind,id,value){
    const m=metrics(value),pos=visual&&visual.pos&&visual.pos[id]||{x:0,y:0};
    return kind==='dev'
      ?{x:Number(pos.x)||0,y:Number(pos.y)||0,w:m.devW,h:m.devH}
      :{x:Number(pos.x)||0,y:Number(pos.y)||0,w:m.hstW,h:m.hstH};
  }
  function nodeCenter(visual,kind,id,value){
    const b=nodeBounds(visual,kind,id,value);return{x:b.x+b.w/2,y:b.y+b.h/2};
  }
  function worldToScreen(visual,x,y){
    const view=visual&&visual.view||{px:60,py:50,zoom:1},z=Number(view.zoom)||1;
    return{x:Number(x)*z+(Number(view.px)||0),y:Number(y)*z+(Number(view.py)||0)};
  }
  function screenToWorld(visual,x,y){
    const view=visual&&visual.view||{px:60,py:50,zoom:1},z=Number(view.zoom)||1;
    return{x:(Number(x)-(Number(view.px)||0))/z,y:(Number(y)-(Number(view.py)||0))/z};
  }

  function linkPortA(link){return link&&(link.aPortId||link.a||link.fromPortId||link.from||link.portA)||null;}
  function linkPortB(link){return link&&(link.bPortId||link.b||link.toPortId||link.to||link.portB)||null;}
  function linkEndpoints(project,link){
    const ports=new Map(arr(project&&project.ports).filter(Boolean).map(p=>[p.id,p]));
    const a=ports.get(linkPortA(link)),b=ports.get(linkPortB(link));
    return a&&b?{a,b}:null;
  }
  function linkedDeviceIds(project,deviceId){
    const ids=new Set();
    for(const link of arr(project&&project.links)){
      const ep=linkEndpoints(project,link);if(!ep)continue;
      if(ep.a.deviceId===deviceId&&ep.b.deviceId!==deviceId)ids.add(ep.b.deviceId);
      if(ep.b.deviceId===deviceId&&ep.a.deviceId!==deviceId)ids.add(ep.a.deviceId);
    }
    return[...ids];
  }
  function buildRootGraph(project,visual){
    const roots=locRoots(visual),rootIds=new Set(roots.map(l=>l.id));
    const adj=new Map(roots.map(l=>[l.id,new Set()]));
    for(const link of arr(project&&project.links)){
      const ep=linkEndpoints(project,link);if(!ep)continue;
      const la=rootLocationId(visual,deviceVisualLoc(visual,ep.a.deviceId));
      const lb=rootLocationId(visual,deviceVisualLoc(visual,ep.b.deviceId));
      if(!la||!lb||la===lb||!rootIds.has(la)||!rootIds.has(lb))continue;
      adj.get(la)?.add(lb);adj.get(lb)?.add(la);
    }
    return{roots,adj};
  }

  function visualLocationByPhysicalId(visual,id){
    if(!id)return'';
    return locations(visual).find(l=>l&&l.physicalLocationId===id)?.id||'';
  }
  function visualLocationByPhysicalName(visual,name){
    const key=lower(name);if(!key)return'';
    return locations(visual).find(l=>lower(l&&l.name)===key)?.id||'';
  }
  function inferDeviceVisualLocation(project,visual,device){
    if(!device)return'';
    let id=visualLocationByPhysicalId(visual,device.locationId||device.physicalLocationId);
    if(id)return id;
    id=visualLocationByPhysicalName(visual,device.physicalLocation);if(id)return id;
    const rack=arr(project&&project.racks).find(r=>r&&r.id===(device.rackId||device.rack));
    if(rack){
      id=visualLocationByPhysicalId(visual,rack.locationId||rack.physicalLocationId);if(id)return id;
      id=visualLocationByPhysicalName(visual,rack.location||rack.physicalLocation);if(id)return id;
    }
    return'';
  }
  function inferHostVisualLocation(project,visual,host){
    if(!host)return'';
    let id=visualLocationByPhysicalId(visual,host.locationId||host.physicalLocationId);
    if(id)return id;
    id=visualLocationByPhysicalName(visual,host.physicalLocation);if(id)return id;
    const hc=arr(project&&project.hostOutletConnections).find(x=>x&&x.hostId===host.id);
    const outlet=hc&&arr(project&&project.telecomOutlets).find(x=>x&&x.id===hc.outletId);
    if(outlet){
      id=visualLocationByPhysicalId(visual,outlet.locationId||outlet.physicalLocationId);if(id)return id;
      id=visualLocationByPhysicalName(visual,outlet.location||outlet.physicalLocation);if(id)return id;
    }
    return'';
  }
  function isSyntheticDefaultLocation(project,loc){
    if(!loc)return false;
    const names=['Core / Perímetro','Acceso / Usuarios','Servicios'];
    if(!names.includes(clean(loc.name)))return false;
    const linked=arr(project&&project.physicalLocations).find(pl=>pl&&pl.id===loc.physicalLocationId);
    return !loc.physicalLocationId||
      lower(loc.type)==='zone'||
      !!(linked&&(lower(linked.type)==='zone'||clean(linked.notes)==='Sincronizada desde Vista V5'));
  }

  return{
    version:'netwizard-v5-core-v1',
    FILTER_DEFAULTS,DEFAULT_METRICS,
    ensureVisualState,ensureFilters,filterOn,hostFilterKey,showDevice,showHost,
    locations,locById,locChildren,locRoots,locDepth,rootLocationId,
    deviceVisualLoc,hostVisualLoc,setDeviceVisualLoc,setHostVisualLoc,
    metrics,nodeBounds,nodeCenter,worldToScreen,screenToWorld,
    linkPortA,linkPortB,linkEndpoints,linkedDeviceIds,buildRootGraph,
    visualLocationByPhysicalId,visualLocationByPhysicalName,
    inferDeviceVisualLocation,inferHostVisualLocation,isSyntheticDefaultLocation
  };
});