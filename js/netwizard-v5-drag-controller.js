/* =========================================================
   NetWizard V5 Drag Controller v1
   Controla sesión pointer/drag; las mutaciones de dominio
   se delegan mediante callbacks explícitos.
========================================================= */
(function initNetWizardV5DragController(root,factory){
  'use strict';
  const api=factory(root.NetWizardV5Interaction);
  root.NetWizardV5DragController=api;
  if(typeof module!=='undefined'&&module.exports){
    let interaction=null;try{interaction=require('./netwizard-v5-interaction.js');}catch{}
    module.exports=factory(interaction);
  }
})(typeof window!=='undefined'?window:globalThis,function(INTERACTION){
  'use strict';

  function create(options){
    const o=options||{};
    const canvas=o.canvas;
    let session=null,bound=false;

    function visual(){return o.visual();}
    function point(evt){return o.canvasPoint(evt);}
    function selectHit(hit){
      if(hit)o.select(hit.t==='loc-resize'?'loc':hit.t,hit.id);
      else o.clearSelection();
    }
    function startSession(hit,pt,evt){
      const v=visual();
      if(!hit)return{t:'pan',startPx:v.view.px,startPy:v.view.py,startX:evt.clientX||0,startY:evt.clientY||0,downX:pt.x,downY:pt.y,moved:false};
      if(hit.t==='loc-resize'){
        const loc=o.locationById(hit.id),b=o.locationBounds(loc);
        return{t:'loc-resize',id:hit.id,startW:b.w,startH:b.h,startX:pt.x,startY:pt.y,downX:pt.x,downY:pt.y,moved:false};
      }
      if(hit.t==='loc'){
        const loc=o.locationById(hit.id);
        const members=[
          ...o.devicesInLocation(hit.id).map(d=>({id:d.id,pos:{...(v.pos[d.id]||{x:0,y:0})}})),
          ...o.hostsInLocation(hit.id).map(h=>({id:h.id,pos:{...(v.pos[h.id]||{x:0,y:0})}}))
        ];
        return{t:'loc',id:hit.id,dx:pt.x-loc.x,dy:pt.y-loc.y,startX:loc.x,startY:loc.y,members,downX:pt.x,downY:pt.y,moved:false};
      }
      const kind=hit.t==='device'?'dev':'host',b=o.nodeBounds(kind,hit.id);
      return{t:hit.t,id:hit.id,dx:pt.x-b.x,dy:pt.y-b.y,fromLoc:hit.t==='device'?o.deviceVisualLocation(hit.id):o.hostVisualLocation(hit.id),startPos:{...(v.pos[hit.id]||{x:b.x,y:b.y})},downX:pt.x,downY:pt.y,moved:false};
    }
    function pointerDown(evt){
      const pt=point(evt),hit=o.hitTest(pt);
      selectHit(hit);session=startSession(hit,pt,evt);
      if(session&&(session.t==='device'||session.t==='host'))o.freezeAutoBounds(true);
      canvas?.classList?.add('dragging');
      if(canvas?.setPointerCapture&&evt.pointerId!=null)canvas.setPointerCapture(evt.pointerId);
      return session;
    }
    function pointerMove(evt){
      if(!session)return null;
      const v=visual();
      if(session.t==='pan'){
        const next=INTERACTION.panView(session,evt.clientX,evt.clientY);
        if(Math.abs(next.px-session.startPx)+Math.abs(next.py-session.startPy)>2)session.moved=true;
        v.view.px=next.px;v.view.py=next.py;o.draw();return session;
      }
      const pt=point(evt);
      if(INTERACTION.moved(session,pt))session.moved=true;
      if(session.t==='loc-resize'){
        const loc=o.locationById(session.id);
        if(loc&&session.moved){const size=INTERACTION.resizeLocation(session,pt);loc.w=size.w;loc.h=size.h;o.draw();o.renderPanel();}
      }else if(session.t==='loc'){
        const loc=o.locationById(session.id);
        if(loc&&session.moved){
          const move=INTERACTION.locationMove(session,pt);loc.x=move.x;loc.y=move.y;
          for(const m of session.members||[])v.pos[m.id]={x:m.pos.x+move.deltaX,y:m.pos.y+move.deltaY};
          o.draw();
        }
      }else if(session.moved){
        v.pos[session.id]=INTERACTION.nodePosition(session,pt);
        const over=o.locationAt(pt);session.overLoc=over?over.id:null;o.draw();
      }
      return session;
    }
    function commitNodeDrop(done){
      const v=visual();
      if(!done.moved){v.pos[done.id]=done.startPos||v.pos[done.id];o.draw();o.renderPanel();return;}
      const targetId=done.overLoc||done.fromLoc,over=targetId?o.locationById(targetId):null;
      if(over){
        if(done.t==='device'){
          o.setDeviceVisualLocation(done.id,over.id);
          if(over.id!==done.fromLoc)v.pos[done.id]=o.nextNodePosition(over.id,'device',done.id);
        }else{
          o.setHostVisualLocation(done.id,over.id);
          if(over.id!==done.fromLoc){
            v.pos[done.id]=o.nextNodePosition(over.id,'host',done.id);
            const result=o.autoAssignHost(done.id,over.id)||{};
            if(result.ok){
              if(result.portId)v.pos[done.id]=o.nextNodePosition(over.id,'host',done.id);
            }else if(result.reason&&result.reason!=='Modo manual'){
              (o.warn||function(){})(result.reason);
            }
          }
        }
      }
      o.save();o.refresh();o.select(done.t,done.id);
    }
    function pointerUp(){
      if(!session)return null;
      const done=session;session=null;
      if(done.t==='device'||done.t==='host')o.freezeAutoBounds(false);
      canvas?.classList?.remove('dragging');
      if(done.t==='pan'){o.save();o.draw();return done;}
      if(done.t==='loc-resize'){o.save();o.draw();o.renderPanel();return done;}
      if(done.t==='device'||done.t==='host'){commitNodeDrop(done);return done;}
      o.save();o.draw();return done;
    }
    function wheel(evt){
      if(!canvas||!visual()?.view)return;
      evt.preventDefault?.();
      const r=canvas.getBoundingClientRect(),sx=evt.clientX-r.left,sy=evt.clientY-r.top;
      const next=INTERACTION.zoomAt(visual().view,sx,sy,evt.deltaY,.25,2.8);
      Object.assign(visual().view,next);o.draw();
    }
    function bind(){
      if(bound||!canvas)return;bound=true;
      canvas.addEventListener('pointerdown',pointerDown);
      canvas.addEventListener('pointermove',pointerMove);
      canvas.addEventListener('pointerup',pointerUp);
      canvas.addEventListener('pointercancel',pointerUp);
      canvas.addEventListener('lostpointercapture',pointerUp);
      canvas.addEventListener('wheel',wheel,{passive:false});
    }
    function destroy(){
      if(!bound||!canvas)return;bound=false;
      canvas.removeEventListener('pointerdown',pointerDown);
      canvas.removeEventListener('pointermove',pointerMove);
      canvas.removeEventListener('pointerup',pointerUp);
      canvas.removeEventListener('pointercancel',pointerUp);
      canvas.removeEventListener('lostpointercapture',pointerUp);
      canvas.removeEventListener('wheel',wheel);
      session=null;
    }
    return{
      version:'netwizard-v5-drag-controller-v1',bind,destroy,pointerDown,pointerMove,pointerUp,wheel,
      getSession:()=>session,isActive:()=>!!session
    };
  }

  return{version:'netwizard-v5-drag-controller-factory-v1',create};
});