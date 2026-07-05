/* =========================================================
   NetWizard Unified Config Map v1.8
   Mapa único dentro de Configuración que mezcla:
   - Grafo NetWizard tradicional: red, puertos, hosts, VLANs.
   - Capa IoT embebida: infraestructura, gateways y endpoints IoT.

   Objetivo: que el mapa de configuración sea el punto visual común
   para filtrar, inspeccionar y editar dispositivos de toda la red.
========================================================= */
(function(){
  'use strict';
  const $ = id => document.getElementById(id);
  const esc = s => { const sec=window.NetWizardSecurityUtils||window.NetWizardCoreUtils; return sec&&typeof sec.escapeHtml==='function'?sec.escapeHtml(s):String(s ?? '').replace(/[&<>'"]/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[m])); };
  const SK = 'nw_unified_config_map_v1';
  const COLORS = {
    network:'#3b82f6', router:'#10b981', firewall:'#ef4444', switch:'#3b82f6',
    endpoint:'#8b5cf6', host:'#8b5cf6', port:'#4d6580', access:'#06b6d4', iot:'#10b981', selected:'#f59e0b', link:'#8fa3c0', iotLink:'#06b6d4'
  };
  const ICONS = {switch:'🔀',router:'🌐',firewall:'🛡',endpoint:'🖥',iot_candidate:'🔌',port:'🔌',wifi_ap:'📶',lorawan_gateway:'📡',zigbee_coordinator:'🟣',thread_border_router:'🕸',ble_gateway:'🔵',mqtt_broker:'🛰',home_assistant:'🏠',nvr:'🎥',cloud_api:'☁️',generic_gateway:'🌉',sensor:'🌡',camera:'📷',meter:'⚡',plug:'🔌',light:'💡',lock:'🔐',thermostat:'♨️',actuator:'⚙️',other:'📦'};
  const TECH_LABELS = {wifi:'Wi‑Fi',ethernet:'Ethernet',lora:'LoRaWAN',zigbee:'Zigbee',thread:'Thread/Matter',ble:'BLE',mqtt:'MQTT',camera:'Cámara/NVR',cloud:'Cloud/API',controller:'Controlador',generic:'Genérico'};
  let canvas, ctx;
  let hits = [];
  let drag = null;
  let view = loadView();

  function loadView(){
    const base={panX:0,panY:0,scale:1,selected:null,filters:{network:true,switch:true,router:true,firewall:true,endpoints:true,ports:false,access:true,iot:true,wifi:true,lora:true,zigbee:true,thread:true,ble:true,mqtt:true,camera:true,cloud:true}};
    try{return {...base,...JSON.parse(localStorage.getItem(SK)||'{}'),filters:{...base.filters,...(JSON.parse(localStorage.getItem(SK)||'{}').filters||{})}};}catch{return base;}
  }
  function saveView(){localStorage.setItem(SK,JSON.stringify(view));}
  function bridgeGraph(){try{return (window.NetWizardBridge&&NetWizardBridge.makeUnifiedGraph&&NetWizardBridge.makeUnifiedGraph())||{nodes:[],links:[],segments:[]};}catch(e){return {nodes:[],links:[],segments:[],warnings:[String(e)]};}}
  function iotState(){try{return (window.NetWizardIoTEmbedded&&NetWizardIoTEmbedded.getState&&NetWizardIoTEmbedded.getState())||{accessNodes:[],devices:[]};}catch(e){return {accessNodes:[],devices:[],warnings:[String(e)]};}}
  function accessType(a){const map={wifi_ap:['Access Point Wi‑Fi','wifi'],lorawan_gateway:['Gateway LoRaWAN','lora'],zigbee_coordinator:['Coordinador Zigbee','zigbee'],thread_border_router:['Thread Border Router','thread'],ble_gateway:['Gateway BLE','ble'],mqtt_broker:['Broker MQTT','mqtt'],home_assistant:['Home Assistant','controller'],nvr:['NVR/VMS','camera'],cloud_api:['Cloud/API','cloud'],generic_gateway:['Gateway genérico','generic']};return map[a?.type]||map.generic_gateway;}
  function segLabel(ref, graph){const s=(graph.segments||[]).find(x=>x.ref===ref||x.vlanRef===ref||x.id===ref);if(!s)return '—';const n=s.vlanNumber||s.vlanId||'';return `${s.name||'VLAN'}${n?' VLAN '+n:''}${s.subnet?' · '+s.subnet:''}`;}
  function nodeById(id, nodes){return nodes.find(n=>n.id===id);}

  function ensureCard(){
    if($('nwuCard')) return;
    const slot = $('nwuGraphSlot');
    const cfg = slot || $('pg-graphs') || $('pg-cfg');
    if(!cfg) return;
    const leftCol = slot || cfg.querySelector('.g2 > div:first-child') || cfg;
    const firstCard = leftCol.querySelector('.card');
    const card = document.createElement('div');
    card.className='card nwu-card';
    card.id='nwuCard';
    const header = document.createElement('div'); header.className = 'card-h';
    const title = document.createElement('div'); title.className = 'card-t'; title.textContent = '🧭 Mapa único de configuración · Red + IoT'; header.appendChild(title);
    const summary = document.createElement('div'); summary.className = 'nwu-summary'; summary.id = 'nwuSummary'; summary.textContent = '—'; header.appendChild(summary);
    card.appendChild(header);
    const toolbar = document.createElement('div'); toolbar.className = 'nwu-toolbar';
    [['nwuRefresh','↻ Actualizar','btn bs bsm'],['nwuFit','⊞ Centrar','btn bs bsm'],['nwuAddIoTAccess','➕ Infraestructura IoT','btn bp bsm'],['nwuAddIoTDevice','➕ Dispositivo IoT','btn bp bsm']].forEach(([id,label,cls]) => { const b = document.createElement('button'); b.id = id; b.className = cls; b.type = 'button'; b.textContent = label; toolbar.appendChild(b); });
    card.appendChild(toolbar);
    const filters = document.createElement('div'); filters.className = 'nwu-filterbar'; filters.id = 'nwuFilters';
    [['network','Red'],['switch','Switch'],['router','Router'],['firewall','Firewall'],['endpoints','Hosts'],['ports','Puertos'],['access','Infra IoT'],['iot','IoT'],['wifi','Wi‑Fi'],['lora','LoRa'],['zigbee','Zigbee'],['thread','Thread'],['mqtt','MQTT'],['camera','Cámara']].forEach(([k,label]) => filters.appendChild(filter(k,label)));
    card.appendChild(filters);
    const layout = document.createElement('div'); layout.className = 'nwu-layout';
    const canvasWrap = document.createElement('div'); canvasWrap.className = 'nwu-canvas-wrap';
    const canvasEl = document.createElement('canvas'); canvasEl.id = 'nwuConfigCanvas'; canvasWrap.appendChild(canvasEl); layout.appendChild(canvasWrap);
    const panel = document.createElement('div'); panel.className = 'nwu-panel'; panel.id = 'nwuDetails';
    const h3 = document.createElement('h3'); h3.textContent = 'Selecciona un nodo'; panel.appendChild(h3);
    const legend = document.createElement('div'); legend.className = 'nwu-legend';
    [['#3b82f6','Red'],['#06b6d4','Infra IoT'],['#10b981','Dispositivo IoT'],['#8b5cf6','Host']].forEach(([color,label]) => { const sp = document.createElement('span'); sp.className = 'nwu-dot'; sp.style.setProperty('--c', color); sp.textContent = label; legend.appendChild(sp); });
    panel.appendChild(legend);
    const mini = document.createElement('div'); mini.className = 'nwu-mini'; mini.textContent = 'El mapa muestra la red tradicional y la capa IoT en un único lienzo. Usa los filtros para aislar tecnologías y haz clic en nodos IoT para editarlos.'; panel.appendChild(mini);
    layout.appendChild(panel);
    card.appendChild(layout);
    if(slot) slot.appendChild(card); else if(firstCard && firstCard.nextSibling) leftCol.insertBefore(card, firstCard.nextSibling); else leftCol.appendChild(card);
    canvas=$('nwuConfigCanvas'); ctx=canvas.getContext('2d');
    $('nwuRefresh').addEventListener('click',render);
    $('nwuFit').addEventListener('click',()=>{view.panX=0;view.panY=0;view.scale=1;view.selected=null;saveView();render();});
    $('nwuAddIoTAccess').addEventListener('click',()=>window.NetWizardIoTEmbedded?.openAccess?.());
    $('nwuAddIoTDevice').addEventListener('click',()=>window.NetWizardIoTEmbedded?.openDevice?.());
    $('nwuFilters').addEventListener('change',e=>{const cb=e.target.closest('input[data-nwu-filter]');if(!cb)return;view.filters[cb.dataset.nwuFilter]=cb.checked;saveView();render();});
    canvas.addEventListener('click',onClick);
    canvas.addEventListener('wheel',onWheel,{passive:false});
    canvas.addEventListener('mousedown',onDown);
    window.addEventListener('mousemove',onMove);
    window.addEventListener('mouseup',onUp);
    $('nwuDetails').addEventListener('click',onDetailsClick);
    syncFilterInputs();
  }
  function filter(k,label){ const wrap = document.createElement('label'); const input = document.createElement('input'); input.type = 'checkbox'; input.dataset.nwuFilter = k; wrap.appendChild(input); wrap.appendChild(document.createTextNode(' '+label)); return wrap; }
  function syncFilterInputs(){document.querySelectorAll('[data-nwu-filter]').forEach(cb=>cb.checked=view.filters[cb.dataset.nwuFilter]!==false);}

  function buildUnifiedMap(){
    const g=bridgeGraph(); const iot=iotState(); const nodes=[]; const links=[];
    const add=n=>{if(n && n.id && !nodes.some(x=>x.id===n.id))nodes.push(n);};
    const netNodes=(g.nodes||[]).filter(n=>n.kind==='network');
    const portNodes=(g.nodes||[]).filter(n=>n.kind==='port');
    const endpointNodes=(g.nodes||[]).filter(n=>n.kind==='endpoint'||n.kind==='iot_candidate');

    netNodes.forEach(n=>{if(!view.filters.network) return; if(view.filters[n.type]===false) return; add({id:n.id,layer:'net',kind:'network',type:n.type||'network',label:n.name||n.id,icon:ICONS[n.type]||'🖧',ref:n});});
    if(view.filters.ports){portNodes.forEach(n=>add({id:n.id,layer:'net',kind:'port',type:'port',label:n.name||'port',icon:ICONS.port,ref:n,parentNodeId:n.parentNodeId}));}
    if(view.filters.endpoints){endpointNodes.forEach(n=>{const typ=n.kind==='iot_candidate'?'iot_candidate':'endpoint';add({id:n.id,layer:'net',kind:typ,type:n.type||typ,label:n.name||n.id,icon:ICONS[n.type]||ICONS[typ]||'🖥',ref:n});});}

    (g.links||[]).forEach(l=>{
      if(l.kind==='contains'&&!view.filters.ports) return;
      if(nodeExists(l.from,nodes)&&nodeExists(l.to,nodes)) links.push({...l,layer:'net'});
    });
    if(view.filters.endpoints){endpointNodes.forEach(h=>{if(h.connectedDeviceId && nodeExists(h.id,nodes)&&nodeExists(h.connectedDeviceId,nodes)) links.push({id:'hostlink_'+h.id,from:h.connectedDeviceId,to:h.id,kind:h.kind==='iot_candidate'?'iot_candidate_access':'endpoint_access',label:h.kind==='iot_candidate'?'iot':'host',layer:'net'});});}

    (iot.accessNodes||[]).forEach(a=>{
      const [label,tech]=accessType(a);
      if(!view.filters.access) return; if(view.filters[tech]===false) return;
      add({id:a.id,layer:'iot',kind:'access',type:a.type,label:a.name||label,icon:ICONS[a.type]||'🌉',tech,ref:a});
      if(a.parentDeviceId && nodeExists(a.parentDeviceId,nodes)) links.push({id:'access_parent_'+a.id,from:a.parentDeviceId,to:a.id,kind:'physical_iot_access',label:a.parentPortId?'uplink puerto':'uplink',layer:'iot'});
      if(view.filters.ports && a.parentPortId && nodeExists(a.parentPortId,nodes)) links.push({id:'access_port_'+a.id,from:a.parentPortId,to:a.id,kind:'physical_iot_access',label:'puerto',layer:'iot'});
    });
    (iot.devices||[]).forEach(d=>{
      if(!view.filters.iot) return; if(view.filters[d.tech]===false) return; if(d.type==='camera'&&view.filters.camera===false) return;
      add({id:d.id,layer:'iot',kind:'iot',type:d.type||'iot',label:d.name||'IoT',icon:ICONS[d.type]||'🔌',tech:d.tech,ref:d});
      if(d.accessNodeId && nodeExists(d.accessNodeId,nodes)) links.push({id:'iot_access_'+d.id,from:d.accessNodeId,to:d.id,kind:'iot_radio',label:TECH_LABELS[d.tech]||d.tech,layer:'iot'});
    });
    return {graph:g,iot,nodes,links};
  }
  function nodeExists(id,nodes){return nodes.some(n=>n.id===id);}

  function layout(map,w,h){
    const pos=new Map();
    const net=map.nodes.filter(n=>n.kind==='network');
    const ports=map.nodes.filter(n=>n.kind==='port');
    const access=map.nodes.filter(n=>n.kind==='access');
    const iots=map.nodes.filter(n=>n.kind==='iot');
    const endpoints=map.nodes.filter(n=>n.kind==='endpoint'||n.kind==='iot_candidate');
    net.forEach((n,i)=>pos.set(n.id,{x:110+(i%2)*150,y:90+Math.floor(i/2)*95,r:28}));
    ports.forEach((n,i)=>{const p=pos.get(n.parentNodeId);pos.set(n.id,p?{x:p.x+((i%8)-3.5)*12,y:p.y+38+Math.floor(i/8)*10,r:7}:{x:70+(i%10)*48,y:h-38,r:7});});
    access.forEach((n,i)=>pos.set(n.id,{x:w*0.47+(i%2)*120,y:95+Math.floor(i/2)*105,r:27}));
    iots.forEach((n,i)=>pos.set(n.id,{x:w*0.75+(i%3)*92,y:120+Math.floor(i/3)*88,r:23}));
    endpoints.forEach((n,i)=>pos.set(n.id,{x:150+(i%4)*105,y:h-105+Math.floor(i/4)*56,r:n.kind==='iot_candidate'?18:16}));
    return pos;
  }

  function resize(){
    if(!canvas||!ctx)return {w:900,h:520};
    const wrap=canvas.parentElement; const r=wrap.getBoundingClientRect(); const dpr=window.devicePixelRatio||1;
    const w=Math.max(560,Math.floor(r.width||900)); const h=Math.max(360,Math.floor(r.height||520));
    canvas.width=Math.floor(w*dpr); canvas.height=Math.floor(h*dpr); canvas.style.width=w+'px'; canvas.style.height=h+'px'; ctx.setTransform(dpr,0,0,dpr,0,0);
    return {w,h};
  }
  function render(){
    ensureCard(); if(!canvas||!ctx)return;
    const {w,h}=resize(); const map=buildUnifiedMap(); const pos=layout(map,w,h); hits=[];
    ctx.clearRect(0,0,w,h); ctx.fillStyle='#07090f'; ctx.fillRect(0,0,w,h);
    drawBands(map.graph,w,h);
    ctx.save(); ctx.translate(view.panX||0,view.panY||0); ctx.scale(view.scale||1,view.scale||1);
    map.links.forEach(l=>drawLink(l,pos));
    map.nodes.forEach(n=>drawNode(n,pos.get(n.id)));
    ctx.restore();
    updateSummary(map); updateDetails(map,pos);
  }
  function drawBands(graph,w,h){
    const segs=(graph.segments||[]).slice(0,7); if(!segs.length)return;
    segs.forEach((s,i)=>{ctx.globalAlpha=.10;ctx.fillStyle=s.color||'#3b82f6';ctx.fillRect(10,10+i*25,w-20,20);ctx.globalAlpha=1;ctx.fillStyle='#8fa3c0';ctx.font='10px Space Grotesk, sans-serif';ctx.fillText(`${s.vlanNumber||s.vlanId||''} · ${s.name||'VLAN'}${s.subnet?' · '+s.subnet:''}`,18,24+i*25);});
  }
  function drawLink(l,pos){const a=pos.get(l.from),b=pos.get(l.to);if(!a||!b)return;ctx.beginPath();ctx.moveTo(a.x,a.y);const mid=(a.x+b.x)/2;ctx.bezierCurveTo(mid,a.y,mid,b.y,b.x,b.y);ctx.strokeStyle=l.layer==='iot'?COLORS.iotLink:COLORS.link;ctx.globalAlpha=l.kind==='contains'?.22:.74;ctx.lineWidth=l.layer==='iot'?2.2:1.4;ctx.stroke();ctx.globalAlpha=1;ctx.fillStyle='#8fa3c0';ctx.font='10px Space Grotesk, sans-serif';ctx.fillText(String(l.label||'').slice(0,22),(a.x+b.x)/2,(a.y+b.y)/2-5);}
  function colorFor(n){if(n.kind==='access')return COLORS.access;if(n.kind==='iot')return COLORS.iot;if(n.kind==='port')return COLORS.port;if(n.kind==='endpoint'||n.kind==='iot_candidate')return COLORS.endpoint;if(n.type==='router')return COLORS.router;if(n.type==='firewall')return COLORS.firewall;return COLORS.network;}
  function drawNode(n,p){if(!p)return;const selected=view.selected===n.id;ctx.beginPath();ctx.arc(p.x,p.y,selected?p.r+5:p.r,0,Math.PI*2);ctx.fillStyle=colorFor(n);ctx.globalAlpha=selected?1:.92;ctx.fill();ctx.globalAlpha=1;ctx.lineWidth=selected?3:1.2;ctx.strokeStyle=selected?COLORS.selected:'#2a3547';ctx.stroke();ctx.fillStyle='#e2eaf7';ctx.textAlign='center';ctx.textBaseline='middle';ctx.font=n.kind==='port'?'10px sans-serif':'20px sans-serif';ctx.fillText(n.icon||'●',p.x,p.y-1);ctx.font='11px Space Grotesk, sans-serif';ctx.fillStyle='#8fa3c0';ctx.fillText(short(n.label,20),p.x,p.y+p.r+13);ctx.textAlign='left';hits.push({...n,x:p.x,y:p.y,r:p.r});}
  function short(s,n){s=String(s||'');return s.length>n?s.slice(0,n-1)+'…':s;}

  function updateSummary(map){const el=$('nwuSummary');if(!el)return;const count=k=>map.nodes.filter(n=>n.kind===k).length;el.textContent=`${count('network')} red · ${count('access')} accesos IoT · ${count('iot')} IoT · ${map.links.length} enlaces`;}
  function makeEl(tag, cls, text){ const el=document.createElement(tag); if(cls)el.className=cls; if(text!==undefined)el.textContent=String(text); return el; }
  function addBadge(parent, cls, text){ parent.appendChild(makeEl('span','b '+cls,text)); }
  function addKv(parent,obj){ const box=makeEl('div','nwu-kv'); Object.entries(obj).forEach(([k,v])=>{ box.appendChild(makeEl('b','',k)); box.appendChild(makeEl('span','',v)); }); parent.appendChild(box); }
  function addAction(parent, cls, text, dataName, value){ const btn=makeEl('button','btn '+cls+' bsm',text); btn.type='button'; if(dataName)btn.dataset[dataName]=String(value||''); parent.appendChild(btn); }
  function renderEmptyDetails(el){
    el.textContent='';
    el.appendChild(makeEl('h3','', 'Selecciona un nodo'));
    const legend=makeEl('div','nwu-legend');
    [['#3b82f6','Red'],['#06b6d4','Infra IoT'],['#10b981','Dispositivo IoT'],['#8b5cf6','Host']].forEach(([c,t])=>{ const s=makeEl('span','nwu-dot',t); s.style.setProperty('--c',c); legend.appendChild(s); });
    el.appendChild(legend);
    el.appendChild(makeEl('div','nwu-mini','Filtra por tipo o tecnología y haz clic en un nodo para ver detalles. Los nodos IoT se pueden editar directamente desde aquí.'));
  }
  function updateDetails(map){
    const el=$('nwuDetails');if(!el)return;
    const n=map.nodes.find(x=>x.id===view.selected);
    if(!n){renderEmptyDetails(el);return;}
    el.textContent='';
    el.appendChild(makeEl('h3','',`${n.icon||''} ${n.label||''}`));
    const tags=makeEl('div','devtags'); addBadge(tags,'bcy',n.kind); addBadge(tags,'bgr',n.type||''); if(n.tech)addBadge(tags,'bac',TECH_LABELS[n.tech]||n.tech); el.appendChild(tags);
    if(n.kind==='access'){
      const a=n.ref||{}; const [label]=accessType(a);
      addKv(el,{Tipo:label,Vendor:`${a.vendor||'generic'} ${a.model||''}`,Gestión:`${a.mgmtIp||'—'} · ${segLabel(a.mgmtVlanRef,map.graph)}`,Conexión:a.parentDeviceId||a.parentPortId?`${netName(a.parentDeviceId,map)} ${a.parentPortId?' / '+netPortName(a.parentPortId,map):''}`:'—',Servicio:`${a.serviceName||'—'} · ${segLabel(a.serviceVlanRef,map.graph)}`,Notas:a.notes||'—'});
      const brow=makeEl('div','brow'); addAction(brow,'bp','Editar infraestructura','nwuEditAccess',a.id); addAction(brow,'bs','Ir a IoT & Gateways','nwuGoIot','1'); el.appendChild(brow);
    } else if(n.kind==='iot') {
      const d=n.ref||{}; const access=(map.iot.accessNodes||[]).find(a=>a.id===d.accessNodeId);
      addKv(el,{Tipo:d.type||'IoT',Tecnología:TECH_LABELS[d.tech]||d.tech,VLAN:segLabel(d.vlanRef,map.graph),Acceso:access?access.name:'—',Identificador:d.identifier||'—',Credencial:d.credentialAlias||'—',Notas:d.notes||'—'});
      const brow=makeEl('div','brow'); addAction(brow,'bp','Editar dispositivo','nwuEditDevice',d.id); addAction(brow,'bs','Ir a IoT & Gateways','nwuGoIot','1'); el.appendChild(brow);
    } else {
      const ref=n.ref||{};
      addKv(el,{Nombre:n.label,Tipo:n.type||n.kind,Capa:n.layer,ID:n.id,VLAN:ref.vlanName||ref.vlanRef||'—',IP:ref.ip||ref.mgmtIp||ref.staticIp||'—'});
      const pre=makeEl('pre','mono',JSON.stringify(ref,null,2).slice(0,1600)); pre.style.whiteSpace='pre-wrap'; pre.style.color='var(--t2)'; pre.style.fontSize='10.5px'; pre.style.maxHeight='220px'; pre.style.overflow='auto'; el.appendChild(pre);
    }
  }
  function netName(id,map){return (map.nodes.find(n=>n.id===id)||{}).label||id||'—';}
  function netPortName(id,map){return (map.nodes.find(n=>n.id===id)||{}).label||id||'—';}

  function onDetailsClick(e){const a=e.target.closest('[data-nwu-edit-access]');if(a){window.NetWizardIoTEmbedded?.openAccess?.(a.dataset.nwuEditAccess);return;}const d=e.target.closest('[data-nwu-edit-device]');if(d){window.NetWizardIoTEmbedded?.openDevice?.(d.dataset.nwuEditDevice);return;}if(e.target.closest('[data-nwu-go-iot]')){try{navTo('iot');}catch(_){document.querySelector('[data-step="iot"]')?.click();}}}
  function point(e){const r=canvas.getBoundingClientRect();return {x:(e.clientX-r.left-(view.panX||0))/(view.scale||1),y:(e.clientY-r.top-(view.panY||0))/(view.scale||1)};}
  function onClick(e){if(drag&&drag.moved)return;const p=point(e);const n=hits.slice().reverse().find(h=>Math.hypot(h.x-p.x,h.y-p.y)<=h.r+7);view.selected=n?n.id:null;saveView();render();}
  function onWheel(e){e.preventDefault();const before=point(e);const old=view.scale||1;const next=Math.max(.45,Math.min(2.4,old*(e.deltaY<0?1.08:.92)));view.scale=next;view.panX=e.clientX-canvas.getBoundingClientRect().left-before.x*next;view.panY=e.clientY-canvas.getBoundingClientRect().top-before.y*next;saveView();render();}
  function onDown(e){if(!canvas)return;drag={x:e.clientX,y:e.clientY,px:view.panX||0,py:view.panY||0,moved:false};canvas.classList.add('dragging');}
  function onMove(e){if(!drag)return;if(Math.hypot(e.clientX-drag.x,e.clientY-drag.y)>4)drag.moved=true;view.panX=drag.px+e.clientX-drag.x;view.panY=drag.py+e.clientY-drag.y;render();}
  function onUp(){if(!drag)return;drag=null;canvas?.classList.remove('dragging');saveView();}

  function init(){ensureCard();render();window.addEventListener('resize',()=>setTimeout(render,60));document.addEventListener('click',e=>{if(e.target.closest('[data-step="graphs"], .bnit[data-step="graphs"]'))setTimeout(render,180);});document.addEventListener('nw:iot:changed',()=>setTimeout(render,40));}
  window.NetWizardUnifiedConfigMap={init,render,buildUnifiedMap};
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})();
