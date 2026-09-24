/* =========================================================
   NetWizard V5 Controls v1
   Toolbar, filtros, fullscreen y ciclo de eventos de ventana.
========================================================= */
(function initNetWizardV5Controls(root,factory){
  'use strict';
  const api=factory();
  root.NetWizardV5Controls=api;
  if(typeof module!=='undefined'&&module.exports)module.exports=api;
})(typeof window!=='undefined'?window:globalThis,function(){
  'use strict';

  function create(options){
    const o=options||{};
    const doc=o.document||(typeof document!=='undefined'?document:null);
    const win=o.window||(typeof window!=='undefined'?window:null);
    const cleanup=[];
    let bound=false;

    const el=id=>doc&&doc.getElementById?doc.getElementById(id):null;
    const layout=()=>el(o.layoutId||'v5Layout');
    const fsButton=()=>el(o.fullscreenButtonId||'v5Fs');
    const schedule=fn=>(o.schedule?o.schedule(fn):setTimeout(fn,30));

    function listen(target,event,handler,opts){
      if(!target||!target.addEventListener)return;
      target.addEventListener(event,handler,opts);
      cleanup.push(()=>target.removeEventListener&&target.removeEventListener(event,handler,opts));
    }
    function click(id,fn){
      const target=el(id);
      if(target)listen(target,'click',fn);
    }
    function currentFullscreen(){
      const target=layout();
      if(!target)return false;
      return !!(doc&&doc.fullscreenElement===target)||!!target.classList&&target.classList.contains('fs');
    }
    function syncFilters(){
      if(!doc||!doc.querySelectorAll)return;
      doc.querySelectorAll('[data-v5-filter]').forEach(cb=>{
        const key=cb.dataset&&cb.dataset.v5Filter;
        if(key)cb.checked=o.filterValue?o.filterValue(key)!==false:true;
      });
    }
    function syncFullscreen(){
      const target=layout();
      if(!target)return false;
      const nativeFs=!!(doc&&doc.fullscreenElement===target);
      const fallbackFs=!!target.classList&&target.classList.contains('fs');
      const on=nativeFs||fallbackFs;
      if(target.classList)target.classList.toggle('fs',fallbackFs&&!nativeFs);
      if(doc&&doc.body&&doc.body.classList)doc.body.classList.toggle('v5-fs-lock',on);
      if(o.setFullscreenState)o.setFullscreenState(on);
      const button=fsButton();
      if(button)button.textContent=on?'🗗 Salir pantalla completa':'⛶ Pantalla completa';
      if(o.afterFullscreenSync)schedule(()=>o.afterFullscreenSync(on));
      return on;
    }
    async function toggleFullscreen(force){
      const target=layout();
      if(!target)return false;
      const active=currentFullscreen();
      const next=force==null?!active:!!force;
      try{
        if(next){
          if(doc&&doc.fullscreenElement&&doc.fullscreenElement!==target&&doc.exitFullscreen)await doc.exitFullscreen();
          if(target.requestFullscreen)await target.requestFullscreen();
          else if(target.classList)target.classList.add('fs');
        }else{
          if(doc&&doc.fullscreenElement===target&&doc.exitFullscreen)await doc.exitFullscreen();
          if(target.classList)target.classList.remove('fs');
        }
      }catch(error){
        if(target.classList)target.classList.toggle('fs',next);
        if(o.onError)o.onError(error);
      }
      syncFullscreen();
      return next;
    }
    function onFilterChange(event){
      const target=event&&event.target;
      const cb=target&&target.closest?target.closest('[data-v5-filter]'):target;
      const key=cb&&cb.dataset&&cb.dataset.v5Filter;
      if(key&&o.setFilter)o.setFilter(key,!!cb.checked);
    }
    function onKeydown(event){
      if(event&&event.key==='Escape'&&currentFullscreen())toggleFullscreen(false);
    }
    function onResize(){
      if(!o.isActive||o.isActive())o.onResize&&o.onResize();
    }
    function bind(){
      if(bound)return;
      bound=true;
      click(o.autoButtonId||'v5AutoLoc',()=>o.autoLocate&&o.autoLocate());
      click(o.addButtonId||'v5AddLoc',()=>o.addLocation&&o.addLocation());
      click(o.fitButtonId||'v5Fit',()=>o.fit&&o.fit());
      click(o.fullscreenButtonId||'v5Fs',()=>toggleFullscreen());
      listen(doc,'change',onFilterChange);
      listen(doc,'fullscreenchange',syncFullscreen);
      listen(win,'keydown',onKeydown);
      listen(win,'resize',onResize);
      syncFilters();
      syncFullscreen();
    }
    function destroy(){
      while(cleanup.length){try{cleanup.pop()();}catch{}}
      bound=false;
    }

    return{
      version:'netwizard-v5-controls-v1',
      bind,destroy,syncFilters,syncFullscreen,toggleFullscreen,currentFullscreen,
      isBound:()=>bound
    };
  }

  return{version:'netwizard-v5-controls-factory-v1',create};
});