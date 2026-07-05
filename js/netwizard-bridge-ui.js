/* =========================================================
   NetWizard Pro - Bridge UI v1.4

   Objetivo:
   - Añadir controles visibles para probar el bridge NetWizard → IoTWizard.
   - No modificar la lógica principal de NetWizard.
   - No sustituir exportaciones actuales ni mapas existentes.

   Dependencias:
   - js/netwizard.js
   - js/netwizard-bridge.js

   Contrato:
   - Lee desde window.NetWizardBridge.
   - Escribe solo en #jsonBox y #nwBridgeStatus cuando el usuario pulsa un botón.
   - Puede guardar/descargar snapshot unificado bajo demanda.
========================================================= */

(function initNetWizardBridgeUi(){
  'use strict';

  function $(id){ return document.getElementById(id); }

  function setStatus(message, kind){
    const el = $('nwBridgeStatus');
    if (!el) return;
    el.textContent = message;
    el.classList.remove('ok', 'err');
    if (kind) el.classList.add(kind);
  }

  function stringify(value){
    return JSON.stringify(value, null, 2);
  }

  function getBridge(){
    return window.NetWizardBridge || null;
  }

  function assertBridge(){
    const bridge = getBridge();
    if (!bridge) {
      setStatus('Bridge no disponible. Comprueba que netwizard-bridge.js carga después de netwizard.js.', 'err');
      return null;
    }
    return bridge;
  }

  function previewUnifiedGraph(){
    const bridge = assertBridge();
    if (!bridge) return;

    const snapshot = bridge.getProjectSnapshot();
    const graph = bridge.makeUnifiedGraph(snapshot.ok ? snapshot.project : null);
    const validation = typeof bridge.validateUnifiedGraph === 'function' ? bridge.validateUnifiedGraph(graph) : null;
    const payload = {
      schema: 'netwizard-bridge-preview-v1',
      bridgeVersion: bridge.version,
      generatedAt: new Date().toISOString(),
      snapshotSummary: snapshot.ok ? {
        projectName: snapshot.project?.projName || 'Sin título',
        devices: Array.isArray(snapshot.project?.devices) ? snapshot.project.devices.length : 0,
        vlans: Array.isArray(snapshot.project?.vlans) ? snapshot.project.vlans.length : 0,
        hosts: Array.isArray(snapshot.project?.hosts) ? snapshot.project.hosts.length : 0,
        links: Array.isArray(snapshot.project?.links) ? snapshot.project.links.length : 0
      } : { error: snapshot.error },
      graph,
      validation
    };

    const out = $('jsonBox');
    if (out) {
      out.value = stringify(payload);
      out.focus();
    }

    if (graph && graph.ok) {
      setStatus(`Grafo IoT-ready generado: ${graph.nodes.length} nodos, ${graph.links.length} enlaces, ${graph.segments.length} segmentos, ${graph.warnings?.length || 0} avisos. No se ha modificado el proyecto.`, 'ok');
    } else {
      setStatus(`No se pudo generar el grafo: ${graph?.error || 'error desconocido'}`, 'err');
    }
  }

  function downloadUnifiedGraph(){
    const bridge = assertBridge();
    if (!bridge) return;

    try {
      const payload = bridge.downloadUnifiedSnapshot();
      const graph = payload?.graph;
      setStatus(`Snapshot unificado descargado y guardado en localStorage (${bridge.storageKey}). ${graph?.nodes?.length || 0} nodos, ${graph?.links?.length || 0} enlaces y ${graph?.warnings?.length || 0} avisos exportados.`, 'ok');
    } catch (err) {
      console.error(err);
      setStatus(`Error descargando snapshot unificado: ${err.message || err}`, 'err');
    }
  }

  function bind(){
    const previewBtn = $('nwBridgePreview');
    const downloadBtn = $('nwBridgeDownload');

    if (previewBtn) previewBtn.addEventListener('click', previewUnifiedGraph);
    if (downloadBtn) downloadBtn.addEventListener('click', downloadUnifiedGraph);

    if (getBridge()) {
      setStatus(`Bridge ${getBridge().version} listo. Puedes generar una vista IoT-ready desde Exportar.`, 'ok');
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', bind);
  } else {
    bind();
  }
})();
