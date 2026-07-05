/* =========================================================
   NetWizard PoE Utils v3.21
   Auditoría prudente de alimentación PoE por dispositivo, puerto y host.
   Cargable tanto en navegador clásico como en Node.js.
========================================================= */

/*
Mantenimiento:
- El consumo PoE estimado debe ser editable por el usuario; no confiar solo en el tipo de host.
- En producción, distinguir entre falta de dato y sobrecarga demostrada.
*/
(function initNetWizardPoeUtils(root){
  'use strict';

  function arr(v){ return Array.isArray(v) ? v : []; }
  function lower(v){ return (v == null ? '' : String(v)).toLowerCase(); }
  function num(v){ const n = Number(v); return Number.isFinite(n) ? n : null; }
  function round1(v){ return Math.round(Number(v || 0) * 10) / 10; }

  const STANDARD_WATTS = {
    none: 0,
    af: 15.4,
    at: 30,
    bt: 60,
    bt60: 60,
    bt90: 90,
    passive24: 12,
    passive: 12,
    auto: null
  };

  const DEFAULT_HOST_WATTS = {
    ap: 18,
    camera: 12,
    phone: 7,
    iot: 5
  };

  function normalizePoeMode(value){
    const s = lower(value || 'auto').replace(/[^a-z0-9]/g, '');
    if(['no','off','none','disabled','disable'].includes(s)) return 'none';
    if(['8023af','poe','af'].includes(s)) return 'af';
    if(['8023at','poeplus','poe+', 'at'].map(x=>x.replace(/[^a-z0-9]/g,'')).includes(s)) return 'at';
    if(['8023bt','bt','bt60','poeplusplus','poe++'].map(x=>x.replace(/[^a-z0-9]/g,'')).includes(s)) return 'bt';
    if(['bt90','upoe','upoeplus','upoe+'].map(x=>x.replace(/[^a-z0-9]/g,'')).includes(s)) return 'bt90';
    if(['passive24','passive'].includes(s)) return s;
    return 'auto';
  }

  function defaultPowerForHostType(type){
    return DEFAULT_HOST_WATTS[lower(type)] || 0;
  }

  function hostRequiresPoe(host){
    const mode = normalizePoeMode(host && (host.poeMode || host.poe));
    if(mode === 'none') return false;
    if(host && (host.poeRequired === true || host.poeRequired === 'true' || host.poeRequired === 1 || host.poeRequired === '1')) return true;
    if(host && (host.poeRequired === false || host.poeRequired === 'false' || host.poeRequired === 0 || host.poeRequired === '0')) return false;
    return defaultPowerForHostType(host && host.type) > 0;
  }

  function hostPowerWatts(host){
    const explicit = num(host && (host.poeWatts != null ? host.poeWatts : host.powerWatts));
    if(explicit !== null && explicit >= 0) return explicit;
    return defaultPowerForHostType(host && host.type);
  }

  function portPoeCapacityWatts(port){
    const explicit = num(port && (port.poeWattsMax != null ? port.poeWattsMax : port.poeBudgetW));
    if(explicit !== null && explicit >= 0) return explicit;
    const mode = normalizePoeMode(port && (port.poeMode || port.poe));
    return STANDARD_WATTS[mode];
  }

  function devicePoeBudgetWatts(device){
    const explicit = num(device && (device.poeBudgetW != null ? device.poeBudgetW : device.poeBudgetWatts));
    return explicit !== null && explicit >= 0 ? explicit : null;
  }

  function inferPortIsCopper(port){
    const txt = [port && port.media, port && port.name, port && port.desc].filter(Boolean).join(' ').toLowerCase();
    if(/sfp|qsfp|fiber|fibra|optical|dac/.test(txt)) return false;
    return true;
  }

  function deviceById(project, id){ return arr(project && project.devices).find(d => d.id === id) || null; }
  function portById(project, id){ return arr(project && project.ports).find(p => p.id === id) || null; }
  function labelDevice(device){ return device && (device.name || device.id) || '?'; }
  function labelPort(project, port){ const d = deviceById(project, port && port.deviceId); return `${labelDevice(d)} ${port && (port.name || port.id) || '?'}`; }

  function createIssue(code, severity, message, extra){
    return Object.assign({code, severity, category:'poe', message, blocking:severity === 'error', source:'poe'}, extra || {});
  }

  function collectPoeLoads(project){
    const loadsByDevice = new Map();
    const loadsByPort = new Map();
    for(const host of arr(project && project.hosts)){
      if(!hostRequiresPoe(host)) continue;
      const port = host.portRef ? portById(project, host.portRef) : null;
      const watts = round1(hostPowerWatts(host));
      const load = {host, port, device:port ? deviceById(project, port.deviceId) : null, watts};
      if(port){
        loadsByPort.set(port.id, (loadsByPort.get(port.id) || 0) + watts);
        if(port.deviceId) loadsByDevice.set(port.deviceId, (loadsByDevice.get(port.deviceId) || 0) + watts);
      }
    }
    return {loadsByDevice, loadsByPort};
  }

  function validatePoe(project){
    const errors = [], warnings = [], info = [], issues = [];
    const {loadsByDevice, loadsByPort} = collectPoeLoads(project || {});

    for(const host of arr(project && project.hosts)){
      if(!hostRequiresPoe(host)) continue;
      const watts = round1(hostPowerWatts(host));
      if(watts <= 0){
        const msg = `Host ${host.name || host.id}: marcado como PoE pero sin consumo estimado.`;
        warnings.push(msg); issues.push(createIssue('NW-POE-001','warning',msg,{hostId:host.id}));
      }
      const port = host.portRef ? portById(project, host.portRef) : null;
      if(!port){
        const msg = `Host ${host.name || host.id}: requiere PoE pero no tiene puerto físico asociado.`;
        warnings.push(msg); issues.push(createIssue('NW-POE-002','warning',msg,{hostId:host.id}));
        continue;
      }
      if(!inferPortIsCopper(port)){
        const msg = `Host ${host.name || host.id}: requiere PoE pero está asociado a ${labelPort(project, port)}, que parece fibra/SFP/DAC.`;
        warnings.push(msg); issues.push(createIssue('NW-POE-003','warning',msg,{hostId:host.id, portId:port.id}));
      }
      const cap = portPoeCapacityWatts(port);
      const mode = normalizePoeMode(port.poeMode || port.poe);
      if(mode === 'none' || cap === 0){
        const msg = `${labelPort(project, port)}: host ${host.name || host.id} requiere PoE (${watts} W) pero el puerto está marcado sin PoE.`;
        errors.push(msg); issues.push(createIssue('NW-POE-004','error',msg,{hostId:host.id, portId:port.id}));
      } else if(cap !== null && watts > cap){
        const msg = `${labelPort(project, port)}: host ${host.name || host.id} requiere ${watts} W y el puerto soporta ${cap} W.`;
        errors.push(msg); issues.push(createIssue('NW-POE-005','error',msg,{hostId:host.id, portId:port.id}));
      } else if(cap === null){
        const msg = `${labelPort(project, port)}: host ${host.name || host.id} requiere ${watts} W; define estándar/capacidad PoE del puerto para validar.`;
        info.push(msg); issues.push(createIssue('NW-POE-006','info',msg,{hostId:host.id, portId:port.id}));
      }
    }

    for(const [portId, watts] of loadsByPort.entries()){
      const port = portById(project, portId);
      const cap = portPoeCapacityWatts(port);
      if(cap !== null && cap > 0 && watts > cap){
        const msg = `${labelPort(project, port)}: carga PoE total ${round1(watts)} W supera capacidad de puerto ${cap} W.`;
        errors.push(msg); issues.push(createIssue('NW-POE-007','error',msg,{portId}));
      }
    }

    for(const [deviceId, watts] of loadsByDevice.entries()){
      const device = deviceById(project, deviceId);
      const budget = devicePoeBudgetWatts(device);
      if(budget !== null && watts > budget){
        const msg = `${labelDevice(device)}: carga PoE total ${round1(watts)} W supera presupuesto del equipo ${budget} W.`;
        errors.push(msg); issues.push(createIssue('NW-POE-008','error',msg,{deviceId}));
      } else if(budget === null){
        const msg = `${labelDevice(device)}: carga PoE estimada ${round1(watts)} W; define presupuesto PoE del equipo para validar capacidad total.`;
        info.push(msg); issues.push(createIssue('NW-POE-009','info',msg,{deviceId}));
      }
    }

    if(!errors.length && !warnings.length && !info.length) info.push('PoE: sin cargas PoE detectadas o sin incompatibilidades evidentes.');
    return {ok:errors.length===0, errors, warnings, info, issues, loadsByDevice:Object.fromEntries(loadsByDevice), loadsByPort:Object.fromEntries(loadsByPort)};
  }

  function makeEl(tag, cls, text){ const el=document.createElement(tag); if(cls) el.className=cls; if(text!==undefined) el.textContent=String(text??''); return el; }
  function makeInput(attrs){ const input=document.createElement('input'); Object.entries(attrs||{}).forEach(([k,v])=>{ if(k==='dataset') Object.assign(input.dataset,v); else input.setAttribute(k,String(v)); }); return input; }
  function makeSelect(dataset, options, value){ const sel=document.createElement('select'); Object.assign(sel.dataset,dataset||{}); options.forEach(([v,l])=>{ const o=document.createElement('option'); o.value=v; o.textContent=l; if(String(value??'')===String(v))o.selected=true; sel.appendChild(o); }); return sel; }
  function makeTable(headers, rows, emptyText, colspan){
    const wrap=makeEl('div','tw'); const table=document.createElement('table'); const thead=document.createElement('thead'); const tr=document.createElement('tr'); headers.forEach(h=>tr.appendChild(makeEl('th','',h))); thead.appendChild(tr); table.appendChild(thead); const tbody=document.createElement('tbody');
    if(rows.length){ rows.forEach(cells=>{ const r=document.createElement('tr'); cells.forEach(cell=>{ const td=document.createElement('td'); if(cell instanceof Node)td.appendChild(cell); else td.textContent=String(cell??''); r.appendChild(td); }); tbody.appendChild(r); }); }
    else { const r=document.createElement('tr'); const td=document.createElement('td'); td.colSpan=colspan||headers.length; td.textContent=emptyText; r.appendChild(td); tbody.appendChild(r); }
    table.appendChild(tbody); wrap.appendChild(table); return wrap;
  }
  function renderPoePanelDom(project){
    const audit = validatePoe(project || {});
    const devLoads = audit.loadsByDevice || {};
    const card = makeEl('div','card'); card.id='poePlannerCard';
    const head=makeEl('div','card-h'); head.appendChild(makeEl('div','card-t','⚡ PoE · Presupuesto y consumo'));
    const summary = [`${audit.errors.length} errores`, `${audit.warnings.length} avisos`, `${audit.info.length} info`].join(' · ');
    head.appendChild(makeEl('span',`b ${audit.errors.length?'brd':audit.warnings.length?'byw':'bgn'}`,summary)); card.appendChild(head);
    const cls = audit.errors.length ? 'co-rd' : audit.warnings.length ? 'co-yw' : 'co-gn';
    const msg=makeEl('div',`co ${cls}`); const lines=[...audit.errors,...audit.warnings,...audit.info].slice(0,8); msg.textContent=lines.join('\n') || 'Sin incidencias PoE.'; card.appendChild(msg);
    const devRows=[];
    for(const d of arr(project && project.devices)){
      if(d.type !== 'switch' && devLoads[d.id] == null && d.poeBudgetW == null) continue;
      const name=makeEl('div',''); name.appendChild(makeEl('b','',d.name||d.id));
      devRows.push([name,`${round1(devLoads[d.id] || 0)} W`,makeInput({type:'number',min:'0',step:'1',value:d.poeBudgetW??'',placeholder:'Ej. 370',dataset:{poeDev:d.id}})]);
    }
    const poeHosts = arr(project && project.hosts).filter(h => hostRequiresPoe(h) || ['ap','camera','phone','iot'].includes(lower(h.type)) || h.poeMode || h.poeWatts != null);
    const hostRows = poeHosts.map(h=>{ const name=makeEl('div',''); name.append(makeEl('b','',h.name||h.id),makeEl('div','hint',h.type||'')); return [name, makeSelect({poeHostMode:h.id},[['auto','Auto'],['yes','Requiere'],['none','No PoE']],h.poeMode||'auto'), makeInput({type:'number',min:'0',step:'0.1',value:h.poeWatts??'',placeholder:defaultPowerForHostType(h.type)||'',dataset:{poeHostW:h.id}})]; });
    const poePorts = arr(project && project.ports).filter(p => p.poeMode || p.poeWattsMax != null || audit.loadsByPort[p.id] != null).slice(0, 80);
    const portRows = poePorts.map(p=>{ const name=makeEl('div',''); name.appendChild(makeEl('b','',labelPort(project,p))); return [name,`${round1(audit.loadsByPort[p.id] || 0)} W`, makeSelect({poePortMode:p.id},[['auto','Auto'],['none','Sin PoE'],['af','802.3af'],['at','802.3at'],['bt','802.3bt 60W'],['bt90','802.3bt 90W']],p.poeMode||'auto'), makeInput({type:'number',min:'0',step:'0.1',value:p.poeWattsMax??'',placeholder:'auto',dataset:{poePortW:p.id}})]; });
    const grid=makeEl('div','g2'); grid.style.marginTop='10px';
    const left=makeEl('div',''); const lh=makeEl('h3','', 'Switches / presupuestos'); lh.style.cssText='font-size:13px;margin:0 0 6px'; left.append(lh,makeTable(['Equipo','Carga','Presupuesto W'],devRows,'Sin switches PoE detectados.',3));
    const right=makeEl('div',''); const rh=makeEl('h3','', 'Hosts alimentados'); rh.style.cssText='font-size:13px;margin:0 0 6px'; right.append(rh,makeTable(['Host','Modo','W'],hostRows,'Sin APs/cámaras/teléfonos/IoT detectados.',3));
    grid.append(left,right); card.appendChild(grid);
    const ports=makeEl('div',''); ports.style.marginTop='10px'; const ph=makeEl('h3','','Puertos PoE con carga/configuración'); ph.style.cssText='font-size:13px;margin:0 0 6px'; ports.append(ph,makeTable(['Puerto','Carga','Estándar','W máx.'],portRows,'Sin puertos PoE configurados o con carga.',4)); card.appendChild(ports);
    const brow=makeEl('div','brow'); const save=makeEl('button','btn bp','💾 Guardar PoE'); save.id='poeSaveBtn'; const auditBtn=makeEl('button','btn bs','🧪 Auditar PoE'); auditBtn.id='poeAuditBtn'; brow.append(save,auditBtn); card.appendChild(brow);
    return card;
  }
  function renderPoePanel(project){
    const audit = validatePoe(project || {});
    return [`PoE: ${audit.errors.length} errores, ${audit.warnings.length} avisos, ${audit.info.length} info`, ...audit.errors, ...audit.warnings, ...audit.info].join('\n');
  }

  function escapeHtml(s){
    return (s == null ? '' : String(s)).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));
  }

  function mountPoePanel(){
    if(typeof document === 'undefined') return;
    const page = document.getElementById('pg-ports') || document.getElementById('pg-dash');
    const api = root.NetWizardState;
    if(!page || !api || typeof api.getSnapshot !== 'function') return;
    let mount = document.getElementById('poePlannerMount');
    if(!mount){ mount = document.createElement('div'); mount.id = 'poePlannerMount'; page.appendChild(mount); }
    const project = api.getSnapshot();
    mount.textContent = ""; mount.appendChild(renderPoePanelDom(project));
    const saveBtn = document.getElementById('poeSaveBtn');
    if(saveBtn) saveBtn.onclick = () => {
      const next = api.getSnapshot();
      document.querySelectorAll('[data-poe-dev]').forEach(inp => { const d = next.devices.find(x => x.id === inp.dataset.poeDev); if(d){ const n = num(inp.value); d.poeBudgetW = n !== null && n >= 0 ? n : null; } });
      document.querySelectorAll('[data-poe-host-mode]').forEach(sel => { const h = next.hosts.find(x => x.id === sel.dataset.poeHostMode); if(h){ h.poeMode = sel.value; h.poeRequired = sel.value === 'yes' ? true : sel.value === 'none' ? false : null; } });
      document.querySelectorAll('[data-poe-host-w]').forEach(inp => { const h = next.hosts.find(x => x.id === inp.dataset.poeHostW); if(h){ const n = num(inp.value); h.poeWatts = n !== null && n >= 0 ? n : null; } });
      document.querySelectorAll('[data-poe-port-mode]').forEach(sel => { const p = next.ports.find(x => x.id === sel.dataset.poePortMode); if(p){ p.poeMode = sel.value; } });
      document.querySelectorAll('[data-poe-port-w]').forEach(inp => { const p = next.ports.find(x => x.id === inp.dataset.poePortW); if(p){ const n = num(inp.value); p.poeWattsMax = n !== null && n >= 0 ? n : null; } });
      api.replaceProject(next, {source:'poe-ui'});
    };
    const auditBtn = document.getElementById('poeAuditBtn');
    if(auditBtn) auditBtn.onclick = () => {
      const a = validatePoe(api.getSnapshot());
      alert([`PoE: ${a.errors.length} errores, ${a.warnings.length} avisos, ${a.info.length} info`, ...a.errors, ...a.warnings, ...a.info].slice(0,20).join('\n'));
    };
  }

  const api = {version:'netwizard-poe-utils-v3.21', normalizePoeMode, defaultPowerForHostType, hostRequiresPoe, hostPowerWatts, portPoeCapacityWatts, devicePoeBudgetWatts, collectPoeLoads, validatePoe, renderPoePanel, renderPoePanelDom, mountPoePanel};
  if(typeof module !== 'undefined' && module.exports) module.exports = api;
  root.NetWizardPoeUtils = api;

  if(typeof document !== 'undefined'){
    document.addEventListener('DOMContentLoaded', () => setTimeout(mountPoePanel, 0));
    document.addEventListener('nw:project:changed', () => setTimeout(mountPoePanel, 0));
  }
})(typeof window !== 'undefined' ? window : globalThis);
