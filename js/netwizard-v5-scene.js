/* =========================================================
   NetWizard V5 Scene Renderer v1
   Orquesta el frame completo V5 sin DOM ni persistencia.
========================================================= */
(function initNetWizardV5Scene(root,factory){
  'use strict';
  const api=factory(root.NetWizardV5Core,root.NetWizardV5Renderer);
  root.NetWizardV5Scene=api;
  if(typeof module!=='undefined'&&module.exports){
    let core=null,renderer=null;
    try{core=require('./netwizard-v5-core.js');}catch{}
    try{renderer=require('./netwizard-v5-renderer.js');}catch{}
    module.exports=factory(core,renderer);
  }
})(typeof window!=='undefined'?window:globalThis,function(CORE,RENDERER){
  'use strict';

  const arr=v=>Array.isArray(v)?v:[];
  const byId=(list,id)=>arr(list).find(x=>x&&x.id===id)||null;

  function selectedDeviceId(project,visual,hostConnectedDeviceId){
    const sel=visual&&visual.sel;if(!sel)return'';
    if(sel.t==='device')return sel.id;
    if(sel.t==='host'){
      const h=byId(project&&project.hosts,sel.id);
      return h?(hostConnectedDeviceId(h)||''):'';
    }
    return'';
  }
  function networkSelected(project,visual,a,b,hostConnectedDeviceId){
    const id=selectedDeviceId(project,visual,hostConnectedDeviceId);
    return !!id&&(a.deviceId===id||b.deviceId===id);
  }
  function hostSelected(visual,host,linkedDev){
    const sel=visual&&visual.sel;if(!sel)return false;
    if(sel.t==='host')return sel.id===host.id;
    return sel.t==='device'&&sel.id===linkedDev.id;
  }
  function drawGrid(ctx,rect){
    ctx.globalAlpha=.05;ctx.strokeStyle='#3b82f6';ctx.lineWidth=1;
    for(let x=0;x<rect.width;x+=26){ctx.beginPath();ctx.moveTo(x,0);ctx.lineTo(x,rect.height);ctx.stroke();}
    for(let y=0;y<rect.height;y+=26){ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(rect.width,y);ctx.stroke();}
    ctx.globalAlpha=1;
  }
  function drawLocation(ctx,{visual,loc,bounds,depth,proMode,drag,deviceCount,hostCount,labels={}}){
    const z=Number(visual&&visual.view&&visual.view.zoom||1),p=CORE.worldToScreen(visual,bounds.x,bounds.y),w=bounds.w*z,h=bounds.h*z;
    ctx.fillStyle=loc.color||'#10233c';ctx.globalAlpha=Math.max(.16,.33-depth*.05);
    RENDERER.roundPath(ctx,p.x,p.y,w,h,Math.max(4,(18-depth*2)*z));ctx.fill();ctx.globalAlpha=1;
    ctx.strokeStyle=visual.sel&&visual.sel.t==='loc'&&visual.sel.id===loc.id?'#93c5fd':(proMode&&loc.parentId?'rgba(125,211,252,.75)':'rgba(58,77,102,.9)');
    ctx.lineWidth=proMode&&loc.parentId?1.1:1.4;
    RENDERER.roundPath(ctx,p.x,p.y,w,h,Math.max(4,(18-depth*2)*z));ctx.stroke();
    if(drag&&drag.overLoc===loc.id){
      ctx.strokeStyle='#60a5fa';ctx.lineWidth=2;ctx.setLineDash([8,5]);
      RENDERER.roundPath(ctx,p.x+4,p.y+4,w-8,h-8,Math.max(4,15*z));ctx.stroke();ctx.setLineDash([]);
    }
    ctx.fillStyle='#e2eaf7';ctx.font='600 '+Math.max(11,13-depth)+'px Space Grotesk,sans-serif';
    ctx.fillText((depth?('↳ '.repeat(Math.min(depth,2))):'')+(loc.name||''),p.x+12*z,p.y+22*z);
    ctx.fillStyle='#8fa3c0';ctx.font='11px Space Grotesk,sans-serif';
    ctx.fillText((labels.locationSummary?labels.locationSummary(deviceCount,hostCount):(deviceCount+' devices · '+hostCount+' hosts')),p.x+12*z,p.y+37*z);
    const hs=12*z,hx=p.x+w-hs-8*z,hy=p.y+h-hs-8*z;
    if(!(proMode&&loc.parentId)){
      ctx.fillStyle='rgba(148,163,184,.95)';ctx.fillRect(hx,hy,hs,hs);
      ctx.strokeStyle='rgba(15,23,42,.95)';ctx.strokeRect(hx,hy,hs,hs);
      ctx.beginPath();ctx.moveTo(hx+3*z,hy+hs-3*z);ctx.lineTo(hx+hs-3*z,hy+3*z);ctx.stroke();
    }
  }
  function render(ctx,options){
    if(!ctx||!CORE||!RENDERER)return{renderState:null,linkDots:[]};
    const {
      project={},visual={},rect={width:0,height:0},metrics,
      locations=[],locationDepth=()=>0,locationBounds=()=>null,
      devicesInLocation=()=>[],hostsInLocation=()=>[],layoutLocation=()=>{},
      showDevice=()=>true,showHost=()=>true,deviceById=id=>byId(project.devices,id),
      hostConnectedDeviceId=()=>'',vlanByRef=()=>null,hostPort=()=>null,
      proMode=false,drag=null
    }=options||{};
    if(!rect.width||!rect.height)return{renderState:null,linkDots:[]};

    ctx.clearRect(0,0,rect.width,rect.height);
    const linkDots=[],renderState={
      layerOrder:['background','base-links','nodes','selected-links'],
      sceneOrder:['background','locations','base-links','nodes','selected-links'],
      baseNetwork:0,baseHost:0,selectedNetwork:0,selectedHost:0,
      locationCount:arr(locations).length,
      selected:visual.sel?{...visual.sel}:null
    };
    drawGrid(ctx,rect);
    for(const loc of arr(locations))layoutLocation(loc,false);
    const ordered=[...arr(locations)].sort((a,b)=>locationDepth(a.id)-locationDepth(b.id));
    for(const loc of ordered){
      const devs=arr(devicesInLocation(loc.id)),hosts=arr(hostsInLocation(loc.id));
      drawLocation(ctx,{visual,loc,bounds:locationBounds(loc),depth:locationDepth(loc.id),proMode,drag,deviceCount:devs.length,hostCount:hosts.length,labels});
    }

    for(const link of arr(project.links)){
      const ep=CORE.linkEndpoints(project,link);if(!ep)continue;
      const da=deviceById(ep.a.deviceId),db=deviceById(ep.b.deviceId);
      if(!da||!db||!showDevice(da)||!showDevice(db))continue;
      if(RENDERER.drawNetworkLink(ctx,{visual,project,a:ep.a,b:ep.b,selected:false,metrics}))renderState.baseNetwork++;
    }
    for(const host of arr(project.hosts)){
      const linkedDev=deviceById(hostConnectedDeviceId(host)||'');
      if(!linkedDev||!showHost(host)||!showDevice(linkedDev))continue;
      const port=hostPort(host,linkedDev),accent=RENDERER.deviceAccentColor(project,linkedDev.id);
      if(RENDERER.drawHostLink(ctx,{visual,host,linkedDev,port,selected:false,accent,metrics}))renderState.baseHost++;
    }

    for(const loc of arr(locations)){
      for(const device of arr(devicesInLocation(loc.id))){
        const bounds=CORE.nodeBounds(visual,'dev',device.id,metrics),accent=RENDERER.deviceAccentColor(project,device.id);
        RENDERER.drawDeviceNode(ctx,{visual,device,bounds,selected:!!(visual.sel&&visual.sel.t==='device'&&visual.sel.id===device.id),accent,labels});
      }
      for(const host of arr(hostsInLocation(loc.id))){
        const bounds=CORE.nodeBounds(visual,'host',host.id,metrics),linked=hostConnectedDeviceId(host);
        const accent=linked?RENDERER.deviceAccentColor(project,linked):'hsl(262 83% 74%)',vlan=vlanByRef(host.vlanRef);
        RENDERER.drawHostNode(ctx,{visual,host,bounds,selected:!!(visual.sel&&visual.sel.t==='host'&&visual.sel.id===host.id),accent,vlanLabel:vlan?('V'+vlan.vlanId):(labels.noVlan||'—'),labels});
      }
    }

    for(const link of arr(project.links)){
      const ep=CORE.linkEndpoints(project,link);if(!ep||!networkSelected(project,visual,ep.a,ep.b,hostConnectedDeviceId))continue;
      const da=deviceById(ep.a.deviceId),db=deviceById(ep.b.deviceId);
      if(!da||!db||!showDevice(da)||!showDevice(db))continue;
      if(RENDERER.drawNetworkLink(ctx,{visual,project,a:ep.a,b:ep.b,selected:true,metrics}))renderState.selectedNetwork++;
    }
    for(const host of arr(project.hosts)){
      const linkedDev=deviceById(hostConnectedDeviceId(host)||'');
      if(!linkedDev||!showHost(host)||!showDevice(linkedDev)||!hostSelected(visual,host,linkedDev))continue;
      const port=hostPort(host,linkedDev),accent=RENDERER.deviceAccentColor(project,linkedDev.id);
      const geometry=RENDERER.drawHostLink(ctx,{visual,host,linkedDev,port,selected:true,accent,metrics});
      if(!geometry)continue;
      renderState.selectedHost++;
      const hit=RENDERER.drawLinkDot(ctx,{visual,geometry,host,port,accent});
      if(hit)linkDots.push({...hit,host,dev:linkedDev,port});
    }
    return{renderState,linkDots};
  }

  return{version:'netwizard-v5-scene-v1',selectedDeviceId,networkSelected,hostSelected,drawGrid,drawLocation,render};
});