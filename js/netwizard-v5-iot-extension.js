/* =========================================================
   NetWizard V5 IoT Extension v1.9
   Añade capa IoT a la V5, filtros por tecnología y leyenda
   diferenciada de conexiones inalámbricas.
========================================================= */
(function(){
  'use strict';
  const TECH = {
    wifi:{label:'Wi‑Fi', color:'#06b6d4', dash:[0,0], icon:'📶'},
    lora:{label:'LoRaWAN', color:'#f97316', dash:[8,6], icon:'📡'},
    zigbee:{label:'Zigbee', color:'#8b5cf6', dash:[3,5], icon:'🟣'},
    thread:{label:'Thread', color:'#22c55e', dash:[2,7], icon:'🕸'},
    mqtt:{label:'MQTT', color:'#38bdf8', dash:[10,4,2,4], icon:'🛰'},
    ble:{label:'BLE', color:'#60a5fa', dash:[2,4], icon:'🔵'},
    ethernet:{label:'Ethernet', color:'#64748b', dash:[], icon:'🔌'},
    camera:{label:'Cámara/NVR', color:'#ef4444', dash:[6,3], icon:'🎥'},
    controller:{label:'Controlador', color:'#10b981', dash:[], icon:'🏠'},
    cloud:{label:'Cloud/API', color:'#a78bfa', dash:[4,4], icon:'☁️'},
    generic:{label:'Genérico', color:'#8fa3c0', dash:[], icon:'🌉'}
  };
  const ACCESS_TECH = {
    wifi_ap:'wifi', lorawan_gateway:'lora', zigbee_coordinator:'zigbee', thread_border_router:'thread',
    ble_gateway:'ble', mqtt_broker:'mqtt', home_assistant:'controller', nvr:'camera', cloud_api:'cloud', generic_gateway:'generic'
  };
  const ACCESS_ICON = {
    wifi_ap:'📶', lorawan_gateway:'📡', zigbee_coordinator:'🟣', thread_border_router:'🕸', ble_gateway:'🔵',
    mqtt_broker:'🛰', home_assistant:'🏠', nvr:'🎥', cloud_api:'☁️', generic_gateway:'🌉'
  };
  const TYPE_ICON = {sensor:'🌡',camera:'📷',meter:'⚡',plug:'🔌',light:'💡',lock:'🔐',thermostat:'♨️',actuator:'⚙️',controller:'🏠',other:'📦'};
  let oldDraw=null, oldPanel=null;
  let hits=[];
  let iotDrag=null;
  let iotJustDragged=false;
  function esc(s){
    const sec=window.NetWizardSecurityUtils||window.NetWizardCoreUtils;
    if(sec&&typeof sec.escapeHtml==='function') return sec.escapeHtml(s);
    return String(s??'').replace(/[&<>'"]/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','\"':'&quot;'}[m]));
  }
  function iotState(){try{return window.NetWizardIoTEmbedded?.getState?.()||{accessNodes:[],devices:[]};}catch{return {accessNodes:[],devices:[]};}}
  function iotPosStore(){const V=window.vv?.(); if(!V)return {access:{},devices:{}}; V.iotPos=V.iotPos||{access:{},devices:{}}; V.iotPos.access=V.iotPos.access||{}; V.iotPos.devices=V.iotPos.devices||{}; return V.iotPos;}
  function wifiNetworkDevice(){try{return (S.devices||[]).find(d=>d.wirelessRole&&d.wirelessRole!=='none') || (S.devices||[]).find(d=>(d.type==='router'||d.type==='switch') && /wifi|wi-fi|wireless|wlan|ap/i.test([d.name,d.model,d.notes,d.wirelessRole].join(' ')));}catch{return null;}}

  function locForIot(obj){
    const lid=obj?.locationId||''; const pname=(obj?.physicalLocation||'').toLowerCase();
    const locs=window.vLocs?.()||[];
    if(lid){const direct=locs.find(l=>l.id===lid||l.physicalLocationId===lid); if(direct)return direct;}
    if(pname){const byName=locs.find(l=>String(l.name||'').toLowerCase()===pname); if(byName)return byName;}
    return null;
  }
  function locBoundsForIot(obj){const loc=locForIot(obj); if(!loc)return null; try{return window.visualLocBounds(loc);}catch{return {x:loc.x||0,y:loc.y||0,w:loc.w||360,h:loc.h||220};}}
  function locIdAtPoint(x,y){try{const loc=(window.vLocs?.()||[]).slice().reverse().find(l=>{const b=window.visualLocBounds(l);return x>=b.x&&x<=b.x+b.w&&y>=b.y&&y<=b.y+b.h;});return loc?.physicalLocationId||loc?.id||'';}catch{return '';}}
  function canvas(){return document.getElementById('v5view');}
  function ctx(){return canvas()?.getContext('2d');}
  function filters(){try{return window.v5Filters?window.v5Filters():{};}catch{return {};}}
  function on(k){const f=filters();return f[k]!==false;}
  function techOfAccess(a){return ACCESS_TECH[a?.type]||'generic';}
  function techMeta(t){return TECH[t]||TECH.generic;}
  function v2sSafe(x,y){try{return window.v2s(x,y);}catch{return {x,y};}}
  function nodeBoundsSafe(kind,id){try{return window.visualNodeBounds(kind,id);}catch{return {x:0,y:0,w:160,h:50};}}
  function deviceShown(id){try{const b=nodeBoundsSafe('dev',id);return Number.isFinite(b.x)&&Number.isFinite(b.y);}catch{return false;}}
  function saveAndRedraw(){try{window.save?.();}catch{} try{window.drawV5?.();}catch{} try{window.renderV5Panel?.();}catch{} }
  function ensureIotModalVisibleInFullscreen(modalId){
    const modal=document.getElementById(modalId);
    const fs=document.fullscreenElement;
    const layout=document.getElementById('v5Layout');
    if(modal && fs && layout && fs.contains(layout) && !layout.contains(modal)){
      layout.appendChild(modal);
    }
  }
  function openIotAccessFromV5(id){
    ensureIotModalVisibleInFullscreen('iotAccessModal');
    try{window.NetWizardIoTEmbedded?.openAccess?.(id);}catch(e){console.error('No se pudo abrir infraestructura IoT desde V5',e);}
  }
  function openIotDeviceFromV5(id){
    ensureIotModalVisibleInFullscreen('iotDeviceModal');
    try{window.NetWizardIoTEmbedded?.openDevice?.(id);}catch(e){console.error('No se pudo abrir dispositivo IoT desde V5',e);}
  }
  window.NWV5OpenIotAccess=openIotAccessFromV5;
  window.NWV5OpenIotDevice=openIotDeviceFromV5;
  function accessBaseWorld(a,index){
    const lb=locBoundsForIot(a);
    if(lb){return {x:lb.x+lb.w-88,y:lb.y+72+(index%8)*58};}
    if(a.parentDeviceId && deviceShown(a.parentDeviceId)){
      const b=nodeBoundsSafe('dev',a.parentDeviceId);
      return {x:b.x+b.w+60,y:b.y+10+(index%4)*56};
    }
    const locs=window.vLocs?.()||[];
    const loc=locs[0];
    if(loc && window.visualLocBounds){const b=window.visualLocBounds(loc);return {x:b.x+b.w-115,y:b.y+65+index*62};}
    return {x:650,y:110+index*66};
  }
  function buildPositions(){
    const st=iotState(); const pos={access:{},devices:{}};
    const store=iotPosStore();
    const accessVisible=[];
    (st.accessNodes||[]).forEach((a)=>{
      const tech=techOfAccess(a); if(on('iotAccess') && on(tech)){
        accessVisible.push(a);
        const saved=store.access[a.id];
        pos.access[a.id]=saved&&Number.isFinite(saved.x)&&Number.isFinite(saved.y)?{...saved}:accessBaseWorld(a,accessVisible.length-1);
      }
    });
    (st.devices||[]).forEach((d,i)=>{
      const tech=d.tech||'generic'; if(!on('iotDevice')||!on(tech))return;
      const saved=store.devices[d.id];
      if(saved&&Number.isFinite(saved.x)&&Number.isFinite(saved.y)){pos.devices[d.id]={...saved};return;}
      const lb=locBoundsForIot(d);
      if(lb){
        const inLoc=(st.devices||[]).filter(x=>(x.locationId&&x.locationId===d.locationId)||(x.physicalLocation&&d.physicalLocation&&x.physicalLocation===d.physicalLocation));
        const ix=Math.max(0,inLoc.findIndex(x=>x.id===d.id));
        pos.devices[d.id]={x:lb.x+lb.w-58-(ix%2)*88,y:lb.y+76+Math.floor(ix/2)*56};
        return;
      }
      const a=pos.access[d.accessNodeId];
      if(a){
        const siblings=(st.devices||[]).filter(x=>x.accessNodeId===d.accessNodeId && on(x.tech||'generic'));
        const ix=siblings.findIndex(x=>x.id===d.id);
        pos.devices[d.id]={x:a.x+170+(ix%2)*105,y:a.y-12+Math.floor(ix/2)*58};
        return;
      }
      const wd=(d.tech==='wifi'||d.tech==='ethernet')?wifiNetworkDevice():null;
      if(wd&&deviceShown(wd.id)){
        const b=nodeBoundsSafe('dev',wd.id);
        pos.devices[d.id]={x:b.x+b.w+185+(i%2)*95,y:b.y+5+Math.floor(i/2)*56};
        return;
      }
      pos.devices[d.id]={x:840+(i%3)*105,y:120+Math.floor(i/3)*70};
    });
    return pos;
  }
  function drawLink(c,from,to,tech,label){
    const m=techMeta(tech); const a=v2sSafe(from.x,from.y), b=v2sSafe(to.x,to.y); const z=(window.vv?.().view?.zoom)||1;
    c.save(); c.strokeStyle=m.color; c.lineWidth=2.2; c.globalAlpha=.86; c.setLineDash((m.dash||[]).map(x=>x*z)); c.beginPath(); c.moveTo(a.x,a.y); const mid=(a.x+b.x)/2; c.bezierCurveTo(mid,a.y,mid,b.y,b.x,b.y); c.stroke(); c.setLineDash([]);
    const txt=label||m.label; c.font='10px Fira Code,monospace'; const lw=Math.max(56,txt.length*6+12); const mx=(a.x+b.x)/2,my=(a.y+b.y)/2-8; c.fillStyle='rgba(7,9,15,.94)'; round(c,mx-lw/2,my-10,lw,18,8); c.fill(); c.strokeStyle=m.color; c.globalAlpha=.9; round(c,mx-lw/2,my-10,lw,18,8); c.stroke(); c.globalAlpha=1; c.fillStyle=m.color; c.fillText(txt,mx-lw/2+6,my+3); c.restore();
  }
  function round(c,x,y,w,h,r){c.beginPath();c.moveTo(x+r,y);c.arcTo(x+w,y,x+w,y+h,r);c.arcTo(x+w,y+h,x,y+h,r);c.arcTo(x,y+h,x,y,r);c.arcTo(x,y,x+w,y,r);c.closePath();}
  function drawNode(c,x,y,r,icon,label,color,selected){
    const p=v2sSafe(x,y); const z=(window.vv?.().view?.zoom)||1; const rr=r*z; c.save(); c.fillStyle='rgba(7,12,20,.96)'; c.beginPath(); c.arc(p.x,p.y,rr+3,0,Math.PI*2); c.fill(); c.fillStyle=color; c.globalAlpha=.22; c.beginPath(); c.arc(p.x,p.y,rr+2,0,Math.PI*2); c.fill(); c.globalAlpha=1; c.strokeStyle=selected?'#f59e0b':color; c.lineWidth=selected?3:1.6; c.beginPath(); c.arc(p.x,p.y,rr,0,Math.PI*2); c.stroke(); c.fillStyle='#e2eaf7'; c.font=Math.max(14,20*z)+'px sans-serif'; c.textAlign='center'; c.textBaseline='middle'; c.fillText(icon,p.x,p.y-1); c.font='11px Space Grotesk,sans-serif'; c.fillStyle='#8fa3c0'; c.fillText(short(label,22),p.x,p.y+rr+14); c.restore(); hits.push({x,y,r,type:selected?null:'',label});
  }
  function short(s,n){s=String(s||'');return s.length>n?s.slice(0,n-1)+'…':s;}
  function drawOverlay(){
    const c=ctx(); if(!c||!canvas())return; const st=iotState(); const pos=buildPositions(); hits=[];
    const sel=window.vv?.().sel||{};
    // Infraestructura IoT: enlaces físicos a la red y nodos
    (st.accessNodes||[]).forEach((a)=>{
      const tech=techOfAccess(a); if(!pos.access[a.id])return; const p=pos.access[a.id]; const meta=techMeta(tech);
      if(a.parentDeviceId && deviceShown(a.parentDeviceId)){
        const b=nodeBoundsSafe('dev',a.parentDeviceId); drawLink(c,{x:b.x+b.w,y:b.y+b.h/2},{x:p.x,y:p.y},'ethernet',a.parentPortId?'uplink/port':'uplink');
      }
      const selected=sel.t==='iotAccess'&&sel.id===a.id; drawNode(c,p.x,p.y,24,ACCESS_ICON[a.type]||'🌉',a.name||meta.label,meta.color,selected); hits.push({t:'iotAccess',id:a.id,x:p.x,y:p.y,r:30});
    });
    // Dispositivos finales IoT
    (st.devices||[]).forEach(d=>{
      const tech=d.tech||'generic'; const p=pos.devices[d.id]; if(!p)return; const meta=techMeta(tech); const a=pos.access[d.accessNodeId];
      if(a){
        drawLink(c,a,p,tech,meta.label);
      }else{
        const wd=(tech==='wifi'||tech==='ethernet')?wifiNetworkDevice():null;
        if(wd&&deviceShown(wd.id)){
          const b=nodeBoundsSafe('dev',wd.id);
          drawLink(c,{x:b.x+b.w,y:b.y+b.h/2},p,tech,tech==='wifi'?'Wi‑Fi router':meta.label);
        }
      }
      const selected=sel.t==='iotDevice'&&sel.id===d.id; drawNode(c,p.x,p.y,20,TYPE_ICON[d.type]||'📦',d.name||'IoT',meta.color,selected); hits.push({t:'iotDevice',id:d.id,x:p.x,y:p.y,r:26});
    });
  }
  function renderIoTPanel(sel){
    const box=document.getElementById('v5Panel'); if(!box)return false; const st=iotState();
    function clear(){ box.replaceChildren(); }
    function metaRow(items){ const row=document.createElement('div'); row.className='v5-meta'; items.forEach(([cls,text])=>{ const sp=document.createElement('span'); sp.className=cls; sp.textContent=text; row.appendChild(sp); }); return row; }
    function field(label,value,readonly){ const wrap=document.createElement('div'); const lab=document.createElement('label'); lab.className='fl'; lab.textContent=label; const input=document.createElement('input'); input.value=value||''; if(readonly) input.readOnly=true; wrap.appendChild(lab); wrap.appendChild(input); return wrap; }
    function row2(children){ const row=document.createElement('div'); row.className='v5-row2'; children.forEach(ch=>row.appendChild(ch)); return row; }
    function button(label,cls,handler){ const b=document.createElement('button'); b.type='button'; b.className=cls; b.textContent=label; b.addEventListener('click',handler); return b; }
    if(sel?.t==='iotAccess'){
      const a=(st.accessNodes||[]).find(x=>x.id===sel.id); if(!a)return false; const tech=techOfAccess(a); const meta=techMeta(tech);
      clear();
      const title=document.createElement('div'); title.className='card-t'; title.textContent=`${ACCESS_ICON[a.type]||'🌉'} ${a.name||''}`; box.appendChild(title);
      box.appendChild(metaRow([['b bcy','Infra IoT'],['b bgr',meta.label],['b bac',a.vendor||'generic']]));
      const r=row2([field('Nombre',a.name||'',false), field('Tipo',a.type||'',true)]);
      r.querySelector('input')?.addEventListener('focus',()=>window.NetWizardIoTEmbedded?.openAccess?.(a.id));
      box.appendChild(r);
      const note=document.createElement('div'); note.className='v5-note'; note.textContent='Edita la configuración completa desde el módulo IoT embebido. El nodo se muestra en V5 conectado a su equipo/puerto NetWizard.'; box.appendChild(note);
      box.appendChild(metaRow([['b bgr',`Ubicación: ${a.physicalLocation||'—'}`],['b bgr',`Gestión: ${a.mgmtIp||'—'}`],['b bgr',`Servicio: ${a.serviceName||'—'}`]]));
      const brow=document.createElement('div'); brow.className='brow'; brow.appendChild(button('Editar infraestructura IoT','btn bp',()=>window.NWV5OpenIotAccess?.(a.id))); brow.appendChild(button('Abrir IoT & Gateways','btn bs',()=>document.querySelector('[data-step=iot]')?.click())); box.appendChild(brow);
      return true;
    }
    if(sel?.t==='iotDevice'){
      const d=(st.devices||[]).find(x=>x.id===sel.id); if(!d)return false; const meta=techMeta(d.tech||'generic'); const acc=(st.accessNodes||[]).find(a=>a.id===d.accessNodeId);
      clear();
      const title=document.createElement('div'); title.className='card-t'; title.textContent=`${TYPE_ICON[d.type]||'📦'} ${d.name||''}`; box.appendChild(title);
      box.appendChild(metaRow([['b bgn','Dispositivo IoT'],['b bgr',meta.label],['b bac',d.type||'iot']]));
      box.appendChild(row2([field('Tecnología',meta.label,true), field('Acceso',acc?acc.name:'—',true)]));
      box.appendChild(row2([field('Ubicación',d.physicalLocation||'—',true), field('ID/IP/EUI',d.identifier||'',true), field('Credencial/alias',d.credentialAlias||'',true)]));
      const note=document.createElement('div'); note.className='v5-note'; note.textContent=`La conexión inalámbrica se dibuja con la leyenda propia de ${meta.label}.`; box.appendChild(note);
      const brow=document.createElement('div'); brow.className='brow'; brow.appendChild(button('Editar dispositivo IoT','btn bp',()=>window.NWV5OpenIotDevice?.(d.id))); brow.appendChild(button('Abrir IoT & Gateways','btn bs',()=>document.querySelector('[data-step=iot]')?.click())); box.appendChild(brow);
      return true;
    }
    return false;
  }
  function canvasWorldPoint(e){const cv=canvas(); const r=cv.getBoundingClientRect(); try{return window.s2v(e.clientX-r.left,e.clientY-r.top);}catch{return {x:e.clientX-r.left,y:e.clientY-r.top};}}
  function findIotHitFromEvent(e){
    const p=canvasWorldPoint(e);
    return hits.slice().reverse().find(h=>h.t&&Math.hypot(h.x-p.x,h.y-p.y)<=h.r+8)||null;
  }
  function onPointerDown(e){
    const hit=findIotHitFromEvent(e);
    if(!hit)return;
    const p=canvasWorldPoint(e);
    iotDrag={t:hit.t,id:hit.id,dx:p.x-hit.x,dy:p.y-hit.y,downX:p.x,downY:p.y,moved:false};
    const V=window.vv?.(); if(V){V.sel={t:hit.t,id:hit.id};}
    try{window.renderV5Panel?.();}catch{}
    if(canvas()?.setPointerCapture&&e.pointerId!=null)canvas().setPointerCapture(e.pointerId);
    e.preventDefault(); e.stopImmediatePropagation();
  }
  function onPointerMove(e){
    if(!iotDrag)return;
    const p=canvasWorldPoint(e);
    if(Math.hypot(p.x-iotDrag.downX,p.y-iotDrag.downY)>4)iotDrag.moved=true;
    const store=iotPosStore();
    const target=iotDrag.t==='iotAccess'?store.access:store.devices;
    target[iotDrag.id]={x:p.x-iotDrag.dx,y:p.y-iotDrag.dy};
    try{window.drawV5?.();}catch{}
    e.preventDefault(); e.stopImmediatePropagation();
  }
  function onPointerUp(e){
    if(!iotDrag)return;
    const was={...iotDrag};
    if(iotDrag.moved){
      const store=iotPosStore();
      const p=(iotDrag.t==='iotAccess'?store.access:store.devices)[iotDrag.id];
      const lid=p?locIdAtPoint(p.x,p.y):'';
      if(lid){
        try{ if(iotDrag.t==='iotAccess') window.NetWizardIoTEmbedded?.setAccessLocation?.(iotDrag.id,lid); else window.NetWizardIoTEmbedded?.setDeviceLocation?.(iotDrag.id,lid); }catch{}
      }
    }
    iotJustDragged=!!was.moved;
    iotDrag=null;
    saveAndRedraw();
    setTimeout(()=>{iotJustDragged=false;},0);
    e.preventDefault(); e.stopImmediatePropagation();
  }
  function onClick(e){
    if(iotJustDragged)return;
    const cv=canvas(); if(!cv)return; const p=canvasWorldPoint(e); const hit=hits.slice().reverse().find(h=>Math.hypot(h.x-p.x,h.y-p.y)<=h.r+8); if(!hit)return;
    const V=window.vv?.(); if(!V)return; V.sel={t:hit.t,id:hit.id}; try{window.renderV5Panel();}catch{} try{window.drawV5();}catch{} e.preventDefault(); e.stopPropagation();
  }
  function syncFilters(){document.querySelectorAll('[data-v5-filter]').forEach(cb=>{try{cb.checked=window.v5FilterOn?window.v5FilterOn(cb.dataset.v5Filter):true;}catch{cb.checked=true;}});}
  function init(){
    if(!window.drawV5 || oldDraw)return;
    oldDraw=window.drawV5; oldPanel=window.renderV5Panel;
    window.drawV5=function(){oldDraw(); drawOverlay();};
    window.renderV5Panel=function(){const sel=window.vv?.().sel; if(renderIoTPanel(sel))return; oldPanel();};
    canvas()?.addEventListener('pointerdown',onPointerDown,true);
    canvas()?.addEventListener('pointermove',onPointerMove,true);
    canvas()?.addEventListener('pointerup',onPointerUp,true);
    canvas()?.addEventListener('pointercancel',onPointerUp,true);
    canvas()?.addEventListener('click',onClick,true);
    syncFilters();
    document.addEventListener('nw:iot:changed',()=>{try{window.drawV5();window.renderV5Panel();}catch{}});
    document.addEventListener('click',e=>{
      if(e.target.closest('[data-step="graphs"], .bnit[data-step="graphs"]'))setTimeout(()=>{syncFilters();window.drawTopo?.();window.resizeV5?.();window.drawV5?.();window.NetWizardUnifiedConfigMap?.render?.();},180);
      const tab=e.target.closest('[data-tab^="graphs-"]');
      if(tab)setTimeout(()=>{syncFilters();window.drawTopo?.();window.resizeV5?.();window.drawV5?.();window.NetWizardUnifiedConfigMap?.render?.();},120);
    });
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>setTimeout(init,50));else setTimeout(init,50);
})();
