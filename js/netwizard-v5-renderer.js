/* =========================================================
   NetWizard V5 Renderer v1
   Primitivas de render V5 sin DOM ni estado global.
========================================================= */
(function initNetWizardV5Renderer(root,factory){
  'use strict';
  const api=factory(root.NetWizardV5Core);
  root.NetWizardV5Renderer=api;
  if(typeof module!=='undefined'&&module.exports){
    let core=null;try{core=require('./netwizard-v5-core.js');}catch{}
    module.exports=factory(core);
  }
})(typeof window!=='undefined'?window:globalThis,function(CORE){
  'use strict';

  const arr=v=>Array.isArray(v)?v:[];
  function roundPath(ctx,x,y,w,h,r){
    r=Math.max(0,Math.min(r,w/2,h/2));
    ctx.beginPath();ctx.moveTo(x+r,y);
    ctx.arcTo(x+w,y,x+w,y+h,r);ctx.arcTo(x+w,y+h,x,y+h,r);
    ctx.arcTo(x,y+h,x,y,r);ctx.arcTo(x,y,x+w,y,r);ctx.closePath();
  }
  function nodeRadius(w,h,z,base=10){return Math.max(2,Math.min(base*z,w/2,h/2));}
  function readableZoom(visual){return Number(visual?.view?.zoom||1)>=.42;}
  function drawTextLines(ctx,x,y,lines,zoom){let yy=y;for(const line of arr(lines)){ctx.fillText(line,x,yy);yy+=13*zoom;}}
  function colorFromSeed(seed){
    let h=0;seed=String(seed||'seed');
    for(let i=0;i<seed.length;i++)h=(h*31+seed.charCodeAt(i))%360;
    return `hsl(${h} 78% 62%)`;
  }
  function rgbaFromCss(css,alpha){
    const m=String(css||'').match(/hsl\(([-\d.]+)\s+([\d.]+)%\s+([\d.]+)%\)/i);
    if(!m)return `rgba(96,165,250,${alpha})`;
    let h=(+m[1]%360+360)%360,s=(+m[2])/100,l=(+m[3])/100;
    const c=(1-Math.abs(2*l-1))*s,x=c*(1-Math.abs((h/60)%2-1)),m0=l-c/2;
    let r=0,g=0,b=0;
    if(h<60){r=c;g=x;}else if(h<120){r=x;g=c;}else if(h<180){g=c;b=x;}else if(h<240){g=x;b=c;}else if(h<300){r=x;b=c;}else{r=c;b=x;}
    r=Math.round((r+m0)*255);g=Math.round((g+m0)*255);b=Math.round((b+m0)*255);
    return `rgba(${r},${g},${b},${alpha})`;
  }
  function byId(list,id){return arr(list).find(x=>x&&x.id===id)||null;}
  function deviceAccentColor(project,devId,seen){
    seen=seen||new Set();if(seen.has(devId))return colorFromSeed(devId);seen.add(devId);
    const d=byId(project?.devices,devId);if(!d)return colorFromSeed(devId);
    if(d.type==='switch')return colorFromSeed((d.name||devId)+'-switch');
    const neigh=(CORE?.linkedDeviceIds(project,devId)||[]).map(id=>byId(project.devices,id)).filter(Boolean);
    const sw=neigh.find(n=>n.type==='switch');
    if(sw)return colorFromSeed((sw.name||sw.id)+'-switch');
    if(neigh[0])return deviceAccentColor(project,neigh[0].id,seen);
    if(d.type==='router')return'hsl(196 82% 63%)';
    if(d.type==='firewall')return'hsl(8 84% 66%)';
    return colorFromSeed((d.name||devId)+'-'+(d.type||'dev'));
  }
  function compactLinkLabel(visual,host,dev,port,labels={}){
    const compact=visual?.compactLabels!==false;
    if(compact)return `${dev?.name||labels.device||'device'}${port?` · ${port.name}`:''}`.slice(0,24);
    return `${dev?.name||labels.device||'device'}${port?` · ${port.name}`:(labels.autoPending||' · auto/pending')}`.slice(0,42);
  }
  function networkLinkGeometry(visual,project,a,b,metrics){
    if(!CORE)return null;
    const da=byId(project?.devices,a?.deviceId),db=byId(project?.devices,b?.deviceId);if(!da||!db)return null;
    const ca=CORE.nodeCenter(visual,'dev',da.id,metrics),cb=CORE.nodeCenter(visual,'dev',db.id,metrics);
    return{da,db,pa:CORE.worldToScreen(visual,ca.x,ca.y),pb:CORE.worldToScreen(visual,cb.x,cb.y)};
  }
  function drawNetworkLink(ctx,{visual,project,a,b,selected=false,metrics}){
    const g=networkLinkGeometry(visual,project,a,b,metrics);if(!g)return false;
    const trunk=a.mode==='trunk'||b.mode==='trunk';
    ctx.save();ctx.globalAlpha=selected?1:.42;
    ctx.lineWidth=selected?(trunk?4.2:3.2):(trunk?2.2:1.25);
    ctx.strokeStyle=selected?'#f8fafc':(trunk?'#38bdf8':'#3b82f6');ctx.setLineDash(trunk?[8,4]:[]);
    if(selected){ctx.shadowColor=trunk?'#38bdf8':'#60a5fa';ctx.shadowBlur=8;}
    ctx.beginPath();ctx.moveTo(g.pa.x,g.pa.y);ctx.lineTo(g.pb.x,g.pb.y);ctx.stroke();ctx.restore();return true;
  }
  function hostLinkGeometry(visual,host,linkedDev,port,metrics){
    if(!CORE||!host||!linkedDev)return null;
    const hb=CORE.nodeBounds(visual,'host',host.id,metrics),db=CORE.nodeBounds(visual,'dev',linkedDev.id,metrics);
    const start={x:hb.x,y:hb.y+hb.h/2},end={x:db.x+db.w,y:db.y+db.h/2};
    const ph=CORE.worldToScreen(visual,start.x,start.y),pd=CORE.worldToScreen(visual,end.x,end.y);
    return{p:port||null,ph,pd,midX:(ph.x+pd.x)/2,midY:(ph.y+pd.y)/2};
  }
  function drawHostLink(ctx,{visual,host,linkedDev,port,selected=false,accent,metrics}){
    const g=hostLinkGeometry(visual,host,linkedDev,port,metrics);if(!g)return null;
    ctx.save();ctx.globalAlpha=selected?1:.34;ctx.lineWidth=selected?4.2:1.45;
    ctx.strokeStyle=selected?'#ede9fe':'rgba(196,181,253,1)';
    if(selected){ctx.shadowColor=accent;ctx.shadowBlur=10;}
    ctx.beginPath();ctx.moveTo(g.ph.x,g.ph.y);ctx.bezierCurveTo(g.midX,g.ph.y,g.midX,g.pd.y,g.pd.x,g.pd.y);ctx.stroke();ctx.restore();
    return g;
  }
  function drawLinkDot(ctx,{visual,geometry,host,port,accent}){
    if(!geometry)return null;
    const vlanOk=!!(port&&host?.vlanRef&&port.accessVlanRef===host.vlanRef),pending=!port;
    const fill=pending?'#f59e0b':(vlanOk?'#22c55e':'#ef4444'),z=Number(visual?.view?.zoom||1);
    const outer=Math.max(4.8,Math.min(8.5,7.6*z+2)),inner=Math.max(2.8,Math.min(4.6,4.3*z+1));
    ctx.save();ctx.shadowColor='rgba(0,0,0,.55)';ctx.shadowBlur=8;ctx.fillStyle='rgba(7,9,15,.98)';
    ctx.beginPath();ctx.arc(geometry.midX,geometry.midY,outer,0,Math.PI*2);ctx.fill();ctx.shadowBlur=0;ctx.fillStyle=fill;
    ctx.beginPath();ctx.arc(geometry.midX,geometry.midY,inner,0,Math.PI*2);ctx.fill();
    ctx.strokeStyle=rgbaFromCss(accent,.85);ctx.lineWidth=Math.max(.8,1.2*z);
    ctx.beginPath();ctx.arc(geometry.midX,geometry.midY,outer+1,0,Math.PI*2);ctx.stroke();ctx.restore();
    return{x:geometry.midX,y:geometry.midY,r:Math.max(10,outer+5)};
  }
  function drawDeviceNode(ctx,{visual,device,bounds,selected=false,accent,labels={}}){
    if(!CORE||!device||!bounds)return false;
    const z=Number(visual?.view?.zoom||1),np=CORE.worldToScreen(visual,bounds.x,bounds.y),dw=bounds.w*z,dh=bounds.h*z,dr=nodeRadius(dw,dh,z,10);
    ctx.fillStyle='rgba(7,12,20,.96)';roundPath(ctx,np.x,np.y,dw,dh,dr);ctx.fill();
    ctx.fillStyle=rgbaFromCss(accent,.18);roundPath(ctx,np.x+1,np.y+1,Math.max(0,dw-2),Math.max(0,dh-2),Math.max(2,dr-1));ctx.fill();
    ctx.strokeStyle=selected?'#22c55e':accent;ctx.lineWidth=Math.max(.7,1.6*z);roundPath(ctx,np.x,np.y,dw,dh,dr);ctx.stroke();
    if(readableZoom(visual)){
      ctx.fillStyle='#e2eaf7';ctx.font='600 '+Math.max(8,12*z)+'px Space Grotesk,sans-serif';ctx.fillText((device.name||'').slice(0,22),np.x+10*z,np.y+16*z);
      ctx.fillStyle='#8fa3c0';ctx.font=Math.max(7,10*z)+'px Fira Code,monospace';
      drawTextLines(ctx,np.x+10*z,np.y+31*z,[((device.type||'')+' · '+(device.mgmtIp||labels.noMgmt||'no mgmt')).slice(0,28),((device.vendorOs||'—')+(device.internetEdge==='yes'?' · EDGE':'' )).slice(0,28)],z);
    }else{ctx.fillStyle='#e2eaf7';ctx.font='700 9px Space Grotesk,sans-serif';ctx.fillText((device.type||'D').slice(0,2).toUpperCase(),np.x+6,np.y+12);}
    return true;
  }
  function drawHostNode(ctx,{visual,host,bounds,selected=false,accent,vlanLabel,labels={}}){
    if(!CORE||!host||!bounds)return false;
    const z=Number(visual?.view?.zoom||1),np=CORE.worldToScreen(visual,bounds.x,bounds.y),hw=bounds.w*z,hh=bounds.h*z,hr=nodeRadius(hw,hh,z,10);
    ctx.fillStyle='rgba(9,16,26,.96)';roundPath(ctx,np.x,np.y,hw,hh,hr);ctx.fill();
    ctx.fillStyle=rgbaFromCss(accent,.15);roundPath(ctx,np.x+1,np.y+1,Math.max(0,hw-2),Math.max(0,hh-2),Math.max(2,hr-1));ctx.fill();
    ctx.strokeStyle=selected?'#a78bfa':accent;ctx.lineWidth=Math.max(.7,1.5*z);roundPath(ctx,np.x,np.y,hw,hh,hr);ctx.stroke();
    if(readableZoom(visual)){
      ctx.fillStyle='#e2eaf7';ctx.font='600 '+Math.max(7.5,10.5*z)+'px Space Grotesk,sans-serif';ctx.fillText((host.name||'').slice(0,20),np.x+8*z,np.y+14*z);
      const chip=vlanLabel||labels.noVlan||'no VLAN';ctx.font=Math.max(6.5,9*z)+'px Fira Code,monospace';const chipW=Math.max(32*z,(chip.length*6+12)*z);
      ctx.fillStyle='rgba(15,23,42,.78)';roundPath(ctx,np.x+8*z,np.y+22*z,chipW,14*z,Math.max(2,7*z));ctx.fill();ctx.fillStyle=accent;ctx.fillText(chip,np.x+14*z,np.y+32*z);
    }else{ctx.fillStyle=accent;ctx.beginPath();ctx.arc(np.x+Math.max(5,hw/2),np.y+Math.max(5,hh/2),Math.max(2,Math.min(5,Math.min(hw,hh)/4)),0,Math.PI*2);ctx.fill();}
    return true;
  }
  return{version:'netwizard-v5-renderer-v1',roundPath,nodeRadius,readableZoom,drawTextLines,colorFromSeed,rgbaFromCss,deviceAccentColor,compactLinkLabel,networkLinkGeometry,drawNetworkLink,hostLinkGeometry,drawHostLink,drawLinkDot,drawDeviceNode,drawHostNode};
});