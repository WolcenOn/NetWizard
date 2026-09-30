/* =========================================================
   NetWizard v2.8.1 - V5 Tree Block Layout Hotfix
   - Base estable v2.7: no toca netwizard.js ni drawV5().
   - Añade layout "Árbol · bloques por puerto" sin reescribir el motor V5.
   - Cada ubicación se calcula como bloques verticales:
     [router/switch/AP] a la izquierda + hosts asociados en UNA columna a la derecha.
   - Las ubicaciones raíz se colocan por árbol de conectividad con separación garantizada.
========================================================= */
(function(){
  'use strict';

  const V5=window.NetWizardV5;
  const CORE=window.NetWizardV5Core;
  const SK = 'netwizard_v5_layout_manager_v29';
  const MODES = {
    treeBlocks: 'Árbol · bloques por puerto',
    locationColumns: 'Por ubicación · columnas',
    hierarchy: 'Jerárquico',
    radial: 'Radial por ubicación',
    forceLite: 'Fuerzas suave'
  };

  function $(id){ return document.getElementById(id); }
  function escHtml(v){
    try{
      if(window.NetWizardCoreUtils && typeof window.NetWizardCoreUtils.escapeHtml === 'function') return window.NetWizardCoreUtils.escapeHtml(v);
    }catch(e){}
    return String(v ?? '').replace(/[&<>\"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;',"'":'&#39;'}[ch]));
  }
  function addOption(select, value, label, selected){
    const opt=document.createElement('option');
    opt.value=String(value ?? ''); opt.textContent=String(label ?? value ?? '');
    if(selected) opt.selected=true;
    select.appendChild(opt);
  }
  function S(){ return V5?.project?.()||{}; }
  function V(){ return V5?.visual?.()||null; }
  function safe(fn, fallback){ try{return fn();}catch(e){ console.warn('[V5 layout manager v2.8.1]', e); return fallback; } }
  function readCfg(){ try{return {...{v5Mode:'treeBlocks'},...JSON.parse(localStorage.getItem(SK)||'{}')};}catch{return {v5Mode:'treeBlocks'};} }
  function saveCfg(cfg){ localStorage.setItem(SK, JSON.stringify(cfg)); }
  function cfg(){ return readCfg(); }
  function byName(a,b){ return String(a?.name||a?.label||a?.id||'').localeCompare(String(b?.name||b?.label||b?.id||''), undefined, {numeric:true,sensitivity:'base'}); }

  function ensureV5(){ if(!V5||!CORE)return false; const v=V(); if(!v)return false; if(!v.layoutManager)v.layoutManager={}; return true; }
  function devById(id){ return (S().devices||[]).find(d=>d.id===id); }
  function portById(id){ return (S().ports||[]).find(p=>p.id===id); }
  function visibleDevsInLoc(locId){ return (V5?.locationItems?.(locId).devices||[]).slice().sort(deviceOrder); }
  function visibleHostsInLoc(locId){ return (V5?.locationItems?.(locId).hosts||[]).slice().sort(hostOrder); }
  function vLocs(){ return V5?.locations?.()||[]; }
  function vLocById(id){ return V5?.locationById?.(id)||null; }
  function vLocRoots(){ return V5?.locationRoots?.()||[]; }
  function vLocChildren(id){ return (V5?.locationChildren?.(id)||[]).slice().sort(byName); }
  function vLocDepth(id){ return V5?.locationDepth?.(id)||0; }
  function deviceVisualLoc(id){ return V5?.deviceVisualLocation?.(id)||''; }
  function hostConnectedDeviceId(h){ return safe(()=>window.hostConnectedDeviceId(h), h?.connectedDeviceId||'') || ''; }
  function isNetworkDevice(d){ return d && ['firewall','router','switch','ap'].includes(d.type||''); }

  function iotState(){try{return window.NetWizardIoTEmbedded?.getState?.()||{accessNodes:[],devices:[]};}catch{return {accessNodes:[],devices:[]};}}
  function locByIotLocationId(locationId, physicalLocation){
    const locs=vLocs();
    if(locationId){const direct=locs.find(l=>l.id===locationId||l.physicalLocationId===locationId); if(direct)return direct;}
    const p=String(physicalLocation||'').trim().toLowerCase();
    if(p)return locs.find(l=>String(l.name||'').trim().toLowerCase()===p)||null;
    return null;
  }
  function iotItemsForLoc(loc){
    const st=iotState(); const locIds=new Set([loc.id, loc.physicalLocationId].filter(Boolean)); const locName=String(loc.name||'').trim().toLowerCase();
    const match=o=>(o.locationId&&locIds.has(o.locationId))||(o.physicalLocation&&String(o.physicalLocation).trim().toLowerCase()===locName);
    return {access:(st.accessNodes||[]).filter(match), devices:(st.devices||[]).filter(match)};
  }
  function iotRowCountForLoc(loc){const it=iotItemsForLoc(loc);return it.access.length+it.devices.length;}
  function iotPosStore(){const v=V();v.iotPos=v.iotPos||{access:{},devices:{}};v.iotPos.access=v.iotPos.access||{};v.iotPos.devices=v.iotPos.devices||{};return v.iotPos;}

  function deviceOrder(a,b){
    const rank = {firewall:0,router:1,switch:2,ap:3,server:4};
    return (rank[a.type]??9)-(rank[b.type]??9) || byName(a,b);
  }
  function hostOrder(a,b){
    const rank = {server:0,camera:1,ap:2,iot:3,printer:4,pc:5,laptop:6};
    return (rank[a.type]??9)-(rank[b.type]??9) || byName(a,b);
  }

  function injectV5Controls(){
    const bar = document.querySelector('#graphs-v5 .v5-toolbar');
    if(!bar || $('v5LayoutMode')) return;
    const cfg0 = cfg();
    const span = document.createElement('span');
    span.className = 'v5-layout-controls';
    const select = document.createElement('select');
    select.id='v5LayoutMode'; select.className='v5-layout-select'; select.title='Algoritmo de ordenación V5';
    Object.entries(MODES).forEach(([k,v])=>addOption(select,k,v,cfg0.v5Mode===k));
    const button = document.createElement('button');
    button.className='btn bp bsm'; button.id='v5ApplyLayout'; button.type='button'; button.textContent='🧠 Ordenar V5';
    span.appendChild(select); span.appendChild(button);
    const autoBtn = $('v5AutoLoc');
    if(autoBtn && autoBtn.nextSibling) bar.insertBefore(span, autoBtn.nextSibling); else bar.appendChild(span);
    $('v5LayoutMode')?.addEventListener('change', e=>{const c=cfg(); c.v5Mode=e.target.value; saveCfg(c);});
    $('v5ApplyLayout')?.addEventListener('click', ()=>applyV5SmartLayout(true));
  }

  // ───────── Layout V5: tamaños ─────────
  function locContentStats(loc){
    const devs = visibleDevsInLoc(loc.id);
    const hosts = visibleHostsInLoc(loc.id);
    const kids = vLocChildren(loc.id);
    return {devs, hosts, kids};
  }

  function blocksForLoc(loc){
    const {devs, hosts} = locContentStats(loc);
    const networkDevs = devs.filter(isNetworkDevice);
    const otherDevs = devs.filter(d=>!isNetworkDevice(d));
    const usedHosts = new Set();
    const blocks = [];

    networkDevs.forEach(dev=>{
      const hs = hosts.filter(h=>hostConnectedDeviceId(h)===dev.id).sort(hostOrder);
      hs.forEach(h=>usedHosts.add(h.id));
      blocks.push({kind:'device', dev, hosts:hs});
    });

    otherDevs.forEach(dev=>blocks.push({kind:'device', dev, hosts:[]}));

    const orphanHosts = hosts.filter(h=>!usedHosts.has(h.id)).sort(hostOrder);
    if(orphanHosts.length) blocks.push({kind:'orphan-hosts', dev:null, hosts:orphanHosts});
    if(!blocks.length) blocks.push({kind:'empty', dev:null, hosts:[]});
    return blocks;
  }

  function calcTreeLocSize(loc){
    const blocks = blocksForLoc(loc);
    const header=46, padX=24, padY=18, blockGap=20;
    const devW = Math.max(176, window.V5S?.devW || 176);
    const hostW = Math.max(158, window.V5S?.hstW || 158);
    const devH = Math.max(62, window.V5S?.devH || 62);
    const hostStep = 54;
    const gap = 56;
    const blockHeights = blocks.map(b=>Math.max(devH, Math.max(1,b.hosts.length)*hostStep));
    let w = padX*2 + devW + gap + hostW;
    let h = header + padY + blockHeights.reduce((a,x)=>a+x,0) + Math.max(0,blocks.length-1)*blockGap + padY;
    const iotRows = iotRowCountForLoc(loc);
    if(iotRows) h += 18 + Math.ceil(iotRows/2)*58;

    const kids = vLocChildren(loc.id);
    if(kids.length){
      const childSizes = kids.map(calcTreeLocSize);
      w = Math.max(w, 48 + Math.max(...childSizes.map(s=>s.w), 0));
      h += 18 + childSizes.reduce((a,s)=>a+s.h+18,0);
    }
    return {w:Math.max(430,w), h:Math.max(205,h), blocks, blockHeights};
  }

  function calcClassicLocSize(loc, mode){
    const {devs, hosts, kids} = locContentStats(loc);
    const header = 44, pad = 20, row = 72;
    const devCols = mode==='hierarchy' ? 2 : 1;
    const hostCols = hosts.length > 9 ? 3 : hosts.length > 4 ? 2 : 1;
    const devRows = Math.max(1, Math.ceil(devs.length/devCols));
    const hostRows = Math.max(1, Math.ceil(hosts.length/hostCols));
    const devW = Math.max(176, window.V5S?.devW || 176);
    const hostW = Math.max(158, window.V5S?.hstW || 158);
    const gap = 28;
    let w = pad*2 + devCols*devW + gap + hostCols*hostW + Math.max(0, hostCols-1)*14;
    let h = header + pad + Math.max(devRows, hostRows)*row + pad;
    const iotRows = iotRowCountForLoc(loc);
    if(iotRows) h += 18 + Math.ceil(iotRows/2)*58;
    if(kids.length){
      const childSizes = kids.map(k=>calcLocSize(k, mode));
      const childW = Math.max(0, ...childSizes.map(s=>s.w));
      const childH = childSizes.reduce((a,s)=>a+s.h+16,0);
      w = Math.max(w, childW + pad*2);
      h += childH + 12;
    }
    return {w:Math.max(420,w), h:Math.max(210,h), devCols, hostCols};
  }

  function calcLocSize(loc, mode){ return mode==='treeBlocks' ? calcTreeLocSize(loc) : calcClassicLocSize(loc, mode); }

  // ───────── Layout V5: contenido interno ─────────
  function arrangeTreeInternals(loc, bounds){
    const s = calcTreeLocSize(loc);
    const padX=24, header=46, blockGap=20, hostStep=54;
    const devW = Math.max(176, window.V5S?.devW || 176);
    const devH = Math.max(62, window.V5S?.devH || 62);
    const hostW = Math.max(158, window.V5S?.hstW || 158);
    const hostH = Math.max(42, window.V5S?.hstH || 42);
    const gap = 56;
    const v=V();
    let y = bounds.y + header + 18;
    const devX = bounds.x + padX;
    const hostX = devX + devW + gap;
    v.layoutManager.deviceBlockAnchor = v.layoutManager.deviceBlockAnchor || {};

    (s.blocks||[]).forEach(b=>{
      const blockH = Math.max(devH, Math.max(1,b.hosts.length)*hostStep);
      if(b.dev){
        v.pos[b.dev.id] = {x: devX, y: y + Math.max(0,(blockH-devH)/2)};
        v.layoutManager.deviceBlockAnchor[b.dev.id] = {x:devX+devW/2, y:y+blockH/2, sideX:devX+devW};
      }
      b.hosts.forEach((h,i)=>{
        v.pos[h.id] = {x: hostX, y: y + i*hostStep + Math.max(0,(hostStep-hostH)/2)};
      });
      y += blockH + blockGap;
    });
  }

  function arrangeClassicInternals(loc, bounds, mode){
    const {devs, hosts} = locContentStats(loc);
    const s = calcClassicLocSize(loc, mode);
    const pad = 22, header = 46, row = 72;
    const devW = Math.max(176, window.V5S?.devW || 176);
    const hostW = Math.max(158, window.V5S?.hstW || 158);
    const devX = bounds.x + pad;
    const hostAreaX = bounds.x + bounds.w - pad - (s.hostCols*hostW + Math.max(0,s.hostCols-1)*14);
    const top = bounds.y + header + 14;

    if(mode === 'radial'){
      const cx = bounds.x + bounds.w * .36, cy = bounds.y + bounds.h * .48;
      devs.forEach((d,i)=>{ const ang = -Math.PI/2 + (i/(Math.max(1,devs.length)))*Math.PI; V().pos[d.id] = {x: cx + Math.cos(ang)*80 - devW/2, y: cy + Math.sin(ang)*80 - 31}; });
      hosts.forEach((h,i)=>{ const cols=s.hostCols; const c=i%cols, r=Math.floor(i/cols); V().pos[h.id] = {x: hostAreaX + c*(hostW+14), y: top + r*row}; });
      return;
    }

    devs.forEach((d,i)=>{
      const col = mode==='hierarchy' ? i % s.devCols : 0;
      const r = Math.floor(i / s.devCols);
      V().pos[d.id] = {x: devX + col*(devW+14), y: top + r*row};
    });
    hosts.forEach((h,i)=>{
      const c = i % s.hostCols;
      const r = Math.floor(i / s.hostCols);
      V().pos[h.id] = {x: hostAreaX + c*(hostW+14), y: top + r*row};
    });
    if(mode==='forceLite') applyForceInside(bounds, [...devs.map(d=>d.id), ...hosts.map(h=>h.id)]);
  }

  function arrangeIotInLoc(loc,bounds){
    const it=iotItemsForLoc(loc); if(!it.access.length && !it.devices.length) return;
    const store=iotPosStore();
    const all=[...it.access.map(x=>({kind:'access',obj:x})),...it.devices.map(x=>({kind:'device',obj:x}))];
    const x0=bounds.x + Math.max(250, bounds.w - 210);
    const y0=bounds.y + Math.max(78, bounds.h - (Math.ceil(all.length/2)*58 + 30));
    all.forEach((it,i)=>{const p={x:x0+(i%2)*92,y:y0+Math.floor(i/2)*58}; if(it.kind==='access')store.access[it.obj.id]=p; else store.devices[it.obj.id]=p;});
  }
  function arrangeLocInternals(loc, bounds, mode){ const r = mode==='treeBlocks' ? arrangeTreeInternals(loc,bounds) : arrangeClassicInternals(loc,bounds,mode); arrangeIotInLoc(loc,bounds); return r; }

  function applyForceInside(bounds, ids){
    const pos = V().pos;
    const minX=bounds.x+18, minY=bounds.y+50, maxX=bounds.x+bounds.w-176-18, maxY=bounds.y+bounds.h-58-18;
    for(let iter=0; iter<38; iter++){
      for(let i=0;i<ids.length;i++) for(let j=i+1;j<ids.length;j++){
        const a=pos[ids[i]], b=pos[ids[j]]; if(!a||!b) continue;
        const dx=(a.x-b.x), dy=(a.y-b.y), dist=Math.max(1, Math.hypot(dx,dy));
        const min=62;
        if(dist<min){ const push=(min-dist)*.045; a.x += (dx/dist)*push; a.y += (dy/dist)*push; b.x -= (dx/dist)*push; b.y -= (dy/dist)*push; }
      }
      ids.forEach(id=>{ const p=pos[id]; if(!p)return; p.x=Math.max(minX,Math.min(maxX,p.x)); p.y=Math.max(minY,Math.min(maxY,p.y)); });
    }
  }

  // ───────── Layout V5: ubicación de cajas ─────────
  function rootOfLocId(id){ return CORE.rootLocationId(V(),id); }

  function buildRootGraph(){ return CORE.buildRootGraph(S(),V()); }

  function chooseRoot(){
    const {roots, adj}=buildRootGraph();
    if(!roots.length) return null;
    const edgeDev=(S().devices||[]).find(d=>d.internetEdge==='yes') || (S().devices||[]).find(d=>['firewall','router'].includes(d.type));
    if(edgeDev){
      const lid=rootOfLocId(deviceVisualLoc(edgeDev.id));
      const loc=roots.find(r=>r.id===lid); if(loc) return loc;
    }
    return roots.slice().sort((a,b)=>(adj.get(b.id)?.size||0)-(adj.get(a.id)?.size||0)||byName(a,b))[0];
  }

  function layoutLocationsTree(mode){
    const {roots, adj}=buildRootGraph();
    if(!roots.length) return;
    const root=chooseRoot();
    const levels=new Map(), parent=new Map(), visited=new Set();
    function bfs(start, level){
      const q=[start]; visited.add(start.id); levels.set(start.id,level);
      while(q.length){
        const loc=q.shift();
        const next=[...(adj.get(loc.id)||[])].map(vLocById).filter(Boolean).sort(byName);
        next.forEach(n=>{ if(visited.has(n.id)) return; visited.add(n.id); parent.set(n.id,loc.id); levels.set(n.id,(levels.get(loc.id)||0)+1); q.push(n); });
      }
    }
    if(root) bfs(root,0);
    roots.slice().sort(byName).forEach(r=>{ if(!visited.has(r.id)) bfs(r, Math.max(-1,...levels.values())+1); });

    const byLevel=new Map();
    roots.forEach(loc=>{ const lv=levels.get(loc.id)||0; if(!byLevel.has(lv)) byLevel.set(lv,[]); byLevel.get(lv).push(loc); });
    [...byLevel.values()].forEach(arr=>arr.sort((a,b)=>(parent.get(a.id)||'').localeCompare(parent.get(b.id)||'')||byName(a,b)));

    const startX=80, startY=90, colGap=105, rowGap=72;
    let x=startX;
    [...byLevel.keys()].sort((a,b)=>a-b).forEach(lv=>{
      const arr=byLevel.get(lv);
      const levelW=Math.max(420,...arr.map(l=>calcLocSize(l,mode).w));
      let y=startY;
      arr.forEach(loc=>{
        const s=calcLocSize(loc,mode);
        loc.x=x; loc.y=y; loc.w=s.w; loc.h=s.h;
        placeChildren(loc,{x:loc.x,y:loc.y,w:loc.w,h:loc.h},mode);
        y += s.h + rowGap;
      });
      x += levelW + colGap;
    });
  }

  function layoutLocationsGrid(mode){
    if(!ensureV5()) return;
    if(mode==='treeBlocks') return layoutLocationsTree(mode);
    const roots0 = vLocRoots().slice().sort(byName);
    const gapX = 70, gapY = 60, startX = 80, startY = 90;
    const sizes = new Map(roots0.map(r=>[r.id,calcLocSize(r,mode)]));
    const cols = Math.min(3, Math.max(1, Math.ceil(Math.sqrt(roots0.length || 1))));
    let x=startX, y=startY, rowH=0, col=0;
    roots0.forEach(loc=>{
      const s=sizes.get(loc.id) || {w:440,h:240};
      if(col>=cols){ col=0; x=startX; y += rowH + gapY; rowH=0; }
      loc.x=x; loc.y=y; loc.w=s.w; loc.h=s.h;
      placeChildren(loc, {x,y,w:s.w,h:s.h}, mode);
      x += s.w + gapX; rowH = Math.max(rowH, s.h); col++;
    });
  }

  function placeChildren(loc, parentBounds, mode){
    const kids = vLocChildren(loc.id);
    if(!kids.length) return;
    let cy = parentBounds.y + 70 + Math.max(120, calcLocSize(loc,mode).h*.35);
    kids.forEach(k=>{
      const s=calcLocSize(k, mode);
      k.x=parentBounds.x+24; k.y=cy; k.w=Math.min(parentBounds.w-48,Math.max(360,s.w)); k.h=s.h;
      placeChildren(k,{x:k.x,y:k.y,w:k.w,h:k.h},mode);
      cy += k.h + 18;
    });
  }

  function applyV5SmartLayout(persist){
    if(!ensureV5()) return;
    const mode = $('v5LayoutMode')?.value || cfg().v5Mode || 'treeBlocks';
    const c=cfg(); c.v5Mode=mode; saveCfg(c);
    safe(()=>window.ensureVisualModel(), null);
    if(V().layoutManager) V().layoutManager.deviceBlockAnchor={};
    layoutLocationsGrid(mode);
    vLocs().slice().sort((a,b)=>vLocDepth(a.id)-vLocDepth(b.id)).forEach(loc=>arrangeLocInternals(loc,{x:loc.x,y:loc.y,w:loc.w,h:loc.h},mode));
    if(persist!==false) safe(()=>window.save(), null);
    safe(()=>V5.redraw(), null);
    safe(()=>V5.renderPanel(), null);
  }
  window.applyV5SmartLayout = applyV5SmartLayout;
  window.autoVisualAssign = function(){ applyV5SmartLayout(true); };

  window.applyProfessionalLocationLayout = function(){
    if(!ensureV5()) return;
    layoutLocationsGrid(cfg().v5Mode || 'treeBlocks');
    const bounds={}; vLocs().forEach(l=>{ bounds[l.id]={x:l.x,y:l.y,w:l.w||430,h:l.h||205}; }); V().proBounds=bounds; return bounds;
  };
  window.computeProfessionalLocationBounds = function(){
    if(!ensureV5()) return {};
    const bounds={}; vLocs().forEach(l=>{ bounds[l.id]={x:l.x,y:l.y,w:Math.max(430,l.w||430),h:Math.max(205,l.h||205)}; }); V().proBounds=bounds; return bounds;
  };

  function init(){
    injectV5Controls();
    document.addEventListener('click', e=>{
      if(e.target.closest('[data-tab="graphs-v5"], [data-step="graphs"]')) setTimeout(injectV5Controls,100);
    });
  }
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
