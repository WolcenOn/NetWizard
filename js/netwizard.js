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

// ── CONSTANTS ──
const STEP_ORDER=['dash','wiz','loc','dev','ports','vlan','hosts','iot','graphs','links','fw','cfg'];
const HT={pc:{l:'PC/Desktop',i:'🖥'},laptop:{l:'Portátil',i:'💻'},server:{l:'Servidor',i:'🗄'},printer:{l:'Impresora',i:'🖨'},phone:{l:'Teléfono IP',i:'📞'},camera:{l:'Cámara IP',i:'📷'},ap:{l:'AP WiFi',i:'📡'},iot:{l:'IoT',i:'🔌'}};
const VCOLS=['#3b82f6','#10b981','#f59e0b','#ef4444','#8b5cf6','#06b6d4','#f97316','#e879f9','#84cc16','#14b8a6'];

const SCENARIOS=[
  {id:'home',ico:'🏠',name:'Home Lab',desc:'Router + switch + PCs',vlans:[{id:10,n:'LAN',c:'#3b82f6'},{id:20,n:'IoT',c:'#10b981'},{id:99,n:'Gestión',c:'#8b5cf6'}]},
  {id:'office',ico:'🏢',name:'Oficina pequeña',desc:'< 50 usuarios',vlans:[{id:10,n:'Usuarios',c:'#3b82f6'},{id:20,n:'Servidores',c:'#10b981'},{id:30,n:'WiFi',c:'#f59e0b'},{id:99,n:'Gestión',c:'#8b5cf6'}]},
  {id:'corp',ico:'🏙',name:'Empresa mediana',desc:'Departamentos + servidores',vlans:[{id:10,n:'Dirección',c:'#ef4444'},{id:20,n:'Ventas',c:'#3b82f6'},{id:30,n:'IT',c:'#10b981'},{id:40,n:'RRHH',c:'#f59e0b'},{id:50,n:'Servidores',c:'#8b5cf6'},{id:60,n:'WiFi',c:'#06b6d4'},{id:70,n:'Cámaras',c:'#f97316'},{id:99,n:'Gestión',c:'#e879f9'}]},
  {id:'dc',ico:'🗄',name:'Datacenter',desc:'Frontend/Backend/DB/Storage',vlans:[{id:10,n:'Frontend',c:'#3b82f6'},{id:20,n:'Backend',c:'#10b981'},{id:30,n:'DB',c:'#ef4444'},{id:40,n:'Storage',c:'#f59e0b'},{id:50,n:'Management',c:'#8b5cf6'}]},
  {id:'retail',ico:'🏪',name:'Retail / Comercio',desc:'POS, cámaras, WiFi clientes',vlans:[{id:10,n:'POS',c:'#10b981'},{id:20,n:'Cámaras',c:'#ef4444'},{id:30,n:'WiFi-Público',c:'#f59e0b'},{id:40,n:'Empleados',c:'#3b82f6'},{id:99,n:'Gestión',c:'#8b5cf6'}]},
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
  {name:'Básico: DNS + HTTP/HTTPS',rules:[
    {name:'DNS',src:'any',dst:'any',proto:'udp',port:'53',action:'allow',dir:'both',prio:10},
    {name:'HTTP',src:'any',dst:'any',proto:'tcp',port:'80',action:'allow',dir:'out',prio:20},
    {name:'HTTPS',src:'any',dst:'any',proto:'tcp',port:'443',action:'allow',dir:'out',prio:30},
    {name:'Denegar resto',src:'any',dst:'any',proto:'any',port:'any',action:'deny',dir:'both',prio:9999},
  ]},
  {name:'Servidores: web + SSH',rules:[
    {name:'SSH Admin',src:'10.10.99.0/24',dst:'any',proto:'tcp',port:'22',action:'allow',dir:'in',prio:10},
    {name:'HTTP IN',src:'any',dst:'any',proto:'tcp',port:'80',action:'allow',dir:'in',prio:20},
    {name:'HTTPS IN',src:'any',dst:'any',proto:'tcp',port:'443',action:'allow',dir:'in',prio:30},
    {name:'ICMP',src:'any',dst:'any',proto:'icmp',port:'any',action:'allow',dir:'both',prio:40},
    {name:'Denegar resto IN',src:'any',dst:'any',proto:'any',port:'any',action:'deny',dir:'in',prio:9999},
  ]},
  {name:'Cámaras: solo NVR tiene acceso',rules:[
    {name:'NVR→Cámaras RTSP',src:'10.10.50.1',dst:'10.10.70.0/24',proto:'tcp',port:'554',action:'allow',dir:'both',prio:10},
    {name:'Bloquear acceso a cámaras',src:'any',dst:'10.10.70.0/24',proto:'any',port:'any',action:'deny',dir:'in',prio:20},
  ]},
  {name:'Aislamiento VoIP',rules:[
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
function defS(){return{_schemaVersion:'3.48.0',step:'dash',projName:'',devices:[],ports:[],vlans:[],subnets:[],hosts:[],links:[],fwRules:[],vlanMatrix:{},roas:{gwId:null,lanIf:'',natVRef:null,wanCidr:'',wanNh:''},dhcp:{},security:{bpdu:'yes',ps:'yes',ds:'yes',dsV:'',dai:'yes',ipsg:'no',qV:''},vtp:{domain:'',password:'',version:'2',pruning:'no',roles:{}},topo:{pos:{}},hostPhysicalLocations:[],physicalLocations:[],uiSort:{},iot:{accessNodes:[],devices:[],map:{show:{network:true,port:false,access:true,iot:true,wifi:true,lora:true,zigbee:true,thread:true,mqtt:true},scale:1,panX:0,panY:0},selected:null},visual:{locs:[],assign:{devices:{},hosts:{}},pos:{},view:{px:60,py:50,zoom:1},sel:null}};}
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
function save(options={}){
  if(NWSchema && typeof NWSchema.sanitizeProject==='function'){
    Object.assign(S,NWSchema.sanitizeProject(S,{defaults:defS}).project);
  }
  localStorage.setItem(SK,JSON.stringify(S));
  if(!options.silent){
    const el=$('savedLbl');
    if(el){el.classList.add('on');clearTimeout(el._t);el._t=setTimeout(()=>el.classList.remove('on'),1300);}
  }
  document.dispatchEvent(new CustomEvent('nw:project:changed',{detail:{source:options.source||'netwizard'}}));
}
function projectSnapshot(){return JSON.parse(JSON.stringify(S));}
function replaceProject(project,options={}){
  if(!project || typeof project!=='object')throw new Error('Proyecto inválido');
  const next=normalizeProject(project);
  Object.keys(S).forEach(k=>delete S[k]);
  Object.assign(S,next);
  save({source:options.source||'api',silent:options.silent});
  if(!options.skipRefresh && typeof refresh==='function')refresh();
  return projectSnapshot();
}
function updateProject(patchOrUpdater,options={}){
  const patch=typeof patchOrUpdater==='function'?patchOrUpdater(projectSnapshot()):patchOrUpdater;
  if(!patch || typeof patch!=='object')return projectSnapshot();
  const next=normalizeProject({...S,...patch});
  Object.keys(S).forEach(k=>delete S[k]);
  Object.assign(S,next);
  save({source:options.source||'api',silent:options.silent});
  if(!options.skipRefresh && typeof refresh==='function')refresh();
  return projectSnapshot();
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
  const seen=new Set();
  S.physicalLocations=(S.physicalLocations||[]).filter(Boolean).map(l=>({
    id:l.id||uid('pl'),
    name:cleanStr(l.name),
    type:cleanStr(l.type)||'other',
    parentId:l.parentId||'',
    distance:l.distance==null?'':String(l.distance),
    notes:cleanStr(l.notes)
  })).filter(l=>l.name && !seen.has(l.name.toLowerCase()) && seen.add(l.name.toLowerCase()));
  for(const n of (S.hostPhysicalLocations||[])) if(cleanStr(n) && !S.physicalLocations.some(l=>l.name.toLowerCase()===cleanStr(n).toLowerCase())) S.physicalLocations.push({id:uid('pl'),name:cleanStr(n),type:'other',parentId:'',distance:'',notes:''});
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
  let loc=physLocByName(val);
  if(!loc){ loc={id:uid('pl'),name:val,type:meta.type||'other',parentId:meta.parentId||'',distance:meta.distance||'',notes:meta.notes||''}; S.physicalLocations.push(loc); }
  else {
    if(meta.type && (!loc.type || loc.type==='other')) loc.type=meta.type;
    if(meta.parentId && !loc.parentId) loc.parentId=meta.parentId;
    if(meta.distance && !loc.distance) loc.distance=meta.distance;
    if(meta.notes && !loc.notes) loc.notes=meta.notes;
  }
  S.hostPhysicalLocations=S.physicalLocations.map(l=>l.name).sort((a,b)=>a.localeCompare(b,'es',{sensitivity:'base'}));
  return loc;
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
function syncPhysicalLocationsIntoVisual(){
  const V=S.visual||(S.visual={locs:[],assign:{devices:{},hosts:{}},pos:{},view:{px:60,py:50,zoom:1},sel:null});
  if(!Array.isArray(V.locs)) V.locs=[];
  const byName=new Map(V.locs.map(l=>[cleanStr(l.name).toLowerCase(),l]));
  for(const pl of (S.physicalLocations||[])){
    const name=cleanStr(pl.name); if(!name) continue;
    const key=name.toLowerCase();
    if(!byName.has(key)){
      const vl={id:uid('loc'),name,color:'#10233c',x:80+V.locs.length*360,y:90+(V.locs.length%2)*260,type:pl.type||'other',physicalLocationId:pl.id};
      V.locs.push(vl); byName.set(key,vl);
    }else{
      const vl=byName.get(key); vl.physicalLocationId=vl.physicalLocationId||pl.id; vl.type=vl.type||pl.type||'other';
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
    if(t==='!') return 'Separador visual en la configuración.';
    if(/^! /.test(t)) return 'Comentario o cabecera informativa.';
    if(t==='configure terminal') return 'Entra al modo de configuración global.';
    if(t==='end') return 'Sale del modo de configuración.';
    if(t==='write memory') return 'Guarda la configuración en memoria.';
    if(/^hostname\s+/.test(t)) return 'Asigna el nombre del dispositivo.';
    if(/^vlan\s+\d+/.test(t)) return 'Crea o selecciona la VLAN indicada.';
    if(/^name\s+/.test(t)) return 'Asigna un nombre descriptivo a la VLAN.';
    if(/^vtp domain\s+/.test(t)) return 'Define el dominio VTP; todos los switches VTP deben compartirlo.';
    if(/^vtp password\s+/.test(t)) return 'Establece la contraseña VTP común entre switches.';
    if(/^vtp mode\s+server/.test(t)) return 'Este switch actuará como servidor VTP y publicará las VLAN.';
    if(/^vtp mode\s+client/.test(t)) return 'Este switch actuará como cliente VTP y recibirá las VLAN del servidor.';
    if(/^vtp mode\s+transparent/.test(t)) return 'Modo transparente: no aprende VLAN por VTP, pero reenvía anuncios.';
    if(/^vtp version\s+/.test(t)) return 'Fija la versión de VTP usada en el dominio.';
    if(/^vtp pruning/.test(t)) return 'Activa VTP pruning para reducir tráfico innecesario en trunks.';
    if(/^interface\s+/.test(t)) return 'Entra en la configuración de la interfaz indicada.';
    if(/^description\s+/.test(t)) return 'Añade una descripción a la interfaz.';
    if(t==='switchport') return 'Habilita parámetros de capa 2 de switchport.';
    if(t==='switchport nonegotiate') return 'Desactiva DTP para que el trunk no se negocie automáticamente.';
    if(t==='switchport mode access') return 'Configura el puerto como acceso para una única VLAN.';
    if(/^switchport access vlan\s+/.test(t)) return 'Asocia el puerto de acceso a la VLAN indicada.';
    if(t==='switchport mode trunk') return 'Configura el puerto como trunk para transportar varias VLAN.';
    if(/^switchport trunk native vlan\s+/.test(t)) return 'Define la VLAN nativa del trunk.';
    if(/^switchport trunk allowed vlan\s+/.test(t)) return 'Limita las VLAN permitidas por el trunk.';
    if(/^spanning-tree portfast/.test(t)) return 'Acelera la transición del puerto de acceso a forwarding.';
    if(/^spanning-tree bpduguard enable/.test(t)) return 'Protege el puerto apagándolo si recibe BPDUs.';
    if(/^switchport port-security/.test(t)) return 'Activa seguridad de puerto y control de MACs.';
    if(/^ip dhcp snooping/.test(t)) return 'Activa o ajusta DHCP Snooping para proteger frente a servidores DHCP falsos.';
    if(/^ip arp inspection/.test(t)) return 'Activa o ajusta Dynamic ARP Inspection.';
    if(/^ip verify source/.test(t)) return 'Activa IP Source Guard en el puerto.';
    if(/^no shutdown/.test(t)) return 'Habilita administrativamente la interfaz.';
    if(t==='exit') return 'Vuelve al modo de configuración anterior.';
    if(/^encapsulation dot1Q\s+/.test(t)) return 'Etiqueta la subinterfaz con la VLAN indicada para RoaS.';
    if(/^ip address\s+/.test(t)) return 'Asigna dirección IP y máscara a la interfaz.';
    if(/^ip route\s+0\.0\.0\.0/.test(t)) return 'Crea la ruta por defecto hacia el siguiente salto.';
    if(/^ip nat inside source list/.test(t)) return 'Configura NAT overload para salida a Internet.';
    if(/^access-list\s+/.test(t)) return 'Define una ACL o regla usada por NAT/filtrado.';
    if(/^ip dhcp pool\s+/.test(t)) return 'Crea un pool DHCP para la red indicada.';
    if(/^network\s+/.test(t)) return 'Define la red atendida por el pool DHCP.';
    if(/^default-router\s+/.test(t)) return 'Indica la puerta de enlace entregada por DHCP.';
    if(/^dns-server\s+/.test(t)) return 'Define los DNS que dará el servicio DHCP.';
    if(/^lease\s+/.test(t)) return 'Establece la duración de la concesión DHCP.';
    return 'Línea de configuración generada automáticamente.';
  };
  for(const line of lines){
    if(line.trim()) out.push(line+'    ! '+explain(line));
    else out.push('');
  }
  return out.join('\n');
}

// ─────────────────── CONFIG GENERATORS ───────────────────


function l3InterfacesForDevice(d){
  if(NWL3 && typeof NWL3.collectDeviceL3Interfaces==='function') return NWL3.collectDeviceL3Interfaces(S, d.id);
  return portsByDev(d.id).filter(p=>p.l3Ip&&p.l3Cidr).map(p=>({portId:p.id,portName:p.name,ip:p.l3Ip,cidr:p.l3Cidr,mask:'',prefix:null,description:p.desc||''}));
}
function l3ByPortId(d){
  const m={};
  for(const item of l3InterfacesForDevice(d)) m[item.portId]=item;
  return m;
}
function l3Desc(item, fallback){
  const auto=(NWL3 && typeof NWL3.peerDescription==='function') ? NWL3.peerDescription(item) : '';
  return cliText(fallback || auto || 'Transit L3', 160);
}
function ciscoL3Lines(item){
  const out=[];
  if(item && item.description) out.push(` description ${cliText(item.description,160)}`);
  else if(item) out.push(` description ${l3Desc(item)}`);
  if(item && item.ip && item.mask) out.push(` ip address ${item.ip} ${item.mask}`);
  else if(item && item.ip && item.cidr){
    const ci=parseCidr(item.cidr); if(ci) out.push(` ip address ${item.ip} ${msk(ci.mask)}`);
  }
  return out;
}


function staticRoutesForDevice(d){
  if(NWR && typeof NWR.inferStaticRoutes==='function') return NWR.inferStaticRoutes(S, d.id);
  return [];
}
function ciscoStaticRouteLines(d){
  const routes=staticRoutesForDevice(d);
  if(!routes.length)return [];
  const out=['!','! Rutas estáticas inferidas desde enlaces de tránsito L3'];
  for(const r of routes){
    if(r.network && r.mask && r.nextHop) out.push(`ip route ${r.network} ${r.mask} ${r.nextHop} ! ${cliText(r.reason||'',80)}`);
  }
  return out;
}
function asaStaticRouteLines(d){
  const routes=staticRoutesForDevice(d);
  if(!routes.length)return [];
  const out=['!','! Rutas estáticas inferidas desde enlaces de tránsito L3'];
  for(const r of routes){
    if(r.network && r.mask && r.nextHop) out.push(`route ${cliToken(r.outPortName||'outside','outside',64)} ${r.network} ${r.mask} ${r.nextHop} 1 ! ${cliText(r.reason||'',80)}`);
  }
  return out;
}
function juniperStaticRouteLines(d){
  const routes=staticRoutesForDevice(d);
  const out=[];
  for(const r of routes){ if(r.destination && r.nextHop) out.push(`set routing-options static route ${r.destination} next-hop ${r.nextHop}`); }
  return out;
}
function fortigateStaticRouteBlocks(d){
  const routes=staticRoutesForDevice(d);
  const out=[];let idx=1;
  for(const r of routes){
    if(!r.network || !r.mask || !r.nextHop) continue;
    out.push(`config router static`,` edit ${idx++}`,`  set dst ${r.network} ${r.mask}`,`  set gateway ${r.nextHop}`, r.outPortName?`  set device "${cliQuoted(r.outPortName,64)}"`:'', r.peerDeviceName?`  set comment "${cliQuoted('Inferida hacia '+r.peerDeviceName,120)}"`:'',' next','end','');
  }
  return out;
}

function allFirewallRules(){
  if(window.NetWizardPolicyUtils && typeof window.NetWizardPolicyUtils.mergeWithManualRules==='function') return window.NetWizardPolicyUtils.mergeWithManualRules(S);
  return S.fwRules || [];
}
function policyRulesForExport(){
  const rules=allFirewallRules().filter(x=>x.enabled!==false).sort((a,b)=>(a.prio||100)-(b.prio||100));
  if(window.NetWizardPolicyUtils && typeof window.NetWizardPolicyUtils.enrichPolicyRules==='function') return window.NetWizardPolicyUtils.enrichPolicyRules(S,rules);
  return rules;
}
function policyAddressObjectsForExport(rules){
  if(window.NetWizardPolicyUtils && typeof window.NetWizardPolicyUtils.buildAddressObjects==='function') return window.NetWizardPolicyUtils.buildAddressObjects(S,rules||policyRulesForExport());
  return [];
}
function asaAddressObjectLines(rules){
  const out=[]; const objs=policyAddressObjectsForExport(rules);
  if(!objs.length)return out;
  out.push('!','! Objetos de red derivados de VLANs/políticas');
  for(const o of objs){
    out.push(`object network ${cliToken(o.name,'OBJ',60)}`);
    if(o.type==='host'&&o.ip) out.push(` host ${o.ip}`);
    else if(o.subnet&&o.mask) out.push(` subnet ${o.subnet} ${o.mask}`);
    if(o.label) out.push(` description ${cliText(o.label,120)}`);
    out.push(' exit');
  }
  return out;
}
function asaEndpoint(a){
  if(!a||a.kind==='any'||a.raw==='any')return'any';
  if(a.objectName&&a.kind!=='label')return`object ${cliToken(a.objectName,'OBJ',60)}`;
  if(a.kind==='host'&&a.ip)return`host ${a.ip}`;
  return cliText(a.raw||'any',120);
}
function splitPorts(port){return String(port||'any').split(',').map(x=>x.trim()).filter(Boolean);}
function fortigateAddressObjectLines(rules){
  const objs=policyAddressObjectsForExport(rules); const out=[]; if(!objs.length)return out;
  out.push('# Objetos de red derivados de VLANs/políticas');
  for(const o of objs){
    out.push('config firewall address',` edit "${cliQuoted(o.name,60)}"`);
    if(o.type==='host'&&o.ip) out.push(`  set subnet ${o.ip} 255.255.255.255`);
    else if(o.subnet&&o.mask) out.push(`  set subnet ${o.subnet} ${o.mask}`);
    if(o.label) out.push(`  set comment "${cliQuoted(o.label,120)}"`);
    out.push(' next','end','');
  }
  return out;
}
function fortigateZoneLines(){
  if(!window.NetWizardPolicyUtils||typeof window.NetWizardPolicyUtils.buildPolicyContext!=='function')return[];
  const ctx=window.NetWizardPolicyUtils.buildPolicyContext(S); const out=[];
  for(const z of ctx.zones||[]){ if(!z.interfaces||!z.interfaces.length)continue; out.push('config system zone',` edit "${cliQuoted(z.name,60)}"`,`  set interface ${z.interfaces.map(x=>'"'+cliQuoted(x,60)+'"').join(' ')}`,' next','end',''); }
  return out;
}
function fortigateServiceList(r){
  if(r.serviceNames&&r.serviceNames.length)return r.serviceNames.map(x=>'"'+cliQuoted(x,50)+'"').join(' ');
  if(r.proto==='any'||!r.proto)return'"ALL"';
  if(r.proto==='tcp'&&String(r.port)==='80,443')return'"HTTP" "HTTPS"';
  return '"ALL"';
}
function pfsensePolicyContextComments(){
  if(!window.NetWizardPolicyUtils||typeof window.NetWizardPolicyUtils.summarizePolicyContext!=='function')return[];
  return ['', '# Objetos y zonas derivados de VLANs:', ...window.NetWizardPolicyUtils.summarizePolicyContext(S).split('\n').map(l=>'# '+l)];
}

function pfsenseStaticRouteComments(d){
  const routes=staticRoutesForDevice(d);
  if(!routes.length)return [];
  const out=['','# Rutas estáticas inferidas (System → Routing → Static Routes):'];
  for(const r of routes) out.push(`# ${r.destination} via ${r.nextHop}${r.outPortName?' dev '+r.outPortName:''}${r.peerDeviceName?'  # '+r.peerDeviceName:''}`);
  return out;
}

// Cisco IOS Switch
function genCiscoSwitch(d){
  const L=['!',`! ${'═'.repeat(40)}`,`! ${cliText(d.name,80)}  —  Cisco IOS Switch`,`! ${'═'.repeat(40)}`,'configure terminal',`hostname ${cliToken(d.name,'device')}`,'!','! VLANs'];
  const vtp=S.vtp||{};
  const vtpRole=getVtpRole(d.id);
  if(vtpRole!=='off' && (vtp.domain||vtp.password||vtp.version||vtp.pruning==='yes')){
    L.push('!','! VTP');
    if(vtp.domain)L.push(`vtp domain ${cliToken(vtp.domain,'VTP_DOMAIN',64)}`);
    if(vtp.password)L.push(`vtp password ${cliText(vtp.password,64)}`);
    L.push(`vtp mode ${vtpRole}`);
    if(vtp.version)L.push(`vtp version ${vtp.version}`);
    if(vtp.pruning==='yes')L.push('vtp pruning');
  }
  for(const v of S.vlans.slice().sort((a,b)=>a.vlanId-b.vlanId)){
    if(vtpRole==='client') continue;
    L.push(`vlan ${v.vlanId}`);if(v.name)L.push(` name ${cliText(v.name,32)}`);L.push('exit');
  }
  const sec=S.security;
  if(sec.ds==='yes'){const sv=(sec.dsV||'').trim()||S.vlans.map(v=>v.vlanId).join(',');L.push('!','! DHCP Snooping','ip dhcp snooping');if(sv)L.push(`ip dhcp snooping vlan ${sv}`);L.push('no ip dhcp snooping information option');}
  if(sec.dai==='yes'&&S.vlans.length){L.push('!','! DAI',`ip arp inspection vlan ${S.vlans.map(v=>v.vlanId).join(',')}`);}
  const ports=portsByDev(d.id).slice().sort((a,b)=>(a.position??9999)-(b.position??9999)||(a.name.localeCompare(b.name)));
  const l3Map=l3ByPortId(d);
  if(ports.length){L.push('!','! Interfaces');
    for(const p of ports){
      const l3=l3Map[p.id];
      L.push(`interface ${p.name}`);
      if(p.mode==='routed' || l3){
        L.push(' no switchport');
        L.push(...ciscoL3Lines(l3 || {description:p.desc, ip:p.l3Ip||p.routedIp, cidr:p.l3Cidr||p.routedCidr}));
        L.push(' no shutdown',' exit');
        continue;
      }
      if(p.desc)L.push(` description ${cliText(p.desc,160)}`);
      const connH=S.hosts.filter(h=>h.portRef===p.id);
      if(connH.length)L.push(`! Hosts: ${connH.map(h=>`${h.name}${h.staticIp?' ('+h.staticIp+')':''}`).join(', ')}`);
      L.push(' switchport',' switchport nonegotiate');
      if(p.mode==='access'){
        const v=vByRef(p.accessVlanRef);
        L.push(' switchport mode access');
        if(v)L.push(` switchport access vlan ${v.vlanId}`);
        if(sec.bpdu==='yes'){L.push(' spanning-tree portfast',' spanning-tree bpduguard enable');}
        if(sec.ps==='yes'){L.push(' switchport port-security',' switchport port-security maximum 2',' switchport port-security violation restrict',' switchport port-security mac-address sticky');}
        if(sec.ds==='yes')L.push(' no ip dhcp snooping trust');
        if(sec.dai==='yes')L.push(' no ip arp inspection trust');
        if(sec.ipsg==='yes')L.push(' ip verify source');
      }else if(p.mode==='trunk'){
        L.push(' switchport mode trunk');
        const nv=vByRef(p.nativeVlanRef);if(nv)L.push(` switchport trunk native vlan ${nv.vlanId}`);
        const al=(p.allowedVlans||[]).slice().sort((a,b)=>a-b);if(al.length)L.push(` switchport trunk allowed vlan ${al.join(',')}`);
        if(sec.ds==='yes')L.push(' ip dhcp snooping trust');
        if(sec.dai==='yes')L.push(' ip arp inspection trust');
      }
      L.push(' no shutdown',' exit');
    }
  }
  L.push(...ciscoStaticRouteLines(d));
  L.push('end','write memory','!');
  return L.join('\n')+'\n';
}

// Cisco IOS Router
function genCiscoRouter(d){
  const L=['!',`! ${'═'.repeat(40)}`,`! ${cliText(d.name,80)}  —  Cisco IOS Router/Firewall`,`! ${'═'.repeat(40)}`,'configure terminal',`hostname ${cliToken(d.name,'device')}`];
  const ifs=portsByDev(d.id).slice().sort((a,b)=>a.name.localeCompare(b.name));
  const l3Map=l3ByPortId(d);
  if(ifs.length){L.push('!','! Interfaces físicas');for(const p of ifs){const l3=l3Map[p.id];L.push(`interface ${p.name}`);if(p.desc && !l3)L.push(` description ${cliText(p.desc,160)}`);if(l3)L.push(...ciscoL3Lines(l3));L.push(' no shutdown',' exit');}}
  if(S.roas.gwId===d.id){
    const lanIf=(S.roas.lanIf||'').trim();
    if(lanIf){
      L.push('!','! RoaS — subinterfaces VLAN',`interface ${lanIf}`,' no ip address',' no shutdown',' exit');
      for(const v of S.vlans.slice().sort((a,b)=>a.vlanId-b.vlanId)){
        const sn=snByVRef(v.id);if(!sn?.gateway)continue;
        const ci=parseCidr(sn.cidr);const mask=ci?msk(ci.mask):'255.255.255.0';
        L.push(`interface ${lanIf}.${v.vlanId}`,` encapsulation dot1Q ${v.vlanId}${S.roas.natVRef===v.id?' native':''}`);
        L.push(` description GW_VLAN${v.vlanId}_${cliToken(v.name||'VLAN', 'VLAN', 32)}`,` ip address ${sn.gateway} ${mask}`,' ip nat inside',' no shutdown',' exit');
      }
    }
    // DHCP
    const dhL=[];
    for(const v of S.vlans.slice().sort((a,b)=>a.vlanId-b.vlanId)){
      const rawCfg=S.dhcp[String(v.vlanId)];
      const cfg=window.NetWizardDhcpUtils?window.NetWizardDhcpUtils.normalizeDhcpConfig(rawCfg):rawCfg;
      if(!cfg?.enabled)continue;
      const sn=snByVRef(v.id);if(!sn)continue;
      const ci=parseCidr(sn.cidr);if(!ci?.fh)continue;
      const exclusions=window.NetWizardDhcpUtils?window.NetWizardDhcpUtils.excludedRangesForCisco(S,v,cfg):[];
      if(exclusions.length){
        for(const ex of exclusions){
          if(ex.start===ex.end)dhL.push(`ip dhcp excluded-address ${ex.start}`);
          else dhL.push(`ip dhcp excluded-address ${ex.start} ${ex.end}`);
        }
      }else{
        if(sn.gateway)dhL.push(`ip dhcp excluded-address ${sn.gateway}`);
        for(const h of S.hosts.filter(hx=>hx.vlanRef===v.id&&hx.ipMode==='static'&&hx.staticIp))dhL.push(`ip dhcp excluded-address ${h.staticIp} ! ${cliText(h.name,80)}`);
      }
      dhL.push(`ip dhcp pool VLAN${v.vlanId}`,` network ${ip4s(ci.net)} ${msk(ci.mask)}`);
      if(sn.gateway)dhL.push(` default-router ${sn.gateway}`);
      const dns=(cfg.dns||'').trim();if(dns)dhL.push(` dns-server ${dns.replace(/,/g,' ')}`);
      if(cfg.domain)dhL.push(` domain-name ${cliText(cfg.domain,120)}`);
      dhL.push(` lease ${cfg.lease||1}`,' exit');
    }
    if(dhL.length)L.push('!','! DHCP Pools',...dhL);
    // WAN + NAT
    const wanCidr=(S.roas.wanCidr||'').trim();const nh=(S.roas.wanNh||'').trim();const wanIf=(d.wanIf||'').trim();
    if(d.internetEdge==='yes'&&wanIf&&wanCidr){const ci=parseCidr(wanCidr);if(ci)L.push('!','! WAN',`interface ${wanIf}`,` ip address ${ip4s(ci.ip)} ${msk(ci.mask)}`,' ip nat outside',' no shutdown',' exit');}
    if(d.internetEdge==='yes'&&nh)L.push('!','! Default route',`ip route 0.0.0.0 0.0.0.0 ${nh}`);
    if(d.internetEdge==='yes'&&wanIf)L.push('!','! NAT overload','access-list 100 permit ip any any',`ip nat inside source list 100 interface ${wanIf} overload`);
    // Static hosts table
    const stH=S.hosts.filter(h=>h.ipMode==='static'&&h.staticIp);
    if(stH.length){L.push('!','! Hosts con IP estática (para referencia)');for(const h of stH){const v=vByRef(h.vlanRef);L.push(`! ${cliText(h.name,24).padEnd(24)} ${(h.staticIp||'').padEnd(15)} VLAN:${v?.vlanId||'?'} MAC:${cliText(h.mac||'-',32)}`);}
    }
    // FW ACLs
    const fwAcl=genFwAcl();if(fwAcl)L.push('',fwAcl);
  }
  L.push(...ciscoStaticRouteLines(d));
  L.push('end','write memory','!');
  return L.join('\n')+'\n';
}

// Cisco ASA
function genCiscoAsa(d){
  const L=['!',`! ${cliText(d.name,80)}  —  Cisco ASA`,'!',`hostname ${cliToken(d.name,'device')}`,'!'];
  for(const v of S.vlans.slice().sort((a,b)=>a.vlanId-b.vlanId)){
    const sn=snByVRef(v.id);
    L.push(`interface GigabitEthernet0/0.${v.vlanId}`,` vlan ${v.vlanId}`,` nameif vlan${v.vlanId}`,` security-level 100`,sn?.gateway?` ip address ${sn.gateway} ${parseCidr(sn.cidr)?msk(parseCidr(sn.cidr).mask):'255.255.255.0'}`:'',` no shutdown`,' exit');
  }
  L.push('! WAN',`interface GigabitEthernet0/0`,' nameif outside',' security-level 0');
  if(S.roas.wanCidr){const ci=parseCidr(S.roas.wanCidr);if(ci)L.push(` ip address ${ip4s(ci.ip)} ${msk(ci.mask)}`);}
  L.push(' no shutdown',' exit');
  const prules=policyRulesForExport();
  L.push('!','! NAT','object network OBJ_ANY',' subnet 0.0.0.0 0.0.0.0',' nat (inside,outside) dynamic interface');
  L.push(...asaAddressObjectLines(prules));
  L.push('!','! ACLs derivadas de reglas manuales e intención VLAN');
  for(const r of prules){
    const act=r.action==='deny'?'deny':'permit';
    const proto=r.proto==='any'?'ip':(r.proto==='tcp_udp'?'tcp':r.proto||'ip');
    const ports=(r.port&&r.port!=='any')?splitPorts(r.port):[''];
    for(const pp of ports){
      L.push(`access-list OUTSIDE_IN extended ${act} ${proto} ${asaEndpoint(r.srcResolved)} ${asaEndpoint(r.dstResolved)}${pp?' eq '+cliText(pp,30):''} ! ${cliText(r.name||'',80)}`);
      if(r.proto==='tcp_udp') L.push(`access-list OUTSIDE_IN extended ${act} udp ${asaEndpoint(r.srcResolved)} ${asaEndpoint(r.dstResolved)}${pp?' eq '+cliText(pp,30):''} ! ${cliText(r.name||'',80)} [UDP]`);
    }
  }
  L.push(...asaStaticRouteLines(d));
  L.push('access-group OUTSIDE_IN in interface outside','write memory','!');
  return L.join('\n')+'\n';
}

// Juniper Junos
function genJuniper(d){
  const sJn=v=>(v.name||`VLAN${v.vlanId}`).replace(/[^A-Za-z0-9_-]/g,'_');
  const L=[`# ${'═'.repeat(40)}`,`# ${cliText(d.name,80)}  —  Juniper Junos`,`# ${'═'.repeat(40)}`,''];
  for(const v of S.vlans.slice().sort((a,b)=>a.vlanId-b.vlanId))L.push(`set vlans ${sJn(v)} vlan-id ${v.vlanId}`);
  L.push('');
  if(d.type==='router'&&S.roas.gwId===d.id){
    const lanIf=(S.roas.lanIf||'ge-0/0/0').replace(/\./g,'');
    for(const v of S.vlans.slice().sort((a,b)=>a.vlanId-b.vlanId)){const sn=snByVRef(v.id);if(!sn?.gateway)continue;const ci=parseCidr(sn.cidr);L.push(`set interfaces ${lanIf} unit ${v.vlanId} vlan-id ${v.vlanId}`,`set interfaces ${lanIf} unit ${v.vlanId} family inet address ${sn.gateway}/${ci?.pfx||24}`,'');}
  }
  const l3Map=l3ByPortId(d);
  for(const p of portsByDev(d.id).slice().sort((a,b)=>(a.position??9999)-(b.position??9999))){
    const l3=l3Map[p.id];
    if(l3){
      const desc=l3.description || l3Desc(l3);
      if(desc)L.push(`set interfaces ${p.name} description "${cliQuoted(desc,120)}"`);
      L.push(`set interfaces ${p.name} unit 0 family inet address ${l3.ip}/${l3.prefix || 30}`,'');
      continue;
    }
    L.push(`set interfaces ${p.name} unit 0 family ethernet-switching`);
    if(p.mode==='access'){L.push(`set interfaces ${p.name} unit 0 family ethernet-switching port-mode access`);const v=vByRef(p.accessVlanRef);if(v)L.push(`set interfaces ${p.name} unit 0 family ethernet-switching vlan members ${sJn(v)}`);}
    else if(p.mode==='trunk'){L.push(`set interfaces ${p.name} unit 0 family ethernet-switching port-mode trunk`);for(const vid of(p.allowedVlans||[])){const v=vByNum(vid);L.push(`set interfaces ${p.name} unit 0 family ethernet-switching vlan members ${v?sJn(v):'VLAN'+vid}`);}}
    L.push('');
  }
  const rt=juniperStaticRouteLines(d); if(rt.length)L.push('',...rt);
  return L.join('\n').trimEnd()+'\n';
}

// Aruba AOS-S
function genAruba(d){
  const L=[`hostname "${cliQuoted(d.name,64)}"`,`! ${'═'.repeat(40)} Aruba AOS-S`];
  for(const v of S.vlans.slice().sort((a,b)=>a.vlanId-b.vlanId)){L.push(`vlan ${v.vlanId}`);if(v.name)L.push(` name "${cliQuoted(v.name,64)}"`);L.push('exit','!');}
  for(const p of portsByDev(d.id).slice().sort((a,b)=>(a.position??9999)-(b.position??9999))){
    L.push(`interface ${p.name}`);if(p.desc)L.push(` name "${cliQuoted(p.desc,120)}"`);
    if(p.mode==='access'){const v=vByRef(p.accessVlanRef);L.push(` untagged vlan ${v?v.vlanId:1}`);}
    else if(p.mode==='trunk'){const al=(p.allowedVlans||[]).slice().sort((a,b)=>a-b);if(al.length)L.push(` tagged vlan ${al.join(',')}`);}
    L.push('exit','!');
  }
  return L.join('\n')+'\n';
}

// pfSense
function genPfSense(d){
  const L=[`# ${'═'.repeat(40)}`,`# ${cliText(d.name,80)}  —  pfSense`,`# ${'═'.repeat(40)}`,`# Configurar en GUI: Interfaces → Assignments + VLAN Tags`,''];
  const lanBase=(S.roas.lanIf||'em1').replace(/\.\d+$/,'');
  L.push(`# Interfaz LAN principal: ${lanBase}`);
  for(const v of S.vlans.slice().sort((a,b)=>a.vlanId-b.vlanId)){const sn=snByVRef(v.id);L.push(`# VLAN ${v.vlanId} (${v.name||''}): Parent=${lanBase}  VLAN-ID=${v.vlanId}  GW=${sn?.gateway||'?'}  Subnet=${sn?.cidr||'?'}`);}
  const l3=l3InterfacesForDevice(d);
  if(l3.length){L.push('','# Interfaces L3 de tránsito detectadas:');for(const it of l3)L.push(`# ${it.portName}: ${it.ip}/${it.prefix||'?'}  ${it.peerDeviceName?('↔ '+it.peerDeviceName+' '+(it.peerPortName||'')):''}  ${it.vlanId?('VLAN '+it.vlanId):''}`);}
  L.push(...pfsenseStaticRouteComments(d));
  L.push(...pfsensePolicyContextComments());
  L.push('','# Reglas de firewall (pfSense rules via GUI o config.xml):');
  for(const r of policyRulesForExport())L.push(`# [${String(r.action||'').toUpperCase()}] ${r.srcObject||r.src} (${r.srcZone||'any'}) → ${r.dstObject||r.dst} (${r.dstZone||'any'})  service:${(r.serviceNames||[]).join(',')||r.proto+':'+(r.port||'any')}  | ${r.generatedFromIntent?'[intent] ':''}${r.name||''}`);
  L.push('','# DHCP (Services → DHCP Server, una sección por VLAN):');
  for(const v of S.vlans){
    const cfg=window.NetWizardDhcpUtils?window.NetWizardDhcpUtils.normalizeDhcpConfig(S.dhcp[String(v.vlanId)]):S.dhcp[String(v.vlanId)];
    if(!cfg?.enabled)continue;const sn=snByVRef(v.id);
    L.push(`# VLAN ${v.vlanId}: subnet=${sn?.cidr}  gateway=${sn?.gateway}  range=${cfg.start||'?'}-${cfg.end||'?'}  dns=${cfg.dns||'8.8.8.8'}  lease=${cfg.lease||1}d`);
  }
  return L.join('\n')+'\n';
}

// FortiGate
function genFortigate(d){
  const L=[`# ${'═'.repeat(40)}`,`# ${cliText(d.name,80)}  —  FortiGate`,`# ${'═'.repeat(40)}`,''];
  const lanBase=S.roas.lanIf||'port2';
  const prules=policyRulesForExport();
  L.push(...fortigateAddressObjectLines(prules));
  L.push(...fortigateZoneLines());
  for(const v of S.vlans.slice().sort((a,b)=>a.vlanId-b.vlanId)){
    const sn=snByVRef(v.id);const ci=sn?parseCidr(sn.cidr):null;const mask=ci?msk(ci.mask):'255.255.255.0';
    L.push(`config system interface`,` edit "VLAN${v.vlanId}"`,`  set vdom "root"`,`  set type vlan`,`  set vlanid ${v.vlanId}`,`  set interface "${lanBase}"`,`  set mode static`,`  set ip ${sn?.gateway||'10.0.0.1'} ${mask}`,`  set allowaccess ping ssh`,' next','end','');
  }
  for(const it of l3InterfacesForDevice(d)){
    L.push(`config system interface`,` edit "${it.portName}"`,`  set vdom "root"`,`  set mode static`,`  set ip ${it.ip} ${it.mask || '255.255.255.252'}`,`  set allowaccess ping ssh`, it.peerDeviceName?`  set description "${cliQuoted(l3Desc(it),120)}"`:'',' next','end','');
  }
  let dhId=1;
  for(const v of S.vlans.slice().sort((a,b)=>a.vlanId-b.vlanId)){
    const cfg=window.NetWizardDhcpUtils?window.NetWizardDhcpUtils.normalizeDhcpConfig(S.dhcp[String(v.vlanId)]):S.dhcp[String(v.vlanId)];
    const sn=snByVRef(v.id);const ci=sn?parseCidr(sn.cidr):null;
    if(!cfg?.enabled||!sn||!ci||!cfg.start||!cfg.end)continue;
    L.push(`config system dhcp server`,` edit ${dhId++}`,`  set interface "VLAN${v.vlanId}"`,`  set default-gateway ${sn.gateway||ip4s(ci.fh||ci.net)}`,`  set netmask ${msk(ci.mask)}`,`  set lease-time ${(cfg.lease||1)*86400}`);
    if(cfg.dns)L.push(`  set dns-server1 ${String(cfg.dns).split(',')[0].trim()}`);
    L.push(`  config ip-range`,`   edit 1`,`    set start-ip ${cfg.start}`,`    set end-ip ${cfg.end}`,`   next`,`  end`,` next`,`end`,'');
  }
  L.push(...fortigateStaticRouteBlocks(d));
  let pnum=1;
  for(const r of prules){
    const act=r.action==='deny'?'deny':'accept';
    L.push(`config firewall policy`,` edit ${pnum++}`,`  set name "${cliQuoted(r.name||'rule'+pnum,80)}"`,`  set srcintf "${cliQuoted(r.srcZone&&r.srcZone!=='any'?'ZONE_'+String(r.srcZone).toUpperCase():(r.srcInterface||'any'),60)}"`,`  set dstintf "${cliQuoted(r.dstZone&&r.dstZone!=='any'?'ZONE_'+String(r.dstZone).toUpperCase():(r.dstInterface||'any'),60)}"`,`  set srcaddr "${cliQuoted(r.srcObject==='all'?'all':(r.srcObject||r.src||'all'),60)}"`,`  set dstaddr "${cliQuoted(r.dstObject==='all'?'all':(r.dstObject||r.dst||'all'),60)}"`,`  set action ${act}`,`  set service ${fortigateServiceList(r)}`,`  set logtraffic all`,' next','end','');
  }
  return L.join('\n')+'\n';
}

// Windows Server (static IP config)
function genWindowsServer(d){
  const L=[`# ${'═'.repeat(40)}`,`# ${cliText(d.name,80)}  —  Windows Server / Windows 10+`,`# PowerShell commands`,`# ${'═'.repeat(40)}`,''];
  // Find hosts of type server
  const servers=S.hosts.filter(h=>h.type==='server'&&h.staticIp);
  if(servers.length){
    for(const h of servers){
      const v=vByRef(h.vlanRef);const sn=snByVRef(h.vlanRef);const ci=sn?parseCidr(sn.cidr):null;
      L.push(`# Host: ${cliText(h.name,80)}${v?' (VLAN '+v.vlanId+')':''}`,`$adapter = Get-NetAdapter | Select-Object -First 1`);
      if(h.staticIp){L.push(`New-NetIPAddress -InterfaceIndex $adapter.ifIndex \\`,`    -IPAddress "${h.staticIp}" \\`,`    -PrefixLength ${ci?.pfx||24} \\`,`    -DefaultGateway "${sn?.gateway||'10.0.0.1'}"`);
      L.push(`Set-DnsClientServerAddress -InterfaceIndex $adapter.ifIndex \\`,`    -ServerAddresses "8.8.8.8","8.8.4.4"`);}
      L.push('# Firewall rules (PowerShell):',`New-NetFirewallRule -DisplayName "${cliQuoted(h.name,60)} HTTP" -Direction Inbound -Protocol TCP -LocalPort 80,443 -Action Allow`,'');
    }
  } else {
    L.push('# No hay servidores con IP estática definidos.');
    L.push('# Ejemplo de configuración estática (PowerShell):','');
    L.push('$adapter = Get-NetAdapter | Where-Object {$_.Status -eq "Up"} | Select-Object -First 1','New-NetIPAddress -InterfaceIndex $adapter.ifIndex \\','    -IPAddress "10.10.10.10" \\','    -PrefixLength 24 \\','    -DefaultGateway "10.10.10.1"','Set-DnsClientServerAddress -InterfaceIndex $adapter.ifIndex \\','    -ServerAddresses "8.8.8.8","8.8.4.4"');
  }
  L.push('','# Unir al dominio (si aplica):','# Add-Computer -DomainName "miempresa.local" -Restart','','# Habilitar RDP:','Set-ItemProperty -Path "HKLM:\\System\\CurrentControlSet\\Control\\Terminal Server" -Name "fDenyTSConnections" -Value 0','Enable-NetFirewallRule -DisplayGroup "Remote Desktop"');
  return L.join('\n')+'\n';
}

// Linux (ip addr / systemd-networkd / iptables)
function genLinux(d){
  const L=[`# ${'═'.repeat(40)}`,`# ${cliText(d.name,80)}  —  Linux (Ubuntu/Debian/RHEL)`,`# ${'═'.repeat(40)}`,''];
  const servers=S.hosts.filter(h=>(h.type==='server'||h.type==='ap')&&h.staticIp);
  if(servers.length){
    for(const h of servers){
      const v=vByRef(h.vlanRef);const sn=snByVRef(h.vlanRef);const ci=sn?parseCidr(sn.cidr):null;
      L.push(`# Host: ${cliText(h.name,80)}${v?' — VLAN '+v.vlanId:''}`,`# ── ip command (temporal) ──`);
      if(h.staticIp)L.push(`ip addr add ${h.staticIp}/${ci?.pfx||24} dev eth0`,`ip route add default via ${sn?.gateway||'10.0.0.1'}`);
      L.push('','# ── /etc/network/interfaces (Debian/Ubuntu) ──','auto eth0','iface eth0 inet static',`    address ${h.staticIp||'10.0.0.10'}/${ci?.pfx||24}`,`    gateway ${sn?.gateway||'10.0.0.1'}`,`    dns-nameservers 8.8.8.8 8.8.4.4`,'');
      L.push('# ── systemd-networkd (/etc/systemd/network/10-eth0.network) ──','[Match]','Name=eth0','','[Network]',`Address=${h.staticIp||'10.0.0.10'}/${ci?.pfx||24}`,`Gateway=${sn?.gateway||'10.0.0.1'}`,'DNS=8.8.8.8','','systemctl restart systemd-networkd','');
    }
  } else {
    L.push('# No hay servidores Linux definidos. Ejemplo genérico:','');
    L.push('# Configurar IP estática:','ip addr add 10.10.10.10/24 dev eth0','ip route add default via 10.10.10.1','','# Configuración permanente (/etc/netplan/01-netcfg.yaml):','network:','  version: 2','  ethernets:','    eth0:','      addresses: [10.10.10.10/24]','      routes:','        - to: default','          via: 10.10.10.1','      nameservers:','        addresses: [8.8.8.8]','','netplan apply','');
  }
  // iptables for FW rules
  if(S.fwRules.length){
    L.push('# ── iptables / nftables (firewall) ──','iptables -F  # limpiar reglas','iptables -P INPUT DROP','iptables -P FORWARD DROP','iptables -P OUTPUT ACCEPT','iptables -A INPUT -m state --state ESTABLISHED,RELATED -j ACCEPT','iptables -A INPUT -i lo -j ACCEPT');
    for(const r of allFirewallRules().filter(x=>x.enabled!==false&&x.action!=='deny').sort((a,b)=>(a.prio||100)-(b.prio||100))){
      const proto=r.proto==='any'?'':` -p ${r.proto}`;const port=r.port&&r.port!=='any'?` --dport ${r.port.split(',')[0]}`:'';
      L.push(`iptables -A INPUT${proto}${port} -j ACCEPT  # ${cliText(r.name||'',80)}`);
    }
    L.push('iptables-save > /etc/iptables/rules.v4');
  }
  return L.join('\n')+'\n';
}

// FW ACL (Cisco)


// =========================================================
// 04.1 ACLS, MATRIZ E INFORMES DE EXPORTACIÓN
// Generación de ACLs, matriz inter-VLAN, CSV de hosts y selector de configuración final.
// =========================================================
function genFwAcl(){
  const rules=policyRulesForExport();
  if(!rules.length)return'';
  const L=['!','! FW Policy ACL','ip access-list extended FW_POLICY'];
  for(const r of rules){
    const action=r.action==='deny'?'deny':'permit';
    const proto=r.proto==='any'?'ip':(r.proto==='tcp_udp'?null:r.proto);
    const srcA=r.src==='any'?'any':r.src.includes('/')?formatWild(r.src):`host ${r.src}`;
    const dstA=r.dst==='any'?'any':r.dst.includes('/')?formatWild(r.dst):`host ${r.dst}`;
    const ports=(r.port&&r.port!=='any')?splitPorts(r.port):[''];
    for(const pp of ports){
      const port=pp?` eq ${pp}`:'';
      if(proto){L.push(` ${action} ${proto} ${srcA} ${dstA}${port}${r.action==='log'?' log':''} ! ${cliText(r.name||'',80)}`);}
      else{L.push(` ${action} tcp ${srcA} ${dstA}${port} ! ${cliText(r.name||'',80)} [TCP]`);L.push(` ${action} udp ${srcA} ${dstA}${port} ! ${cliText(r.name||'',80)} [UDP]`);}
    }
  }
  L.push(' deny ip any any log ! Implicit deny');
  return L.join('\n');
}
function formatWild(cidr){const c=parseCidr(cidr);if(!c)return cidr;return`${ip4s(c.net)} ${ip4s(~c.mask>>>0)}`;}

// genVlanMatrixAcl
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

// HOST CSV
function genHostCsv(){
  const rows=['Nombre,Tipo,VLAN,IP,MAC,Puerto,Notas'];
  for(const h of S.hosts){const v=vByRef(h.vlanRef);const p=h.portRef?S.ports.find(x=>x.id===h.portRef):null;const pd=p?devById(p.deviceId):null;rows.push([h.name,HT[h.type]?.l||h.type,v?v.vlanId+' '+v.name:'',h.ipMode==='static'?h.staticIp||'':'DHCP',h.mac||'',p?(pd?.name+':'+p.name):'',h.notes||''].map(x=>`"${(x||'').replace(/"/g,'""')}"`).join(','));}
  return rows.join('\n');
}

// MAIN CONFIG DISPATCH
function genConfig(devId,format){
  const d=devById(devId);if(!d)return'';
  const vo=format||d.vendorOs;
  if(vo==='cisco_ios')return d.type==='switch'?genCiscoSwitch(d):genCiscoRouter(d);
  if(vo==='cisco_asa')return genCiscoAsa(d);
  if(vo==='juniper_junos')return genJuniper(d);
  if(vo==='aruba_aoss')return genAruba(d);
  if(vo==='pfsense')return genPfSense(d);
  if(vo==='fortinet')return genFortigate(d);
  if(vo==='windows')return genWindowsServer(d);
  if(vo==='linux')return genLinux(d);
  return`! Sin vendor asignado: ${d.name}\n`;
}

// ─────────────────── NAVIGATION ───────────────────


// =========================================================
// 05. NAVEGACIÓN, DASHBOARD Y ASISTENTE
// Cambio de pantallas, panel principal y asistente automático de escenarios.
// =========================================================
function navTo(step){S.step=step;save();refresh();}

$('hbg').onclick=()=>{$('sb').classList.toggle('open');document.body.classList.toggle('ov');};
document.addEventListener('click',e=>{if($('sb').classList.contains('open')&&!$('sb').contains(e.target)&&!$('hbg').contains(e.target)){$('sb').classList.remove('open');document.body.classList.remove('ov');}});
document.querySelectorAll('.sb-it[data-step]').forEach(el=>el.onclick=()=>{navTo(el.dataset.step);$('sb').classList.remove('open');document.body.classList.remove('ov');});
document.querySelectorAll('.bnit[data-step]').forEach(el=>el.onclick=()=>navTo(el.dataset.step));

const stepIdx=s=>STEP_ORDER.indexOf(s);
$('prevBtn').onclick=()=>{const i=stepIdx(S.step);if(i>0)navTo(STEP_ORDER[i-1]);};
$('nextBtn').onclick=()=>{const i=stepIdx(S.step);if(i<STEP_ORDER.length-1)navTo(STEP_ORDER[i+1]);else alert((window.NetWizardI18n?window.NetWizardI18n.t('msg.projectComplete'): '¡Proyecto completo! Exporta en la sección Config.'));};

// TABS
document.querySelectorAll('.tab[data-tab]').forEach(btn=>btn.onclick=()=>{
  const bar=btn.parentElement;
  bar.querySelectorAll('.tab').forEach(b=>b.classList.remove('on'));
  btn.classList.add('on');
  const id=btn.dataset.tab;
  const pg=btn.closest('.pg')||document;
  pg.querySelectorAll('.tc').forEach(tc=>tc.classList.toggle('on',tc.id===id));
});

// ─────────────────── RENDER NAV ───────────────────
function renderNav(){
  document.querySelectorAll('.sb-it[data-step]').forEach(el=>el.classList.toggle('on',S.step===el.dataset.step));
  document.querySelectorAll('.bnit[data-step]').forEach(el=>el.classList.toggle('on',S.step===el.dataset.step));
  document.querySelectorAll('.pg').forEach(pg=>pg.classList.remove('on'));
  const pg=$(`pg-${S.step}`);if(pg)pg.classList.add('on');
  const noFt=['dash','wiz'];
  $('navFt').style.display=noFt.includes(S.step)?'none':'flex';
  const i=stepIdx(S.step);
  $('prevBtn').disabled=i<=0;
  $('nextBtn').textContent=i>=STEP_ORDER.length-1?'Finalizar':'Siguiente →';
  const setSide=(id,count,label)=>{const el=$(id); if(!el)return; clearNode(el); const b=document.createElement('b'); b.textContent=String(count); el.append(b,document.createTextNode(` ${label}`));};
  setSide('sbD',S.devices.length,'dispositivos');
  setSide('sbV',S.vlans.length,'VLANs');
  setSide('sbH',S.hosts.length,'hosts');
  if($('sbIOT')){
    const iotState=window.NetWizardIoTEmbedded&&window.NetWizardIoTEmbedded.getState?window.NetWizardIoTEmbedded.getState():null;
    const iotCount=iotState?(iotState.accessNodes.length+iotState.devices.length):0;
    setSide('sbIOT',iotCount,'IoT');
  }
  setSide('sbFW',S.fwRules.length,'reglas FW');
  if(S.step==='iot'&&window.NetWizardIoTEmbedded&&window.NetWizardIoTEmbedded.render){setTimeout(window.NetWizardIoTEmbedded.render,0);}
  if(S.step==='graphs')setTimeout(()=>{drawTopo();resizeV5();renderV5Panel();},50);
}

// ─────────────────── DASHBOARD ───────────────────
function renderDash(){
  $('projLbl').textContent=S.projName||'Sin título';
  $('projName').value=S.projName||'';

  const stats=$('dStats'); clearNode(stats);
  [
    ['var(--ac)', S.devices.length, 'Dispositivos'],
    ['var(--gn)', S.vlans.length, 'VLANs'],
    ['var(--yw)', S.hosts.length, 'Hosts'],
    ['var(--pu)', S.fwRules.length, 'Reglas FW']
  ].forEach(([color,value,label])=>{
    const stat=makeEl('div','stat'); stat.style.borderTopColor=color;
    const sv=makeEl('div','sv',value); sv.style.color=color;
    const sl=makeEl('div','sl',label);
    stat.append(sv,sl); stats.appendChild(stat);
  });

  const dDevs=$('dDevs'); clearNode(dDevs);
  if(S.devices.length){
    const wrap=makeEl('div','tw'); const table=document.createElement('table');
    const thead=document.createElement('thead'); const hr=document.createElement('tr');
    ['Nombre','Tipo','Vendor','Pts'].forEach(t=>hr.appendChild(makeEl('th','',t))); thead.appendChild(hr); table.appendChild(thead);
    const tbody=document.createElement('tbody');
    S.devices.forEach(d=>{
      const tr=document.createElement('tr');
      const tdName=document.createElement('td'); const b=document.createElement('b'); b.textContent=d.name||''; tdName.appendChild(b); tr.appendChild(tdName);
      const tdType=document.createElement('td'); const sp=makeEl('span',`dtype dtype-${(d.type||'xx').slice(0,2)}`); sp.textContent=`${d.type==='switch'?'🔀':d.type==='router'?'🌐':'🛡'} ${d.type||''}`; tdType.appendChild(sp); tr.appendChild(tdType);
      const tdVendor=document.createElement('td'); tdVendor.appendChild(makeEl('span','b bac',d.vendorOs||'-')); tr.appendChild(tdVendor);
      tr.appendChild(makeEl('td','',portsByDev(d.id).length));
      tbody.appendChild(tr);
    });
    table.appendChild(tbody); wrap.appendChild(table); dDevs.appendChild(wrap);
  } else dDevs.appendChild(makeEmpty('🖥','Sin dispositivos.\nUsa el Asistente para empezar.'));

  const dVlans=$('dVlans'); clearNode(dVlans);
  if(S.vlans.length){
    S.vlans.slice().sort((a,b)=>a.vlanId-b.vlanId).forEach(v=>{
      const sn=snByVRef(v.id); const hc=S.hosts.filter(h=>h.vlanRef===v.id).length;
      const row=makeEl('div','hrow'); const dot=makeEl('span','vd'); dot.style.background=v.color||vColor(v.id);
      const info=makeEl('div','hinfo'); info.append(makeEl('div','hn',`VLAN ${v.vlanId} — ${v.name||''}`), makeEl('div','hm',`${sn?sn.cidr:'Sin subnet'} · ${hc} hosts`));
      row.append(dot,info); if(sn) row.appendChild(makeEl('span','b bgn mono',sn.gateway||'')); dVlans.appendChild(row);
    });
  } else dVlans.appendChild(makeEmpty('🏷','Sin VLANs'));

  const dHosts=$('dHosts'); clearNode(dHosts);
  let anyHosts=false;
  S.vlans.slice().sort((a,b)=>a.vlanId-b.vlanId).forEach(v=>{
    const hosts=S.hosts.filter(h=>h.vlanRef===v.id); if(!hosts.length) return; anyHosts=true;
    const block=document.createElement('div'); block.style.marginBottom='11px';
    const title=document.createElement('div'); title.style.fontSize='12px'; title.style.fontWeight='700'; title.style.marginBottom='5px'; title.style.display='flex'; title.style.alignItems='center'; title.style.gap='5px';
    const dot=makeEl('span','vd'); dot.style.background=v.color||vColor(v.id); title.append(dot, document.createTextNode(`VLAN ${v.vlanId} — ${v.name||''} `), makeEl('span','b bgr',hosts.length)); block.appendChild(title);
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
    table.appendChild(tbody); wrap.appendChild(table); block.appendChild(wrap); dHosts.appendChild(block);
  });
  if(!anyHosts) dHosts.appendChild(makeEmpty('💻','Sin hosts'));
}
$('saveProj').onclick=()=>{S.projName=($('projName').value||'').trim();save();$('projLbl').textContent=S.projName||'Sin título';};

// ─────────────────── WIZARD ───────────────────
let wScene=null;const wDevSel=new Set();
function renderWizard(){
  const grid=$('scGrid'); clearNode(grid);
  SCENARIOS.forEach(sc=>{
    const card=makeEl('div',`sccard${wScene===sc.id?' on':''}`); card.dataset.sc=sc.id;
    card.append(makeEl('div','scico',sc.ico), makeEl('div','scn',sc.name), makeEl('div','scd',sc.desc));
    card.addEventListener('click',()=>{wScene=card.dataset.sc;document.querySelectorAll('.sccard').forEach(c=>c.classList.remove('on'));card.classList.add('on');$('wStep2Card').style.display='';renderDevPicker();updateWizPreview();});
    grid.appendChild(card);
  });
  renderDevPicker();
}
function renderDevPicker(){
  const root=$('devPicker'); clearNode(root);
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
$('wNext2').onclick=()=>{$('wStep2Card').style.display='none';$('wStep3Card').style.display='';updateWizPreview();};
$('wBack1').onclick=()=>{$('wStep2Card').style.display='none';};
$('wBack2').onclick=()=>{$('wStep3Card').style.display='none';$('wStep2Card').style.display='';};
['wBase','wSize'].forEach(id=>{$(id).oninput=updateWizPreview;});

$('wApply').onclick=()=>{
  if(!wScene)return alert('Selecciona un escenario.');
  const sc=SCENARIOS.find(x=>x.id===wScene);
  const base=$('wBase').value||'10.10.0.0/16';const szPfx=parseInt($('wSize').value)||24;
  const fwN=($('wFwN').value||'FW-EDGE-01').trim();const swN=($('wSwN').value||'SW-CORE-01').trim();
  const secLevel=$('wSec').value;
  if(!confirm(`¿Aplicar escenario "${sc.name}"? Se añadirá al proyecto actual.`))return;
  const bCidr=parseCidr(base);const step=2**(32-szPfx);let snIdx=0;
  // Devices
  let fwId=null,swId=null;
  const addDev=(name,type,vo,edge,wanIf)=>{if(S.devices.some(d=>d.name===name))return S.devices.find(d=>d.name===name).id;const id=uid('dev');S.devices.push({id,name,type,vendorOs:vo,mgmtIp:null,notes:sc.name,internetEdge:edge||'no',wanIf:wanIf||null,layout:null});S.topo.pos[id]={x:100+Math.random()*500,y:80+Math.random()*240};return id;};
  if(wDevSel.has('fw')||wDevSel.has('router')||sc.id!=='custom'){fwId=addDev(fwN,wDevSel.has('fw')?'firewall':'router','cisco_ios','yes','GigabitEthernet0/0');S.ports.push({id:uid('port'),deviceId:fwId,name:'GigabitEthernet0/1',media:'GE',mode:'trunk',accessVlanRef:null,nativeVlanRef:null,allowedVlans:[],desc:'LAN trunk',position:null,role:'lan'});S.ports.push({id:uid('port'),deviceId:fwId,name:'GigabitEthernet0/0',media:'GE',mode:'routed',accessVlanRef:null,nativeVlanRef:null,allowedVlans:[],desc:'WAN',position:null,role:'wan'});}
  if(wDevSel.has('coreSw')||sc.id!=='custom'){swId=addDev(swN,'switch','cisco_ios');}
  if(wDevSel.has('accSw')&&swId){const id2=addDev('SW-ACC-01','switch','cisco_ios');S.topo.pos[id2]={x:200,y:320};}
  // Servers
  if(wDevSel.has('server')){const srvId=addDev('SRV-01','switch','cisco_ios');/* Servers are hosts, but also can be devices */}
  // VLANs
  for(const vd of sc.vlans){
    if(S.vlans.some(v=>v.vlanId===vd.id))continue;
    const vRef=uid('vlan');
    S.vlans.push({id:vRef,vlanId:vd.id,name:vd.n,color:vd.c});
    if(bCidr){const net=(bCidr.net+snIdx*step)>>>0;const cidr=`${ip4s(net)}/${szPfx}`;const ci=parseCidr(cidr);const gw=ci?.fh?ip4s(ci.fh):null;S.subnets.push({id:uid('sn'),vlanRef:vRef,cidr,gateway:gw});}
    snIdx++;
  }
  // Hosts from picker
  const hostVlan=S.vlans[0]?.id||null;
  if(wDevSel.has('server')&&S.vlans.find(v=>v.name==='Servidores'||v.name==='Backend'||v.name==='DB')){const sv=S.vlans.find(v=>v.name==='Servidores'||v.name==='Backend');if(sv){const sn=snByVRef(sv.id);const ci=sn?parseCidr(sn.cidr):null;const ip=ci?.fh?ip4s(ci.fh+1):null;S.hosts.push({id:uid('h'),name:'SRV-Web',type:'server',vlanRef:sv.id,ipMode:'static',staticIp:ip,mac:null,portRef:null,notes:'Generado por asistente'});}}
  if(wDevSel.has('camera')){const cv=S.vlans.find(v=>v.name==='Cámaras')||S.vlans[0];if(cv)S.hosts.push({id:uid('h'),name:'CAM-01',type:'camera',vlanRef:cv?.id||null,ipMode:'dhcp',staticIp:null,mac:null,portRef:null,notes:'Generado por asistente'});}
  if(wDevSel.has('ap')){const wv=S.vlans.find(v=>v.name==='WiFi'||v.name.includes('WiFi'))||S.vlans[0];if(wv)S.hosts.push({id:uid('h'),name:'AP-01',type:'ap',vlanRef:wv?.id||null,ipMode:'dhcp',staticIp:null,mac:null,portRef:null,notes:'Generado por asistente'});}
  if(wDevSel.has('printer')){const uv=S.vlans.find(v=>v.name==='Usuarios'||v.name==='Empleados')||S.vlans[0];if(uv)S.hosts.push({id:uid('h'),name:'PRINTER-01',type:'printer',vlanRef:uv?.id||null,ipMode:'dhcp',staticIp:null,mac:null,portRef:null,notes:'Generado por asistente'});}
  if(wDevSel.has('phone')){const vv=S.vlans[0];if(vv)S.hosts.push({id:uid('h'),name:'PHONE-01',type:'phone',vlanRef:vv?.id||null,ipMode:'dhcp',staticIp:null,mac:null,portRef:null,notes:'Generado por asistente'});}
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
$('devType').onchange=()=>{const t=$('devType').value;$('devEdgeSec').style.display=(t==='router'||t==='firewall')?'':'none';};
if($('devModel')) $('devModel').oninput=()=>renderDeviceModelHint();
if($('btnApplyModelCaps')) $('btnApplyModelCaps').onclick=()=>applyDeviceModelToForm();



// =========================================================
// 05.1 CATÁLOGO DE MODELOS Y CAPACIDADES
// Catálogo local inicial. Sirve para autocompletar modelos, marcar AP/router Wi‑Fi
// y generar puertos aproximados sin borrar configuración existente.
// =========================================================
const DEVICE_MODEL_CATALOG={
  'Cisco ISR 1121-8P':{vendorOs:'cisco_ios',type:'router',ports:[['GigabitEthernet0/0/0','wan'],['GigabitEthernet0/0/1','lan'],['GigabitEthernet0/1/0','lan'],['GigabitEthernet0/1/1','lan'],['GigabitEthernet0/1/2','lan'],['GigabitEthernet0/1/3','lan'],['GigabitEthernet0/1/4','lan'],['GigabitEthernet0/1/5','lan'],['GigabitEthernet0/1/6','lan'],['GigabitEthernet0/1/7','lan']],wifi:false,notes:'ISR branch router con variante de 8 puertos LAN.'},
  'Cisco ISR 1121-4P':{vendorOs:'cisco_ios',type:'router',ports:[['GigabitEthernet0/0/0','wan'],['GigabitEthernet0/0/1','lan'],['GigabitEthernet0/1/0','lan'],['GigabitEthernet0/1/1','lan'],['GigabitEthernet0/1/2','lan'],['GigabitEthernet0/1/3','lan']],wifi:false,notes:'ISR branch router con variante de 4 puertos LAN.'},
  'Cisco 886VAW':{vendorOs:'cisco_ios',type:'router',ports:[['FastEthernet0','lan'],['FastEthernet1','lan'],['FastEthernet2','lan'],['FastEthernet3','lan'],['Vlan1','lan'],['ATM0','wan']],wifi:true,wifiStandards:['802.11n'],wifiRole:'integrated_router_wifi',notes:'Router ISR 880 con WLAN integrada según variante.'},
  'Cisco IR1800':{vendorOs:'cisco_ios',type:'router',ports:[['GigabitEthernet0/0','wan'],['GigabitEthernet0/1','lan'],['Cellular0/1/0','wan']],wifi:true,wifiStandards:['Wi‑Fi 6 opcional'],wifiRole:'integrated_router_wifi',notes:'Router industrial con opciones 5G/LTE/Wi‑Fi según módulo.'},
  'UniFi U6 Pro':{vendorOs:'ubiquiti_unifi',type:'switch',ports:[['eth0','trunk']],wifi:true,wifiStandards:['Wi‑Fi 6'],wifiRole:'ap',notes:'AP Wi‑Fi 6. Uplink normalmente trunk hacia VLANs de SSID y gestión.'},
  'UniFi U7 Pro':{vendorOs:'ubiquiti_unifi',type:'switch',ports:[['eth0','trunk']],wifi:true,wifiStandards:['Wi‑Fi 7'],wifiRole:'ap',notes:'AP Wi‑Fi 7. Uplink trunk recomendado para múltiples SSID/VLAN.'},
  'Huawei AP generic':{vendorOs:'huawei_vrp',type:'switch',ports:[['GE0/0/1','trunk']],wifi:true,wifiStandards:['Wi‑Fi'],wifiRole:'ap',notes:'AP Huawei gestionado por controlador/AC o cloud según modelo.'},
  'Galgus AP generic':{vendorOs:'galgus_cloud',type:'switch',ports:[['eth0','trunk']],wifi:true,wifiStandards:['Wi‑Fi'],wifiRole:'ap',notes:'AP Galgus gestionado por plataforma/cloud.'},
  'TP-Link Omada AP generic':{vendorOs:'tplink_omada',type:'switch',ports:[['eth0','trunk']],wifi:true,wifiStandards:['Wi‑Fi'],wifiRole:'ap',notes:'AP Omada con SSID/VLAN desde controlador.'},
  'MikroTik hAP ax3':{vendorOs:'mikrotik_routeros',type:'router',ports:[['ether1','wan'],['ether2','lan'],['ether3','lan'],['ether4','lan'],['ether5','lan']],wifi:true,wifiStandards:['Wi‑Fi 6'],wifiRole:'integrated_router_wifi',notes:'Router con Wi‑Fi integrado y puertos Ethernet.'}
};
function modelKeyByName(name){const n=cleanStr(name).toLowerCase();return Object.keys(DEVICE_MODEL_CATALOG).find(k=>k.toLowerCase()===n)||'';}
function selectedDeviceModel(){const key=modelKeyByName($('devModel')?.value||'');return key?DEVICE_MODEL_CATALOG[key]:null;}
function initDeviceModelList(){
  const dl=$('devModelList'); if(!dl)return; clearNode(dl);
  Object.keys(DEVICE_MODEL_CATALOG).forEach(k=>dl.appendChild(makeOption(k,'')));
}
function renderDeviceModelHint(){
  const hint=$('devModelHint');if(!hint)return;const m=selectedDeviceModel();
  clearNode(hint);
  if(!m){hint.style.display='none';return;}
  hint.style.display='';
  const b=document.createElement('b'); b.textContent=$('devModel').value||''; hint.appendChild(b); hint.appendChild(document.createElement('br'));
  appendText(hint,`Tipo sugerido: ${m.type} · Vendor: ${m.vendorOs||'—'} · Puertos plantilla: ${m.ports?.length||0} · Wi‑Fi/AP: ${m.wifi?((m.wifiStandards||[]).join(', ')||'sí'):'no'}`);
  hint.appendChild(document.createElement('br')); appendText(hint,m.notes||'');
}
function applyDeviceModelToForm(){const key=modelKeyByName($('devModel')?.value||'');if(!key)return alert('Selecciona un modelo del catálogo o escribe uno y guárdalo como texto libre.');const m=DEVICE_MODEL_CATALOG[key];if(m.vendorOs)$('devVendor').value=m.vendorOs;if(m.type)$('devType').value=m.type;if($('devWifiRole'))$('devWifiRole').value=m.wifiRole||'none';$('devType').dispatchEvent(new Event('change'));renderDeviceModelHint();}
function ensurePortsFromModel(deviceId){const d=devById(deviceId);if(!d||!d.model)return 0;const key=modelKeyByName(d.model);const m=key?DEVICE_MODEL_CATALOG[key]:null;if(!m||!Array.isArray(m.ports))return 0;let added=0;for(const [name,role] of m.ports){if(S.ports.some(p=>p.deviceId===deviceId&&cleanStr(p.name).toLowerCase()===cleanStr(name).toLowerCase()))continue;const isSwitch=d.type==='switch';S.ports.push({id:uid('port'),deviceId,name,media:name.toLowerCase().includes('fast')?'FE':'GE',mode:isSwitch?(role==='trunk'?'trunk':'access'):(role==='wan'?'routed':'routed'),accessVlanRef:null,nativeVlanRef:null,allowedVlans:role==='trunk'?S.vlans.map(v=>v.vlanId):[],desc:m.wifiRole==='ap'?'Uplink AP / SSID VLANs':null,position:S.ports.filter(p=>p.deviceId===deviceId).length+1,role:role||null});added++;}return added;}

// =========================================================
// 06. DISPOSITIVOS
// Alta, edición, borrado y renderizado de dispositivos de infraestructura.
// =========================================================
function clearDevForm(){ $('devEditId').value=''; $('devName').value='';$('devMgmt').value='';$('devNotes').value='';$('devVendor').value=''; if($('devModel'))$('devModel').value=''; if($('devWifiRole'))$('devWifiRole').value='none'; $('devType').value='switch';$('devEdge').value='no';$('devWanIf').value='';$('btnAddDev').textContent='➕ Añadir dispositivo';$('btnCancelDevEdit').style.display='none';$('devEdgeSec').style.display='none'; renderDeviceModelHint(); }
function startDevEdit(id){ const d=devById(id); if(!d)return; $('devEditId').value=id; $('devName').value=d.name||''; $('devType').value=d.type||'switch'; $('devVendor').value=d.vendorOs||''; if($('devModel'))$('devModel').value=d.model||''; if($('devWifiRole'))$('devWifiRole').value=d.wifiRole||'none'; $('devMgmt').value=d.mgmtIp||''; $('devNotes').value=d.notes||''; $('devEdge').value=d.internetEdge||'no'; $('devWanIf').value=d.wanIf||''; $('devEdgeSec').style.display=(d.type==='switch')?'none':''; renderDeviceModelHint(); $('btnAddDev').textContent='💾 Guardar cambios'; $('btnCancelDevEdit').style.display=''; navTo('dev'); window.scrollTo({top:0,behavior:'smooth'}); }
$('btnCancelDevEdit').onclick=()=>clearDevForm();
$('btnAddDev').onclick=()=>{
  const name=($('devName').value||'').trim();const type=$('devType').value;const vendor=($('devVendor').value||'').trim()||null;const mgmt=($('devMgmt').value||'').trim()||null;const notes=($('devNotes').value||'').trim()||null;const model=($('devModel')?.value||'').trim()||null;const wifiRole=($('devWifiRole')?.value||'none');const edge=type==='switch'?'no':$('devEdge').value;const wanIf=type==='switch'?null:(($('devWanIf').value||'').trim()||null);
  const eid=$('devEditId').value||null;
  if(!name)return alert('Nombre requerido.');if(mgmt&&parseIp(mgmt)===null)return alert('IP de gestión inválida.');
  if(type!=='switch'&&edge==='yes'){const exists=S.devices.some(d=>d.id!==eid&&(d.type==='router'||d.type==='firewall')&&d.internetEdge==='yes');if(exists)return alert('Ya existe otro dispositivo marcado como Internet Edge.');}
  if(eid){
    const d=devById(eid); if(!d)return alert('No se encontró el dispositivo a editar.');
    Object.assign(d,{name,type,vendorOs:vendor,mgmtIp:mgmt,notes,model,wifiRole,hasWifi:wifiRole!=='none',internetEdge:edge,wanIf});
    ensurePortsFromModel(eid);
  }else{
    const id=uid('dev');
    S.devices.push({id,name,type,vendorOs:vendor,mgmtIp:mgmt,notes,model,wifiRole,hasWifi:wifiRole!=='none',internetEdge:edge,wanIf,layout:null});
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
    const p=document.createElement('p'); p.append('Sin dispositivos.'); p.appendChild(document.createElement('br')); p.append('Añade uno o usa el ⚡ Asistente.');
    empty.append(icon,p); el.appendChild(empty); return;
  }
  const devices=S.devices.slice(); const dsort=S.uiSort.devices||{key:'name',dir:1};
  devices.sort((a,b)=>{let av='',bv=''; switch(dsort.key){case 'type': av=a.type; bv=b.type; break; case 'vendor': av=a.vendorOs||''; bv=b.vendorOs||''; break; case 'model': av=a.model||''; bv=b.model||''; break; case 'edge': av=a.internetEdge==='yes'?1:0; bv=b.internetEdge==='yes'?1:0; break; case 'ports': av=portsByDev(a.id).length; bv=portsByDev(b.id).length; break; default: av=a.name; bv=b.name;} return dsort.dir*cmpMixed(av,bv);});
  const wrap=document.createElement('div'); wrap.className='tw';
  const table=document.createElement('table'); const thead=document.createElement('thead'); const trh=document.createElement('tr');
  [['name','Nombre'],['type','Tipo'],['vendor','Vendor'],['model','Modelo'],['edge','IE'],['ports','Pts']].forEach(([k,l])=>trh.appendChild(createSortTh('devices',k,l)));
  trh.appendChild(document.createElement('th')); thead.appendChild(trh); table.appendChild(thead);
  const tbody=document.createElement('tbody');
  devices.forEach(d=>{
    const tr=document.createElement('tr');
    const tdName=document.createElement('td'); const b=document.createElement('b'); b.textContent=d.name||''; tdName.appendChild(b);
    if(d.notes){ const hint=document.createElement('div'); hint.className='hint'; hint.textContent=String(d.notes).substring(0,28); tdName.appendChild(hint); }
    tr.appendChild(tdName);

    const tdType=document.createElement('td'); const typeBadge=document.createElement('span');
    const type=(d.type==='router'||d.type==='firewall'||d.type==='switch')?d.type:'switch';
    typeBadge.className='dtype dtype-'+(type==='switch'?'sw':type==='router'?'rt':'fw');
    typeBadge.textContent=(type==='switch'?'🔀 ':type==='router'?'🌐 ':'🛡 ')+(d.type||'');
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
    S.hosts=S.hosts.map(h=>{if(pids.includes(h.portRef))h.portRef=null;return h;});
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
function updatePortL2Wrap(){
  const role = $('pRole') ? $('pRole').value : '';
  const isSwitch = devById($('pDev')?.value)?.type === 'switch';
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
  const all=S.devices.slice().sort((a,b)=>a.name.localeCompare(b.name));
  setOptions($('pDev'),all.map(d=>makeOption(d.id,`${d.name||''} (${d.type||''})`)),'— añade un dispositivo primero —');
  setOptions($('portFiltDev'),[makeOption('','Todos'), ...all.map(d=>makeOption(d.id,d.name||''))]);
  updatePortRoleOpts();
}

function updatePortRoleOpts(){
  const devId=$('pDev').value;const d=devById(devId);
  const isRF=!d||d.type!=='switch';
  const role=$('pRole'); clearNode(role);
  if(!isRF){
    role.append(makeOption('access','access (usuario/host)'),makeOption('trunk','trunk (uplink/RoaS)'));
  } else {
    role.append(makeOption('lan','LAN (trunk a switches)'),makeOption('wan','WAN (hacia ISP)'),makeOption('routed','routed (L3 directo)'));
  }
  updatePortL2Wrap();
  if(d){$('pName').placeholder=d.vendorOs==='juniper_junos'?'ge-0/0/0':d.vendorOs==='aruba_aoss'?'1/1/1':d.type==='switch'?'GigabitEthernet0/1':'GigabitEthernet0/0';}
  $('pHint').textContent=!d?'':`Dispositivo: ${d.name} (${d.type}) — vendor: ${d.vendorOs||'sin asignar'}`;
}

$('pDev').onchange=()=>{updatePortRoleOpts();};
$('pRole').onchange=()=>{updatePortL2Wrap();};

function clearPortForm(){ $('portEditId').value=''; $('pName').value=''; $('pDesc').value=''; if($('pAllowedVlans'))$('pAllowedVlans').value=''; if($('pNativeVlan'))$('pNativeVlan').value=''; if($('pUplink'))$('pUplink').value='auto'; if($('pAccessProtection'))$('pAccessProtection').value='default'; $('btnAddPort').textContent='➕ Añadir'; $('btnCancelPortEdit').style.display='none'; $('pHint').textContent=''; $('pHint').className='hint'; updatePortRoleOpts(); }
function startPortEdit(id){ const p=S.ports.find(x=>x.id===id); if(!p)return; const d=devById(p.deviceId); $('portEditId').value=id; $('pDev').value=p.deviceId; updatePortRoleOpts(); $('pName').value=p.name||''; $('pMedia').value=p.media||'GE'; if(d?.type==='switch'){ $('pRole').value=(p.mode==='access'?'access':'trunk'); $('pVlan').value=p.accessVlanRef||''; } else { $('pRole').value=p.role|| (p.mode==='trunk'?'lan':'routed'); } if($('pNativeVlan'))$('pNativeVlan').value=p.nativeVlanRef||''; if($('pAllowedVlans'))$('pAllowedVlans').value=(p.allowedVlans||[]).join(','); if($('pUplink'))$('pUplink').value=boolToSelect(p.uplink); if($('pAccessProtection'))$('pAccessProtection').value=(p.portFast===false&&p.bpduGuard===false)?'off':(p.portFast===true&&p.bpduGuard===true)?'strict':'default'; $('pDesc').value=p.desc||''; $('btnAddPort').textContent='💾 Guardar cambios'; $('btnCancelPortEdit').style.display=''; updatePortL2Wrap(); navTo('ports'); window.scrollTo({top:0,behavior:'smooth'}); }
$('btnCancelPortEdit').onclick=()=>clearPortForm();
$('btnAddPort').onclick=()=>{
  const devId=$('pDev').value;
  if(!devId)return alert('Selecciona un dispositivo primero.');
  const pname=($('pName').value||'').trim();
  if(!pname)return alert('Nombre del puerto requerido.');
  const editId=$('portEditId').value||null;
  if(S.ports.some(p=>p.deviceId===devId&&p.name===pname&&p.id!==editId))return alert(`El puerto "${pname}" ya existe en ese dispositivo.`);
  const d=devById(devId);
  const media=$('pMedia').value;const role=$('pRole').value;
  const vlanRef=$('pVlan').value||null;const desc=($('pDesc').value||'').trim()||null;
  let mode,accessVlanRef=null,allowedVlans=[],nativeVlanRef=null,realRole=role;
  const explicitAllowed=$('pAllowedVlans')?parseAllowed($('pAllowedVlans').value):[];
  const explicitNative=$('pNativeVlan')?($('pNativeVlan').value||null):null;
  if(d.type==='switch'){
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
    const p=S.ports.find(x=>x.id===editId); if(!p)return alert('No se encontró el puerto a editar.');
    Object.assign(p,{deviceId:devId,name:pname,media,mode,accessVlanRef,nativeVlanRef,allowedVlans,desc,role:realRole});
    setBoolField(p,'uplink',up); if(mode!=='access'){delete p.portFast;delete p.bpduGuard;} else { if(!('portFast' in extra))delete p.portFast; if(!('bpduGuard' in extra))delete p.bpduGuard; Object.assign(p,extra); }
  }else{
    S.ports.push(Object.assign({id:uid('port'),deviceId:devId,name:pname,media,mode,accessVlanRef,nativeVlanRef,allowedVlans,desc,position:null,role:realRole},extra));
  }
  clearPortForm(); save();refresh();
  $('pHint').textContent=`✓ Puerto "${pname}" guardado en ${d.name}`;
  $('pHint').className='hint ok';
  setTimeout(()=>{$('pHint').textContent='';$('pHint').className='hint';},2000);
};

$('btnQuick24').onclick=()=>{
  const devId=$('pDev').value;if(!devId)return alert('Selecciona un dispositivo.');
  const d=devById(devId);if(!d)return;if(d.type!=='switch')return alert('Esta función es solo para switches.');
  if(!d.vendorOs)return alert('El dispositivo necesita Vendor/OS asignado.');
  const defVlan=S.vlans[0]?.id||null;let added=0;
  for(let i=1;i<=24;i++){
    const name=buildPName(d.vendorOs,'GE',i,'0/');
    if(!S.ports.some(p=>p.deviceId===devId&&p.name===name)){S.ports.push({id:uid('port'),deviceId:devId,name,media:'GE',mode:'access',accessVlanRef:defVlan,nativeVlanRef:null,allowedVlans:[],desc:null,position:i,role:null});added++;}
  }
  save();refresh();alert(`✓ ${added} puertos GE añadidos a ${d.name}.`);
};

function renderPortsList(){
  const filtDev=$('portFiltDev').value;
  let pts=S.ports.slice(); if(filtDev)pts=pts.filter(p=>p.deviceId===filtDev); const psort=S.uiSort.ports||{key:'device',dir:1}; pts.sort((a,b)=>{const da=devById(a.deviceId),db=devById(b.deviceId),va=vByRef(a.accessVlanRef),vb=vByRef(b.accessVlanRef); let av='',bv=''; switch(psort.key){case 'port': av=a.name; bv=b.name; break; case 'mode': av=a.mode; bv=b.mode; break; case 'info': av=a.mode==='access'?(va?.vlanId||99999):((a.allowedVlans||[]).length); bv=b.mode==='access'?(vb?.vlanId||99999):((b.allowedVlans||[]).length); break; default: av=da?.name||''; bv=db?.name||'';} return psort.dir*cmpMixed(av,bv);});
  const el=$('portsList'); el.textContent='';
  if(!pts.length){
    const empty=document.createElement('div'); empty.className='empty';
    const icon=document.createElement('div'); icon.className='ei'; icon.textContent='🔌';
    const p=document.createElement('p'); p.textContent=S.ports.length?'Cambia el filtro.':'Añade puertos arriba.';
    empty.append(icon,p); el.appendChild(empty); return;
  }
  const wrap=document.createElement('div'); wrap.className='tw'; const table=document.createElement('table');
  const thead=document.createElement('thead'); const trh=document.createElement('tr');
  [['device','Dispositivo'],['port','Puerto'],['mode','Modo'],['info','VLAN/Info']].forEach(([k,l])=>trh.appendChild(createSortTh('ports',k,l)));
  trh.appendChild(document.createElement('th')); thead.appendChild(trh); table.appendChild(thead);
  const tbody=document.createElement('tbody');
  pts.forEach(p=>{
    const d=devById(p.deviceId); const v=vByRef(p.accessVlanRef); const lnk=isLinked(p.id);
    const tr=document.createElement('tr');
    const tdDev=document.createElement('td'); tdDev.appendChild(makeBadge(d?.name||'?','b bgr')); tr.appendChild(tdDev);
    const tdPort=document.createElement('td'); tdPort.className='mono'; const b=document.createElement('b'); b.textContent=p.name||''; tdPort.appendChild(b);
    if(p.desc){ const desc=document.createElement('div'); desc.style.fontSize='9.5px'; desc.style.color='var(--t3)'; desc.textContent=String(p.desc).substring(0,20); tdPort.appendChild(desc); }
    tr.appendChild(tdPort);
    const tdMode=document.createElement('td'); tdMode.appendChild(makeBadge(p.mode||'',`b ${p.mode==='access'?'bgn':p.mode==='trunk'?'byw':'bpu'}`)); tr.appendChild(tdMode);
    const tdInfo=document.createElement('td'); tdInfo.className='mono';
    let info='L3';
    if(p.mode==='access') info=`V${v?.vlanId||'?'}${p.portFast===false?' · PF off':''}${p.bpduGuard===false?' · BPDU off':''}`;
    else if(p.mode==='trunk') info=`${(p.allowedVlans||[]).length}VL${p.nativeVlanRef?` · native V${vByRef(p.nativeVlanRef)?.vlanId||'?'}`:''}${p.uplink===true?' · uplink':''}`;
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
    S.ports=S.ports.filter(p=>p.id!==pid);save();refresh();
  });
}
$('portFiltDev').onchange=()=>renderPortsList();

// ─────────────────── VLANs ───────────────────


// =========================================================
// 08. VLANS Y SUBNETS
// Selectores VLAN, subnetting manual/automático y listados de VLAN/subnets.
// =========================================================
function fillVlanSels(){
  const sorted=S.vlans.slice().sort((a,b)=>a.vlanId-b.vlanId);
  const baseOpts=()=>[makeOption('','(ninguna)'), ...sorted.map(v=>makeOption(v.id,`${v.vlanId} — ${v.name||''}`))];
  ['aNatV','roasNatV','secQV','pmAV','pmNV','lyVlan','pVlan','pNativeVlan','mSnVlan'].forEach(id=>{if($(id))setOptions($(id),baseOpts());});
  setOptions($('hVlan'),[makeOption('','(elige VLAN)'), ...sorted.map(v=>makeOption(v.id,`${v.vlanId} — ${v.name||''}`))]);
  setOptions($('hFiltV'),[makeOption('','Todas'), ...sorted.map(v=>makeOption(v.id,`${v.vlanId} — ${v.name||''}`))]);
}

function updManualSnHint(){
  const ref=$('mSnVlan')?.value||'';
  const hint=$('mSnHint');
  if(!hint)return;
  if(!ref){hint.textContent='Asigna manualmente la red y gateway de cada VLAN. Si la VLAN ya tiene subnet, se actualiza.';return;}
  const v=vByRef(ref);const sn=snByVRef(ref);
  hint.textContent=sn?`Editando VLAN ${v?.vlanId||'—'}: ${sn.cidr} · GW ${sn.gateway||'—'}`:`Nueva subnet manual para VLAN ${v?.vlanId||'—'}.`;
  if(sn){$('mSnCidr').value=sn.cidr||'';$('mSnGw').value=sn.gateway||'';}
}
$('mSnVlan').onchange=updManualSnHint;
$('btnAddManualSn').onclick=()=>{
  const vRef=$('mSnVlan').value||null;
  const cidr=($('mSnCidr').value||'').trim();
  const gateway=($('mSnGw').value||'').trim()||null;
  const ex=snByVRef(vRef);
  const check=validateSubnetAssignment({vlanRef:vRef,cidr,gateway,existingSubnetId:ex?.id||''},S.subnets);
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
  if(!isFinite(vid)||vid<1||vid>4094)return alert('VLAN ID inválida (1-4094).');
  if(S.vlans.some(v=>v.vlanId===vid))return alert('Esa VLAN ya existe.');
  S.vlans.push({id:uid('vlan'),vlanId:vid,name,color});
  $('vId').value='';$('vName').value='';
  for(const p of S.ports){if(p.mode==='trunk'&&!p.allowedVlans.includes(vid)){p.allowedVlans.push(vid);p.allowedVlans.sort((a,b)=>a-b);}}
  save();refresh();
};
$('btnAutoSn').onclick=()=>{
  if(!S.vlans.length)return alert('Crea VLANs primero.');
  const rawBase=($('aBase').value||'').trim()||'10.10.0.0/16';
  const pfx=parseInt($('aSize').value||'24',10);
  const rule=$('aGw').value;
  const info=subnettingExplain(rawBase,pfx,S.vlans.length);
  if(!info.ok)return alert(info.msg+(info.note?`

Nota: ${info.note}`:''));
  const bc=info.ci;
  const step=2**(32-pfx);let c=0;const skipped=[];
  const sortedVlans=S.vlans.slice().sort((a,b)=>a.vlanId-b.vlanId);
  for(let i=0;i<sortedVlans.length;i++){const v=sortedVlans[i];if(S.subnets.some(s=>s.vlanRef===v.id))continue;
    const net=(bc.net+i*step)>>>0;const cidr=`${ip4s(net)}/${pfx}`;const ci=parseCidr(cidr);if(!ci)continue;
    const gw=rule==='last'?(ci.lh?ip4s(ci.lh):null):(ci.fh?ip4s(ci.fh):null);
    const check=validateSubnetAssignment({vlanRef:v.id,cidr,gateway:gw},S.subnets);
    if(!check.ok){skipped.push(`VLAN ${v.vlanId}: ${check.msg}`);continue;}
    S.subnets.push({id:uid('sn'),vlanRef:v.id,cidr:check.cidr,gateway:check.gateway});c++;}
  const nv=$('aNatV').value;if(nv)S.roas.natVRef=nv;save();refresh();
  const msg=[`${c} subnets generadas.`];
  if(info.note)msg.push(info.note);
  if(skipped.length)msg.push('Subnets omitidas por validación:\n'+skipped.join('\n'));
  if(c===0&&!skipped.length)msg.push('No se han creado subnets nuevas porque esas VLANs ya tenían una asignada.');
  alert(msg.join('\n\n'));
};
function renderVlans(){
  const vrows=S.vlans.slice(); const vsort=S.uiSort.vlans||{key:'id',dir:1};
  vrows.sort((a,b)=>vsort.dir*cmpMixed(vsort.key==='name'?a.name:a.vlanId, vsort.key==='name'?b.name:b.vlanId));
  const el=$('vlanList'); el.textContent='';
  if(!S.vlans.length){ const empty=document.createElement('div'); empty.className='empty'; const p=document.createElement('p'); p.textContent='Sin VLANs'; empty.appendChild(p); el.appendChild(empty); return; }
  const wrap=document.createElement('div'); wrap.className='tw'; const table=document.createElement('table');
  const thead=document.createElement('thead'); const trh=document.createElement('tr'); trh.appendChild(document.createElement('th')); trh.appendChild(createSortTh('vlans','id','ID')); trh.appendChild(createSortTh('vlans','name','Nombre')); trh.appendChild(document.createElement('th')); thead.appendChild(trh); table.appendChild(thead);
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
  if(!S.subnets.length){ const empty=document.createElement('div'); empty.className='empty'; const p=document.createElement('p'); p.textContent='Sin subnets. Puedes crearlas manualmente o usar Auto-subnetting.'; empty.appendChild(p); el.appendChild(empty); return; }
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
function updSnHint(){const ref=$('hVlan').value;if(!ref){$('hSnHint').textContent='';return;}const sn=snByVRef(ref);if(!sn){$('hSnHint').textContent='Sin subnet en esta VLAN.';return;}const ci=parseCidr(sn.cidr);$('hSnHint').textContent=`${sn.cidr} · GW: ${sn.gateway||'—'} · Rango: ${ci?.fh?ip4s(ci.fh):'?'}–${ci?.lh?ip4s(ci.lh):'?'}`;}
function hostConnectedDeviceId(h){
  if(h?.connectedDeviceId && devById(h.connectedDeviceId))return h.connectedDeviceId;
  const p=h?.portRef?S.ports.find(x=>x.id===h.portRef):null;
  return p?.deviceId||null;
}
function connectableDevices(){return S.devices.filter(d=>portsByDev(d.id).length>0);}
function hostAssignablePorts(deviceId){
  if(!deviceId)return [];
  const d=devById(deviceId); if(!d) return [];
  const ports=portsByDev(deviceId).slice().sort((a,b)=>(a.position||999)-(b.position||999)||a.name.localeCompare(b.name));
  if(d.type==='switch')return ports.filter(p=>p.mode!=='trunk' && (p.role||'')!=='wan');
  return ports.filter(p=>(p.role||'')!=='wan');
}
function hostPortUsedByOther(portId,excludeHostId){return S.hosts.some(h=>h.id!==excludeHostId&&h.portRef===portId);}
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
  if(!h||!p)return false;
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
    if(d.type==='switch')score+=30;
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
  if(!h||!locId)return {ok:false,reason:'Host o ubicación no encontrados'};
  const loc=vLocById(locId);
  if(loc){
    const pl=loc.physicalLocationId?physLocById(loc.physicalLocationId):null;
    h.physicalLocation=pl?.name||loc.name||h.physicalLocation||'';
  }
  if((h.portAssignMode||'auto')==='manual' && !opts.force)return {ok:false,reason:'Modo manual'};
  const candidates=candidateDevicesForHostLocation(locId);
  for(const d of candidates){
    const pId=suggestHostPort(d.id,h.id,h);
    if(pId && configurePortForHost(pId,h.id)){
      setHostVisualLoc(h.id,locId);
      return {ok:true,deviceId:d.id,portId:pId};
    }
  }
  setHostVisualLoc(h.id,locId);
  return {ok:false,reason:'No hay puertos libres compatibles en esta ubicación'};
}
function fillHostDeviceSel(){
  const opts=[makeOption('','— Sin equipo —'), ...connectableDevices().map(d=>makeOption(d.id,`${d.name||''} · ${d.type||'equipo'}`))];
  setOptions($('hConnDev'),opts);
}
function fillHostPortSel(deviceId,keepValue){
  const devId=deviceId||$('hConnDev').value||'';
  const prev=keepValue!==undefined?keepValue:($('hPort')?.value||'');
  const pts=hostAssignablePorts(devId);
  const curHost=$('hostEditId').value||null;
  setOptions($('hPort'),[makeOption('','Sin puerto asignado'), ...pts.map(p=>makeOption(p.id,`${p.name||''}${hostPortUsedByOther(p.id,curHost)?' · ocupado':''}`))]);
  if(prev && pts.some(p=>p.id===prev))$('hPort').value=prev;
}
function fillHostLocSel(){
  ensureVisualModel();
  setOptions($('hLoc'),[makeOption('','Automática / según equipo'), ...vLocs().map(l=>makeOption(l.id,l.name||''))]);
}
function updateHostDeviceHint(){
  const devId=$('hConnDev').value||'';
  const dev=devId?devById(devId):null;
  const mode=$('hPortMode').value||'auto';
  fillHostPortSel(devId,$('hPort').value||'');
  if(mode==='auto' && devId){
    const suggested=suggestHostPort(devId,$('hostEditId').value||null);
    if(suggested)$('hPort').value=suggested;
  }
  const pid=$('hPort').value||'';
  const p=pid?S.ports.find(x=>x.id===pid):null;
  const finalDev=p?devById(p.deviceId):dev;
  $('hDevHint').value=finalDev?(mode==='auto'?`Auto → ${finalDev.name}${p?` · ${p.name}`:''}`:`Manual → ${finalDev.name}${p?` · ${p.name}`:''}`):'Sin equipo asociado';
  if(finalDev && !$('hLoc').value)$('hLoc').value=deviceVisualLoc(finalDev.id)||'';
}
function clearHostForm(){ $('hostEditId').value=''; $('hName').value='';$('hType').value='pc'; $('hVlan').value=''; $('hIpMode').value='dhcp'; $('hStaticIp').value=''; $('hMac').value=''; $('hPhysLoc').value=''; if($('hPhysLocSel'))$('hPhysLocSel').value=''; $('hNotes').value=''; fillHostDeviceSel(); fillHostLocSel(); $('hConnDev').value=''; $('hPortMode').value='auto'; fillHostPortSel(''); $('hPort').value=''; $('hLoc').value=''; $('hDevHint').value='Sin equipo asociado'; $('hStaticSec').style.display='none'; $('btnAddHost').textContent='➕ Añadir host'; $('btnCancelHostEdit').style.display='none'; $('hSnHint').textContent=''; }
function startHostEdit(id){ const h=S.hosts.find(x=>x.id===id); if(!h)return; $('hostEditId').value=id; fillHostDeviceSel(); fillHostLocSel(); $('hName').value=h.name||''; $('hType').value=h.type||'pc'; $('hVlan').value=h.vlanRef||''; $('hIpMode').value=h.ipMode||'dhcp'; $('hStaticIp').value=h.staticIp||''; $('hMac').value=h.mac||''; $('hPhysLoc').value=h.physicalLocation||''; if($('hPhysLocSel'))$('hPhysLocSel').value=h.physicalLocation||''; $('hNotes').value=h.notes||''; $('hConnDev').value=hostConnectedDeviceId(h)||''; $('hPortMode').value=h.portAssignMode||'auto'; fillHostPortSel($('hConnDev').value,h.portRef||''); $('hPort').value=h.portRef||''; $('hLoc').value=hostVisualLoc(h.id)||''; updateHostDeviceHint(); $('hStaticSec').style.display=(h.ipMode==='static')?'':'none'; updSnHint(); $('btnAddHost').textContent='💾 Guardar cambios'; $('btnCancelHostEdit').style.display=''; navTo('hosts'); window.scrollTo({top:0,behavior:'smooth'}); }
if($('btnCancelPhysLocEdit')) $('btnCancelPhysLocEdit').onclick=()=>clearPhysicalLocationForm();
if($('btnAddPhysLoc')) $('btnAddPhysLoc').onclick=()=>{
  const name=cleanStr($('plName').value); const type=$('plType').value||'other'; const parentId=$('plParent').value||''; const distance=cleanStr($('plDistance').value); const notes=cleanStr($('plNotes').value); const editId=$('plEditId').value||'';
  if(!name) return alert('Nombre de ubicación requerido.');
  if(editId){
    const dup=S.physicalLocations.find(l=>l.id!==editId && l.name.toLowerCase()===name.toLowerCase());
    if(dup) return alert('Ya existe una ubicación con ese nombre.');
    const loc=physLocById(editId); if(!loc) return;
    const oldName=loc.name;
    Object.assign(loc,{name,type,parentId,distance,notes});
    (S.hosts||[]).forEach(h=>{ if(cleanStr(h.physicalLocation).toLowerCase()===oldName.toLowerCase()) h.physicalLocation=name; });
    (S.devices||[]).forEach(d=>{ if(cleanStr(d.physicalLocation).toLowerCase()===oldName.toLowerCase()) d.physicalLocation=name; });
  } else {
    if(physLocByName(name)) return alert('Esa ubicación ya existe.');
    S.physicalLocations.push({id:uid('pl'),name,type,parentId,distance,notes});
  }
  syncPhysicalLocationNames();
  clearPhysicalLocationForm();
  save();
  refresh();
};
$('hPhysLocSel').onchange=()=>applyHostPhysicalLocationSelection();
$('hConnDev').onchange=()=>updateHostDeviceHint();
$('hPortMode').onchange=()=>updateHostDeviceHint();
$('hPort').onchange=()=>updateHostDeviceHint();
$('btnCancelHostEdit').onclick=()=>clearHostForm();
$('btnAddHost').onclick=()=>{
  const name=($('hName').value||'').trim();const type=$('hType').value;const vRef=$('hVlan').value||null;const ipMode=$('hIpMode').value;
  const sip=($('hStaticIp').value||'').trim()||null;const mac=($('hMac').value||'').trim()||null;const editId=$('hostEditId').value||null;
  const connectedDeviceId=$('hConnDev').value||null;const portAssignMode=$('hPortMode').value||'auto';
  let portRef=$('hPort').value||null;const physicalLocation=(($('hPhysLoc').value||$('hPhysLocSel').value||'').trim())||null;const notes=($('hNotes').value||'').trim()||null;
  if(physicalLocation)rememberPhysicalLocation(physicalLocation);
  if(!name)return alert('Nombre requerido.');if(!vRef)return alert('Selecciona VLAN.');
  if(ipMode==='static'){if(!sip)return alert('IP estática requerida.');if(parseIp(sip)===null)return alert('IP inválida.');const sn=snByVRef(vRef);if(sn&&!ipInSn(sip,sn.cidr))return alert(`La IP ${sip} no está en ${sn.cidr}.`);if(S.hosts.some(h=>h.id!==editId&&h.staticIp===sip&&h.vlanRef===vRef))return alert('IP duplicada.');if(snByVRef(vRef)?.gateway===sip)return alert('Esa IP es el gateway.');}
  if(connectedDeviceId && portAssignMode==='auto')portRef=suggestHostPort(connectedDeviceId,editId)||null;
  if(portRef){const port=S.ports.find(p=>p.id===portRef);if(!port)return alert('El puerto seleccionado ya no existe.');if(connectedDeviceId&&port.deviceId!==connectedDeviceId)return alert('El puerto no pertenece al equipo seleccionado.');if(hostPortUsedByOther(portRef,editId))return alert('Ese puerto ya está asociado a otro host.');}
  const locVal=$('hLoc').value||'';
  if(editId){ const h=S.hosts.find(x=>x.id===editId); if(!h)return alert('No se encontró el host a editar.'); Object.assign(h,{name,type,vlanRef:vRef,ipMode,staticIp:sip,mac,portRef,notes,physicalLocation,connectedDeviceId,portAssignMode}); if(locVal)setHostVisualLoc(editId,locVal); else if(connectedDeviceId)setHostVisualLoc(editId,deviceVisualLoc(connectedDeviceId)||hostVisualLoc(editId)||''); }
  else { const id=uid('h'); S.hosts.push({id,name,type,vlanRef:vRef,ipMode,staticIp:sip,mac,portRef,notes,physicalLocation,connectedDeviceId,portAssignMode}); if(locVal)setHostVisualLoc(id,locVal); else if(connectedDeviceId)setHostVisualLoc(id,deviceVisualLoc(connectedDeviceId)||''); }
  clearHostForm(); save();refresh();
};
$('btnBulk').onclick=()=>$('bulkModal').classList.add('on');
$('bulkClose').onclick=$('bulkCancel').onclick=()=>$('bulkModal').classList.remove('on');
$('bulkAdd').onclick=()=>{
  const lines=$('bulkTxt').value.split('\n').map(l=>l.trim()).filter(Boolean);let ok=0,errs=[];
  for(const line of lines){
    const p=line.split(',').map(s=>s.trim());
    if(p.length<3){errs.push(`"${line}": formato inválido`);continue;}
    const [name,typeRaw,vidStr,ipRaw,physicalLocationRaw,visualLocRaw]=p;
    const vid=parseInt(vidStr,10); const v=vByNum(vid);
    if(!v){errs.push(`VLAN ${vidStr} no existe`);continue;}
    const t=Object.keys(HT).includes((typeRaw||'').toLowerCase())?(typeRaw||'').toLowerCase():'iot';
    const im=(ipRaw||'dhcp').toLowerCase()==='dhcp'?'dhcp':'static';
    const sip=im==='static'?(ipRaw||'').trim():null;
    if(im==='static'&&sip&&parseIp(sip)===null){errs.push(`IP inválida: ${sip}`);continue;}
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
  alert(`${ok} hosts añadidos.${errs.length ? ('\nErrores:\n' + errs.join('\n')) : ''}`);
};
$('hFiltV').onchange=$('hFiltT').onchange=renderHosts;
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
function addOption(sel, value, text, selected){ const opt=document.createElement('option'); opt.value=String(value ?? ''); opt.textContent=String(text ?? ''); if(selected)opt.selected=true; sel.appendChild(opt); return opt; }
function renderHosts(){
  const fv=$('hFiltV').value,ft=$('hFiltT').value;
  let hosts=S.hosts.slice();if(fv)hosts=hosts.filter(h=>h.vlanRef===fv);if(ft)hosts=hosts.filter(h=>h.type===ft);
  const sort=S.uiSort.hosts||{key:'name',dir:1};
  hosts.sort((a,b)=>{const va=vByRef(a.vlanRef), vb=vByRef(b.vlanRef), da=devById(hostConnectedDeviceId(a)||''), db=devById(hostConnectedDeviceId(b)||''); const la=vLocById(hostVisualLoc(a.id)||''), lb=vLocById(hostVisualLoc(b.id)||''); let av='',bv=''; switch(sort.key){case 'type': av=HT[a.type]?.l||a.type; bv=HT[b.type]?.l||b.type; break; case 'vlan': av=va?.vlanId||99999; bv=vb?.vlanId||99999; break; case 'ip': av=effectiveHostIp(a); bv=effectiveHostIp(b); break; case 'location': av=la?.name||a.physicalLocation||''; bv=lb?.name||b.physicalLocation||''; break; case 'connection': av=(da?.name||'')+' '+(a.portRef||''); bv=(db?.name||'')+' '+(b.portRef||''); break; default: av=a.name; bv=b.name; } return sort.dir*cmpMixed(av,bv); });
  $('hCnt').textContent=`${S.hosts.length} hosts`;
  const el=$('hostsList');
  el.textContent='';
  if(!hosts.length){
    const empty=document.createElement('div'); empty.className='empty';
    const icon=document.createElement('div'); icon.className='ei'; icon.textContent='💻';
    const p=document.createElement('p'); p.textContent=S.hosts.length?'Sin resultados.':'Añade hosts arriba.';
    empty.append(icon,p); el.appendChild(empty); return;
  }
  const wrap=document.createElement('div'); wrap.className='tw';
  const table=document.createElement('table'); const thead=document.createElement('thead'); const trh=document.createElement('tr');
  [['name','Nombre'],['type','Tipo'],['vlan','VLAN'],['ip','IP'],['location','Ubicación'],['connection','Conexión']].forEach(([k,l])=>trh.appendChild(createSortTh('hosts',k,l)));
  trh.appendChild(document.createElement('th')); thead.appendChild(trh); table.appendChild(thead);
  const tbody=document.createElement('tbody');
  hosts.forEach(h=>{
    const v=vByRef(h.vlanRef); const dev=devById(hostConnectedDeviceId(h)||''); const port=h.portRef?S.ports.find(p=>p.id===h.portRef):null; const loc=vLocById(hostVisualLoc(h.id)||'');
    const tr=document.createElement('tr');
    const tdName=document.createElement('td'); const bName=document.createElement('b'); bName.textContent=h.name||''; const hint=document.createElement('div'); hint.className='hint'; hint.textContent=h.physicalLocation||'—'; tdName.append(bName,hint); tr.appendChild(tdName);
    const tdType=document.createElement('td'); appendText(tdType,`${HT[h.type]?.i||''} ${HT[h.type]?.l||h.type||''}`); tr.appendChild(tdType);
    const tdVlan=document.createElement('td');
    if(v){ const inline=document.createElement('span'); inline.style.display='inline-flex'; inline.style.alignItems='center'; inline.style.gap='3px'; const dot=document.createElement('span'); dot.className='vd'; dot.style.background=v.color||vColor(v.id); inline.appendChild(dot); appendText(inline,`${v.vlanId} ${v.name||''}`); tdVlan.appendChild(inline); }
    else tdVlan.textContent='—';
    tr.appendChild(tdVlan);
    const tdIp=document.createElement('td'); tdIp.className='mono';
    if(h.ipMode==='static') tdIp.appendChild(makeBadge(h.staticIp||'—','b bgn')); else tdIp.appendChild(makeBadge('DHCP','b bac'));
    tr.appendChild(tdIp);
    const tdLoc=document.createElement('td'); appendText(tdLoc,loc?.name||'—'); const locHint=document.createElement('div'); locHint.className='hint'; locHint.textContent=h.physicalLocation||'—'; tdLoc.appendChild(locHint); tr.appendChild(tdLoc);
    const tdConn=document.createElement('td'); const conn=document.createElement('div'); conn.textContent=dev?dev.name:'Sin equipo'; const portHint=document.createElement('div'); portHint.className='hint mono'; portHint.textContent=port?port.name:(h.portAssignMode==='auto'?'Auto':'—'); tdConn.append(conn,portHint); tr.appendChild(tdConn);
    const tdActions=document.createElement('td'); tdActions.style.display='flex'; tdActions.style.gap='4px';
    const edit=document.createElement('button'); edit.className='btn bs bxs'; edit.type='button'; edit.dataset.eh=h.id; edit.textContent='✎';
    const del=document.createElement('button'); del.className='btn bd bxs'; del.type='button'; del.dataset.dh=h.id; del.textContent='🗑';
    tdActions.append(edit,del); tr.appendChild(tdActions);
    tbody.appendChild(tr);
  });
  table.appendChild(tbody); wrap.appendChild(table); el.appendChild(wrap);
  el.querySelectorAll('[data-eh]').forEach(b=>b.onclick=()=>startHostEdit(b.dataset.eh));
  el.querySelectorAll('[data-dh]').forEach(b=>b.onclick=()=>{if(confirm('¿Eliminar host?')){S.hosts=S.hosts.filter(x=>x.id!==b.dataset.dh); delete vv().assign.hosts[b.dataset.dh]; delete vv().pos[b.dataset.dh]; save();refresh();}});
}
function renderIpMap(){
  const el=$('ipMap'); clearNode(el);
  const vlans=S.vlans.slice().sort((a,b)=>a.vlanId-b.vlanId);
  if(!vlans.length){ setSingleHint(el,'Sin VLANs configuradas.'); return; }
  vlans.forEach(v=>{
    const sn=snByVRef(v.id); const hosts=S.hosts.filter(h=>h.vlanRef===v.id); const color=v.color||vColor(v.id);
    const block=document.createElement('div'); block.style.marginBottom='12px';
    const title=document.createElement('div'); title.style.display='flex'; title.style.alignItems='center'; title.style.gap='5px'; title.style.fontSize='12px'; title.style.fontWeight='700'; title.style.marginBottom='4px';
    const dot=makeEl('span','vd'); dot.style.background=color; title.append(dot, document.createTextNode(`VLAN ${v.vlanId} — ${v.name||''} `), makeEl('span','b bgr',hosts.length)); block.appendChild(title);
    if(!sn){ block.appendChild(makeEl('div','hint','Sin subnet.')); el.appendChild(block); return; }
    const ci=parseCidr(sn.cidr); const total=ci?.fh&&ci?.lh?ci.lh-ci.fh+1:0;
    block.appendChild(makeEl('div','mono hint',`${sn.cidr} · GW: ${sn.gateway||'—'} · ${total} disponibles`));
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
  const sw=S.devices.filter(d=>d.type==='switch');
  const opts=sw.map(d=>makeOption(d.id,d.name));
  setOptions($('lyDev'),opts,'Sin switches');
  setOptions($('visDev'),sw.map(d=>makeOption(d.id,d.name)),'Sin switches');
}
function fillLinkPickers(){
  const all=S.ports.slice().sort((a,b)=>portDisp(a).localeCompare(portDisp(b)));
  const opts=all.map(p=>makeOption(p.id,`${portDisp(p)}${isLinked(p.id)?' ⚡':''}`));
  setOptions($('lnkA'),opts,'Sin puertos'); setOptions($('lnkB'),all.map(p=>makeOption(p.id,`${portDisp(p)}${isLinked(p.id)?' ⚡':''}`)),'Sin puertos');
  if($('lnkTransit')){
    const transitVlans=S.vlans.filter(v=>{ const t=(v.intent&&v.intent.type)||''; return t==='transit' || /transit|tránsito|transito|p2p|punto/i.test((v.name||'')+' '+(v.desc||'')); });
    const candidates=transitVlans.length?transitVlans:S.vlans;
    const tOpts=[makeOption('','— sin tránsito L3 —'), ...candidates.map(v=>makeOption(v.id,`VLAN ${v.vlanId} · ${v.name||''}`))];
    setOptions($('lnkTransit'),tOpts);
  }
}
$('lyDev').onchange=()=>{const d=devById($('lyDev').value);if(d?.layout){$('lyTotal').value=d.layout.total||'';$('lyCols').value=d.layout.cols||12;$('lyBase').value=d.layout.base||'';}};
$('btnBuildLy').onclick=()=>{const id=$('lyDev').value;if(!id)return alert('Selecciona un switch.');buildLy(id);};
$('btnApplyLy').onclick=()=>{const id=$('lyDev').value;if(!id)return alert('Selecciona un switch.');applyLy(id);};
function buildLy(devId){
  const d=devById(devId);const el=$('lyEditor'); if(!d){clearNode(el);return;}
  const total=+($('lyTotal').value||0); if(!total){setSingleHint(el,'Indica el total de puertos y pulsa "Ver layout".');return;}
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
  const d=devById(devId);if(!d?.layout?.total)return alert('Configura el layout primero.');
  if(!d.vendorOs)return alert('Añade Vendor/OS al dispositivo.');
  const mode=$('lyMode').value;const defVlan=$('lyVlan').value||S.vlans[0]?.id||null;
  if(mode==='replace'){const old=S.ports.filter(p=>p.deviceId===devId).map(p=>p.id);S.links=S.links.filter(l=>!old.includes(l.aPortId)&&!old.includes(l.bPortId));S.hosts=S.hosts.map(h=>{if(old.includes(h.portRef))h.portRef=null;return h;});S.ports=S.ports.filter(p=>p.deviceId!==devId);}
  for(let i=0;i<d.layout.slots.length;i++){const pos=i+1;const media=d.layout.slots[i];if(media==='EMPTY')continue;const name=buildPName(d.vendorOs,media,pos,d.layout.base);if(mode==='merge'&&S.ports.some(p=>p.deviceId===devId&&p.name===name))continue;S.ports.push({id:uid('port'),deviceId:devId,name,media,mode:'access',accessVlanRef:defVlan,nativeVlanRef:null,allowedVlans:[],desc:null,position:pos,role:null});}
  save();refresh();alert(`✓ Puertos generados para ${d.name}.`);
}
$('visDev').onchange=renderVisPorts;
function portChips(p){
  const frag=document.createDocumentFragment();
  const chip=(txt,css)=>{const sp=makeEl('span','pch',txt); if(css) Object.entries(css).forEach(([k,v])=>sp.style[k]=v); frag.appendChild(sp);};
  chip(p.media||'');
  if(p.mode==='access'){
    const v=vByRef(p.accessVlanRef); chip(v?'V'+v.vlanId:'?',{background:v?(v.color||vColor(v.id)):'var(--s3)',color:v?'#fff':'var(--t3)'});
  } else if(p.mode==='trunk') chip('TRK',{background:'var(--ywd)',color:'var(--yw)'});
  else chip('L3',{background:'var(--pud)',color:'var(--pu)'});
  if(isLinked(p.id)) chip('🔗',{background:'var(--acd)',color:'var(--ac)'});
  const hc=S.hosts.filter(h=>h.portRef===p.id).length; if(hc) chip(`${hc}💻`,{background:'var(--gnd)',color:'var(--gn)'});
  return frag;
}
function renderVisPorts(){
  const devId=$('visDev').value;const grid=$('portGrid');clearNode(grid);
  if(!devId){setSingleHint(grid,'Sin switches.');return;}
  const d=devById(devId);
  if(!d?.layout?.total){setSingleHint(grid,'Este switch no tiene layout. Usa "Layout switch" o añade puertos en la sección Puertos.');return;}
  const pbp=new Map();for(const p of portsByDev(devId))if(p.position)pbp.set(p.position,p);
  for(let pos=1;pos<=d.layout.total;pos++){
    const slot=d.layout.slots?.[pos-1]||'EMPTY';const p=pbp.get(pos)||null;
    const cell=makeEl('div','pport');
    if(slot==='EMPTY'){
      cell.style.opacity='.25'; cell.style.cursor='default'; cell.append(makeEl('div','pn','—'),makeEl('div','pm',`P${pos}`)); grid.appendChild(cell); continue;
    }
    const label=p?.name||buildPName(d.vendorOs,slot,pos,d.layout.base||''); const lnk=p?isLinked(p.id):false;
    cell.className=`pport ${p?p.mode:'access'} ${lnk?'linked':''}`;
    if(p){ cell.dataset.pp=p.id; cell.addEventListener('click',()=>openPortModal(p.id)); }
    cell.appendChild(makeEl('div','pn',label));
    const meta=makeEl('div','pm'); meta.appendChild(document.createTextNode(`${slot} P${pos}`)); if(p?.desc){ meta.appendChild(document.createElement('br')); meta.appendChild(document.createTextNode(String(p.desc).substring(0,16))); } cell.appendChild(meta);
    const chips=makeEl('div','pc'); if(p) chips.appendChild(portChips(p)); cell.appendChild(chips);
    grid.appendChild(cell);
  }
}
function renderLinks(){
  const el=$('linksList');
  el.textContent='';
  if(!S.links.length){const empty=document.createElement('div'); empty.className='empty'; const p=document.createElement('p'); p.textContent='Sin enlaces.'; empty.appendChild(p); el.appendChild(empty); return;}
  const lrows=S.links.slice(); const lsort=S.uiSort.links||{key:'a',dir:1};
  lrows.sort((x,y)=>{const ax=S.ports.find(p=>p.id===x.aPortId), ay=S.ports.find(p=>p.id===y.aPortId), bx=S.ports.find(p=>p.id===x.bPortId), by=S.ports.find(p=>p.id===y.bPortId); let av='',bv=''; switch(lsort.key){case 'b': av=portDisp(bx||{}); bv=portDisp(by||{}); break; case 'notes': av=x.notes||''; bv=y.notes||''; break; default: av=portDisp(ax||{}); bv=portDisp(ay||{});} return lsort.dir*cmpMixed(av,bv);});
  const wrap=document.createElement('div'); wrap.className='tw';
  const table=document.createElement('table'); const thead=document.createElement('thead'); const trh=document.createElement('tr');
  [['a','Puerto A'],['b','Puerto B'],['notes','Notas']].forEach(([k,l])=>trh.appendChild(createSortTh('links',k,l)));
  ['Cableado','Tránsito',''].forEach(l=>{const th=document.createElement('th'); th.textContent=l; trh.appendChild(th);});
  thead.appendChild(trh); table.appendChild(thead);
  const tbody=document.createElement('tbody');
  lrows.forEach(l=>{
    const a=S.ports.find(p=>p.id===l.aPortId), b=S.ports.find(p=>p.id===l.bPortId), v=vByRef(l.transitVlanRef||l.vlanRef||l.l3VlanRef);
    const cab=[l.medium&&l.medium!=='auto'?l.medium:'',l.cableType&&l.cableType!=='auto'?l.cableType:'',l.lengthM?l.lengthM+' m':'',l.speed&&l.speed!=='auto'?l.speed:''].filter(Boolean).join(' · ')||'—';
    const tr=document.createElement('tr');
    const tdA=document.createElement('td'); tdA.className='mono'; tdA.textContent=a?portDisp(a):'?'; if(a&&a.l3Ip){const ip=document.createElement('div'); ip.className='hint mono'; ip.textContent=`${a.l3Ip}/${(a.l3Cidr||'').split('/')[1]||''}`; tdA.appendChild(ip);} tr.appendChild(tdA);
    const tdB=document.createElement('td'); tdB.className='mono'; tdB.textContent=b?portDisp(b):'?'; if(b&&b.l3Ip){const ip=document.createElement('div'); ip.className='hint mono'; ip.textContent=`${b.l3Ip}/${(b.l3Cidr||'').split('/')[1]||''}`; tdB.appendChild(ip);} tr.appendChild(tdB);
    const tdNotes=document.createElement('td'); tdNotes.textContent=l.notes||''; tr.appendChild(tdNotes);
    const tdCab=document.createElement('td'); tdCab.textContent=cab; tr.appendChild(tdCab);
    const tdTransit=document.createElement('td'); if(v)tdTransit.appendChild(makeBadge(`V${v.vlanId}`,'b bpu')); else tdTransit.textContent='—'; tr.appendChild(tdTransit);
    const tdActions=document.createElement('td'); const del=document.createElement('button'); del.className='btn bd bxs'; del.type='button'; del.dataset.dl=l.id; del.textContent='✕'; tdActions.appendChild(del); tr.appendChild(tdActions);
    tbody.appendChild(tr);
  });
  table.appendChild(tbody); wrap.appendChild(table); el.appendChild(wrap);
  el.querySelectorAll('[data-dl]').forEach(btn=>btn.onclick=()=>{S.links=S.links.filter(x=>x.id!==btn.dataset.dl);save();refresh();});
}
$('btnAddLink').onclick=()=>{
  const a=$('lnkA').value,b=$('lnkB').value;const notes=($('lnkNotes').value||'').trim()||null;
  const transitVlanRef=$('lnkTransit')?($('lnkTransit').value||null):null;
  const medium=$('lnkMedium')?($('lnkMedium').value||'auto'):'auto';
  const cableType=$('lnkCableType')?($('lnkCableType').value||'auto'):'auto';
  const lengthRaw=$('lnkLengthM')?$('lnkLengthM').value:'';
  const lengthM=lengthRaw===''?null:Number(lengthRaw);
  const speed=$('lnkSpeed')?($('lnkSpeed').value||'auto'):'auto';
  if(!a||!b)return alert('Selecciona dos puertos.');if(a===b)return alert('Mismo puerto.');
  if(lengthM!==null && (!Number.isFinite(lengthM)||lengthM<0))return alert('La longitud del cable debe ser un número positivo.');
  if(isLinked(a)||isLinked(b))return alert('Uno de los puertos ya está enlazado.');
  S.links.push({id:uid('lnk'),aPortId:a,bPortId:b,notes,transitVlanRef,medium,cableType,lengthM,speed});$('lnkNotes').value=''; if($('lnkTransit'))$('lnkTransit').value=''; if($('lnkLengthM'))$('lnkLengthM').value='';
  // Auto-trunk suggestion
  const pA=S.ports.find(p=>p.id===a),pB=S.ports.find(p=>p.id===b);
  const dA=devById(pA?.deviceId),dB=devById(pB?.deviceId);
  if(dA?.type==='switch'&&dB?.type==='switch'){const tv=S.vlans.map(v=>v.vlanId).sort((a,b)=>a-b);$('upHint').textContent=`💡 Uplink entre switches: considera configurar trunk con VLANs ${tv.join(',')}`;}
  else $('upHint').textContent='';
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
  if(!name)return alert('Nombre/descripción requerida.');
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
    const info=document.createElement('div'); info.className='hinfo'; const hn=document.createElement('div'); hn.className='hn'; hn.textContent=t.name||''; const hm=document.createElement('div'); hm.className='hm'; hm.textContent=`${t.rules.length} reglas`; info.append(hn,hm); row.appendChild(info);
    const btn=document.createElement('button'); btn.type='button'; btn.className='btn bg bsm'; btn.textContent='Aplicar'; row.appendChild(btn); el.appendChild(row);
  });
  el.querySelectorAll('[data-tpl]').forEach(el=>el.onclick=()=>{const t=FW_TPLS[+el.dataset.tpl];for(const r of t.rules)S.fwRules.push({id:uid('fw'),...r,enabled:true});save();refresh();$('fwTplModal').classList.remove('on');alert(`✓ ${t.rules.length} reglas añadidas.`);});
}
function renderFwRules(){
  $('fwCnt').textContent=`${S.fwRules.length} reglas`;
  const el=$('fwRulesList'); el.textContent='';
  if(!S.fwRules.length){
    const empty=document.createElement('div'); empty.className='empty';
    const icon=document.createElement('div'); icon.className='ei'; icon.textContent='🔒';
    const p=document.createElement('p'); p.textContent='Sin reglas. Añade una arriba o usa las plantillas.';
    empty.append(icon,p); el.appendChild(empty); return;
  }
  S.fwRules.slice().sort((a,b)=>(a.prio||100)-(b.prio||100)).forEach(r=>{
    const row=document.createElement('div'); row.className='fwrow'+(!r.enabled?' fwdis':'');
    const action=(r.action||'deny').toLowerCase(); row.appendChild(makeBadge(action.toUpperCase(),`b ${action==='allow'?'bgn':action==='log'?'byw':'brd'}`));
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
  el.querySelectorAll('[data-dfw]').forEach(b=>b.onclick=()=>{S.fwRules=S.fwRules.filter(x=>x.id!==b.dataset.dfw);save();renderFwRules();$('fwCnt').textContent=`${S.fwRules.length} reglas`;});
}
function renderVlanMatrix(){
  const el=$('vlanMatrix'); el.textContent='';
  if(S.vlans.length<2){ const hint=document.createElement('div'); hint.className='hint'; hint.textContent='Necesitas al menos 2 VLANs.'; el.appendChild(hint); return; }
  const vs=S.vlans.slice().sort((a,b)=>a.vlanId-b.vlanId);
  const wrap=document.createElement('div'); wrap.className='tw'; const table=document.createElement('table');
  const thead=document.createElement('thead'); const hr=document.createElement('tr'); const first=document.createElement('th'); first.textContent='↓ origen / destino →'; hr.appendChild(first);
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
$('secTplL').onclick=()=>{Object.assign(S.security,{bpdu:'no',ps:'no',ds:'no',dai:'no',ipsg:'no'});save();refresh();alert('✓ Perfil mínimo aplicado.');};
$('secTplM').onclick=()=>{Object.assign(S.security,{bpdu:'yes',ps:'yes',ds:'yes',dai:'no',ipsg:'no'});save();refresh();alert('✓ Perfil medio aplicado.');};
$('secTplH').onclick=()=>{Object.assign(S.security,{bpdu:'yes',ps:'yes',ds:'yes',dai:'yes',ipsg:'yes'});save();refresh();alert('✓ Perfil alto aplicado.');};
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
    setOptions(roasDev,[makeOption('', '(selecciona)')].concat(gws.map(d=>makeOption(d.id, d.name||d.id, S.roas.gwId===d.id))));
    roasDev.value=S.roas.gwId||'';
  }
  const gId=S.roas.gwId;const ifs=gId?portsByDev(gId):[];
  const roasLanIf=$('roasLanIf');
  if(roasLanIf){
    setOptions(roasLanIf,[makeOption('', '(interfaz)')].concat(ifs.map(p=>makeOption(p.name, p.name||p.id, S.roas.lanIf===p.name))));
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
  if(!S.roas.gwId)return alert('Selecciona gateway.');if(!S.roas.lanIf)return alert('Selecciona interfaz LAN.');
  const gwPort=S.ports.find(p=>p.deviceId===S.roas.gwId&&p.name===S.roas.lanIf);
  if(gwPort){gwPort.mode='trunk';gwPort.allowedVlans=S.vlans.map(v=>v.vlanId).sort((a,b)=>a-b);}
  save();refresh();alert('✓ RoaS aplicado.');
};
function renderDhcp(){
  const box=$('dhcpView'); box.textContent='';
  if(!S.vlans.length){ const hint=document.createElement('div'); hint.className='hint'; hint.textContent='Sin VLANs.'; box.appendChild(hint); return; }
  const dh=window.NetWizardDhcpUtils;
  const audit=dh?dh.validateDhcpForProject(S):{issues:[]};
  const top=document.createElement('div'); top.className='hrow'; top.style.marginBottom='8px'; top.style.gap='6px'; top.style.flexWrap='wrap';
  const btnDiff=document.createElement('button'); btnDiff.type='button'; btnDiff.className='btn small'; btnDiff.id='btnDhcpDiff'; btnDiff.textContent='🧾 Ver diff DHCP';
  const btnPropose=document.createElement('button'); btnPropose.type='button'; btnPropose.className='btn small'; btnPropose.id='btnDhcpPropose'; btnPropose.textContent='✨ Proponer pools DHCP';
  const btnValidate=document.createElement('button'); btnValidate.type='button'; btnValidate.className='btn small'; btnValidate.id='btnDhcpValidate'; btnValidate.textContent='🧪 Validar DHCP';
  const topHint=document.createElement('span'); topHint.className='hint'; topHint.textContent='Rangos, exclusiones y DNS por VLAN.';
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
    const sub=document.createElement('div'); sub.className='hint'; sub.textContent=`${sn?sn.cidr:'—'} · GW ${sn?.gateway||'—'} · ${stc} IPs estáticas`;
    info.append(title,sub); row.appendChild(info);
    const controls=document.createElement('div'); controls.style.display='flex'; controls.style.gap='5px'; controls.style.flexWrap='wrap'; controls.style.alignItems='center';
    const en=document.createElement('select'); en.dataset.en=k; en.style.fontSize='12px'; en.style.padding='3px';
    [['0','No'],['1','Sí']].forEach(([val,txt])=>{ const o=document.createElement('option'); o.value=val; o.textContent=txt; if((val==='1')===!!cfg.enabled)o.selected=true; en.appendChild(o); }); addField(controls,'DHCP',en);
    const start=document.createElement('input'); start.dataset.dhStart=k; start.value=cfg.start||''; start.placeholder='pool start'; start.style.width='92px'; start.style.fontSize='12px'; start.style.padding='3px'; addField(controls,'Inicio',start);
    const end=document.createElement('input'); end.dataset.dhEnd=k; end.value=cfg.end||''; end.placeholder='pool end'; end.style.width='92px'; end.style.fontSize='12px'; end.style.padding='3px'; addField(controls,'Fin',end);
    const dns=document.createElement('input'); dns.dataset.dns=k; dns.value=cfg.dns||''; dns.placeholder='8.8.8.8,1.1.1.1'; dns.style.width='120px'; dns.style.fontSize='12px'; dns.style.padding='3px'; addField(controls,'DNS',dns);
    const domain=document.createElement('input'); domain.dataset.dhDomain=k; domain.value=cfg.domain||''; domain.placeholder='empresa.local'; domain.style.width='105px'; domain.style.fontSize='12px'; domain.style.padding='3px'; addField(controls,'Dominio',domain);
    const lease=document.createElement('input'); lease.dataset.ls=k; lease.type='number'; lease.min='1'; lease.max='365'; lease.value=cfg.lease||1; lease.style.width='58px'; lease.style.fontSize='12px'; lease.style.padding='3px'; addField(controls,'Lease días',lease);
    row.appendChild(controls); box.appendChild(row);
  });
  const ensure=(k)=>{if(!S.dhcp[k])S.dhcp[k]={enabled:false,dns:'8.8.8.8',lease:1,exclusions:[],reservations:[]};};
  box.querySelectorAll('[data-en]').forEach(s=>s.onchange=()=>{ensure(s.dataset.en);S.dhcp[s.dataset.en].enabled=s.value==='1';save();});
  box.querySelectorAll('[data-dns]').forEach(i=>i.onblur=()=>{ensure(i.dataset.dns);S.dhcp[i.dataset.dns].dns=(i.value||'').trim();save();});
  box.querySelectorAll('[data-ls]').forEach(i=>i.onblur=()=>{ensure(i.dataset.ls);S.dhcp[i.dataset.ls].lease=+i.value||1;save();});
  box.querySelectorAll('[data-dh-start]').forEach(i=>i.onblur=()=>{ensure(i.dataset.dhStart);S.dhcp[i.dataset.dhStart].start=(i.value||'').trim();save();});
  box.querySelectorAll('[data-dh-end]').forEach(i=>i.onblur=()=>{ensure(i.dataset.dhEnd);S.dhcp[i.dataset.dhEnd].end=(i.value||'').trim();save();});
  box.querySelectorAll('[data-dh-domain]').forEach(i=>i.onblur=()=>{ensure(i.dataset.dhDomain);S.dhcp[i.dataset.dhDomain].domain=(i.value||'').trim();save();});
  const bd=$('btnDhcpDiff');if(bd)bd.onclick=()=>{if(!dh)return alert('Módulo DHCP no disponible.');const cp=window.NetWizardChangePreview;if(!cp)return alert('Módulo de diff no disponible.');const diff=cp.computeDhcpDiff(S,{overwrite:false});alert(cp.summarizeDiff(diff,'Diff antes de proponer DHCP'));};
  const bp=$('btnDhcpPropose');if(bp)bp.onclick=()=>{if(!dh)return alert('Módulo DHCP no disponible.');const cp=window.NetWizardChangePreview;if(cp){const diff=cp.computeDhcpDiff(S,{overwrite:false});const txt=cp.summarizeDiff(diff,'Diff antes de proponer DHCP');if(diff.add.length||diff.change.length||diff.remove.length){if(!confirm(txt+'\n\n¿Aplicar propuesta DHCP?'))return;}}const res=dh.proposeDhcpForProject(S,{overwrite:false});S=res.project;save();refresh();alert(res.changes.join('\n')||'No había cambios DHCP que proponer.');};
  const bv=$('btnDhcpValidate');if(bv)bv.onclick=()=>{if(!dh)return alert('Módulo DHCP no disponible.');const res=dh.validateDhcpForProject(S);alert(res.issues.length?res.issues.map(i=>`[${i.severity}] ${i.code}: ${i.message}`).join('\n'):'✓ DHCP sin incidencias críticas.');renderDhcp();};
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
    const ico=document.createElement('div'); ico.className='hico'; ico.textContent=d.type==='switch'?'🔀':d.type==='router'?'🌐':'🛡'; row.appendChild(ico);
    const info=document.createElement('div'); info.className='hinfo'; const hn=document.createElement('div'); hn.className='hn'; hn.textContent=d.name||''; const hm=document.createElement('div'); hm.className='hm'; hm.textContent=`${d.type||''} · ${d.vendorOs||'—'}`; info.append(hn,hm); row.appendChild(info);
    row.appendChild(makeBadge('⚙','b bac')); el.appendChild(row);
  });
  el.querySelectorAll('[data-dcfg]').forEach(el=>el.onclick=()=>selectDevCfg(el.dataset.dcfg));
}
function selectDevCfg(devId){
  selDevCfg=devId;const d=devById(devId);if(!d)return;
  selVendorCfg=d.vendorOs||ALL_VENDORS[0].id;
  document.querySelectorAll('[data-dcfg]').forEach(el=>el.classList.toggle('on',el.dataset.dcfg===devId));
  const paint=()=>{const cfg=genConfig(selDevCfg,selVendorCfg);$('cfgOut').value=cfg;$('cfgOutComment').value=buildCommentedConfig(cfg);};
  renderVendorPills($('cfgVendorPills'), ALL_VENDORS, selVendorCfg, 'vp', (id)=>{selVendorCfg=id;paint();});
  paint();
}

// ─── DEVICE CFG MODAL (from topo click or devs list) ───
let dcmDevId=null,dcmVendor=null;
function openDevCfgModal(devId){
  const d=devById(devId);if(!d)return;
  dcmDevId=devId;dcmVendor=d.vendorOs||ALL_VENDORS[0].id;
  $('dcmTitle').textContent=`⚙ ${d.name}`;
  { const meta=$('dcmMeta'); meta.textContent=''; meta.appendChild(makeBadge(d.type||'','b bac')); meta.appendChild(document.createTextNode(' ')); meta.appendChild(makeBadge(d.vendorOs||'—','b bgr')); meta.appendChild(document.createTextNode(' ')); meta.appendChild(makeBadge(`${portsByDev(devId).length} puertos`,'b bgr')); }
  const paint=()=>{const cfg=genConfig(dcmDevId,dcmVendor);$('dcmCfg').value=cfg;$('dcmCfgComment').value=buildCommentedConfig(cfg);};
  renderVendorPills($('dcmPills'), ALL_VENDORS, dcmVendor, 'dcmp', (id)=>{dcmVendor=id;paint();});
  paint();
  $('devCfgModal').classList.add('on');
}
$('dcmClose').onclick=()=>$('devCfgModal').classList.remove('on');
$('devCfgModal').onclick=e=>{if(e.target.id==='devCfgModal'){$('devCfgModal').classList.remove('on');}};
$('dcmCopy').onclick=()=>{navigator.clipboard.writeText($('dcmCfg').value).then(()=>alert('✓ Copiado al portapapeles.'));};
$('dcmDl').onclick=()=>{const d=devById(dcmDevId);dl(`${d?.name||'config'}_${dcmVendor}.txt`,$('dcmCfg').value);};

function renderVtp(){
  if($('vtpDomain'))$('vtpDomain').value=S.vtp?.domain||'';
  if($('vtpPassword'))$('vtpPassword').value=S.vtp?.password||'';
  if($('vtpVersion'))$('vtpVersion').value=S.vtp?.version||'2';
  if($('vtpPruning'))$('vtpPruning').value=S.vtp?.pruning||'no';
  const sws=S.devices.filter(d=>d.type==='switch' && (d.vendorOs||'cisco_ios')==='cisco_ios').sort((a,b)=>a.name.localeCompare(b.name));
  const el=$('vtpSwitchRoles'); el.textContent='';
  if(!sws.length){ const hint=document.createElement('div'); hint.className='hint'; hint.textContent='Añade switches Cisco IOS para poder usar VTP.'; el.appendChild(hint); return; }
  sws.forEach(d=>{ const row=document.createElement('div'); row.className='row'; row.style.marginTop='8px';
    const left=document.createElement('div'); const lab=document.createElement('label'); lab.className='fl'; lab.textContent=d.name||''; const hint=document.createElement('div'); hint.className='hint'; hint.textContent=d.vendorOs||'cisco_ios'; left.append(lab,hint); row.appendChild(left);
    const right=document.createElement('div'); const rlab=document.createElement('label'); rlab.className='fl'; rlab.textContent='Rol VTP'; const sel=document.createElement('select'); sel.dataset.vtprole=d.id; [['off','Desactivado'],['server','Server'],['client','Client'],['transparent','Transparent']].forEach(([v,t])=>addOption(sel,v,t)); right.append(rlab,sel); row.appendChild(right); el.appendChild(row);
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
  save();renderVtp();if(selDevCfg)selectDevCfg(selDevCfg);alert('✓ VTP guardado.');
};

// EXPORT
const dl=(fn,txt)=>{const b=new Blob([txt],{type:'text/plain;charset=utf-8'});const u=URL.createObjectURL(b);const a=document.createElement('a');a.href=u;a.download=fn;document.body.appendChild(a);a.click();a.remove();URL.revokeObjectURL(u);};
function requireConfigExportReady(){
  if(!(window.NetWizardAudit&&window.NetWizardAudit.isProduction&&window.NetWizardAudit.isProduction()))return true;
  if(window.NetWizardProductionGate&&window.NetWizardProductionGate.runProductionGate){
    const gate=window.NetWizardProductionGate.runProductionGate(S,{productionMode:true,strict:true});
    if(!gate.canExport){
      const msg=window.NetWizardProductionGate.summarizeGate?window.NetWizardProductionGate.summarizeGate(gate,{limit:80}):'Exportación bloqueada en modo producción.';
      if($('cfgOut'))$('cfgOut').value=msg;
      const r=document.getElementById('readinessAuditOut');if(r)r.textContent=msg;
      const g=document.getElementById('productionGateOut');if(g)g.textContent=msg;
      alert('Modo producción: la puerta de producción bloquea la exportación. Corrige los errores o cambia a modo demo para pruebas.');
      return false;
    }
    return true;
  }
  if(!(window.NetWizardPlanner&&window.NetWizardPlanner.readinessAudit))return true;
  const audit=window.NetWizardPlanner.readinessAudit(S,{productionMode:true});
  if(audit&&audit.ok===false){
    const msg=window.NetWizardAudit.summarizeIssues?window.NetWizardAudit.summarizeIssues(audit.issues||audit,{title:'Exportación bloqueada en modo producción'}):'Exportación bloqueada en modo producción por errores de auditoría.';
    if($('cfgOut'))$('cfgOut').value=msg;
    const r=document.getElementById('readinessAuditOut');if(r)r.textContent=msg;
    alert('Modo producción: corrige los errores de auditoría antes de exportar configuraciones. Puedes cambiar a modo demo si solo estás haciendo una prueba.');
    return false;
  }
  return true;
}
$('expAll').onclick=()=>{if(!requireConfigExportReady())return;for(const d of S.devices){const ext=d.vendorOs==='juniper_junos'?'set.txt':'cfg';dl(`${d.name}.${ext}`,genConfig(d.id));}};
$('expBundle').onclick=()=>{if(!requireConfigExportReady())return;let out='';for(const d of S.devices.slice().sort((a,b)=>a.name.localeCompare(b.name))){out+=`\n${'#'.repeat(50)}\n# ${d.name} (${d.vendorOs||'—'})\n${'#'.repeat(50)}\n\n`+genConfig(d.id)+'\n';}dl('configs_bundle.txt',out);$('cfgOut').value=out;};
$('expCsv').onclick=()=>dl('hosts.csv',genHostCsv());
$('expJson').onclick=()=>{
  const snap=window.NetWizardState.getSnapshot();
  const payload=NWSchema&&typeof NWSchema.prepareExport==='function'?NWSchema.prepareExport(snap,{defaults:defS}):snap;
  $('jsonBox').value=JSON.stringify(payload,null,2);
};
$('impJson').onclick=()=>{
  const txt=($('jsonBox').value||'').trim();
  if(!txt)return alert('Pega el JSON primero.');
  try{
    const raw=JSON.parse(txt);
    let p=raw?.project&&typeof raw.project==='object'?raw.project:raw;
    if(NWSchema&&typeof NWSchema.prepareImport==='function'){
      const prepared=NWSchema.prepareImport(raw,{defaults:defS});
      if(!prepared.ok)return alert('JSON inválido:\n- '+prepared.errors.join('\n- '));
      p=prepared.project;
      if(prepared.warnings&&prepared.warnings.length)console.warn('NetWizard import warnings',prepared.warnings);
    }else if(!Array.isArray(p?.devices)||!Array.isArray(p?.vlans)){
      return alert('JSON inválido.');
    }
    window.NetWizardState.replaceProject(p,{source:'json-import'});
    document.dispatchEvent(new CustomEvent('nw:iot:changed',{detail:{source:'json-import'}}));
  }catch(e){alert('JSON inválido: '+e.message);}
};
$('btnReset').onclick=()=>{if(!confirm('¿Borrar todo el proyecto?'))return;localStorage.removeItem(SK);localStorage.removeItem('nw_iot_embedded_v1');window.NetWizardState.replaceProject(defS(),{source:'reset'});};
$('btnExport').onclick=()=>{navTo('cfg');setTimeout(()=>$('expBundle').click(),200);};

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
window.addEventListener('mouseup',()=>{if(drag){save();drag=null;}});
window.addEventListener('mousemove',e=>{if(!drag)return;const r=canvas.getBoundingClientRect(),x=e.clientX-r.left,y=e.clientY-r.top;S.topo.pos[drag.id].x=x-drag.dx;S.topo.pos[drag.id].y=y-drag.dy;drawTopo();});
canvas.addEventListener('click',e=>{if(drag)return;const r=canvas.getBoundingClientRect(),x=e.clientX-r.left,y=e.clientY-r.top;for(const d of S.devices){const p=S.topo.pos[d.id];if(!p)continue;if(Math.abs(x-p.x)<72&&Math.abs(y-p.y)<25){openDevCfgModal(d.id);return;}}});
canvas.addEventListener('touchstart',e=>{const t=e.touches[0];const r=canvas.getBoundingClientRect(),x=t.clientX-r.left,y=t.clientY-r.top;for(const d of S.devices){const p=S.topo.pos[d.id];if(!p)continue;if(Math.abs(x-p.x)<72&&Math.abs(y-p.y)<25){drag={id:d.id,dx:x-p.x,dy:y-p.y};break;}}},{passive:true});
canvas.addEventListener('touchmove',e=>{if(!drag)return;e.preventDefault();const t=e.touches[0];const r=canvas.getBoundingClientRect(),x=t.clientX-r.left,y=t.clientY-r.top;S.topo.pos[drag.id].x=x-drag.dx;S.topo.pos[drag.id].y=y-drag.dy;drawTopo();},{passive:false});
canvas.addEventListener('touchend',()=>{if(drag){save();drag=null;}});
$('fitTopo').onclick=()=>{autoLayout();drawTopo();};$('reLy').onclick=()=>{for(const k in S.topo.pos)delete S.topo.pos[k];autoLayout();drawTopo();};$('v5AutoLoc').onclick=()=>autoVisualAssign();$('v5AddLoc').onclick=()=>addV5Location();$('v5Fit').onclick=()=>fitV5();$('v5Fs').onclick=()=>toggleV5Fullscreen();
window.addEventListener('resize',()=>{if(S.step==='graphs')drawTopo();});


// ─────────────────── V5 VISUAL OVERLAY (driven by V4 data) ───────────────────
const vcv=$('v5view');const vctx=vcv.getContext('2d');let vdrag=null;
const V5S={locHead:36,devW:176,devH:62,hstW:158,hstH:42,colW:190};


// =========================================================
// 14. VISTA VISUAL V5
// Motor visual V5 para ubicaciones, nodos, drag/drop, fullscreen, panel lateral y render avanzado.
// =========================================================
function vv(){return S.visual||(S.visual={locs:[],assign:{devices:{},hosts:{}},pos:{},view:{px:60,py:50,zoom:1},sel:null,fs:false,compactLabels:true,proMode:true,proBounds:{}});}
function v5ProMode(){return vv().proMode!==false;}
function setV5ProMode(on){vv().proMode=!!on;if(v5ProMode())applyProfessionalLocationLayout();save();drawV5();renderV5Panel();}
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
function v5Filters(){
  const base={switch:true,router:true,firewall:true,hosts:true,server:true,camera:true,ap:true,iotCandidate:true,iotAccess:true,iotDevice:true,wifi:true,lora:true,zigbee:true,thread:true,mqtt:true,ble:true,ethernet:true};
  const V=vv(); V.filters={...base,...(V.filters||{})}; return V.filters;
}
function v5FilterOn(k){const f=v5Filters();return f[k]!==false;}
function v5SetFilter(k,on){v5Filters()[k]=!!on;save();drawV5();renderV5Panel();}
function v5HostFilterKey(h){
  const t=(h.type||'host').toLowerCase();
  if(t==='iot')return 'iotCandidate';
  if(t==='server')return 'server';
  if(t==='camera')return 'camera';
  if(t==='ap')return 'ap';
  return 'hosts';
}
function v5ShowDevice(d){return v5FilterOn((d.type||'switch').toLowerCase());}
function v5ShowHost(h){return v5FilterOn('hosts') && v5FilterOn(v5HostFilterKey(h));}
function v5SyncFilterInputs(){document.querySelectorAll('[data-v5-filter]').forEach(cb=>{cb.checked=v5FilterOn(cb.dataset.v5Filter);});}
function vLocChildren(id){return vLocs().filter(l=>(l.parentId||'')===id);}
function vLocRoots(){return vLocs().filter(l=>!l.parentId||!vLocById(l.parentId));}
function vLocDepth(id){let depth=0,cur=vLocById(id),guard=0;while(cur&&cur.parentId&&guard<20){const p=vLocById(cur.parentId);if(!p)break;depth++;cur=p;guard++;}return depth;}
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
  const list=S.physicalLocations||[];
  const locIndex=list.findIndex(x=>x.id===id);
  if(locIndex===-1){
    console.warn('No se encontró la ubicación a eliminar:',id);
    alert('No se ha encontrado la ubicación a eliminar.');
    return false;
  }

  const loc=list[locIndex];
  const locNameLower=cleanStr(loc.name).toLowerCase();
  const parent=loc.parentId?physLocById(loc.parentId):null;
  const children=list.filter(x=>x.parentId===id);
  const hosts=(S.hosts||[]).filter(h=>cleanStr(h.physicalLocation).toLowerCase()===locNameLower);
  const devices=(S.devices||[]).filter(d=>cleanStr(d.physicalLocation).toLowerCase()===locNameLower);

  let msg=`¿Eliminar la ubicación "${loc.name}"?`;
  if(children.length||hosts.length||devices.length){
    msg+=`

Se recolocarán ${children.length} sububicación(es), ${devices.length} equipo(s) y ${hosts.length} host(s) a ${parent?`"${parent.name}"`:'sin ubicación'}.`;
  }
  if(askConfirm && !confirm(msg)) return false;

  const fallbackParentId=parent?parent.id:'';
  const fallbackParentName=parent?parent.name:'';

  children.forEach(x=>{ x.parentId=fallbackParentId; });

  (S.devices||[]).forEach(d=>{
    if(cleanStr(d.physicalLocation).toLowerCase()===locNameLower){
      d.physicalLocation=fallbackParentName;
    }
  });
  (S.hosts||[]).forEach(h=>{
    if(cleanStr(h.physicalLocation).toLowerCase()===locNameLower){
      h.physicalLocation=fallbackParentName;
    }
  });

  if(S.visual&&S.visual.assign){
    const anotherLoc=(typeof vLocs==='function' ? vLocs().find(l=>l.id!==id) : null);
    const fallbackVisualId=fallbackParentId || (anotherLoc?anotherLoc.id:'');
    (S.devices||[]).forEach(d=>{
      if(typeof deviceVisualLoc==='function' && deviceVisualLoc(d.id)===id && typeof setDeviceVisualLoc==='function'){
        setDeviceVisualLoc(d.id,fallbackVisualId);
      }
    });
    (S.hosts||[]).forEach(h=>{
      if(typeof hostVisualLoc==='function' && hostVisualLoc(h.id)===id && typeof setHostVisualLoc==='function'){
        setHostVisualLoc(h.id,fallbackVisualId);
      }
    });
  }

  list.splice(locIndex,1);

  if(S.visual&&Array.isArray(S.visual.locs)){
    S.visual.locs=S.visual.locs.filter(l=>{
      const sameId = l.id===id;
      const sameName = cleanStr(l.name).toLowerCase()===locNameLower;
      if(sameName && fallbackParentName && !l.parentId) l.parentId=fallbackParentId;
      return !sameId && !sameName;
    });
  }

  if(vv().sel&&vv().sel.id===id) vv().sel=null;

  syncPhysicalLocationNames();
  clearPhysicalLocationForm();
  save();

  try{ renderPhysicalLocations(); }catch(e){ console.error('renderPhysicalLocations',e); }
  try{ fillPhysicalLocationParentSel(); }catch(e){ console.error('fillPhysicalLocationParentSel',e); }
  try{ fillHostLocSel(); }catch(e){ console.error('fillHostLocSel',e); }
  try{ fillHostPhysLocSel(); }catch(e){ console.error('fillHostPhysLocSel',e); }
  try{ renderHosts(); }catch(e){ console.error('renderHosts',e); }
  try{ renderDevs(); }catch(e){ console.error('renderDevs',e); }
  try{ renderWizard(); }catch(e){ console.error('renderWizard',e); }
  try{ renderV5Panel(); }catch(e){ console.error('renderV5Panel',e); }
  try{ drawV5(); }catch(e){ console.error('drawV5',e); }
  try{ refresh(); }catch(e){ console.error('refresh',e); }

  console.log('Ubicación eliminada correctamente:',loc.name,id);
  return true;
}
function vLocs(){return vv().locs;}
function vLocById(id){return vLocs().find(x=>x.id===id)||null;}
function deviceVisualLoc(id){return vv().assign.devices[id]||'';}
function hostVisualLoc(id){return vv().assign.hosts[id]||'';}
function setDeviceVisualLoc(id,lid){vv().assign.devices[id]=lid;}
function setHostVisualLoc(id,lid){vv().assign.hosts[id]=lid;}
function v5ApplyRefresh(sel){save();refresh();if(sel)selectV5(sel.t,sel.id);}
function v5UpdateDevice(id,key,val){const d=devById(id);if(!d)return;d[key]=val;if(key==='type'&&val==='switch'){d.internetEdge='no';d.wanIf=null;}v5ApplyRefresh({t:'device',id});}
function v5UpdateHost(id,key,val){const h=S.hosts.find(x=>x.id===id);if(!h)return;h[key]=val;v5ApplyRefresh({t:'host',id});}
function v5UpdateHostPort(id,portId){const h=S.hosts.find(x=>x.id===id);if(!h)return;h.portRef=portId||null;if(portId){const p=S.ports.find(pp=>pp.id===portId);if(p){h.connectedDeviceId=p.deviceId;setHostVisualLoc(id,deviceVisualLoc(p.deviceId));}}v5ApplyRefresh({t:'host',id});}
function v5UpdatePort(portId,key,val){const p=S.ports.find(x=>x.id===portId);if(!p)return;p[key]=val;if(key==='mode'&&val!=='access'&&p.accessVlanRef)p.accessVlanRef=null;v5ApplyRefresh(vv().sel||null);}
function syncV5FullscreenState(){const layout=$('v5Layout');const fullEl=document.fullscreenElement;const nativeFs=!!(fullEl&&fullEl===layout);const fallbackFs=layout.classList.contains('fs');const on=nativeFs||fallbackFs;layout.classList.toggle('fs',fallbackFs&&!nativeFs);document.body.classList.toggle('v5-fs-lock',on);vv().fs=on;$('v5Fs').textContent=on?'🗗 Salir pantalla completa':'⛶ Pantalla completa';setTimeout(()=>{resizeV5();fitV5(false);renderV5Panel();},30);}
async function toggleV5Fullscreen(force){const layout=$('v5Layout');if(!layout)return;const active=!!(document.fullscreenElement===layout)||layout.classList.contains('fs');const next=force==null?!active:!!force;try{
  if(next){
    if(document.fullscreenElement&&document.fullscreenElement!==layout&&document.exitFullscreen)await document.exitFullscreen();
    if(layout.requestFullscreen)await layout.requestFullscreen();
    else layout.classList.add('fs');
  }else{
    if(document.fullscreenElement===layout&&document.exitFullscreen)await document.exitFullscreen();
    layout.classList.remove('fs');
  }
}catch(err){
  layout.classList.toggle('fs',next);
}
syncV5FullscreenState();}
function ensureVisualModel(){
  const V=vv();
  for(const k of Object.keys(V.assign.devices))if(!S.devices.some(d=>d.id===k))delete V.assign.devices[k];
  for(const k of Object.keys(V.assign.hosts))if(!S.hosts.some(h=>h.id===k))delete V.assign.hosts[k];
  for(const k of Object.keys(V.pos))if(!S.devices.some(d=>d.id===k)&&!S.hosts.some(h=>h.id===k))delete V.pos[k];
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
    if(!V.assign.devices[d.id]||!vLocById(V.assign.devices[d.id])){
      let lid=l1;
      if(d.type==='firewall'||d.type==='router')lid=l0;
      else if((d.name||'').toLowerCase().includes('srv')||(d.name||'').toLowerCase().includes('server')||(d.notes||'').toLowerCase().includes('server'))lid=l2;
      V.assign.devices[d.id]=lid;
    }
  }
  for(const h of S.hosts){
    if(!V.assign.hosts[h.id]||!vLocById(V.assign.hosts[h.id])){
      const linkedId=hostConnectedDeviceId(h);
      V.assign.hosts[h.id]=linkedId?deviceVisualLoc(linkedId):l1;
    }
  }
}
function devsInVisualLoc(lid){return S.devices.filter(d=>deviceVisualLoc(d.id)===lid && v5ShowDevice(d));}
function hostEffectiveVisualLoc(h){
  const linkedDev=devById(hostConnectedDeviceId(h)||'');
  const linkedLoc=linkedDev ? deviceVisualLoc(linkedDev.id) : '';
  return linkedLoc || hostVisualLoc(h.id) || '';
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
function visualNodeBounds(kind,id){const pos=vv().pos[id]||{x:0,y:0};return kind==='dev'?{x:pos.x,y:pos.y,w:V5S.devW,h:V5S.devH}:{x:pos.x,y:pos.y,w:V5S.hstW,h:V5S.hstH};}
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
function v2s(x,y){const vw=vv().view;return{x:x*vw.zoom+vw.px,y:y*vw.zoom+vw.py};}
function s2v(x,y){const vw=vv().view;return{x:(x-vw.px)/vw.zoom,y:(y-vw.py)/vw.zoom};}
function nodeCenterById(kind,id){const b=visualNodeBounds(kind,id);return{x:b.x+b.w/2,y:b.y+b.h/2};}
function drawRound(ctx,x,y,w,h,r){r=Math.max(0,Math.min(r,w/2,h/2));ctx.beginPath();ctx.moveTo(x+r,y);ctx.arcTo(x+w,y,x+w,y+h,r);ctx.arcTo(x+w,y+h,x,y+h,r);ctx.arcTo(x,y+h,x,y,r);ctx.arcTo(x,y,x+w,y,r);ctx.closePath();}
function v5NodeRadius(w,h,z,base=10){return Math.max(2,Math.min(base*z,w/2,h/2));}
function v5ReadableZoom(){return vv().view.zoom>=.42;}
function drawNodeText(x,y,lines,mono){let yy=y;for(const ln of lines){vctx.fillText(ln,x,yy);yy+=13*vv().view.zoom;}}
function colorFromSeed(seed){let h=0;seed=String(seed||'seed');for(let i=0;i<seed.length;i++)h=(h*31+seed.charCodeAt(i))%360;return `hsl(${h} 78% 62%)`;}
function rgbaFromCss(css,alpha){
  const m=String(css||'').match(/hsl\(([-\d.]+)\s+([\d.]+)%\s+([\d.]+)%\)/i);
  if(!m)return `rgba(96,165,250,${alpha})`;
  let h=(+m[1]%360+360)%360,s=(+m[2])/100,l=(+m[3])/100;
  const c=(1-Math.abs(2*l-1))*s, x=c*(1-Math.abs((h/60)%2-1)), m0=l-c/2;
  let r=0,g=0,b=0;
  if(h<60){r=c;g=x;} else if(h<120){r=x;g=c;} else if(h<180){g=c;b=x;} else if(h<240){g=x;b=c;} else if(h<300){r=x;b=c;} else {r=c;b=x;}
  r=Math.round((r+m0)*255); g=Math.round((g+m0)*255); b=Math.round((b+m0)*255);
  return `rgba(${r},${g},${b},${alpha})`;
}
function linkedDeviceIds(devId){
  const ids=new Set();
  for(const lk of S.links){
    const a=S.ports.find(p=>p.id===lk.aPortId),b=S.ports.find(p=>p.id===lk.bPortId);
    if(!a||!b)continue;
    if(a.deviceId===devId&&b.deviceId!==devId)ids.add(b.deviceId);
    if(b.deviceId===devId&&a.deviceId!==devId)ids.add(a.deviceId);
  }
  return [...ids];
}
function deviceAccentColor(devId,seen){
  seen=seen||new Set();
  if(seen.has(devId))return colorFromSeed(devId);
  seen.add(devId);
  const d=devById(devId); if(!d) return colorFromSeed(devId);
  if(d.type==='switch') return colorFromSeed((d.name||devId)+'-switch');
  const neigh=linkedDeviceIds(devId).map(id=>devById(id)).filter(Boolean);
  const sw=neigh.find(n=>n.type==='switch');
  if(sw) return colorFromSeed((sw.name||sw.id)+'-switch');
  if(neigh[0]) return deviceAccentColor(neigh[0].id,seen);
  if(d.type==='router') return 'hsl(196 82% 63%)';
  if(d.type==='firewall') return 'hsl(8 84% 66%)';
  return colorFromSeed((d.name||devId)+'-'+(d.type||'dev'));
}
function compactLinkLabel(host,dev,port){
  const compact=vv().compactLabels!==false;
  if(compact) return `${dev.name||'equipo'}${port?` · ${port.name}`:''}`.slice(0,24);
  return `${dev.name||'equipo'}${port?` · ${port.name}`:' · auto/pendiente'}`.slice(0,42);
}

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
  const mode=p?(p.mode||'access'):'pendiente';
  const accessVlan=p&&p.accessVlanRef?vByRef(p.accessVlanRef):null;
  const title=makeEl('div','',`${h.name||'Host'} → ${dev.name||'Equipo'}`);
  title.style.cssText='font-weight:700;margin-bottom:4px;color:#e2eaf7';
  el.appendChild(title);
  const addLine=(label,value,mono=false)=>{
    const line=makeEl('div',''); line.style.color='#8fa3c0'; appendText(line,label+': ');
    const span=makeEl('span','',value); span.style.color=label==='Puerto'?'#bfdbfe':'#e2eaf7'; if(mono) span.style.fontFamily='Fira Code,monospace';
    line.appendChild(span); el.appendChild(line);
  };
  addLine('Puerto',p?p.name:'sin asignar',true);
  addLine('Modo',`${mode} · VLAN host: ${vlan?('VLAN '+vlan.vlanId+' · '+vlan.name):'sin VLAN'}`,true);
  addLine('VLAN puerto',accessVlan?('VLAN '+accessVlan.vlanId+' · '+accessVlan.name):(p&&p.accessVlanRef?p.accessVlanRef:'—'),false);
  addLine('IP',effectiveHostIp(h)||'—',true);
}
function v5DrawLinkDot(mx,my,host,dev,port,accent){
  const vlanOk=!!(port && host.vlanRef && port.accessVlanRef===host.vlanRef);
  const pending=!port;
  const fill=pending?'#f59e0b':(vlanOk?'#22c55e':'#ef4444');
  vctx.save();
  const z=vv().view.zoom;
  const outer=Math.max(4.8,Math.min(8.5,7.6*z+2));
  const inner=Math.max(2.8,Math.min(4.6,4.3*z+1));
  vctx.shadowColor='rgba(0,0,0,.55)';vctx.shadowBlur=8;
  vctx.fillStyle='rgba(7,9,15,.98)';vctx.beginPath();vctx.arc(mx,my,outer,0,Math.PI*2);vctx.fill();
  vctx.shadowBlur=0;
  vctx.fillStyle=fill;vctx.beginPath();vctx.arc(mx,my,inner,0,Math.PI*2);vctx.fill();
  vctx.strokeStyle=rgbaFromCss(accent,.85);vctx.lineWidth=Math.max(.8,1.2*z);vctx.beginPath();vctx.arc(mx,my,outer+1,0,Math.PI*2);vctx.stroke();
  vctx.restore();
  v5LinkDots.push({x:mx,y:my,r:Math.max(10,outer+5),host,dev,port});
}
function v5HoverMove(evt){
  if(vdrag){v5HideLinkTooltip();return;}
  const r=vcv.getBoundingClientRect();
  const x=evt.clientX-r.left, y=evt.clientY-r.top;
  const dot=[...v5LinkDots].reverse().find(d=>Math.hypot(d.x-x,d.y-y)<=d.r);
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
function drawV5(){
  if(!vcv)return;v5SyncFilterInputs();ensureVisualModel();if(v5ProMode()&&!vv().freezeLocAutoBounds)computeProfessionalLocationBounds();const r=vcv.getBoundingClientRect();if(!r.width||!r.height)return;vctx.clearRect(0,0,r.width,r.height);
  v5LinkDots=[];
  const z=vv().view.zoom;
  vctx.globalAlpha=.05;vctx.strokeStyle='#3b82f6';vctx.lineWidth=1;for(let x=0;x<r.width;x+=26){vctx.beginPath();vctx.moveTo(x,0);vctx.lineTo(x,r.height);vctx.stroke();}for(let y=0;y<r.height;y+=26){vctx.beginPath();vctx.moveTo(0,y);vctx.lineTo(r.width,y);vctx.stroke();}vctx.globalAlpha=1;
  for(const loc of vLocs())layoutVisualLoc(loc,false);
  const ordered=[...vLocs()].sort((a,b)=>vLocDepth(a.id)-vLocDepth(b.id));
  for(const loc of ordered){
    const b=visualLocBounds(loc),p=v2s(b.x,b.y),w=b.w*z,h=b.h*z,depth=vLocDepth(loc.id);
    vctx.fillStyle=loc.color||'#10233c';vctx.globalAlpha=Math.max(.16,.33-depth*.05);drawRound(vctx,p.x,p.y,w,h,Math.max(4,(18-depth*2)*z));vctx.fill();vctx.globalAlpha=1;vctx.strokeStyle=vv().sel&&vv().sel.t==='loc'&&vv().sel.id===loc.id?'#93c5fd':(v5ProMode()&&loc.parentId?'rgba(125,211,252,.75)':'rgba(58,77,102,.9)');vctx.lineWidth=v5ProMode()&&loc.parentId?1.1:1.4;drawRound(vctx,p.x,p.y,w,h,Math.max(4,(18-depth*2)*z));vctx.stroke();
    if(vdrag&&vdrag.overLoc===loc.id){vctx.strokeStyle='#60a5fa';vctx.lineWidth=2;vctx.setLineDash([8,5]);drawRound(vctx,p.x+4,p.y+4,w-8,h-8,Math.max(4,15*z));vctx.stroke();vctx.setLineDash([]);}
    vctx.fillStyle='#e2eaf7';vctx.font='600 '+Math.max(11,13-depth)+'px Space Grotesk,sans-serif';vctx.fillText((depth?('↳ '.repeat(Math.min(depth,2))):'')+loc.name,p.x+12*z,p.y+22*z);vctx.fillStyle='#8fa3c0';vctx.font='11px Space Grotesk,sans-serif';vctx.fillText(devsInVisualLoc(loc.id).length+' equipos · '+hostsInVisualLoc(loc.id).length+' hosts',p.x+12*z,p.y+37*z);
    const hs=12*z,hx=p.x+w-hs-8*z,hy=p.y+h-hs-8*z;
    if(!(v5ProMode()&&loc.parentId)){ vctx.fillStyle='rgba(148,163,184,.95)';vctx.fillRect(hx,hy,hs,hs); vctx.strokeStyle='rgba(15,23,42,.95)';vctx.strokeRect(hx,hy,hs,hs); vctx.beginPath();vctx.moveTo(hx+3*z,hy+hs-3*z);vctx.lineTo(hx+hs-3*z,hy+3*z);vctx.stroke(); }
  }
  for(const lk of S.links){const a=S.ports.find(p=>p.id===lk.aPortId),b=S.ports.find(p=>p.id===lk.bPortId);if(!a||!b)continue;const da=devById(a.deviceId),db=devById(b.deviceId);if(!da||!db||!v5ShowDevice(da)||!v5ShowDevice(db))continue;const ca=nodeCenterById('dev',da.id),cb=nodeCenterById('dev',db.id);const pa=v2s(ca.x,ca.y),pb=v2s(cb.x,cb.y);const trunk=a.mode==='trunk'||b.mode==='trunk';vctx.lineWidth=trunk?2.8:1.6;vctx.strokeStyle=trunk?'#38bdf8':'#3b82f6';vctx.setLineDash(trunk?[8,4]:[]);vctx.beginPath();vctx.moveTo(pa.x,pa.y);vctx.lineTo(pb.x,pb.y);vctx.stroke();vctx.setLineDash([]);}
  for(const loc of vLocs()){
    for(const d of devsInVisualLoc(loc.id)){
      const nb=visualNodeBounds('dev',d.id),np=v2s(nb.x,nb.y),accent=deviceAccentColor(d.id),accentSoft=rgbaFromCss(accent,.18);
      vctx.fillStyle='rgba(7,12,20,.96)';const dw=nb.w*z,dh=nb.h*z,dr=v5NodeRadius(dw,dh,z,10);
      drawRound(vctx,np.x,np.y,dw,dh,dr);vctx.fill();
      vctx.fillStyle=accentSoft;drawRound(vctx,np.x+1,np.y+1,Math.max(0,dw-2),Math.max(0,dh-2),Math.max(2,dr-1));vctx.fill();
      vctx.strokeStyle=vv().sel&&vv().sel.t==='device'&&vv().sel.id===d.id?'#22c55e':accent;vctx.lineWidth=Math.max(.7,1.6*z);drawRound(vctx,np.x,np.y,dw,dh,dr);vctx.stroke();
      if(v5ReadableZoom()){
        vctx.fillStyle='#e2eaf7';vctx.font='600 '+Math.max(8,12*z)+'px Space Grotesk,sans-serif';vctx.fillText((d.name||'').slice(0,22),np.x+10*z,np.y+16*z);
        vctx.fillStyle='#8fa3c0';vctx.font=Math.max(7,10*z)+'px Fira Code,monospace';drawNodeText(np.x+10*z,np.y+31*z,[((d.type||'')+' · '+(d.mgmtIp||'sin mgmt')).slice(0,28),((d.vendorOs||'—')+(d.internetEdge==='yes'?' · EDGE':'' )).slice(0,28)]);
      }else{
        vctx.fillStyle='#e2eaf7';vctx.font='700 9px Space Grotesk,sans-serif';vctx.fillText((d.type||'D').slice(0,2).toUpperCase(),np.x+6,np.y+12);
      }
    }
    for(const h of hostsInVisualLoc(loc.id)){
      const nb=visualNodeBounds('host',h.id),np=v2s(nb.x,nb.y),linked=hostConnectedDeviceId(h),accent=linked?deviceAccentColor(linked):'hsl(262 83% 74%)',accentSoft=rgbaFromCss(accent,.15);
      vctx.fillStyle='rgba(9,16,26,.96)';const hw=nb.w*z,hh=nb.h*z,hr=v5NodeRadius(hw,hh,z,10);
      drawRound(vctx,np.x,np.y,hw,hh,hr);vctx.fill();
      vctx.fillStyle=accentSoft;drawRound(vctx,np.x+1,np.y+1,Math.max(0,hw-2),Math.max(0,hh-2),Math.max(2,hr-1));vctx.fill();
      vctx.strokeStyle=vv().sel&&vv().sel.t==='host'&&vv().sel.id===h.id?'#a78bfa':accent;vctx.lineWidth=Math.max(.7,1.5*z);drawRound(vctx,np.x,np.y,hw,hh,hr);vctx.stroke();
      const vlan=vByRef(h.vlanRef);
      if(v5ReadableZoom()){
        vctx.fillStyle='#e2eaf7';vctx.font='600 '+Math.max(7.5,10.5*z)+'px Space Grotesk,sans-serif';vctx.fillText((h.name||'').slice(0,20),np.x+8*z,np.y+14*z);
        const chip=(vlan?('V'+vlan.vlanId):'sin VLAN');
        vctx.font=Math.max(6.5,9*z)+'px Fira Code,monospace';
        const chipW=Math.max(32*z,(chip.length*6+12)*z);
        vctx.fillStyle='rgba(15,23,42,.78)';drawRound(vctx,np.x+8*z,np.y+22*z,chipW,14*z,Math.max(2,7*z));vctx.fill();
        vctx.fillStyle=accent;vctx.fillText(chip,np.x+14*z,np.y+32*z);
      }else{
        vctx.fillStyle=accent;vctx.beginPath();vctx.arc(np.x+Math.max(5,hw/2),np.y+Math.max(5,hh/2),Math.max(2,Math.min(5,Math.min(hw,hh)/4)),0,Math.PI*2);vctx.fill();
      }
    }
  }
  for(const h of S.hosts){
    const linkedDev=devById(hostConnectedDeviceId(h)||'');
    if(!linkedDev||!v5ShowHost(h)||!v5ShowDevice(linkedDev))continue;
    let p=h.portRef?S.ports.find(x=>x.id===h.portRef):null;
    if(!p && (h.portAssignMode||'auto')==='auto'){
      const suggested=suggestHostPort(linkedDev.id,h.id);
      p=suggested?S.ports.find(x=>x.id===suggested):null;
    }
    const hb=visualNodeBounds('host',h.id), db=visualNodeBounds('dev',linkedDev.id);
    const start={x:hb.x, y:hb.y+hb.h/2};
    const end={x:db.x+db.w, y:db.y+db.h/2};
    const ph=v2s(start.x,start.y), pd=v2s(end.x,end.y);
    vctx.lineWidth=2.6;
    vctx.strokeStyle='rgba(196,181,253,1)';
    vctx.beginPath();
    vctx.moveTo(ph.x,ph.y);
    const midX=(ph.x+pd.x)/2;
    vctx.bezierCurveTo(midX,ph.y,midX,pd.y,pd.x,pd.y);
    vctx.stroke();
    const mx=(ph.x+pd.x)/2,my=(ph.y+pd.y)/2;
    const accent=deviceAccentColor(linkedDev.id);
    v5DrawLinkDot(mx,my,h,linkedDev,p,accent);
  }
}
function fitV5(centerOnly=true){ensureVisualModel();let minx=1e9,miny=1e9,maxx=-1e9,maxy=-1e9;for(const loc of vLocs()){const b=visualLocBounds(loc);minx=Math.min(minx,b.x);miny=Math.min(miny,b.y);maxx=Math.max(maxx,b.x+b.w);maxy=Math.max(maxy,b.y+b.h);}if(!isFinite(minx)){vv().view={px:60,py:50,zoom:1};drawV5();return;}const r=vcv.parentElement.getBoundingClientRect();const padx=24,pady=24;const zw=Math.max(.45,Math.min(1.25,(r.width-padx*2)/(maxx-minx||1)));const zh=Math.max(.45,Math.min(1.25,(r.height-pady*2)/(maxy-miny||1)));const zoom=Math.min(zw,zh);vv().view.zoom=zoom;vv().view.px=padx-minx*zoom+(r.width-(maxx-minx)*zoom-padx*2)/2;vv().view.py=pady-miny*zoom+(r.height-(maxy-miny)*zoom-pady*2)/2;drawV5();}
function visualResizeHandleHit(wx,wy){
  for(const loc of [...vLocs()].reverse()){
    const b=visualLocBounds(loc),hs=16/vv().view.zoom,hx=b.x+b.w-hs-8/vv().view.zoom,hy=b.y+b.h-hs-8/vv().view.zoom;
    if(wx>=hx&&wx<=hx+hs&&wy>=hy&&wy<=hy+hs)return{t:'loc-resize',id:loc.id};
  }
  return null;
}
function visualHit(wx,wy){const rh=visualResizeHandleHit(wx,wy);if(rh)return rh;for(const h of [...S.hosts].reverse()){if(!v5ShowHost(h))continue;const b=visualNodeBounds('host',h.id);if(wx>=b.x&&wx<=b.x+b.w&&wy>=b.y&&wy<=b.y+b.h)return{t:'host',id:h.id};}for(const d of [...S.devices].reverse()){if(!v5ShowDevice(d))continue;const b=visualNodeBounds('dev',d.id);if(wx>=b.x&&wx<=b.x+b.w&&wy>=b.y&&wy<=b.y+b.h)return{t:'device',id:d.id};}for(const loc of [...vLocs()].reverse()){const b=visualLocBounds(loc);if(wx>=b.x&&wx<=b.x+b.w&&wy>=b.y&&wy<=b.y+b.h)return{t:'loc',id:loc.id};}return null;}
function locAt(wx,wy){for(const loc of [...vLocs()].reverse()){const b=visualLocBounds(loc);if(wx>=b.x&&wx<=b.x+b.w&&wy>=b.y&&wy<=b.y+b.h)return loc;}return null;}
function removeV5Location(id){ensureVisualModel();if(vLocs().length<2)return alert('Debe quedar al menos una ubicación.');deletePhysicalLocation(id,true);}
function v5UpdateLocationSize(id,key,val){const l=vLocById(id);if(!l)return;const num=Math.max(key==='w'?330:160,Number(val)||0);l[key]=num;save();drawV5();}
function addV5Location(){ensureVisualModel();const idx=vLocs().length+1;vLocs().push({id:uid('loc'),name:'Ubicación '+idx,color:'#12324f',x:80+(idx-1)*310,y:90+((idx-1)%2)*240,w:Math.max(330,V5S.colW*2+36),h:Math.max(170,V5S.locHead+24+72)});save();renderV5Panel();drawV5();}
function v5UpdateLocationMeta(id,key,val){const l=vLocById(id);if(!l)return;l[key]=val;save();drawV5();}
function v5Field(label, control){
  const box=makeEl('div',''); const lab=makeEl('label','fl',label); box.append(lab,control); return box;
}
function v5Input(value,onInput,type='text'){
  const input=document.createElement('input'); input.type=type; input.value=value??''; input.addEventListener('input',e=>onInput&&onInput(e.target.value)); return input;
}
function v5Select(options,value,onChange){
  const sel=document.createElement('select');
  options.forEach(o=>sel.appendChild(makeOption(o.value,o.label,String(o.value)===String(value))));
  sel.value=value??'';
  sel.addEventListener('change',e=>onChange&&onChange(e.target.value));
  return sel;
}
function v5Row(cls,...items){ const row=makeEl('div',cls||'v5-row2'); items.forEach(i=>row.appendChild(i)); return row; }
function v5Button(label,fn,cls='btn bs bsm'){ const b=makeEl('button',cls,label); b.type='button'; b.addEventListener('click',fn); return b; }
function v5Meta(...items){ const m=makeEl('div','v5-meta'); items.forEach(([cls,text])=>m.appendChild(makeEl('span',cls,text))); return m; }
function v5ListItem(icon,title,mini,fn){ const item=makeEl('div','v5-item'); item.style.cursor='pointer'; item.addEventListener('click',fn); appendText(item,icon+' '); const b=makeEl('b','',title); item.appendChild(b); if(mini!==undefined)item.appendChild(makeEl('div','v5-mini',mini)); return item; }
function appendV5Controls(box){
  const brow=makeEl('div','brow'); brow.style.margin='0 0 10px 0';
  brow.append(v5Button('📍 Nueva ubicación',()=>addV5Location()),v5Button(vv().fs?'🗗 Salir pantalla completa':'⛶ Pantalla completa',()=>toggleV5Fullscreen()),v5Button(v5ProMode()?'🧱 Profesional ON':'🧱 Profesional OFF',()=>setV5ProMode(!v5ProMode())));
  box.appendChild(brow);
}
function renderPortEditorDom(d){
  const ports=portsByDev(d.id).sort((a,b)=>(a.position||999)-(b.position||999)||a.name.localeCompare(b.name));
  if(!ports.length)return makeEl('div','v5-empty','Este equipo no tiene puertos definidos todavía.');
  const wrap=makeEl('div','v5-ports');
  const vlanOpts=(selected)=>[{value:'',label:'—'}].concat(S.vlans.slice().sort((a,b)=>a.vlanId-b.vlanId).map(v=>({value:v.id,label:`VLAN ${v.vlanId} — ${v.name||''}`})));
  ports.forEach(p=>{
    const card=makeEl('div','v5-port'); card.appendChild(makeEl('h4','',p.name||p.id));
    card.appendChild(v5Row('v5-row3',
      v5Field('Nombre',v5Input(p.name||'',v=>v5UpdatePort(p.id,'name',v))),
      v5Field('Medio',v5Select([{value:'FE',label:'FE'},{value:'GE',label:'GE'},{value:'SFP',label:'SFP'}],p.media||'GE',v=>v5UpdatePort(p.id,'media',v))),
      v5Field('Modo',v5Select([{value:'access',label:'access'},{value:'trunk',label:'trunk'},{value:'layer3',label:'layer3'}],p.mode||'access',v=>v5UpdatePort(p.id,'mode',v)))
    ));
    card.appendChild(v5Row('v5-row3',
      v5Field('VLAN access',v5Select(vlanOpts(p.accessVlanRef),p.accessVlanRef||'',v=>v5UpdatePort(p.id,'accessVlanRef',v||null))),
      v5Field('Rol',v5Input(p.role||'',v=>v5UpdatePort(p.id,'role',v||null))),
      v5Field('Descripción',v5Input(p.desc||'',v=>v5UpdatePort(p.id,'desc',v||null)))
    ));
    wrap.appendChild(card);
  });
  return wrap;
}
function renderV5Panel(){
  const box=$('v5Panel');if(!box)return;ensureVisualModel();clearNode(box);const sel=vv().sel;
  if(!sel){
    box.appendChild(makeEl('div','card-t','Panel V5'));
    const br=makeEl('div','brow'); br.style.margin='0 0 10px 0'; br.append(v5Button('📍 Nueva ubicación',()=>addV5Location()),v5Button('⊞ Ajustar vista',()=>fitV5()),v5Button(vv().fs?'🗗 Salir pantalla completa':'⛶ Pantalla completa',()=>toggleV5Fullscreen())); box.appendChild(br);
    const br2=makeEl('div','brow'); br2.style.margin='0 0 10px 0'; br2.appendChild(v5Button(v5ProMode()?'🧱 Modo profesional: ON':'🧱 Modo profesional: OFF',()=>setV5ProMode(!v5ProMode()))); box.appendChild(br2);
    box.appendChild(makeEl('div','v5-empty','Selecciona una ubicación, un dispositivo o un host para retocarlo usando los datos ya construidos en V4.'));
    box.appendChild(makeEl('div','v5-note',v5ProMode()?'Modo profesional activo: las sububicaciones se muestran anidadas y heredan su contenedor superior.':'Modo libre activo: puedes mover y redimensionar ubicaciones sin jerarquía visual automática.'));
    const list=makeEl('div','v5-list'); vLocs().forEach(l=>list.appendChild(v5ListItem('',`${'· '.repeat(vLocDepth(l.id))}${l.name}`,`${devsInVisualLoc(l.id).length} equipos · ${hostsInVisualLoc(l.id).length} hosts`,()=>selectV5('loc',l.id)))); box.appendChild(list);
    return;
  }
  if(sel.t==='loc'){
    const l=vLocById(sel.id);if(!l)return;
    box.appendChild(makeEl('div','card-t',`📍 ${l.name}`)); appendV5Controls(box);
    box.appendChild(v5Meta(['b bac',`${devsInVisualLoc(l.id).length} equipos`],['b bgr',`${hostsInVisualLoc(l.id).length} hosts`],['b byw',`${vLocChildren(l.id).length} sububicaciones`]));
    box.appendChild(v5Row('v5-row2',v5Field('Nombre',v5Input(l.name||'',v=>v5UpdateLocationMeta(l.id,'name',v))),v5Field('Color',v5Input(l.color||'#10233c',v=>v5UpdateLocationMeta(l.id,'color',v),'color'))));
    box.appendChild(v5Row('v5-row3',
      v5Field('Ancho',v5Input(Math.round(visualLocBounds(l).w),v=>v5UpdateLocationSize(l.id,'w',v),'number')),
      v5Field('Alto',v5Input(Math.round(visualLocBounds(l).h),v=>v5UpdateLocationSize(l.id,'h',v),'number')),
      v5Field('Etiquetas enlaces',v5Select([{value:'compact',label:'Compactas'},{value:'full',label:'Completas'}],vv().compactLabels===false?'full':'compact',v=>{vv().compactLabels=v==='compact'; save(); drawV5(); renderV5Panel();}))
    ));
    const br=makeEl('div','brow'); br.append(v5Button('🗑 Eliminar ubicación',()=>removeV5Location(l.id)),v5Button('⊞ Centrar',()=>fitV5())); box.appendChild(br);
    box.appendChild(makeEl('div','v5-note',v5ProMode()&&l.parentId?'Esta sububicación se dibuja anidada dentro de su ubicación superior.':'Puedes reorganizar esta ubicación libremente o usar el modo profesional para anidarla visualmente.'));
    const list=makeEl('div','v5-list');
    devsInVisualLoc(l.id).forEach(d=>list.appendChild(v5ListItem('🔀',d.name||d.id,`${d.type||''} · ${d.mgmtIp||'sin mgmt'}`,()=>selectV5('device',d.id))));
    hostsInVisualLoc(l.id).forEach(h=>{const v=vByRef(h.vlanRef);list.appendChild(v5ListItem('💻',h.name||h.id,`${v?('VLAN '+v.vlanId+' · '+v.name):'Sin VLAN'} · ${effectiveHostIp(h)}`,()=>selectV5('host',h.id)));});
    box.appendChild(list); return;
  }
  if(sel.t==='device'){
    const d=devById(sel.id);if(!d)return;
    box.appendChild(makeEl('div','card-t',`🧩 ${d.name||d.id}`));
    box.appendChild(v5Row('v5-row2',
      v5Field('Nombre',v5Input(d.name||'',v=>v5UpdateDevice(d.id,'name',v))),
      v5Field('Ubicación visual',v5Select(vLocs().map(l=>({value:l.id,label:l.name})),deviceVisualLoc(d.id),v=>{setDeviceVisualLoc(d.id,v);vv().pos[d.id]=nextNodePositionInLoc(v,'device',d.id);v5ApplyRefresh({t:'device',id:d.id});}))
    ));
    box.appendChild(v5Row('v5-row3',
      v5Field('Tipo',v5Select([{value:'switch',label:'switch'},{value:'router',label:'router'},{value:'firewall',label:'firewall'}],d.type||'switch',v=>v5UpdateDevice(d.id,'type',v))),
      v5Field('Gestión',v5Input(d.mgmtIp||'',v=>v5UpdateDevice(d.id,'mgmtIp',v))),
      v5Field('Vendor/OS',v5Select(ALL_VENDORS.map(v=>({value:v.id,label:v.l})),d.vendorOs||'',v=>v5UpdateDevice(d.id,'vendorOs',v)))
    ));
    box.appendChild(v5Row('v5-row2',v5Field('Internet edge',v5Select([{value:'no',label:'No'},{value:'yes',label:'Sí'}],d.internetEdge==='yes'?'yes':'no',v=>v5UpdateDevice(d.id,'internetEdge',v))),v5Field('WAN IF',v5Input(d.wanIf||'',v=>v5UpdateDevice(d.id,'wanIf',v||null)))));
    box.append(v5Field('Notas',v5Input(d.notes||'',v=>v5UpdateDevice(d.id,'notes',v))),v5Meta(['b bac',d.type||''],['b bgr',`${portsByDev(d.id).length} puertos`],['b bgr',d.vendorOs||'—']),makeEl('div','v5-note','Todos los cambios aquí alimentan la configuración generada en la V4.'),makeEl('div','card-t','Puertos del equipo'),renderPortEditorDom(d));
    return;
  }
  if(sel.t==='host'){
    const h=S.hosts.find(x=>x.id===sel.id);if(!h)return;
    const vlan=vByRef(h.vlanRef);const linkedDev=devById(hostConnectedDeviceId(h)||'');
    box.appendChild(makeEl('div','card-t',`🖥 ${h.name||h.id}`));
    box.appendChild(v5Row('v5-row2',
      v5Field('Nombre',v5Input(h.name||'',v=>v5UpdateHost(h.id,'name',v))),
      v5Field('Ubicación en esquema',v5Select([{value:'',label:'Automática / según equipo'}].concat(vLocs().map(l=>({value:l.id,label:l.name}))),hostVisualLoc(h.id)||'',v=>{setHostVisualLoc(h.id,v);vv().pos[h.id]=nextNodePositionInLoc(v||deviceVisualLoc(linkedDev?.id||'')||vLocs()[0]?.id,'host',h.id);v5ApplyRefresh({t:'host',id:h.id});}))
    ));
    box.appendChild(v5Row('v5-row3',
      v5Field('Tipo',v5Select(Object.entries(HT).map(([k,v])=>({value:k,label:v.l})),h.type||'pc',v=>v5UpdateHost(h.id,'type',v))),
      v5Field('VLAN',v5Select([{value:'',label:'— sin VLAN —'}].concat(S.vlans.slice().sort((a,b)=>a.vlanId-b.vlanId).map(v=>({value:v.id,label:`VLAN ${v.vlanId} — ${v.name||''}`}))),h.vlanRef||'',v=>v5UpdateHost(h.id,'vlanRef',v||null))),
      v5Field('Modo IP',v5Select([{value:'dhcp',label:'DHCP'},{value:'static',label:'Static'}],h.ipMode||'dhcp',v=>v5UpdateHost(h.id,'ipMode',v)))
    ));
    box.appendChild(v5Row('v5-row3',v5Field('IP estática',v5Input(h.staticIp||'',v=>v5UpdateHost(h.id,'staticIp',v))),v5Field('MAC',v5Input(h.mac||'',v=>v5UpdateHost(h.id,'mac',v))),v5Field('Ubicación física',v5Input(h.physicalLocation||'',v=>v5UpdateHost(h.id,'physicalLocation',v)))));
    box.appendChild(v5Row('v5-row3',
      v5Field('Equipo conectado',v5Select([{value:'',label:'— sin equipo —'}].concat(connectableDevices().map(d=>({value:d.id,label:`${d.name} · ${d.type||'equipo'}`}))),hostConnectedDeviceId(h)||'',v=>{v5UpdateHost(h.id,'connectedDeviceId',v||null); if(v && (S.hosts.find(x=>x.id===h.id)?.portAssignMode||'auto')==='auto')v5UpdateHostPort(h.id,suggestHostPort(v,h.id)||''); else v5ApplyRefresh({t:'host',id:h.id});})),
      v5Field('Modo puerto',v5Select([{value:'auto',label:'Automático'},{value:'manual',label:'Manual'}],h.portAssignMode||'manual',v=>{v5UpdateHost(h.id,'portAssignMode',v); if(v==='auto')v5UpdateHostPort(h.id,suggestHostPort(hostConnectedDeviceId(S.hosts.find(x=>x.id===h.id)),h.id)||''); else v5ApplyRefresh({t:'host',id:h.id});})),
      v5Field('Puerto asociado',v5Select([{value:'',label:'— sin puerto —'}].concat(hostAssignablePorts(hostConnectedDeviceId(h)||'').map(p=>({value:p.id,label:`${p.name}${hostPortUsedByOther(p.id,h.id)?' · ocupado':''}`}))),h.portRef||'',v=>v5UpdateHostPort(h.id,v)))
    ));
    box.append(v5Field('Notas',v5Input(h.notes||'',v=>v5UpdateHost(h.id,'notes',v))),v5Meta(['b bac',h.type||'host'],['b bgr',vlan?('VLAN '+vlan.vlanId):'sin vlan'],['b bgr',effectiveHostIp(h)],['b bpu',linkedDev?linkedDev.name:'sin equipo']));
    return;
  }
}
function selectV5(t,id){vv().sel={t,id};renderV5Panel();drawV5();}
function v5CanvasPoint(evt){const r=vcv.getBoundingClientRect();const clientX=evt.clientX ?? (evt.touches&&evt.touches[0]&&evt.touches[0].clientX) ?? 0;const clientY=evt.clientY ?? (evt.touches&&evt.touches[0]&&evt.touches[0].clientY) ?? 0;return s2v(clientX-r.left,clientY-r.top);}
function v5PointerDown(evt){
  const pt=v5CanvasPoint(evt);
  const hit=visualHit(pt.x,pt.y);
  if(hit){
    selectV5(hit.t==='loc-resize'?'loc':hit.t,hit.id);
    if(hit.t==='loc-resize'){
      const loc=vLocById(hit.id),b=visualLocBounds(loc);
      vdrag={t:'loc-resize',id:hit.id,startW:b.w,startH:b.h,startX:pt.x,startY:pt.y,downX:pt.x,downY:pt.y,moved:false};
    }else if(hit.t==='loc'){
      const loc=vLocById(hit.id);
      const members=[...devsInVisualLoc(hit.id).map(d=>({id:d.id,pos:{...(vv().pos[d.id]||{x:0,y:0})}})),...hostsInVisualLoc(hit.id).map(h=>({id:h.id,pos:{...(vv().pos[h.id]||{x:0,y:0})}}))];
      vdrag={t:'loc',id:hit.id,dx:pt.x-loc.x,dy:pt.y-loc.y,startX:loc.x,startY:loc.y,members,downX:pt.x,downY:pt.y,moved:false};
    }else{
      const b=visualNodeBounds(hit.t==='device'?'dev':'host',hit.id);
      vdrag={t:hit.t,id:hit.id,dx:pt.x-b.x,dy:pt.y-b.y,fromLoc:hit.t==='device'?deviceVisualLoc(hit.id):hostVisualLoc(hit.id),startPos:{...(vv().pos[hit.id]||{x:b.x,y:b.y})},downX:pt.x,downY:pt.y,moved:false};
    }
  }else{
    vv().sel=null;
    renderV5Panel();
    vdrag={t:'pan',startPx:vv().view.px,startPy:vv().view.py,startX:evt.clientX||0,startY:evt.clientY||0,downX:pt.x,downY:pt.y,moved:false};
  }
  if(vdrag&&(vdrag.t==='device'||vdrag.t==='host'))v5FreezeAutoBounds(true);
  vcv.classList.add('dragging');
  if(vcv.setPointerCapture&&evt.pointerId!=null)vcv.setPointerCapture(evt.pointerId);
}
function v5PointerMove(evt){
  if(!vdrag)return;
  if(vdrag.t==='pan'){
    const dx=(evt.clientX||0)-vdrag.startX, dy=(evt.clientY||0)-vdrag.startY;
    if(Math.abs(dx)+Math.abs(dy)>2)vdrag.moved=true;
    vv().view.px=vdrag.startPx+dx;
    vv().view.py=vdrag.startPy+dy;
    drawV5();
    return;
  }
  const pt=v5CanvasPoint(evt);
  if(Math.hypot(pt.x-vdrag.downX,pt.y-vdrag.downY)>4)vdrag.moved=true;
  if(vdrag.t==='loc-resize'){
    const loc=vLocById(vdrag.id);
    if(loc&&vdrag.moved){loc.w=Math.max(330,vdrag.startW+(pt.x-vdrag.startX));loc.h=Math.max(160,vdrag.startH+(pt.y-vdrag.startY));drawV5();renderV5Panel();}
  }else if(vdrag.t==='loc'){
    const loc=vLocById(vdrag.id);
    if(loc&&vdrag.moved){const nx=pt.x-vdrag.dx,ny=pt.y-vdrag.dy,deltaX=nx-vdrag.startX,deltaY=ny-vdrag.startY;loc.x=nx;loc.y=ny;for(const m of (vdrag.members||[])){vv().pos[m.id]={x:m.pos.x+deltaX,y:m.pos.y+deltaY};}drawV5();}
  }else if(vdrag.moved){
    vv().pos[vdrag.id]={x:pt.x-vdrag.dx,y:pt.y-vdrag.dy};
    const over=locAt(pt.x,pt.y);
    vdrag.overLoc=over?over.id:null;
    drawV5();
  }
}
function v5PointerUp(evt){
  if(!vdrag)return;
  const d=vdrag;
  vdrag=null;
  if(d&&(d.t==='device'||d.t==='host'))v5FreezeAutoBounds(false);
  vcv.classList.remove('dragging');
  if(d.t==='pan'){
    save();
    drawV5();
    return;
  }
  if(d.t==='loc-resize'){
    save();drawV5();renderV5Panel();return;
  }
  if(d.t==='device'||d.t==='host'){
    if(!d.moved){vv().pos[d.id]=d.startPos||vv().pos[d.id];drawV5();renderV5Panel();return;}
    const targetId=d.overLoc||d.fromLoc;
    const over=targetId?vLocById(targetId):null;
    if(over){
      if(d.t==='device'){
        setDeviceVisualLoc(d.id,over.id);
        if(over.id!==d.fromLoc)vv().pos[d.id]=nextNodePositionInLoc(over.id,'device',d.id);
      }else{
        const h=S.hosts.find(x=>x.id===d.id);
        setHostVisualLoc(d.id,over.id);
        if(over.id!==d.fromLoc){
          vv().pos[d.id]=nextNodePositionInLoc(over.id,'host',d.id);
          const res=autoAssignHostToLocation(d.id,over.id);
          if(res.ok){
            const dev=devById(res.deviceId), port=S.ports.find(p=>p.id===res.portId);
            if(port) vv().pos[d.id]=nextNodePositionInLoc(over.id,'host',d.id);
            if(h) h.notes = h.notes || '';
          }else if(res.reason && res.reason!=='Modo manual'){
            console.warn('[NetWizard V5] Autoasignación no aplicada:', res.reason);
          }
        }
      }
    }
    save();refresh();selectV5(d.t,d.id);
  }else{
    save();drawV5();
  }
}
function v5Wheel(evt){
  if(!vcv || !vv().view)return;
  evt.preventDefault();
  const r=vcv.getBoundingClientRect();
  const sx=evt.clientX-r.left, sy=evt.clientY-r.top;
  const before=s2v(sx,sy);
  const factor=evt.deltaY<0?1.12:0.89;
  const next=Math.max(.25,Math.min(2.8,vv().view.zoom*factor));
  vv().view.zoom=next;
  vv().view.px=sx-before.x*next;
  vv().view.py=sy-before.y*next;
  drawV5();
}
vcv.addEventListener('pointerdown',v5PointerDown);
vcv.addEventListener('pointermove',v5PointerMove);
vcv.addEventListener('mousemove',v5HoverMove);
vcv.addEventListener('mouseleave',v5HideLinkTooltip);
vcv.addEventListener('pointerup',v5PointerUp);
vcv.addEventListener('pointercancel',v5PointerUp);
vcv.addEventListener('lostpointercapture',v5PointerUp);
vcv.addEventListener('wheel',v5Wheel,{passive:false});
window.addEventListener('keydown',e=>{if(e.key==='Escape'&&vv().fs)toggleV5Fullscreen(false);});
document.addEventListener('fullscreenchange',syncV5FullscreenState);
document.addEventListener('change',e=>{const cb=e.target.closest('[data-v5-filter]');if(cb)v5SetFilter(cb.dataset.v5Filter,cb.checked);});
window.addEventListener('resize',()=>{if(S.step==='graphs')resizeV5();});
// ─────────────────── MAIN REFRESH ───────────────────


// =========================================================
// 15. REFRESH GLOBAL E INICIALIZACIÓN
// Refresh central que re-renderiza la aplicación tras cambios de estado. Event listeners quedan antes de este bloque.
// =========================================================
function refresh(){
  initDeviceModelList();
  renderNav();
  renderDash();
  renderWizard();
  fillPortDevSel();
  updatePortRoleOpts();
  renderDevs();
  renderPortsList();
  renderVlans();renderSubnets();fillVlanSels();updManualSnHint();
  renderPhysicalLocations();fillPhysicalLocationParentSel($('plEditId')?.value||'');fillHostDeviceSel();fillHostPortSel();fillHostLocSel();fillHostPhysLocSel();updateHostDeviceHint();renderHosts();renderIpMap();
  fillSwDevSels();fillLinkPickers();renderVisPorts();renderLinks();
  renderFwRules();renderVlanMatrix();
  ['secBpdu','secPs','secDs','secDai','secIpsg'].forEach(id=>{const k=id.replace('sec','').toLowerCase();if($(id))$(id).value=S.security[k]||'no';});
  $('secBpdu').value=S.security.bpdu||'yes';$('secPs').value=S.security.ps||'yes';$('secDs').value=S.security.ds||'yes';$('secDai').value=S.security.dai||'yes';
  $('secDsV').value=S.security.dsV||'';
  fillRoasSels();renderDhcp();renderDevPickCfg();renderVtp();
  if(S.step==='graphs'){drawTopo();resizeV5();renderV5Panel();}
  if(S.step==='cfg'){if(selDevCfg)selectDevCfg(selDevCfg);}
  if(window.NetWizardI18n&&window.NetWizardI18n.applyI18n)window.NetWizardI18n.applyI18n(document);
}

refresh();
