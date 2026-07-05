/* =========================================================
   NetWizard Pro - IoT Publisher v1.6

   Objetivo:
   - Publicar el grafo unificado de NetWizard para que IoTWizard
     pueda importarlo desde localStorage.
   - No modifica el estado original ni sustituye exportaciones.
   - Añade compatibilidad opcional con BroadcastChannel para futuras
     sincronizaciones en vivo entre pestañas del mismo origen.
========================================================= */
(function initNetWizardIotPublisher(){
  'use strict';

  const PUBLISHED_GRAPH_KEY = 'netwizard_unified_graph_v1';
  const PUBLISHED_PROJECT_KEY = 'netwizard_unified_project_v1';
  const CHANNEL_NAME = 'netwizard_iotwizard_bridge';
  const PUBLISHER_VERSION = 'netwizard-iot-publisher-v1.6';

  function $(id){ return document.getElementById(id); }

  function setStatus(message, kind){
    const el = $('nwBridgeStatus');
    if (!el) return;
    el.textContent = message;
    el.classList.remove('ok', 'err');
    if (kind) el.classList.add(kind);
  }

  function getBridge(){ return window.NetWizardBridge || null; }

  function summarizeGraph(graph){
    const nodes = Array.isArray(graph?.nodes) ? graph.nodes : [];
    return {
      segments: Array.isArray(graph?.segments) ? graph.segments.length : 0,
      nodes: nodes.length,
      networkNodes: nodes.filter(n => n.kind === 'network').length,
      ports: nodes.filter(n => n.kind === 'port').length,
      endpoints: nodes.filter(n => n.kind === 'endpoint' || n.kind === 'iot_candidate').length,
      iotCandidates: nodes.filter(n => n.kind === 'iot_candidate').length,
      links: Array.isArray(graph?.links) ? graph.links.length : 0,
      warnings: Array.isArray(graph?.warnings) ? graph.warnings.length : 0
    };
  }

  function broadcastPublished(payload){
    if (typeof BroadcastChannel !== 'function') return false;
    try {
      const bc = new BroadcastChannel(CHANNEL_NAME);
      bc.postMessage({
        type: 'netwizard-graph-published',
        version: PUBLISHER_VERSION,
        key: PUBLISHED_GRAPH_KEY,
        payload
      });
      bc.close();
      return true;
    } catch (err) {
      console.warn('[NetWizard IoT Publisher] BroadcastChannel no disponible:', err);
      return false;
    }
  }

  function buildPublishedPayload(){
    const bridge = getBridge();
    if (!bridge) throw new Error('NetWizardBridge no está disponible.');

    const snapshot = bridge.getProjectSnapshot();
    if (!snapshot?.ok) throw new Error(snapshot?.error || 'No se pudo leer el proyecto NetWizard.');

    const graph = bridge.makeUnifiedGraph(snapshot.project);
    const validation = typeof bridge.validateUnifiedGraph === 'function'
      ? bridge.validateUnifiedGraph(graph)
      : null;

    return {
      schema: 'netwizard-published-graph-v1',
      publisherVersion: PUBLISHER_VERSION,
      bridgeVersion: bridge.version,
      publishedAt: new Date().toISOString(),
      source: 'netwizard',
      projectName: graph?.projectName || snapshot.project?.projName || 'Sin título',
      storageKey: PUBLISHED_GRAPH_KEY,
      graph,
      snapshotSummary: {
        projectName: snapshot.project?.projName || 'Sin título',
        devices: Array.isArray(snapshot.project?.devices) ? snapshot.project.devices.length : 0,
        ports: Array.isArray(snapshot.project?.ports) ? snapshot.project.ports.length : 0,
        vlans: Array.isArray(snapshot.project?.vlans) ? snapshot.project.vlans.length : 0,
        subnets: Array.isArray(snapshot.project?.subnets) ? snapshot.project.subnets.length : 0,
        hosts: Array.isArray(snapshot.project?.hosts) ? snapshot.project.hosts.length : 0,
        links: Array.isArray(snapshot.project?.links) ? snapshot.project.links.length : 0
      },
      validation
    };
  }

  function publishForIotWizard(){
    try {
      const bridge = getBridge();
      if (!bridge) throw new Error('Bridge no disponible.');

      const payload = buildPublishedPayload();
      localStorage.setItem(PUBLISHED_GRAPH_KEY, JSON.stringify(payload));

      // Mantener también el snapshot completo para compatibilidad con v1.2+.
      if (typeof bridge.saveUnifiedSnapshot === 'function') {
        const fullPayload = bridge.saveUnifiedSnapshot();
        localStorage.setItem(PUBLISHED_PROJECT_KEY, JSON.stringify(fullPayload));
      }

      const summary = summarizeGraph(payload.graph);
      const live = broadcastPublished(payload);
      setStatus(
        `Publicado para IoTWizard: ${summary.networkNodes} equipos, ${summary.ports} puertos, ${summary.segments} VLANs/segmentos, ${summary.iotCandidates} candidatos IoT. ${live ? 'Notificado por BroadcastChannel.' : 'Guardado en localStorage.'}`,
        'ok'
      );
      return payload;
    } catch (err) {
      console.error(err);
      setStatus(`Error publicando para IoTWizard: ${err.message || err}`, 'err');
      return null;
    }
  }

  function injectButton(){
    if ($('nwPublishIot')) return;
    const downloadBtn = $('nwBridgeDownload');
    if (!downloadBtn || !downloadBtn.parentElement) return;

    const btn = document.createElement('button');
    btn.className = 'btn bg';
    btn.id = 'nwPublishIot';
    btn.type = 'button';
    btn.title = 'Guarda el grafo unificado en localStorage para que IoTWizard pueda importarlo';
    btn.textContent = '📡 Publicar para IoTWizard';
    btn.addEventListener('click', publishForIotWizard);
    downloadBtn.insertAdjacentElement('afterend', btn);
  }

  function bind(){
    injectButton();
    window.NetWizardIotPublisher = Object.freeze({
      version: PUBLISHER_VERSION,
      storageKey: PUBLISHED_GRAPH_KEY,
      projectStorageKey: PUBLISHED_PROJECT_KEY,
      channelName: CHANNEL_NAME,
      buildPublishedPayload,
      publishForIotWizard
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', bind);
  else bind();
})();
