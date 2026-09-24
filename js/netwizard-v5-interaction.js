/* =========================================================
   NetWizard V5 Interaction Model v1
   Hit-testing y matemáticas de drag/pan/zoom sin DOM.
========================================================= */
(function initNetWizardV5Interaction(root,factory){
  'use strict';
  const api=factory();root.NetWizardV5Interaction=api;
  if(typeof module!=='undefined'&&module.exports)module.exports=api;
})(typeof window!=='undefined'?window:globalThis,function(){
  'use strict';
  const arr=v=>Array.isArray(v)?v:[];
  function inside(p,b){return !!p&&!!b&&p.x>=b.x&&p.x<=b.x+b.w&&p.y>=b.y&&p.y<=b.y+b.h;}
  function resizeHandleHit({point,locations,locationBounds,zoom=1,enabled}){
    const z=Math.max(.01,Number(zoom)||1);
    for(const loc of [...arr(locations)].reverse()){
      if(enabled&&enabled(loc)===false)continue;
      const b=locationBounds(loc),hs=16/z,hx=b.x+b.w-hs-8/z,hy=b.y+b.h-hs-8/z;
      if(inside(point,{x:hx,y:hy,w:hs,h:hs}))return{t:'loc-resize',id:loc.id};
    }
    return null;
  }
  function hitTest({point,hosts,devices,locations,showHost,showDevice,nodeBounds,locationBounds,zoom=1,resizeEnabled}){
    const rh=resizeHandleHit({point,locations,locationBounds,zoom,enabled:resizeEnabled});if(rh)return rh;
    for(const h of [...arr(hosts)].reverse()){if(showHost&&showHost(h)===false)continue;if(inside(point,nodeBounds('host',h.id)))return{t:'host',id:h.id};}
    for(const d of [...arr(devices)].reverse()){if(showDevice&&showDevice(d)===false)continue;if(inside(point,nodeBounds('dev',d.id)))return{t:'device',id:d.id};}
    for(const loc of [...arr(locations)].reverse())if(inside(point,locationBounds(loc)))return{t:'loc',id:loc.id};
    return null;
  }
  function locationAt({point,locations,locationBounds}){for(const loc of [...arr(locations)].reverse())if(inside(point,locationBounds(loc)))return loc;return null;}
  function moved(session,point,threshold=4){return !!session&&!!point&&Math.hypot(point.x-session.downX,point.y-session.downY)>threshold;}
  function nodePosition(session,point){return{x:point.x-session.dx,y:point.y-session.dy};}
  function locationMove(session,point){const x=point.x-session.dx,y=point.y-session.dy;return{x,y,deltaX:x-session.startX,deltaY:y-session.startY};}
  function resizeLocation(session,point,minW=330,minH=160){return{w:Math.max(minW,session.startW+(point.x-session.startX)),h:Math.max(minH,session.startH+(point.y-session.startY))};}
  function panView(session,clientX,clientY){return{px:session.startPx+(Number(clientX)||0)-session.startX,py:session.startPy+(Number(clientY)||0)-session.startY};}
  function zoomAt(view,sx,sy,deltaY,min=.25,max=2.8){
    const old=Math.max(.01,Number(view?.zoom)||1),px=Number(view?.px)||0,py=Number(view?.py)||0;
    const wx=(sx-px)/old,wy=(sy-py)/old,factor=deltaY<0?1.12:.89,next=Math.max(min,Math.min(max,old*factor));
    return{zoom:next,px:sx-wx*next,py:sy-wy*next};
  }
  function linkDotAt(dots,x,y){return[...arr(dots)].reverse().find(d=>Math.hypot(Number(d.x)-x,Number(d.y)-y)<=Number(d.r||0))||null;}
  return{version:'netwizard-v5-interaction-v1',inside,resizeHandleHit,hitTest,locationAt,moved,nodePosition,locationMove,resizeLocation,panView,zoomAt,linkDotAt};
});