/* =========================================================
   NetWizard v2.8.1 - V5 Tree Block Layout Hotfix
   - Base estable v2.7: no toca netwizard.js ni drawV5().
   - Añade layout "Árbol · bloques por puerto" sin reescribir el motor V5.
   - Cada ubicación se calcula como bloques verticales:
     [router/switch/AP] a la izquierda + hosts asociados en UNA columna a la derecha.
   - Las ubicaciones raíz se colocan por árbol de conectividad con separación garantizada.
   - Auditoría Unificada conserva controles de layout.
========================================================= */
(function(){
  'use strict';

  const SK = 'netwizard_v5_layout_manager_v29';
  const UNIFIED_MANUAL_SK = 'netwizard_unified_manual_positions_v29';
  const UNIFIED_VIEW_SK = 'netwizard_unified_view_v30';
  let unifiedHits=[];
  let unifiedDrag=null;
  let unifiedPanDrag=null;
  let unifiedSelection=null;
  let unifiedInteractionReady=false;
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
  function clearEl(el){ while(el && el.firstChild) el.removeChild(el.firstChild); return el; }
  function txt(value){ return document.createTextNode(String(value ?? '')); }
  function el(tag, className, text){
    const node=document.createElement(tag);
    if(className) node.className=className;
    if(text !== undefined) node.textContent=String(text ?? '');
    return node;
  }
  function addKv(parent, key, value){
    const b=el('b', '', key);
    const span=el('span', '', value);
    parent.appendChild(b); parent.appendChild(span);
  }
  function addOption(select, value, label, selected){
    const opt=document.createElement('option');
    opt.value=String(value ?? ''); opt.textContent=String(label ?? value ?? '');
    if(selected) opt.selected=true;
    select.appendChild(opt);
  }
  function S(){
    try{ if(window.NetWizardState?.getSnapshot) return window.NetWizardState.getSnapshot() || {}; }catch(e){}
    try{ if(window.NetWizardBridge?.getProjectSnapshot){ const snap=window.NetWizardBridge.getProjectSnapshot(); if(snap?.ok) return snap.project || {}; } }catch(e){}
    return window.S || {};
  }
  function V(){ return typeof window.vv === 'function' ? window.vv() : null; }
  function safe(fn, fallback){ try{return fn();}catch(e){ console.warn('[V5 layout manager v2.8.1]', e); return fallback; } }
  function readCfg(){ try{return {...{v5Mode:'treeBlocks',unifiedMode:'treeBlocks'},...JSON.parse(localStorage.getItem(SK)||'{}')};}catch{return {v5Mode:'treeBlocks',unifiedMode:'treeBlocks'};} }
  function saveCfg(cfg){ localStorage.setItem(SK, JSON.stringify(cfg)); }
  function cfg(){ return readCfg(); }
  function byName(a,b){ return String(a?.name||a?.label||a?.id||'').localeCompare(String(b?.name||b?.label||b?.id||''), undefined, {numeric:true,sensitivity:'base'}); }

  function ensureV5(){ if(typeof window.vv !== 'function' || typeof window.vLocs !== 'function') return false; const v=V(); if(!v.layoutManager) v.layoutManager={}; return true; }
  function devById(id){ return (S().devices||[]).find(d=>d.id===id); }
  function portById(id){ return (S().ports||[]).find(p=>p.id===id); }
  function visibleDevsInLoc(locId){ return safe(()=>window.devsInVisualLoc(locId).slice().sort(deviceOrder), []); }
  function visibleHostsInLoc(locId){ return safe(()=>window.hostsInVisualLoc(locId).slice().sort(hostOrder), []); }
  function vLocs(){ return safe(()=>window.vLocs(), []); }
  function vLocById(id){ return safe(()=>window.vLocById(id), null); }
  function vLocRoots(){ return safe(()=>window.vLocRoots(), vLocs().filter(l=>!l.parentId)); }
  function vLocChildren(id){ return safe(()=>window.vLocChildren(id).slice().sort(byName), []); }
  function vLocDepth(id){ return safe(()=>window.vLocDepth(id), 0); }
  function deviceVisualLoc(id){ return safe(()=>window.deviceVisualLoc(id), '') || ''; }
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

  function injectUnifiedControls(){
    const tryInject = () => {
      const toolbar = document.querySelector('#nwuCard .nwu-toolbar');
      if(!toolbar || $('nwuLayoutMode')) return false;
      const cfg0 = cfg();
      const span = document.createElement('span');
      span.className = 'nwu-layout-controls';
      const select = document.createElement('select');
      select.id='nwuLayoutMode'; select.className='v5-layout-select'; select.title='Algoritmo de ordenación Auditoría Unificada';
      Object.entries(MODES).forEach(([k,v])=>addOption(select,k,v,cfg0.unifiedMode===k));
      const button = document.createElement('button');
      button.className='btn bp bsm'; button.id='nwuApplyLayout'; button.type='button'; button.textContent='🧠 Ordenar auditoría';
      span.appendChild(select); span.appendChild(button);
      toolbar.insertBefore(span, toolbar.firstChild);
      $('nwuLayoutMode')?.addEventListener('change', e=>{const c=cfg(); c.unifiedMode=e.target.value; saveCfg(c); renderUnifiedManaged();});
      $('nwuApplyLayout')?.addEventListener('click', renderUnifiedManaged);
      return true;
    };
    if(!tryInject()) setTimeout(tryInject, 300);
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
  function rootOfLocId(id){
    let loc=vLocById(id), guard=0;
    while(loc && loc.parentId && guard++<20){ loc=vLocById(loc.parentId); }
    return loc ? loc.id : id;
  }

  function buildRootGraph(){
    const roots = vLocRoots();
    const rootIds = new Set(roots.map(l=>l.id));
    const adj = new Map(roots.map(l=>[l.id,new Set()]));
    for(const lk of (S().links||[])){
      const a=portById(lk.aPortId), b=portById(lk.bPortId); if(!a||!b) continue;
      const da=devById(a.deviceId), db=devById(b.deviceId); if(!da||!db) continue;
      const la=rootOfLocId(deviceVisualLoc(da.id)), lb=rootOfLocId(deviceVisualLoc(db.id));
      if(!la||!lb||la===lb||!rootIds.has(la)||!rootIds.has(lb)) continue;
      if(!adj.has(la)) adj.set(la,new Set()); if(!adj.has(lb)) adj.set(lb,new Set());
      adj.get(la).add(lb); adj.get(lb).add(la);
    }
    return {roots, adj};
  }

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
    safe(()=>window.drawV5(), null);
    safe(()=>window.renderV5Panel(), null);
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

  // ───────── Auditoría Unificada ─────────
  function readUnifiedManual(){try{return JSON.parse(localStorage.getItem(UNIFIED_MANUAL_SK)||'{}');}catch{return {};}}
  function writeUnifiedManual(m){localStorage.setItem(UNIFIED_MANUAL_SK,JSON.stringify(m||{}));}
  function applyUnifiedManual(pos){const m=readUnifiedManual(); Object.entries(m).forEach(([id,p])=>{if(pos.has(id)&&Number.isFinite(p.x)&&Number.isFinite(p.y))pos.set(id,{...pos.get(id),x:p.x,y:p.y});});}
  function readUnifiedView(){try{return {...{panX:0,panY:0,scale:1},...JSON.parse(localStorage.getItem(UNIFIED_VIEW_SK)||'{}')};}catch{return {panX:0,panY:0,scale:1};}}
  function writeUnifiedView(v){localStorage.setItem(UNIFIED_VIEW_SK,JSON.stringify(v||{panX:0,panY:0,scale:1}));}
  function getProjectLocations(){
    try{const snap=window.NetWizardBridge?.getProjectSnapshot?.(); const locs=snap?.project?.physicalLocations; if(Array.isArray(locs)&&locs.length)return locs;}catch(e){}
    try{const raw=localStorage.getItem('nwp_v4'); const p=raw?JSON.parse(raw):null; if(Array.isArray(p?.physicalLocations)&&p.physicalLocations.length)return p.physicalLocations;}catch(e){}
    return [];
  }
  function locLabelById(id){const l=getProjectLocations().find(x=>x.id===id);return l?l.name:'';}
  function nodeLocationKey(n){
    const r=n?.ref||{};
    const id=r.locationId||r.meta?.locationId||r.meta?.physicalLocationId||'';
    const phys=r.physicalLocation||r.meta?.physicalLocation||'';
    if(id)return `id:${id}`;
    if(phys)return `name:${String(phys).trim().toLowerCase()}`;
    return 'unknown';
  }
  function nodeLocationLabel(key){
    if(key==='unknown')return 'Sin ubicación';
    if(key.startsWith('id:'))return locLabelById(key.slice(3))||'Ubicación';
    if(key.startsWith('name:'))return key.slice(5)||'Ubicación';
    return 'Ubicación';
  }
  function canvasPoint(canvas,e){
    const r=canvas.getBoundingClientRect();
    const v=readUnifiedView();
    return {x:(e.clientX-r.left-(v.panX||0))/(v.scale||1),y:(e.clientY-r.top-(v.panY||0))/(v.scale||1),screenX:e.clientX-r.left,screenY:e.clientY-r.top};
  }
  function findUnifiedHit(p){return unifiedHits.slice().reverse().find(h=>Math.hypot(h.x-p.x,h.y-p.y)<=h.r+8)||null;}
  function renderUnifiedDetails(node){
    const details=$('nwuDetails');
    if(!details)return;
    clearEl(details);
    if(!node){
      details.appendChild(el('h3','', 'Selecciona un nodo'));
      details.appendChild(el('div','nwu-mini','Puedes ordenar automáticamente, hacer zoom/pan y luego arrastrar nodos para ajuste fino. Las posiciones manuales quedan guardadas.'));
      return;
    }
    const ref=node.ref||{};
    const h3=document.createElement('h3');
    h3.appendChild(txt(node.icon||'●'));
    h3.appendChild(txt(' '));
    h3.appendChild(txt(node.label||node.id));
    details.appendChild(h3);
    const tags=el('div','devtags');
    tags.appendChild(el('span','b bcy',node.kind||''));
    tags.appendChild(el('span','b bgr',node.type||''));
    if(node.tech) tags.appendChild(el('span','b bac',node.tech));
    details.appendChild(tags);
    const kv=el('div','nwu-kv');
    addKv(kv,'ID',node.id||'');
    addKv(kv,'Capa',node.layer||'—');
    addKv(kv,'Ubicación',nodeLocationLabel(nodeLocationKey(node)));
    addKv(kv,'VLAN',ref.vlanName||ref.vlanRef||ref.serviceVlanRef||'—');
    addKv(kv,'IP',ref.ip||ref.mgmtIp||ref.staticIp||ref.identifier||'—');
    details.appendChild(kv);
  }
  function installUnifiedInteraction(){
    const canvas=$('nwuConfigCanvas');if(!canvas||unifiedInteractionReady)return;unifiedInteractionReady=true;
    canvas.addEventListener('wheel',e=>{
      e.preventDefault();e.stopImmediatePropagation();
      const r=canvas.getBoundingClientRect(); const mx=e.clientX-r.left, my=e.clientY-r.top; const v=readUnifiedView();
      const oldScale=v.scale||1; const next=Math.max(.35,Math.min(2.8,oldScale*(e.deltaY<0?1.08:.92)));
      const wx=(mx-(v.panX||0))/oldScale, wy=(my-(v.panY||0))/oldScale;
      v.scale=next; v.panX=mx-wx*next; v.panY=my-wy*next; writeUnifiedView(v); renderUnifiedManaged();
    },{capture:true,passive:false});
    canvas.addEventListener('mousedown',e=>{
      const p=canvasPoint(canvas,e);const hit=findUnifiedHit(p);
      if(hit){unifiedDrag={id:hit.id,dx:p.x-hit.x,dy:p.y-hit.y,moved:false};unifiedSelection=hit.id;renderUnifiedDetails(hit.node);} 
      else {const v=readUnifiedView();unifiedPanDrag={x:e.clientX,y:e.clientY,px:v.panX||0,py:v.panY||0};}
      e.preventDefault();e.stopImmediatePropagation();
    },true);
    window.addEventListener('mousemove',e=>{
      if(unifiedDrag){const p=canvasPoint(canvas,e);const m=readUnifiedManual();m[unifiedDrag.id]={x:p.x-unifiedDrag.dx,y:p.y-unifiedDrag.dy};writeUnifiedManual(m);unifiedDrag.moved=true;renderUnifiedManaged();e.preventDefault();e.stopImmediatePropagation();return;}
      if(unifiedPanDrag){const v=readUnifiedView();v.panX=unifiedPanDrag.px+e.clientX-unifiedPanDrag.x;v.panY=unifiedPanDrag.py+e.clientY-unifiedPanDrag.y;writeUnifiedView(v);renderUnifiedManaged();e.preventDefault();e.stopImmediatePropagation();}
    },true);
    window.addEventListener('mouseup',e=>{if(unifiedDrag||unifiedPanDrag){unifiedDrag=null;unifiedPanDrag=null;e.preventDefault();e.stopImmediatePropagation();}},true);
    canvas.addEventListener('click',e=>{const p=canvasPoint(canvas,e);const hit=findUnifiedHit(p);unifiedSelection=hit?hit.id:null;renderUnifiedDetails(hit?hit.node:null);renderUnifiedManaged();e.preventDefault();e.stopImmediatePropagation();},true);
  }
  function renderUnifiedManaged(){
    const api = window.NetWizardUnifiedConfigMap;
    const canvas = $('nwuConfigCanvas');
    if(!api || !api.buildUnifiedMap || !canvas) return;
    injectUnifiedControls();
    const ctx = canvas.getContext('2d');
    const wrap = canvas.parentElement; const r=wrap.getBoundingClientRect(); const dpr=window.devicePixelRatio||1;
    const w=Math.max(560,Math.floor(r.width||900)); const h=Math.max(380,Math.floor(r.height||520));
    canvas.width=Math.floor(w*dpr); canvas.height=Math.floor(h*dpr); canvas.style.width=w+'px'; canvas.style.height=h+'px'; ctx.setTransform(dpr,0,0,dpr,0,0);
    const map = api.buildUnifiedMap();
    const mode = $('nwuLayoutMode')?.value || cfg().unifiedMode || 'treeBlocks';
    const c=cfg(); c.unifiedMode=mode; saveCfg(c);
    const pos = unifiedLayout(map,w,h,mode);
    applyUnifiedManual(pos);
    unifiedHits=[]; installUnifiedInteraction();
    ctx.clearRect(0,0,w,h); ctx.fillStyle='#07090f'; ctx.fillRect(0,0,w,h);
    drawUnifiedBands(ctx,map.graph,w);
    const v=readUnifiedView();
    ctx.save(); ctx.translate(v.panX||0,v.panY||0); ctx.scale(v.scale||1,v.scale||1);
    map.links.forEach(l=>drawUnifiedLink(ctx,l,pos));
    map.nodes.forEach(n=>{const p=pos.get(n.id);drawUnifiedNode(ctx,n,p);if(p)unifiedHits.push({id:n.id,x:p.x,y:p.y,r:p.r||24,node:n});});
    ctx.restore();
    const summary=$('nwuSummary'); if(summary) summary.textContent=`${map.nodes.filter(n=>n.kind==='network').length} red · ${map.nodes.filter(n=>n.kind==='access').length} accesos IoT · ${map.nodes.filter(n=>n.kind==='iot').length} IoT · ${map.links.length} enlaces · ${MODES[mode]} · zoom ${Math.round((v.scale||1)*100)}%`;
  }
  window.renderUnifiedManaged = renderUnifiedManaged;

  function unifiedLayout(map,w,h,mode){
    const pos=new Map();
    const byLoc=new Map();
    const unknown='unknown';
    for(const n of map.nodes){
      const k=nodeLocationKey(n)||unknown;
      if(!byLoc.has(k)) byLoc.set(k,[]);
      byLoc.get(k).push(n);
    }
    const locEntries=[...byLoc.entries()].sort((a,b)=>nodeLocationLabel(a[0]).localeCompare(nodeLocationLabel(b[0]),'es',{numeric:true,sensitivity:'base'}));
    if(mode==='radial'){
      const cx=w*.5,cy=h*.5; let ring=0;
      for(const [key,nodes] of locEntries){
        const rad=120+ring*95; nodes.sort(byName).forEach((n,i)=>{const a=(-Math.PI/2)+(i/Math.max(1,nodes.length))*Math.PI*2;pos.set(n.id,{x:cx+Math.cos(a)*rad,y:cy+Math.sin(a)*rad,r:n.kind==='network'?28:n.kind==='access'?25:n.kind==='iot'?20:16});}); ring++;
      }
      return pos;
    }
    const margin=70, gapX=90, gapY=120;
    const locBlocks=[];
    for(const [key,nodes] of locEntries){
      const network=nodes.filter(n=>n.kind==='network').sort((a,b)=>{const r={firewall:0,router:1,switch:2};return (r[a.type]??5)-(r[b.type]??5)||byName(a,b);});
      const access=nodes.filter(n=>n.kind==='access').sort(byName);
      const endpoints=nodes.filter(n=>n.kind==='endpoint'||n.kind==='iot_candidate').sort(byName);
      const iot=nodes.filter(n=>n.kind==='iot').sort(byName);
      const rows=Math.max(network.length, access.length, endpoints.length, iot.length, 1);
      locBlocks.push({key,network,access,endpoints,iot,rows,w:560,h:70+rows*54});
    }
    let x=margin,y=margin,rowH=0;
    for(const block of locBlocks){
      if(x+block.w>w-margin && x>margin){x=margin;y+=rowH+gapY;rowH=0;}
      block.x=x;block.y=y;rowH=Math.max(rowH,block.h);x+=block.w+gapX;
      const cols={network:x-block.w+70,access:x-block.w+210,endpoints:x-block.w+350,iot:x-block.w+485};
      block.network.forEach((n,i)=>pos.set(n.id,{x:cols.network,y:block.y+55+i*54,r:28}));
      block.access.forEach((n,i)=>pos.set(n.id,{x:cols.access,y:block.y+55+i*54,r:25}));
      block.endpoints.forEach((n,i)=>pos.set(n.id,{x:cols.endpoints,y:block.y+55+i*44,r:n.kind==='iot_candidate'?18:16}));
      block.iot.forEach((n,i)=>pos.set(n.id,{x:cols.iot,y:block.y+55+i*44,r:20}));
    }
    // Nodos sin ubicación se reparten en columnas si el modo no es por ubicación explícita.
    if(mode==='hierarchy'){
      const network=map.nodes.filter(n=>n.kind==='network').sort(byName);
      const access=map.nodes.filter(n=>n.kind==='access').sort(byName);
      const endpoints=map.nodes.filter(n=>n.kind==='endpoint'||n.kind==='iot_candidate').sort(byName);
      const iot=map.nodes.filter(n=>n.kind==='iot').sort(byName);
      const cols=[w*.12,w*.34,w*.58,w*.80];
      network.forEach((n,i)=>pos.set(n.id,{x:cols[0]+(n.type==='switch'?55:0),y:70+i*66,r:28}));
      access.forEach((n,i)=>pos.set(n.id,{x:cols[1],y:80+i*72,r:26}));
      endpoints.forEach((n,i)=>pos.set(n.id,{x:cols[2],y:80+i*50,r:n.kind==='iot_candidate'?18:16}));
      iot.forEach((n,i)=>pos.set(n.id,{x:cols[3],y:80+i*54,r:20}));
    }
    if(mode==='forceLite') unifiedForce(map.nodes,pos,w,h);
    return pos;
  }
  function unifiedForce(nodes,pos,w,h){
    for(let k=0;k<55;k++){
      for(let i=0;i<nodes.length;i++)for(let j=i+1;j<nodes.length;j++){
        const a=pos.get(nodes[i].id),b=pos.get(nodes[j].id);if(!a||!b)continue;const dx=a.x-b.x,dy=a.y-b.y,d=Math.max(1,Math.hypot(dx,dy));if(d<54){const p=(54-d)*.035;a.x+=dx/d*p;b.x-=dx/d*p;a.y+=dy/d*p;b.y-=dy/d*p;}
      }
      nodes.forEach(n=>{const p=pos.get(n.id);if(!p)return;p.x=Math.max(45,Math.min(w-45,p.x));p.y=Math.max(55,Math.min(h-45,p.y));});
    }
  }
  function drawUnifiedBands(ctx,map,w){const segs=(map.segments||[]).slice(0,6);segs.forEach((s,i)=>{ctx.globalAlpha=.08;ctx.fillStyle=s.color||'#3b82f6';ctx.fillRect(10,10+i*22,w-20,17);ctx.globalAlpha=1;ctx.fillStyle='#8fa3c0';ctx.font='10px Space Grotesk';ctx.fillText(`${s.vlanNumber||s.vlanId||''} · ${s.name||'VLAN'}`,18,22+i*22);});}
  function drawUnifiedLink(ctx,l,pos){const a=pos.get(l.from),b=pos.get(l.to);if(!a||!b)return;ctx.beginPath();ctx.moveTo(a.x,a.y);const mid=(a.x+b.x)/2;ctx.bezierCurveTo(mid,a.y,mid,b.y,b.x,b.y);ctx.strokeStyle=l.layer==='iot'?'#06b6d4':'#8fa3c0';ctx.globalAlpha=.62;ctx.lineWidth=l.layer==='iot'?2.1:1.25;ctx.stroke();ctx.globalAlpha=1;}
  function colorFor(n){if(n.kind==='access')return '#06b6d4';if(n.kind==='iot')return '#10b981';if(n.kind==='port')return '#4d6580';if(n.kind==='endpoint'||n.kind==='iot_candidate')return '#8b5cf6';if(n.type==='router')return '#10b981';if(n.type==='firewall')return '#ef4444';return '#3b82f6';}
  function drawUnifiedNode(ctx,n,p){if(!p)return;ctx.beginPath();ctx.arc(p.x,p.y,p.r,0,Math.PI*2);ctx.fillStyle=colorFor(n);ctx.fill();ctx.strokeStyle=unifiedSelection===n.id?'#f59e0b':'#2a3547';ctx.lineWidth=unifiedSelection===n.id?3:1.3;ctx.stroke();ctx.fillStyle='#e2eaf7';ctx.textAlign='center';ctx.textBaseline='middle';ctx.font='18px sans-serif';ctx.fillText(n.icon||'●',p.x,p.y-1);ctx.fillStyle='#8fa3c0';ctx.font='10px Space Grotesk';ctx.fillText(String(n.label||n.id).slice(0,18),p.x,p.y+p.r+13);ctx.textAlign='left';}

  function init(){
    injectV5Controls(); injectUnifiedControls(); setTimeout(injectUnifiedControls,600);
    document.addEventListener('click', e=>{
      if(e.target.closest('[data-tab="graphs-unified"]')) setTimeout(()=>{injectUnifiedControls(); renderUnifiedManaged();},250);
      if(e.target.closest('[data-tab="graphs-v5"], [data-step="graphs"]')) setTimeout(injectV5Controls,100);
    });
  }
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
