/* =========================================================
   NetWizard V5 Connectivity Trace Overlay v1
   Capa visual desacoplada para rutas de diagnóstico.
========================================================= */
(function(){
  'use strict';

  const $=id=>document.getElementById(id);
  const V5=window.NetWizardV5;
  const CORE=window.NetWizardV5Core;
  const state={result:null,raf:0,wrapped:false,resizeObserver:null};

  function project(){return V5?.project?.()||{};}
  function arr(v){return Array.isArray(v)?v:[];}
  function clean(v){return String(v==null?'':v).trim();}
  function linkPortA(link){return V5?.linkPortA?.(link)||CORE?.linkPortA(link)||null;}
  function linkPortB(link){return V5?.linkPortB?.(link)||CORE?.linkPortB(link)||null;}

  function ensureLayer(){
    const base=$('v5view');
    if(!base||!base.parentElement)return null;
    const wrap=base.parentElement;
    if(getComputedStyle(wrap).position==='static')wrap.style.position='relative';

    let canvas=$('v5TraceOverlay');
    if(!canvas){
      canvas=document.createElement('canvas');
      canvas.id='v5TraceOverlay';
      canvas.setAttribute('aria-hidden','true');
      canvas.style.cssText='position:absolute;inset:0;width:100%;height:100%;pointer-events:none;z-index:8;';
      wrap.appendChild(canvas);
    }

    let badge=$('v5TraceStatus');
    if(!badge){
      badge=document.createElement('div');
      badge.id='v5TraceStatus';
      badge.hidden=true;
      badge.style.cssText='position:absolute;left:12px;top:12px;z-index:9;max-width:min(620px,calc(100% - 24px));padding:8px 10px;border-radius:10px;background:rgba(7,9,15,.94);border:1px solid rgba(96,165,250,.5);box-shadow:0 10px 26px rgba(0,0,0,.38);font:11px Space Grotesk,system-ui,sans-serif;color:#e2eaf7;pointer-events:none;';
      wrap.appendChild(badge);
    }
    ensureClearButton();
    return{base,wrap,canvas,badge};
  }

  function ensureClearButton(){
    const toolbar=document.querySelector('#graphs-v5 .v5-toolbar');
    if(!toolbar||$('v5TraceClear'))return;
    const btn=document.createElement('button');
    btn.id='v5TraceClear';
    btn.className='btn bs bsm';
    btn.type='button';
    btn.textContent='✕ Limpiar ruta';
    btn.hidden=true;
    btn.style.display='none';
    btn.onclick=clear;
    toolbar.appendChild(btn);
  }

  function resizeCanvas(base,canvas){
    const rect=base.getBoundingClientRect();
    const dpr=Math.max(1,window.devicePixelRatio||1);
    const w=Math.max(1,Math.floor(rect.width*dpr)),h=Math.max(1,Math.floor(rect.height*dpr));
    if(canvas.width!==w||canvas.height!==h){
      canvas.width=w;canvas.height=h;
    }
    canvas.style.width=rect.width+'px';
    canvas.style.height=rect.height+'px';
    const ctx=canvas.getContext('2d');
    ctx.setTransform(dpr,0,0,dpr,0,0);
    return{ctx,w:rect.width,h:rect.height};
  }

  function devPoint(id){
    if(!id)return null;
    const p=V5?.nodeCenter?.('dev',id);return p?V5.worldToScreen(p.x,p.y):null;
  }

  function hostPoint(id){
    if(!id)return null;
    const p=V5?.nodeCenter?.('host',id);return p?V5.worldToScreen(p.x,p.y):null;
  }

  function screenBox(kind,id){
    const b=V5?.nodeBounds?.(kind,id);if(!b)return null;
    const p=V5.worldToScreen(b.x,b.y),q=V5.worldToScreen(b.x+b.w,b.y+b.h);
    return{x:p.x,y:p.y,w:q.x-p.x,h:q.y-p.y};
  }
  function deviceBox(id){return screenBox('dev',id);}
  function hostBox(id){return screenBox('host',id);}

  function drawRounded(ctx,b,r){
    const x=b.x,y=b.y,w=b.w,h=b.h;
    r=Math.min(r,w/2,h/2);
    ctx.beginPath();
    ctx.moveTo(x+r,y);
    ctx.arcTo(x+w,y,x+w,y+h,r);
    ctx.arcTo(x+w,y+h,x,y+h,r);
    ctx.arcTo(x,y+h,x,y,r);
    ctx.arcTo(x,y,x+w,y,r);
    ctx.closePath();
  }

  function revealBox(ctx,b){
    if(!b)return;
    ctx.save();
    ctx.globalCompositeOperation='destination-out';
    drawRounded(ctx,{x:b.x-5,y:b.y-5,w:b.w+10,h:b.h+10},10);
    ctx.fillStyle='rgba(0,0,0,1)';
    ctx.fill();
    ctx.restore();
  }

  function drawLine(ctx,a,b,color,width,dashed){
    if(!a||!b)return;
    ctx.save();
    ctx.strokeStyle=color;
    ctx.lineWidth=width;
    ctx.setLineDash(dashed?[8,5]:[]);
    ctx.shadowColor=color;
    ctx.shadowBlur=dashed?0:8;
    ctx.beginPath();
    ctx.moveTo(a.x,a.y);
    ctx.lineTo(b.x,b.y);
    ctx.stroke();
    ctx.restore();
  }

  function drawLabel(ctx,x,y,label,color){
    label=clean(label);
    if(!label)return;
    ctx.save();
    ctx.font='700 10px Space Grotesk,system-ui,sans-serif';
    const pad=6,w=Math.min(250,ctx.measureText(label).width+pad*2),h=20;
    const bx=x-w/2,by=y-h/2;
    ctx.fillStyle='rgba(7,9,15,.94)';
    ctx.strokeStyle=color;
    ctx.lineWidth=1;
    drawRounded(ctx,{x:bx,y:by,w,h},6);ctx.fill();ctx.stroke();
    ctx.fillStyle='#f8fafc';
    ctx.textAlign='center';ctx.textBaseline='middle';
    ctx.fillText(label.slice(0,44),x,y);
    ctx.restore();
  }

  function drawNode(ctx,id,index,blocked){
    const box=deviceBox(id),point=devPoint(id);if(!box||!point)return;
    const color=blocked?'#ef4444':'#22c55e';
    revealBox(ctx,box);
    ctx.save();
    ctx.strokeStyle=color;
    ctx.lineWidth=blocked?4:2.5;
    ctx.shadowColor=color;ctx.shadowBlur=blocked?14:8;
    drawRounded(ctx,{x:box.x-3,y:box.y-3,w:box.w+6,h:box.h+6},10);ctx.stroke();
    ctx.restore();
    const d=arr(project().devices).find(x=>x.id===id);
    drawLabel(ctx,point.x,box.y-13,`${index+1}. ${d?.name||id}`,color);
    if(blocked)drawBlockMarker(ctx,point.x,point.y);
  }

  function drawEndpoint(ctx,endpoint,isSource,blocked){
    if(!endpoint)return;
    const isHost=endpoint.kind==='host';
    const box=isHost?hostBox(endpoint.entityId):null;
    const point=isHost?hostPoint(endpoint.entityId):devPoint(endpoint.deviceId);
    if(box)revealBox(ctx,box);
    if(!point)return;
    const color=blocked?'#ef4444':(isSource?'#a78bfa':'#38bdf8');
    ctx.save();
    ctx.strokeStyle=color;ctx.lineWidth=2.5;ctx.shadowColor=color;ctx.shadowBlur=8;
    if(box){drawRounded(ctx,{x:box.x-3,y:box.y-3,w:box.w+6,h:box.h+6},9);ctx.stroke();}
    else{ctx.beginPath();ctx.arc(point.x,point.y,12,0,Math.PI*2);ctx.stroke();}
    ctx.restore();
    if(blocked)drawBlockMarker(ctx,point.x,point.y);
  }

  function drawBlockMarker(ctx,x,y){
    ctx.save();
    ctx.fillStyle='#ef4444';
    ctx.strokeStyle='#fff';
    ctx.lineWidth=2;
    ctx.beginPath();ctx.arc(x,y,10,0,Math.PI*2);ctx.fill();ctx.stroke();
    ctx.beginPath();ctx.moveTo(x-4,y-4);ctx.lineTo(x+4,y+4);ctx.moveTo(x+4,y-4);ctx.lineTo(x-4,y+4);ctx.stroke();
    ctx.restore();
  }

  function linkedDevices(link,p){
    const ports=arr(p.ports);
    const a=ports.find(x=>x.id===linkPortA(link)),b=ports.find(x=>x.id===linkPortB(link));
    return a&&b?{a,b,from:devPoint(a.deviceId),to:devPoint(b.deviceId)}:null;
  }

  function linkLabel(link,p){
    const ports=arr(p.ports);
    const a=ports.find(x=>x.id===linkPortA(link)),b=ports.find(x=>x.id===linkPortB(link));
    const media=link.media||link.medium||link.cableType||'';
    const portsLabel=a&&b?`${a.name||a.id} ↔ ${b.name||b.id}`:(link.name||link.label||link.id);
    return [portsLabel,media].filter(Boolean).join(' · ');
  }

  function drawTrace(){
    state.raf=0;
    const layer=ensureLayer();if(!layer)return;
    const {base,canvas,badge}=layer;
    const {ctx,w,h}=resizeCanvas(base,canvas);
    ctx.clearRect(0,0,w,h);

    const result=state.result;
    const clearBtn=$('v5TraceClear');
    if(!result||!result.visualTrace){
      badge.hidden=true;
      if(clearBtn){clearBtn.hidden=true;clearBtn.style.display='none';}
      canvas.dataset.status='';
      canvas.dataset.linkCount='0';
      canvas.dataset.blockKind='';
      return;
    }

    const trace=result.visualTrace,p=project(),block=trace.blockage||result.blockage||null;
    canvas.dataset.status=result.ok?(result.partial?'partial':'ok'):'blocked';
    canvas.dataset.linkCount=String(arr(trace.linkIds).length);
    canvas.dataset.blockKind=block&&block.kind||'';
    if(clearBtn){clearBtn.hidden=false;clearBtn.style.display='';}

    ctx.fillStyle='rgba(2,6,12,.62)';
    ctx.fillRect(0,0,w,h);

    const deviceIds=arr(trace.deviceIds);
    const blockedIndex=block&&block.deviceId?deviceIds.indexOf(block.deviceId):-1;
    const linksById=new Map(arr(p.links).map(x=>[x.id,x]));

    arr(trace.linkIds).forEach((id,index)=>{
      const link=linksById.get(id);if(!link)return;
      const geo=linkedDevices(link,p);if(!geo)return;
      let color='#22c55e',dashed=false;
      if(!result.ok&&blockedIndex>=0&&index>=blockedIndex){color='#64748b';dashed=true;}
      else if(result.partial){color='#f59e0b';}
      drawLine(ctx,geo.from,geo.to,color,result.ok?4:3.5,dashed);
      drawLabel(ctx,(geo.from.x+geo.to.x)/2,(geo.from.y+geo.to.y)/2,linkLabel(link,p),color);
    });

    const sourcePoint=trace.source?.kind==='host'?hostPoint(trace.source.entityId):devPoint(trace.source?.deviceId);
    const sourceDevice=devPoint(trace.source?.deviceId);
    if(sourcePoint&&sourceDevice&&(sourcePoint.x!==sourceDevice.x||sourcePoint.y!==sourceDevice.y)){
      const sourceBlocked=!!block&&(block.endpointId===trace.source.endpointId||block.portId===trace.source.portId);
      drawLine(ctx,sourcePoint,sourceDevice,sourceBlocked?'#ef4444':'#a78bfa',3,false);
    }
    const targetPoint=trace.target?.kind==='host'?hostPoint(trace.target.entityId):devPoint(trace.target?.deviceId);
    const targetDevice=devPoint(trace.target?.deviceId);
    if(targetPoint&&targetDevice&&(targetPoint.x!==targetDevice.x||targetPoint.y!==targetDevice.y)){
      const targetBlocked=!!block&&(block.endpointId===trace.target.endpointId||block.portId===trace.target.portId);
      drawLine(ctx,targetDevice,targetPoint,targetBlocked?'#ef4444':'#38bdf8',3,false);
    }

    if(block&&block.kind==='physical-gap'){
      const from=devPoint(block.fromDeviceId),to=devPoint(block.toDeviceId);
      drawLine(ctx,from,to,'#ef4444',3,true);
      if(from&&to){
        const mx=(from.x+to.x)/2,my=(from.y+to.y)/2;
        drawBlockMarker(ctx,mx,my);
        drawLabel(ctx,mx,my-20,'FALTA ENLACE FÍSICO','#ef4444');
      }
    }

    deviceIds.forEach((id,index)=>drawNode(ctx,id,index,!!block&&block.deviceId===id));
    drawEndpoint(ctx,trace.source,true,!!block&&(block.endpointId===trace.source?.endpointId||block.portId===trace.source?.portId));
    drawEndpoint(ctx,trace.target,false,!!block&&(block.endpointId===trace.target?.endpointId||block.portId===trace.target?.portId));

    const service=result.service?.label||'Diagnóstico';
    const status=result.ok?(result.partial?'VALIDACIÓN PARCIAL':'RUTA PERMITIDA'):'BLOQUEO DETECTADO';
    const reason=block?.reason||(!result.ok?'Revisar validaciones del diagnóstico.':result.partial?'Faltan datos para validar todos los saltos.':'Todos los controles modelados son coherentes.');
    badge.hidden=false;
    badge.style.borderColor=result.ok?(result.partial?'#f59e0b':'#22c55e'):'#ef4444';
    badge.textContent=`${status} · ${service} · ${reason}`;
  }

  function schedule(){
    if(state.raf)return;
    state.raf=requestAnimationFrame(drawTrace);
  }

  function setResult(result){
    state.result=result||null;
    schedule();
  }

  function clear(){
    state.result=null;
    window.NetWizardConnectivityTrace=null;
    schedule();
    try{document.dispatchEvent(new CustomEvent('netwizard:connectivity-trace-clear'));}catch{}
  }

  function wrapRenderer(){
    if(state.wrapped||typeof window.drawV5!=='function')return;
    const original=window.drawV5;
    window.drawV5=function(){
      const value=original.apply(this,arguments);
      schedule();
      return value;
    };
    state.wrapped=true;
  }

  function init(){
    ensureLayer();
    wrapRenderer();
    const base=$('v5view');
    if(base&&window.ResizeObserver){
      state.resizeObserver=new ResizeObserver(schedule);
      state.resizeObserver.observe(base);
      if(base.parentElement)state.resizeObserver.observe(base.parentElement);
    }
    document.addEventListener('netwizard:connectivity-trace',event=>{
      setResult(event.detail?.result||window.NetWizardConnectivityTrace||null);
    });
    document.addEventListener('netwizard:connectivity-trace-clear',()=>{if(state.result){state.result=null;schedule();}});
    window.addEventListener('resize',schedule);
    document.addEventListener('fullscreenchange',()=>setTimeout(schedule,40));
    document.addEventListener('mousemove',event=>{if(state.result&&event.target?.closest?.('#v5Layout'))schedule();},{passive:true});
    document.addEventListener('wheel',event=>{if(state.result&&event.target?.closest?.('#v5Layout'))schedule();},{passive:true});
    document.addEventListener('click',event=>{if(event.target?.closest?.('[data-step="graphs"],[data-tab="graphs-v5"]'))setTimeout(()=>{ensureLayer();wrapRenderer();schedule();},120);});
  }

  window.NetWizardV5TraceOverlay={
    version:'netwizard-v5-connectivity-trace-overlay-v1',
    setResult,clear,render:drawTrace,
    getState:()=>({active:!!state.result,status:$('v5TraceOverlay')?.dataset.status||'',blockKind:$('v5TraceOverlay')?.dataset.blockKind||'',linkCount:Number($('v5TraceOverlay')?.dataset.linkCount||0)})
  };

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>setTimeout(init,0));
  else setTimeout(init,0);
})();