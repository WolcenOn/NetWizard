/* =========================================================
   NetWizard IoT Embedded v1.7
   Integra la capa IoT dentro de NetWizard sin reemplazar la
   lógica principal. Añade:
   - Infraestructura IoT: AP, LoRaWAN Gateway, Zigbee, Thread...
   - Dispositivos finales IoT.
   - Mapa unificado con filtros y selección visual.
========================================================= */
(function(){
  'use strict';
  const SK='nw_iot_embedded_v1';
  const $=id=>document.getElementById(id);
  const qsa=s=>Array.from(document.querySelectorAll(s));
  const uid=prefix=>`${prefix}_${Math.random().toString(36).slice(2,8)}${Date.now().toString(36).slice(-4)}`;
  const esc=s=>{const sec=root.NetWizardSecurityUtils||root.NetWizardCoreUtils;return sec&&typeof sec.escapeHtml==='function'?sec.escapeHtml(s):String(s??'').replace(/[&<>'"]/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[m]));};

  const ACCESS_TYPES={
    wifi_ap:{label:'Access Point Wi‑Fi',icon:'📶',tech:'wifi'},
    lorawan_gateway:{label:'Gateway LoRaWAN',icon:'📡',tech:'lora'},
    zigbee_coordinator:{label:'Coordinador Zigbee',icon:'🟣',tech:'zigbee'},
    thread_border_router:{label:'Thread Border Router',icon:'🕸',tech:'thread'},
    ble_gateway:{label:'Gateway BLE',icon:'🔵',tech:'ble'},
    mqtt_broker:{label:'Broker MQTT',icon:'🛰',tech:'mqtt'},
    home_assistant:{label:'Home Assistant / controlador',icon:'🏠',tech:'controller'},
    nvr:{label:'NVR / VMS',icon:'🎥',tech:'camera'},
    cloud_api:{label:'Cloud / API Platform',icon:'☁️',tech:'cloud'},
    generic_gateway:{label:'Gateway genérico',icon:'🌉',tech:'generic'}
  };
  const IOT_TYPES={sensor:'🌡 Sensor',camera:'📷 Cámara',meter:'⚡ Medidor',plug:'🔌 Enchufe',light:'💡 Luz',lock:'🔐 Cerradura',thermostat:'♨️ Termostato',actuator:'⚙️ Actuador',controller:'🏠 Controlador',other:'📦 Otro'};
  const TECHS={wifi:'Wi‑Fi',ethernet:'Ethernet',lora:'LoRaWAN',zigbee:'Zigbee',thread:'Thread/Matter',ble:'Bluetooth LE',mqtt:'MQTT',camera:'Cámara/NVR',cloud:'Cloud/API'};
  const VENDORS=['generic','unifi','galgus','huawei','aruba','cisco','mikrotik','tp_link_omada','ruckus','fortinet','sonoff','aqara','philips_hue','raspberry_pi','chirpstack','ttn','mosquitto','home_assistant','other'];
  function defaultState(){return {accessNodes:[],devices:[],map:{show:{network:true,port:false,access:true,iot:true,wifi:true,lora:true,zigbee:true,thread:true,mqtt:true},scale:1,panX:0,panY:0},selected:null};}
  let state=defaultState();
  let hit=[];let drag=null;

  function projectIotState(){
    try{
      const p=window.NetWizardState?.getSnapshot?.();
      return p?.iot && typeof p.iot==='object' ? p.iot : null;
    }catch(e){return null;}
  }
  function legacyIotState(){
    try{return JSON.parse(localStorage.getItem(SK)||'null');}
    catch(e){console.warn('IoT embedded legacy load error',e);return null;}
  }
  function mergeState(src){
    if(!src || typeof src!=='object')return;
    state={...defaultState(),...state,...src,map:{...defaultState().map,...state.map,...(src.map||{}),show:{...defaultState().map.show,...(state.map?.show||{}),...(src.map?.show||{})}}};
  }
  function load(){
    const embedded=projectIotState();
    const legacy=legacyIotState();
    mergeState(embedded || legacy);
    migrateLocationFields();
    if(!embedded && legacy) persistToProject({silent:true,source:'iot-legacy-migration'});
    seed();
  }
  function persistToProject(options={}){
    try{ window.NetWizardState?.updateProject?.({iot:JSON.parse(JSON.stringify(state))},{source:options.source||'iot',silent:options.silent,skipRefresh:true}); }
    catch(e){ console.warn('IoT embedded project save error',e); }
  }
  function save(){
    const snapshot=JSON.parse(JSON.stringify(state));
    localStorage.setItem(SK,JSON.stringify(snapshot));
    persistToProject({source:'iot'});
    document.dispatchEvent(new CustomEvent('nw:iot:changed',{detail:{source:'iot'}}));
  }
  function seed(){
    if(state.accessNodes.length||state.devices.length)return;
    state.accessNodes=[{id:uid('acc'),name:'AP IoT principal',type:'wifi_ap',vendor:'generic',model:'',mgmtIp:'',mgmtVlanRef:firstVlanRef(),parentDeviceId:'',parentPortId:'',locationId:'',physicalLocation:'',locationRole:'',serviceName:'IoT-Sensors',serviceVlanRef:firstIotVlanRef(),notes:'SSID IoT con aislamiento de clientes.'}];
    state.devices=[{id:uid('iot'),name:'Sensor temperatura',type:'sensor',tech:'wifi',accessNodeId:state.accessNodes[0].id,identifier:'',vlanRef:firstIotVlanRef(),locationId:'',physicalLocation:'',locationRole:'',credentialAlias:'wifi-iot-main',notes:''}];
    save();
  }

  function graph(){try{return (window.NetWizardBridge&&NetWizardBridge.makeUnifiedGraph&&NetWizardBridge.makeUnifiedGraph())||{nodes:[],links:[],segments:[]};}catch(e){return {nodes:[],links:[],segments:[],warnings:[String(e)]};}}
  function deviceNodes(){return (graph().nodes||[]).filter(n=>n.kind==='network');}
  function portNodes(){return (graph().nodes||[]).filter(n=>n.kind==='port');}
  function segments(){return (graph().segments||[]);}
  function firstVlanRef(){return segments()[0]?.ref||segments()[0]?.vlanRef||'';}
  function firstIotVlanRef(){const s=segments().find(x=>/iot|wifi|sensor|cámara|camera|lora/i.test(`${x.name} ${x.type}`));return (s?.ref||s?.vlanRef||firstVlanRef()||'');}
  function vlanName(ref){const s=segments().find(x=>x.ref===ref||x.vlanRef===ref||x.id===ref);return s?`${s.name}${s.vlanNumber||s.vlanId?` VLAN ${s.vlanNumber||s.vlanId}`:''}`:'—';}
  function devName(id){return deviceNodes().find(d=>d.id===id)?.name||'—';}
  function portName(id){const p=portNodes().find(p=>p.id===id);return p?`${p.name} · ${devName(p.parentNodeId)}`:'—';}
  function accessType(id){return ACCESS_TYPES[id]||ACCESS_TYPES.generic_gateway;}

  function clearNode(node){ if(node) node.textContent=''; return node; }
  function makeEl(tag, cls, text){ const el=document.createElement(tag); if(cls) el.className=cls; if(text!==undefined) el.textContent=String(text??''); return el; }
  function makeOption(value,label,selected=false){ const o=document.createElement('option'); o.value=String(value??''); o.textContent=String(label??''); if(selected)o.selected=true; return o; }
  function setOptions(sel, opts){ clearNode(sel); opts.forEach(o=>sel.appendChild(o)); return sel; }
  function fillAccessTypes(sel,val){ return setOptions(sel,Object.entries(ACCESS_TYPES).map(([k,v])=>makeOption(k,`${v.icon?`${v.icon} `:''}${v.label||v}`,k===val))); }
  function fillVendors(sel,val){ return setOptions(sel,VENDORS.map(v=>makeOption(v,v,v===val))); }
  function fillIotTypes(sel,val){ return setOptions(sel,Object.entries(IOT_TYPES).map(([k,v])=>makeOption(k,v,k===val))); }
  function fillTechs(sel,val){ return setOptions(sel,Object.entries(TECHS).map(([k,v])=>makeOption(k,v,k===val))); }
  function fillVlans(sel,val){ const ss=segments(); const opts=[makeOption('','— sin asignar —',!val)]; ss.forEach(s=>{const ref=s.ref||s.vlanRef||s.id;const num=s.vlanNumber||s.vlanId||'';opts.push(makeOption(ref,`${s.name}${num?` · VLAN ${num}`:''}${s.subnet?` · ${s.subnet}`:''}`,ref===val));}); return setOptions(sel,opts); }
  function fillNetDevs(sel,val){ return setOptions(sel,[makeOption('','— no conectado —',!val)].concat(deviceNodes().map(d=>makeOption(d.id,`${d.name} · ${d.type||'network'}`,d.id===val)))); }
  function fillPorts(sel,val,parent){ const ps=portNodes().filter(p=>!parent||p.parentNodeId===parent); return setOptions(sel,[makeOption('','— puerto no indicado —',!val)].concat(ps.map(p=>makeOption(p.id,`${p.name}${p.meta?.mode?` · ${p.meta.mode}`:''}`,p.id===val)))); }
  function fillAccess(sel,val,tech){ let arr=state.accessNodes;if(tech){arr=arr.filter(a=>accessType(a.type).tech===tech||a.type==='generic_gateway'||tech==='ethernet');} return setOptions(sel,[makeOption('','— directo / sin gateway —',!val)].concat(arr.map(a=>makeOption(a.id,`${accessType(a.type).icon} ${a.name} · ${accessType(a.type).label}`,a.id===val)))); }

  function ensureLocModel(){
    /* NetWizard guarda las ubicaciones en el estado principal `S`, pero `S` está
       declarado con `let` y no siempre queda expuesto como `window.S`.
       Por eso esta función lee las ubicaciones por tres vías seguras:
       1) ejecuta la migración del modelo físico si existe,
       2) usa el snapshot público de NetWizardBridge,
       3) cae al localStorage oficial de NetWizard (`nwp_v4`). */
    try{ if(typeof ensurePhysicalLocationModel==='function') ensurePhysicalLocationModel(); }catch(e){}
    try{
      const snap = window.NetWizardBridge?.getProjectSnapshot?.();
      const locs = snap?.project?.physicalLocations;
      if(Array.isArray(locs) && locs.length) return locs;
    }catch(e){}
    try{
      const raw = localStorage.getItem('nwp_v4');
      const project = raw ? JSON.parse(raw) : null;
      const locs = project?.physicalLocations;
      if(Array.isArray(locs) && locs.length) return locs;
      const names = project?.hostPhysicalLocations;
      if(Array.isArray(names) && names.length) return names.filter(Boolean).map((name,i)=>({id:`legacy_loc_${i}_${String(name).toLowerCase().replace(/[^a-z0-9]+/g,'_')}`,name,type:'other',parentId:'',distance:'',notes:''}));
    }catch(e){}
    try{ if(Array.isArray(window.S?.physicalLocations)) return window.S.physicalLocations; }catch(e){}
    return [];
  }
  function locLabel(loc){if(!loc)return '';let parent='';try{parent=loc.parentId?(ensureLocModel().find(x=>x.id===loc.parentId)?.name||''):'';}catch{}return parent?`${loc.name} · ${parent}`:loc.name;}
  function locNameById(id){const loc=ensureLocModel().find(l=>l.id===id);return loc?loc.name:'';}
  function locIdByName(name){const n=String(name||'').trim().toLowerCase();if(!n)return '';const loc=ensureLocModel().find(l=>String(l.name||'').trim().toLowerCase()===n);return loc?loc.id:'';}
  function normalizeIotLoc(obj){if(!obj)return obj;if(!obj.locationId && obj.physicalLocation)obj.locationId=locIdByName(obj.physicalLocation);if(obj.locationId && !obj.physicalLocation)obj.physicalLocation=locNameById(obj.locationId);return obj;}
  function migrateLocationFields(){state.accessNodes=(state.accessNodes||[]).map(a=>normalizeIotLoc({...a,locationId:a.locationId||'',physicalLocation:a.physicalLocation||'',locationRole:a.locationRole||''}));state.devices=(state.devices||[]).map(d=>normalizeIotLoc({...d,locationId:d.locationId||'',physicalLocation:d.physicalLocation||'',locationRole:d.locationRole||''}));}
  function fillLocations(sel,val){const locs=ensureLocModel(); return setOptions(sel,[makeOption('','— sin ubicación —',!val)].concat(locs.map(l=>makeOption(l.id,locLabel(l),l.id===val))));}
  function selectedLocName(id){return locNameById(id)||'—';}

  function render(){renderStats();renderAccess();renderDevices();renderPlan();drawMap();}
  function renderStats(){const byTech={};state.devices.forEach(d=>byTech[d.tech]=(byTech[d.tech]||0)+1);const el=$('iotStats'); if(!el)return; clearNode(el); [['var(--cy)',state.accessNodes.length,'Infraestructura IoT'],['var(--gn)',state.devices.length,'Dispositivos IoT'],['var(--yw)',Object.keys(byTech).length,'Tecnologías usadas'],['var(--pu)',segments().length,'VLANs NetWizard']].forEach(([color,val,label])=>{const stat=makeEl('div','stat');stat.style.borderTopColor=color;stat.append(makeEl('div','sv',val),makeEl('div','sl',label));el.appendChild(stat);});}
  function rowBase(ico,title,metaLines,tags,actions){const row=makeEl('div','iot-node-row');row.appendChild(makeEl('div','iot-node-ico',ico));const main=makeEl('div','iot-node-main');main.appendChild(makeEl('div','iot-node-title',title));const meta=makeEl('div','iot-node-meta');(Array.isArray(metaLines)?metaLines:[metaLines]).forEach((line,i)=>{if(i)meta.appendChild(document.createElement('br'));meta.appendChild(document.createTextNode(String(line??'')));});main.appendChild(meta);const tagWrap=makeEl('div','devtags');(tags||[]).forEach(([cls,text])=>tagWrap.appendChild(makeEl('span',cls,text)));main.appendChild(tagWrap);if(actions){const ar=makeEl('div','iot-node-actions');actions.forEach(b=>ar.appendChild(b));main.appendChild(ar);}row.appendChild(main);return row;}
  function renderAccess(){const el=$('iotAccessList'); if(!el)return; clearNode(el); if(!state.accessNodes.length){const e=makeEl('div','empty');e.append(makeEl('div','ei','📶'),document.createTextNode('No hay infraestructura IoT.'));el.appendChild(e);return;} state.accessNodes.forEach(a=>{const edit=makeEl('button','btn bs bxs','Editar');edit.dataset.editAccess=a.id;const del=makeEl('button','btn bd bxs','Borrar');del.dataset.delAccess=a.id;el.appendChild(rowBase(accessType(a.type).icon,a.name,[`${accessType(a.type).label} · ${a.vendor||'generic'} · gestión: ${vlanName(a.mgmtVlanRef)}`,`Conectado a: ${devName(a.parentDeviceId)}${a.parentPortId?' / '+portName(a.parentPortId):''}`,`Servicio: ${a.serviceName||'—'} · ${vlanName(a.serviceVlanRef)}`],[['b bcy',accessType(a.type).tech],['b bgr',a.model||'sin modelo'],['b bpu',`📍 ${selectedLocName(a.locationId)}`]],[edit,del]));});}
  function renderDevices(){const el=$('iotDeviceList'); if(!el)return; clearNode(el); if(!state.devices.length){const e=makeEl('div','empty');e.append(makeEl('div','ei','🔌'),document.createTextNode('No hay dispositivos IoT finales.'));el.appendChild(e);return;} state.devices.forEach(d=>{const a=state.accessNodes.find(x=>x.id===d.accessNodeId);const edit=makeEl('button','btn bs bxs','Editar');edit.dataset.editDevice=d.id;const del=makeEl('button','btn bd bxs','Borrar');del.dataset.delDevice=d.id;el.appendChild(rowBase((IOT_TYPES[d.type]||'📦').split(' ')[0],d.name,[`${IOT_TYPES[d.type]||d.type} · ${TECHS[d.tech]||d.tech} · ${vlanName(d.vlanRef)}`,`Acceso: ${a?a.name:'—'} · ID/IP/EUI: ${d.identifier||'—'}`],[['b bac',d.tech],['b bgr',d.credentialAlias||'sin credencial'],['b bpu',`📍 ${selectedLocName(d.locationId)}`]],[edit,del]));});}
  function renderPlan(){
    const lines=[];lines.push('# Plan integrado NetWizard + IoT');lines.push('');lines.push('## Infraestructura IoT');
    state.accessNodes.forEach(a=>{lines.push(`- ${a.name} (${accessType(a.type).label})`);lines.push(`  - Vendor/modelo: ${a.vendor||'generic'} ${a.model||''}`);lines.push(`  - Gestión: ${a.mgmtIp||'—'} / ${vlanName(a.mgmtVlanRef)}`);lines.push(`  - Ubicación: ${selectedLocName(a.locationId)}${a.locationRole?' / '+a.locationRole:''}`);lines.push(`  - Conexión física: ${devName(a.parentDeviceId)} ${a.parentPortId?'/ '+portName(a.parentPortId):''}`);lines.push(`  - Servicio: ${a.serviceName||'—'} / ${vlanName(a.serviceVlanRef)}`);if(a.notes)lines.push(`  - Notas: ${a.notes}`);});
    lines.push('');lines.push('## Dispositivos IoT');state.devices.forEach(d=>{const a=state.accessNodes.find(x=>x.id===d.accessNodeId);lines.push(`- ${d.name}: ${TECHS[d.tech]||d.tech} -> ${a?a.name:'directo'} -> ${vlanName(d.vlanRef)}`);lines.push(`  - Ubicación: ${selectedLocName(d.locationId)}${d.locationRole?' / '+d.locationRole:''}`);if(d.credentialAlias)lines.push(`  - Credencial/alias: ${d.credentialAlias}`);if(d.notes)lines.push(`  - Notas: ${d.notes}`);});
    lines.push('');lines.push('## Acciones de red sugeridas');
    state.accessNodes.forEach(a=>{if(a.parentPortId)lines.push(`- Puerto ${portName(a.parentPortId)}: configurar según ${accessType(a.type).label}; VLAN gestión ${vlanName(a.mgmtVlanRef)}, servicio ${vlanName(a.serviceVlanRef)}.`);if(a.type==='wifi_ap')lines.push(`- Crear SSID ${a.serviceName||'IoT'} asociado a ${vlanName(a.serviceVlanRef)} y activar aislamiento de clientes si aplica.`);if(a.type==='lorawan_gateway')lines.push(`- Permitir gateway LoRaWAN -> Network Server (${a.serviceName||'TTN/ChirpStack'}), normalmente UDP 1700 o MQTT/HTTPS según gateway.`);if(a.type==='mqtt_broker')lines.push(`- Broker MQTT: preferir TLS 8883, usuarios por dispositivo y ACL por topic.`);});
    $('iotPlanOut').value=lines.join('\n');
  }

  function openAccess(id){const a=normalizeIotLoc(state.accessNodes.find(x=>x.id===id)||{});$('iotAccessTitle').textContent=id?'Editar infraestructura IoT':'Añadir infraestructura IoT';$('iotAccessId').value=a.id||'';$('iotAccessName').value=a.name||'';fillAccessTypes($('iotAccessType'),a.type||'wifi_ap');fillVendors($('iotAccessVendor'),a.vendor||'generic');$('iotAccessModel').value=a.model||'';$('iotAccessMgmtIp').value=a.mgmtIp||'';fillVlans($('iotAccessMgmtVlan'),a.mgmtVlanRef||firstVlanRef());fillNetDevs($('iotAccessParentDevice'),a.parentDeviceId||'');fillPorts($('iotAccessParentPort'),a.parentPortId||'',a.parentDeviceId||'');fillLocations($('iotAccessLocation'),a.locationId||'');$('iotAccessLocationRole').value=a.locationRole||'';$('iotAccessService').value=a.serviceName||'';fillVlans($('iotAccessServiceVlan'),a.serviceVlanRef||firstIotVlanRef());$('iotAccessNotes').value=a.notes||'';$('iotAccessModal').classList.add('on');}
  function saveAccess(){const id=$('iotAccessId').value||uid('acc');const locationId=$('iotAccessLocation')?.value||'';const a={id,name:$('iotAccessName').value.trim()||'Infraestructura IoT',type:$('iotAccessType').value,vendor:$('iotAccessVendor').value,model:$('iotAccessModel').value.trim(),mgmtIp:$('iotAccessMgmtIp').value.trim(),mgmtVlanRef:$('iotAccessMgmtVlan').value,parentDeviceId:$('iotAccessParentDevice').value,parentPortId:$('iotAccessParentPort').value,locationId,physicalLocation:locNameById(locationId),locationRole:$('iotAccessLocationRole')?.value.trim()||'',serviceName:$('iotAccessService').value.trim(),serviceVlanRef:$('iotAccessServiceVlan').value,notes:$('iotAccessNotes').value.trim()};const i=state.accessNodes.findIndex(x=>x.id===id);if(i>=0)state.accessNodes[i]=a;else state.accessNodes.push(a);close('iotAccessModal');save();render();}
  function openDevice(id){const d=normalizeIotLoc(state.devices.find(x=>x.id===id)||{});$('iotDeviceTitle').textContent=id?'Editar dispositivo IoT':'Añadir dispositivo IoT';$('iotDeviceId').value=d.id||'';$('iotDeviceName').value=d.name||'';fillIotTypes($('iotDeviceType'),d.type||'sensor');fillTechs($('iotDeviceTech'),d.tech||'wifi');fillAccess($('iotDeviceAccess'),d.accessNodeId||'',d.tech||'wifi');$('iotDeviceIdentifier').value=d.identifier||'';fillVlans($('iotDeviceVlan'),d.vlanRef||firstIotVlanRef());fillLocations($('iotDeviceLocation'),d.locationId||'');$('iotDeviceLocationRole').value=d.locationRole||'';$('iotDeviceCredential').value=d.credentialAlias||'';$('iotDeviceNotes').value=d.notes||'';$('iotDeviceModal').classList.add('on');}
  function saveDevice(){const id=$('iotDeviceId').value||uid('iot');const locationId=$('iotDeviceLocation')?.value||'';const d={id,name:$('iotDeviceName').value.trim()||'Dispositivo IoT',type:$('iotDeviceType').value,tech:$('iotDeviceTech').value,accessNodeId:$('iotDeviceAccess').value,identifier:$('iotDeviceIdentifier').value.trim(),vlanRef:$('iotDeviceVlan').value,locationId,physicalLocation:locNameById(locationId),locationRole:$('iotDeviceLocationRole')?.value.trim()||'',credentialAlias:$('iotDeviceCredential').value.trim(),notes:$('iotDeviceNotes').value.trim()};const i=state.devices.findIndex(x=>x.id===id);if(i>=0)state.devices[i]=d;else state.devices.push(d);close('iotDeviceModal');save();render();}
  function close(id){$(id).classList.remove('on');}

  function buildMap(){
    const g=graph();const nodes=[];const links=[];const add=(n)=>{if(!nodes.some(x=>x.id===n.id))nodes.push(n);};
    if(state.map.show.network){(g.nodes||[]).filter(n=>n.kind==='network').forEach((n,i)=>add({id:n.id,kind:'network',type:n.type||'network',label:n.name||n.id,icon:n.type==='router'?'🌐':n.type==='firewall'?'🛡':'🔀',x:120+(i%2)*180,y:90+Math.floor(i/2)*110,ref:n}));}
    if(state.map.show.port){(g.nodes||[]).filter(n=>n.kind==='port').forEach((n,i)=>add({id:n.id,kind:'port',type:'port',label:n.name||'port',icon:'🔌',x:360+(i%4)*80,y:80+Math.floor(i/4)*45,ref:n}));}
    state.accessNodes.forEach((a,i)=>{const tech=accessType(a.type).tech;if(!state.map.show.access||state.map.show[tech]===false)return;add({id:a.id,kind:'access',type:a.type,label:a.name,icon:accessType(a.type).icon,x:420+(i%3)*170,y:170+Math.floor(i/3)*120,ref:a});if(a.parentDeviceId)links.push({from:a.parentDeviceId,to:a.id,kind:'physical',label:a.parentPortId?portName(a.parentPortId):'uplink'});if(a.parentPortId&&state.map.show.port)links.push({from:a.parentPortId,to:a.id,kind:'physical',label:'port'});});
    state.devices.forEach((d,i)=>{if(!state.map.show.iot||state.map.show[d.tech]===false)return;add({id:d.id,kind:'iot',type:d.type,label:d.name,icon:(IOT_TYPES[d.type]||'📦').split(' ')[0],x:650+(i%4)*135,y:320+Math.floor(i/4)*95,ref:d});if(d.accessNodeId)links.push({from:d.accessNodeId,to:d.id,kind:d.tech,label:TECHS[d.tech]||d.tech});});
    return {nodes,links};
  }
  function drawMap(){const c=$('iotUnifiedMap');if(!c)return;const wrap=c.parentElement;const dpr=window.devicePixelRatio||1;const w=wrap.clientWidth,h=wrap.clientHeight;c.width=w*dpr;c.height=h*dpr;c.style.width=w+'px';c.style.height=h+'px';const ctx=c.getContext('2d');ctx.setTransform(dpr,0,0,dpr,0,0);ctx.clearRect(0,0,w,h);const m=buildMap();hit=[];ctx.save();ctx.translate(state.map.panX||0,state.map.panY||0);ctx.scale(state.map.scale||1,state.map.scale||1);ctx.strokeStyle='rgba(143,163,192,.25)';ctx.lineWidth=1.5;m.links.forEach(l=>{const a=m.nodes.find(n=>n.id===l.from),b=m.nodes.find(n=>n.id===l.to);if(!a||!b)return;ctx.beginPath();ctx.moveTo(a.x,a.y);const mid=(a.x+b.x)/2;ctx.bezierCurveTo(mid,a.y,mid,b.y,b.x,b.y);ctx.stroke();ctx.fillStyle='rgba(143,163,192,.75)';ctx.font='10px Space Grotesk';ctx.fillText(l.label||'',(a.x+b.x)/2,(a.y+b.y)/2-4);});m.nodes.forEach(n=>{const r=n.kind==='network'?29:n.kind==='access'?27:n.kind==='iot'?24:14;ctx.beginPath();ctx.fillStyle=n.kind==='network'?'rgba(59,130,246,.15)':n.kind==='access'?'rgba(6,182,212,.18)':n.kind==='iot'?'rgba(16,185,129,.16)':'rgba(143,163,192,.12)';ctx.strokeStyle=n.id===state.selected?'#f59e0b':(n.kind==='network'?'#3b82f6':n.kind==='access'?'#06b6d4':n.kind==='iot'?'#10b981':'#4d6580');ctx.lineWidth=n.id===state.selected?3:1.5;ctx.arc(n.x,n.y,r,0,Math.PI*2);ctx.fill();ctx.stroke();ctx.fillStyle='#e2eaf7';ctx.textAlign='center';ctx.textBaseline='middle';ctx.font='20px sans-serif';ctx.fillText(n.icon,n.x,n.y-2);ctx.font='11px Space Grotesk';ctx.fillStyle='#8fa3c0';ctx.fillText(short(n.label,18),n.x,n.y+r+12);hit.push({...n,r});});ctx.restore();}
  function short(s,n){s=String(s||'');return s.length>n?s.slice(0,n-1)+'…':s;}
  function canvasPoint(e){const c=$('iotUnifiedMap'),r=c.getBoundingClientRect();return {x:(e.clientX-r.left-(state.map.panX||0))/(state.map.scale||1),y:(e.clientY-r.top-(state.map.panY||0))/(state.map.scale||1)};}
  function selectAt(e){const p=canvasPoint(e);const n=hit.slice().reverse().find(h=>Math.hypot(h.x-p.x,h.y-p.y)<=h.r+6);if(!n)return;state.selected=n.id;renderPanel(n);drawMap();}
  function renderPanel(n){
    const p=$('iotMapPanel'); if(!p) return;
    p.replaceChildren();
    const title=document.createElement('b'); title.textContent=n.label||''; p.appendChild(title); p.appendChild(document.createElement('br'));
    const kind=document.createElement('span'); kind.className='b bcy'; kind.textContent=n.kind||''; p.appendChild(kind); p.appendChild(document.createTextNode(' '));
    const type=document.createElement('span'); type.className='b bgr'; type.textContent=n.type||''; p.appendChild(type);
    const sep=document.createElement('hr'); sep.className='sep'; p.appendChild(sep);
    function addHint(lines){ const h=document.createElement('div'); h.className='hint'; lines.forEach((line,i)=>{ if(i) h.appendChild(document.createElement('br')); h.appendChild(document.createTextNode(line)); }); p.appendChild(h); }
    function addEditButton(kind,id){ const row=document.createElement('div'); row.className='brow'; const btn=document.createElement('button'); btn.className='btn bp bxs'; btn.type='button'; btn.textContent='Editar'; if(kind==='access') btn.dataset.editAccess=id||''; else btn.dataset.editDevice=id||''; row.appendChild(btn); p.appendChild(row); }
    if(n.kind==='access'){
      const a=n.ref||{};
      addHint([
        accessType(a.type).label,
        `Vendor: ${a.vendor||''} ${a.model||''}`,
        `Gestión: ${a.mgmtIp||'—'} / ${vlanName(a.mgmtVlanRef)}`,
        `Conexión: ${devName(a.parentDeviceId)} ${a.parentPortId?'/ '+portName(a.parentPortId):''}`,
        `Servicio: ${a.serviceName||'—'} / ${vlanName(a.serviceVlanRef)}`,
        `Ubicación: ${selectedLocName(a.locationId)}`
      ]);
      addEditButton('access', a.id);
    }else if(n.kind==='iot'){
      const d=n.ref||{};
      addHint([
        IOT_TYPES[d.type]||d.type||'',
        `Tecnología: ${TECHS[d.tech]||d.tech||''}`,
        `VLAN: ${vlanName(d.vlanRef)}`,
        `Acceso: ${state.accessNodes.find(a=>a.id===d.accessNodeId)?.name||'—'}`,
        `ID/IP/EUI: ${d.identifier||'—'}`,
        `Ubicación: ${selectedLocName(d.locationId)}`
      ]);
      addEditButton('device', d.id);
    }else{
      const pre=document.createElement('pre'); pre.className='mono'; pre.style.whiteSpace='pre-wrap'; pre.style.color='var(--t2)'; pre.style.fontSize='10.5px'; pre.textContent=JSON.stringify(n.ref,null,2).slice(0,1200); p.appendChild(pre);
    }
  }

  function init(){load();
    document.addEventListener('nw:project:changed',e=>{if(e.detail?.source==='iot')return;const embedded=projectIotState();if(embedded){state=defaultState();mergeState(embedded);migrateLocationFields();render();}});
    $('iotAddAccess')?.addEventListener('click',()=>openAccess());$('iotAddDevice')?.addEventListener('click',()=>openDevice());$('iotMapRefresh')?.addEventListener('click',render);$('iotMapFit')?.addEventListener('click',()=>{state.map.panX=0;state.map.panY=0;state.map.scale=1;drawMap();});$('iotCopyPlan')?.addEventListener('click',()=>{navigator.clipboard?.writeText($('iotPlanOut').value);alert('Plan IoT copiado.');});
    ['iotAccessClose','iotAccessCancel'].forEach(id=>$(id)?.addEventListener('click',()=>close('iotAccessModal')));$('iotAccessSave')?.addEventListener('click',saveAccess);
    ['iotDeviceClose','iotDeviceCancel'].forEach(id=>$(id)?.addEventListener('click',()=>close('iotDeviceModal')));$('iotDeviceSave')?.addEventListener('click',saveDevice);
    $('iotAccessParentDevice')?.addEventListener('change',e=>{fillPorts($('iotAccessParentPort'),'',e.target.value);});$('iotDeviceTech')?.addEventListener('change',e=>{fillAccess($('iotDeviceAccess'),'',e.target.value);});
    document.addEventListener('click',e=>{const ea=e.target.closest('[data-edit-access]');if(ea)openAccess(ea.dataset.editAccess);const da=e.target.closest('[data-del-access]');if(da&&confirm('¿Borrar infraestructura IoT?')){state.accessNodes=state.accessNodes.filter(a=>a.id!==da.dataset.delAccess);state.devices.forEach(d=>{if(d.accessNodeId===da.dataset.delAccess)d.accessNodeId='';});save();render();}const ed=e.target.closest('[data-edit-device]');if(ed)openDevice(ed.dataset.editDevice);const dd=e.target.closest('[data-del-device]');if(dd&&confirm('¿Borrar dispositivo IoT?')){state.devices=state.devices.filter(d=>d.id!==dd.dataset.delDevice);save();render();}});
    qsa('[data-iot-filter]').forEach(cb=>{cb.checked=state.map.show[cb.dataset.iotFilter]!==false;cb.addEventListener('change',()=>{state.map.show[cb.dataset.iotFilter]=cb.checked;save();drawMap();});});
    const c=$('iotUnifiedMap');if(c){c.addEventListener('click',selectAt);c.addEventListener('wheel',e=>{e.preventDefault();state.map.scale=Math.max(.45,Math.min(2.2,(state.map.scale||1)*(e.deltaY<0?1.08:.92)));save();drawMap();},{passive:false});c.addEventListener('mousedown',e=>{drag={x:e.clientX,y:e.clientY,px:state.map.panX||0,py:state.map.panY||0};c.classList.add('dragging');});window.addEventListener('mousemove',e=>{if(!drag)return;state.map.panX=drag.px+e.clientX-drag.x;state.map.panY=drag.py+e.clientY-drag.y;drawMap();});window.addEventListener('mouseup',()=>{if(drag){save();drag=null;c.classList.remove('dragging');}});}
    window.addEventListener('resize',()=>setTimeout(drawMap,50));render();}
  window.NetWizardIoTEmbedded={init,render,openAccess,openDevice,save,drawMap,getState:()=>JSON.parse(JSON.stringify(state)),setDeviceLocation:(id,locationId)=>{const d=state.devices.find(x=>x.id===id);if(d){d.locationId=locationId||'';d.physicalLocation=locNameById(locationId)||'';save();render();}},setAccessLocation:(id,locationId)=>{const a=state.accessNodes.find(x=>x.id===id);if(a){a.locationId=locationId||'';a.physicalLocation=locNameById(locationId)||'';save();render();}},buildMap};
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})();
