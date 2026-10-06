/* =========================================================
   NetWizard Pro - JavaScript extraído del HTML original
   Safe refactor v3.6

   IMPORTANTE:
   - Este archivo sigue siendo un script clásico, NO un módulo ES.
   - No se reescribe lógica ni se cambian nombres globales.
   - La v3.3 inicia extracción real de helpers puros hacia netwizard-core-utils.js.
   - El objetivo sigue siendo modularización gradual sin perder funcionalidad.

   Índice de secciones:
   00. Bootstrap, DOM helpers y constantes
   01. Estado, migraciones ligeras y storage
   02. Ubicaciones físicas
   03. Helpers comunes, IP/subnetting y lookups
   04. Generadores de configuración
   05. Navegación, dashboard y asistente
   06. Dispositivos
   07. Puertos e interfaces
   08. VLANs y subnets
   09. Hosts y mapa IP
   10. Puertos visuales y enlaces
   11. Firewall, matriz inter-VLAN y hardening
   12. RoaS, DHCP, VTP y exportación
   13. Topología clásica
   14. Vista visual V5
   15. Event listeners e inicialización
========================================================= */

'use strict';
const SK='nwp_v4';
const $=id=>document.getElementById(id);
const qsa=s=>Array.from(document.querySelectorAll(s));
const NWCore=window.NetWizardCoreUtils||{};
const NWSchema=window.NetWizardProjectSchema||null;
const NWL3=window.NetWizardL3ConfigUtils||{};
const NWR=window.NetWizardRoutingUtils||{};
const NWPOL=window.NetWizardPolicyUtils||{};
const NWDevice=window.NetWizardDeviceModel||null;
const NWI18n=window.NetWizardI18n||null;
const i18nText=(key,params,fallback)=>NWI18n&&typeof NWI18n.t==='function'?NWI18n.t(key,params||{}):String(fallback||key).replace(/\{([A-Za-z0-9_.-]+)\}/g,(_,k)=>Object.prototype.hasOwnProperty.call(params||{},k)?String(params[k]):'');
const deviceKindText=value=>{const kind=NWDevice?NWDevice.normalizeKind(value):(value&&typeof value==='object'?(value.kind||value.type):value)||'appliance';const fallback=NWDevice?NWDevice.label(value):String(kind);return i18nText('device.kind.'+kind,{},fallback);};
const devKind=d=>NWDevice?NWDevice.normalizeKind(d):(d?.kind||d?.type||'appliance');
const isSwitchDevice=d=>NWDevice?NWDevice.isSwitching(d):devKind(d)==='switch';
const isEdgeDevice=d=>NWDevice?NWDevice.isEdgeCapable(d):['router','firewall'].includes(devKind(d));
const devIcon=d=>NWDevice?NWDevice.icon(d):(devKind(d)==='switch'?'🔀':devKind(d)==='router'?'🌐':devKind(d)==='firewall'?'🛡':'🧩');
const devLabel=d=>NWDevice?NWDevice.label(d):devKind(d);

// ── CONSTANTS ──
const DESIGN_STEP_ORDER=['dash','wiz','loc','dev','physical','ports','vlan','hosts','iot','graphs','links','fw','validate','cfg'];
const INVENTORY_STEP_ORDER=['dash','loc','dev','physical','ports','links','vlan','hosts','iot','graphs','fw','validate','cfg'];
const HT={pc:{l:'PC/Desktop',i:'🖥'},laptop:{l:'Portátil',i:'💻'},server:{l:'Servidor',i:'🗄'},printer:{l:'Impresora',i:'🖨'},phone:{l:'Teléfono IP',i:'📞'},camera:{l:'Cámara IP',i:'📷'},ap:{l:'AP WiFi',i:'📡'},iot:{l:'IoT',i:'🔌'}};
const hostTypeText=type=>i18nText('hosts.typeLabel.'+type,{},HT[type]?.l||type||'');
const VCOLS=['#3b82f6','#10b981','#f59e0b','#ef4444','#8b5cf6','#06b6d4','#f97316','#e879f9','#84cc16','#14b8a6'];

const SCENARIOS=[
  {id:'home',ico:'🏠',name:'Home Lab',desc:'Router + switch + PCs',examplePresetId:'golden-home-lab-modern',exampleLabel:'Golden Path · Home Lab moderno y segmentado',certified:true,vlans:[{id:10,n:'LAN',c:'#3b82f6'},{id:20,n:'IoT',c:'#10b981'},{id:99,n:'Gestión',c:'#8b5cf6'}]},
  {id:'office',ico:'🏢',name:'Oficina pequeña',desc:'< 50 usuarios',examplePresetId:'golden-office-modern',exampleLabel:'Golden Path · Oficina pequeña segura',certified:true,vlans:[{id:10,n:'Usuarios',c:'#3b82f6'},{id:20,n:'Servidores',c:'#10b981'},{id:30,n:'WiFi',c:'#f59e0b'},{id:99,n:'Gestión',c:'#8b5cf6'}]},
  {id:'corp',ico:'🏙',name:'Empresa mediana',desc:'Departamentos + servidores',examplePresetId:'golden-corp-modern',exampleLabel:'Golden Path · Empresa mediana moderna',certified:true,vlans:[{id:10,n:'Dirección',c:'#ef4444'},{id:20,n:'Ventas',c:'#3b82f6'},{id:30,n:'IT',c:'#10b981'},{id:40,n:'RRHH',c:'#f59e0b'},{id:50,n:'Servidores',c:'#8b5cf6'},{id:60,n:'WiFi',c:'#06b6d4'},{id:70,n:'Cámaras',c:'#f97316'},{id:99,n:'Gestión',c:'#e879f9'}]},
  {id:'dc',ico:'🗄',name:'Datacenter',desc:'Frontend/Backend/DB/Storage',examplePresetId:'golden-datacenter-modern',exampleLabel:'Golden Path · Datacenter leaf-spine moderno',certified:true,vlans:[{id:10,n:'Frontend',c:'#3b82f6'},{id:20,n:'Backend',c:'#10b981'},{id:30,n:'DB',c:'#ef4444'},{id:40,n:'Storage',c:'#f59e0b'},{id:50,n:'Management',c:'#8b5cf6'}]},
  {id:'retail',ico:'🏪',name:'Retail / Comercio',desc:'POS, cámaras, WiFi clientes',examplePresetId:'golden-retail-modern',exampleLabel:'Golden Path · Retail / Comercio segmentado',certified:true,vlans:[{id:10,n:'POS',c:'#10b981'},{id:20,n:'Cámaras',c:'#ef4444'},{id:30,n:'WiFi-Público',c:'#f59e0b'},{id:40,n:'Empleados',c:'#3b82f6'},{id:99,n:'Gestión',c:'#8b5cf6'}]},
  {id:'custom',ico:'✏️',name:'Personalizado',desc:'Desde cero',vlans:[]},
];

const DEV_PICKER=[
  {id:'fw',ico:'🛡',n:'Firewall',d:'Controla acceso WAN/Internet'},
  {id:'coreSw',ico:'🔀',n:'Switch core',d:'Switch principal L3'},
  {id:'accSw',ico:'🔀',n:'Switch acceso',d:'Switch de planta/piso'},
  {id:'router',ico:'🌐',n:'Router',d:'Enrutamiento L3/WAN'},
  {id:'server',ico:'🗄',n:'Servidor',d:'Web, DB, file server…'},
  {id:'ap',ico:'📡',n:'WiFi AP',d:'Punto de acceso inalámbrico'},
  {id:'camera',ico:'📷',n:'Cámaras IP',d:'Sistema de videovigilancia'},
  {id:'printer',ico:'🖨',n:'Impresoras',d:'Impresoras de red'},
  {id:'pc',ico:'🖥',n:'PCs / Laptops',d:'Equipos de usuario'},
  {id:'phone',ico:'📞',n:'Teléfonos IP',d:'Centralita VoIP'},
  {id:'iot',ico:'🔌',n:'Dispositivos IoT',d:'Smart devices, sensores'},
  {id:'nvr',ico:'📹',n:'NVR / DVR',d:'Grabación de cámaras'},
];

const FW_TPLS=[
  {name:'Básico: DNS + HTTP/HTTPS',nameKey:'firewall.template.basic',rules:[
    {name:'DNS',src:'any',dst:'any',proto:'udp',port:'53',action:'allow',dir:'both',prio:10},
    {name:'HTTP',src:'any',dst:'any',proto:'tcp',port:'80',action:'allow',dir:'out',prio:20},
    {name:'HTTPS',src:'any',dst:'any',proto:'tcp',port:'443',action:'allow',dir:'out',prio:30},
    {name:'Denegar resto',src:'any',dst:'any',proto:'any',port:'any',action:'deny',dir:'both',prio:9999},
  ]},
  {name:'Servidores: web + SSH',nameKey:'firewall.template.servers',rules:[
    {name:'SSH Admin',src:'10.10.99.0/24',dst:'any',proto:'tcp',port:'22',action:'allow',dir:'in',prio:10},
    {name:'HTTP IN',src:'any',dst:'any',proto:'tcp',port:'80',action:'allow',dir:'in',prio:20},
    {name:'HTTPS IN',src:'any',dst:'any',proto:'tcp',port:'443',action:'allow',dir:'in',prio:30},
    {name:'ICMP',src:'any',dst:'any',proto:'icmp',port:'any',action:'allow',dir:'both',prio:40},
    {name:'Denegar resto IN',src:'any',dst:'any',proto:'any',port:'any',action:'deny',dir:'in',prio:9999},
  ]},
  {name:'Cámaras: solo NVR tiene acceso',nameKey:'firewall.template.cameras',rules:[
    {name:'NVR→Cámaras RTSP',src:'10.10.50.1',dst:'10.10.70.0/24',proto:'tcp',port:'554',action:'allow',dir:'both',prio:10},
    {name:'Bloquear acceso a cámaras',src:'any',dst:'10.10.70.0/24',proto:'any',port:'any',action:'deny',dir:'in',prio:20},
  ]},
  {name:'Aislamiento VoIP',nameKey:'firewall.template.voip',rules:[
    {name:'VoIP SIP',src:'10.10.60.0/24',dst:'any',proto:'udp',port:'5060',action:'allow',dir:'both',prio:10},
    {name:'VoIP RTP',src:'10.10.60.0/24',dst:'any',proto:'udp',port:'range 10000-20000',action:'allow',dir:'both',prio:20},
    {name:'Bloquear entre VoIP y LAN',src:'10.10.60.0/24',dst:'10.10.0.0/8',proto:'any',port:'any',action:'deny',dir:'both',prio:30},
  ]},
];

// ── STATE ──


// =========================================================
// 01. ESTADO, MIGRACIONES LIGERAS Y STORAGE
// Estado principal de la aplicación, carga/guardado local y compatibilidad con proyectos antiguos.
// =========================================================
function defS(){return{_schemaVersion:'3.50.0',step:'dash',projName:'',workflow:{mode:'design'},designRequirements:{version:'netwizard-design-requirements-v1',capacityPolicy:{portGrowthPercent:20,minFreePorts:8,rackGrowthPercent:20,minFreeRackUnits:4},rackPolicy:{patchPanelPorts:24,organizerPerSwitch:true,layoutPattern:'patch-manager-switch'},locationPlans:[]},customDeviceModels:[],devices:[],ports:[],vlans:[],subnets:[],hosts:[],links:[],fwRules:[],vlanMatrix:{},roas:{gwId:null,lanIf:'',natVRef:null,wanCidr:'',wanNh:''},dhcp:{},security:{bpdu:'yes',ps:'yes',ds:'yes',dsV:'',dai:'yes',ipsg:'no',qV:''},vtp:{domain:'',password:'',version:'2',pruning:'no',roles:{}},topo:{pos:{}},hostPhysicalLocations:[],physicalLocations:[],vrfs:[],wanCircuits:[],trafficProfiles:[],internalServices:[],wifiControllers:[],wifiAccessPoints:[],wifiSsids:[],ipv6Networks:[],failureScenarios:[],stacks:[],mlagDomains:[],haGroups:[],diversityPolicies:[],linkAggregations:[],routing:{},highAvailability:{},accessSecurity:{},management:{},observedState:null,driftPolicy:{},uiSort:{},iot:{accessNodes:[],devices:[],map:{show:{network:true,port:false,access:true,iot:true,wifi:true,lora:true,zigbee:true,thread:true,mqtt:true},scale:1,panX:0,panY:0},selected:null},visual:{locs:[],assign:{devices:{},hosts:{}},pos:{},view:{px:60,py:50,zoom:1},sel:null}};}
const normalizeProjectShape=NWCore.normalizeProjectShape||((project,defaults)=>({...defaults(),...(project||{})}));
function normalizeProject(project){
  const shaped=normalizeProjectShape(project,defS);
  if(NWSchema && typeof NWSchema.sanitizeProject==='function'){
    return NWSchema.sanitizeProject(shaped,{defaults:defS}).project;
  }
  return shaped;
}
let S=normalizeProject(loadS()||defS());

function loadS(){
  try{
    const raw=JSON.parse(localStorage.getItem(SK));
    if(!raw)return null;
    if(NWSchema && typeof NWSchema.prepareImport==='function'){
      const prepared=NWSchema.prepareImport(raw,{defaults:defS});
      if(prepared.errors && prepared.errors.length) console.warn('NetWizard: proyecto local con avisos de schema', prepared.errors);
      return prepared.project;
    }
    return raw;
  }catch{return null;}
}
const stateTimingMetrics={saves:0,totalMs:0,maxMs:0,lastMs:0,lastNormalizeMs:0,lastStorageMs:0};
function save(options={}){
  const saveStarted=performance.now();
  vlanSelectSignature='';
  let normalizeMs=0,storageMs=0;
  if(!options.skipNormalize && NWSchema && typeof NWSchema.sanitizeProject==='function'){
    const normalizeStarted=performance.now();
    Object.assign(S,NWSchema.sanitizeProject(S,{defaults:defS}).project);
    normalizeMs=performance.now()-normalizeStarted;
  }
  const storageStarted=performance.now();
  localStorage.setItem(SK,JSON.stringify(S));
  storageMs=performance.now()-storageStarted;
  if(!options.silent){
    const el=$('savedLbl');
    if(el){el.classList.add('on');clearTimeout(el._t);el._t=setTimeout(()=>el.classList.remove('on'),1300);}
  }
  if(options.notify!==false){
    document.dispatchEvent(new CustomEvent('nw:project:changed',{detail:{source:options.source||'netwizard'}}));
  }
  const elapsed=performance.now()-saveStarted;
  stateTimingMetrics.saves++;stateTimingMetrics.totalMs+=elapsed;stateTimingMetrics.lastMs=elapsed;stateTimingMetrics.maxMs=Math.max(stateTimingMetrics.maxMs,elapsed);
  stateTimingMetrics.lastNormalizeMs=normalizeMs;stateTimingMetrics.lastStorageMs=storageMs;
}
function projectSnapshot(){return JSON.parse(JSON.stringify(S));}
function replaceProject(project,options={}){
  if(!project || typeof project!=='object')throw new Error('Proyecto inválido');
  const next=options.skipNormalize?project:normalizeProject(project);
  Object.keys(S).forEach(k=>delete S[k]);
  Object.assign(S,next);
  if(typeof ensureVisualModel==='function')ensureVisualModel();
  save({source:options.source||'api',silent:options.silent,skipNormalize:true,notify:options.notify});
  if(!options.skipRefresh && typeof refresh==='function')refresh();
  return options.returnSnapshot===false?true:projectSnapshot();
}
function updateProject(patchOrUpdater,options={}){
  const patch=typeof patchOrUpdater==='function'?patchOrUpdater(projectSnapshot()):patchOrUpdater;
  if(!patch || typeof patch!=='object')return options.returnSnapshot===false?false:projectSnapshot();
  const next=options.skipNormalize?{...S,...patch}:normalizeProject({...S,...patch});
  Object.keys(S).forEach(k=>delete S[k]);
  Object.assign(S,next);
  save({source:options.source||'api',silent:options.silent,skipNormalize:true,notify:options.notify});
  if(!options.skipRefresh && typeof refresh==='function')refresh();
  return options.returnSnapshot===false?true:projectSnapshot();
}
window.NetWizardState={version:'netwizard-state-api-v1',storageKey:SK,getSnapshot:projectSnapshot,replaceProject,updateProject,save:(options={})=>save({...options,source:options.source||'api'})};
const esc=NWCore.escapeHtml||((s)=>(s??'').toString().replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c])));
const attr=(window.NetWizardSecurityUtils&&window.NetWizardSecurityUtils.escapeAttr)||esc;
const jsq=(window.NetWizardSecurityUtils&&window.NetWizardSecurityUtils.inlineJsString)||((v)=>attr(String(v??'').replace(/\\/g,'\\\\').replace(/'/g,"\\'").replace(/[\r\n]/g,' ')));

// DOM-safe render helpers used while migrating legacy innerHTML sections.
function clearNode(node){ if(node) node.textContent=''; return node; }
function appendText(node,text){ node.appendChild(document.createTextNode(String(text ?? ''))); return node; }
function makeEl(tag, className, text){ const el=document.createElement(tag); if(className) el.className=className; if(text!==undefined) el.textContent=String(text ?? ''); return el; }
function makeOption(value,label,selected=false){ const o=document.createElement('option'); o.value=String(value ?? ''); o.textContent=String(label ?? ''); if(selected) o.selected=true; return o; }
function makeEmpty(icon,msg){ const box=makeEl('div','empty'); const ei=makeEl('div','ei',icon||''); const p=makeEl('p','',msg||''); box.append(ei,p); return box; }
function setSingleHint(node,msg){ clearNode(node); const h=makeEl('div','hint',msg||''); node.appendChild(h); return node; }
function setOptions(sel, options, fallbackLabel){ clearNode(sel); if(options&&options.length){ options.forEach(o=>sel.appendChild(o)); } else if(fallbackLabel!==undefined){ sel.appendChild(makeOption('', fallbackLabel)); } return sel; }

const cleanStr=NWCore.cleanStr||((v)=>(v??'').toString().trim());
const cliText=NWCore.safeCliText||((v,max=160)=>cleanStr(v).replace(/[\r\n\t]/g,' ').replace(/\s+/g,' ').slice(0,max));
const cliToken=NWCore.safeCliToken||((v,fallback='item',max=64)=>(cliText(v||fallback,max).replace(/[^A-Za-z0-9_.-]/g,'_').replace(/_+/g,'_').slice(0,max)||fallback));
const cliQuoted=NWCore.safeQuotedCli||((v,max=160)=>cliText(v,max).replace(/"/g,"'"));


// =========================================================
// 02. UBICACIONES FÍSICAS
// Gestión de ubicaciones jerárquicas, sincronización con hosts/dispositivos y render del panel de ubicaciones.
// =========================================================
function ensurePhysicalLocationModel(){
  if(!Array.isArray(S.physicalLocations))S.physicalLocations=[];
  const hadStructuredLocations=S.physicalLocations.some(l=>l&&cleanStr(l.name));
  const seen=new Set();
  S.physicalLocations=(S.physicalLocations||[]).filter(Boolean).map(l=>({
    id:l.id||uid('pl'),
    name:cleanStr(l.name),
    type:cleanStr(l.type)||'other',
    parentId:l.parentId||'',
    distance:l.distance==null?'':String(l.distance),
    notes:cleanStr(l.notes)
  })).filter(l=>l.name && !seen.has(l.name.toLowerCase()) && seen.add(l.name.toLowerCase()));
  if(!hadStructuredLocations){
    for(const n of (S.hostPhysicalLocations||[])) if(cleanStr(n) && !S.physicalLocations.some(l=>l.name.toLowerCase()===cleanStr(n).toLowerCase())) S.physicalLocations.push({id:uid('pl'),name:cleanStr(n),type:'other',parentId:'',distance:'',notes:''});
  }
  for(const h of S.hosts||[]) if(cleanStr(h.physicalLocation) && !S.physicalLocations.some(l=>l.name.toLowerCase()===cleanStr(h.physicalLocation).toLowerCase())) S.physicalLocations.push({id:uid('pl'),name:cleanStr(h.physicalLocation),type:'other',parentId:'',distance:'',notes:''});
  for(const d of S.devices||[]) if(cleanStr(d.physicalLocation) && !S.physicalLocations.some(l=>l.name.toLowerCase()===cleanStr(d.physicalLocation).toLowerCase())) S.physicalLocations.push({id:uid('pl'),name:cleanStr(d.physicalLocation),type:'other',parentId:'',distance:'',notes:''});
  syncVisualLocationsIntoPhysical();
  S.hostPhysicalLocations=S.physicalLocations.map(l=>l.name).sort((a,b)=>a.localeCompare(b,'es',{sensitivity:'base'}));
}
function physLocById(id){ ensurePhysicalLocationModel(); return S.physicalLocations.find(l=>l.id===id)||null; }
function physLocByName(name){ const n=cleanStr(name).toLowerCase(); if(!n) return null; ensurePhysicalLocationModel(); return S.physicalLocations.find(l=>l.name.toLowerCase()===n)||null; }
function syncPhysicalLocationNames(){ S.hostPhysicalLocations=(S.physicalLocations||[]).map(l=>cleanStr(l.name)).filter(Boolean).sort((a,b)=>a.localeCompare(b,'es',{sensitivity:'base'})); }
function physLocLabel(loc){ if(!loc) return ''; const p=loc.parentId?physLocById(loc.parentId):null; return p? `${loc.name} · ${p.name}`:loc.name; }
function fillPhysicalLocationParentSel(excludeId=''){
  ensurePhysicalLocationModel();
  const sel=$('plParent'); if(!sel) return;
  const opts=[makeOption('','— sin ubicación superior —'), ...S.physicalLocations.filter(l=>l.id!==excludeId).map(l=>makeOption(l.id,physLocLabel(l)))];
  setOptions(sel,opts);
}
function fillHostPhysLocSel(){
  ensurePhysicalLocationModel();
  const sel=$('hPhysLocSel'); if(!sel) return;
  const opts=[makeOption('','— seleccionar ubicación física —'), ...S.physicalLocations.map(l=>makeOption(l.name,`${physLocLabel(l)} · ${locTypeLabel(l.type)}`))];
  setOptions(sel,opts);
}
function applyHostPhysicalLocationSelection(){ const sel=$('hPhysLocSel'); if(sel&&sel.value) $('hPhysLoc').value=sel.value; }
function rememberPhysicalLocation(v,meta={}){
  const val=cleanStr(v); if(!val) return null;
  ensurePhysicalLocationModel();
  const current=physLocByName(val);
  const payload={
    id:current?.id,
    name:val,
    type:(meta.type||(current?.type)||'other'),
    parentId:(meta.parentId||(current?.parentId)||''),
    distance:(meta.distance||(current?.distance)||''),
    notes:(meta.notes||(current?.notes)||'')
  };
  if(window.NetWizardV5LocationTransactions){
    const plan=window.NetWizardV5LocationTransactions.planUpsert(S,payload,{idFactory:uid,visualIdFactory:uid});
    if(plan.ok&&window.NetWizardV5LocationTransactions.commit(S,plan).ok)return physLocById(plan.id);
  }
  if(current)return current;
  const loc={id:uid('pl'),name:val,type:payload.type,parentId:payload.parentId,distance:payload.distance,notes:payload.notes};
  S.physicalLocations.push(loc);syncPhysicalLocationNames();return loc;
}
function locTypeLabel(t){ return ({site:'Sede',campus:'Campus',building:'Edificio',floor:'Planta',room:'Habitación',rack:'Rack/Armario',zone:'Zona',desk:'Puesto',other:'Otra'})[t]||t||'Otra'; }

function syncVisualLocationsIntoPhysical(){
  if(!S.visual || !Array.isArray(S.visual.locs)) return;
  if(!Array.isArray(S.physicalLocations)) S.physicalLocations=[];
  const byName=new Map(S.physicalLocations.map(l=>[cleanStr(l.name).toLowerCase(),l]));
  for(const vl of S.visual.locs){
    const name=cleanStr(vl.name); if(!name) continue;
    const key=name.toLowerCase();
    if(!byName.has(key)){
      const loc={id:vl.physicalLocationId||uid('pl'),name,type:vl.type||'zone',parentId:'',distance:'',notes:'Sincronizada desde Vista V5'};
      S.physicalLocations.push(loc); byName.set(key,loc); vl.physicalLocationId=loc.id;
    }else if(!vl.physicalLocationId){
      vl.physicalLocationId=byName.get(key).id;
    }
  }
}
function physicalLocationUsedDirectly(pl){
  if(!pl)return false;
  const id=pl.id,name=cleanStr(pl.name).toLowerCase();
  const matches=(obj)=>cleanStr(obj&&obj.locationId)===id||cleanStr(obj&&obj.physicalLocationId)===id||cleanStr(obj&&obj.physicalLocation).toLowerCase()===name;
  if((S.devices||[]).some(matches)||(S.hosts||[]).some(matches)||(S.racks||[]).some(matches)||(S.telecomOutlets||[]).some(matches))return true;
  return false;
}
function syncPhysicalLocationsIntoVisual(){
  const V=S.visual||(S.visual={locs:[],assign:{devices:{},hosts:{}},pos:{},view:{px:60,py:50,zoom:1},sel:null});
  if(!Array.isArray(V.locs)) V.locs=[];
  const physical=S.physicalLocations||[];
  const hasChildren=new Set(physical.map(l=>cleanStr(l.parentId)).filter(Boolean));
  const wanted=new Set();
  for(const pl of physical){
    const isContainer=hasChildren.has(pl.id)&&['site','campus','building','floor'].includes(cleanStr(pl.type).toLowerCase());
    if(!isContainer||physicalLocationUsedDirectly(pl))wanted.add(pl.id);
  }
  const removedIds=new Set(V.locs.filter(l=>l.physicalLocationId&&!wanted.has(l.physicalLocationId)&&physical.some(pl=>pl.id===l.physicalLocationId)).map(l=>l.id));
  if(removedIds.size){
    V.locs=V.locs.filter(l=>!removedIds.has(l.id));
    for(const [id,lid] of Object.entries(V.assign.devices||{}))if(removedIds.has(lid))delete V.assign.devices[id];
    for(const [id,lid] of Object.entries(V.assign.hosts||{}))if(removedIds.has(lid))delete V.assign.hosts[id];
  }
  const byName=new Map(V.locs.map(l=>[cleanStr(l.name).toLowerCase(),l]));
  for(const pl of physical){
    if(!wanted.has(pl.id))continue;
    const name=cleanStr(pl.name); if(!name) continue;
    const key=name.toLowerCase(),existing=byName.get(key);
    if(!existing){
      const vl={id:uid('loc'),name,color:'#10233c',x:80+V.locs.length*360,y:90+(V.locs.length%2)*260,type:pl.type||'other',physicalLocationId:pl.id};
      V.locs.push(vl);byName.set(key,vl);
    }else{
      existing.physicalLocationId=pl.id;existing.type=pl.type||existing.type||'other';
    }
  }
}
function syncLocationModels(){
  syncVisualLocationsIntoPhysical();
  syncPhysicalLocationsIntoVisual();
  syncPhysicalLocationNames();
}

function clearPhysicalLocationForm(){ $('plEditId').value=''; $('plName').value=''; $('plType').value='building'; fillPhysicalLocationParentSel(); $('plParent').value=''; $('plDistance').value=''; $('plNotes').value=''; $('btnAddPhysLoc').textContent='➕ Añadir ubicación'; $('btnCancelPhysLocEdit').style.display='none'; }
function startPhysicalLocationEdit(id){ const loc=physLocById(id); if(!loc) return; $('plEditId').value=id; $('plName').value=loc.name||''; $('plType').value=loc.type||'other'; fillPhysicalLocationParentSel(id); $('plParent').value=loc.parentId||''; $('plDistance').value=loc.distance||''; $('plNotes').value=loc.notes||''; $('btnAddPhysLoc').textContent='💾 Guardar ubicación'; $('btnCancelPhysLocEdit').style.display=''; }
function renderPhysicalLocations(){
  ensurePhysicalLocationModel();
  const el=$('physLocList');
  const cnt=$('physLocCnt'); if(cnt) cnt.textContent=(S.physicalLocations||[]).length;
  if(!el) return;
  clearNode(el);
  const items=S.physicalLocations.slice().sort((a,b)=>cmpMixed(a.name,b.name));
  if(!items.length){ setSingleHint(el,'Aún no hay ubicaciones físicas definidas.'); return; }
  items.forEach(l=>{
    const p=l.parentId?physLocById(l.parentId):null;
    const used=(S.hosts||[]).filter(h=>cleanStr(h.physicalLocation).toLowerCase()===l.name.toLowerCase()).length;
    const usedDev=(S.devices||[]).filter(d=>cleanStr(d.physicalLocation).toLowerCase()===l.name.toLowerCase()).length;
    const row=makeEl('div','hrow'); const info=makeEl('div','hinfo'); const hn=makeEl('div','hn');
    appendText(hn,l.name||''); hn.appendChild(document.createTextNode(' ')); hn.appendChild(makeEl('span','b bac',locTypeLabel(l.type)));
    const meta=[p?`Dentro de ${p.name}`:'Sin superior', l.distance?`${l.distance} m`:'', usedDev?`${usedDev} equipo(s)`:'', used?`${used} host(s)`:'' ].filter(Boolean).join(' · ');
    info.append(hn,makeEl('div','hm',meta));
    const actions=document.createElement('div'); actions.style.display='flex'; actions.style.gap='4px';
    const edit=makeEl('button','btn bs bxs','✎'); edit.type='button'; edit.addEventListener('click',()=>startPhysicalLocationEdit(l.id));
    const del=makeEl('button','btn bd bxs','🗑'); del.type='button'; del.addEventListener('click',()=>deletePhysicalLocation(l.id,true));
    actions.append(edit,del); row.append(info,actions); el.appendChild(row);
  });
}


// =========================================================
// 02.1 ORDENACIÓN DE TABLAS
// Helpers de ordenación reutilizados por listados y tablas.
// =========================================================
function setTableSort(name,key){
  const cur=S.uiSort[name]||{};
  S.uiSort[name]={key,dir:(cur.key===key?-(cur.dir||1):1)};
  save(); refresh();
}
function sortIndicator(name,key){ const cur=S.uiSort[name]||{}; return cur.key===key ? (cur.dir===-1?' ▼':' ▲') : ''; }
function sortableTh(name,key,label){ return `<th style="cursor:pointer;user-select:none;" onclick="setTableSort('${name}','${key}')">${label}${sortIndicator(name,key)}</th>`; }
const cmpMixed=NWCore.cmpMixed||((a,b)=>{
  const na=parseFloat(a), nb=parseFloat(b);
  if(!Number.isNaN(na) && !Number.isNaN(nb)) return na-nb;
  return cleanStr(a).localeCompare(cleanStr(b),'es',{numeric:true,sensitivity:'base'});
});



// =========================================================
// 03. HELPERS COMUNES E IP/SUBNETTING
// Utilidades generales, parsing de IP/CIDR, normalización de subnets y lookups sobre el estado.
// =========================================================
const uid=NWCore.uid||((p)=>p+Math.random().toString(36).slice(2)+Date.now().toString(36));

// ── IP UTILS ──
const NWU=window.NetWizardNetworkUtils||{};
const parseIp=NWU.parseIp||((ip)=>{const p=(ip||'').trim().split('.');if(p.length!==4)return null;let n=0;for(const x of p){if(!/^\d+$/.test(x))return null;const v=+x;if(v<0||v>255)return null;n=(n<<8)|v;}return n>>>0;});
const ip4s=NWU.ip4s||((n)=>{n=n>>>0;return[(n>>>24)&255,(n>>>16)&255,(n>>>8)&255,n&255].join('.');});
const parseCidr=NWU.parseCidr||((cidr)=>{const m=(cidr||'').trim().match(/^(\d{1,3}(?:\.\d{1,3}){3})\/(\d{1,2})$/);if(!m)return null;const ip=parseIp(m[1]);const pfx=+m[2];if(ip===null||pfx>32)return null;const mask=pfx===0?0:(0xFFFFFFFF<<(32-pfx))>>>0;const net=(ip&mask)>>>0;const bc=(net|(~mask>>>0))>>>0;return{ip,pfx,mask,net,bc,fh:pfx>=31?null:(net+1)>>>0,lh:pfx>=31?null:(bc-1)>>>0,cidr:`${ip4s(net)}/${pfx}`};});
const msk=m=>NWCore.maskToString?NWCore.maskToString(m,ip4s):ip4s(m>>>0);
const ipInSn=NWU.ipInSn||((ipStr,cidr)=>{const ip=parseIp(ipStr);const c=parseCidr(cidr);if(ip===null||!c)return false;return ip>=c.net&&ip<=c.bc;});
const cidrOverlaps=NWU.cidrOverlaps||((a,b)=>{const ca=parseCidr(a),cb=parseCidr(b);return !!(ca&&cb&&ca.net<=cb.bc&&cb.net<=ca.bc);});
const findSubnetOverlap=NWU.findSubnetOverlap||((candidateCidr,subnets,options={})=>{const cc=parseCidr(candidateCidr);if(!cc)return null;for(const sn of Array.isArray(subnets)?subnets:[]){if(!sn?.cidr)continue;if(options.ignoreSubnetId&&sn.id===options.ignoreSubnetId)continue;if(options.ignoreVlanRef&&sn.vlanRef===options.ignoreVlanRef)continue;const sc=parseCidr(sn.cidr);if(sc&&cc.net<=sc.bc&&sc.net<=cc.bc)return{subnet:sn,candidate:cc,existing:sc};}return null;});
const validateSubnetAssignment=NWU.validateSubnetAssignment||((input,subnets)=>{const data=input||{};const vlanRef=data.vlanRef||'';const cidr=(data.cidr||'').trim();const gateway=(data.gateway||'').trim();if(!vlanRef)return{ok:false,msg:'Selecciona una VLAN.'};const ci=parseCidr(cidr);if(!ci)return{ok:false,msg:'CIDR inválido. Usa formato tipo 10.10.10.0/24.'};const normalized=`${ip4s(ci.net)}/${ci.pfx}`;if(gateway){if(parseIp(gateway)===null)return{ok:false,msg:'Gateway inválido.'};if(!ipInSn(gateway,normalized))return{ok:false,msg:'El gateway no pertenece a la subnet indicada.'};const gip=parseIp(gateway);if(ci.pfx<31&&(gip===ci.net||gip===ci.bc))return{ok:false,msg:'El gateway no puede ser la dirección de red ni broadcast.'};}const overlap=findSubnetOverlap(normalized,subnets,{ignoreSubnetId:data.existingSubnetId||'',ignoreVlanRef:vlanRef});if(overlap)return{ok:false,msg:`La subnet ${normalized} se solapa con ${overlap.subnet.cidr}.`,overlap};return{ok:true,cidr:normalized,ci,gateway:gateway||null,msg:normalized!==cidr?`CIDR normalizado a ${normalized}.`:''};});
const parseCidrInputDetailed=cidr=>{
  const raw=(cidr||'').trim();
  if(!raw)return {ok:false,msg:'Debes indicar un bloque base en formato IP/prefijo, por ejemplo 10.10.0.0/16.'};
  const m=raw.match(/^(\d{1,3}(?:\.\d{1,3}){3})\/(\d{1,2})$/);
  if(!m)return {ok:false,msg:`Formato inválido: "${raw}". Usa algo como 172.16.10.0/24.`};
  const ip=parseIp(m[1]);
  const pfx=+m[2];
  if(ip===null)return {ok:false,msg:`La IP base "${m[1]}" no es válida.`};
  if(pfx<0||pfx>32)return {ok:false,msg:`El prefijo /${pfx} no es válido. Debe estar entre /0 y /32.`};
  const c=parseCidr(raw);
  if(!c)return {ok:false,msg:`No se pudo interpretar el bloque "${raw}".`};
  const normalized=`${ip4s(c.net)}/${c.pfx}`;
  const note=(c.ip!==c.net)?`Se ha normalizado ${raw} a la red ${normalized}.` : '';
  return {ok:true,cidr:normalized,ci:c,note};
};
function subnettingExplain(baseRaw,pfx,vlanCount){
  const r=parseCidrInputDetailed(baseRaw);
  if(!r.ok)return r;
  const bc=r.ci;
  if(!Number.isFinite(pfx))return {ok:false,msg:'El prefijo por VLAN no es válido.'};
  if(pfx < bc.pfx)return {ok:false,msg:`El prefijo por VLAN /${pfx} es más grande que el bloque base ${r.cidr}. Usa /${bc.pfx} o mayor (por ejemplo /${bc.pfx+1}).`,note:r.note};
  const capacity = 2 ** Math.max(0, pfx - bc.pfx);
  if(vlanCount > capacity)return {ok:false,msg:`El bloque ${r.cidr} solo permite ${capacity} subred(es) de tamaño /${pfx}, pero tienes ${vlanCount} VLAN(s). Reduce VLANs o usa un bloque mayor.`,note:r.note};
  return {ok:true,base:r.cidr,ci:bc,note:r.note,capacity};
}


// ── LOOKUPS ──
const devById=id=>S.devices.find(d=>d.id===id)||null;
const vByRef=r=>S.vlans.find(v=>v.id===r)||null;
const vByNum=n=>S.vlans.find(v=>v.vlanId===n)||null;
const snByVRef=r=>S.subnets.find(s=>s.vlanRef===r)||null;
const portsByDev=did=>S.ports.filter(p=>p.deviceId===did);
const isLinked=pid=>S.links.some(l=>l.aPortId===pid||l.bPortId===pid);
const portDisp=p=>{const d=devById(p.deviceId);return`${d?.name||'?'} :: ${p.name}`;};
const vColor=ref=>{const v=S.vlans.find(x=>x.id===ref);const i=S.vlans.findIndex(x=>x.id===ref);return v?.color||VCOLS[i%VCOLS.length]||'#3b82f6';};
const parseAllowed=NWCore.parseAllowed||((str)=>Array.from(new Set((str||'').split(',').map(x=>parseInt(x.trim(),10)).filter(n=>isFinite(n)&&n>=1&&n<=4094))).sort((a,b)=>a-b));

// ── PORT NAME BUILDER ──
const buildPName=NWCore.buildPortName||((vendorOs,media,pos,base)=>{
  const b=(base||'').trim();
  if(vendorOs==='cisco_ios'||vendorOs==='cisco_asa'){const sfx=b?`${b}${pos}`:`0/${pos}`;return media==='FE'?`FastEthernet${sfx}`:`GigabitEthernet${sfx}`;}
  if(vendorOs==='juniper_junos'){const sfx=b?`${b}${pos-1}`:`0/0/${pos-1}`;return`ge-${sfx}`;}
  if(vendorOs==='aruba_aoss')return b?`${b}${pos}`:`1/1/${pos}`;
  return`${media}${pos}`;
});



// =========================================================
// 04. GENERADORES DE CONFIGURACIÓN
// Generación de configuraciones por vendor/OS y salida comentada para aprendizaje/documentación.
// =========================================================
function getVtpRole(devId){return (S.vtp?.roles&&S.vtp.roles[devId])||'off';}
function buildCommentedConfig(cfg){
  const lines=(cfg||'').split(/\r?\n/);
  const out=[];
  const explain=line=>{
    const t=(line||'').trim();
    if(!t) return '';
    if(t==='!') return i18nText('deploy.explain.separator',{},'Separador visual en la configuración.');
    if(/^! /.test(t)) return i18nText('deploy.explain.comment',{},'Comentario o cabecera informativa.');
    if(t==='configure terminal') return i18nText('deploy.explain.configureTerminal',{},'Entra al modo de configuración global.');
    if(t==='end') return i18nText('deploy.explain.end',{},'Sale del modo de configuración.');
    if(t==='write memory') return i18nText('deploy.explain.writeMemory',{},'Guarda la configuración en memoria.');
    if(/^hostname\s+/.test(t)) return i18nText('deploy.explain.hostname',{},'Asigna el nombre del dispositivo.');
    if(/^vlan\s+\d+/.test(t)) return i18nText('deploy.explain.vlan',{},'Crea o selecciona la VLAN indicada.');
    if(/^name\s+/.test(t)) return i18nText('deploy.explain.vlanName',{},'Asigna un nombre descriptivo a la VLAN.');
    if(/^vtp domain\s+/.test(t)) return i18nText('vtp.explain.domain',{},'Define el dominio VTP; todos los switches VTP deben compartirlo.');
    if(/^vtp password\s+/.test(t)) return i18nText('vtp.explain.password',{},'Establece la contraseña VTP común entre switches.');
    if(/^vtp mode\s+server/.test(t)) return i18nText('vtp.explain.server',{},'Este switch actuará como servidor VTP y publicará las VLAN.');
    if(/^vtp mode\s+client/.test(t)) return i18nText('vtp.explain.client',{},'Este switch actuará como cliente VTP y recibirá las VLAN del servidor.');
    if(/^vtp mode\s+transparent/.test(t)) return i18nText('vtp.explain.transparent',{},'Modo transparente: no aprende VLAN por VTP, pero reenvía anuncios.');
    if(/^vtp version\s+/.test(t)) return i18nText('vtp.explain.version',{},'Fija la versión de VTP usada en el dominio.');
    if(/^vtp pruning/.test(t)) return i18nText('vtp.explain.pruning',{},'Activa VTP pruning para reducir tráfico innecesario en trunks.');
    if(/^interface\s+/.test(t)) return i18nText('deploy.explain.interface',{},'Entra en la configuración de la interfaz indicada.');
    if(/^description\s+/.test(t)) return i18nText('deploy.explain.description',{},'Añade una descripción a la interfaz.');
    if(t==='switchport') return i18nText('deploy.explain.switchport',{},'Habilita parámetros de capa 2 de switchport.');
    if(t==='switchport nonegotiate') return i18nText('deploy.explain.nonegotiate',{},'Desactiva DTP para que el trunk no se negocie automáticamente.');
    if(t==='switchport mode access') return i18nText('deploy.explain.accessMode',{},'Configura el puerto como acceso para una única VLAN.');
    if(/^switchport access vlan\s+/.test(t)) return i18nText('deploy.explain.accessVlan',{},'Asocia el puerto de acceso a la VLAN indicada.');
    if(t==='switchport mode trunk') return i18nText('deploy.explain.trunkMode',{},'Configura el puerto como trunk para transportar varias VLAN.');
    if(/^switchport trunk native vlan\s+/.test(t)) return i18nText('deploy.explain.nativeVlan',{},'Define la VLAN nativa del trunk.');
    if(/^switchport trunk allowed vlan\s+/.test(t)) return i18nText('deploy.explain.allowedVlans',{},'Limita las VLAN permitidas por el trunk.');
    if(/^spanning-tree portfast/.test(t)) return i18nText('deploy.explain.portfast',{},'Acelera la transición del puerto de acceso a forwarding.');
    if(/^spanning-tree bpduguard enable/.test(t)) return i18nText('deploy.explain.bpduguard',{},'Protege el puerto apagándolo si recibe BPDUs.');
    if(/^switchport port-security/.test(t)) return i18nText('deploy.explain.portSecurity',{},'Activa seguridad de puerto y control de MACs.');
    if(/^ip dhcp snooping/.test(t)) return i18nText('deploy.explain.dhcpSnooping',{},'Activa o ajusta DHCP Snooping para proteger frente a servidores DHCP falsos.');
    if(/^ip arp inspection/.test(t)) return i18nText('deploy.explain.dai',{},'Activa o ajusta Dynamic ARP Inspection.');
    if(/^ip verify source/.test(t)) return i18nText('deploy.explain.ipSourceGuard',{},'Activa IP Source Guard en el puerto.');
    if(/^no shutdown/.test(t)) return i18nText('deploy.explain.noShutdown',{},'Habilita administrativamente la interfaz.');
    if(t==='exit') return i18nText('deploy.explain.exit',{},'Vuelve al modo de configuración anterior.');
    if(/^encapsulation dot1Q\s+/.test(t)) return i18nText('deploy.explain.dot1q',{},'Etiqueta la subinterfaz con la VLAN indicada para RoaS.');
    if(/^ip address\s+/.test(t)) return i18nText('deploy.explain.ipAddress',{},'Asigna dirección IP y máscara a la interfaz.');
    if(/^ip route\s+0\.0\.0\.0/.test(t)) return i18nText('deploy.explain.defaultRoute',{},'Crea la ruta por defecto hacia el siguiente salto.');
    if(/^ip nat inside source list/.test(t)) return i18nText('deploy.explain.nat',{},'Configura NAT overload para salida a Internet.');
    if(/^access-list\s+/.test(t)) return i18nText('deploy.explain.acl',{},'Define una ACL o regla usada por NAT/filtrado.');
    if(/^ip dhcp pool\s+/.test(t)) return i18nText('deploy.explain.dhcpPool',{},'Crea un pool DHCP para la red indicada.');
    if(/^network\s+/.test(t)) return i18nText('deploy.explain.network',{},'Define la red atendida por el pool DHCP.');
    if(/^default-router\s+/.test(t)) return i18nText('deploy.explain.defaultRouter',{},'Indica la puerta de enlace entregada por DHCP.');
    if(/^dns-server\s+/.test(t)) return i18nText('deploy.explain.dnsServer',{},'Define los DNS que dará el servicio DHCP.');
    if(/^lease\s+/.test(t)) return i18nText('deploy.explain.lease',{},'Establece la duración de la concesión DHCP.');
    return i18nText('deploy.explain.generatedLine',{},'Línea de configuración generada automáticamente.');
  };
  for(const line of lines){
    if(line.trim()) out.push(line+'    ! '+explain(line));
    else out.push('');
  }
  return out.join('\n');
}

// ─────────────────── CONFIG GENERATOR ADAPTER ───────────────────
// La implementación histórica vive en netwizard-legacy-config-generator.js.
// Source/Pages/offline la cargan; Docker/SaaS la excluye y usa Private Engine.

function localConfigGenerator(){
  return window.NetWizardLegacyConfigGenerator&&typeof window.NetWizardLegacyConfigGenerator.generate==='function'
    ? window.NetWizardLegacyConfigGenerator
    : null;
}
function localConfigGenerationAvailable(){return !!localConfigGenerator();}
function genFwAcl(){
  const api=localConfigGenerator();
  return api&&typeof api.genFwAcl==='function'?api.genFwAcl(S):'';
}

// =========================================================
// 04.1 ACLS, MATRIZ E INFORMES DE EXPORTACIÓN
// La matriz VLAN y el CSV siguen siendo utilidades locales no propietarias.
// =========================================================
function genVlanMatrixAcl(){
  const L=['!','! Inter-VLAN ACLs (from matrix)'];
  for(const va of S.vlans.slice().sort((a,b)=>a.vlanId-b.vlanId)){
    const snA=snByVRef(va.id);if(!snA)continue;
    const ciA=parseCidr(snA.cidr);if(!ciA)continue;
    L.push(`ip access-list extended INTER_VLAN_${va.vlanId}`);
    for(const vb of S.vlans.slice().sort((a,b)=>a.vlanId-b.vlanId)){
      if(va.id===vb.id)continue;const snB=snByVRef(vb.id);if(!snB)continue;const ciB=parseCidr(snB.cidr);if(!ciB)continue;
      const key=`${va.id}_${vb.id}`;const allow=S.vlanMatrix[key]!==false;
      L.push(` ${allow?'permit':'deny'} ip ${ip4s(ciA.net)} ${ip4s(~ciA.mask>>>0)} ${ip4s(ciB.net)} ${ip4s(~ciB.mask>>>0)} ! → VLAN${vb.vlanId}`);
    }
    L.push(' permit ip any any ! Allow Internet','exit');
  }
  return L.join('\n')+'\n';
}

function genHostCsv(){
  const rows=['Nombre,Tipo,VLAN,IP,MAC,Puerto,Notas'];
  for(const h of S.hosts){const v=vByRef(h.vlanRef);const resolvedPortId=hostResolvedPortId(h);const p=resolvedPortId?S.ports.find(x=>x.id===resolvedPortId):null;const pd=p?devById(p.deviceId):null;rows.push([h.name,HT[h.type]?.l||h.type,v?v.vlanId+' '+v.name:'',h.ipMode==='static'?h.staticIp||'':'DHCP',h.mac||'',p?(pd?.name+':'+p.name):'',h.notes||''].map(x=>`"${(x||'').replace(/"/g,'""')}"`).join(','));}
  return rows.join('\n');
}

// MAIN CONFIG DISPATCH
function privateConfigArtifact(devId){
  const api=window.NetWizardPrivateDeploymentUi;
  return api&&typeof api.deviceConfig==='function'?api.deviceConfig(devId):null;
}
function privateConfigStatus(devId){
  const api=window.NetWizardPrivateDeploymentUi;
  return api&&typeof api.deviceStatus==='function'?api.deviceStatus(devId):null;
}
function genConfig(devId,format){
  const d=devById(devId);if(!d)return'';
  const api=localConfigGenerator();
  if(api)return api.generate(S,devId,format);
  const assigned=cliText(d.vendorOs||'sin-vendor',80),requested=cliText(format||d.vendorOs||'sin-vendor',80);
  const privateArtifact=privateConfigArtifact(devId);
  if(privateArtifact&&requested!==assigned){
    return i18nText('deploy.private.crossPreview',{assigned,requested},'! El Private Engine generó este dispositivo para {assigned}.\n! La previsualización cruzada como {requested} no está disponible en producción.\n! Cambia Vendor/OS del dispositivo y vuelve a generar Private Deployment Plan.\n');
  }
  const status=privateConfigStatus(devId);
  if(status&&['unsupported','generation-error','missing-artifact','not-generated','stale'].includes(status.status)){
    const reasons=(status.reasons||[]).filter(Boolean);
    return i18nText('deploy.private.status',{status:status.status.toUpperCase(),assigned,reasons:reasons.map(reason=>'! '+reason).join('\n')},'! Private Engine: {status} para {assigned}.\n{reasons}\n! Revisa “Diagnóstico de generación” en Private Deployment Plan y corrige el dispositivo antes de regenerar.\n');
  }
  return i18nText('deploy.private.pendingConfig',{assigned},'! Configuración privada pendiente para {assigned}.\n! Genera el artefacto desde Private Deployment Plan / Private Engine self-hosted.\n! Cuando termine, esta vista mostrará aquí la configuración server-side del dispositivo.\n');
}
function configForView(devId,format){
  const d=devById(devId);if(!d)return'';
  const assigned=cliText(d.vendorOs||'sin-vendor',80),requested=cliText(format||d.vendorOs||'sin-vendor',80);
  const privateArtifact=privateConfigArtifact(devId);
  if(privateArtifact&&(!format||requested===assigned))return privateArtifact.content||'';
  return genConfig(devId,format);
}
function configReadinessForView(devId,format){
  const d=devById(devId);if(!d)return{status:'missing-device',reasons:['Dispositivo no disponible.'],source:'none'};
  const assigned=cliText(d.vendorOs||'sin-vendor',80),requested=cliText(format||d.vendorOs||'sin-vendor',80);
  const privateArtifact=privateConfigArtifact(devId);
  if(privateArtifact&&(!format||requested===assigned)){
    const raw=privateArtifact.readiness||{},status=cliText(raw.status||'',40);
    const capability=privateArtifact.capability||{};
    return{
      status:status||'review-required',
      reasons:Array.isArray(raw.reasons)&&raw.reasons.length?raw.reasons:['Artefacto privado sin clasificación de readiness; revisar antes de aplicar.'],
      source:'private',
      mode:cliText(capability.mode||'',30),
      kind:cliText(capability.kind||'',40),
      certification:cliText(capability.certification||'',40)
    };
  }
  if(localConfigGenerationAvailable()){
    return{status:'source-preview',reasons:['Generación local/source para diseño y compatibilidad. No certifica apply-ready en SaaS.'],source:'local'};
  }
  const privateStatus=privateConfigStatus(devId);
  if(privateStatus&&privateStatus.status&&privateStatus.status!=='pending'){
    const capability=privateStatus.capability||{};
    return{
      status:privateStatus.status,
      reasons:Array.isArray(privateStatus.reasons)?privateStatus.reasons:[],
      source:'private',
      mode:cliText(capability.mode||'',30),
      kind:cliText(capability.kind||'',40),
      certification:cliText(capability.certification||'',40)
    };
  }
  return{status:'pending',reasons:[i18nText('deploy.readiness.privatePendingReason',{},'Private Engine está disponible, pero todavía no existe un artefacto generado para este dispositivo.')],source:'private'};
}
function paintConfigReadiness(nodeId,devId,format){
  const node=$(nodeId);if(!node)return;
  const r=configReadinessForView(devId,format),reasons=(r.reasons||[]).filter(Boolean);
  const modeLabel=r.mode==='cli'?'CLI PRIVADA':r.mode==='script'?'SCRIPT PRIVADO':r.mode==='procedure'?'PROCEDIMIENTO':'';
  let label=i18nText('deploy.config.pending',{},'Estado de aplicación pendiente.'),cls='co co-ac';
  if(r.status==='apply-ready'){
    label='✅ '+(modeLabel?modeLabel+' · ':'')+i18nText('deploy.readiness.applyReady',{},'APPLY-READY · Artefacto privado estructuralmente aplicable. La Production Gate global debe seguir en READY.');
    cls='co co-gn';
  }else if(r.status==='review-required'){
    label='⚠ '+(modeLabel?modeLabel+' · ':'')+i18nText('deploy.readiness.reviewRequired',{reasons:reasons.join(' ')||i18nText('deploy.readiness.reviewFallback',{},'Revisa el artefacto antes de aplicarlo.')},'REVISIÓN OBLIGATORIA · {reasons}');
  }else if(r.status==='procedure-only'){
    label='ℹ '+i18nText('deploy.readiness.procedure',{reasons:reasons.join(' ')||''},'PROCEDIMIENTO · No es una CLI universal para pegar directamente. {reasons}');
  }else if(r.status==='source-preview'){
    label='🧪 '+i18nText('deploy.readiness.localPreview',{reasons:reasons.join(' ')},'PREVIEW LOCAL/SOURCE · {reasons}');
  }else if(r.status==='unsupported'){
    label='⛔ '+i18nText('deploy.readiness.unsupported',{reasons:reasons.join(' ')},'NO SOPORTADO · {reasons}');
    cls='co co-rd';
  }else if(r.status==='generation-error'||r.status==='missing-artifact'){
    label='❌ '+i18nText('deploy.readiness.generationError',{reasons:reasons.join(' ')},'ERROR DE GENERACIÓN · {reasons}');
    cls='co co-rd';
  }else if(r.status==='stale'){
    label='♻ '+i18nText('deploy.readiness.stale',{reasons:reasons.join(' ')},'CONFIG OBSOLETA · {reasons}');
    cls='co co-rd';
  }else if(r.status==='not-generated'){
    label='⚠ '+i18nText('deploy.readiness.noArtifact',{reasons:reasons.join(' ')},'SIN ARTEFACTO · {reasons}');
  }else if(r.status==='pending'){
    label='☁ '+i18nText('deploy.readiness.privatePending',{reasons:reasons.join(' ')},'PRIVATE ENGINE PENDIENTE · {reasons}');
  }else{
    label='⚠ '+i18nText('deploy.readiness.unavailable',{reasons:reasons.join(' ')},'Estado de aplicación no disponible. {reasons}');
  }
  node.className=cls;
  node.textContent=label.trim();
}

// =========================================================
// 05. NAVEGACIÓN, DASHBOARD Y ASISTENTE
// Cambio de pantallas, panel principal y asistente automático de escenarios.
// =========================================================
function navigationOrder(){
  return S.workflow?.mode==='inventory'?INVENTORY_STEP_ORDER:DESIGN_STEP_ORDER;
}
function normalizeWorkflowStep(step){
  if(S.workflow?.mode==='inventory'&&step==='wiz')return'loc';
  return step;
}
function navTo(step){
  S.step=normalizeWorkflowStep(step);
  save({source:'navigation',silent:true,notify:false,skipNormalize:true});
  refresh();
  document.dispatchEvent(new CustomEvent('nw:view:changed',{detail:{step:S.step}}));
}
function projectCounters(project=S){
  const p=project||{},iot=p.iot||{};
  return{
    devices:Array.isArray(p.devices)?p.devices.length:0,
    vlans:Array.isArray(p.vlans)?p.vlans.length:0,
    hosts:Array.isArray(p.hosts)?p.hosts.length:0,
    iot:(Array.isArray(iot.accessNodes)?iot.accessNodes.length:0)+(Array.isArray(iot.devices)?iot.devices.length:0),
    fwRules:Array.isArray(p.fwRules)?p.fwRules.length:0
  };
}

$('hbg').onclick=()=>{$('sb').classList.toggle('open');document.body.classList.toggle('ov');};
document.addEventListener('click',e=>{if($('sb').classList.contains('open')&&!$('sb').contains(e.target)&&!$('hbg').contains(e.target)){$('sb').classList.remove('open');document.body.classList.remove('ov');}});
document.querySelectorAll('.sb-it[data-step]').forEach(el=>el.onclick=()=>{navTo(el.dataset.step);$('sb').classList.remove('open');document.body.classList.remove('ov');});
document.querySelectorAll('.bnit[data-step]').forEach(el=>el.onclick=()=>navTo(el.dataset.step));

const stepIdx=s=>navigationOrder().indexOf(s);
$('prevBtn').onclick=()=>{const order=navigationOrder(),i=order.indexOf(S.step);if(i>0)navTo(order[i-1]);};
$('nextBtn').onclick=()=>{const order=navigationOrder(),i=order.indexOf(S.step);if(i<order.length-1)navTo(order[i+1]);else alert((window.NetWizardI18n?window.NetWizardI18n.t('msg.projectComplete'): '¡Proyecto completo! Revisa Validación y genera los artefactos en Despliegue.'));};

// TABS
document.querySelectorAll('.tab[data-tab]').forEach(btn=>btn.onclick=()=>{
  const bar=btn.parentElement;
  bar.querySelectorAll('.tab').forEach(b=>b.classList.remove('on'));
  btn.classList.add('on');
  const id=btn.dataset.tab;
  const pg=btn.closest('.pg')||document;
  pg.querySelectorAll('.tc').forEach(tc=>tc.classList.toggle('on',tc.id===id));
  if(id==='fw-matrix')renderVlanMatrix();
});

function initLazyPanels(){
  const bind=(id,render)=>{
    const el=$(id);
    if(!el||el.dataset.lazyBound==='1')return;
    el.dataset.lazyBound='1';
    el.addEventListener('toggle',()=>{if(el.open)render();});
  };
  bind('ipMapPanel',renderIpMap);
  bind('dhcpPanel',renderDhcp);
}

// ─────────────────── RENDER NAV ───────────────────
function renderNav(){
  const safeStep=normalizeWorkflowStep(S.step);if(safeStep!==S.step)S.step=safeStep;
  document.querySelectorAll('.sb-it[data-step]').forEach(el=>el.classList.toggle('on',S.step===el.dataset.step));
  document.querySelectorAll('.bnit[data-step]').forEach(el=>el.classList.toggle('on',S.step===el.dataset.step));
  document.querySelectorAll('.pg').forEach(pg=>pg.classList.remove('on'));
  const pg=$(`pg-${S.step}`);if(pg)pg.classList.add('on');
  const noFt=['dash','wiz'];
  $('navFt').style.display=noFt.includes(S.step)?'none':'flex';
  const order=navigationOrder(),i=order.indexOf(S.step);
  $('prevBtn').disabled=i<=0;
  $('nextBtn').textContent=i>=order.length-1?'Finalizar':'Siguiente →';
  const counts=projectCounters(S);
  const setSide=(id,count,label)=>{const el=$(id); if(!el)return; clearNode(el); const b=document.createElement('b'); b.textContent=String(count); el.append(b,document.createTextNode(` ${label}`));};
  setSide('sbD',counts.devices,'dispositivos');
  setSide('sbV',counts.vlans,'VLANs');
  setSide('sbH',counts.hosts,'hosts');
  setSide('sbIOT',counts.iot,'IoT');
  setSide('sbFW',counts.fwRules,'reglas FW');
  if(S.step==='iot'&&window.NetWizardIoTEmbedded&&window.NetWizardIoTEmbedded.render){setTimeout(window.NetWizardIoTEmbedded.render,0);}
  if(S.step==='graphs')setTimeout(()=>{drawTopo();resizeV5();renderV5Panel();},50);
}

// ─────────────────── DASHBOARD ───────────────────
function renderDash(){
  $('projLbl').textContent=S.projName||'Sin título';
  $('projName').value=S.projName||'';

  const stats=$('dStats'); clearNode(stats);
  const counts=projectCounters(S);
  [
    ['var(--ac)', counts.devices, 'Dispositivos'],
    ['var(--gn)', counts.vlans, 'VLANs'],
    ['var(--yw)', counts.hosts, 'Hosts'],
    ['var(--pu)', counts.fwRules, 'Reglas FW']
  ].forEach(([color,value,label])=>{
    const stat=makeEl('div','stat'); stat.style.borderTopColor=color;
    const sv=makeEl('div','sv',value); sv.style.color=color;
    const sl=makeEl('div','sl',label);
    stat.append(sv,sl); stats.appendChild(stat);
  });

  const DASH_DEVICE_LIMIT=20,DASH_VLAN_LIMIT=24,DASH_HOST_VLAN_LIMIT=10,DASH_HOSTS_PER_VLAN=6;
  const portCountByDevice=new Map(),hostCountByVlan=new Map(),hostsByVlan=new Map(),subnetByVlan=new Map();
  for(const p of S.ports||[])portCountByDevice.set(p.deviceId,(portCountByDevice.get(p.deviceId)||0)+1);
  for(const sn of S.subnets||[])if(sn.vlanRef&&!subnetByVlan.has(sn.vlanRef))subnetByVlan.set(sn.vlanRef,sn);
  for(const h of S.hosts||[]){
    hostCountByVlan.set(h.vlanRef,(hostCountByVlan.get(h.vlanRef)||0)+1);
    if(!hostsByVlan.has(h.vlanRef))hostsByVlan.set(h.vlanRef,[]);
    const bucket=hostsByVlan.get(h.vlanRef);
    if(bucket.length<DASH_HOSTS_PER_VLAN)bucket.push(h);
  }
  const sortedVlans=S.vlans.slice().sort((a,b)=>a.vlanId-b.vlanId);

  const dDevs=$('dDevs'); clearNode(dDevs);
  if(S.devices.length){
    const visible=S.devices.slice(0,DASH_DEVICE_LIMIT);
    const wrap=makeEl('div','tw'); const table=document.createElement('table');
    const thead=document.createElement('thead'); const hr=document.createElement('tr');
    ['Nombre','Tipo','Vendor','Pts'].forEach(t=>hr.appendChild(makeEl('th','',t))); thead.appendChild(hr); table.appendChild(thead);
    const tbody=document.createElement('tbody');
    visible.forEach(d=>{
      const tr=document.createElement('tr');
      const tdName=document.createElement('td'); const b=document.createElement('b'); b.textContent=d.name||''; tdName.appendChild(b); tr.appendChild(tdName);
      const tdType=document.createElement('td'); const sp=makeEl('span',`dtype dtype-${devKind(d).slice(0,2)}`); sp.textContent=`${devIcon(d)} ${devLabel(d)}`; tdType.appendChild(sp); tr.appendChild(tdType);
      const tdVendor=document.createElement('td'); tdVendor.appendChild(makeEl('span','b bac',d.vendorOs||'-')); tr.appendChild(tdVendor);
      tr.appendChild(makeEl('td','',portCountByDevice.get(d.id)||0));
      tbody.appendChild(tr);
    });
    table.appendChild(tbody); wrap.appendChild(table); dDevs.appendChild(wrap);
    if(S.devices.length>visible.length)dDevs.appendChild(makeEl('div','hint',`Mostrando ${visible.length} de ${S.devices.length} dispositivos. Abre Dispositivos para ver el inventario completo.`));
  } else dDevs.appendChild(makeEmpty('🖥','Sin dispositivos.\nUsa el Asistente para empezar.'));

  const dVlans=$('dVlans'); clearNode(dVlans);
  if(sortedVlans.length){
    const visible=sortedVlans.slice(0,DASH_VLAN_LIMIT);
    visible.forEach(v=>{
      const sn=subnetByVlan.get(v.id),hc=hostCountByVlan.get(v.id)||0;
      const row=makeEl('div','hrow'); const dot=makeEl('span','vd'); dot.style.background=v.color||vColor(v.id);
      const info=makeEl('div','hinfo'); info.append(makeEl('div','hn',`VLAN ${v.vlanId} — ${v.name||''}`),makeEl('div','hm',`${sn?sn.cidr:'Sin subnet'} · ${hc} hosts`));
      row.append(dot,info); if(sn)row.appendChild(makeEl('span','b bgn mono',sn.gateway||'')); dVlans.appendChild(row);
    });
    if(sortedVlans.length>visible.length)dVlans.appendChild(makeEl('div','hint',`Mostrando ${visible.length} de ${sortedVlans.length} VLANs.`));
  } else dVlans.appendChild(makeEmpty('🏷','Sin VLANs'));

  const dHosts=$('dHosts'); clearNode(dHosts);
  const vlansWithHosts=sortedVlans.filter(v=>(hostCountByVlan.get(v.id)||0)>0);
  if(vlansWithHosts.length){
    const visibleVlans=vlansWithHosts.slice(0,DASH_HOST_VLAN_LIMIT);
    visibleVlans.forEach(v=>{
      const total=hostCountByVlan.get(v.id)||0,hosts=hostsByVlan.get(v.id)||[];
      const block=document.createElement('div'); block.style.marginBottom='11px';
      const title=document.createElement('div'); title.style.fontSize='12px'; title.style.fontWeight='700'; title.style.marginBottom='5px'; title.style.display='flex'; title.style.alignItems='center'; title.style.gap='5px';
      const dot=makeEl('span','vd'); dot.style.background=v.color||vColor(v.id); title.append(dot,document.createTextNode(`VLAN ${v.vlanId} — ${v.name||''} `),makeEl('span','b bgr',total)); block.appendChild(title);
      const wrap=makeEl('div','tw'); const table=document.createElement('table'); const thead=document.createElement('thead'); const trh=document.createElement('tr');
      ['Nombre','Tipo','IP','MAC'].forEach(t=>trh.appendChild(makeEl('th','',t))); thead.appendChild(trh); table.appendChild(thead);
      const tbody=document.createElement('tbody');
      hosts.forEach(h=>{
        const tr=document.createElement('tr');
        const tdN=document.createElement('td'); appendText(tdN,`${HT[h.type]?.i||''} `); const b=document.createElement('b'); b.textContent=h.name||''; tdN.appendChild(b); tr.appendChild(tdN);
        tr.appendChild(makeEl('td','',HT[h.type]?.l||h.type||''));
        const tdIp=makeEl('td','mono'); tdIp.appendChild(makeEl('span',h.ipMode==='static'?'b bgn':'b bac',h.ipMode==='static'?(h.staticIp||''):'DHCP')); tr.appendChild(tdIp);
        tr.appendChild(makeEl('td','mono',h.mac||'—'));
        tbody.appendChild(tr);
      });
      table.appendChild(tbody); wrap.appendChild(table); block.appendChild(wrap);
      if(total>hosts.length)block.appendChild(makeEl('div','hint',`Mostrando ${hosts.length} de ${total} hosts de esta VLAN.`));
      dHosts.appendChild(block);
    });
    if(vlansWithHosts.length>visibleVlans.length)dHosts.appendChild(makeEl('div','hint',`Mostrando hosts de ${visibleVlans.length} de ${vlansWithHosts.length} VLANs con hosts.`));
  }else dHosts.appendChild(makeEmpty('💻','Sin hosts'));
}

$('saveProj').onclick=()=>{S.projName=($('projName').value||'').trim();save();$('projLbl').textContent=S.projName||'Sin título';};

// ─────────────────── WIZARD ───────────────────
let wScene='office';const wDevSel=new Set();
function renderWizardModeChoice(){
  const sc=SCENARIOS.find(x=>x.id===wScene);if(!sc)return;
  $('wStep2Card').style.display='none';$('wStep3Card').style.display='none';$('wModeCard').style.display='';
  const info=$('wModeInfo');clearNode(info);
  const title=document.createElement('b');title.textContent=sc.ico+' '+sc.name;info.appendChild(title);
  info.appendChild(document.createElement('br'));
  info.appendChild(document.createTextNode(sc.examplePresetId
    ? 'Puedes crear un diseño nuevo o cargar una Golden Path completa como punto de partida.'
    : 'Este escenario todavía se crea desde cero con el asistente.'));
  const load=$('wLoadExample');
  load.style.display=sc.examplePresetId?'':'none';
  load.disabled=!sc.examplePresetId;
  if(sc.examplePresetId){
    const label=load.querySelector('b');if(label)label.textContent='⭐ Cargar ejemplo · '+(sc.exampleLabel||sc.name);
  }
}
function renderWizard(){
  const grid=$('scGrid'); clearNode(grid);
  SCENARIOS.forEach(sc=>{
    const card=makeEl('div',`sccard${wScene===sc.id?' on':''}`); card.dataset.sc=sc.id;
    card.append(makeEl('div','scico',sc.ico), makeEl('div','scn',sc.name), makeEl('div','scd',sc.desc));
    if(sc.examplePresetId)card.appendChild(makeEl('div','b bgn',sc.certified?'Golden READY':'Ejemplo disponible'));
    card.addEventListener('click',()=>{
      wScene=card.dataset.sc;
      document.querySelectorAll('.sccard').forEach(c=>c.classList.remove('on'));card.classList.add('on');
      renderWizardModeChoice();
    });
    grid.appendChild(card);
  });
  renderDevPicker();
}
function renderDevPicker(){
  const root=$('devPicker'); clearNode(root);
  const sc=SCENARIOS.find(x=>x.id===wScene);
  DEV_PICKER.forEach(d=>{
    const card=makeEl('div',`dpcard${wDevSel.has(d.id)?' on':''}`); card.dataset.dp=d.id;
    card.append(makeEl('div','dpico',d.ico), makeEl('div','dpn',d.n), makeEl('div','dpc',d.d));
    card.addEventListener('click',()=>{const id=card.dataset.dp;if(wDevSel.has(id))wDevSel.delete(id);else wDevSel.add(id);card.classList.toggle('on');updateWizPreview();});
    root.appendChild(card);
  });
}
function updateWizPreview(){
  if(!wScene)return;
  const sc=SCENARIOS.find(x=>x.id===wScene);
  const out=$('wPreview'); clearNode(out);
  const addLine=(txt)=>{ out.appendChild(document.createTextNode(txt)); out.appendChild(document.createElement('br')); };
  const b1=document.createElement('b'); b1.textContent='Escenario:'; out.appendChild(b1); appendText(out,` ${sc.name}`); out.appendChild(document.createElement('br'));
  const b2=document.createElement('b'); b2.textContent='VLANs:'; out.appendChild(b2); out.appendChild(document.createElement('br'));
  for(const v of sc.vlans)addLine(`• VLAN ${v.id} — ${v.n}`);
  out.appendChild(document.createElement('br'));
  const b3=document.createElement('b'); b3.textContent='Dispositivos seleccionados:'; out.appendChild(b3); out.appendChild(document.createElement('br'));
  if(!wDevSel.size)addLine('(ninguno seleccionado)');
  else for(const id of wDevSel){const d=DEV_PICKER.find(x=>x.id===id);if(d)addLine(`• ${d.ico} ${d.n}`);}
}
$('wNewScenario').onclick=()=>{
  $('wModeCard').style.display='none';$('wStep2Card').style.display='';renderDevPicker();updateWizPreview();
};
$('wLoadExample').onclick=async()=>{
  const sc=SCENARIOS.find(x=>x.id===wScene);if(!sc?.examplePresetId)return;
  const registry=window.NetWizardWizardPresets;
  let preset=null;
  try{
    preset=registry&&typeof registry.load==='function'
      ?await registry.load(sc.examplePresetId)
      :(registry&&typeof registry.get==='function'?registry.get(sc.examplePresetId):null);
  }catch(err){
    console.error('NetWizard wizard example',err);
    return alert('No se pudo cargar el ejemplo Golden.');
  }
  if(!preset)return alert('El ejemplo Golden no está disponible.');
  if(!confirm(`¿Cargar "${sc.exampleLabel||sc.name}"? Reemplazará el proyecto actual por un ejemplo completo y editable.`))return;
  window.NetWizardState.replaceProject(preset,{source:'wizard-scenario-example'});
  navTo('dash');
};
$('wBackScenario').onclick=()=>{$('wModeCard').style.display='none';};
$('wNext2').onclick=()=>{$('wStep2Card').style.display='none';$('wStep3Card').style.display='';updateWizPreview();};
$('wBack1').onclick=()=>{$('wStep2Card').style.display='none';$('wModeCard').style.display='';};
$('wBack2').onclick=()=>{$('wStep3Card').style.display='none';$('wStep2Card').style.display='';};
['wBase','wSize'].forEach(id=>{$(id).oninput=updateWizPreview;});

$('wApply').onclick=()=>{
  if(!wScene)return alert('Selecciona un escenario.');
  const sc=SCENARIOS.find(x=>x.id===wScene);
  const base=$('wBase').value||'10.10.0.0/16';const szPfx=parseInt($('wSize').value)||24;
  const fwN=($('wFwN').value||'FW-EDGE-01').trim();const swN=($('wSwN').value||'SW-CORE-01').trim();
  const secLevel=$('wSec').value;
  if(!confirm(`¿Aplicar escenario "${sc.name}"? Se añadirá al proyecto actual.`))return;
  const subnetPlanner=window.NetWizardPlanner;
  const plannedVlanAdds=sc.vlans.filter(vd=>!S.vlans.some(v=>v.vlanId===vd.id)).map(vd=>({id:uid('vlan'),vlanId:vd.id,name:vd.n,color:vd.c}));
  let wizardSubnetPlan=null;
  if(plannedVlanAdds.length){
    if(!subnetPlanner||typeof subnetPlanner.buildFixedSubnetPlan!=='function'||typeof subnetPlanner.applySubnetPlan!=='function')return alert('Motor común de subnetting no disponible.');
    const planningProject=projectSnapshot();planningProject.vlans=(planningProject.vlans||[]).concat(plannedVlanAdds);
    wizardSubnetPlan=subnetPlanner.buildFixedSubnetPlan(planningProject,base,szPfx,{gatewayMode:'first',vlanRefs:plannedVlanAdds.map(v=>v.id)});
    if(!wizardSubnetPlan.ok)return alert(wizardSubnetPlan.msg||'No se pudo planificar el direccionamiento del escenario.');
  }
  // Devices
  let fwId=null,swId=null,apId=null;
  const addDev=(name,kind,vendorOs,edge,wanIf,extra={})=>{
    const existing=S.devices.find(d=>d.name===name);
    if(existing)return existing.id;
    const id=uid('dev');
    const raw={id,name,kind,type:kind,vendorOs,mgmtIp:null,notes:sc.name,internetEdge:edge||'no',wanIf:wanIf||null,layout:null,...extra};
    S.devices.push(NWDevice?NWDevice.normalizeDevice(raw):raw);
    S.topo.pos[id]={x:100+Math.random()*500,y:80+Math.random()*240};
    return id;
  };
  const addPort=(deviceId,name,mode,role,desc)=>{
    if(!deviceId||S.ports.some(p=>p.deviceId===deviceId&&p.name===name))return;
    S.ports.push({id:uid('port'),deviceId,name,media:'GE',mode,accessVlanRef:null,nativeVlanRef:null,allowedVlans:[],desc,position:null,role});
  };
  if(wDevSel.has('fw')){
    fwId=addDev(fwN,'firewall','cisco_asa','yes','GigabitEthernet0/0');
    addPort(fwId,'GigabitEthernet0/1','trunk','lan','LAN trunk');
    addPort(fwId,'GigabitEthernet0/0','routed','wan','WAN');
  }
  if(wDevSel.has('router')||(!wDevSel.has('fw')&&sc.id!=='custom')){
    const routerName=wDevSel.has('fw')?'RTR-WAN-01':fwN;
    const routerId=addDev(routerName,'router','cisco_ios',wDevSel.has('fw')?'no':'yes',wDevSel.has('fw')?null:'GigabitEthernet0/0');
    addPort(routerId,'GigabitEthernet0/1','trunk','lan','LAN trunk');
    if(!wDevSel.has('fw'))addPort(routerId,'GigabitEthernet0/0','routed','wan','WAN');
    if(!fwId)fwId=routerId;
  }
  if(wDevSel.has('coreSw')||sc.id!=='custom')swId=addDev(swN,'switch','cisco_ios');
  if(wDevSel.has('accSw')){const id2=addDev('SW-ACC-01','switch','cisco_ios');S.topo.pos[id2]={x:200,y:320};}
  if(wDevSel.has('ap')){
    apId=addDev('AP-01','access_point','generic_network','no',null,{wifiRole:'ap',hasWifi:true});
    addPort(apId,'eth0','trunk','uplink','Uplink AP / SSID VLANs');
  }
  // VLANs + subnetting through the common planner
  for(const vlan of plannedVlanAdds)S.vlans.push(vlan);
  if(wizardSubnetPlan&&wizardSubnetPlan.plans.length){
    const addressed=subnetPlanner.applySubnetPlan(S,wizardSubnetPlan,{replaceExisting:false,assignMode:'none'});
    S.subnets=addressed.subnets;
  }
  // Hosts from picker
  const pickVlan=(pattern)=>S.vlans.find(v=>pattern.test(v.name||''))||S.vlans[0]||null;
  const addHost=(name,type,vlan,extra={})=>{
    if(S.hosts.some(h=>h.name===name))return null;
    const host={id:uid('h'),name,type,vlanRef:vlan?.id||null,ipMode:'dhcp',staticIp:null,mac:null,portRef:null,notes:'Generado por asistente',...extra};
    S.hosts.push(host);return host;
  };
  if(wDevSel.has('server')){
    const sv=pickVlan(/servidor|backend|database|\bdb\b|frontend/i);
    const sn=sv?snByVRef(sv.id):null;const ci=sn?parseCidr(sn.cidr):null;addHost('SRV-Web','server',sv,{ipMode:'static',staticIp:ci?.fh?ip4s(ci.fh+1):null});
  }
  if(wDevSel.has('camera'))addHost('CAM-01','camera',pickVlan(/cámara|camara|video/i));
  if(wDevSel.has('ap'))addHost('AP-01','ap',pickVlan(/wifi|wlan|gestión|gestion/i),{deviceRef:apId});
  if(wDevSel.has('printer'))addHost('PRINTER-01','printer',pickVlan(/usuario|empleado|lan/i));
  if(wDevSel.has('pc'))addHost('PC-01','pc',pickVlan(/usuario|empleado|lan|dirección|direccion/i));
  if(wDevSel.has('phone'))addHost('PHONE-01','phone',pickVlan(/voz|voice|voip|usuario/i));
  if(wDevSel.has('iot'))addHost('IOT-01','iot',pickVlan(/iot|sensor/i));
  if(wDevSel.has('nvr'))addHost('NVR-01','server',pickVlan(/cámara|camara|video|servidor/i));
  // Security
  if(secLevel==='low')Object.assign(S.security,{bpdu:'no',ps:'no',ds:'no',dai:'no',ipsg:'no'});
  else if(secLevel==='med')Object.assign(S.security,{bpdu:'yes',ps:'yes',ds:'yes',dai:'no',ipsg:'no'});
  else Object.assign(S.security,{bpdu:'yes',ps:'yes',ds:'yes',dai:'yes',ipsg:'yes'});
  // FW rules base
  if(secLevel!=='low'&&!S.fwRules.length){S.fwRules.push({id:uid('fw'),name:'DNS saliente',src:'any',dst:'any',proto:'udp',port:'53',action:'allow',dir:'out',prio:10,enabled:true},{id:uid('fw'),name:'HTTP/HTTPS saliente',src:'any',dst:'any',proto:'tcp',port:'80,443',action:'allow',dir:'out',prio:20,enabled:true},{id:uid('fw'),name:'ICMP',src:'any',dst:'any',proto:'icmp',port:'any',action:'allow',dir:'both',prio:30,enabled:true});}
  // RoaS
  if(fwId){S.roas.gwId=fwId;S.roas.lanIf='GigabitEthernet0/1';}
  // Trunk allowed vlans
  for(const p of S.ports){if(p.mode==='trunk')p.allowedVlans=S.vlans.map(v=>v.vlanId).sort((a,b)=>a-b);}
  save();navTo('dev');
};

// ─────────────────── DEVICES ───────────────────
$('devType').onchange=()=>{const kind=$('devType').value;$('devEdgeSec').style.display=isEdgeDevice({kind})?'':'none';};
if($('devModel')) $('devModel').oninput=()=>renderDeviceModelHint();
if($('btnApplyModelCaps')) $('btnApplyModelCaps').onclick=()=>applyDeviceModelToForm();



// =========================================================
// 05.1 CATÁLOGO DE MODELOS Y CAPACIDADES
// Catálogo local inicial. Sirve para autocompletar modelos, marcar AP/router Wi‑Fi
// y generar puertos aproximados sin borrar configuración existente.
// =========================================================
const DEVICE_MODEL_CATALOG={
  'Cisco ISR 1121-8P':{vendorOs:'cisco_ios',kind:'router',ports:[['GigabitEthernet0/0/0','wan'],['GigabitEthernet0/0/1','lan'],['GigabitEthernet0/1/0','lan'],['GigabitEthernet0/1/1','lan'],['GigabitEthernet0/1/2','lan'],['GigabitEthernet0/1/3','lan'],['GigabitEthernet0/1/4','lan'],['GigabitEthernet0/1/5','lan'],['GigabitEthernet0/1/6','lan'],['GigabitEthernet0/1/7','lan']],wifi:false,noteKey:'device.catalog.isr1121_8p.note',notes:'ISR branch router con variante de 8 puertos LAN.'},
  'Cisco ISR 1121-4P':{vendorOs:'cisco_ios',kind:'router',ports:[['GigabitEthernet0/0/0','wan'],['GigabitEthernet0/0/1','lan'],['GigabitEthernet0/1/0','lan'],['GigabitEthernet0/1/1','lan'],['GigabitEthernet0/1/2','lan'],['GigabitEthernet0/1/3','lan']],wifi:false,noteKey:'device.catalog.isr1121_4p.note',notes:'ISR branch router con variante de 4 puertos LAN.'},
  'Cisco 886VAW':{vendorOs:'cisco_ios',kind:'router',ports:[['FastEthernet0','lan'],['FastEthernet1','lan'],['FastEthernet2','lan'],['FastEthernet3','lan'],['Vlan1','lan'],['ATM0','wan']],wifi:true,wifiStandards:['802.11n'],wifiRole:'integrated_router_wifi',noteKey:'device.catalog.886vaw.note',notes:'Router ISR 880 con WLAN integrada según variante.'},
  'Cisco IR1800':{vendorOs:'cisco_ios',kind:'router',ports:[['GigabitEthernet0/0','wan'],['GigabitEthernet0/1','lan'],['Cellular0/1/0','wan']],wifi:true,wifiStandards:['Wi‑Fi 6'],wifiRole:'integrated_router_wifi',noteKey:'device.catalog.ir1800.note',notes:'Router industrial con opciones 5G/LTE/Wi‑Fi según módulo.'},
  'UniFi U6 Pro':{vendorOs:'ubiquiti_unifi',kind:'access_point',ports:[['eth0','trunk']],wifi:true,wifiStandards:['Wi‑Fi 6'],wifiRole:'ap',noteKey:'device.catalog.u6pro.note',notes:'AP Wi‑Fi 6. Uplink normalmente trunk hacia VLANs de SSID y gestión.'},
  'UniFi U7 Pro':{vendorOs:'ubiquiti_unifi',kind:'access_point',ports:[['eth0','trunk']],wifi:true,wifiStandards:['Wi‑Fi 7'],wifiRole:'ap',noteKey:'device.catalog.u7pro.note',notes:'AP Wi‑Fi 7. Uplink trunk recomendado para múltiples SSID/VLAN.'},
  'Huawei AP generic':{vendorOs:'huawei_vrp',kind:'access_point',ports:[['GE0/0/1','trunk']],wifi:true,wifiStandards:['Wi‑Fi'],wifiRole:'ap',noteKey:'device.catalog.huaweiAp.note',notes:'AP Huawei gestionado por controlador/AC o cloud según modelo.'},
  'Galgus AP generic':{vendorOs:'galgus_cloud',kind:'access_point',ports:[['eth0','trunk']],wifi:true,wifiStandards:['Wi‑Fi'],wifiRole:'ap',noteKey:'device.catalog.galgusAp.note',notes:'AP Galgus gestionado por plataforma/cloud.'},
  'TP-Link Omada AP generic':{vendorOs:'tplink_omada',kind:'access_point',ports:[['eth0','trunk']],wifi:true,wifiStandards:['Wi‑Fi'],wifiRole:'ap',noteKey:'device.catalog.omadaAp.note',notes:'AP Omada con SSID/VLAN desde controlador.'},
  'MikroTik hAP ax3':{vendorOs:'mikrotik_routeros',kind:'router',ports:[['ether1','wan'],['ether2','lan'],['ether3','lan'],['ether4','lan'],['ether5','lan']],wifi:true,wifiStandards:['Wi‑Fi 6'],wifiRole:'integrated_router_wifi',noteKey:'device.catalog.hapAx3.note',notes:'Router con Wi‑Fi integrado y puertos Ethernet.'}
};
function modelKeyByName(name){const n=cleanStr(name).toLowerCase();return Object.keys(DEVICE_MODEL_CATALOG).find(k=>k.toLowerCase()===n)||'';}
function selectedDeviceModel(){const key=modelKeyByName($('devModel')?.value||'');return key?DEVICE_MODEL_CATALOG[key]:null;}
function initDeviceModelList(){
  const dl=$('devModelList'); if(!dl)return; clearNode(dl);
  Object.keys(DEVICE_MODEL_CATALOG).forEach(k=>dl.appendChild(makeOption(k,'')));
}
function initDeviceVendorSelect(){
  const select=$('devVendor');if(!select)return;
  const current=select.value;
  const vendors=NWDevice?NWDevice.vendors():(Array.isArray(window.ALL_VENDORS)?window.ALL_VENDORS:[]);
  setOptions(select,[makeOption('',i18nText('device.form.selectVendor',{},'— selecciona —')),...vendors.map(v=>makeOption(v.id,v.l))]);
  if(vendors.some(v=>v.id===current))select.value=current;
}
function initDeviceKindSelect(){
  const select=$('devType');if(!select)return;
  const current=select.value||'switch';
  const options=NWDevice?NWDevice.kindOptions().map(item=>({value:item.value,label:`${devIcon({kind:item.value})} ${deviceKindText(item.value)}`})):[{value:'switch',label:'🔀 '+deviceKindText('switch')},{value:'router',label:'🌐 '+deviceKindText('router')},{value:'firewall',label:'🛡 '+deviceKindText('firewall')}];
  setOptions(select,options.map(item=>makeOption(item.value,item.label)));
  select.value=options.some(item=>item.value===current)?current:'switch';
}
function renderDeviceModelHint(){
  const hint=$('devModelHint');if(!hint)return;const m=selectedDeviceModel();
  clearNode(hint);
  if(!m){hint.style.display='none';return;}
  hint.style.display='';
  const b=document.createElement('b'); b.textContent=$('devModel').value||''; hint.appendChild(b); hint.appendChild(document.createElement('br'));
  appendText(hint,i18nText('device.modelHint.summary',{kind:deviceKindText(m.kind),vendor:m.vendorOs||'—',ports:m.ports?.length||0,wifi:m.wifi?((m.wifiStandards||[]).join(', ')||i18nText('common.yes',{},'sí')):i18nText('common.no',{},'no')},'Tipo sugerido: {kind} · Vendor: {vendor} · Puertos plantilla: {ports} · Wi‑Fi/AP: {wifi}'));
  hint.appendChild(document.createElement('br')); appendText(hint,m.noteKey?i18nText(m.noteKey,{},m.notes||''):(m.notes||''));
}
function applyDeviceModelToForm(){const key=modelKeyByName($('devModel')?.value||'');if(!key)return alert(i18nText('device.alert.selectCatalogModel',{},'Selecciona un modelo del catálogo o escribe uno y guárdalo como texto libre.'));const m=DEVICE_MODEL_CATALOG[key];if(m.vendorOs)$('devVendor').value=m.vendorOs;if(m.kind)$('devType').value=m.kind;if($('devWifiRole'))$('devWifiRole').value=m.wifiRole||'none';$('devType').dispatchEvent(new Event('change'));renderDeviceModelHint();}
function ensurePortsFromModel(deviceId){const d=devById(deviceId);if(!d||!d.model)return 0;const key=modelKeyByName(d.model);const m=key?DEVICE_MODEL_CATALOG[key]:null;if(!m||!Array.isArray(m.ports))return 0;let added=0;for(const [name,role] of m.ports){if(S.ports.some(p=>p.deviceId===deviceId&&cleanStr(p.name).toLowerCase()===cleanStr(name).toLowerCase()))continue;const isSwitch=isSwitchDevice(d);const mode=role==='trunk'?'trunk':isSwitch?'access':'routed';S.ports.push({id:uid('port'),deviceId,name,media:name.toLowerCase().includes('fast')?'FE':'GE',mode,accessVlanRef:null,nativeVlanRef:null,allowedVlans:role==='trunk'?S.vlans.map(v=>v.vlanId):[],desc:m.wifiRole==='ap'?'Uplink AP / SSID VLANs':null,position:S.ports.filter(p=>p.deviceId===deviceId).length+1,role:role||null});added++;}return added;}

// =========================================================
// 06. DISPOSITIVOS
// Alta, edición, borrado y renderizado de dispositivos de infraestructura.
// =========================================================
function clearDevForm(){ $('devEditId').value=''; $('devName').value='';$('devMgmt').value='';$('devNotes').value='';if($('devColor'))$('devColor').value='#3b82f6';$('devVendor').value=''; if($('devModel'))$('devModel').value=''; if($('devWifiRole'))$('devWifiRole').value='none'; $('devType').value='switch';$('devEdge').value='no';$('devWanIf').value='';$('btnAddDev').dataset.i18n='device.actions.add';$('btnAddDev').textContent=i18nText('device.actions.add',{},'➕ Añadir dispositivo');$('btnCancelDevEdit').style.display='none';$('devEdgeSec').style.display='none'; renderDeviceModelHint(); }
function startDevEdit(id){ const d=devById(id); if(!d)return; $('devEditId').value=id; $('devName').value=d.name||''; $('devType').value=devKind(d); $('devVendor').value=d.vendorOs||''; if($('devModel'))$('devModel').value=d.model||''; if($('devWifiRole'))$('devWifiRole').value=d.wifiRole||'none'; $('devMgmt').value=d.mgmtIp||''; $('devNotes').value=d.notes||''; if($('devColor'))$('devColor').value=d.labelColor||'#3b82f6'; $('devEdge').value=d.internetEdge||'no'; $('devWanIf').value=d.wanIf||''; $('devEdgeSec').style.display=isEdgeDevice(d)?'':'none'; renderDeviceModelHint(); $('btnAddDev').dataset.i18n='device.actions.saveChanges';$('btnAddDev').textContent=i18nText('device.actions.saveChanges',{},'💾 Guardar cambios'); $('btnCancelDevEdit').style.display=''; navTo('dev'); window.scrollTo({top:0,behavior:'smooth'}); }
$('btnCancelDevEdit').onclick=()=>clearDevForm();
$('btnAddDev').onclick=()=>{
  const name=($('devName').value||'').trim();const kind=$('devType').value;const type=kind;const vendor=($('devVendor').value||'').trim()||null;const mgmt=($('devMgmt').value||'').trim()||null;const notes=($('devNotes').value||'').trim()||null;const labelColor=/^#[0-9a-f]{6}$/i.test($('devColor')?.value||'')?$('devColor').value:'#3b82f6';const model=($('devModel')?.value||'').trim()||null;const wifiRole=($('devWifiRole')?.value||'none');const edge=isEdgeDevice({kind})?$('devEdge').value:'no';const wanIf=isEdgeDevice({kind})?(($('devWanIf').value||'').trim()||null):null;
  const eid=$('devEditId').value||null;
  if(!name)return alert(i18nText('device.alert.nameRequired',{},'Nombre requerido.'));if(mgmt&&parseIp(mgmt)===null)return alert(i18nText('device.alert.invalidManagementIp',{},'IP de gestión inválida.'));
  if(isEdgeDevice({kind})&&edge==='yes'){const exists=S.devices.some(d=>d.id!==eid&&isEdgeDevice(d)&&d.internetEdge==='yes');if(exists)return alert(i18nText('device.alert.edgeAlreadyExists',{},'Ya existe otro dispositivo marcado como Internet Edge.'));}
  if(eid){
    const d=devById(eid); if(!d)return alert(i18nText('device.alert.editMissing',{},'No se encontró el dispositivo a editar.'));
    Object.assign(d,{name,type,kind,vendorOs:vendor,mgmtIp:mgmt,notes,labelColor,model,wifiRole,hasWifi:wifiRole!=='none',internetEdge:edge,wanIf});
    ensurePortsFromModel(eid);
  }else{
    const id=uid('dev');
    S.devices.push({id,name,type,kind,vendorOs:vendor,mgmtIp:mgmt,notes,labelColor,model,wifiRole,hasWifi:wifiRole!=='none',internetEdge:edge,wanIf,layout:null});
    S.topo.pos[id]={x:80+Math.random()*540,y:60+Math.random()*280};
    ensurePortsFromModel(id);
  }
  clearDevForm(); save();refresh();
};
function renderDevs(){
  const el=$('devsList');
  el.textContent='';
  if(!S.devices.length){
    const empty=document.createElement('div'); empty.className='empty';
    const icon=document.createElement('div'); icon.className='ei'; icon.textContent='🖥';
    const p=document.createElement('p'); p.append(i18nText('device.empty.title',{},'Sin dispositivos.')); p.appendChild(document.createElement('br')); p.append(i18nText('device.empty.hint',{},'Añade uno o usa el ⚡ Asistente.'));
    empty.append(icon,p); el.appendChild(empty); return;
  }
  const devices=S.devices.slice(); const dsort=S.uiSort.devices||{key:'name',dir:1};
  devices.sort((a,b)=>{let av='',bv=''; switch(dsort.key){case 'type': av=a.type; bv=b.type; break; case 'vendor': av=a.vendorOs||''; bv=b.vendorOs||''; break; case 'model': av=a.model||''; bv=b.model||''; break; case 'edge': av=a.internetEdge==='yes'?1:0; bv=b.internetEdge==='yes'?1:0; break; case 'ports': av=portsByDev(a.id).length; bv=portsByDev(b.id).length; break; default: av=a.name; bv=b.name;} return dsort.dir*cmpMixed(av,bv);});
  const wrap=document.createElement('div'); wrap.className='tw';
  const table=document.createElement('table'); const thead=document.createElement('thead'); const trh=document.createElement('tr');
  [['name',i18nText('form.name',{},'Nombre')],['type',i18nText('form.type',{},'Tipo')],['vendor',i18nText('form.vendor',{},'Vendor')],['model',i18nText('form.model',{},'Modelo')],['edge','IE'],['ports',i18nText('device.list.portsShort',{},'Pts')]].forEach(([k,l])=>trh.appendChild(createSortTh('devices',k,l)));
  trh.appendChild(document.createElement('th')); thead.appendChild(trh); table.appendChild(thead);
  const tbody=document.createElement('tbody');
  devices.forEach(d=>{
    const tr=document.createElement('tr');
    const tdName=document.createElement('td'); const b=document.createElement('b'); b.textContent=d.name||''; tdName.appendChild(b);
    if(d.notes){ const hint=document.createElement('div'); hint.className='hint'; hint.textContent=String(d.notes).substring(0,28); tdName.appendChild(hint); }
    tr.appendChild(tdName);

    const tdType=document.createElement('td'); const typeBadge=document.createElement('span');
    const type=devKind(d);
    typeBadge.className='dtype dtype-'+(type==='switch'?'sw':type==='router'?'rt':type==='firewall'?'fw':'xx');
    typeBadge.textContent=`${devIcon(d)} ${deviceKindText(d)}`;
    tdType.appendChild(typeBadge); tr.appendChild(tdType);

    const tdVendor=document.createElement('td'); tdVendor.appendChild(makeBadge(d.vendorOs||'-','b bac')); tr.appendChild(tdVendor);
    const tdModel=document.createElement('td'); appendText(tdModel,d.model||'—');
    if(d.hasWifi){ const hint=document.createElement('div'); hint.className='hint'; hint.textContent='📶 '+(d.wifiRole||'Wi‑Fi'); tdModel.appendChild(hint); }
    tr.appendChild(tdModel);
    const tdEdge=document.createElement('td'); tdEdge.appendChild(d.internetEdge==='yes'?makeBadge('Edge','b brd'):document.createTextNode('—')); tr.appendChild(tdEdge);
    const tdPorts=document.createElement('td'); tdPorts.appendChild(makeBadge(portsByDev(d.id).length,'b bgr')); tr.appendChild(tdPorts);
    const tdActions=document.createElement('td'); tdActions.style.display='flex'; tdActions.style.gap='4px';
    [['cfgdev','⚙','btn bs bxs'],['eddev','✎','btn bs bxs'],['deldev','✕','btn bd bxs']].forEach(([key,label,cls])=>{ const btn=document.createElement('button'); btn.type='button'; btn.className=cls; btn.dataset[key]=d.id; btn.textContent=label; tdActions.appendChild(btn); });
    tr.appendChild(tdActions); tbody.appendChild(tr);
  });
  table.appendChild(tbody); wrap.appendChild(table); el.appendChild(wrap);
  el.querySelectorAll('[data-cfgdev]').forEach(btn=>btn.onclick=()=>openDevCfgModal(btn.dataset.cfgdev));
  el.querySelectorAll('[data-eddev]').forEach(btn=>btn.onclick=()=>startDevEdit(btn.dataset.eddev));
  el.querySelectorAll('[data-deldev]').forEach(btn=>btn.onclick=()=>{
    const id=btn.dataset.deldev;const pids=S.ports.filter(p=>p.deviceId===id).map(p=>p.id);
    S.links=S.links.filter(l=>!pids.includes(l.aPortId)&&!pids.includes(l.bPortId));
    S.hosts=S.hosts.map(h=>{if(pids.includes(h.portRef))h.portRef=null;if(h.deviceRef===id)h.deviceRef=null;if(h.connectedDeviceId===id)h.connectedDeviceId=null;return h;});
    if(Array.isArray(S.patchConnections))S.patchConnections=S.patchConnections.filter(x=>!pids.includes(x.switchPortId));
    S.ports=S.ports.filter(p=>p.deviceId!==id);S.devices=S.devices.filter(d=>d.id!==id);
    if(S.roas.gwId===id){S.roas.gwId=null;S.roas.lanIf='';}
    delete S.topo.pos[id];save();refresh();
  });
}

// ─────────────────── PORTS (FIXED) ───────────────────
// Populate device select in ports page

function boolToSelect(v){ return v === true ? 'yes' : v === false ? 'no' : 'auto'; }
function selectToBool(v){ return v === 'yes' ? true : v === 'no' ? false : null; }
function setBoolField(obj, key, val){ if(val === null){ delete obj[key]; } else obj[key] = val; }
function optionalPortNumber(id){const node=$(id);if(!node||node.value==='')return null;const n=Number(node.value);return Number.isFinite(n)?n:null;}
function optionalPortText(id){const node=$(id);if(!node)return null;const value=(node.value||'').trim();return value||null;}
function setOptionalPortField(port,key,value){if(value===null||value==='')delete port[key];else port[key]=value;}
function readAdvancedPortFields(){
  const fields={};
  const numeric={speedMaxMbps:'pSpeedMax',mtu:'pMtu',negotiatedSpeedMbps:'pNegotiatedSpeed',utilizationPercent:'pUtilization'};
  const textual={transceiver:'pTransceiver',connector:'pConnector',adminState:'pAdminState',operState:'pOperState'};
  Object.entries(numeric).forEach(([key,id])=>{if($(id))fields[key]=optionalPortNumber(id);});
  Object.entries(textual).forEach(([key,id])=>{if($(id))fields[key]=optionalPortText(id);});
  return fields;
}
function applyAdvancedPortFields(port){
  const fields=readAdvancedPortFields();
  Object.entries(fields).forEach(([key,value])=>setOptionalPortField(port,key,value));
  return port;
}
function loadAdvancedPortFields(port){
  const map={pSpeedMax:port?.speedMaxMbps,pMtu:port?.mtu,pTransceiver:port?.transceiver,pConnector:port?.connector,pAdminState:port?.adminState,pNegotiatedSpeed:port?.negotiatedSpeedMbps,pUtilization:port?.utilizationPercent,pOperState:port?.operState};
  Object.entries(map).forEach(([id,value])=>{const node=$(id);if(node)node.value=value==null?'':String(value);});
}
function clearAdvancedPortFields(){['pSpeedMax','pMtu','pTransceiver','pConnector','pAdminState','pNegotiatedSpeed','pUtilization','pOperState'].forEach(id=>{const node=$(id);if(node)node.value='';});}
function updatePortL2Wrap(){
  const role = $('pRole') ? $('pRole').value : '';
  const isSwitch = isSwitchDevice(devById($('pDev')?.value));
  const isAccess = isSwitch && role === 'access';
  const isTrunk = (isSwitch && role === 'trunk') || (!isSwitch && role === 'lan');
  if($('pVlanWrap')) $('pVlanWrap').style.display = isAccess ? '' : 'none';
  if($('pL2Wrap')) $('pL2Wrap').style.display = (isAccess || isTrunk) ? '' : 'none';
  if($('pNativeVlan')) $('pNativeVlan').disabled = !isTrunk;
  if($('pAllowedVlans')) $('pAllowedVlans').disabled = !isTrunk;
  if($('pAccessProtection')) $('pAccessProtection').disabled = !isAccess;
}

// =========================================================
// 07. PUERTOS E INTERFACES
// Gestión de puertos físicos/lógicos, roles, edición y render de interfaces.
// =========================================================
function fillPortDevSel(){
  const devSelect=$('pDev'),filterSelect=$('portFiltDev');
  const selectedDev=devSelect?.value||'',selectedFilter=filterSelect?.value||'';
  const all=S.devices.slice().sort((a,b)=>a.name.localeCompare(b.name));
  setOptions(devSelect,all.map(d=>makeOption(d.id,`${d.name||''} (${d.type||''})`)),i18nText('ports.select.addDeviceFirst',{},'— añade un dispositivo primero —'));
  setOptions(filterSelect,[makeOption('',i18nText('common.all',{},'Todos')), ...all.map(d=>makeOption(d.id,d.name||''))]);
  if(selectedDev&&all.some(d=>d.id===selectedDev))devSelect.value=selectedDev;
  if(selectedFilter&&all.some(d=>d.id===selectedFilter))filterSelect.value=selectedFilter;
  updatePortRoleOpts();
}

function updatePortRoleOpts(){
  const devId=$('pDev').value;const d=devById(devId);
  const isRF=!d||!isSwitchDevice(d);
  const role=$('pRole'),previousRole=role?.value||''; clearNode(role);
  if(!isRF){
    role.append(makeOption('access',i18nText('ports.role.access',{},'access (usuario/host)')),makeOption('trunk',i18nText('ports.role.trunk',{},'trunk (uplink/RoaS)')));
  } else {
    role.append(makeOption('lan',i18nText('ports.role.lan',{},'LAN (trunk a switches)')),makeOption('wan',i18nText('ports.role.wan',{},'WAN (hacia ISP)')),makeOption('routed',i18nText('ports.role.routed',{},'routed (L3 directo)')));
  }
  if(previousRole&&Array.from(role.options).some(o=>o.value===previousRole))role.value=previousRole;
  updatePortL2Wrap();
  if(d){$('pName').placeholder=d.vendorOs==='juniper_junos'?'ge-0/0/0':d.vendorOs==='aruba_aoss'?'1/1/1':isSwitchDevice(d)?'GigabitEthernet0/1':'GigabitEthernet0/0';}
  $('pHint').textContent=!d?'':i18nText('ports.hint.device',{device:d.name,type:deviceKindText(d),vendor:d.vendorOs||i18nText('ports.hint.unassigned',{},'sin asignar')},'Dispositivo: {device} ({type}) — vendor: {vendor}');
}

$('pDev').onchange=()=>{updatePortRoleOpts();};
$('pRole').onchange=()=>{updatePortL2Wrap();};

function clearPortForm(){ $('portEditId').value=''; $('pName').value=''; $('pDesc').value=''; if($('pAllowedVlans'))$('pAllowedVlans').value=''; if($('pNativeVlan'))$('pNativeVlan').value=''; if($('pUplink'))$('pUplink').value='auto'; if($('pAccessProtection'))$('pAccessProtection').value='default'; clearAdvancedPortFields(); $('btnAddPort').dataset.i18n='ports.actions.add';$('btnAddPort').textContent=i18nText('ports.actions.add',{},'➕ Añadir'); $('btnCancelPortEdit').style.display='none'; $('pHint').textContent=''; $('pHint').className='hint'; updatePortRoleOpts(); }
function startPortEdit(id){ const p=S.ports.find(x=>x.id===id); if(!p)return; const d=devById(p.deviceId); $('portEditId').value=id; $('pDev').value=p.deviceId; updatePortRoleOpts(); $('pName').value=p.name||''; $('pMedia').value=p.media||'GE'; if(isSwitchDevice(d)){ $('pRole').value=(p.mode==='access'?'access':'trunk'); $('pVlan').value=p.accessVlanRef||''; } else { $('pRole').value=p.mode==='trunk'?'lan':(p.role||'routed'); } if($('pNativeVlan'))$('pNativeVlan').value=p.nativeVlanRef||''; if($('pAllowedVlans'))$('pAllowedVlans').value=(p.allowedVlans||[]).join(','); if($('pUplink'))$('pUplink').value=boolToSelect(p.uplink); if($('pAccessProtection'))$('pAccessProtection').value=(p.portFast===false&&p.bpduGuard===false)?'off':(p.portFast===true&&p.bpduGuard===true)?'strict':'default'; $('pDesc').value=p.desc||''; loadAdvancedPortFields(p); $('btnAddPort').dataset.i18n='ports.actions.saveChanges';$('btnAddPort').textContent=i18nText('ports.actions.saveChanges',{},'💾 Guardar cambios'); $('btnCancelPortEdit').style.display=''; updatePortL2Wrap(); navTo('ports'); window.scrollTo({top:0,behavior:'smooth'}); }
$('btnCancelPortEdit').onclick=()=>clearPortForm();
$('btnAddPort').onclick=()=>{
  const devId=$('pDev').value;
  if(!devId)return alert(i18nText('ports.alert.selectDeviceFirst',{},'Selecciona un dispositivo primero.'));
  const pname=($('pName').value||'').trim();
  if(!pname)return alert(i18nText('ports.alert.nameRequired',{},'Nombre del puerto requerido.'));
  const editId=$('portEditId').value||null;
  if(S.ports.some(p=>p.deviceId===devId&&p.name===pname&&p.id!==editId))return alert(i18nText('ports.alert.duplicate',{port:pname},'El puerto "{port}" ya existe en ese dispositivo.'));
  const d=devById(devId);
  const media=$('pMedia').value;const role=$('pRole').value;
  const vlanRef=$('pVlan').value||null;const desc=($('pDesc').value||'').trim()||null;
  let mode,accessVlanRef=null,allowedVlans=[],nativeVlanRef=null,realRole=role;
  const explicitAllowed=$('pAllowedVlans')?parseAllowed($('pAllowedVlans').value):[];
  const explicitNative=$('pNativeVlan')?($('pNativeVlan').value||null):null;
  if(isSwitchDevice(d)){
    if(role==='access'){mode='access';accessVlanRef=vlanRef;}
    else{mode='trunk';allowedVlans=explicitAllowed.length?explicitAllowed:S.vlans.map(v=>v.vlanId).sort((a,b)=>a-b);nativeVlanRef=explicitNative;}
    realRole=null;
  } else {
    if(role==='lan'){mode='trunk';allowedVlans=explicitAllowed.length?explicitAllowed:S.vlans.map(v=>v.vlanId).sort((a,b)=>a-b);nativeVlanRef=explicitNative;}
    else{mode='routed';}
  }
  const extra={};
  const up=selectToBool($('pUplink')?$('pUplink').value:'auto'); if(up!==null)extra.uplink=up;
  if(mode==='access'){
    const prot=$('pAccessProtection')?$('pAccessProtection').value:'default';
    if(prot==='strict'){extra.portFast=true;extra.bpduGuard=true;}
    if(prot==='off'){extra.portFast=false;extra.bpduGuard=false;}
  }
  if(editId){
    const p=S.ports.find(x=>x.id===editId); if(!p)return alert(i18nText('ports.alert.editMissing',{},'No se encontró el puerto a editar.'));
    Object.assign(p,{deviceId:devId,name:pname,media,mode,accessVlanRef,nativeVlanRef,allowedVlans,desc,role:realRole});
    applyAdvancedPortFields(p);
    setBoolField(p,'uplink',up); if(mode!=='access'){delete p.portFast;delete p.bpduGuard;} else { if(!('portFast' in extra))delete p.portFast; if(!('bpduGuard' in extra))delete p.bpduGuard; Object.assign(p,extra); }
  }else{
    const port=Object.assign({id:uid('port'),deviceId:devId,name:pname,media,mode,accessVlanRef,nativeVlanRef,allowedVlans,desc,position:null,role:realRole},extra);
    applyAdvancedPortFields(port);S.ports.push(port);
  }
  clearPortForm(); save();refresh();
  $('pHint').textContent=i18nText('ports.feedback.saved',{port:pname,device:d.name},'✓ Puerto "{port}" guardado en {device}');
  $('pHint').className='hint ok';
  setTimeout(()=>{$('pHint').textContent='';$('pHint').className='hint';},2000);
};

$('btnQuick24').onclick=()=>{
  const devId=$('pDev').value;if(!devId)return alert(i18nText('ports.alert.selectDevice',{},'Selecciona un dispositivo.'));
  const d=devById(devId);if(!d)return;if(d.type!=='switch')return alert(i18nText('ports.alert.switchOnly',{},'Esta función es solo para switches.'));
  if(!d.vendorOs)return alert(i18nText('ports.alert.vendorRequired',{},'El dispositivo necesita Vendor/OS asignado.'));
  const defVlan=S.vlans[0]?.id||null;let added=0;
  for(let i=1;i<=24;i++){
    const name=buildPName(d.vendorOs,'GE',i,'0/');
    if(!S.ports.some(p=>p.deviceId===devId&&p.name===name)){S.ports.push({id:uid('port'),deviceId:devId,name,media:'GE',mode:'access',accessVlanRef:defVlan,nativeVlanRef:null,allowedVlans:[],desc:null,position:i,role:null});added++;}
  }
  save();refresh();alert(i18nText('ports.feedback.quickAdded',{count:added,device:d.name},'✓ {count} puertos GE añadidos a {device}.'));
};

let portsPage=0;
const PORTS_PAGE_SIZE=80;
function renderPortsList(){
  const filtDev=$('portFiltDev').value;
  const deviceById=new Map(S.devices.map(d=>[d.id,d]));
  const vlanByRef=new Map(S.vlans.map(v=>[v.id,v]));
  const linkedPorts=new Set();
  for(const link of S.links||[]){if(link.aPortId)linkedPorts.add(link.aPortId);if(link.bPortId)linkedPorts.add(link.bPortId);}
  let pts=S.ports.slice(); if(filtDev)pts=pts.filter(p=>p.deviceId===filtDev); const psort=S.uiSort.ports||{key:'device',dir:1}; pts.sort((a,b)=>{const da=deviceById.get(a.deviceId),db=deviceById.get(b.deviceId),va=vlanByRef.get(a.accessVlanRef),vb=vlanByRef.get(b.accessVlanRef); let av='',bv=''; switch(psort.key){case 'port': av=a.name; bv=b.name; break; case 'mode': av=a.mode; bv=b.mode; break; case 'info': av=a.mode==='access'?(va?.vlanId||99999):((a.allowedVlans||[]).length); bv=b.mode==='access'?(vb?.vlanId||99999):((b.allowedVlans||[]).length); break; default: av=da?.name||''; bv=db?.name||'';} return psort.dir*cmpMixed(av,bv);});
  const el=$('portsList'); el.textContent='';
  if(!pts.length){
    portsPage=0;
    const info=$('portsPageInfo');if(info)info.textContent=i18nText('ports.list.count',{count:0},'{count} puertos');
    const pager=$('portsPager');if(pager)pager.style.display='none';
    if($('portsPrev'))$('portsPrev').disabled=true;if($('portsNext'))$('portsNext').disabled=true;
    const empty=document.createElement('div'); empty.className='empty';
    const icon=document.createElement('div'); icon.className='ei'; icon.textContent='🔌';
    const p=document.createElement('p'); p.textContent=S.ports.length?i18nText('ports.empty.filtered',{},'Cambia el filtro.'):i18nText('ports.empty.none',{},'Añade puertos arriba.');
    empty.append(icon,p); el.appendChild(empty); return;
  }
  const totalPages=Math.max(1,Math.ceil(pts.length/PORTS_PAGE_SIZE));
  portsPage=Math.min(Math.max(0,portsPage),totalPages-1);
  const start=portsPage*PORTS_PAGE_SIZE;
  const visible=pts.slice(start,start+PORTS_PAGE_SIZE);
  const info=$('portsPageInfo');if(info)info.textContent=i18nText('ports.list.page',{count:pts.length,page:portsPage+1,total:totalPages},'{count} puertos · página {page}/{total}');
  const prev=$('portsPrev'),next=$('portsNext'),pager=$('portsPager');
  if(pager)pager.style.display=pts.length>PORTS_PAGE_SIZE?'flex':'none';
  if(prev)prev.disabled=portsPage<=0;
  if(next)next.disabled=portsPage>=totalPages-1;
  const wrap=document.createElement('div'); wrap.className='tw'; const table=document.createElement('table');
  const thead=document.createElement('thead'); const trh=document.createElement('tr');
  [['device',i18nText('form.device',{},'Dispositivo')],['port',i18nText('form.port',{},'Puerto')],['mode',i18nText('form.mode',{},'Modo')],['info',i18nText('form.info',{},'VLAN/Info')]].forEach(([k,l])=>trh.appendChild(createSortTh('ports',k,l)));
  trh.appendChild(document.createElement('th')); thead.appendChild(trh); table.appendChild(thead);
  const tbody=document.createElement('tbody');
  visible.forEach(p=>{
    const d=deviceById.get(p.deviceId); const v=vlanByRef.get(p.accessVlanRef); const lnk=linkedPorts.has(p.id);
    const tr=document.createElement('tr');
    const tdDev=document.createElement('td'); const devBadge=makeBadge(d?.name||'?','b bgr'); if(d&&/^#[0-9a-f]{6}$/i.test(d.labelColor||'')){devBadge.style.background=d.labelColor;devBadge.style.color=textColorForBg(d.labelColor);devBadge.style.borderColor=d.labelColor;} tdDev.appendChild(devBadge); tr.appendChild(tdDev);
    const tdPort=document.createElement('td'); tdPort.className='mono'; const b=document.createElement('b'); b.textContent=p.name||''; tdPort.appendChild(b);
    if(p.desc){ const desc=document.createElement('div'); desc.style.fontSize='9.5px'; desc.style.color='var(--t3)'; desc.textContent=String(p.desc).substring(0,20); tdPort.appendChild(desc); }
    tr.appendChild(tdPort);
    const tdMode=document.createElement('td'); tdMode.appendChild(makeBadge(p.mode||'',`b ${p.mode==='access'?'bgn':p.mode==='trunk'?'byw':'bpu'}`)); tr.appendChild(tdMode);
    const tdInfo=document.createElement('td'); tdInfo.className='mono';
    let info='L3';
    if(p.mode==='access') info=`V${v?.vlanId||'?'}${p.portFast===false?' · PF off':''}${p.bpduGuard===false?' · BPDU off':''}`;
    else if(p.mode==='trunk') info=`${(p.allowedVlans||[]).length}VL${p.nativeVlanRef?` · native V${vlanByRef.get(p.nativeVlanRef)?.vlanId||'?'}`:''}${p.uplink===true?' · uplink':''}`;
    appendText(tdInfo,info);
    if(lnk){ tdInfo.appendChild(document.createTextNode(' ')); tdInfo.appendChild(makeBadge('🔗','b bac')); }
    tr.appendChild(tdInfo);
    const tdActions=document.createElement('td'); tdActions.style.display='flex'; tdActions.style.gap='4px';
    const edit=document.createElement('button'); edit.type='button'; edit.className='btn bs bxs'; edit.dataset.ep=p.id; edit.textContent='✎';
    const del=document.createElement('button'); del.type='button'; del.className='btn bd bxs'; del.dataset.dp=p.id; del.textContent='✕';
    tdActions.append(edit,del); tr.appendChild(tdActions); tbody.appendChild(tr);
  });
  table.appendChild(tbody); wrap.appendChild(table); el.appendChild(wrap);
  el.querySelectorAll('[data-ep]').forEach(btn=>btn.onclick=()=>startPortEdit(btn.dataset.ep));
  el.querySelectorAll('[data-dp]').forEach(btn=>btn.onclick=()=>{
    const pid=btn.dataset.dp;S.links=S.links.filter(l=>l.aPortId!==pid&&l.bPortId!==pid);
    S.hosts=S.hosts.map(h=>{if(h.portRef===pid)h.portRef=null;return h;});
    if(Array.isArray(S.patchConnections))S.patchConnections=S.patchConnections.filter(x=>x.switchPortId!==pid);
    S.ports=S.ports.filter(p=>p.id!==pid);save();refresh();
  });
}
$('portFiltDev').onchange=()=>{portsPage=0;renderPortsList();};
if($('portsPrev'))$('portsPrev').onclick=()=>{if(portsPage>0){portsPage--;renderPortsList();}};
if($('portsNext'))$('portsNext').onclick=()=>{portsPage++;renderPortsList();};

window.addEventListener&&window.addEventListener('netwizard:i18n',()=>{
  if(S.step==='dev'){
    initDeviceKindSelect();initDeviceVendorSelect();renderDeviceModelHint();renderDevs();
    if($('devEditId')&&$('devEditId').value){$('btnAddDev').dataset.i18n='device.actions.saveChanges';$('btnAddDev').textContent=i18nText('device.actions.saveChanges',{},'💾 Guardar cambios');}
    else if($('btnAddDev')){$('btnAddDev').dataset.i18n='device.actions.add';$('btnAddDev').textContent=i18nText('device.actions.add',{},'➕ Añadir dispositivo');}
  }
  if(S.step==='ports'){
    fillPortDevSel();renderPortsList();
    if($('portEditId')&&$('portEditId').value){$('btnAddPort').dataset.i18n='ports.actions.saveChanges';$('btnAddPort').textContent=i18nText('ports.actions.saveChanges',{},'💾 Guardar cambios');}
    else if($('btnAddPort')){$('btnAddPort').dataset.i18n='ports.actions.add';$('btnAddPort').textContent=i18nText('ports.actions.add',{},'➕ Añadir');}
  }
  if(S.step==='vlan'){
    const vtpDraft={
      domain:$('vtpDomain')?.value??'',
      password:$('vtpPassword')?.value??'',
      version:$('vtpVersion')?.value??'2',
      pruning:$('vtpPruning')?.value??'no',
      roles:Object.fromEntries(qsa('[data-vtprole]').map(el=>[el.dataset.vtprole,el.value]))
    };
    vlanSelectSignature='';
    fillVlanSels();renderVlans();renderSubnets();syncSubnetAuthorityLabel();updManualSnHint();fillRoasSels();renderVtp();
    if($('vtpDomain'))$('vtpDomain').value=vtpDraft.domain;
    if($('vtpPassword'))$('vtpPassword').value=vtpDraft.password;
    if($('vtpVersion'))$('vtpVersion').value=vtpDraft.version;
    if($('vtpPruning'))$('vtpPruning').value=vtpDraft.pruning;
    qsa('[data-vtprole]').forEach(el=>{const value=vtpDraft.roles[el.dataset.vtprole];if(value&&Array.from(el.options).some(o=>o.value===value))el.value=value;});
    if($('dhcpPanel')?.open)renderDhcp();
  }
  if(S.step==='graphs'){
    drawTopo();resizeV5();renderV5Panel();
  }
  if(S.step==='hosts'){
    const keep={dev:$('hConnDev')?.value||'',managed:$('hDeviceRef')?.value||'',port:$('hPort')?.value||'',loc:$('hLoc')?.value||'',phys:$('hPhysLocSel')?.value||''};
    fillVlanSels();fillHostDeviceSel();if(keep.dev&&Array.from($('hConnDev').options).some(o=>o.value===keep.dev))$('hConnDev').value=keep.dev;
    fillHostManagedDeviceSel(keep.managed);fillHostPortSel($('hConnDev').value,keep.port);fillHostLocSel();if(keep.loc&&Array.from($('hLoc').options).some(o=>o.value===keep.loc))$('hLoc').value=keep.loc;
    fillHostPhysLocSel();if(keep.phys&&Array.from($('hPhysLocSel').options).some(o=>o.value===keep.phys))$('hPhysLocSel').value=keep.phys;
    syncHostI18nLabels();updateHostDeviceHint();renderHosts();if($('ipMapPanel')?.open)renderIpMap();
    if($('hostEditId')?.value){$('btnAddHost').dataset.i18n='hosts.actions.saveChanges';$('btnAddHost').textContent=i18nText('hosts.actions.saveChanges',{},'💾 Guardar cambios');}
  }
  if(S.step==='links'){
    const keep={a:$('lnkA')?.value||'',b:$('lnkB')?.value||'',transit:$('lnkTransit')?.value||'',dev:$('visDev')?.value||''};
    fillLinkPickers();fillSwDevSels();
    for(const [id,val] of [['lnkA',keep.a],['lnkB',keep.b],['lnkTransit',keep.transit],['visDev',keep.dev]])if(val&&$(id)&&Array.from($(id).options).some(o=>o.value===val))$(id).value=val;
    renderVisPorts();renderLinks();
    if($('upHint')?.dataset.vlans)$('upHint').textContent=i18nText('links.feedback.switchUplink',{vlans:$('upHint').dataset.vlans},'💡 Uplink entre switches: considera configurar trunk con VLANs {vlans}');
  }
  if(S.step==='fw'){
    renderFwRules();
    if($('fw-matrix')?.classList.contains('on'))renderVlanMatrix();
    if($('fwTplModal')?.classList.contains('on'))renderFwTplModal();
  }
});

// ─────────────────── VLANs ───────────────────


// =========================================================
// 08. VLANS Y SUBNETS
// Selectores VLAN, subnetting manual/automático y listados de VLAN/subnets.
// =========================================================
let vlanSelectSignature='';
function fillVlanSels(){
  const sorted=S.vlans.slice().sort((a,b)=>a.vlanId-b.vlanId);
  const signature=sorted.map(v=>`${v.id}:${v.vlanId}:${v.name||''}`).join('|');
  if(signature===vlanSelectSignature)return;
  vlanSelectSignature=signature;
  const selected=new Map();
  ['aNatV','roasNatV','secQV','pmAV','pmNV','lyVlan','pVlan','pNativeVlan','mSnVlan','hVlan','hFiltV'].forEach(id=>{const el=$(id);if(el)selected.set(id,el.value);});
  const baseOpts=()=>[makeOption('',i18nText('common.none',{},'(ninguna)')), ...sorted.map(v=>makeOption(v.id,`${v.vlanId} — ${v.name||''}`))];
  ['aNatV','roasNatV','secQV','pmAV','pmNV','lyVlan','pVlan','pNativeVlan','mSnVlan'].forEach(id=>{const el=$(id);if(el){setOptions(el,baseOpts());if(selected.get(id)&&Array.from(el.options).some(o=>o.value===selected.get(id)))el.value=selected.get(id);}});
  const hVlan=$('hVlan');if(hVlan){setOptions(hVlan,[makeOption('',i18nText('vlan.select.choose',{},'(elige VLAN)')), ...sorted.map(v=>makeOption(v.id,`${v.vlanId} — ${v.name||''}`))]);if(selected.get('hVlan')&&Array.from(hVlan.options).some(o=>o.value===selected.get('hVlan')))hVlan.value=selected.get('hVlan');}
  const hFiltV=$('hFiltV');if(hFiltV){setOptions(hFiltV,[makeOption('',i18nText('common.all',{},'Todas')), ...sorted.map(v=>makeOption(v.id,`${v.vlanId} — ${v.name||''}`))]);if(selected.get('hFiltV')&&Array.from(hFiltV.options).some(o=>o.value===selected.get('hFiltV')))hFiltV.value=selected.get('hFiltV');}
}

function syncSubnetAuthorityLabel(){if($('aSnAuthority'))$('aSnAuthority').value=i18nText('subnet.quick.authorityValue',{},'S.subnets · solo faltantes');}
function updManualSnHint(){
  const ref=$('mSnVlan')?.value||'';
  const hint=$('mSnHint');
  if(!hint)return;
  if(!ref){hint.textContent=i18nText('subnet.form.hint',{},'Edición explícita de S.subnets. Si la VLAN ya tiene subnet, se actualiza esa misma asignación.');return;}
  const v=vByRef(ref);const sn=snByVRef(ref);
  hint.textContent=sn?i18nText('subnet.form.editing',{vlan:v?.vlanId||'—',cidr:sn.cidr,gateway:sn.gateway||'—'},'Editando VLAN {vlan}: {cidr} · GW {gateway}'):i18nText('subnet.form.newForVlan',{vlan:v?.vlanId||'—'},'Nueva subnet manual para VLAN {vlan}.');
  if(sn){$('mSnCidr').value=sn.cidr||'';$('mSnGw').value=sn.gateway||'';}
}
$('mSnVlan').onchange=updManualSnHint;
$('btnAddManualSn').onclick=()=>{
  const vRef=$('mSnVlan').value||null;
  const cidr=($('mSnCidr').value||'').trim();
  const gateway=($('mSnGw').value||'').trim()||null;
  const ex=snByVRef(vRef);
  const check=validateSubnetAssignment({vlanRef:vRef,cidr,gateway,existingSubnetId:ex?.id||''},S.subnets,{locale:window.NetWizardI18n?.getLocale?.()});
  if(!check.ok)return alert(check.msg);
  if(ex){ex.cidr=check.cidr;ex.gateway=check.gateway;}
  else S.subnets.push({id:uid('sn'),vlanRef:vRef,cidr:check.cidr,gateway:check.gateway});
  if($('aNatV').value)S.roas.natVRef=$('aNatV').value;
  $('mSnCidr').value='';$('mSnGw').value='';$('mSnVlan').value='';
  save();refresh();
  if(check.msg)alert(check.msg);
};

$('btnAddVlan').onclick=()=>{
  const vid=parseInt($('vId').value||'',10);const name=($('vName').value||'').trim()||`VLAN${vid}`;const color=$('vColor').value||VCOLS[S.vlans.length%VCOLS.length];
  if(!isFinite(vid)||vid<1||vid>4094)return alert(i18nText('vlan.alert.invalidId',{},'VLAN ID inválida (1-4094).'));
  if(S.vlans.some(v=>v.vlanId===vid))return alert(i18nText('vlan.alert.duplicate',{},'Esa VLAN ya existe.'));
  S.vlans.push({id:uid('vlan'),vlanId:vid,name,color});
  $('vId').value='';$('vName').value='';
  for(const p of S.ports){if(p.mode==='trunk'&&!p.allowedVlans.includes(vid)){p.allowedVlans.push(vid);p.allowedVlans.sort((a,b)=>a-b);}}
  save();refresh();
};
function buildQuickSubnetPlan(){
  const planner=window.NetWizardPlanner;
  if(!planner||typeof planner.buildFixedSubnetPlan!=='function')return{ok:false,msg:i18nText('subnet.alert.engineUnavailable',{},'Motor común de subnetting no disponible.'),plans:[],warnings:[]};
  const rawBase=($('aBase').value||'').trim()||'10.10.0.0/16';
  const pfx=parseInt($('aSize').value||'24',10);
  return planner.buildFixedSubnetPlan(S,rawBase,pfx,{gatewayMode:$('aGw').value||'first'});
}
function quickSubnetPlanSummary(plan){
  if(!plan?.ok)return plan?.msg||i18nText('subnet.alert.invalidPlan',{},'Plan de subnetting inválido.');
  const cp=window.NetWizardChangePreview;
  const diffFn=cp&&(cp.computeSubnetPlanDiff||cp.computeVlsmDiff);
  if(diffFn&&typeof diffFn==='function'){
    const diff=diffFn.call(cp,S,plan,{assignMode:'none',replaceExisting:false});
    return cp.summarizeDiff?cp.summarizeDiff(diff,i18nText('subnet.quick.diffTitle',{},'Asignación rápida · solo subnets faltantes')):'';
  }
  const lines=[i18nText('subnet.quick.baseSummary',{base:plan.base,prefix:plan.prefix},'Base: {base} · prefijo /{prefix}')];
  for(const p of plan.plans||[])lines.push(`VLAN ${p.vlanId||p.vlanRef}: ${p.cidr} · GW ${p.gateway||'—'}`);
  if(plan.warnings?.length)lines.push('',...plan.warnings.map(x=>'! '+x));
  return lines.join('\n');
}
function runQuickSubnetPlan(apply){
  if(!S.vlans.length){alert(i18nText('vlan.alert.createFirst',{},'Crea VLANs primero.'));return;}
  const plan=buildQuickSubnetPlan(),out=$('aSnOut');
  if(out)out.textContent=quickSubnetPlanSummary(plan);
  if(!plan.ok){if(apply)alert(plan.msg||i18nText('subnet.alert.invalidPlan',{},'Plan de subnetting inválido.'));return plan;}
  if(!apply)return plan;
  if(!plan.plans.length){alert(i18nText('subnet.quick.noMissing',{},'No hay VLANs sin subnet que completar.'));return plan;}
  const planner=window.NetWizardPlanner;
  const next=planner.applySubnetPlan(S,plan,{replaceExisting:false,assignMode:'none'});
  const nv=$('aNatV').value;if(nv){next.roas=next.roas||{};next.roas.natVRef=nv;}
  if(!confirm(quickSubnetPlanSummary(plan)+'\n\n'+i18nText('subnet.quick.confirm',{count:plan.plans.length},'¿Aplicar {count} subnet(s) faltante(s)? Las asignaciones existentes no se modificarán.')))return plan;
  replaceProject(next,{source:'quick-subnet-plan'});
  if($('aSnOut'))$('aSnOut').textContent=i18nText('subnet.quick.applied',{},'✓ Plan aplicado sobre S.subnets. No se reemplazó ninguna subnet existente.');
  return plan;
}
$('btnAutoSnPreview').onclick=()=>runQuickSubnetPlan(false);
$('btnAutoSn').onclick=()=>runQuickSubnetPlan(true);
function renderVlans(){
  const vrows=S.vlans.slice(); const vsort=S.uiSort.vlans||{key:'id',dir:1};
  vrows.sort((a,b)=>vsort.dir*cmpMixed(vsort.key==='name'?a.name:a.vlanId, vsort.key==='name'?b.name:b.vlanId));
  const el=$('vlanList'); el.textContent='';
  if(!S.vlans.length){ const empty=document.createElement('div'); empty.className='empty'; const p=document.createElement('p'); p.textContent=i18nText('vlan.empty',{},'Sin VLANs'); empty.appendChild(p); el.appendChild(empty); return; }
  const wrap=document.createElement('div'); wrap.className='tw'; const table=document.createElement('table');
  const thead=document.createElement('thead'); const trh=document.createElement('tr'); trh.appendChild(document.createElement('th')); trh.appendChild(createSortTh('vlans','id','ID')); trh.appendChild(createSortTh('vlans','name',i18nText('form.name',{},'Nombre'))); trh.appendChild(document.createElement('th')); thead.appendChild(trh); table.appendChild(thead);
  const tbody=document.createElement('tbody');
  vrows.forEach(v=>{
    const tr=document.createElement('tr');
    const ctd=document.createElement('td'); const dot=document.createElement('span'); dot.className='vd'; dot.style.background=safeColor(v.color, vColor(v.id)); ctd.appendChild(dot); tr.appendChild(ctd);
    const idtd=document.createElement('td'); idtd.className='mono'; idtd.textContent=String(v.vlanId ?? ''); tr.appendChild(idtd);
    const ntd=document.createElement('td'); ntd.textContent=v.name||''; tr.appendChild(ntd);
    const atd=document.createElement('td'); const btn=document.createElement('button'); btn.type='button'; btn.className='btn bd bxs'; btn.dataset.dv=v.id; btn.textContent='✕'; atd.appendChild(btn); tr.appendChild(atd);
    tbody.appendChild(tr);
  });
  table.appendChild(tbody); wrap.appendChild(table); el.appendChild(wrap);
  el.querySelectorAll('[data-dv]').forEach(btn=>btn.onclick=()=>{const r=btn.dataset.dv;S.ports=S.ports.map(p=>{if(p.accessVlanRef===r)p.accessVlanRef=null;return p;});S.subnets=S.subnets.filter(s=>s.vlanRef!==r);S.hosts=S.hosts.map(h=>{if(h.vlanRef===r)h.vlanRef=null;return h;});S.vlans=S.vlans.filter(v=>v.id!==r);save();refresh();});
}
function renderSubnets(){
  const srows=S.subnets.slice(); const ssort=S.uiSort.subnets||{key:'vlan',dir:1};
  srows.sort((a,b)=>{const va=vByRef(a.vlanRef),vb=vByRef(b.vlanRef); let av='',bv=''; switch(ssort.key){case 'cidr': av=a.cidr; bv=b.cidr; break; case 'gw': av=a.gateway||''; bv=b.gateway||''; break; default: av=va?.vlanId||99999; bv=vb?.vlanId||99999;} return ssort.dir*cmpMixed(av,bv);});
  const el=$('snList'); el.textContent='';
  if(!S.subnets.length){ const empty=document.createElement('div'); empty.className='empty'; const p=document.createElement('p'); p.textContent=i18nText('subnet.empty',{},'Sin subnets. Puedes definirlas manualmente, completar solo faltantes o usar el planificador VLSM.'); empty.appendChild(p); el.appendChild(empty); return; }
  const wrap=document.createElement('div'); wrap.className='tw'; const table=document.createElement('table');
  const thead=document.createElement('thead'); const trh=document.createElement('tr'); trh.appendChild(document.createElement('th')); trh.appendChild(createSortTh('subnets','vlan','VLAN')); trh.appendChild(createSortTh('subnets','cidr','CIDR')); trh.appendChild(createSortTh('subnets','gw','GW')); trh.appendChild(document.createElement('th')); thead.appendChild(trh); table.appendChild(thead);
  const tbody=document.createElement('tbody');
  srows.forEach(s=>{const v=vByRef(s.vlanRef); const tr=document.createElement('tr');
    const ctd=document.createElement('td'); const dot=document.createElement('span'); dot.className='vd'; dot.style.background=safeColor(v?vColor(v.id):'#888','#888'); ctd.appendChild(dot); tr.appendChild(ctd);
    const vtd=document.createElement('td'); vtd.textContent=v?`${v.vlanId} ${v.name||''}`:'—'; tr.appendChild(vtd);
    const cidr=document.createElement('td'); cidr.className='mono'; cidr.textContent=s.cidr||''; tr.appendChild(cidr);
    const gw=document.createElement('td'); gw.className='mono'; gw.textContent=s.gateway||'—'; tr.appendChild(gw);
    const atd=document.createElement('td'); const box=document.createElement('div'); box.style.display='flex'; box.style.gap='4px';
    const edit=document.createElement('button'); edit.type='button'; edit.className='btn bs bxs'; edit.dataset.es=s.id; edit.textContent='✎';
    const del=document.createElement('button'); del.type='button'; del.className='btn bd bxs'; del.dataset.ds=s.id; del.textContent='✕';
    box.append(edit,del); atd.appendChild(box); tr.appendChild(atd); tbody.appendChild(tr);
  });
  table.appendChild(tbody); wrap.appendChild(table); el.appendChild(wrap);
  el.querySelectorAll('[data-ds]').forEach(btn=>btn.onclick=()=>{S.subnets=S.subnets.filter(s=>s.id!==btn.dataset.ds);save();refresh();});
  el.querySelectorAll('[data-es]').forEach(btn=>btn.onclick=()=>{const s=S.subnets.find(x=>x.id===btn.dataset.es);if(!s)return;$('mSnVlan').value=s.vlanRef||'';$('mSnCidr').value=s.cidr||'';$('mSnGw').value=s.gateway||'';updManualSnHint();navTo('vlan');window.scrollTo({top:0,behavior:'smooth'});});
}

// ─────────────────── HOSTS ───────────────────
$('hIpMode').onchange=()=>{const s=$('hIpMode').value==='static';$('hStaticSec').style.display=s?'':'none';if(s)updSnHint();};
$('hVlan').onchange=updSnHint;


// =========================================================
// 09. HOSTS Y MAPA IP
// Alta/edición de hosts, asignación de puertos, filtros, mapa IP y comprobaciones de subnet.
// =========================================================
function updSnHint(){const ref=$('hVlan').value;if(!ref){$('hSnHint').textContent='';return;}const sn=snByVRef(ref);if(!sn){$('hSnHint').textContent=i18nText('hosts.subnet.none',{},'Sin subnet en esta VLAN.');return;}const ci=parseCidr(sn.cidr);$('hSnHint').textContent=i18nText('hosts.subnet.summary',{cidr:sn.cidr,gateway:sn.gateway||'—',first:ci?.fh?ip4s(ci.fh):'?',last:ci?.lh?ip4s(ci.lh):'?'},'{cidr} · GW: {gateway} · Rango: {first}–{last}');}
function structuredHostAccess(hostOrId){
  const hostId=typeof hostOrId==='string'?hostOrId:hostOrId?.id;
  const api=window.NetWizardStructuredCabling;
  return hostId&&api&&typeof api.hostAccess==='function'?api.hostAccess(S,hostId):null;
}
function hostResolvedPortId(h){
  const access=structuredHostAccess(h);
  if(access?.structured&&access.complete&&access.switchPortId)return access.switchPortId;
  return h?.portRef||null;
}
function hostConnectedDeviceId(h){
  const access=structuredHostAccess(h);
  if(access?.structured&&access.complete&&access.deviceId)return access.deviceId;
  if(h?.connectedDeviceId && devById(h.connectedDeviceId))return h.connectedDeviceId;
  const portId=hostResolvedPortId(h),p=portId?S.ports.find(x=>x.id===portId):null;
  return p?.deviceId||null;
}
function connectableDevices(){return S.devices.filter(d=>portsByDev(d.id).length>0);}
function hostAssignablePorts(deviceId){
  if(!deviceId)return [];
  const d=devById(deviceId); if(!d) return [];
  const ports=portsByDev(deviceId).slice().sort((a,b)=>(a.position||999)-(b.position||999)||a.name.localeCompare(b.name));
  if(isSwitchDevice(d))return ports.filter(p=>p.mode!=='trunk' && (p.role||'')!=='wan');
  return ports.filter(p=>(p.role||'')!=='wan');
}
function hostPortUsedByOther(portId,excludeHostId){return S.hosts.some(h=>h.id!==excludeHostId&&hostResolvedPortId(h)===portId);}
function hostPortMatchesVlan(p,vlanRef){
  if(!p)return false;
  if(!vlanRef)return true;
  return !p.accessVlanRef || p.accessVlanRef===vlanRef;
}
function hostPortScore(p,host){
  let score=0;
  if(!hostPortUsedByOther(p.id,host?.id))score+=100;
  if(hostPortMatchesVlan(p,host?.vlanRef))score+=25;
  if(p.mode==='access')score+=10;
  if(!p.accessVlanRef)score+=8;
  if((p.role||'')==='lan')score+=4;
  return score;
}
function suggestHostPort(deviceId,excludeHostId,hostObj=null){
  const host=hostObj||S.hosts.find(h=>h.id===excludeHostId)||null;
  const ports=hostAssignablePorts(deviceId);
  if(!ports.length)return '';
  const ranked=ports.slice().sort((a,b)=>hostPortScore(b,host)-hostPortScore(a,host)||(a.position||999)-(b.position||999)||a.name.localeCompare(b.name));
  return ranked[0]?.id||'';
}
function configurePortForHost(portId,hostId,opts={}){
  const h=S.hosts.find(x=>x.id===hostId);
  const p=S.ports.find(x=>x.id===portId);
  if(!h||!p||structuredHostAccess(h)?.structured)return false;
  const vlan=h.vlanRef||p.accessVlanRef||null;
  p.mode='access';
  if(vlan)p.accessVlanRef=vlan;
  p.allowedVlans=[];
  if(!p.desc || opts.forceDesc)p.desc=`Host ${h.name||hostId}`;
  h.portRef=portId;
  h.connectedDeviceId=p.deviceId;
  if(vlan)h.vlanRef=vlan;
  return true;
}
function v5LocationName(lid){
  const l=vLocById(lid);
  if(!l)return '';
  const pl=l.physicalLocationId?physLocById(l.physicalLocationId):null;
  return cleanStr(pl?.name||l.name||'');
}
function sameOrNestedLocation(deviceLocId,hostLocId){
  if(!deviceLocId||!hostLocId)return false;
  if(deviceLocId===hostLocId)return true;
  const hName=v5LocationName(hostLocId).toLowerCase();
  const dName=v5LocationName(deviceLocId).toLowerCase();
  return !!hName && !!dName && hName===dName;
}
function candidateDevicesForHostLocation(hostLocId){
  const locName=v5LocationName(hostLocId);
  const scored=[];
  for(const d of connectableDevices()){
    const dLoc=deviceVisualLoc(d.id);
    let score=0;
    if(dLoc&&dLoc===hostLocId)score+=100;
    else if(sameOrNestedLocation(dLoc,hostLocId))score+=80;
    else if(locName && cleanStr(d.physicalLocation).toLowerCase()===locName.toLowerCase())score+=65;
    if(isSwitchDevice(d))score+=30;
    if(d.type==='router')score+=12;
    if(d.wirelessRole&&d.wirelessRole!=='none')score+=8;
    const free=hostAssignablePorts(d.id).some(p=>!hostPortUsedByOther(p.id,''));
    if(free)score+=18;
    if(score>0)scored.push({d,score});
  }
  return scored.sort((a,b)=>b.score-a.score||a.d.name.localeCompare(b.d.name)).map(x=>x.d);
}
function autoAssignHostToLocation(hostId,locId,opts={}){
  const h=S.hosts.find(x=>x.id===hostId);
  if(!h||!locId)return {ok:false,reason:i18nText('hosts.autoAssign.notFound',{},'Host o ubicación no encontrados')};
  const loc=vLocById(locId);
  if(loc){
    const pl=loc.physicalLocationId?physLocById(loc.physicalLocationId):null;
    h.physicalLocation=pl?.name||loc.name||h.physicalLocation||'';
  }
  if((h.portAssignMode||'auto')==='manual' && !opts.force)return {ok:false,reason:i18nText('hosts.autoAssign.manualMode',{},'Modo manual')};
  const candidates=candidateDevicesForHostLocation(locId);
  for(const d of candidates){
    const pId=suggestHostPort(d.id,h.id,h);
    if(pId && configurePortForHost(pId,h.id)){
      setHostVisualLoc(h.id,locId);
      return {ok:true,deviceId:d.id,portId:pId};
    }
  }
  setHostVisualLoc(h.id,locId);
  return {ok:false,reason:i18nText('hosts.autoAssign.noCompatiblePorts',{},'No hay puertos libres compatibles en esta ubicación')};
}
function fillHostDeviceSel(){
  const opts=[makeOption('',i18nText('hosts.select.noDevice',{},'— Sin equipo —')), ...connectableDevices().map(d=>makeOption(d.id,`${d.name||''} · ${d.type||i18nText('hosts.device.generic',{},'equipo')}`))];
  setOptions($('hConnDev'),opts);
}
function fillHostManagedDeviceSel(keepValue){
  const eligible=S.devices.filter(d=>['server','access_point','appliance'].includes(devKind(d))).sort((a,b)=>(a.name||'').localeCompare(b.name||''));
  const prev=keepValue!==undefined?keepValue:($('hDeviceRef')?.value||'');
  setOptions($('hDeviceRef'),[makeOption('',i18nText('hosts.select.noManagedDevice',{},'— No representa dispositivo gestionado —')),...eligible.map(d=>makeOption(d.id,`${d.name||d.id} · ${devLabel(d)} · ${d.vendorOs||i18nText('hosts.device.noVendor',{},'sin vendor')}`))]);
  if(prev&&eligible.some(d=>d.id===prev))$('hDeviceRef').value=prev;
}
function fillHostPortSel(deviceId,keepValue){
  const devId=deviceId||$('hConnDev').value||'';
  const prev=keepValue!==undefined?keepValue:($('hPort')?.value||'');
  const pts=hostAssignablePorts(devId);
  const curHost=$('hostEditId').value||null;
  setOptions($('hPort'),[makeOption('',i18nText('hosts.select.noPort',{},'Sin puerto asignado')), ...pts.map(p=>makeOption(p.id,`${p.name||''}${hostPortUsedByOther(p.id,curHost)?i18nText('hosts.port.occupiedSuffix',{},' · ocupado'):''}`))]);
  if(prev && pts.some(p=>p.id===prev))$('hPort').value=prev;
}
function fillHostLocSel(){
  ensureVisualModel();
  setOptions($('hLoc'),[makeOption('',i18nText('hosts.select.autoLocation',{},'Automática / según equipo')), ...vLocs().map(l=>makeOption(l.id,l.name||''))]);
}
function syncHostI18nLabels(){ if($('hUseHint'))$('hUseHint').value=i18nText('hosts.form.useValue',{},'Servidor/AP/appliance · generación vendor'); }
function setHostConnectionControlsLocked(locked){
  ['hConnDev','hPortMode','hPort'].forEach(id=>{if($(id))$(id).disabled=!!locked;});
}
function applyStructuredHostAuthority(h){
  const access=structuredHostAccess(h);
  const hint=$('hConnAuthority');
  if(!access?.structured){
    setHostConnectionControlsLocked(false);
    if(hint)hint.textContent=i18nText('hosts.connection.directAuthority',{},'Conexión directa: el puerto puede asignarse aquí. Si documentas toma/cableado en Inventario físico, esa ruta pasará a ser autoritativa.');
    return false;
  }
  setHostConnectionControlsLocked(true);
  const p=access.switchPortId?S.ports.find(x=>x.id===access.switchPortId):null;
  const d=access.deviceId?devById(access.deviceId):null;
  if(d){
    if(!$('hConnDev').querySelector(`option[value="${d.id}"]`))$('hConnDev').appendChild(makeOption(d.id,d.name||d.id));
    $('hConnDev').value=d.id;
  }else $('hConnDev').value='';
  if(p){
    setOptions($('hPort'),[makeOption(p.id,p.name||p.id)]);
    $('hPort').value=p.id;
  }else setOptions($('hPort'),[makeOption('',i18nText('hosts.connection.incompleteRoute',{},'Ruta física incompleta'))]);
  $('hPortMode').value='manual';
  $('hDevHint').value=access.complete&&d&&p?i18nText('hosts.connection.physicalSummary',{device:d.name,port:p.name},'Físico → {device} · {port}'):i18nText('hosts.connection.structuredIncomplete',{},'Cableado estructurado incompleto');
  if(hint)hint.textContent=access.ambiguous
    ? i18nText('hosts.connection.ambiguous',{},'Inventario físico es autoritativo, pero el host aparece conectado a más de una toma. Corrige esa ambigüedad en Cableado estructurado.')
    : (access.complete
      ? i18nText('hosts.connection.derived',{},'Derivado de Inventario físico. Para cambiar equipo o puerto, modifica toma, tramo permanente o parcheo rack.')
      : i18nText('hosts.connection.completeRoute',{},'Inventario físico es autoritativo. Completa la ruta toma → patch panel → switch para resolver el puerto.'));
  if(d && !$('hLoc').value)$('hLoc').value=deviceVisualLoc(d.id)||'';
  return true;
}
function updateHostDeviceHint(){
  const editId=$('hostEditId').value||'';
  const editing=editId?S.hosts.find(x=>x.id===editId):null;
  if(editing&&applyStructuredHostAuthority(editing))return;
  setHostConnectionControlsLocked(false);
  const devId=$('hConnDev').value||'';
  const dev=devId?devById(devId):null;
  const mode=$('hPortMode').value||'auto';
  fillHostPortSel(devId,$('hPort').value||'');
  if(mode==='auto' && devId){
    const suggested=suggestHostPort(devId,editId||null);
    if(suggested)$('hPort').value=suggested;
  }
  const pid=$('hPort').value||'';
  const p=pid?S.ports.find(x=>x.id===pid):null;
  const finalDev=p?devById(p.deviceId):dev;
  $('hDevHint').value=finalDev?(mode==='auto'?i18nText('hosts.connection.autoSummary',{device:finalDev.name,port:p?` · ${p.name}`:''},'Auto → {device}{port}'):i18nText('hosts.connection.manualSummary',{device:finalDev.name,port:p?` · ${p.name}`:''},'Manual → {device}{port}')):i18nText('hosts.connection.noDevice',{},'Sin equipo asociado');
  const hint=$('hConnAuthority');if(hint)hint.textContent=i18nText('hosts.connection.directAuthority',{},'Conexión directa: el puerto puede asignarse aquí. Si documentas toma/cableado en Inventario físico, esa ruta pasará a ser autoritativa.');
  if(finalDev && !$('hLoc').value)$('hLoc').value=deviceVisualLoc(finalDev.id)||'';
}
function clearHostForm(){ $('hostEditId').value=''; $('hName').value='';$('hType').value='pc'; $('hVlan').value=''; $('hIpMode').value='dhcp'; $('hStaticIp').value=''; $('hMac').value=''; $('hPhysLoc').value=''; if($('hPhysLocSel'))$('hPhysLocSel').value=''; $('hNotes').value=''; fillHostDeviceSel(); fillHostManagedDeviceSel(''); fillHostLocSel(); setHostConnectionControlsLocked(false); $('hConnDev').value=''; $('hPortMode').value='auto'; fillHostPortSel(''); $('hPort').value=''; $('hLoc').value=''; $('hDevHint').value=i18nText('hosts.connection.noDevice',{},'Sin equipo asociado'); if($('hConnAuthority'))$('hConnAuthority').textContent=i18nText('hosts.connection.directAuthority',{},'Conexión directa: el puerto puede asignarse aquí. Si documentas toma/cableado en Inventario físico, esa ruta pasará a ser autoritativa.'); $('hStaticSec').style.display='none'; $('btnAddHost').dataset.i18n='hosts.actions.add'; $('btnAddHost').textContent=i18nText('hosts.actions.add',{},'➕ Añadir host'); $('btnCancelHostEdit').style.display='none'; $('hSnHint').textContent=''; }
function startHostEdit(id){ const h=S.hosts.find(x=>x.id===id); if(!h)return; $('hostEditId').value=id; fillHostDeviceSel(); fillHostManagedDeviceSel(h.deviceRef||''); fillHostLocSel(); $('hName').value=h.name||''; $('hType').value=h.type||'pc'; $('hVlan').value=h.vlanRef||''; $('hIpMode').value=h.ipMode||'dhcp'; $('hStaticIp').value=h.staticIp||''; $('hMac').value=h.mac||''; $('hPhysLoc').value=h.physicalLocation||''; if($('hPhysLocSel'))$('hPhysLocSel').value=h.physicalLocation||''; $('hNotes').value=h.notes||''; const resolvedPortId=hostResolvedPortId(h); $('hConnDev').value=hostConnectedDeviceId(h)||''; $('hPortMode').value=h.portAssignMode||'auto'; fillHostPortSel($('hConnDev').value,resolvedPortId||''); $('hPort').value=resolvedPortId||''; $('hLoc').value=hostVisualLoc(h.id)||''; updateHostDeviceHint(); $('hStaticSec').style.display=(h.ipMode==='static')?'':'none'; updSnHint(); $('btnAddHost').dataset.i18n='hosts.actions.saveChanges'; $('btnAddHost').textContent=i18nText('hosts.actions.saveChanges',{},'💾 Guardar cambios'); $('btnCancelHostEdit').style.display=''; navTo('hosts'); window.scrollTo({top:0,behavior:'smooth'}); }
if($('btnCancelPhysLocEdit')) $('btnCancelPhysLocEdit').onclick=()=>clearPhysicalLocationForm();
if($('btnAddPhysLoc')) $('btnAddPhysLoc').onclick=()=>{
  const payload={
    id:$('plEditId').value||undefined,
    name:cleanStr($('plName').value),
    type:$('plType').value||'other',
    parentId:$('plParent').value||'',
    distance:cleanStr($('plDistance').value),
    notes:cleanStr($('plNotes').value)
  };
  const result=v5ApplyCommand('upsertPhysicalLocation',payload);
  if(!result.changed)return alert(result.error||'No se ha podido guardar la ubicación.');
  clearPhysicalLocationForm();
};
$('hPhysLocSel').onchange=()=>applyHostPhysicalLocationSelection();
$('hConnDev').onchange=()=>updateHostDeviceHint();
$('hPortMode').onchange=()=>updateHostDeviceHint();
$('hPort').onchange=()=>updateHostDeviceHint();
$('btnCancelHostEdit').onclick=()=>clearHostForm();
$('btnAddHost').onclick=()=>{
  const name=($('hName').value||'').trim();const type=$('hType').value;const vRef=$('hVlan').value||null;const ipMode=$('hIpMode').value;
  const sip=($('hStaticIp').value||'').trim()||null;const mac=($('hMac').value||'').trim()||null;const editId=$('hostEditId').value||null;
  const deviceRef=$('hDeviceRef')?.value||null;
  let connectedDeviceId=$('hConnDev').value||null;let portAssignMode=$('hPortMode').value||'auto';
  let portRef=$('hPort').value||null;const physicalLocation=(($('hPhysLoc').value||$('hPhysLocSel').value||'').trim())||null;const notes=($('hNotes').value||'').trim()||null;
  const existingHost=editId?S.hosts.find(x=>x.id===editId):null,physicalAccess=existingHost?structuredHostAccess(existingHost):null;
  if(physicalAccess?.structured){
    if(physicalAccess.complete){portRef=physicalAccess.switchPortId||null;connectedDeviceId=physicalAccess.deviceId||null;}
    else if(existingHost){portRef=existingHost.portRef||null;connectedDeviceId=existingHost.connectedDeviceId||null;portAssignMode=existingHost.portAssignMode||'auto';}
  }
  if(physicalLocation)rememberPhysicalLocation(physicalLocation);
  if(!name)return alert(i18nText('device.alert.nameRequired',{},'Nombre requerido.'));if(!vRef)return alert(i18nText('hosts.alert.selectVlan',{},'Selecciona VLAN.'));
  if(ipMode==='static'){if(!sip)return alert(i18nText('hosts.alert.staticRequired',{},'IP estática requerida.'));if(parseIp(sip)===null)return alert(i18nText('hosts.alert.invalidIp',{},'IP inválida.'));const sn=snByVRef(vRef);if(sn&&!ipInSn(sip,sn.cidr))return alert(i18nText('hosts.alert.ipOutsideSubnet',{ip:sip,cidr:sn.cidr},'La IP {ip} no está en {cidr}.'));if(S.hosts.some(h=>h.id!==editId&&h.staticIp===sip&&h.vlanRef===vRef))return alert(i18nText('hosts.alert.duplicateIp',{},'IP duplicada.'));if(snByVRef(vRef)?.gateway===sip)return alert(i18nText('hosts.alert.gatewayIp',{},'Esa IP es el gateway.'));}
  if(!physicalAccess?.structured&&connectedDeviceId && portAssignMode==='auto')portRef=suggestHostPort(connectedDeviceId,editId)||null;
  if(portRef){const port=S.ports.find(p=>p.id===portRef);if(!port)return alert(i18nText('hosts.alert.portMissing',{},'El puerto seleccionado ya no existe.'));if(connectedDeviceId&&port.deviceId!==connectedDeviceId)return alert(i18nText('hosts.alert.portWrongDevice',{},'El puerto no pertenece al equipo seleccionado.'));if(hostPortUsedByOther(portRef,editId))return alert(i18nText('hosts.alert.portInUse',{},'Ese puerto ya está asociado a otro host.'));}
  const locVal=$('hLoc').value||'';
  if(editId){ const h=S.hosts.find(x=>x.id===editId); if(!h)return alert(i18nText('hosts.alert.editMissing',{},'No se encontró el host a editar.')); Object.assign(h,{name,type,vlanRef:vRef,ipMode,staticIp:sip,mac,portRef,notes,physicalLocation,connectedDeviceId,portAssignMode,deviceRef}); if(locVal)setHostVisualLoc(editId,locVal); else if(connectedDeviceId)setHostVisualLoc(editId,deviceVisualLoc(connectedDeviceId)||hostVisualLoc(editId)||''); }
  else { const id=uid('h'); S.hosts.push({id,name,type,vlanRef:vRef,ipMode,staticIp:sip,mac,portRef,notes,physicalLocation,connectedDeviceId,portAssignMode,deviceRef}); if(locVal)setHostVisualLoc(id,locVal); else if(connectedDeviceId)setHostVisualLoc(id,deviceVisualLoc(connectedDeviceId)||''); }
  clearHostForm(); save();refresh();
};
$('btnBulk').onclick=()=>$('bulkModal').classList.add('on');
$('bulkClose').onclick=$('bulkCancel').onclick=()=>$('bulkModal').classList.remove('on');
$('bulkAdd').onclick=()=>{
  const lines=$('bulkTxt').value.split('\n').map(l=>l.trim()).filter(Boolean);let ok=0,errs=[];
  for(const line of lines){
    const p=line.split(',').map(s=>s.trim());
    if(p.length<3){errs.push(i18nText('hosts.bulk.invalidFormat',{line},'"{line}": formato inválido'));continue;}
    const [name,typeRaw,vidStr,ipRaw,physicalLocationRaw,visualLocRaw]=p;
    const vid=parseInt(vidStr,10); const v=vByNum(vid);
    if(!v){errs.push(i18nText('hosts.bulk.vlanMissing',{vlan:vidStr},'VLAN {vlan} no existe'));continue;}
    const t=Object.keys(HT).includes((typeRaw||'').toLowerCase())?(typeRaw||'').toLowerCase():'iot';
    const im=(ipRaw||'dhcp').toLowerCase()==='dhcp'?'dhcp':'static';
    const sip=im==='static'?(ipRaw||'').trim():null;
    if(im==='static'&&sip&&parseIp(sip)===null){errs.push(i18nText('hosts.bulk.invalidIp',{ip:sip},'IP inválida: {ip}'));continue;}
    const physicalLocation=cleanStr(physicalLocationRaw)||null;
    if(physicalLocation)rememberPhysicalLocation(physicalLocation);
    const id=uid('h');
    S.hosts.push({id,name,type:t,vlanRef:v.id,ipMode:im,staticIp:sip,mac:null,portRef:null,notes:null,physicalLocation,connectedDeviceId:null,portAssignMode:'auto'});
    if(cleanStr(visualLocRaw)){
      ensureVisualModel();
      const loc=vLocs().find(l=>cleanStr(l.name).toLowerCase()===cleanStr(visualLocRaw).toLowerCase());
      if(loc) setHostVisualLoc(id,loc.id);
    }
    ok++;
  }
  $('bulkModal').classList.remove('on');$('bulkTxt').value='';save();refresh();
  alert(i18nText('hosts.bulk.result',{count:ok},'{count} hosts añadidos.')+(errs.length?('\n'+i18nText('hosts.bulk.errorsTitle',{},'Errores:')+'\n'+errs.join('\n')):''));
};
$('hFiltV').onchange=$('hFiltT').onchange=()=>{hostsPage=0;renderHosts();};
if($('hostsPrev'))$('hostsPrev').onclick=()=>{if(hostsPage>0){hostsPage--;renderHosts();}};
if($('hostsNext'))$('hostsNext').onclick=()=>{hostsPage++;renderHosts();};
function createSortTh(name,key,label){
  const th=document.createElement('th');
  th.style.cursor='pointer';
  th.style.userSelect='none';
  th.textContent=label+sortIndicator(name,key);
  th.addEventListener('click',()=>setTableSort(name,key));
  return th;
}
function appendText(el,value){ el.appendChild(document.createTextNode(String(value ?? ''))); return el; }
function makeBadge(text, cls){ const span=document.createElement('span'); span.className=cls||'b'; span.textContent=String(text ?? ''); return span; }
function safeColor(value, fallback){ const s=String(value || '').trim(); return /^#[0-9a-f]{3,8}$/i.test(s) ? s : (fallback || '#888'); }
function textColorForBg(value){ const s=safeColor(value,'#3b82f6').replace('#',''); const hex=s.length===3?s.split('').map(x=>x+x).join(''):s.slice(0,6); const r=parseInt(hex.slice(0,2),16)||0,g=parseInt(hex.slice(2,4),16)||0,b=parseInt(hex.slice(4,6),16)||0; return ((r*299+g*587+b*114)/1000)>=150?'#111827':'#ffffff'; }
function addOption(sel, value, text, selected){ const opt=document.createElement('option'); opt.value=String(value ?? ''); opt.textContent=String(text ?? ''); if(selected)opt.selected=true; sel.appendChild(opt); return opt; }
let hostsPage=0;
const HOSTS_PAGE_SIZE=80;
function renderHosts(){
  const fv=$('hFiltV').value,ft=$('hFiltT').value;
  const vlanByRef=new Map(S.vlans.map(v=>[v.id,v]));
  const deviceById=new Map(S.devices.map(d=>[d.id,d]));
  const portById=new Map(S.ports.map(p=>[p.id,p]));
  const visualLocById=new Map(vLocs().map(l=>[l.id,l]));
  const hostMeta=new Map(),ipSortCache=new Map();
  const metaFor=h=>{
    if(hostMeta.has(h.id))return hostMeta.get(h.id);
    const access=structuredHostAccess(h);
    const resolvedPortId=access?.structured&&access.complete&&access.switchPortId?access.switchPortId:(h.portRef||null);
    const port=resolvedPortId?portById.get(resolvedPortId)||null:null;
    const deviceId=access?.structured&&access.complete&&access.deviceId?access.deviceId:(h.connectedDeviceId&&deviceById.has(h.connectedDeviceId)?h.connectedDeviceId:(port?.deviceId||null));
    const value={access,resolvedPortId,port,dev:deviceId?deviceById.get(deviceId)||null:null,loc:visualLocById.get(hostVisualLoc(h.id)||'')||null};
    hostMeta.set(h.id,value);return value;
  };
  const hostOrdinalById=new Map(),vlanOrdinal=new Map(),subnetInfoByVlan=new Map();
  for(const host of S.hosts){const n=vlanOrdinal.get(host.vlanRef)||0;hostOrdinalById.set(host.id,n);vlanOrdinal.set(host.vlanRef,n+1);}
  for(const subnet of S.subnets||[]){if(subnet.vlanRef)subnetInfoByVlan.set(subnet.vlanRef,parseCidr(subnet.cidr));}
  const ipFor=h=>{
    if(ipSortCache.has(h.id))return ipSortCache.get(h.id);
    let value=h.staticIp||'';
    if(h.ipMode!=='static'){
      const ci=subnetInfoByVlan.get(h.vlanRef),ordinal=hostOrdinalById.get(h.id)||0;
      const idx=Math.max(2,ordinal+2);
      const next=ci&&ci.fh!=null&&ci.lh!=null&&(ci.fh+idx)<=ci.lh?ip4s(ci.fh+idx):'DHCP';
      value=h.ipMode==='dhcp'?('DHCP · '+next):next;
    }
    ipSortCache.set(h.id,value);return value;
  };
  let hosts=S.hosts.slice();if(fv)hosts=hosts.filter(h=>h.vlanRef===fv);if(ft)hosts=hosts.filter(h=>h.type===ft);
  const sort=S.uiSort.hosts||{key:'name',dir:1};
  hosts.sort((a,b)=>{const va=vlanByRef.get(a.vlanRef),vb=vlanByRef.get(b.vlanRef);let av='',bv='';switch(sort.key){case 'type':av=hostTypeText(a.type);bv=hostTypeText(b.type);break;case 'vlan':av=va?.vlanId||99999;bv=vb?.vlanId||99999;break;case 'ip':av=ipFor(a);bv=ipFor(b);break;case 'location':{const ma=metaFor(a),mb=metaFor(b);av=ma.loc?.name||a.physicalLocation||'';bv=mb.loc?.name||b.physicalLocation||'';break;}case 'connection':{const ma=metaFor(a),mb=metaFor(b);av=(ma.dev?.name||'')+' '+(ma.resolvedPortId||'');bv=(mb.dev?.name||'')+' '+(mb.resolvedPortId||'');break;}default:av=a.name;bv=b.name;}return sort.dir*cmpMixed(av,bv);});
  $('hCnt').textContent=i18nText('hosts.list.count',{count:S.hosts.length},'{count} hosts');
  const el=$('hostsList');
  el.textContent='';
  if(!hosts.length){
    hostsPage=0;
    const info=$('hostsPageInfo');if(info)info.textContent=i18nText('hosts.list.results',{count:0},'{count} resultados');
    const pager=$('hostsPager');if(pager)pager.style.display='none';
    if($('hostsPrev'))$('hostsPrev').disabled=true;if($('hostsNext'))$('hostsNext').disabled=true;
    const empty=document.createElement('div'); empty.className='empty';
    const icon=document.createElement('div'); icon.className='ei'; icon.textContent='💻';
    const p=document.createElement('p'); p.textContent=S.hosts.length?i18nText('hosts.empty.filtered',{},'Sin resultados.'):i18nText('hosts.empty.none',{},'Añade hosts arriba.');
    empty.append(icon,p); el.appendChild(empty); return;
  }
  const totalPages=Math.max(1,Math.ceil(hosts.length/HOSTS_PAGE_SIZE));
  hostsPage=Math.min(Math.max(0,hostsPage),totalPages-1);
  const start=hostsPage*HOSTS_PAGE_SIZE,visible=hosts.slice(start,start+HOSTS_PAGE_SIZE);
  const pageInfo=$('hostsPageInfo');if(pageInfo)pageInfo.textContent=i18nText('hosts.list.page',{count:hosts.length,page:hostsPage+1,total:totalPages},'{count} resultados · página {page}/{total}');
  const prev=$('hostsPrev'),next=$('hostsNext'),pager=$('hostsPager');
  if(pager)pager.style.display=hosts.length>HOSTS_PAGE_SIZE?'flex':'none';
  if(prev)prev.disabled=hostsPage<=0;if(next)next.disabled=hostsPage>=totalPages-1;
  const wrap=document.createElement('div'); wrap.className='tw';
  const table=document.createElement('table'); const thead=document.createElement('thead'); const trh=document.createElement('tr');
  [['name',i18nText('form.name',{},'Nombre')],['type',i18nText('form.type',{},'Tipo')],['vlan','VLAN'],['ip','IP'],['location',i18nText('hosts.list.location',{},'Ubicación')],['connection',i18nText('hosts.list.connection',{},'Conexión')]].forEach(([k,l])=>trh.appendChild(createSortTh('hosts',k,l)));
  trh.appendChild(document.createElement('th')); thead.appendChild(trh); table.appendChild(thead);
  const tbody=document.createElement('tbody');
  visible.forEach(h=>{
    const v=vlanByRef.get(h.vlanRef); const {access,dev,resolvedPortId,port,loc}=metaFor(h);
    const tr=document.createElement('tr');
    const tdName=document.createElement('td'); const bName=document.createElement('b'); bName.textContent=h.name||''; const hint=document.createElement('div'); hint.className='hint'; hint.textContent=h.physicalLocation||'—'; tdName.append(bName,hint); tr.appendChild(tdName);
    const tdType=document.createElement('td'); appendText(tdType,`${HT[h.type]?.i||''} ${hostTypeText(h.type)}`); tr.appendChild(tdType);
    const tdVlan=document.createElement('td');
    if(v){ const inline=document.createElement('span'); inline.style.display='inline-flex'; inline.style.alignItems='center'; inline.style.gap='3px'; const dot=document.createElement('span'); dot.className='vd'; dot.style.background=v.color||vColor(v.id); inline.appendChild(dot); appendText(inline,`${v.vlanId} ${v.name||''}`); tdVlan.appendChild(inline); }
    else tdVlan.textContent='—';
    tr.appendChild(tdVlan);
    const tdIp=document.createElement('td'); tdIp.className='mono';
    if(h.ipMode==='static') tdIp.appendChild(makeBadge(h.staticIp||'—','b bgn')); else tdIp.appendChild(makeBadge('DHCP','b bac'));
    tr.appendChild(tdIp);
    const tdLoc=document.createElement('td'); appendText(tdLoc,loc?.name||'—'); const locHint=document.createElement('div'); locHint.className='hint'; locHint.textContent=h.physicalLocation||'—'; tdLoc.appendChild(locHint); tr.appendChild(tdLoc);
    const tdConn=document.createElement('td'); const conn=document.createElement('div'); conn.textContent=dev?dev.name:(access?.structured?i18nText('hosts.connection.incompleteRoute',{},'Ruta física incompleta'):i18nText('hosts.connection.noDeviceShort',{},'Sin equipo')); const portHint=document.createElement('div'); portHint.className='hint mono'; portHint.textContent=port?port.name:(access?.structured?i18nText('hosts.connection.physicalInventory',{},'Inventario físico'):(h.portAssignMode==='auto'?i18nText('hosts.portMode.autoShort',{},'Auto'):'—')); tdConn.append(conn,portHint); if(access?.structured)tdConn.appendChild(makeBadge(i18nText('hosts.connection.physicalBadge',{},'Físico'),'b bgr')); tr.appendChild(tdConn);
    const tdActions=document.createElement('td'); tdActions.style.display='flex'; tdActions.style.gap='4px';
    const edit=document.createElement('button'); edit.className='btn bs bxs'; edit.type='button'; edit.dataset.eh=h.id; edit.textContent='✎';
    const del=document.createElement('button'); del.className='btn bd bxs'; del.type='button'; del.dataset.dh=h.id; del.textContent='🗑';
    tdActions.append(edit,del); tr.appendChild(tdActions);
    tbody.appendChild(tr);
  });
  table.appendChild(tbody); wrap.appendChild(table); el.appendChild(wrap);
  el.querySelectorAll('[data-eh]').forEach(b=>b.onclick=()=>startHostEdit(b.dataset.eh));
  el.querySelectorAll('[data-dh]').forEach(b=>b.onclick=()=>{if(confirm(i18nText('hosts.confirm.delete',{},'¿Eliminar host?'))){const hostId=b.dataset.dh;S.hosts=S.hosts.filter(x=>x.id!==hostId);if(Array.isArray(S.hostOutletConnections))S.hostOutletConnections=S.hostOutletConnections.filter(x=>x.hostId!==hostId); delete vv().assign.hosts[hostId]; delete vv().pos[hostId]; save();refresh();}});
}
function renderIpMap(){
  const el=$('ipMap'); clearNode(el);
  const vlans=S.vlans.slice().sort((a,b)=>a.vlanId-b.vlanId);
  if(!vlans.length){ setSingleHint(el,i18nText('hosts.ipMap.noVlans',{},'Sin VLANs configuradas.')); return; }
  vlans.forEach(v=>{
    const sn=snByVRef(v.id); const hosts=S.hosts.filter(h=>h.vlanRef===v.id); const color=v.color||vColor(v.id);
    const block=document.createElement('div'); block.style.marginBottom='12px';
    const title=document.createElement('div'); title.style.display='flex'; title.style.alignItems='center'; title.style.gap='5px'; title.style.fontSize='12px'; title.style.fontWeight='700'; title.style.marginBottom='4px';
    const dot=makeEl('span','vd'); dot.style.background=color; title.append(dot, document.createTextNode(`VLAN ${v.vlanId} — ${v.name||''} `), makeEl('span','b bgr',hosts.length)); block.appendChild(title);
    if(!sn){ block.appendChild(makeEl('div','hint',i18nText('hosts.ipMap.noSubnet',{},'Sin subnet.'))); el.appendChild(block); return; }
    const ci=parseCidr(sn.cidr); const total=ci?.fh&&ci?.lh?ci.lh-ci.fh+1:0;
    block.appendChild(makeEl('div','mono hint',i18nText('hosts.ipMap.summary',{cidr:sn.cidr,gateway:sn.gateway||'—',count:total},'{cidr} · GW: {gateway} · {count} disponibles')));
    const statics=hosts.filter(h=>h.ipMode==='static'&&h.staticIp); const dhcpC=hosts.filter(h=>h.ipMode==='dhcp').length;
    if(ci&&ci.fh&&total>0){
      const gP=1/total*100; const sP=Math.min(statics.length/total*100,99-gP); const dP=Math.min(dhcpC/total*100,99-gP-sP);
      const bar=makeEl('div','ipbar'); const gw=makeEl('div','ipbs ipb-gw','GW'); gw.style.width=`${gP.toFixed(1)}%`; bar.appendChild(gw);
      if(statics.length){const st=makeEl('div','ipbs ipb-st',`${statics.length}E`); st.style.width=`${sP.toFixed(1)}%`; bar.appendChild(st);}
      if(dhcpC){const dh=makeEl('div','ipbs ipb-dh',`${dhcpC}D`); dh.style.width=`${dP.toFixed(1)}%`; bar.appendChild(dh);}
      block.appendChild(bar);
    }
    hosts.slice().sort((a,b)=>((a.ipMode==='static')=== (b.ipMode==='static') ? cmpMixed(a.name,b.name) : (a.ipMode==='static'?-1:1))).forEach(h=>{
      const row=document.createElement('div'); row.style.display='flex'; row.style.alignItems='center'; row.style.gap='5px'; row.style.fontSize='11px'; row.style.padding='2px 0'; row.style.borderBottom='1px solid var(--b1)';
      appendText(row,`${HT[h.type]?.i||''} `); const name=makeEl('span','',h.name||''); name.style.flex='1'; name.style.fontWeight='600'; row.appendChild(name);
      row.appendChild(makeEl('span',h.ipMode==='static'?'b bgn mono':'b bac',h.ipMode==='static'?(h.staticIp||''):'DHCP'));
      block.appendChild(row);
    });
    el.appendChild(block);
  });
}

// ─────────────────── PORT LAYOUT / LINKS ───────────────────


// =========================================================
// 10. PUERTOS VISUALES Y ENLACES
// Layout visual de puertos, generación masiva, creación de enlaces y modal de puerto.
// =========================================================
function fillSwDevSels(){
  const sw=S.devices.filter(isSwitchDevice);
  const opts=sw.map(d=>makeOption(d.id,d.name));
  const noSwitches=i18nText('links.portView.noSwitches',{},'Sin switches.');
  setOptions($('lyDev'),opts,noSwitches);
  setOptions($('visDev'),sw.map(d=>makeOption(d.id,d.name)),noSwitches);
}
function fillLinkPickers(){
  const all=S.ports.slice().sort((a,b)=>portDisp(a).localeCompare(portDisp(b)));
  const opts=all.map(p=>makeOption(p.id,`${portDisp(p)}${isLinked(p.id)?' ⚡':''}`));
  setOptions($('lnkA'),opts,i18nText('links.select.noPorts',{},'Sin puertos')); setOptions($('lnkB'),all.map(p=>makeOption(p.id,`${portDisp(p)}${isLinked(p.id)?' ⚡':''}`)),i18nText('links.select.noPorts',{},'Sin puertos'));
  if($('lnkTransit')){
    const transitVlans=S.vlans.filter(v=>{ const t=(v.intent&&v.intent.type)||''; return t==='transit' || /transit|tr\u00e1nsito|transito|p2p|punto/i.test((v.name||'')+' '+(v.desc||'')); });
    const candidates=transitVlans.length?transitVlans:S.vlans;
    const tOpts=[makeOption('',i18nText('links.select.noTransit',{},'— sin tránsito L3 —')), ...candidates.map(v=>makeOption(v.id,`VLAN ${v.vlanId} · ${v.name||''}`))];
    setOptions($('lnkTransit'),tOpts);
  }
}
$('lyDev').onchange=()=>{const d=devById($('lyDev').value);if(d?.layout){$('lyTotal').value=d.layout.total||'';$('lyCols').value=d.layout.cols||12;$('lyBase').value=d.layout.base||'';}};
$('btnBuildLy').onclick=()=>{const id=$('lyDev').value;if(!id)return alert(i18nText('ports.alert.selectSwitch',{},'Selecciona un switch.'));buildLy(id);};
$('btnApplyLy').onclick=()=>{const id=$('lyDev').value;if(!id)return alert(i18nText('ports.alert.selectSwitch',{},'Selecciona un switch.'));applyLy(id);};
function buildLy(devId){
  const d=devById(devId);const el=$('lyEditor'); if(!d){clearNode(el);return;}
  const total=+($('lyTotal').value||0); if(!total){setSingleHint(el,i18nText('ports.layout.totalHint',{},'Indica el total de puertos y pulsa "Ver layout".'));return;}
  const cols=Math.max(2,Math.min(16,+($('lyCols').value||12)));const base=($('lyBase').value||'').trim();
  const prev=d.layout?.slots?.length===total?d.layout.slots.slice():Array(total).fill('EMPTY');
  d.layout={total,cols,base,slots:prev.slice()};save();
  clearNode(el); const grid=document.createElement('div'); grid.style.display='grid'; grid.style.gridTemplateColumns=`repeat(${cols},1fr)`; grid.style.gap='4px';
  prev.forEach((t,i)=>{
    const pos=i+1; const nm=t!=='EMPTY'&&d.vendorOs?buildPName(d.vendorOs,t,pos,base):'—';
    const cell=document.createElement('div'); cell.style.background='var(--s2)'; cell.style.border='1px solid var(--b1)'; cell.style.borderRadius='6px'; cell.style.padding='5px'; cell.style.fontSize='9.5px';
    const pnum=document.createElement('div'); pnum.style.fontWeight='700'; pnum.textContent=`P${pos}`;
    const name=makeEl('div','mono',nm); name.style.color='var(--t3)'; name.style.overflow='hidden'; name.style.whiteSpace='nowrap'; name.style.textOverflow='ellipsis';
    const sel=document.createElement('select'); sel.style.fontSize='9.5px'; sel.style.padding='1px'; sel.style.width='100%'; sel.style.marginTop='2px'; sel.dataset.sl=String(i);
    [['EMPTY','—'],['FE','FE'],['GE','GE'],['SFP','SFP']].forEach(([v,l])=>sel.appendChild(makeOption(v,l,t===v)));
    sel.addEventListener('change',()=>{d.layout.slots[+sel.dataset.sl]=sel.value;save();buildLy(devId);});
    cell.append(pnum,name,sel); grid.appendChild(cell);
  });
  el.appendChild(grid);
}
function applyLy(devId){
  const d=devById(devId);if(!d?.layout?.total)return alert(i18nText('ports.alert.configureLayout',{},'Configura el layout primero.'));
  if(!d.vendorOs)return alert(i18nText('ports.alert.addVendorOs',{},'Añade Vendor/OS al dispositivo.'));
  const mode=$('lyMode').value;const defVlan=$('lyVlan').value||S.vlans[0]?.id||null;
  if(mode==='replace'){const old=S.ports.filter(p=>p.deviceId===devId).map(p=>p.id);S.links=S.links.filter(l=>!old.includes(l.aPortId)&&!old.includes(l.bPortId));S.hosts=S.hosts.map(h=>{if(old.includes(h.portRef))h.portRef=null;return h;});S.ports=S.ports.filter(p=>p.deviceId!==devId);}
  for(let i=0;i<d.layout.slots.length;i++){const pos=i+1;const media=d.layout.slots[i];if(media==='EMPTY')continue;const name=buildPName(d.vendorOs,media,pos,d.layout.base);if(mode==='merge'&&S.ports.some(p=>p.deviceId===devId&&p.name===name))continue;S.ports.push({id:uid('port'),deviceId:devId,name,media,mode:'access',accessVlanRef:defVlan,nativeVlanRef:null,allowedVlans:[],desc:null,position:pos,role:null});}
  save();refresh();alert(i18nText('ports.feedback.generated',{device:d.name},'✓ Puertos generados para {device}.'));
}
$('visDev').onchange=renderVisPorts;
function portChips(p,context=null){
  const frag=document.createDocumentFragment();
  const chip=(txt,css)=>{const sp=makeEl('span','pch',txt); if(css) Object.entries(css).forEach(([k,v])=>sp.style[k]=v); frag.appendChild(sp);};
  chip(p.media||'');
  if(p.mode==='access'){
    const v=context?.vlanByRef?.get(p.accessVlanRef)||vByRef(p.accessVlanRef); chip(v?'V'+v.vlanId:'?',{background:v?(v.color||vColor(v.id)):'var(--s3)',color:v?'#fff':'var(--t3)'});
  } else if(p.mode==='trunk') chip('TRK',{background:'var(--ywd)',color:'var(--yw)'});
  else chip('L3',{background:'var(--pud)',color:'var(--pu)'});
  const linked=context?.linkedPorts?context.linkedPorts.has(p.id):isLinked(p.id);
  if(linked)chip('🔗',{background:'var(--acd)',color:'var(--ac)'});
  const hc=context?.hostCountByPort?context.hostCountByPort.get(p.id)||0:S.hosts.filter(h=>hostResolvedPortId(h)===p.id).length;
  if(hc) chip(`${hc}💻`,{background:'var(--gnd)',color:'var(--gn)'});
  return frag;
}
function renderVisPorts(){
  const devId=$('visDev').value;const grid=$('portGrid');clearNode(grid);
  if(!devId){setSingleHint(grid,i18nText('links.portView.noSwitches',{},'Sin switches.'));return;}
  const d=devById(devId);
  if(!d?.layout?.total){setSingleHint(grid,i18nText('links.portView.noLayout',{},'Este switch no tiene layout. Usa "Layout switch" o añade puertos en la sección Puertos.'));return;}
  const pbp=new Map();for(const p of portsByDev(devId))if(p.position)pbp.set(p.position,p);
  const linkedPorts=new Set();for(const link of S.links||[]){if(link.aPortId)linkedPorts.add(link.aPortId);if(link.bPortId)linkedPorts.add(link.bPortId);}
  const hostCountByPort=new Map();for(const host of S.hosts||[]){const pid=hostResolvedPortId(host);if(pid)hostCountByPort.set(pid,(hostCountByPort.get(pid)||0)+1);}
  const vlanByRef=new Map(S.vlans.map(v=>[v.id,v]));
  const chipContext={linkedPorts,hostCountByPort,vlanByRef};
  for(let pos=1;pos<=d.layout.total;pos++){
    const slot=d.layout.slots?.[pos-1]||'EMPTY';const p=pbp.get(pos)||null;
    const cell=makeEl('div','pport');
    if(slot==='EMPTY'){
      cell.style.opacity='.25'; cell.style.cursor='default'; cell.append(makeEl('div','pn','—'),makeEl('div','pm',`P${pos}`)); grid.appendChild(cell); continue;
    }
    const label=p?.name||buildPName(d.vendorOs,slot,pos,d.layout.base||''); const lnk=p?linkedPorts.has(p.id):false;
    cell.className=`pport ${p?p.mode:'access'} ${lnk?'linked':''}`;
    if(p){ cell.dataset.pp=p.id; cell.addEventListener('click',()=>openPortModal(p.id)); }
    cell.appendChild(makeEl('div','pn',label));
    const meta=makeEl('div','pm'); meta.appendChild(document.createTextNode(`${slot} P${pos}`)); if(p?.desc){ meta.appendChild(document.createElement('br')); meta.appendChild(document.createTextNode(String(p.desc).substring(0,16))); } cell.appendChild(meta);
    const chips=makeEl('div','pc'); if(p) chips.appendChild(portChips(p,chipContext)); cell.appendChild(chips);
    grid.appendChild(cell);
  }
}
let linksPage=0;
const LINKS_PAGE_SIZE=100;
function renderLinks(){
  const el=$('linksList');
  el.textContent='';
  if(!S.links.length){linksPage=0;const info=$('linksPageInfo');if(info)info.textContent=i18nText('links.list.count',{count:0},'{count} enlaces');const pager=$('linksPager');if(pager)pager.style.display='none';if($('linksPrev'))$('linksPrev').disabled=true;if($('linksNext'))$('linksNext').disabled=true;const empty=document.createElement('div'); empty.className='empty'; const p=document.createElement('p'); p.textContent=i18nText('links.empty.none',{},'Sin enlaces.'); empty.appendChild(p); el.appendChild(empty); return;}
  const portById=new Map(S.ports.map(p=>[p.id,p])),deviceById=new Map(S.devices.map(d=>[d.id,d])),vlanByRef=new Map(S.vlans.map(v=>[v.id,v]));
  const portDispFast=p=>`${deviceById.get(p?.deviceId)?.name||'?'} :: ${p?.name||''}`;
  const lrows=S.links.slice(); const lsort=S.uiSort.links||{key:'a',dir:1};
  lrows.sort((x,y)=>{const ax=portById.get(x.aPortId),ay=portById.get(y.aPortId),bx=portById.get(x.bPortId),by=portById.get(y.bPortId);let av='',bv='';switch(lsort.key){case 'b':av=portDispFast(bx);bv=portDispFast(by);break;case 'notes':av=x.notes||'';bv=y.notes||'';break;default:av=portDispFast(ax);bv=portDispFast(ay);}return lsort.dir*cmpMixed(av,bv);});
  const totalPages=Math.max(1,Math.ceil(lrows.length/LINKS_PAGE_SIZE));
  linksPage=Math.min(Math.max(0,linksPage),totalPages-1);
  const start=linksPage*LINKS_PAGE_SIZE,visible=lrows.slice(start,start+LINKS_PAGE_SIZE);
  const pageInfo=$('linksPageInfo');if(pageInfo)pageInfo.textContent=i18nText('links.list.page',{count:lrows.length,page:linksPage+1,total:totalPages},'{count} enlaces · página {page}/{total}');
  const prev=$('linksPrev'),next=$('linksNext'),pager=$('linksPager');
  if(pager)pager.style.display=lrows.length>LINKS_PAGE_SIZE?'flex':'none';
  if(prev)prev.disabled=linksPage<=0;if(next)next.disabled=linksPage>=totalPages-1;
  const wrap=document.createElement('div'); wrap.className='tw';
  const table=document.createElement('table'); const thead=document.createElement('thead'); const trh=document.createElement('tr');
  [['a',i18nText('links.form.portA',{},'Puerto A')],['b',i18nText('links.form.portB',{},'Puerto B')],['notes',i18nText('form.notes',{},'Notas')]].forEach(([k,l])=>trh.appendChild(createSortTh('links',k,l)));
  [i18nText('links.list.cabling',{},'Cableado'),i18nText('links.list.transit',{},'Tránsito'),''].forEach(l=>{const th=document.createElement('th'); th.textContent=l; trh.appendChild(th);});
  thead.appendChild(trh); table.appendChild(thead);
  const tbody=document.createElement('tbody');
  visible.forEach(l=>{
    const a=portById.get(l.aPortId),b=portById.get(l.bPortId),v=vlanByRef.get(l.transitVlanRef||l.vlanRef||l.l3VlanRef);
    const cab=[l.medium&&l.medium!=='auto'?l.medium:'',l.cableType&&l.cableType!=='auto'?l.cableType:'',l.lengthM?l.lengthM+' m':'',l.speed&&l.speed!=='auto'?l.speed:''].filter(Boolean).join(' · ')||'—';
    const tr=document.createElement('tr');
    const tdA=document.createElement('td'); tdA.className='mono'; tdA.textContent=a?portDispFast(a):'?'; if(a&&a.l3Ip){const ip=document.createElement('div'); ip.className='hint mono'; ip.textContent=`${a.l3Ip}/${(a.l3Cidr||'').split('/')[1]||''}`; tdA.appendChild(ip);} tr.appendChild(tdA);
    const tdB=document.createElement('td'); tdB.className='mono'; tdB.textContent=b?portDispFast(b):'?'; if(b&&b.l3Ip){const ip=document.createElement('div'); ip.className='hint mono'; ip.textContent=`${b.l3Ip}/${(b.l3Cidr||'').split('/')[1]||''}`; tdB.appendChild(ip);} tr.appendChild(tdB);
    const tdNotes=document.createElement('td'); tdNotes.textContent=l.notes||''; tr.appendChild(tdNotes);
    const tdCab=document.createElement('td'); tdCab.textContent=cab; tr.appendChild(tdCab);
    const tdTransit=document.createElement('td'); if(v)tdTransit.appendChild(makeBadge(`V${v.vlanId}`,'b bpu')); else tdTransit.textContent='—'; tr.appendChild(tdTransit);
    const tdActions=document.createElement('td'); const del=document.createElement('button'); del.className='btn bd bxs'; del.type='button'; del.dataset.dl=l.id; del.textContent='✕'; tdActions.appendChild(del); tr.appendChild(tdActions);
    tbody.appendChild(tr);
  });
  table.appendChild(tbody); wrap.appendChild(table); el.appendChild(wrap);
  el.querySelectorAll('[data-dl]').forEach(btn=>btn.onclick=()=>{S.links=S.links.filter(x=>x.id!==btn.dataset.dl);save();refresh();});
  if($('linksPrev'))$('linksPrev').onclick=()=>{if(linksPage>0){linksPage--;renderLinks();}};
  if($('linksNext'))$('linksNext').onclick=()=>{linksPage++;renderLinks();};
}
$('btnAddLink').onclick=()=>{
  const a=$('lnkA').value,b=$('lnkB').value;const notes=($('lnkNotes').value||'').trim()||null;
  const transitVlanRef=$('lnkTransit')?($('lnkTransit').value||null):null;
  const medium=$('lnkMedium')?($('lnkMedium').value||'auto'):'auto';
  const cableType=$('lnkCableType')?($('lnkCableType').value||'auto'):'auto';
  const lengthRaw=$('lnkLengthM')?$('lnkLengthM').value:'';
  const lengthM=lengthRaw===''?null:Number(lengthRaw);
  const speed=$('lnkSpeed')?($('lnkSpeed').value||'auto'):'auto';
  if(!a||!b)return alert(i18nText('links.alert.selectTwoPorts',{},'Selecciona dos puertos.'));if(a===b)return alert(i18nText('links.alert.samePort',{},'Mismo puerto.'));
  if(lengthM!==null && (!Number.isFinite(lengthM)||lengthM<0))return alert(i18nText('links.alert.invalidLength',{},'La longitud del cable debe ser un número positivo.'));
  if(isLinked(a)||isLinked(b))return alert(i18nText('links.alert.portAlreadyLinked',{},'Uno de los puertos ya está enlazado.'));
  S.links.push({id:uid('lnk'),aPortId:a,bPortId:b,notes,transitVlanRef,medium,cableType,lengthM,speed});$('lnkNotes').value=''; if($('lnkTransit'))$('lnkTransit').value=''; if($('lnkLengthM'))$('lnkLengthM').value='';
  // Auto-trunk suggestion
  const pA=S.ports.find(p=>p.id===a),pB=S.ports.find(p=>p.id===b);
  const dA=devById(pA?.deviceId),dB=devById(pB?.deviceId);
  if(dA?.type==='switch'&&dB?.type==='switch'){const tv=S.vlans.map(v=>v.vlanId).sort((a,b)=>a-b);$('upHint').dataset.vlans=tv.join(',');$('upHint').textContent=i18nText('links.feedback.switchUplink',{vlans:$('upHint').dataset.vlans},'💡 Uplink entre switches: considera configurar trunk con VLANs {vlans}');}
  else {delete $('upHint').dataset.vlans;$('upHint').textContent='';}
  save();refresh();
};

// PORT MODAL
let modalPid=null;
function openPortModal(pid){
  const p=S.ports.find(x=>x.id===pid);if(!p)return;modalPid=pid;
  const d=devById(p.deviceId);
  $('pmTitle').textContent=`${d?.name||''} — ${p.name}`;
  $('pmMode').value=p.mode||'access';$('pmAV').value=p.accessVlanRef||'';$('pmNV').value=p.nativeVlanRef||'';
  $('pmAll').value=(p.allowedVlans||[]).join(','); if($('pmUplink'))$('pmUplink').value=boolToSelect(p.uplink); if($('pmPortFast'))$('pmPortFast').value=boolToSelect(p.portFast); if($('pmBpduGuard'))$('pmBpduGuard').value=boolToSelect(p.bpduGuard); $('pmDesc').value=p.desc||'';
  const ch=S.hosts.filter(h=>h.portRef===pid);
  const info=$('pmHostsInfo');
  info.textContent='';
  if(ch.length){
    const title=document.createElement('div'); title.className='card-t'; title.style.fontSize='11px'; title.style.marginBottom='5px'; title.textContent='Hosts conectados:'; info.appendChild(title);
    ch.forEach(h=>{const row=document.createElement('div'); row.className='hrow'; row.style.padding='4px 7px'; appendText(row,`${HT[h.type]?.i||''} `); const b=document.createElement('b'); b.textContent=h.name||''; row.appendChild(b); row.appendChild(document.createTextNode(' ')); row.appendChild(makeBadge(h.ipMode==='static'?h.staticIp||'':'DHCP','b bgr')); info.appendChild(row);});
  }
  $('portModal').classList.add('on');
}
$('pmMode').onchange=()=>{const m=$('pmMode').value;$('pmAV').disabled=m!=='access';$('pmNV').disabled=m!=='trunk';$('pmAll').disabled=m!=='trunk'; if($('pmPortFast'))$('pmPortFast').disabled=m!=='access'; if($('pmBpduGuard'))$('pmBpduGuard').disabled=m!=='access';};
$('pmClose').onclick=()=>{$('portModal').classList.remove('on');modalPid=null;};
$('portModal').onclick=e=>{if(e.target.id==='portModal'){$('portModal').classList.remove('on');modalPid=null;}};
$('pmReset').onclick=()=>{$('pmMode').value='access';$('pmAV').value=S.vlans[0]?.id||'';$('pmNV').value='';$('pmAll').value=''; if($('pmUplink'))$('pmUplink').value='auto'; if($('pmPortFast'))$('pmPortFast').value='auto'; if($('pmBpduGuard'))$('pmBpduGuard').value='auto'; $('pmDesc').value='';};
$('pmSave').onclick=()=>{
  const p=S.ports.find(x=>x.id===modalPid);if(!p)return $('portModal').classList.remove('on');
  const mode=$('pmMode').value,ar=$('pmAV').value||null,nr=$('pmNV').value||null,al=parseAllowed($('pmAll').value),desc=($('pmDesc').value||'').trim()||null;
  if(mode==='access'&&!ar)return alert('Selecciona VLAN access.');if(mode==='trunk'&&!al.length)return alert('Trunk requiere VLANs permitidas.');
  p.mode=mode;p.accessVlanRef=mode==='access'?ar:null;p.nativeVlanRef=mode==='trunk'?nr:null;p.allowedVlans=mode==='trunk'?al:[];p.desc=desc;
  setBoolField(p,'uplink',selectToBool($('pmUplink')?$('pmUplink').value:'auto'));
  if(mode==='access'){setBoolField(p,'portFast',selectToBool($('pmPortFast')?$('pmPortFast').value:'auto'));setBoolField(p,'bpduGuard',selectToBool($('pmBpduGuard')?$('pmBpduGuard').value:'auto'));}else{delete p.portFast;delete p.bpduGuard;}
  save();renderVisPorts();renderPortsList();drawTopo();$('portModal').classList.remove('on');modalPid=null;
};

// ─────────────────── FIREWALL ───────────────────
$('btnAddFw').onclick=()=>{
  const name=($('fwN').value||'').trim();const action=$('fwAct').value;const src=($('fwSrc').value||'').trim()||'any';const dst=($('fwDst').value||'').trim()||'any';
  const proto=$('fwProto').value;const port=($('fwPort').value||'').trim()||'any';const dir=$('fwDir').value;const prio=parseInt($('fwPrio').value||'100')||100;
  if(!name)return alert(i18nText('firewall.alert.descriptionRequired',{},'Nombre/descripción requerida.'));
  S.fwRules.push({id:uid('fw'),name,action,src,dst,proto,port,dir,prio,enabled:true});
  $('fwN').value='';$('fwSrc').value='';$('fwDst').value='';$('fwPort').value='';$('fwPrio').value='100';
  save();refresh();
};
$('btnFwTpl').onclick=()=>{renderFwTplModal();$('fwTplModal').classList.add('on');};
$('fwTplClose').onclick=$('fwTplCancel').onclick=()=>$('fwTplModal').classList.remove('on');


// =========================================================
// 11. FIREWALL, MATRIZ INTER-VLAN Y HARDENING
// Plantillas firewall, reglas, matriz inter-VLAN y parámetros de hardening.
// =========================================================
function renderFwTplModal(){
  const el=$('fwTplList'); el.textContent='';
  FW_TPLS.forEach((t,i)=>{
    const row=document.createElement('div'); row.className='hrow'; row.style.cursor='pointer'; row.dataset.tpl=String(i);
    const ico=document.createElement('div'); ico.className='hico'; ico.textContent='📦'; row.appendChild(ico);
    const info=document.createElement('div'); info.className='hinfo'; const hn=document.createElement('div'); hn.className='hn'; hn.textContent=t.nameKey?i18nText(t.nameKey,{},t.name||''):(t.name||''); const hm=document.createElement('div'); hm.className='hm'; hm.textContent=i18nText('firewall.templates.ruleCount',{count:t.rules.length},'{count} reglas'); info.append(hn,hm); row.appendChild(info);
    const btn=document.createElement('button'); btn.type='button'; btn.className='btn bg bsm'; btn.textContent=i18nText('actions.apply',{},'Aplicar'); row.appendChild(btn); el.appendChild(row);
  });
  el.querySelectorAll('[data-tpl]').forEach(el=>el.onclick=()=>{const t=FW_TPLS[+el.dataset.tpl];for(const r of t.rules)S.fwRules.push({id:uid('fw'),...r,enabled:true});save();refresh();$('fwTplModal').classList.remove('on');alert(i18nText('firewall.templates.applied',{count:t.rules.length},'✓ {count} reglas añadidas.'));});
}
function renderFwRules(){
  $('fwCnt').textContent=i18nText('firewall.list.count',{count:S.fwRules.length},'{count} reglas');
  const el=$('fwRulesList'); el.textContent='';
  if(!S.fwRules.length){
    const empty=document.createElement('div'); empty.className='empty';
    const icon=document.createElement('div'); icon.className='ei'; icon.textContent='🔒';
    const p=document.createElement('p'); p.textContent=i18nText('firewall.empty.rules',{},'Sin reglas. Añade una arriba o usa las plantillas.');
    empty.append(icon,p); el.appendChild(empty); return;
  }
  S.fwRules.slice().sort((a,b)=>(a.prio||100)-(b.prio||100)).forEach(r=>{
    const row=document.createElement('div'); row.className='fwrow'+(!r.enabled?' fwdis':'');
    const action=(r.action||'deny').toLowerCase(); const actionLabel=i18nText('firewall.rule.action.'+action,{},action.toUpperCase()); row.appendChild(makeBadge(actionLabel,`b ${action==='allow'?'bgn':action==='log'?'byw':'brd'}`));
    const name=document.createElement('span'); name.style.flex='1'; name.style.fontWeight='600'; name.style.fontSize='12px'; name.textContent=r.name||''; row.appendChild(name);
    const src=document.createElement('span'); src.className='mono'; src.style.fontSize='10px'; src.style.color='var(--t3)'; src.textContent=r.src||''; row.appendChild(src);
    const arrow=document.createElement('span'); arrow.style.color='var(--t4)'; arrow.textContent='→'; row.appendChild(arrow);
    const dst=document.createElement('span'); dst.className='mono'; dst.style.fontSize='10px'; dst.style.color='var(--t3)'; dst.textContent=r.dst||''; row.appendChild(dst);
    row.appendChild(makeBadge(`${r.proto||'any'}${r.port&&r.port!=='any'?':'+r.port:''}`,'b bgr'));
    row.appendChild(makeBadge(r.dir||'in','b bgr'));
    const prio=document.createElement('span'); prio.style.fontSize='10px'; prio.style.color='var(--t4)'; prio.textContent=`P${r.prio||100}`; row.appendChild(prio);
    const tog=document.createElement('button'); tog.type='button'; tog.className='btn bs bxs'; tog.dataset.tog=r.id; tog.textContent=r.enabled?'🔴':'🟢'; row.appendChild(tog);
    const del=document.createElement('button'); del.type='button'; del.className='btn bd bxs'; del.dataset.dfw=r.id; del.textContent='✕'; row.appendChild(del);
    el.appendChild(row);
  });
  el.querySelectorAll('[data-tog]').forEach(b=>b.onclick=()=>{const r=S.fwRules.find(x=>x.id===b.dataset.tog);if(r)r.enabled=!r.enabled;save();renderFwRules();});
  el.querySelectorAll('[data-dfw]').forEach(b=>b.onclick=()=>{S.fwRules=S.fwRules.filter(x=>x.id!==b.dataset.dfw);save();renderFwRules();$('fwCnt').textContent=i18nText('firewall.list.count',{count:S.fwRules.length},'{count} reglas');});
}
function renderVlanMatrix(){
  const el=$('vlanMatrix'); el.textContent='';
  if(S.vlans.length<2){ const hint=document.createElement('div'); hint.className='hint'; hint.textContent=i18nText('firewall.matrix.needTwoVlans',{},'Necesitas al menos 2 VLANs.'); el.appendChild(hint); return; }
  const vs=S.vlans.slice().sort((a,b)=>a.vlanId-b.vlanId);
  const wrap=document.createElement('div'); wrap.className='tw'; const table=document.createElement('table');
  const thead=document.createElement('thead'); const hr=document.createElement('tr'); const first=document.createElement('th'); first.textContent=i18nText('firewall.matrix.axis',{},'↓ origen / destino →'); hr.appendChild(first);
  vs.forEach(v=>{ const th=document.createElement('th'); th.style.fontSize='10px'; const dot=document.createElement('span'); dot.className='vd'; dot.style.background=safeColor(v.color, vColor(v.id)); th.appendChild(dot); th.appendChild(document.createTextNode(' '+v.vlanId)); hr.appendChild(th); });
  thead.appendChild(hr); table.appendChild(thead); const tbody=document.createElement('tbody');
  for(const va of vs){ const tr=document.createElement('tr'); const src=document.createElement('td'); const b=document.createElement('b'); b.style.fontSize='11px'; b.textContent=`${va.vlanId} ${va.name||''}`; src.appendChild(b); tr.appendChild(src);
    for(const vb of vs){ const td=document.createElement('td'); td.style.textAlign='center'; if(va.id===vb.id){td.style.color='var(--t4)'; td.textContent='—'; tr.appendChild(td); continue;} const key=`${va.id}_${vb.id}`; const allow=S.vlanMatrix[key]!==false; td.style.cursor='pointer'; td.dataset.k=key; td.appendChild(makeBadge(allow?'✓':'✗',`b ${allow?'bgn':'brd'}`)); tr.appendChild(td); }
    tbody.appendChild(tr);
  }
  table.appendChild(tbody); wrap.appendChild(table); el.appendChild(wrap);
  el.querySelectorAll('[data-k]').forEach(td=>td.onclick=()=>{const k=td.dataset.k;S.vlanMatrix[k]=S.vlanMatrix[k]===false;save();renderVlanMatrix();$('matrixAcl').value=genVlanMatrixAcl();});
  $('matrixAcl').value=genVlanMatrixAcl();
}
// Hardening
$('secTplL').onclick=()=>{Object.assign(S.security,{bpdu:'no',ps:'no',ds:'no',dai:'no',ipsg:'no'});save();refresh();alert(i18nText('firewall.profile.low.applied',{},'✓ Perfil mínimo aplicado.'));};
$('secTplM').onclick=()=>{Object.assign(S.security,{bpdu:'yes',ps:'yes',ds:'yes',dai:'no',ipsg:'no'});save();refresh();alert(i18nText('firewall.profile.medium.applied',{},'✓ Perfil medio aplicado.'));};
$('secTplH').onclick=()=>{Object.assign(S.security,{bpdu:'yes',ps:'yes',ds:'yes',dai:'yes',ipsg:'yes'});save();refresh();alert(i18nText('firewall.profile.high.applied',{},'✓ Perfil alto aplicado.'));};
['secBpdu','secPs','secDs','secDai','secIpsg'].forEach(id=>{$(id).onchange=()=>{const k=id.replace('sec','').toLowerCase();S.security[k]=$(id).value;save();};});
$('secDsV').onblur=()=>{S.security.dsV=($('secDsV').value||'').trim();save();};
$('secQV').onchange=()=>{S.security.qV=$('secQV').value||'';save();};

// ─────────────────── CFG / EXPORT ───────────────────


// =========================================================
// 12. ROAS, DHCP, CONFIG POR DISPOSITIVO Y VTP
// Router-on-a-stick, DHCP por VLAN, selector de config por dispositivo y VTP.
// =========================================================
function fillRoasSels(){
  const gws=S.devices.filter(d=>d.type!=='switch');
  const roasDev=$('roasDev');
  if(roasDev){
    setOptions(roasDev,[makeOption('',i18nText('common.select',{},'(selecciona)'))].concat(gws.map(d=>makeOption(d.id,d.name||d.id,S.roas.gwId===d.id))));
    roasDev.value=S.roas.gwId||'';
  }
  const gId=S.roas.gwId;const ifs=gId?portsByDev(gId):[];
  const roasLanIf=$('roasLanIf');
  if(roasLanIf){
    setOptions(roasLanIf,[makeOption('',i18nText('roas.interfacePlaceholder',{},'(interfaz)'))].concat(ifs.map(p=>makeOption(p.name,p.name||p.id,S.roas.lanIf===p.name))));
    roasLanIf.value=S.roas.lanIf||'';
  }
  $('wanCidr').value=S.roas.wanCidr||'';$('wanNh').value=S.roas.wanNh||'';$('roasNatV').value=S.roas.natVRef||'';
}
$('roasDev').onchange=()=>{S.roas.gwId=$('roasDev').value||null;save();fillRoasSels();};
$('roasLanIf').onchange=()=>{S.roas.lanIf=$('roasLanIf').value;save();};
$('roasNatV').onchange=()=>{S.roas.natVRef=$('roasNatV').value||null;save();};
$('wanCidr').onblur=()=>{S.roas.wanCidr=($('wanCidr').value||'').trim();save();};
$('wanNh').onblur=()=>{S.roas.wanNh=($('wanNh').value||'').trim();save();};
$('btnRoas').onclick=()=>{
  if(!S.roas.gwId)return alert(i18nText('roas.alert.gatewayRequired',{},'Selecciona gateway.'));if(!S.roas.lanIf)return alert(i18nText('roas.alert.interfaceRequired',{},'Selecciona interfaz LAN.'));
  const gwPort=S.ports.find(p=>p.deviceId===S.roas.gwId&&p.name===S.roas.lanIf);
  if(gwPort){gwPort.mode='trunk';gwPort.allowedVlans=S.vlans.map(v=>v.vlanId).sort((a,b)=>a-b);}
  save();refresh();alert(i18nText('roas.applied',{},'✓ RoaS aplicado.'));
};
function renderDhcp(){
  const box=$('dhcpView'); box.textContent='';
  const locale=window.NetWizardI18n?.getLocale?.();
  if(!S.vlans.length){ const hint=document.createElement('div'); hint.className='hint'; hint.textContent=i18nText('vlan.emptyPeriod',{},'Sin VLANs.'); box.appendChild(hint); return; }
  const dh=window.NetWizardDhcpUtils;
  const audit=dh?dh.validateDhcpForProject(S,{locale}):{issues:[]};
  const top=document.createElement('div'); top.className='hrow'; top.style.marginBottom='8px'; top.style.gap='6px'; top.style.flexWrap='wrap';
  const btnDiff=document.createElement('button'); btnDiff.type='button'; btnDiff.className='btn small'; btnDiff.id='btnDhcpDiff'; btnDiff.textContent=i18nText('dhcp.actions.diff',{},'🧾 Ver diff DHCP');
  const btnPropose=document.createElement('button'); btnPropose.type='button'; btnPropose.className='btn small'; btnPropose.id='btnDhcpPropose'; btnPropose.textContent=i18nText('dhcp.actions.propose',{},'✨ Proponer pools DHCP');
  const btnValidate=document.createElement('button'); btnValidate.type='button'; btnValidate.className='btn small'; btnValidate.id='btnDhcpValidate'; btnValidate.textContent=i18nText('dhcp.actions.validate',{},'🧪 Validar DHCP');
  const topHint=document.createElement('span'); topHint.className='hint'; topHint.textContent=i18nText('dhcp.dynamicHint',{},'Rangos, exclusiones y DNS por VLAN.');
  top.append(btnDiff,btnPropose,btnValidate,topHint); box.appendChild(top);
  if(audit.issues&&audit.issues.length){ const warn=document.createElement('div'); warn.className='hint warn'; warn.style.margin='6px 0'; warn.textContent=audit.issues.map(i=>`[${i.code}] ${i.message}`).join(' · '); box.appendChild(warn); }
  function addField(parent,labelText,child){ const wrap=document.createElement('div'); const lab=document.createElement('label'); lab.className='fl'; lab.style.fontSize='9px'; lab.textContent=labelText; wrap.append(lab,child); parent.appendChild(wrap); return child; }
  S.vlans.slice().sort((a,b)=>a.vlanId-b.vlanId).forEach(v=>{
    const k=String(v.vlanId); if(!S.dhcp[k])S.dhcp[k]={enabled:false,dns:'8.8.8.8',lease:1}; S.dhcp[k]=dh?dh.normalizeDhcpConfig(S.dhcp[k]):S.dhcp[k];
    const cfg=S.dhcp[k]; const sn=snByVRef(v.id); const stc=S.hosts.filter(h=>h.vlanRef===v.id&&h.ipMode==='static').length;
    const row=document.createElement('div'); row.className='hrow'; row.style.flexWrap='wrap'; row.style.gap='7px'; row.style.marginBottom='7px';
    const dot=document.createElement('span'); dot.className='vd'; dot.style.background=v.color||vColor(v.id); dot.style.marginTop='2px'; row.appendChild(dot);
    const info=document.createElement('div'); info.style.flex='1'; info.style.minWidth='120px';
    const title=document.createElement('div'); title.style.fontWeight='700'; title.style.fontSize='12px'; title.textContent=`VLAN ${v.vlanId} ${v.name||''}`;
    const sub=document.createElement('div'); sub.className='hint'; sub.textContent=i18nText('dhcp.vlanSummary',{cidr:sn?sn.cidr:'—',gateway:sn?.gateway||'—',count:stc},'{cidr} · GW {gateway} · {count} IPs estáticas');
    info.append(title,sub); row.appendChild(info);
    const controls=document.createElement('div'); controls.style.display='flex'; controls.style.gap='5px'; controls.style.flexWrap='wrap'; controls.style.alignItems='center';
    const en=document.createElement('select'); en.dataset.en=k; en.style.fontSize='12px'; en.style.padding='3px';
    [['0',i18nText('common.no',{},'No')],['1',i18nText('common.yes',{},'Sí')]].forEach(([val,txt])=>{ const o=document.createElement('option'); o.value=val; o.textContent=txt; if((val==='1')===!!cfg.enabled)o.selected=true; en.appendChild(o); }); addField(controls,'DHCP',en);
    const start=document.createElement('input'); start.dataset.dhStart=k; start.value=cfg.start||''; start.placeholder=i18nText('dhcp.placeholders.start',{},'inicio pool'); start.style.width='92px'; start.style.fontSize='12px'; start.style.padding='3px'; addField(controls,i18nText('dhcp.fields.start',{},'Inicio'),start);
    const end=document.createElement('input'); end.dataset.dhEnd=k; end.value=cfg.end||''; end.placeholder=i18nText('dhcp.placeholders.end',{},'fin pool'); end.style.width='92px'; end.style.fontSize='12px'; end.style.padding='3px'; addField(controls,i18nText('dhcp.fields.end',{},'Fin'),end);
    const dns=document.createElement('input'); dns.dataset.dns=k; dns.value=cfg.dns||''; dns.placeholder='8.8.8.8,1.1.1.1'; dns.style.width='120px'; dns.style.fontSize='12px'; dns.style.padding='3px'; addField(controls,'DNS',dns);
    const domain=document.createElement('input'); domain.dataset.dhDomain=k; domain.value=cfg.domain||''; domain.placeholder=i18nText('dhcp.placeholders.domain',{},'empresa.local'); domain.style.width='105px'; domain.style.fontSize='12px'; domain.style.padding='3px'; addField(controls,i18nText('dhcp.fields.domain',{},'Dominio'),domain);
    const lease=document.createElement('input'); lease.dataset.ls=k; lease.type='number'; lease.min='1'; lease.max='365'; lease.value=cfg.lease||1; lease.style.width='58px'; lease.style.fontSize='12px'; lease.style.padding='3px'; addField(controls,i18nText('dhcp.fields.leaseDays',{},'Lease días'),lease);
    row.appendChild(controls); box.appendChild(row);
  });
  const ensure=(k)=>{if(!S.dhcp[k])S.dhcp[k]={enabled:false,dns:'8.8.8.8',lease:1,exclusions:[],reservations:[]};};
  box.querySelectorAll('[data-en]').forEach(s=>s.onchange=()=>{ensure(s.dataset.en);S.dhcp[s.dataset.en].enabled=s.value==='1';save();});
  box.querySelectorAll('[data-dns]').forEach(i=>i.onblur=()=>{ensure(i.dataset.dns);S.dhcp[i.dataset.dns].dns=(i.value||'').trim();save();});
  box.querySelectorAll('[data-ls]').forEach(i=>i.onblur=()=>{ensure(i.dataset.ls);S.dhcp[i.dataset.ls].lease=+i.value||1;save();});
  box.querySelectorAll('[data-dh-start]').forEach(i=>i.onblur=()=>{ensure(i.dataset.dhStart);S.dhcp[i.dataset.dhStart].start=(i.value||'').trim();save();});
  box.querySelectorAll('[data-dh-end]').forEach(i=>i.onblur=()=>{ensure(i.dataset.dhEnd);S.dhcp[i.dataset.dhEnd].end=(i.value||'').trim();save();});
  box.querySelectorAll('[data-dh-domain]').forEach(i=>i.onblur=()=>{ensure(i.dataset.dhDomain);S.dhcp[i.dataset.dhDomain].domain=(i.value||'').trim();save();});
  const bd=$('btnDhcpDiff');if(bd)bd.onclick=()=>{if(!dh)return alert(i18nText('dhcp.alert.moduleUnavailable',{},'Módulo DHCP no disponible.'));const cp=window.NetWizardChangePreview;if(!cp)return alert(i18nText('dhcp.alert.diffUnavailable',{},'Módulo de diff no disponible.'));const diff=cp.computeDhcpDiff(S,{overwrite:false});alert(cp.summarizeDiff(diff,i18nText('dhcp.diffTitle',{},'Diff antes de proponer DHCP')));};
  const bp=$('btnDhcpPropose');if(bp)bp.onclick=()=>{if(!dh)return alert(i18nText('dhcp.alert.moduleUnavailable',{},'Módulo DHCP no disponible.'));const cp=window.NetWizardChangePreview;if(cp){const diff=cp.computeDhcpDiff(S,{overwrite:false});const txt=cp.summarizeDiff(diff,i18nText('dhcp.diffTitle',{},'Diff antes de proponer DHCP'));if(diff.add.length||diff.change.length||diff.remove.length){if(!confirm(txt+'\n\n'+i18nText('dhcp.confirmProposal',{},'¿Aplicar propuesta DHCP?')))return;}}const res=dh.proposeDhcpForProject(S,{overwrite:false,locale});S=res.project;save();refresh();alert(res.changes.join('\n')||i18nText('dhcp.noChanges',{},'No había cambios DHCP que proponer.'));};
  const bv=$('btnDhcpValidate');if(bv)bv.onclick=()=>{if(!dh)return alert(i18nText('dhcp.alert.moduleUnavailable',{},'Módulo DHCP no disponible.'));const res=dh.validateDhcpForProject(S,{locale});alert(res.issues.length?res.issues.map(i=>`[${i.severity}] ${i.code}: ${i.message}`).join('\n'):i18nText('dhcp.validationOk',{},'✓ DHCP sin incidencias críticas.'));renderDhcp();};
}
function renderVendorPills(container, vendors, selected, dataKey, onSelect){
  container.textContent='';
  vendors.forEach(v=>{ const span=document.createElement('span'); span.className='vp '+(selected===v.id?'on':''); span.dataset[dataKey]=v.id; span.textContent=v.l; span.addEventListener('click',()=>{ onSelect(v.id); container.querySelectorAll('.vp').forEach(e=>e.classList.toggle('on',e.dataset[dataKey]===v.id)); }); container.appendChild(span); });
}
function renderDevPickCfg(){
  const el=$('devPickCfg'); el.textContent='';
  const devices=S.devices.slice().sort((a,b)=>a.name.localeCompare(b.name));
  if(!devices.length){ const hint=document.createElement('div'); hint.className='hint'; hint.textContent='Sin dispositivos.'; el.appendChild(hint); return; }
  devices.forEach(d=>{ const row=document.createElement('div'); row.className='hrow'; row.style.cursor='pointer'; row.style.marginBottom='4px'; row.dataset.dcfg=d.id;
    const ico=document.createElement('div'); ico.className='hico'; ico.textContent=devIcon(d); row.appendChild(ico);
    const info=document.createElement('div'); info.className='hinfo'; const hn=document.createElement('div'); hn.className='hn'; hn.textContent=d.name||''; const hm=document.createElement('div'); hm.className='hm'; hm.textContent=`${devLabel(d)} · ${d.vendorOs||'—'}`; info.append(hn,hm); row.appendChild(info);
    row.appendChild(makeBadge('⚙','b bac')); el.appendChild(row);
  });
  if(!devices.some(d=>d.id===selDevCfg))selDevCfg=devices[0].id;
  el.querySelectorAll('[data-dcfg]').forEach(row=>{row.classList.toggle('on',row.dataset.dcfg===selDevCfg);row.onclick=()=>selectDevCfg(row.dataset.dcfg);});
}
function selectDevCfg(devId){
  selDevCfg=devId;const d=devById(devId);if(!d)return;
  selVendorCfg=d.vendorOs||ALL_VENDORS[0].id;
  document.querySelectorAll('[data-dcfg]').forEach(el=>el.classList.toggle('on',el.dataset.dcfg===devId));
  const paint=()=>{const cfg=configForView(selDevCfg,selVendorCfg);$('cfgOut').value=cfg;$('cfgOutComment').value=buildCommentedConfig(cfg);paintConfigReadiness('cfgReadiness',selDevCfg,selVendorCfg);};
  const vendors=localConfigGenerationAvailable()?ALL_VENDORS:ALL_VENDORS.filter(v=>v.id===selVendorCfg);
  renderVendorPills($('cfgVendorPills'), vendors.length?vendors:[{id:selVendorCfg,l:selVendorCfg}], selVendorCfg, 'vp', (id)=>{selVendorCfg=id;paint();});
  paint();
}

// ─── DEVICE CFG MODAL (from topo click or devs list) ───
let dcmDevId=null,dcmVendor=null;
function openDevCfgModal(devId){
  const d=devById(devId);if(!d)return;
  dcmDevId=devId;dcmVendor=d.vendorOs||ALL_VENDORS[0].id;
  $('dcmTitle').textContent=`⚙ ${d.name}`;
  { const meta=$('dcmMeta'); meta.textContent=''; meta.appendChild(makeBadge(d.type||'','b bac')); meta.appendChild(document.createTextNode(' ')); meta.appendChild(makeBadge(d.vendorOs||'—','b bgr')); meta.appendChild(document.createTextNode(' ')); meta.appendChild(makeBadge(`${portsByDev(devId).length} puertos`,'b bgr')); }
  const paint=()=>{const cfg=configForView(dcmDevId,dcmVendor);$('dcmCfg').value=cfg;$('dcmCfgComment').value=buildCommentedConfig(cfg);paintConfigReadiness('dcmReadiness',dcmDevId,dcmVendor);};
  const vendors=localConfigGenerationAvailable()?ALL_VENDORS:ALL_VENDORS.filter(v=>v.id===dcmVendor);
  renderVendorPills($('dcmPills'), vendors.length?vendors:[{id:dcmVendor,l:dcmVendor}], dcmVendor, 'dcmp', (id)=>{dcmVendor=id;paint();});
  paint();
  $('devCfgModal').classList.add('on');
}
$('dcmClose').onclick=()=>$('devCfgModal').classList.remove('on');
$('devCfgModal').onclick=e=>{if(e.target.id==='devCfgModal'){$('devCfgModal').classList.remove('on');}};
$('dcmCopy').onclick=()=>{navigator.clipboard.writeText($('dcmCfg').value).then(()=>alert('✓ Copiado al portapapeles.'));};
$('dcmDl').onclick=()=>{const d=devById(dcmDevId);dl(`${d?.name||'config'}_${dcmVendor}.txt`,$('dcmCfg').value);};
function refreshPrivateConfigViews(){
  if(selDevCfg&&devById(selDevCfg))selectDevCfg(selDevCfg);
  if(dcmDevId&&devById(dcmDevId)&&$('devCfgModal')?.classList.contains('on'))openDevCfgModal(dcmDevId);
}
window.NetWizardConfigView=Object.assign(window.NetWizardConfigView||{},{
  refreshPrivateArtifacts:refreshPrivateConfigViews,
  selectedDeviceId:()=>selDevCfg||null,
  readinessForDevice:(devId,format)=>configReadinessForView(devId,format)
});

function renderVtp(){
  if($('vtpDomain'))$('vtpDomain').value=S.vtp?.domain||'';
  if($('vtpPassword'))$('vtpPassword').value=S.vtp?.password||'';
  if($('vtpVersion'))$('vtpVersion').value=S.vtp?.version||'2';
  if($('vtpPruning'))$('vtpPruning').value=S.vtp?.pruning||'no';
  const sws=S.devices.filter(d=>isSwitchDevice(d) && (d.vendorOs||'cisco_ios')==='cisco_ios').sort((a,b)=>a.name.localeCompare(b.name));
  const el=$('vtpSwitchRoles'); el.textContent='';
  if(!sws.length){ const hint=document.createElement('div'); hint.className='hint'; hint.textContent=i18nText('vtp.empty.switches',{},'Añade switches Cisco IOS para poder usar VTP.'); el.appendChild(hint); return; }
  sws.forEach(d=>{ const row=document.createElement('div'); row.className='row'; row.style.marginTop='8px';
    const left=document.createElement('div'); const lab=document.createElement('label'); lab.className='fl'; lab.textContent=d.name||''; const hint=document.createElement('div'); hint.className='hint'; hint.textContent=d.vendorOs||'cisco_ios'; left.append(lab,hint); row.appendChild(left);
    const right=document.createElement('div'); const rlab=document.createElement('label'); rlab.className='fl'; rlab.textContent=i18nText('vtp.fields.role',{},'Rol VTP'); const sel=document.createElement('select'); sel.dataset.vtprole=d.id; [['off','vtp.role.off','Desactivado'],['server','vtp.role.server','Server'],['client','vtp.role.client','Client'],['transparent','vtp.role.transparent','Transparent']].forEach(([v,k,t])=>addOption(sel,v,i18nText(k,{},t))); right.append(rlab,sel); row.appendChild(right); el.appendChild(row);
  });
  el.querySelectorAll('[data-vtprole]').forEach(el=>el.value=getVtpRole(el.dataset.vtprole));
}
$('btnSaveVtp').onclick=()=>{
  S.vtp=S.vtp||{domain:'',password:'',version:'2',pruning:'no',roles:{}};
  S.vtp.domain=($('vtpDomain').value||'').trim();
  S.vtp.password=($('vtpPassword').value||'').trim();
  S.vtp.version=($('vtpVersion').value||'2');
  S.vtp.pruning=($('vtpPruning').value||'no');
  S.vtp.roles={};
  document.querySelectorAll('[data-vtprole]').forEach(el=>{if(el.value!=='off')S.vtp.roles[el.dataset.vtprole]=el.value;});
  save();renderVtp();if(selDevCfg)selectDevCfg(selDevCfg);alert(i18nText('vtp.feedback.saved',{},'✓ VTP guardado.'));
};

// EXPORT
const dl=(fn,txt)=>{const b=new Blob([txt],{type:'text/plain;charset=utf-8'});const u=URL.createObjectURL(b);const a=document.createElement('a');a.href=u;a.download=fn;document.body.appendChild(a);a.click();a.remove();URL.revokeObjectURL(u);};
function privateExportState(){
  const api=window.NetWizardPrivateDeploymentUi;
  return api&&typeof api.exportState==='function'?api.exportState():null;
}
function privateExportEntries(){
  const state=privateExportState();
  if(!state)return{ok:false,message:i18nText('deploy.export.privateUnavailable',{},'Private Engine no disponible en esta sesión.'),entries:[]};
  if(state.stale)return{ok:false,message:i18nText('deploy.export.stale',{},'La generación server-side está obsoleta. Regenera antes de exportar.'),entries:[]};
  if(!state.available||!state.result)return{ok:false,message:i18nText('deploy.export.generateFirst',{},'Primero genera las configuraciones en servidor.'),entries:[]};
  const gate=state.result.productionGate||{};
  if(gate.canExport!==true||state.result.productionStatus==='blocked'){
    return{ok:false,message:i18nText('deploy.export.privateGateBlocked',{},'La Production Gate privada bloquea la exportación. Revisa Validación y el diagnóstico de generación.'),entries:[]};
  }
  const api=window.NetWizardPrivateDeploymentUi;
  const entries=[],missing=[];
  for(const device of S.devices.slice().sort((a,b)=>(a.name||'').localeCompare(b.name||''))){
    const artifact=api&&typeof api.deviceConfig==='function'?api.deviceConfig(device.id):null;
    if(!artifact){missing.push(device.name||device.id);continue;}
    const path=String(artifact.path||'').trim();
    const fileName=(path.split('/').filter(Boolean).pop()||((device.name||device.id||'device')+'.txt')).replace(/[\\/:*?"<>|]+/g,'-');
    entries.push({device,artifact,fileName});
  }
  if(missing.length)return{ok:false,message:i18nText('deploy.export.missingArtifacts',{devices:missing.join(', ')},'Faltan artefactos privados vigentes para: {devices}. Regenera y revisa el diagnóstico.'),entries:[]};
  return{ok:true,message:'',entries,state};
}
function requireConfigExportReady(){
  if(!localConfigGenerationAvailable()){
    const privateState=privateExportEntries();
    if(!privateState.ok){
      const msg=privateState.message;
      if($('cfgOut'))$('cfgOut').value=msg;
      const status=$('deploymentPackageStatus');if(status)status.textContent=msg;
      alert(msg);
      return false;
    }
    return true;
  }
  if(!(window.NetWizardAudit&&window.NetWizardAudit.isProduction&&window.NetWizardAudit.isProduction()))return true;
  if(window.NetWizardProductionGate&&window.NetWizardProductionGate.runProductionGate){
    const gate=window.NetWizardProductionGate.runProductionGate(S,{productionMode:true,strict:true});
    if(!gate.canExport){
      const msg=window.NetWizardProductionGate.summarizeGate?window.NetWizardProductionGate.summarizeGate(gate,{limit:80,locale:window.NetWizardI18n?.getReportLocale?.()}):i18nText('deploy.export.blockedProduction',{},'Exportación bloqueada en modo producción.');
      if($('cfgOut'))$('cfgOut').value=msg;
      const r=document.getElementById('readinessAuditOut');if(r)r.textContent=msg;
      const g=document.getElementById('productionGateOut');if(g)g.textContent=msg;
      alert(i18nText('deploy.export.productionGateAlert',{},'Modo producción: la puerta de producción bloquea la exportación. Corrige los errores o cambia a modo demo para pruebas.'));
      return false;
    }
    return true;
  }
  if(!(window.NetWizardPlanner&&window.NetWizardPlanner.readinessAudit))return true;
  const audit=window.NetWizardPlanner.readinessAudit(S,{productionMode:true});
  if(audit&&audit.ok===false){
    const msg=window.NetWizardAudit.summarizeIssues?window.NetWizardAudit.summarizeIssues(audit.issues||audit,{title:i18nText('deploy.export.blockedTitle',{},'Exportación bloqueada en modo producción'),locale:window.NetWizardI18n?.getReportLocale?.()}):i18nText('deploy.export.blockedAudit',{},'Exportación bloqueada en modo producción por errores de auditoría.');
    if($('cfgOut'))$('cfgOut').value=msg;
    const r=document.getElementById('readinessAuditOut');if(r)r.textContent=msg;
    alert(i18nText('deploy.export.auditAlert',{},'Modo producción: corrige los errores de auditoría antes de exportar configuraciones. Puedes cambiar a modo demo si solo estás haciendo una prueba.'));
    return false;
  }
  return true;
}
$('expAll').onclick=()=>{
  if(!requireConfigExportReady())return;
  if(!localConfigGenerationAvailable()){
    const privateState=privateExportEntries();if(!privateState.ok)return alert(privateState.message);
    for(const entry of privateState.entries)dl(entry.fileName,entry.artifact.content);
    return;
  }
  for(const d of S.devices){const ext=d.vendorOs==='juniper_junos'?'set.txt':'cfg';dl(`${d.name}.${ext}`,genConfig(d.id));}
};
$('expBundle').onclick=()=>{
  if(!requireConfigExportReady())return;
  let out='';
  if(!localConfigGenerationAvailable()){
    const privateState=privateExportEntries();if(!privateState.ok)return alert(privateState.message);
    for(const entry of privateState.entries){
      const d=entry.device;
      out+=`\n${'#'.repeat(50)}\n# ${d.name} (${d.vendorOs||'—'}) · server-side\n# ${entry.artifact.path}\n${'#'.repeat(50)}\n\n${entry.artifact.content}\n`;
    }
  }else{
    for(const d of S.devices.slice().sort((a,b)=>a.name.localeCompare(b.name))){
      out+=`\n${'#'.repeat(50)}\n# ${d.name} (${d.vendorOs||'—'})\n${'#'.repeat(50)}\n\n`+genConfig(d.id)+'\n';
    }
  }
  dl('configs_bundle.txt',out);$('cfgOut').value=out;
};
$('expCsv').onclick=()=>dl('hosts.csv',genHostCsv());
$('expJson').onclick=()=>{
  const snap=window.NetWizardState.getSnapshot();
  const payload=NWSchema&&typeof NWSchema.prepareExport==='function'?NWSchema.prepareExport(snap,{defaults:defS}):snap;
  $('jsonBox').value=JSON.stringify(payload,null,2);
};
function ensureJsonFileImportControls(){
  const importText=$('impJson'),jsonBox=$('jsonBox');
  if(!importText||!jsonBox)return;
  let fileBtn=$('impJsonFile');
  if(!fileBtn){
    fileBtn=document.createElement('button');
    fileBtn.type='button';
    fileBtn.className='btn bs';
    fileBtn.id='impJsonFile';
    fileBtn.dataset.i18n='deploy.import.fileButton';fileBtn.textContent=i18nText('deploy.import.fileButton',{},'📂 Cargar archivo JSON');
    importText.insertAdjacentElement('afterend',fileBtn);
  }
  let fileInput=$('jsonFileInput');
  if(!fileInput){
    fileInput=document.createElement('input');
    fileInput.id='jsonFileInput';
    fileInput.type='file';
    fileInput.accept='.json,application/json';
    fileInput.hidden=true;
    fileBtn.insertAdjacentElement('afterend',fileInput);
  }
  if(!$('jsonImportStatus')){
    const status=document.createElement('div');
    status.className='hint';
    status.id='jsonImportStatus';
    status.style.marginTop='6px';
    status.dataset.i18n='deploy.import.hint';status.textContent=i18nText('deploy.import.hint',{},'Puedes pegar un JSON o cargar directamente un archivo .json. Ambos usan la misma validación de schema.');
    const bridge=$('nwBridgeStatus');
    if(bridge)bridge.insertAdjacentElement('beforebegin',status);
    else jsonBox.insertAdjacentElement('beforebegin',status);
  }
}
ensureJsonFileImportControls();
function prepareJsonImportText(text){
  const txt=String(text||'').trim();
  if(!txt)throw new Error(i18nText('deploy.import.empty',{},'No hay contenido JSON para importar.'));
  const raw=JSON.parse(txt);
  let p=raw?.project&&typeof raw.project==='object'?raw.project:raw;
  let warnings=[];
  if(NWSchema&&typeof NWSchema.prepareImport==='function'){
    const prepared=NWSchema.prepareImport(raw,{defaults:defS});
    if(!prepared.ok)throw new Error(i18nText('deploy.import.invalidDetailed',{errors:prepared.errors.join('\n- ')},'JSON inválido:\n- {errors}'));
    p=prepared.project;
    warnings=prepared.warnings||[];
  }else if(!Array.isArray(p?.devices)||!Array.isArray(p?.vlans)){
    throw new Error(i18nText('deploy.import.invalid',{},'JSON inválido.'));
  }
  return{project:p,warnings};
}
function applyJsonImportText(text,source){
  const prepared=prepareJsonImportText(text);
  if(prepared.warnings.length)console.warn('NetWizard import warnings',prepared.warnings);
  const importSource=source||'json-import';
  window.NetWizardState.replaceProject(prepared.project,{source:importSource});
  document.dispatchEvent(new CustomEvent('nw:iot:changed',{detail:{source:importSource}}));
  return prepared;
}
window.NetWizardJsonImport={version:'netwizard-json-import-v1',prepareJsonImportText,applyJsonImportText};
$('impJson').onclick=()=>{
  try{
    const prepared=applyJsonImportText($('jsonBox').value,'json-import-text');
    const status=$('jsonImportStatus');
    if(status)status.textContent=i18nText('deploy.import.fromText',{project:prepared.project.projName||i18nText('deploy.import.unnamedProject',{},'proyecto sin nombre')},'Importado desde texto: {project}.');
  }catch(e){alert(e.message||('JSON inválido: '+e));}
};
if($('impJsonFile')&&$('jsonFileInput')){
  $('impJsonFile').onclick=()=>{$('jsonFileInput').value='';$('jsonFileInput').click();};
  $('jsonFileInput').addEventListener('change',()=>{
    const file=$('jsonFileInput').files&&$('jsonFileInput').files[0];
    if(!file)return;
    const status=$('jsonImportStatus');
    if(file.size>10*1024*1024){if(status)status.textContent=i18nText('deploy.import.fileTooLargeStatus',{},'Archivo rechazado: supera 10 MB.');alert(i18nText('deploy.import.fileTooLarge',{},'El archivo JSON supera el límite de 10 MB.'));return;}
    if(status)status.textContent=i18nText('deploy.import.reading',{file:file.name},'Leyendo {file}…');
    const reader=new FileReader();
    reader.onload=()=>{
      try{
        const text=String(reader.result||'');
        $('jsonBox').value=text;
        const prepared=applyJsonImportText(text,'json-import-file');
        if(status)status.textContent=i18nText('deploy.import.loaded',{file:file.name,project:prepared.project.projName||i18nText('deploy.import.unnamedProject',{},'proyecto sin nombre'),kb:Math.max(1,Math.round(file.size/1024))},'✓ {file} cargado · {project} · {kb} KB.');
      }catch(e){if(status)status.textContent=i18nText('deploy.import.fileError',{file:file.name},'Error al importar {file}.');alert(e.message||i18nText('deploy.import.invalidWithError',{error:e},'JSON inválido: {error}'));}
    };
    reader.onerror=()=>{if(status)status.textContent=i18nText('deploy.import.readError',{file:file.name},'No se pudo leer {file}.');alert(i18nText('deploy.import.readErrorAlert',{},'No se pudo leer el archivo seleccionado.'));};
    reader.readAsText(file,'utf-8');
  });
}
$('btnReset').onclick=()=>{if(!confirm('¿Borrar todo el proyecto?'))return;localStorage.removeItem(SK);localStorage.removeItem('nw_iot_embedded_v1');window.NetWizardState.replaceProject(defS(),{source:'reset'});};
$('btnExport').onclick=()=>{navTo('cfg');setTimeout(()=>{const target=$('expDeploymentPackage')||$('expBundle');if(target)target.click();},200);};

// ─────────────────── TOPOLOGY ───────────────────
const canvas=$('topo');const ctx=canvas.getContext('2d');


// =========================================================
// 13. TOPOLOGÍA CLÁSICA
// Canvas de topología clásico: layout, render, selección y descarga de configuración.
// =========================================================
function resizeCv(){const r=canvas.getBoundingClientRect();const dpr=Math.max(1,window.devicePixelRatio||1);canvas.width=Math.floor(r.width*dpr);canvas.height=Math.floor(r.height*dpr);ctx.setTransform(dpr,0,0,dpr,0,0);}
function ensurePos(){const W=canvas.getBoundingClientRect().width||700,H=canvas.getBoundingClientRect().height||360;for(const d of S.devices)if(!S.topo.pos[d.id])S.topo.pos[d.id]={x:80+Math.random()*(W-160),y:50+Math.random()*(H-100)};for(const k of Object.keys(S.topo.pos))if(!S.devices.some(d=>d.id===k))delete S.topo.pos[k];}
function autoLayout(){
  ensurePos();const W=canvas.getBoundingClientRect().width||700,H=canvas.getBoundingClientRect().height||360;
  const ns=S.devices.slice().sort((a,b)=>{if(a.type==='firewall'&&b.type!=='firewall')return -1;if(b.type==='firewall'&&a.type!=='firewall')return 1;if(a.type==='router'&&b.type==='switch')return -1;if(b.type==='router'&&a.type==='switch')return 1;return a.name.localeCompare(b.name);});
  const m=70,cols=Math.max(1,Math.ceil(Math.sqrt(ns.length)));const cW=(W-m*2)/Math.max(1,cols),cH=(H-m*2)/Math.max(1,Math.ceil(ns.length/cols));
  for(let i=0;i<ns.length;i++){const c=i%cols,r=Math.floor(i/cols);S.topo.pos[ns[i].id]={x:m+c*cW+cW/2,y:m+r*cH+cH/2};}save();
}
function rr(x,y,w,h,r){const rd=Math.min(r,w/2,h/2);ctx.beginPath();ctx.moveTo(x+rd,y);ctx.arcTo(x+w,y,x+w,y+h,rd);ctx.arcTo(x+w,y+h,x,y+h,rd);ctx.arcTo(x,y+h,x,y,rd);ctx.arcTo(x,y,x+w,y,rd);ctx.closePath();}
function drawTopo(){
  resizeCv();ensurePos();const W=canvas.getBoundingClientRect().width,H=canvas.getBoundingClientRect().height;ctx.clearRect(0,0,W,H);
  // Grid
  ctx.globalAlpha=.035;ctx.strokeStyle='#3b82f6';ctx.lineWidth=1;for(let x=0;x<W;x+=24){ctx.beginPath();ctx.moveTo(x,0);ctx.lineTo(x,H);ctx.stroke();}for(let y=0;y<H;y+=24){ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(W,y);ctx.stroke();}ctx.globalAlpha=1;
  // Links
  for(const l of S.links){const a=S.ports.find(p=>p.id===l.aPortId),b=S.ports.find(p=>p.id===l.bPortId);if(!a||!b)continue;const da=devById(a.deviceId),db=devById(b.deviceId);if(!da||!db)continue;const pa=S.topo.pos[da.id],pb=S.topo.pos[db.id];if(!pa||!pb)continue;
    const isTrunk=a.mode==='trunk'||b.mode==='trunk';ctx.lineWidth=isTrunk?2.5:1.5;ctx.strokeStyle=isTrunk?'#38bdf8':'#3b82f6';ctx.setLineDash(isTrunk?[6,3]:[]);ctx.globalAlpha=.6;ctx.beginPath();ctx.moveTo(pa.x,pa.y);ctx.lineTo(pb.x,pb.y);ctx.stroke();ctx.setLineDash([]);ctx.globalAlpha=1;
    if(l.notes){const mx=(pa.x+pb.x)/2,my=(pa.y+pb.y)/2;ctx.font='10px Fira Code,monospace';const tw=ctx.measureText(l.notes).width;ctx.fillStyle='rgba(7,9,15,.88)';ctx.fillRect(mx-tw/2-4,my-9,tw+8,14);ctx.fillStyle='#8fa3c0';ctx.fillText(l.notes,mx-tw/2,my+2);}
  }
  // Nodes
  for(const d of S.devices){const p=S.topo.pos[d.id];if(!p)continue;const bW=140,bH=46;const x=p.x-bW/2,y=p.y-bH/2;
    const colors={switch:['rgba(59,130,246,.12)','rgba(59,130,246,.45)'],router:['rgba(16,185,129,.12)','rgba(16,185,129,.45)'],firewall:['rgba(239,68,68,.12)','rgba(239,68,68,.45)']};
    const [fc,bc]=colors[d.type]||['rgba(100,100,100,.1)','rgba(100,100,100,.3)'];
    ctx.fillStyle=fc;ctx.strokeStyle=bc;ctx.lineWidth=1.5;rr(x,y,bW,bH,9);ctx.fill();ctx.stroke();
    ctx.fillStyle='#e2eaf7';ctx.font='bold 11.5px Space Grotesk,sans-serif';ctx.fillText(d.name.substring(0,17),x+9,y+16);
    ctx.font='10px Space Grotesk,sans-serif';ctx.fillStyle='#4d6580';const ico={switch:'⇄',router:'⬡',firewall:'🛡'}[d.type]||'?';ctx.fillText(`${ico} ${d.vendorOs||'—'}`,x+9,y+32);
    const pc=portsByDev(d.id).length;ctx.fillStyle='#2d3f55';ctx.fillText(`${pc}p`,x+bW-20,y+16);
    if(d.internetEdge==='yes'){ctx.fillStyle='#ef4444';ctx.beginPath();ctx.arc(x+bW-7,y+7,4,0,Math.PI*2);ctx.fill();}
  }
}
let drag=null;
canvas.addEventListener('mousedown',e=>{const r=canvas.getBoundingClientRect(),x=e.clientX-r.left,y=e.clientY-r.top;for(const d of S.devices){const p=S.topo.pos[d.id];if(!p)continue;if(Math.abs(x-p.x)<72&&Math.abs(y-p.y)<25)drag={id:d.id,dx:x-p.x,dy:y-p.y};}});
window.addEventListener('mouseup',()=>{if(drag){save({source:'topology-drag',silent:true,notify:false,skipNormalize:true});drag=null;}});
window.addEventListener('mousemove',e=>{if(!drag)return;const r=canvas.getBoundingClientRect(),x=e.clientX-r.left,y=e.clientY-r.top;S.topo.pos[drag.id].x=x-drag.dx;S.topo.pos[drag.id].y=y-drag.dy;drawTopo();});
canvas.addEventListener('click',e=>{if(drag)return;const r=canvas.getBoundingClientRect(),x=e.clientX-r.left,y=e.clientY-r.top;for(const d of S.devices){const p=S.topo.pos[d.id];if(!p)continue;if(Math.abs(x-p.x)<72&&Math.abs(y-p.y)<25){openDevCfgModal(d.id);return;}}});
canvas.addEventListener('touchstart',e=>{const t=e.touches[0];const r=canvas.getBoundingClientRect(),x=t.clientX-r.left,y=t.clientY-r.top;for(const d of S.devices){const p=S.topo.pos[d.id];if(!p)continue;if(Math.abs(x-p.x)<72&&Math.abs(y-p.y)<25){drag={id:d.id,dx:x-p.x,dy:y-p.y};break;}}},{passive:true});
canvas.addEventListener('touchmove',e=>{if(!drag)return;e.preventDefault();const t=e.touches[0];const r=canvas.getBoundingClientRect(),x=t.clientX-r.left,y=t.clientY-r.top;S.topo.pos[drag.id].x=x-drag.dx;S.topo.pos[drag.id].y=y-drag.dy;drawTopo();},{passive:false});
canvas.addEventListener('touchend',()=>{if(drag){save({source:'topology-drag',silent:true,notify:false,skipNormalize:true});drag=null;}});
$('fitTopo').onclick=()=>{autoLayout();drawTopo();};$('reLy').onclick=()=>{for(const k in S.topo.pos)delete S.topo.pos[k];autoLayout();drawTopo();};
window.addEventListener('resize',()=>{if(S.step==='graphs')drawTopo();});


// ─────────────────── V5 VISUAL OVERLAY (driven by V4 data) ───────────────────
const vcv=$('v5view');const vctx=vcv.getContext('2d');let v5DragController=null;
const V5S={locHead:36,devW:176,devH:62,hstW:158,hstH:42,colW:190};
const V5CORE=window.NetWizardV5Core;
const V5RENDER=window.NetWizardV5Renderer;
const V5INTERACT=window.NetWizardV5Interaction;
const V5SCENE=window.NetWizardV5Scene;
const V5DRAG=window.NetWizardV5DragController;
const V5COMMANDSFACTORY=window.NetWizardV5Commands;
const V5PANELFACTORY=window.NetWizardV5Panel;
const V5LOCATIONTX=window.NetWizardV5LocationTransactions;
const V5CONTROLSFACTORY=window.NetWizardV5Controls;
let v5Commands=null,v5PanelController=null,v5ControlsController=null;
window.V5S=V5S;


// =========================================================
// 14. VISTA VISUAL V5
// Motor visual V5 para ubicaciones, nodos, drag/drop, fullscreen, panel lateral y render avanzado.
// =========================================================
function vv(){return V5CORE?V5CORE.ensureVisualState(S):(S.visual||(S.visual={locs:[],assign:{devices:{},hosts:{}},pos:{},view:{px:60,py:50,zoom:1},sel:null,fs:false,compactLabels:true,proMode:true,proBounds:{}}));}
function v5ProMode(){return vv().proMode!==false;}
function setV5ProMode(on){return v5ApplyCommand('setProMode',{on:!!on});}
function v5FreezeAutoBounds(on){
  const V=vv();
  if(on){
    if(v5ProMode())computeProfessionalLocationBounds();
    V.dragFrozenBounds=JSON.parse(JSON.stringify(V.proBounds||{}));
    V.freezeLocAutoBounds=true;
  }else{
    V.freezeLocAutoBounds=false;
    V.dragFrozenBounds=null;
  }
}
function v5Filters(){return V5CORE?V5CORE.ensureFilters(vv()):(vv().filters||(vv().filters={}));}
function v5FilterOn(k){const f=v5Filters();return f[k]!==false;}
function v5SetFilter(k,on){return v5ApplyCommand('setFilter',{key:k,on:!!on});}
function v5HostFilterKey(h){return V5CORE?V5CORE.hostFilterKey(h):'hosts';}
function v5ShowDevice(d){return V5CORE?V5CORE.showDevice(vv(),d):v5FilterOn((d.type||'switch').toLowerCase());}
function v5ShowHost(h){return V5CORE?V5CORE.showHost(vv(),h,id=>!!devById(id)):(!(h.deviceRef&&devById(h.deviceRef))&&v5FilterOn('hosts')&&v5FilterOn(v5HostFilterKey(h)));}
function v5SyncFilterInputs(){ensureV5Controls().syncFilters();}
function vLocChildren(id){return V5CORE?V5CORE.locChildren(vv(),id):vLocs().filter(l=>(l.parentId||'')===id);}
function vLocRoots(){return V5CORE?V5CORE.locRoots(vv()):vLocs().filter(l=>!l.parentId||!vLocById(l.parentId));}
function vLocDepth(id){return V5CORE?V5CORE.locDepth(vv(),id):0;}
function visualLocOwnMinHeight(loc){const rows=Math.max(devsInVisualLoc(loc.id).length,hostsInVisualLoc(loc.id).length,1);return V5S.locHead+24+rows*72;}
function computeProfessionalLocationBounds(){
  const bounds={}; const gap=22, inset=18, minW=Math.max(330,V5S.colW*2+36);
  const roots=vLocRoots();
  let nextX=80;
  function place(loc,forcedX,forcedY,forcedW){
    const ownMinH=visualLocOwnMinHeight(loc);
    const x=Number.isFinite(forcedX)?forcedX:(Number.isFinite(loc.x)?loc.x:nextX);
    const y=Number.isFinite(forcedY)?forcedY:(Number.isFinite(loc.y)?loc.y:90);
    const w=Math.max(minW, Number.isFinite(forcedW)?forcedW:(Number(loc.w)||minW));
    let h=Math.max(170, Number(loc.h)||0, ownMinH);
    const kids=vLocChildren(loc.id).sort((a,b)=>cmpMixed(a.name,b.name));
    if(kids.length){
      let cy=y+ownMinH+18;
      let deepest=cy;
      for(const kid of kids){
        const child=place(kid,x+inset,cy,Math.max(minW-24,w-inset*2));
        cy=child.y+child.h+14;
        deepest=Math.max(deepest,child.y+child.h);
      }
      h=Math.max(h, deepest-y+inset);
    }
    bounds[loc.id]={x,y,w,h};
    return bounds[loc.id];
  }
  roots.forEach((loc,idx)=>{const b=place(loc,Number.isFinite(loc.x)?loc.x:nextX,Number.isFinite(loc.y)?loc.y:(90+(idx%2)*260),Number(loc.w)||minW);nextX=Math.max(nextX,b.x+b.w+gap);});
  vv().proBounds=bounds;
  return bounds;
}
function applyProfessionalLocationLayout(){
  if(!v5ProMode())return;
  const roots=vLocRoots().sort((a,b)=>cmpMixed(a.name,b.name));
  roots.forEach((loc,idx)=>{if(!Number.isFinite(loc.x))loc.x=80+idx*380;if(!Number.isFinite(loc.y))loc.y=90+((idx%2)*260);if(!loc.w)loc.w=Math.max(360,V5S.colW*2+48);});
  computeProfessionalLocationBounds();
}
function deletePhysicalLocation(id,askConfirm=true){
  ensurePhysicalLocationModel();
  if(!V5LOCATIONTX)return false;
  const plan=V5LOCATIONTX.planDelete(S,{id});
  if(!plan.ok){console.warn(plan.error,id);alert(plan.error||i18nText('graphs.alert.deleteLocationFailed',{},'No se ha podido eliminar la ubicación.'));return false;}
  const i=plan.impact||{};
  let msg=i18nText('graphs.confirm.deleteLocation',{name:i.name||id},'¿Eliminar la ubicación "{name}"?');
  const affected=(i.children||0)+(i.devices||0)+(i.hosts||0)+(i.racks||0)+(i.outlets||0);
  if(affected){
    msg+='\n\n'+i18nText('graphs.confirm.deleteLocationImpact',{children:i.children||0,devices:i.devices||0,hosts:i.hosts||0,racks:i.racks||0,outlets:i.outlets||0,target:i.fallbackName?('"'+i.fallbackName+'"'):i18nText('graphs.common.noLocation',{},'sin ubicación')},'Se recolocarán {children} sububicación(es), {devices} equipo(s), {hosts} host(s), {racks} rack(s) y {outlets} toma(s) a {target}.');
  }
  if(askConfirm&&!confirm(msg))return false;
  const result=v5ApplyCommand('deletePhysicalLocation',{id});
  if(!result.changed){alert(result.error||i18nText('graphs.alert.deleteLocationFailed',{},'No se ha podido eliminar la ubicación.'));return false;}
  clearPhysicalLocationForm();
  return true;
}
function vLocs(){return V5CORE?V5CORE.locations(vv()):vv().locs;}
function vLocById(id){return V5CORE?V5CORE.locById(vv(),id):(vLocs().find(x=>x.id===id)||null);}
function deviceVisualLoc(id){return V5CORE?V5CORE.deviceVisualLoc(vv(),id):(vv().assign.devices[id]||'');}
function hostVisualLoc(id){return V5CORE?V5CORE.hostVisualLoc(vv(),id):(vv().assign.hosts[id]||'');}
function setDeviceVisualLoc(id,lid){return V5CORE?V5CORE.setDeviceVisualLoc(vv(),id,lid):(vv().assign.devices[id]=lid);}
function setHostVisualLoc(id,lid){return V5CORE?V5CORE.setHostVisualLoc(vv(),id,lid):(vv().assign.hosts[id]=lid);}
function ensureV5Commands(){
  if(v5Commands)return v5Commands;
  v5Commands=V5COMMANDSFACTORY.create({
    project:()=>S,
    visual:vv,
    isEdgeDevice,
    deviceVisualLocation:deviceVisualLoc,
    setDeviceVisualLocation:setDeviceVisualLoc,
    setHostVisualLocation:setHostVisualLoc,
    nextNodePosition:nextNodePositionInLoc,
    applyProfessionalLayout:applyProfessionalLocationLayout,
    suggestHostPort,
    hostConnectedDeviceId,
    locationTransactions:V5LOCATIONTX,
    idFactory:uid,
    visualIdFactory:uid
  });
  return v5Commands;
}
function v5ApplyCommand(name,payload){
  const result=ensureV5Commands().execute(name,payload||{});
  window.NetWizardV5CommandState={name,payload:{...(payload||{})},changed:!!result.changed,selection:result.selection?{...result.selection}:null,error:result.error||null,impact:result.impact||null};
  if(!result.changed)return result;
  if(result.selection)vv().sel={...result.selection};
  save();
  if(result.refresh)refresh();
  else{
    if(result.redraw)drawV5();
    if(result.panel)renderV5Panel();
  }
  return result;
}
function ensureV5Controls(){
  if(v5ControlsController)return v5ControlsController;
  v5ControlsController=V5CONTROLSFACTORY.create({
    document,window,
    filterValue:v5FilterOn,
    setFilter:v5SetFilter,
    autoLocate:autoVisualAssign,
    addLocation:addV5Location,
    fit:()=>fitV5(),
    setFullscreenState:on=>{vv().fs=!!on;},
    afterFullscreenSync:()=>{resizeV5();fitV5(false);renderV5Panel();},
    isActive:()=>S.step==='graphs',
    onResize:()=>resizeV5(),
    onError:err=>console.warn('[NetWizard V5] Fullscreen fallback:',err)
  });
  return v5ControlsController;
}
function toggleV5Fullscreen(force){return ensureV5Controls().toggleFullscreen(force);}
function visualLocForPhysicalLocationId(id){return V5CORE?V5CORE.visualLocationByPhysicalId(vv(),id):'';}
function visualLocForPhysicalLocationName(name){return V5CORE?V5CORE.visualLocationByPhysicalName(vv(),name):'';}
function inferredDeviceVisualLoc(d){return V5CORE?V5CORE.inferDeviceVisualLocation(S,vv(),d):'';}
function inferredHostVisualLoc(h){return V5CORE?V5CORE.inferHostVisualLocation(S,vv(),h):'';}
function isSyntheticDefaultVisualLoc(loc){return V5CORE?V5CORE.isSyntheticDefaultLocation(S,loc):false;}
function ensureVisualModel(){
  const V=vv();
  for(const k of Object.keys(V.assign.devices))if(!S.devices.some(d=>d.id===k))delete V.assign.devices[k];
  for(const k of Object.keys(V.assign.hosts))if(!S.hosts.some(h=>h.id===k))delete V.assign.hosts[k];
  for(const k of Object.keys(V.pos))if(!S.devices.some(d=>d.id===k)&&!S.hosts.some(h=>h.id===k))delete V.pos[k];
  if((S.physicalLocations||[]).length){
    const defaultNames=new Set(['Core / Perímetro','Acceso / Usuarios','Servicios']);
    const meaningfulPhysical=(S.physicalLocations||[]).some(pl=>!defaultNames.has(cleanStr(pl.name)));
    const syntheticLocs=meaningfulPhysical?V.locs.filter(isSyntheticDefaultVisualLoc):[];
    const syntheticIds=new Set(syntheticLocs.map(l=>l.id));
    const syntheticPhysicalIds=new Set(syntheticLocs.map(l=>l.physicalLocationId).filter(Boolean));
    if(syntheticIds.size){
      V.locs=V.locs.filter(l=>!syntheticIds.has(l.id));
      for(const [id,lid] of Object.entries(V.assign.devices))if(syntheticIds.has(lid))delete V.assign.devices[id];
      for(const [id,lid] of Object.entries(V.assign.hosts))if(syntheticIds.has(lid))delete V.assign.hosts[id];
      S.physicalLocations=(S.physicalLocations||[]).filter(pl=>!syntheticPhysicalIds.has(pl.id));
    }
    syncPhysicalLocationsIntoVisual();
  }
  if(!V.locs.length){
    V.locs=[
      {id:uid('loc'),name:'Core / Perímetro',color:'#0f2744',x:60,y:70,type:'zone'},
      {id:uid('loc'),name:'Acceso / Usuarios',color:'#14263b',x:430,y:70,type:'zone'},
      {id:uid('loc'),name:'Servicios',color:'#2a1f3b',x:800,y:70,type:'zone'},
    ];
  }
  syncLocationModels();
  const l0=V.locs[0]?.id||'',l1=V.locs[1]?.id||l0,l2=V.locs[2]?.id||l1;
  for(const d of S.devices){
    const inferred=inferredDeviceVisualLoc(d);
    if(inferred&&vLocById(inferred)){
      V.assign.devices[d.id]=inferred;
      continue;
    }
    if(!V.assign.devices[d.id]||!vLocById(V.assign.devices[d.id])){
      let lid=l1;
      if(d.type==='firewall'||d.type==='router')lid=l0;
      else if((d.name||'').toLowerCase().includes('srv')||(d.name||'').toLowerCase().includes('server')||(d.notes||'').toLowerCase().includes('server'))lid=l2;
      V.assign.devices[d.id]=lid;
    }
  }
  for(const h of S.hosts){
    const inferred=inferredHostVisualLoc(h);
    if(inferred&&vLocById(inferred)){
      V.assign.hosts[h.id]=inferred;
      continue;
    }
    if(!V.assign.hosts[h.id]||!vLocById(V.assign.hosts[h.id])){
      const linkedId=hostConnectedDeviceId(h);
      V.assign.hosts[h.id]=linkedId?deviceVisualLoc(linkedId):l1;
    }
  }
}
function devsInVisualLoc(lid){return S.devices.filter(d=>deviceVisualLoc(d.id)===lid && v5ShowDevice(d));}
function hostEffectiveVisualLoc(h){
  const explicit=hostVisualLoc(h.id);
  if(explicit&&vLocById(explicit))return explicit;
  const linkedDev=devById(hostConnectedDeviceId(h)||'');
  const linkedLoc=linkedDev ? deviceVisualLoc(linkedDev.id) : '';
  return linkedLoc || '';
}
function hostsInVisualLoc(lid){return S.hosts.filter(h=>hostEffectiveVisualLoc(h)===lid && v5ShowHost(h));}
function visualLocContentBounds(loc){
  const b=visualLocBoundsRaw(loc);
  let minX=b.x, minY=b.y, maxX=b.x+b.w, maxY=b.y+b.h;
  const members=[...devsInVisualLoc(loc.id).map(d=>({kind:'dev',id:d.id})),...hostsInVisualLoc(loc.id).map(h=>({kind:'host',id:h.id}))];
  for(const m of members){
    const nb=visualNodeBounds(m.kind,m.id);
    minX=Math.min(minX,nb.x-18); minY=Math.min(minY,nb.y-18);
    maxX=Math.max(maxX,nb.x+nb.w+18); maxY=Math.max(maxY,nb.y+nb.h+18);
  }
  return {x:minX,y:minY,w:maxX-minX,h:maxY-minY};
}
function effectiveHostIp(h){
  if(h.ipMode==='static')return h.staticIp||'—';
  const sn=snByVRef(h.vlanRef);const ci=sn?parseCidr(sn.cidr):null;
  if(!ci||ci.fh==null)return 'DHCP';
  const idx=Math.max(2,S.hosts.filter(x=>x.vlanRef===h.vlanRef).findIndex(x=>x.id===h.id)+2);
  const next=(ci.fh+idx)<=ci.lh?ip4s(ci.fh+idx):'DHCP';
  return h.ipMode==='dhcp'?('DHCP · '+next):next;
}
function visualNodeBounds(kind,id){return V5CORE?V5CORE.nodeBounds(vv(),kind,id,V5S):{x:0,y:0,w:0,h:0};}
function visualLocBoundsRaw(loc){
  if(v5ProMode()){
    const V=vv();
    const frozen=V.freezeLocAutoBounds&&V.dragFrozenBounds&&V.dragFrozenBounds[loc.id];
    if(frozen) return frozen;
    const map=V.proBounds&&Object.keys(V.proBounds).length?V.proBounds:computeProfessionalLocationBounds();
    if(map[loc.id]) return map[loc.id];
  }
  const rows=Math.max(devsInVisualLoc(loc.id).length,hostsInVisualLoc(loc.id).length,1);
  const minW=Math.max(330,V5S.colW*2+36);
  const minH=V5S.locHead+24+rows*72;
  return{x:loc.x,y:loc.y,w:Math.max(minW,Number(loc.w)||0),h:Math.max(minH,Number(loc.h)||0)};
}
function visualLocBounds(loc){
  const raw=visualLocBoundsRaw(loc);
  if(vv().freezeLocAutoBounds) return raw;
  const minW=Math.max(330,V5S.colW*2+36);
  let maxX=raw.x+raw.w, maxY=raw.y+raw.h;
  for(const d of devsInVisualLoc(loc.id)){
    const nb=visualNodeBounds('dev',d.id);
    maxX=Math.max(maxX,nb.x+nb.w+22);
    maxY=Math.max(maxY,nb.y+nb.h+22);
  }
  for(const h of hostsInVisualLoc(loc.id)){
    const nb=visualNodeBounds('host',h.id);
    maxX=Math.max(maxX,nb.x+nb.w+22);
    maxY=Math.max(maxY,nb.y+nb.h+22);
  }
  return {x:raw.x,y:raw.y,w:Math.max(minW,maxX-raw.x),h:Math.max(160,maxY-raw.y)};
}
function layoutVisualLoc(loc,force=false){
  const b=visualLocBounds(loc);
  devsInVisualLoc(loc.id).forEach((d,i)=>{if(force||!vv().pos[d.id])vv().pos[d.id]={x:b.x+16,y:b.y+V5S.locHead+14+i*72};});
  hostsInVisualLoc(loc.id).forEach((h,i)=>{if(force||!vv().pos[h.id])vv().pos[h.id]={x:b.x+V5S.colW+18,y:b.y+V5S.locHead+14+i*72};});
}
function nextNodePositionInLoc(lid,kind,excludeId){
  const loc=vLocById(lid);if(!loc)return {x:40,y:40};
  const b=visualLocBounds(loc);
  const list=(kind==='device'?devsInVisualLoc(lid):hostsInVisualLoc(lid)).filter(x=>x.id!==excludeId);
  return kind==='device'?{x:b.x+16,y:b.y+V5S.locHead+14+list.length*72}:{x:b.x+V5S.colW+18,y:b.y+V5S.locHead+14+list.length*72};
}
function autoVisualAssign(){ensureVisualModel();if(v5ProMode())applyProfessionalLocationLayout();for(const loc of vLocs())layoutVisualLoc(loc,true);save();drawV5();renderV5Panel();}
function resizeV5(){const wrap=vcv.parentElement;if(!wrap)return;const r=wrap.getBoundingClientRect();const dpr=Math.max(1,window.devicePixelRatio||1);vcv.width=Math.floor(r.width*dpr);vcv.height=Math.floor(r.height*dpr);vcv.style.width=r.width+'px';vcv.style.height=r.height+'px';vctx.setTransform(dpr,0,0,dpr,0,0);drawV5();}
function v2s(x,y){return V5CORE?V5CORE.worldToScreen(vv(),x,y):{x,y};}
function s2v(x,y){return V5CORE?V5CORE.screenToWorld(vv(),x,y):{x,y};}
function nodeCenterById(kind,id){return V5CORE?V5CORE.nodeCenter(vv(),kind,id,V5S):{x:0,y:0};}
function drawRound(ctx,x,y,w,h,r){return V5RENDER.roundPath(ctx,x,y,w,h,r);}
function v5NodeRadius(w,h,z,base=10){return V5RENDER.nodeRadius(w,h,z,base);}
function v5ReadableZoom(){return V5RENDER.readableZoom(vv());}
function drawNodeText(x,y,lines){return V5RENDER.drawTextLines(vctx,x,y,lines,vv().view.zoom);}
function colorFromSeed(seed){return V5RENDER.colorFromSeed(seed);}
function rgbaFromCss(css,alpha){return V5RENDER.rgbaFromCss(css,alpha);}
function linkedDeviceIds(devId){return V5CORE?V5CORE.linkedDeviceIds(S,devId):[];}
function deviceAccentColor(devId,seen){return V5RENDER.deviceAccentColor(S,devId,seen);}
function compactLinkLabel(host,dev,port){return V5RENDER.compactLinkLabel(vv(),host,dev,port,{device:i18nText('graphs.common.device',{},'Equipo'),autoPending:i18nText('graphs.canvas.autoPending',{},' · auto/pendiente')});}

let v5LinkDots=[];
function v5LinkTooltipEl(){
  let el=document.getElementById('v5LinkTooltip');
  if(!el){
    el=document.createElement('div');
    el.id='v5LinkTooltip';
    el.style.cssText='position:fixed;z-index:2147483647;display:none;pointer-events:none;max-width:280px;background:rgba(7,9,15,.98);border:1px solid rgba(96,165,250,.42);border-radius:12px;padding:9px 11px;box-shadow:0 14px 38px rgba(0,0,0,.45);color:#e2eaf7;font:12px Space Grotesk,system-ui,sans-serif;line-height:1.45;';
    const host=document.getElementById('v5Layout')||document.body;
    host.appendChild(el);
  }
  const host=document.getElementById('v5Layout')||document.body;
  if(el.parentElement!==host) host.appendChild(el);
  return el;
}
function v5HideLinkTooltip(){const el=document.getElementById('v5LinkTooltip'); if(el)el.style.display='none';}
function v5RenderLinkTooltip(el,dot){
  clearNode(el);
  const h=dot.host, dev=dot.dev, p=dot.port, vlan=vByRef(h.vlanRef);
  const mode=p?(p.mode||'access'):i18nText('graphs.common.pending',{},'pendiente');
  const accessVlan=p&&p.accessVlanRef?vByRef(p.accessVlanRef):null;
  const title=makeEl('div','',`${h.name||i18nText('graphs.common.host',{},'Host')} → ${dev.name||i18nText('graphs.common.device',{},'Equipo')}`);
  title.style.cssText='font-weight:700;margin-bottom:4px;color:#e2eaf7';
  el.appendChild(title);
  const addLine=(label,value,mono=false)=>{
    const line=makeEl('div',''); line.style.color='#8fa3c0'; appendText(line,label+': ');
    const span=makeEl('span','',value); span.style.color=label===i18nText('graphs.fields.port',{},'Puerto')?'#bfdbfe':'#e2eaf7'; if(mono) span.style.fontFamily='Fira Code,monospace';
    line.appendChild(span); el.appendChild(line);
  };
  addLine(i18nText('graphs.fields.port',{},'Puerto'),p?p.name:i18nText('graphs.common.unassigned',{},'sin asignar'),true);
  addLine(i18nText('graphs.fields.mode',{},'Modo'),i18nText('graphs.tooltip.modeVlan',{mode,vlan:vlan?('VLAN '+vlan.vlanId+' · '+vlan.name):i18nText('graphs.common.noVlanLower',{},'sin VLAN')},'{mode} · VLAN host: {vlan}'),true);
  addLine(i18nText('graphs.tooltip.portVlan',{},'VLAN puerto'),accessVlan?('VLAN '+accessVlan.vlanId+' · '+accessVlan.name):(p&&p.accessVlanRef?p.accessVlanRef:'—'),false);
  addLine('IP',effectiveHostIp(h)||'—',true);
}
function v5DrawLinkDot(geometry,host,dev,port,accent){
  const hit=V5RENDER.drawLinkDot(vctx,{visual:vv(),geometry,host,port,accent});
  if(hit)v5LinkDots.push({...hit,host,dev,port});
}
function v5HoverMove(evt){
  if(v5DragController&&v5DragController.isActive()){v5HideLinkTooltip();return;}
  const r=vcv.getBoundingClientRect();
  const x=evt.clientX-r.left, y=evt.clientY-r.top;
  const dot=V5INTERACT.linkDotAt(v5LinkDots,x,y);
  if(!dot){v5HideLinkTooltip();vcv.style.cursor='grab';return;}
  const el=v5LinkTooltipEl();
  v5RenderLinkTooltip(el,dot);
  el.style.display='block';
  const pad=14;
  let left=evt.clientX+pad, top=evt.clientY+pad;
  const rect=el.getBoundingClientRect();
  if(left+rect.width>window.innerWidth-8)left=evt.clientX-rect.width-pad;
  if(top+rect.height>window.innerHeight-8)top=evt.clientY-rect.height-pad;
  el.style.left=Math.max(8,left)+'px';
  el.style.top=Math.max(8,top)+'px';
  vcv.style.cursor='help';
}
function v5HostPort(h,linkedDev){
  let p=h.portRef?S.ports.find(x=>x.id===h.portRef):null;
  if(!p&&(h.portAssignMode||'auto')==='auto'){
    const suggested=suggestHostPort(linkedDev.id,h.id);p=suggested?S.ports.find(x=>x.id===suggested):null;
  }
  return p;
}
function drawV5(){
  if(!vcv||!V5SCENE)return;
  v5SyncFilterInputs();
  ensureVisualModel();
  if(v5ProMode()&&!vv().freezeLocAutoBounds)computeProfessionalLocationBounds();
  const r=vcv.getBoundingClientRect();
  if(!r.width||!r.height)return;
  const result=V5SCENE.render(vctx,{
    project:S,
    visual:vv(),
    rect:{width:r.width,height:r.height},
    metrics:V5S,
    locations:vLocs(),
    locationDepth:vLocDepth,
    locationBounds:visualLocBounds,
    devicesInLocation:devsInVisualLoc,
    hostsInLocation:hostsInVisualLoc,
    layoutLocation:layoutVisualLoc,
    showDevice:v5ShowDevice,
    showHost:v5ShowHost,
    deviceById:devById,
    hostConnectedDeviceId,
    vlanByRef:vByRef,
    hostPort:v5HostPort,
    proMode:v5ProMode(),
    drag:v5DragController?v5DragController.getSession():null,
    labels:{
      locationSummary:(devices,hosts)=>i18nText('graphs.panel.locationSummary',{devices,hosts},'{devices} equipos · {hosts} hosts'),
      noVlan:i18nText('graphs.common.noVlan',{},'Sin VLAN'),
      noMgmt:i18nText('graphs.common.noMgmt',{},'sin mgmt'),
      device:i18nText('graphs.common.device',{},'Equipo'),
      autoPending:i18nText('graphs.canvas.autoPending',{},' · auto/pendiente')
    }
  });
  v5LinkDots=result.linkDots||[];
  window.NetWizardV5RenderState=result.renderState;
}
function fitV5(centerOnly=true){ensureVisualModel();let minx=1e9,miny=1e9,maxx=-1e9,maxy=-1e9;for(const loc of vLocs()){const b=visualLocBounds(loc);minx=Math.min(minx,b.x);miny=Math.min(miny,b.y);maxx=Math.max(maxx,b.x+b.w);maxy=Math.max(maxy,b.y+b.h);}if(!isFinite(minx)){vv().view={px:60,py:50,zoom:1};drawV5();return;}const r=vcv.parentElement.getBoundingClientRect();const padx=24,pady=24;const zw=Math.max(.45,Math.min(1.25,(r.width-padx*2)/(maxx-minx||1)));const zh=Math.max(.45,Math.min(1.25,(r.height-pady*2)/(maxy-miny||1)));const zoom=Math.min(zw,zh);vv().view.zoom=zoom;vv().view.px=padx-minx*zoom+(r.width-(maxx-minx)*zoom-padx*2)/2;vv().view.py=pady-miny*zoom+(r.height-(maxy-miny)*zoom-pady*2)/2;drawV5();}
function visualResizeHandleHit(wx,wy){return V5INTERACT.resizeHandleHit({point:{x:wx,y:wy},locations:vLocs(),locationBounds:visualLocBounds,zoom:vv().view.zoom,enabled:loc=>!(v5ProMode()&&loc.parentId)});}
function visualHit(wx,wy){return V5INTERACT.hitTest({point:{x:wx,y:wy},hosts:S.hosts,devices:S.devices,locations:vLocs(),showHost:v5ShowHost,showDevice:v5ShowDevice,nodeBounds:visualNodeBounds,locationBounds:visualLocBounds,zoom:vv().view.zoom,resizeEnabled:loc=>!(v5ProMode()&&loc.parentId)});}
function locAt(wx,wy){return V5INTERACT.locationAt({point:{x:wx,y:wy},locations:vLocs(),locationBounds:visualLocBounds});}
function removeV5Location(id){
  ensureVisualModel();
  if(vLocs().length<2)return alert(i18nText('graphs.alert.keepOneLocation',{},'Debe quedar al menos una ubicación.'));
  const loc=vLocById(id);
  const physical=loc?.physicalLocationId?physLocById(loc.physicalLocationId):physLocByName(loc?.name||'');
  if(!physical)return alert(i18nText('graphs.alert.physicalLocationMissing',{},'No se ha encontrado la ubicación física asociada.'));
  return deletePhysicalLocation(physical.id,true);
}
function addV5Location(){
  ensureVisualModel();
  const idx=vLocs().length+1,visualId=uid('loc');
  return v5ApplyCommand('upsertPhysicalLocation',{
    name:'Ubicación '+idx,type:'zone',parentId:'',distance:'',notes:'Creada desde Vista V5',
    visual:{id:visualId,color:'#12324f',x:80+(idx-1)*310,y:90+((idx-1)%2)*240,w:Math.max(330,V5S.colW*2+36),h:Math.max(170,V5S.locHead+24+72)}
  });
}
function v5UpdateLocationMeta(id,key,val){
  const loc=vLocById(id);if(!loc)return;
  if(key!=='name')return v5ApplyCommand('updateLocationMeta',{id,key,value:val});
  const physical=loc.physicalLocationId?physLocById(loc.physicalLocationId):physLocByName(loc.name||'');
  if(!physical)return v5ApplyCommand('updateLocationMeta',{id,key,value:val});
  return v5ApplyCommand('upsertPhysicalLocation',{
    id:physical.id,name:val,type:physical.type||loc.type||'other',parentId:physical.parentId||'',distance:physical.distance||'',notes:physical.notes||'',
    visual:{id:loc.id,color:loc.color,x:loc.x,y:loc.y,w:loc.w,h:loc.h},mode:'redraw'
  });
}
function ensureV5PanelController(){
  if(v5PanelController)return v5PanelController;
  v5PanelController=V5PANELFACTORY.create({
    project:()=>S,
    visual:vv,
    proMode:v5ProMode,
    locations:vLocs,
    locationById:vLocById,
    locationDepth:vLocDepth,
    locationChildren:vLocChildren,
    locationBounds:visualLocBounds,
    devicesInLocation:devsInVisualLoc,
    hostsInLocation:hostsInVisualLoc,
    deviceById:devById,
    deviceVisualLocation:deviceVisualLoc,
    hostVisualLocation:hostVisualLoc,
    deviceKind:devKind,
    deviceKindOptions:()=>NWDevice?NWDevice.kindOptions():[{value:'switch',label:'Switch'},{value:'router',label:'Router'},{value:'firewall',label:'Firewall'}],
    vendors:()=>ALL_VENDORS.map(v=>({value:v.id,label:v.l})),
    hostTypeOptions:()=>Object.keys(HT).map(k=>({value:k,label:hostTypeText(k)})),
    vlanByRef:vByRef,
    effectiveHostIp,
    deviceLabel:devLabel,
    portsByDevice:portsByDev,
    hostConnectedDeviceId,
    connectableDevices,
    hostAssignablePorts,
    hostPortUsedByOther,
    actions:{
      addLocation:addV5Location,
      fit:()=>fitV5(),
      fullscreen:()=>toggleV5Fullscreen(),
      setProMode:setV5ProMode,
      select:selectV5,
      removeLocation:removeV5Location,
      updateLocationMeta:v5UpdateLocationMeta,
      updateLocationSize:(id,key,val)=>v5ApplyCommand('updateLocationSize',{id,key,value:val}),
      setCompactLabels:compact=>v5ApplyCommand('setCompactLabels',{compact:!!compact}),
      updateDevice:(id,key,val)=>v5ApplyCommand('updateDevice',{id,key,value:val}),
      moveDevice:(id,locationId)=>v5ApplyCommand('moveDevice',{id,locationId}),
      updatePort:(id,key,val)=>v5ApplyCommand('updatePort',{id,key,value:val}),
      updateHost:(id,key,val)=>v5ApplyCommand('updateHost',{id,key,value:val}),
      moveHost:(id,locationId)=>v5ApplyCommand('moveHost',{id,locationId}),
      setHostConnectedDevice:(id,deviceId)=>v5ApplyCommand('setHostConnectedDevice',{id,deviceId}),
      setHostPortMode:(id,mode)=>v5ApplyCommand('setHostPortMode',{id,mode}),
      updateHostPort:(id,portId)=>v5ApplyCommand('updateHostPort',{id,portId})
    }
  });
  return v5PanelController;
}
function renderV5Panel(){
  const box=$('v5Panel');if(!box)return;
  ensureVisualModel();
  ensureV5PanelController().render(box);
}
function selectV5(t,id){vv().sel={t,id};renderV5Panel();drawV5();}
function v5CanvasPoint(evt){
  const r=vcv.getBoundingClientRect();
  const clientX=evt.clientX ?? (evt.touches&&evt.touches[0]&&evt.touches[0].clientX) ?? 0;
  const clientY=evt.clientY ?? (evt.touches&&evt.touches[0]&&evt.touches[0].clientY) ?? 0;
  return s2v(clientX-r.left,clientY-r.top);
}
function createV5DragController(){
  return V5DRAG.create({
    canvas:vcv,
    visual:vv,
    canvasPoint:v5CanvasPoint,
    hitTest:pt=>visualHit(pt.x,pt.y),
    select:selectV5,
    clearSelection:()=>{vv().sel=null;renderV5Panel();},
    draw:drawV5,
    renderPanel:renderV5Panel,
    save:()=>save({source:'v5-drag',silent:true,notify:false,skipNormalize:true}),
    refresh:()=>{drawV5();renderV5Panel();},
    freezeAutoBounds:v5FreezeAutoBounds,
    locationById:vLocById,
    locationBounds:visualLocBounds,
    devicesInLocation:devsInVisualLoc,
    hostsInLocation:hostsInVisualLoc,
    nodeBounds:visualNodeBounds,
    deviceVisualLocation:deviceVisualLoc,
    hostVisualLocation:hostVisualLoc,
    setDeviceVisualLocation:setDeviceVisualLoc,
    setHostVisualLocation:setHostVisualLoc,
    nextNodePosition:nextNodePositionInLoc,
    locationAt:pt=>locAt(pt.x,pt.y),
    autoAssignHost:autoAssignHostToLocation,
    warn:reason=>console.warn('[NetWizard V5] Autoasignación no aplicada:',reason)
  });
}
v5DragController=createV5DragController();
v5DragController.bind();
ensureV5Controls().bind();
vcv.addEventListener('mousemove',v5HoverMove);
vcv.addEventListener('mouseleave',v5HideLinkTooltip);
// ─────────────────── MAIN REFRESH ───────────────────


// =========================================================
// 15. REFRESH GLOBAL E INICIALIZACIÓN
// Refresh central que re-renderiza la aplicación tras cambios de estado. Event listeners quedan antes de este bloque.
// =========================================================
function renderSecurityControls(){
  ['secBpdu','secPs','secDs','secDai','secIpsg'].forEach(id=>{
    const k=id.replace('sec','').toLowerCase();
    if($(id))$(id).value=S.security[k]||'no';
  });
  if($('secBpdu'))$('secBpdu').value=S.security.bpdu||'yes';
  if($('secPs'))$('secPs').value=S.security.ps||'yes';
  if($('secDs'))$('secDs').value=S.security.ds||'yes';
  if($('secDai'))$('secDai').value=S.security.dai||'yes';
  if($('secDsV'))$('secDsV').value=S.security.dsV||'';
}
function renderActiveStep(){
  switch(S.step){
    case 'dash':
      renderDash();
      break;
    case 'wiz':
      renderWizard();
      break;
    case 'loc':
      renderPhysicalLocations();
      fillPhysicalLocationParentSel($('plEditId')?.value||'');
      break;
    case 'dev':
      initDeviceModelList();
      initDeviceKindSelect();
      initDeviceVendorSelect();
      renderDevs();
      break;
    case 'ports':
      fillPortDevSel();
      updatePortRoleOpts();
      fillVlanSels();
      renderPortsList();
      break;
    case 'vlan':
      renderVlans();
      renderSubnets();
      fillVlanSels();
      syncSubnetAuthorityLabel();
      updManualSnHint();
      fillRoasSels();
      if($('dhcpPanel')?.open)renderDhcp();
      renderVtp();
      break;
    case 'hosts':
      fillVlanSels();
      fillHostDeviceSel();
      fillHostManagedDeviceSel();
      fillHostPortSel();
      fillHostLocSel();
      fillHostPhysLocSel();
      syncHostI18nLabels();
      updateHostDeviceHint();
      renderHosts();
      if($('ipMapPanel')?.open)renderIpMap();
      break;
    case 'links':
      fillVlanSels();
      fillSwDevSels();
      fillLinkPickers();
      renderVisPorts();
      renderLinks();
      break;
    case 'fw':
      fillVlanSels();
      renderFwRules();
      renderSecurityControls();
      if($('fw-matrix')?.classList.contains('on'))renderVlanMatrix();
      break;
    case 'graphs':
      drawTopo();
      resizeV5();
      renderV5Panel();
      break;
    case 'cfg':
      renderDevPickCfg();
      if(selDevCfg)selectDevCfg(selDevCfg);
      break;
    default:
      break;
  }
}
let staticUiInitialized=false;
function initStaticUiOnce(){
  if(staticUiInitialized)return;
  initDeviceModelList();
  initDeviceKindSelect();
  initDeviceVendorSelect();
  initLazyPanels();
  staticUiInitialized=true;
}
const renderMetrics={last:null,byStep:{}};
window.NetWizardRenderMetrics={
  snapshot:()=>JSON.parse(JSON.stringify({...renderMetrics,state:stateTimingMetrics}))
};
function refresh(){
  const totalStart=performance.now();
  initStaticUiOnce();
  renderNav();
  const stepStart=performance.now();
  renderActiveStep();
  const stepMs=performance.now()-stepStart;
  if(window.NetWizardI18n&&window.NetWizardI18n.applyI18n)window.NetWizardI18n.applyI18n(document);
  const totalMs=performance.now()-totalStart;
  const prev=renderMetrics.byStep[S.step]||{count:0,totalMs:0,maxMs:0,lastMs:0};
  prev.count++;prev.totalMs+=stepMs;prev.lastMs=stepMs;prev.maxMs=Math.max(prev.maxMs,stepMs);
  renderMetrics.byStep[S.step]=prev;
  renderMetrics.last={step:S.step,stepMs,totalMs,at:Date.now()};
}

refresh();
