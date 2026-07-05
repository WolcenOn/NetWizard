/* =========================================================
   NetWizard History & Snapshots v3.8
   Snapshots manuales/restaurables para cambios de proyecto.
   Script clásico, sin dependencias externas.
========================================================= */
(function(root){
  'use strict';
  const STORAGE_KEY = 'nwp_history_v1';
  const MAX_SNAPSHOTS = 20;

  function clone(value){ return JSON.parse(JSON.stringify(value)); }
  function nowIso(){ return new Date().toISOString(); }
  function stateApi(){ return root.NetWizardState || null; }
  function schemaApi(){ return root.NetWizardProjectSchema || null; }
  function esc(s){
    const core = root.NetWizardCoreUtils;
    if(core && typeof core.escapeHtml === 'function') return core.escapeHtml(s);
    return (s ?? '').toString().replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));
  }
  function readStore(){
    try{
      const raw = root.localStorage && root.localStorage.getItem(STORAGE_KEY);
      const data = raw ? JSON.parse(raw) : [];
      return Array.isArray(data) ? data.filter(Boolean) : [];
    }catch(_e){ return []; }
  }
  function writeStore(items){
    const normalized = (Array.isArray(items) ? items : []).slice(0, MAX_SNAPSHOTS);
    if(root.localStorage) root.localStorage.setItem(STORAGE_KEY, JSON.stringify(normalized));
    return normalized;
  }
  function projectSummary(project){
    const p = project || {};
    return {
      devices: Array.isArray(p.devices) ? p.devices.length : 0,
      ports: Array.isArray(p.ports) ? p.ports.length : 0,
      vlans: Array.isArray(p.vlans) ? p.vlans.length : 0,
      subnets: Array.isArray(p.subnets) ? p.subnets.length : 0,
      hosts: Array.isArray(p.hosts) ? p.hosts.length : 0,
      links: Array.isArray(p.links) ? p.links.length : 0,
      iotDevices: p.iot && Array.isArray(p.iot.devices) ? p.iot.devices.length : 0
    };
  }
  function makeSnapshot(label, source, project){
    const p = clone(project || (stateApi() && stateApi().getSnapshot ? stateApi().getSnapshot() : {}));
    const schema = schemaApi();
    const payload = schema && typeof schema.exportProject === 'function'
      ? schema.exportProject(p)
      : { format:'netwizard-project', schemaVersion:p._schemaVersion || 'legacy', exportedAt:nowIso(), project:p };
    return {
      id: 'snap_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2,7),
      ts: nowIso(),
      label: (label || 'Snapshot').toString().trim().slice(0, 80) || 'Snapshot',
      source: (source || 'manual').toString().slice(0, 40),
      summary: projectSummary(p),
      payload
    };
  }
  function createSnapshot(label, options){
    const snap = makeSnapshot(label, options && options.source, options && options.project);
    const items = readStore();
    items.unshift(snap);
    writeStore(items);
    renderHistoryCard();
    try{ root.document && root.document.dispatchEvent(new CustomEvent('nw:history:changed', { detail:{ action:'create', snapshotId:snap.id } })); }catch(_e){}
    return snap;
  }
  function listSnapshots(){ return readStore().map(s => ({ id:s.id, ts:s.ts, label:s.label, source:s.source, summary:s.summary })); }
  function getSnapshot(id){ return readStore().find(s => s.id === id) || null; }
  function restoreSnapshot(id, options){
    const snap = getSnapshot(id);
    if(!snap) return { ok:false, error:'Snapshot no encontrado' };
    const api = stateApi();
    if(!api || typeof api.replaceProject !== 'function') return { ok:false, error:'NetWizardState no está disponible' };
    const schema = schemaApi();
    let project = snap.payload && snap.payload.project ? snap.payload.project : snap.payload;
    if(schema && typeof schema.prepareImport === 'function'){
      const prepared = schema.prepareImport(snap.payload, { defaults: root.defS });
      if(!prepared.ok) return { ok:false, error:(prepared.errors || []).join('\n') || 'Snapshot inválido' };
      project = prepared.project;
    }
    if(!(options && options.skipBackup)){
      createSnapshot('Antes de restaurar: ' + (snap.label || snap.id), { source:'pre-restore' });
    }
    api.replaceProject(project, { source:'history-restore' });
    renderHistoryCard();
    return { ok:true, snapshot: listSnapshots().find(s => s.id === id) || null };
  }
  function deleteSnapshot(id){
    const before = readStore();
    const after = before.filter(s => s.id !== id);
    writeStore(after);
    renderHistoryCard();
    return before.length !== after.length;
  }
  function clearSnapshots(){ writeStore([]); renderHistoryCard(); }
  function formatDate(iso){
    try{ return new Date(iso).toLocaleString(); }catch(_e){ return iso || ''; }
  }
  function summaryText(summary){
    const s = summary || {};
    return `${s.devices||0} dev · ${s.vlans||0} VLAN · ${s.hosts||0} hosts · ${s.links||0} enlaces · ${s.iotDevices||0} IoT`;
  }
  function make(doc, tag, cls, text){ const el=doc.createElement(tag); if(cls)el.className=cls; if(text!==undefined)el.textContent=String(text); return el; }
  function ensureHistoryCard(){
    const doc = root.document;
    if(!doc || doc.getElementById('historyCard')) return;
    const dash = doc.getElementById('pg-dash');
    if(!dash) return;
    const card = make(doc,'div','card'); card.id = 'historyCard';
    const head=make(doc,'div','card-h'); head.append(make(doc,'div','card-t','🕘 Historial y snapshots'), make(doc,'span','b bac','0')); head.lastChild.id='historyCnt'; card.appendChild(head);
    const hint=make(doc,'div','hint','Guarda puntos de restauración antes de cambios importantes. Se conservan los últimos 20 snapshots en localStorage.'); hint.style.marginBottom='10px'; card.appendChild(hint);
    const row=make(doc,'div','row'); const col=doc.createElement('div'); col.append(make(doc,'label','fl','Etiqueta')); const input=doc.createElement('input'); input.id='historyLabel'; input.placeholder='Antes de cambios de VLAN / diseño base'; col.appendChild(input);
    const colBtn=doc.createElement('div'); colBtn.style.display='flex'; colBtn.style.alignItems='flex-end'; const create=make(doc,'button','btn bp','📌 Crear snapshot'); create.id='btnHistoryCreate'; create.type='button'; colBtn.appendChild(create); row.append(col,colBtn); card.appendChild(row);
    const brow=make(doc,'div','brow'); const refresh=make(doc,'button','btn bs','↻ Actualizar lista'); refresh.id='btnHistoryRefresh'; refresh.type='button'; const clear=make(doc,'button','btn bd','🗑 Vaciar historial'); clear.id='btnHistoryClear'; clear.type='button'; brow.append(refresh,clear); card.appendChild(brow);
    const list=doc.createElement('div'); list.id='historyList'; list.style.marginTop='10px'; card.appendChild(list);
    const stats = doc.getElementById('dStats');
    if(stats && stats.parentNode) stats.parentNode.insertBefore(card, stats.nextSibling);
    else dash.appendChild(card);
    create.onclick = () => {
      const label = (doc.getElementById('historyLabel') && doc.getElementById('historyLabel').value) || 'Snapshot manual';
      createSnapshot(label, { source:'manual-ui' });
      const input = doc.getElementById('historyLabel');
      if(input) input.value = '';
    };
    refresh.onclick = renderHistoryCard;
    clear.onclick = () => {
      if(root.confirm && !root.confirm('¿Vaciar todo el historial local de snapshots?')) return;
      clearSnapshots();
    };
    renderHistoryCard();
  }
  function renderHistoryCard(){
    const doc = root.document;
    if(!doc) return;
    const list = doc.getElementById('historyList');
    const cnt = doc.getElementById('historyCnt');
    if(!list) return;
    const items = readStore();
    if(cnt) cnt.textContent = String(items.length);
    list.textContent='';
    if(!items.length){
      const empty=make(doc,'div','empty'); empty.appendChild(make(doc,'p','', 'Sin snapshots todavía.')); list.appendChild(empty);
      return;
    }
    const wrap=make(doc,'div','tw'); const table=doc.createElement('table');
    const thead=doc.createElement('thead'); const hr=doc.createElement('tr'); ['Fecha','Etiqueta','Resumen','Acciones'].forEach(t=>hr.appendChild(make(doc,'th','',t))); thead.appendChild(hr); table.appendChild(thead);
    const tbody=doc.createElement('tbody');
    items.forEach(s=>{
      const tr=doc.createElement('tr');
      const tdDate=make(doc,'td','mono',formatDate(s.ts)); tr.appendChild(tdDate);
      const tdLabel=doc.createElement('td'); const b=doc.createElement('b'); b.textContent=String(s.label||''); tdLabel.appendChild(b); const hint=make(doc,'div','hint',s.source||'manual'); tdLabel.appendChild(hint); tr.appendChild(tdLabel);
      tr.appendChild(make(doc,'td','',summaryText(s.summary)));
      const tdAct=doc.createElement('td'); const actions=doc.createElement('div'); actions.style.display='flex'; actions.style.gap='4px'; actions.style.flexWrap='wrap';
      const restore=make(doc,'button','btn bs bxs','Restaurar'); restore.type='button'; restore.dataset.hrestore=String(s.id||'');
      const del=make(doc,'button','btn bd bxs','✕'); del.type='button'; del.dataset.hdelete=String(s.id||'');
      actions.append(restore,del); tdAct.appendChild(actions); tr.appendChild(tdAct); tbody.appendChild(tr);
    });
    table.appendChild(tbody); wrap.appendChild(table); list.appendChild(wrap);
    list.querySelectorAll('[data-hrestore]').forEach(btn => btn.onclick = () => {
      if(root.confirm && !root.confirm('¿Restaurar este snapshot? Se creará una copia del estado actual antes de restaurar.')) return;
      const res = restoreSnapshot(btn.getAttribute('data-hrestore'));
      if(!res.ok && root.alert) root.alert(res.error || 'No se pudo restaurar.');
    });
    list.querySelectorAll('[data-hdelete]').forEach(btn => btn.onclick = () => deleteSnapshot(btn.getAttribute('data-hdelete')));
  }
  function boot(){ ensureHistoryCard(); }

  root.NetWizardHistory = { version:'netwizard-history-v1', storageKey:STORAGE_KEY, maxSnapshots:MAX_SNAPSHOTS, createSnapshot, listSnapshots, getSnapshot, restoreSnapshot, deleteSnapshot, clearSnapshots, projectSummary };
  if(root.document){
    if(root.document.readyState === 'loading') root.document.addEventListener('DOMContentLoaded', boot);
    else boot();
    root.document.addEventListener('nw:project:changed', () => { if(root.document.getElementById('historyCard')) renderHistoryCard(); });
  }
})(typeof window !== 'undefined' ? window : globalThis);

if(typeof module !== 'undefined') module.exports = globalThis.NetWizardHistory || (typeof window !== 'undefined' ? window.NetWizardHistory : null);
