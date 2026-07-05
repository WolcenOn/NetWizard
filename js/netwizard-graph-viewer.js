/* =========================================================
   NetWizard Pro - Unified Graph Viewer v1.5

   Objetivo:
   - Añadir un visor de grafo unificado en modo SOLO LECTURA.
   - Consumir únicamente window.NetWizardBridge.
   - No modificar S, netwizard.js ni los mapas existentes.
   - Preparar una vista compatible con IoTWizard sin sustituir V4/V5.
========================================================= */
(function initNetWizardGraphViewer(){
  'use strict';

  const VIEWER_VERSION = 'netwizard-graph-viewer-v1.5';
  const DEFAULTS = {
    includePorts: false,
    includeHostAccess: true,
    showWarnings: true
  };

  let state = { ...DEFAULTS, graph: null, selectedNodeId: null };
  let canvas = null;
  let ctx = null;
  let bounds = { w: 900, h: 420 };

  function $(id){ return document.getElementById(id); }
  function safeArray(v){ return Array.isArray(v) ? v : []; }
  function esc(value){
    return String(value ?? '').replace(/[&<>'"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
  }

  function getBridge(){ return window.NetWizardBridge || null; }

  function make(tag, cls, text){
    const el=document.createElement(tag); if(cls)el.className=cls; if(text!==undefined)el.textContent=String(text); return el;
  }
  function badge(cls,text){ const s=make('span','b '+cls,text); return s; }
  function coBox(cls,text){ return make('div','co '+cls,text); }
  function injectViewer(){
    if ($('nwUnifiedGraphViewer')) return;
    const jsonBox = $('jsonBox');
    if (!jsonBox) return;
    const exportCard = jsonBox.closest('.card');
    if (!exportCard || !exportCard.parentNode) return;

    const card = make('div','card nwg-card');
    card.id = 'nwUnifiedGraphViewer';
    const head=make('div','card-h');
    head.append(make('div','card-t','🧬 Grafo unificado · NetWizard ↔ IoTWizard'), badge('bac', VIEWER_VERSION));
    head.lastChild.id='nwgVersion'; card.appendChild(head);
    const hint=make('div','hint','Vista de solo lectura generada desde el bridge. No sustituye el mapa actual ni modifica el proyecto.'); hint.style.marginBottom='10px'; card.appendChild(hint);
    const toolbar=make('div','nwg-toolbar');
    const refresh=make('button','btn bp bsm','⟳ Actualizar grafo'); refresh.id='nwgRefresh'; refresh.type='button';
    const fit=make('button','btn bs bsm','⊞ Ajustar'); fit.id='nwgFit'; fit.type='button';
    const portsLbl=make('label','nwg-check'); const ports=document.createElement('input'); ports.type='checkbox'; ports.id='nwgPorts'; portsLbl.append(ports,document.createTextNode(' Mostrar puertos'));
    const accLbl=make('label','nwg-check'); const acc=document.createElement('input'); acc.type='checkbox'; acc.id='nwgAccess'; acc.checked=true; accLbl.append(acc,document.createTextNode(' Enlaces host→red'));
    toolbar.append(refresh,fit,portsLbl,accLbl); card.appendChild(toolbar);
    const summary=make('div','nwg-summary'); summary.id='nwgSummary'; card.appendChild(summary);
    const wrap=make('div','nwg-wrap'); const cv=document.createElement('canvas'); cv.id='nwgCanvas'; cv.width=900; cv.height=420; wrap.appendChild(cv); card.appendChild(wrap);
    const details=make('div','nwg-details'); details.id='nwgDetails'; card.appendChild(details);
    exportCard.parentNode.insertBefore(card, exportCard.nextSibling);

    canvas = $('nwgCanvas');
    ctx = canvas ? canvas.getContext('2d') : null;

    $('nwgRefresh')?.addEventListener('click', refreshGraph);
    $('nwgFit')?.addEventListener('click', () => { state.selectedNodeId = null; renderGraph(); });
    $('nwgPorts')?.addEventListener('change', ev => { state.includePorts = !!ev.target.checked; renderGraph(); });
    $('nwgAccess')?.addEventListener('change', ev => { state.includeHostAccess = !!ev.target.checked; renderGraph(); });
    canvas?.addEventListener('click', onCanvasClick);

    refreshGraph();
  }

  function refreshGraph(){
    const bridge = getBridge();
    const details = $('nwgDetails');
    if (!bridge) {
      if (details) { details.textContent=''; details.appendChild(coBox('co-rd','Bridge no disponible. Comprueba que netwizard-bridge.js se carga antes que el visor.')); }
      return;
    }
    state.graph = bridge.makeUnifiedGraph();
    state.selectedNodeId = null;
    renderGraph();
  }

  function filteredGraph(){
    const graph = state.graph || { nodes: [], links: [], segments: [], warnings: [] };
    let nodes = safeArray(graph.nodes);
    if (!state.includePorts) nodes = nodes.filter(n => n.kind !== 'port');
    const nodeIds = new Set(nodes.map(n => n.id));

    let links = safeArray(graph.links).filter(l => nodeIds.has(l.from) && nodeIds.has(l.to));
    if (!state.includePorts) {
      // En modo limpio se usa la ruta dispositivo↔dispositivo y enlaces inferidos host↔dispositivo.
      links = links.filter(l => l.kind === 'physical_device_path' || l.kind === 'logical' || l.kind === 'wireless');
      if (state.includeHostAccess) {
        safeArray(graph.nodes).filter(n => n.kind === 'endpoint' || n.kind === 'iot_candidate').forEach(host => {
          if (host.connectedDeviceId && nodeIds.has(host.id) && nodeIds.has(host.connectedDeviceId)) {
            links.push({
              id: `inferred_${host.id}_${host.connectedDeviceId}`,
              kind: host.kind === 'iot_candidate' ? 'iot_access' : 'endpoint_access',
              medium: host.type === 'ap' ? 'wifi' : 'ethernet',
              from: host.id,
              to: host.connectedDeviceId,
              label: host.kind === 'iot_candidate' ? 'iot' : 'access'
            });
          }
        });
      }
    }
    return { ...graph, nodes, links };
  }

  function nodeColor(node){
    if (node.kind === 'iot_candidate') return '#f97316';
    if (node.kind === 'endpoint') return '#8b5cf6';
    if (node.kind === 'port') return '#4d6580';
    if (node.type === 'router') return '#10b981';
    if (node.type === 'firewall') return '#ef4444';
    if (node.type === 'switch') return '#3b82f6';
    return '#06b6d4';
  }

  function linkColor(link){
    if (link.kind === 'iot_access') return '#f97316';
    if (link.kind === 'endpoint_access') return '#8b5cf6';
    if (link.kind === 'physical_device_path' || link.kind === 'physical') return '#8fa3c0';
    if (link.kind === 'contains') return '#2d3f55';
    return '#06b6d4';
  }

  function computeLayout(graph){
    const w = bounds.w;
    const h = bounds.h;
    const nodes = graph.nodes;
    const layout = new Map();

    const infra = nodes.filter(n => n.kind === 'network');
    const endpoints = nodes.filter(n => n.kind === 'endpoint' || n.kind === 'iot_candidate');
    const ports = nodes.filter(n => n.kind === 'port');

    infra.forEach((n, i) => {
      const x = ((i + 1) / (infra.length + 1)) * w;
      const y = h * 0.30 + (i % 2) * 36;
      layout.set(n.id, { x, y, r: 20 });
    });

    endpoints.forEach((n, i) => {
      const x = ((i + 1) / (endpoints.length + 1)) * w;
      const y = h * 0.70 + ((i % 2) * 30);
      layout.set(n.id, { x, y, r: n.kind === 'iot_candidate' ? 17 : 15 });
    });

    ports.forEach((n, i) => {
      const parent = layout.get(n.parentNodeId);
      if (parent) {
        const offset = ((i % 12) - 5.5) * 10;
        const row = Math.floor(i / 12) * 12;
        layout.set(n.id, { x: parent.x + offset, y: parent.y + 34 + row, r: 6 });
      } else {
        layout.set(n.id, { x: 25 + (i % 20) * 18, y: h - 24, r: 5 });
      }
    });

    return layout;
  }

  function resizeCanvas(){
    if (!canvas) return;
    const rect = canvas.parentElement.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    bounds.w = Math.max(520, Math.floor(rect.width || 900));
    bounds.h = 420;
    canvas.style.width = bounds.w + 'px';
    canvas.style.height = bounds.h + 'px';
    canvas.width = Math.floor(bounds.w * dpr);
    canvas.height = Math.floor(bounds.h * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  function renderGraph(){
    if (!canvas || !ctx) return;
    resizeCanvas();
    const graph = filteredGraph();
    const layout = computeLayout(graph);
    canvas.__nwgLayout = layout;
    canvas.__nwgNodes = graph.nodes;

    ctx.clearRect(0, 0, bounds.w, bounds.h);
    ctx.fillStyle = '#07090f';
    ctx.fillRect(0, 0, bounds.w, bounds.h);

    drawSegmentBands(graph);

    graph.links.forEach(link => {
      const a = layout.get(link.from);
      const b = layout.get(link.to);
      if (!a || !b) return;
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
      ctx.strokeStyle = linkColor(link);
      ctx.globalAlpha = link.kind === 'contains' ? 0.22 : 0.72;
      ctx.lineWidth = link.kind === 'physical_device_path' ? 2.2 : 1.3;
      ctx.stroke();
      ctx.globalAlpha = 1;
    });

    graph.nodes.forEach(node => {
      const p = layout.get(node.id);
      if (!p) return;
      drawNode(node, p);
    });

    updateSummary(graph);
    updateDetails(graph);
  }

  function drawSegmentBands(graph){
    const segments = safeArray(graph.segments).slice(0, 6);
    if (!segments.length) return;
    const bandH = 22;
    segments.forEach((seg, i) => {
      ctx.globalAlpha = 0.11;
      ctx.fillStyle = seg.color || '#3b82f6';
      ctx.fillRect(10, 10 + i * (bandH + 4), bounds.w - 20, bandH);
      ctx.globalAlpha = 1;
      ctx.fillStyle = '#8fa3c0';
      ctx.font = '11px Space Grotesk, sans-serif';
      ctx.fillText(`${seg.vlanNumber || seg.vlanId || ''} · ${seg.name || 'VLAN'} ${seg.subnet ? '· ' + seg.subnet : ''}`, 18, 25 + i * (bandH + 4));
    });
  }

  function drawNode(node, p){
    const selected = state.selectedNodeId === node.id;
    ctx.beginPath();
    ctx.arc(p.x, p.y, selected ? p.r + 4 : p.r, 0, Math.PI * 2);
    ctx.fillStyle = nodeColor(node);
    ctx.globalAlpha = selected ? 1 : 0.92;
    ctx.fill();
    ctx.globalAlpha = 1;
    ctx.lineWidth = selected ? 3 : 1;
    ctx.strokeStyle = selected ? '#e2eaf7' : '#2a3547';
    ctx.stroke();

    const label = node.name || node.id;
    ctx.font = node.kind === 'port' ? '9px Fira Code, monospace' : '11px Space Grotesk, sans-serif';
    ctx.fillStyle = '#e2eaf7';
    ctx.textAlign = 'center';
    ctx.fillText(label.length > 18 ? label.slice(0, 16) + '…' : label, p.x, p.y + p.r + 14);
    ctx.textAlign = 'left';
  }

  function updateSummary(graph){
    const el = $('nwgSummary');
    if (!el) return;
    el.textContent='';
    const infra = graph.nodes.filter(n => n.kind === 'network').length;
    const endpoints = graph.nodes.filter(n => n.kind === 'endpoint').length;
    const iot = graph.nodes.filter(n => n.kind === 'iot_candidate').length;
    const ports = graph.nodes.filter(n => n.kind === 'port').length;
    el.append(
      badge('bac', `${infra} red`),
      badge('bpu', `${endpoints} endpoints`),
      badge('bor', `${iot} IoT candidatos`),
      badge('bcy', `${ports} puertos`),
      badge('bgn', `${safeArray(graph.segments).length} VLANs`),
      badge(safeArray(graph.warnings).length ? 'byw' : 'bgn', `${safeArray(graph.warnings).length} avisos`)
    );
  }

  function detailLine(parent,label,value){
    parent.appendChild(document.createTextNode(label+': '));
    const code=document.createElement('code'); code.textContent=String(value??'—'); parent.appendChild(code); parent.appendChild(document.createElement('br'));
  }
  function updateDetails(graph){
    const el = $('nwgDetails');
    if (!el) return;
    el.textContent='';
    const selected = graph.nodes.find(n => n.id === state.selectedNodeId);
    const warnings = safeArray(graph.warnings);
    if (selected) {
      const box=make('div','co co-ac');
      const strong=document.createElement('b'); strong.textContent=String(selected.name || selected.id || ''); box.appendChild(strong); box.appendChild(document.createElement('br'));
      detailLine(box,'Tipo',`${selected.kind} / ${selected.type}`);
      detailLine(box,'VLAN',selected.vlanName || selected.vlanRef || '—');
      detailLine(box,'IP',selected.ip || selected.mgmtIp || '—');
      el.appendChild(box);
      return;
    }
    if (!state.showWarnings || !warnings.length) {
      el.appendChild(make('div','hint','Haz clic en un nodo para ver detalles. El grafo es de solo lectura.'));
      return;
    }
    const box=make('div','co co-yw');
    const title=document.createElement('b'); title.textContent='Avisos del bridge'; box.appendChild(title); box.appendChild(document.createElement('br'));
    warnings.slice(0,6).forEach((w,i)=>{ if(i)box.appendChild(document.createElement('br')); box.appendChild(document.createTextNode('• '+String(w.message || w.code || 'Aviso'))); });
    if(warnings.length>6){ box.appendChild(document.createElement('br')); box.appendChild(document.createTextNode('…')); }
    el.appendChild(box);
  }

  function onCanvasClick(event){
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;
    const layout = canvas.__nwgLayout || new Map();
    const nodes = canvas.__nwgNodes || [];
    let hit = null;
    for (const node of nodes) {
      const p = layout.get(node.id);
      if (!p) continue;
      const d = Math.hypot(p.x - x, p.y - y);
      if (d <= p.r + 6) { hit = node; break; }
    }
    state.selectedNodeId = hit ? hit.id : null;
    renderGraph();
  }

  function boot(){
    injectViewer();
    window.addEventListener('resize', () => { if (state.graph) renderGraph(); });
    window.addEventListener('netwizard:bridge-ready', () => setTimeout(injectViewer, 0));
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();

  window.NetWizardGraphViewer = Object.freeze({
    version: VIEWER_VERSION,
    refresh: refreshGraph,
    render: renderGraph
  });
})();
