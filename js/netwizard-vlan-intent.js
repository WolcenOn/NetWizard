/* =========================================================
   NetWizard VLAN Intent v3.10
   Intención de red por VLAN y recomendaciones no destructivas.
   Cargable tanto en navegador clásico como en Node.js.
========================================================= */
(function initNetWizardVlanIntent(root){
  'use strict';

  const TYPES = {
    users:      { label:'Usuarios',     dhcp:true,  internet:true,  isolation:'standard',   hosts:30, growth:10, notes:'Puestos de trabajo y dispositivos personales corporativos.' },
    servers:    { label:'Servidores',   dhcp:false, internet:false, isolation:'restricted', hosts:10, growth:5,  notes:'Servidores con IP estática y acceso controlado.' },
    iot:        { label:'IoT',          dhcp:true,  internet:false, isolation:'isolated',   hosts:50, growth:25, notes:'Sensores, gateways y dispositivos con mínimos privilegios.' },
    guests:     { label:'Invitados',    dhcp:true,  internet:true,  isolation:'isolated',   hosts:25, growth:20, notes:'Clientes o invitados, sin acceso a LAN interna.' },
    management: { label:'Gestión',      dhcp:false, internet:false, isolation:'restricted', hosts:8,  growth:4,  notes:'Administración de switches, routers, APs y servidores.' },
    voice:      { label:'Voz',          dhcp:true,  internet:false, isolation:'standard',   hosts:20, growth:10, notes:'Telefonía IP; suele requerir QoS y opción DHCP específica.' },
    cameras:    { label:'Cámaras',      dhcp:true,  internet:false, isolation:'isolated',   hosts:30, growth:15, notes:'CCTV/NVR; permitir solo hacia grabador y servicios básicos.' },
    dmz:        { label:'DMZ',          dhcp:false, internet:true,  isolation:'restricted', hosts:6,  growth:2,  notes:'Servicios publicados; reglas explícitas entrantes/salientes.' },
    transit:    { label:'Tránsito L3',  dhcp:false, internet:false, isolation:'restricted', hosts:2,  growth:0,  notes:'Enlaces punto a punto o tránsito entre equipos L3.' },
    custom:     { label:'Personalizada',dhcp:true,  internet:false, isolation:'standard',   hosts:10, growth:5,  notes:'Ajusta manualmente según el caso.' }
  };

  const cleanStr = root.NetWizardCoreUtils && root.NetWizardCoreUtils.cleanStr ? root.NetWizardCoreUtils.cleanStr : (v => (v == null ? '' : String(v).trim()));
  const esc = root.NetWizardCoreUtils && root.NetWizardCoreUtils.escapeHtml ? root.NetWizardCoreUtils.escapeHtml : (s => cleanStr(s).replace(/[&<>\"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;'}[c]||c)));

  function clone(value){ return JSON.parse(JSON.stringify(value == null ? null : value)); }
  function arr(value){ return Array.isArray(value) ? value : []; }
  function asBool(value, fallback){
    if(value === true || value === 'true' || value === 'yes' || value === '1' || value === 1) return true;
    if(value === false || value === 'false' || value === 'no' || value === '0' || value === 0) return false;
    return !!fallback;
  }
  function asInt(value, fallback, min, max){
    const n = parseInt(value, 10);
    let out = Number.isFinite(n) ? n : fallback;
    if(Number.isFinite(min)) out = Math.max(min, out);
    if(Number.isFinite(max)) out = Math.min(max, out);
    return out;
  }
  function typeDefaults(type){ return TYPES[type] || TYPES.custom; }

  function inferTypeFromName(name){
    const n = cleanStr(name).toLowerCase();
    if(/iot|sensor|sensores|zigbee|lora|thread|ble/.test(n)) return 'iot';
    if(/guest|invit|public|cliente|wifi.?public/.test(n)) return 'guests';
    if(/mgmt|gest|admin|management|infra/.test(n)) return 'management';
    if(/server|srv|servidor|dmz/.test(n)) return /dmz/.test(n) ? 'dmz' : 'servers';
    if(/voice|voz|phone|telefon/.test(n)) return 'voice';
    if(/cam|cctv|video|nvr/.test(n)) return 'cameras';
    if(/transit|p2p|wan|uplink/.test(n)) return 'transit';
    if(/user|usuario|emplead|lan|pc/.test(n)) return 'users';
    return 'custom';
  }

  function normalizeIntent(intent, vlan){
    const src = intent && typeof intent === 'object' ? intent : {};
    const inferred = inferTypeFromName((vlan && vlan.name) || '');
    const type = TYPES[src.type] ? src.type : inferred;
    const def = typeDefaults(type);
    const expectedHosts = asInt(src.expectedHosts, def.hosts, 0, 1000000);
    const growthHosts = asInt(src.growthHosts, def.growth, 0, 1000000);
    return {
      type,
      label: cleanStr(src.label || def.label).slice(0, 80),
      expectedHosts,
      growthHosts,
      dhcp: asBool(src.dhcp, def.dhcp),
      internet: asBool(src.internet, def.internet),
      isolation: ['standard','restricted','isolated'].includes(src.isolation) ? src.isolation : def.isolation,
      criticality: ['low','normal','high'].includes(src.criticality) ? src.criticality : (type==='management'||type==='servers'||type==='dmz' ? 'high' : 'normal'),
      notes: cleanStr(src.notes || '').slice(0, 500)
    };
  }

  function ensureProjectIntents(project){
    const next = clone(project || {});
    next.vlans = arr(next.vlans).map(v => ({ ...v, intent: normalizeIntent(v.intent, v) }));
    return next;
  }

  function intentNeedsForVlan(project, vlan){
    const intent = normalizeIntent(vlan && vlan.intent, vlan);
    const actualHosts = arr(project.hosts).filter(h => h.vlanRef === vlan.id).length;
    const accessPorts = arr(project.ports).filter(p => p.mode === 'access' && p.accessVlanRef === vlan.id).length;
    const iot = project.iot ? arr(project.iot.devices).filter(d => d.vlanRef === vlan.id || d.segmentVlanRef === vlan.id).length : 0;
    const observed = Math.max(actualHosts + iot, Math.ceil(accessPorts * 0.75));
    const required = Math.max(2, observed, intent.expectedHosts + intent.growthHosts);
    return { vlanRef:vlan.id, vlanId:vlan.vlanId, name:vlan.name, hostsRequired:required, intent, observed, notes:`intención=${intent.expectedHosts}+${intent.growthHosts}, observados=${observed}` };
  }

  function inferVlanNeeds(project){
    return arr((project || {}).vlans).map(v => intentNeedsForVlan(project || {}, v));
  }

  function recommendForVlan(project, vlan){
    const intent = normalizeIntent(vlan && vlan.intent, vlan);
    const recs = [];
    const type = intent.type;
    const sn = arr((project || {}).subnets).find(s => s.vlanRef === vlan.id);
    const dhcpCfg = ((project || {}).dhcp || {})[String(vlan.vlanId)] || {};

    recs.push({severity:'info', category:'sizing', message:`Dimensionar para al menos ${intent.expectedHosts + intent.growthHosts} hosts (${intent.expectedHosts} previstos + ${intent.growthHosts} crecimiento).`});
    if(intent.dhcp){
      if(!sn) recs.push({severity:'warning', category:'dhcp', message:'DHCP recomendado, pero falta subnet/gateway.'});
      else if(!dhcpCfg.enabled) recs.push({severity:'warning', category:'dhcp', message:'DHCP recomendado para esta VLAN; activa scope DHCP cuando la subnet esté validada.'});
      else recs.push({severity:'info', category:'dhcp', message:'DHCP activo; revisa DNS, lease y exclusiones.'});
    } else {
      recs.push({severity:'info', category:'addressing', message:'Preferible IP estática o reservas DHCP controladas.'});
    }

    if(intent.isolation === 'isolated') recs.push({severity:'warning', category:'security', message:'Aislar de otras VLANs internas salvo servicios explícitos necesarios.'});
    if(intent.isolation === 'restricted') recs.push({severity:'warning', category:'security', message:'Permitir solo flujos necesarios; evitar any-any inter-VLAN.'});
    if(intent.internet) recs.push({severity:'info', category:'policy', message:'Permitir salida a Internet/NAT según política.'});
    else recs.push({severity:'info', category:'policy', message:'No requiere Internet por defecto; permitir solo DNS/NTP/repositorios si aplica.'});

    if(type === 'iot') recs.push({severity:'warning', category:'policy', message:'Permitir IoT solo hacia broker MQTT/gateway, DNS y NTP; bloquear acceso lateral.'});
    if(type === 'guests') recs.push({severity:'warning', category:'policy', message:'Bloquear acceso a redes internas; permitir solo Internet y DNS/DHCP.'});
    if(type === 'management') recs.push({severity:'warning', category:'security', message:'Restringir a administradores; proteger SSH/HTTPS/SNMP y registrar accesos.'});
    if(type === 'servers') recs.push({severity:'warning', category:'policy', message:'Publicar servicios mediante reglas explícitas desde VLANs autorizadas.'});
    if(type === 'voice') recs.push({severity:'info', category:'qos', message:'Considerar QoS, LLDP/CDP y opciones DHCP de telefonía si aplica.'});
    if(type === 'cameras') recs.push({severity:'warning', category:'policy', message:'Permitir cámaras hacia NVR/servidor de vídeo; bloquear navegación lateral.'});
    if(type === 'dmz') recs.push({severity:'warning', category:'security', message:'Usar reglas inbound explícitas y denegar acceso directo desde DMZ a LAN.'});
    if(type === 'transit') recs.push({severity:'info', category:'routing', message:'Usar subred pequeña; normalmente /30 o /31 si los equipos lo soportan.'});
    return { vlanRef:vlan.id, vlanId:vlan.vlanId, name:vlan.name, intent, recommendations:recs };
  }

  function recommendProject(project){
    return arr((project || {}).vlans).map(v => recommendForVlan(project || {}, v));
  }

  function proposeDhcpUpdates(project){
    const dh = root.NetWizardDhcpUtils || (typeof require === 'function' ? tryRequireDhcp() : null);
    if(dh) return dh.proposeDhcpForProject(project || {}, {overwrite:false});
    const next = clone(project || {});
    next.dhcp = next.dhcp && typeof next.dhcp === 'object' ? next.dhcp : {};
    const changes = [];
    for(const v of arr(next.vlans)){
      const intent = normalizeIntent(v.intent, v);
      const key = String(v.vlanId);
      const before = next.dhcp[key] || {};
      if(intent.dhcp){
        next.dhcp[key] = { ...before, enabled:true, dns: before.dns || '8.8.8.8', lease: before.lease || (intent.type === 'guests' ? 8 : 1) };
        if(!before.enabled) changes.push(`Activar DHCP en VLAN ${v.vlanId} (${v.name || intent.label}).`);
      } else if(before.enabled && ['servers','management','dmz','transit'].includes(intent.type)){
        next.dhcp[key] = { ...before, enabled:false };
        changes.push(`Desactivar DHCP automático en VLAN ${v.vlanId} (${v.name || intent.label}).`);
      }
    }
    return {project:next, changes};
  }

  function tryRequireDhcp(){
    try { return require('./netwizard-dhcp-utils.js'); } catch { return null; }
  }

  function summarizeRecommendations(report){
    const lines = [];
    for(const item of arr(report)){
      lines.push(`VLAN ${item.vlanId} — ${item.name || item.intent.label}`);
      lines.push(`  Tipo: ${item.intent.label} · hosts: ${item.intent.expectedHosts}+${item.intent.growthHosts} · DHCP: ${item.intent.dhcp ? 'sí' : 'no'} · Internet: ${item.intent.internet ? 'sí' : 'no'} · Aislamiento: ${item.intent.isolation}`);
      for(const r of arr(item.recommendations)) lines.push(`  ${r.severity.toUpperCase()} [${r.category}] ${r.message}`);
      lines.push('');
    }
    return lines.join('\n').trim() || 'No hay VLANs definidas.';
  }

  function bindBrowserUi(){
    if(!root.document || !root.NetWizardState) return;
    const doc = root.document;
    const $ = id => doc.getElementById(id);
    function project(){ return root.NetWizardState.getSnapshot(); }
    function ensureCard(){
      const pg = $('pg-vlan');
      if(!pg || $('intentVlan')) return;
      const target = pg.querySelector('.g2 > div:last-child') || pg;
      const card = doc.createElement('div');
      card.className = 'card';
      const staticHtml = '<div class="card-h"><div class="card-t">🎯 Intención por VLAN</div><button class="btn bs bsm" id="btnIntentInfer">Inferir</button></div>'+
        '<div class="co co-ac" style="margin-bottom:9px;">Define el objetivo de cada VLAN para dimensionar VLSM y recibir recomendaciones de DHCP, aislamiento y políticas. No aplica reglas firewall automáticamente.</div>'+
        '<label class="fl">VLAN</label><select id="intentVlan"></select>'+
        '<div class="row"><div><label class="fl">Tipo</label><select id="intentType"></select></div><div><label class="fl">Criticidad</label><select id="intentCrit"><option value="low">Baja</option><option value="normal">Normal</option><option value="high">Alta</option></select></div></div>'+
        '<div class="row"><div><label class="fl">Hosts previstos</label><input id="intentHosts" type="number" min="0" value="10"></div><div><label class="fl">Crecimiento</label><input id="intentGrowth" type="number" min="0" value="5"></div></div>'+
        '<div class="row"><div><label class="fl">DHCP</label><select id="intentDhcp"><option value="1">Sí</option><option value="0">No</option></select></div><div><label class="fl">Internet</label><select id="intentInternet"><option value="1">Sí</option><option value="0">No</option></select></div></div>'+
        '<label class="fl">Aislamiento</label><select id="intentIsolation"><option value="standard">Estándar</option><option value="restricted">Restringido</option><option value="isolated">Aislado</option></select>'+
        '<label class="fl">Notas</label><textarea id="intentNotes" rows="2" placeholder="Requisitos especiales"></textarea>'+
        '<div class="brow"><button class="btn bp" id="btnIntentSave">Guardar intención</button><button class="btn bs" id="btnIntentReport">Recomendar</button><button class="btn bs" id="btnIntentDhcp">Proponer DHCP</button></div>'+
        '<pre class="cfg" id="intentOut" style="min-height:120px;white-space:pre-wrap;"></pre>';
      card.appendChild(doc.createRange().createContextualFragment(staticHtml));
      target.appendChild(card);
      const typeSel = $('intentType');
      typeSel.replaceChildren(...Object.entries(TYPES).map(([id,t]) => { const opt = doc.createElement('option'); opt.value = id; opt.textContent = t.label; return opt; }));
      $('intentVlan').onchange = loadSelected;
      $('intentType').onchange = () => { const t = typeDefaults($('intentType').value); $('intentDhcp').value = t.dhcp ? '1' : '0'; $('intentInternet').value = t.internet ? '1' : '0'; $('intentIsolation').value = t.isolation; if(!$('intentHosts').value) $('intentHosts').value = t.hosts; if(!$('intentGrowth').value) $('intentGrowth').value = t.growth; };
      $('btnIntentInfer').onclick = inferAll;
      $('btnIntentSave').onclick = saveIntent;
      $('btnIntentReport').onclick = report;
      $('btnIntentDhcp').onclick = applyDhcpProposal;
      syncVlanOptions();
    }
    function syncVlanOptions(){
      if(!$('intentVlan')) return;
      const p = project();
      const current = $('intentVlan').value;
      $('intentVlan').replaceChildren(...arr(p.vlans).sort((a,b)=>(a.vlanId||0)-(b.vlanId||0)).map(v => { const opt = doc.createElement('option'); opt.value = String(v.id || ''); opt.textContent = `${v.vlanId || ''} — ${v.name || ''}`; return opt; }));
      if(current && arr(p.vlans).some(v=>v.id===current)) $('intentVlan').value = current;
      loadSelected();
    }
    function selectedVlan(){ const p=project(); return arr(p.vlans).find(v=>v.id===$('intentVlan')?.value); }
    function loadSelected(){
      const v = selectedVlan();
      if(!v) { if($('intentOut')) $('intentOut').textContent='Crea una VLAN para definir su intención.'; return; }
      const intent = normalizeIntent(v.intent, v);
      $('intentType').value = intent.type;
      $('intentCrit').value = intent.criticality;
      $('intentHosts').value = intent.expectedHosts;
      $('intentGrowth').value = intent.growthHosts;
      $('intentDhcp').value = intent.dhcp ? '1' : '0';
      $('intentInternet').value = intent.internet ? '1' : '0';
      $('intentIsolation').value = intent.isolation;
      $('intentNotes').value = intent.notes || '';
    }
    function formIntent(){
      return normalizeIntent({
        type:$('intentType').value,
        criticality:$('intentCrit').value,
        expectedHosts:$('intentHosts').value,
        growthHosts:$('intentGrowth').value,
        dhcp:$('intentDhcp').value === '1',
        internet:$('intentInternet').value === '1',
        isolation:$('intentIsolation').value,
        notes:$('intentNotes').value || ''
      }, selectedVlan());
    }
    function saveIntent(){
      const v = selectedVlan(); if(!v) return;
      const next = project();
      const target = arr(next.vlans).find(x=>x.id===v.id); if(!target) return;
      target.intent = formIntent();
      root.NetWizardState.replaceProject(next, {source:'vlan-intent'});
      if($('intentOut')) $('intentOut').textContent = `Intención guardada para VLAN ${target.vlanId}.`;
    }
    function inferAll(){
      const next = ensureProjectIntents(project());
      root.NetWizardState.replaceProject(next, {source:'vlan-intent-infer'});
      if($('intentOut')) $('intentOut').textContent = 'Intenciones inferidas desde los nombres de VLAN. Revisa cada una antes de aplicar recomendaciones.';
      syncVlanOptions();
    }
    function report(){
      const p = ensureProjectIntents(project());
      if($('intentOut')) $('intentOut').textContent = summarizeRecommendations(recommendProject(p));
    }
    function applyDhcpProposal(){
      const p = ensureProjectIntents(project());
      const res = proposeDhcpUpdates(p);
      if(!res.changes.length){ if($('intentOut')) $('intentOut').textContent = 'No hay cambios DHCP sugeridos.'; return; }
      root.NetWizardState.replaceProject(res.project, {source:'vlan-intent-dhcp'});
      if($('intentOut')) $('intentOut').textContent = ['Cambios DHCP propuestos aplicados:', ...res.changes].join('\n');
    }
    function boot(){ ensureCard(); }
    if(doc.readyState==='loading') doc.addEventListener('DOMContentLoaded', boot); else boot();
    doc.addEventListener('nw:project:changed', ()=>setTimeout(()=>{ ensureCard(); syncVlanOptions(); },0));
  }

  const api = { version:'netwizard-vlan-intent-v1', TYPES, inferTypeFromName, normalizeIntent, ensureProjectIntents, intentNeedsForVlan, inferVlanNeeds, recommendForVlan, recommendProject, proposeDhcpUpdates, summarizeRecommendations };
  root.NetWizardVlanIntent = api;
  if(typeof module !== 'undefined' && module.exports) module.exports = api;
  bindBrowserUi();
})(typeof window !== 'undefined' ? window : globalThis);
