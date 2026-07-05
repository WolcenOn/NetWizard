/* =========================================================
   NetWizard Pro - Bridge de compatibilidad v1.4

   Objetivo:
   - Exponer una API de lectura para futuras integraciones.
   - Normalizar el grafo común NetWizard → IoTWizard con más precisión.
   - Mantener este archivo como script clásico, cargado DESPUÉS de netwizard.js.

   Importante:
   - No modifica el estado S salvo cuando se llame explícitamente a saveUnifiedSnapshot().
   - No sustituye el mapa actual ni los renders existentes.
   - No convierte NetWizard a módulos ES todavía.
========================================================= */

(function initNetWizardBridge(){
  'use strict';

  const BRIDGE_VERSION = 'netwizard-bridge-v1.4';
  const UNIFIED_SCHEMA_VERSION = 'nw-unified-graph-v1';
  const UNIFIED_STORAGE_KEY = 'netwizard_unified_project_v1';

  function hasRuntimeState(){
    try { return !!(window.NetWizardState?.getSnapshot) || (typeof S !== 'undefined' && S && typeof S === 'object'); }
    catch { return false; }
  }

  function readRuntimeProject(){
    try {
      if (window.NetWizardState?.getSnapshot) return window.NetWizardState.getSnapshot();
    } catch (e) { console.warn('NetWizardState snapshot error', e); }
    try { return S; } catch { return null; }
  }

  function deepClone(value){
    if (typeof structuredClone === 'function') return structuredClone(value);
    return JSON.parse(JSON.stringify(value));
  }

  function safeArray(value){ return Array.isArray(value) ? value : []; }
  function nowIso(){ return new Date().toISOString(); }
  function asString(value){ return value === undefined || value === null ? '' : String(value); }

  function getProjectSnapshot(){
    if (!hasRuntimeState()) {
      return {
        ok: false,
        error: 'NetWizard state is not available yet. Make sure netwizard-bridge.js is loaded after netwizard.js.'
      };
    }

    return {
      ok: true,
      schema: 'netwizard-project-snapshot-v1',
      bridgeVersion: BRIDGE_VERSION,
      exportedAt: nowIso(),
      project: deepClone(readRuntimeProject())
    };
  }

  function getVlanRef(vlan){ return vlan?.ref ?? vlan?.id ?? ''; }
  function getVlanNumber(vlan){ return vlan?.vlanId ?? vlan?.tag ?? vlan?.number ?? vlan?.vid ?? ''; }

  function findVlan(project, vlanRefOrNumber){
    const key = asString(vlanRefOrNumber);
    if (!key) return null;
    return safeArray(project.vlans).find(v =>
      asString(v.id) === key ||
      asString(v.ref) === key ||
      asString(v.vlanId) === key ||
      asString(v.tag) === key ||
      asString(v.number) === key
    ) || null;
  }

  function vlanNameById(project, vlanRef){
    const vlan = findVlan(project, vlanRef);
    const vlanNumber = getVlanNumber(vlan);
    return vlan ? (vlan.name || `VLAN ${vlanNumber || getVlanRef(vlan)}`) : '';
  }

  function subnetForVlan(project, vlanRefOrNumber){
    const vlan = findVlan(project, vlanRefOrNumber);
    const ref = vlan ? getVlanRef(vlan) : vlanRefOrNumber;
    const num = vlan ? getVlanNumber(vlan) : vlanRefOrNumber;
    return safeArray(project.subnets).find(sn =>
      asString(sn.vlanRef ?? sn.vlanId ?? sn.vlan) === asString(ref) ||
      asString(sn.vlanRef ?? sn.vlanId ?? sn.vlan) === asString(num)
    ) || null;
  }

  function normalizeDeviceType(type){
    const t = (type || '').toString().toLowerCase();
    if (t.includes('switch')) return 'switch';
    if (t.includes('router')) return 'router';
    if (t.includes('firewall') || t.includes('fw')) return 'firewall';
    return t || 'network_device';
  }

  function getPortDeviceId(port){ return port?.devId || port?.deviceId || port?.parentDeviceId || ''; }
  function getPortIdFromHost(host){ return host?.portRef || host?.portId || host?.port || host?.connectedPortId || ''; }
  function getDeviceIdFromHost(host){ return host?.connectedDeviceId || host?.connDev || host?.deviceId || host?.parentDeviceId || ''; }
  function getLinkPortA(link){ return link?.aPortId || link?.a || link?.from || link?.portA || link?.fromPortId || ''; }
  function getLinkPortB(link){ return link?.bPortId || link?.b || link?.to || link?.portB || link?.toPortId || ''; }

  function indexPorts(project){
    const byId = new Map();
    safeArray(project.ports).forEach(port => { if (port?.id) byId.set(port.id, port); });
    return byId;
  }

  function addWarning(graph, code, message, meta){
    graph.warnings.push({ code, message, meta: meta || {} });
  }

  function addNode(graph, node){
    if (!node?.id) return;
    if (!graph.nodes.some(n => n.id === node.id)) graph.nodes.push(node);
  }

  function addLink(graph, link){
    if (!link?.id) return;
    if (!graph.links.some(l => l.id === link.id)) graph.links.push(link);
  }

  function makeUnifiedGraph(projectInput){
    const project = projectInput || (hasRuntimeState() ? readRuntimeProject() : null);
    if (!project) {
      return {
        ok: false,
        error: 'No project data available',
        schema: UNIFIED_SCHEMA_VERSION,
        nodes: [],
        links: [],
        segments: [],
        warnings: []
      };
    }

    const portsById = indexPorts(project);

    const graph = {
      ok: true,
      schema: UNIFIED_SCHEMA_VERSION,
      bridgeVersion: BRIDGE_VERSION,
      generatedAt: nowIso(),
      projectName: project.projName || 'Sin título',
      segments: [],
      nodes: [],
      links: [],
      warnings: [],
      meta: {
        source: 'netwizard',
        deviceCount: safeArray(project.devices).length,
        hostCount: safeArray(project.hosts).length,
        vlanCount: safeArray(project.vlans).length,
        portCount: safeArray(project.ports).length,
        linkCount: safeArray(project.links).length,
        iotAccessCount: safeArray(project.iot?.accessNodes).length,
        iotDeviceCount: safeArray(project.iot?.devices).length
      }
    };

    safeArray(project.vlans).forEach(vlan => {
      const ref = getVlanRef(vlan);
      const vlanNumber = getVlanNumber(vlan);
      const subnet = subnetForVlan(project, ref || vlanNumber);
      graph.segments.push({
        id: `vlan_${ref || vlanNumber}`,
        source: 'netwizard',
        kind: 'segment',
        type: 'vlan',
        ref,
        vlanRef: ref,
        vlanId: vlanNumber,
        vlanNumber,
        name: vlan.name || `VLAN ${vlanNumber || ref}`,
        color: vlan.color || '',
        subnet: subnet ? (subnet.cidr || '') : '',
        gateway: subnet ? (subnet.gw || subnet.gateway || '') : '',
        meta: { vlan: deepClone(vlan), subnet: subnet ? deepClone(subnet) : null }
      });
      if (!subnet) addWarning(graph, 'vlan_without_subnet', `La VLAN ${vlan.name || vlanNumber || ref} no tiene subnet asociada.`, { vlanRef: ref, vlanId: vlanNumber });
    });

    safeArray(project.devices).forEach(device => {
      addNode(graph, {
        id: device.id,
        source: 'netwizard',
        kind: 'network',
        type: normalizeDeviceType(device.type),
        name: device.name || device.id,
        mgmtIp: device.mgmt || device.mgmtIp || '',
        locationId: device.physLocId || device.locationId || '',
        icon: normalizeDeviceType(device.type),
        meta: deepClone(device)
      });
    });

    safeArray(project.ports).forEach(port => {
      const parentId = getPortDeviceId(port);
      if (!parentId) {
        addWarning(graph, 'port_without_parent', `El puerto ${port.name || port.id} no tiene dispositivo padre.`, { portId: port.id });
        return;
      }
      const accessVlanRef = port.accessVlanRef || port.vlanRef || port.vlanId || '';
      addNode(graph, {
        id: port.id,
        source: 'netwizard',
        kind: 'port',
        type: port.role || port.mode || 'interface',
        name: port.name || port.id,
        parentNodeId: parentId,
        vlanRef: accessVlanRef,
        mode: port.mode || '',
        media: port.media || '',
        meta: deepClone(port)
      });
      addLink(graph, {
        id: `contains_${parentId}_${port.id}`,
        source: 'netwizard',
        kind: 'contains',
        medium: 'internal',
        from: parentId,
        to: port.id,
        label: 'port',
        meta: {}
      });
    });

    safeArray(project.hosts).forEach(host => {
      const vlanRef = host.vlanRef ?? host.vlanId ?? host.vlan ?? '';
      const hostPort = getPortIdFromHost(host);
      const inferredPort = hostPort ? portsById.get(hostPort) : null;
      const connectedDeviceId = getDeviceIdFromHost(host) || (inferredPort ? getPortDeviceId(inferredPort) : '');
      addNode(graph, {
        id: host.id,
        source: 'netwizard',
        kind: host.type === 'iot' ? 'iot_candidate' : 'endpoint',
        type: host.type || 'host',
        name: host.name || host.id,
        vlanRef,
        vlanName: vlanNameById(project, vlanRef),
        ipMode: host.ipMode || '',
        ip: host.ip || host.staticIp || '',
        mac: host.mac || '',
        connectedDeviceId,
        connectedPortId: hostPort,
        locationId: host.physLocId || host.locationId || '',
        meta: deepClone(host)
      });

      if (hostPort) {
        addLink(graph, {
          id: `access_${host.id}_${hostPort}`,
          source: 'netwizard',
          kind: 'access',
          medium: 'ethernet',
          from: host.id,
          to: hostPort,
          label: 'host access',
          vlanRef,
          meta: { port: inferredPort ? deepClone(inferredPort) : null }
        });
      } else {
        addWarning(graph, 'host_without_port', `El host ${host.name || host.id} no tiene puerto asociado.`, { hostId: host.id, type: host.type || '' });
      }

      if (!vlanRef) addWarning(graph, 'host_without_vlan', `El host ${host.name || host.id} no tiene VLAN asociada.`, { hostId: host.id });
      if (host.type === 'iot') addWarning(graph, 'iot_candidate_detected', `Host IoT candidato detectado: ${host.name || host.id}. IoTWizard podrá enriquecerlo.`, { hostId: host.id, vlanRef, portId: hostPort });
    });


    safeArray(project.iot?.accessNodes).forEach(access => {
      const tech = asString(access.type || access.tech || 'iot_access');
      addNode(graph, {
        id: access.id,
        source: 'netwizard-iot',
        kind: 'iot_access',
        type: tech,
        name: access.name || access.id,
        mgmtIp: access.mgmtIp || '',
        vlanRef: access.mgmtVlanRef || access.serviceVlanRef || '',
        locationId: access.locationId || '',
        physicalLocation: access.physicalLocation || '',
        parentNodeId: access.parentDeviceId || '',
        parentPortId: access.parentPortId || '',
        meta: deepClone(access)
      });
      if (access.parentDeviceId) addLink(graph, {
        id: `iot_access_parent_${access.id}_${access.parentDeviceId}`,
        source: 'netwizard-iot',
        kind: 'iot_uplink',
        medium: 'ethernet',
        from: access.parentDeviceId,
        to: access.id,
        fromDeviceId: access.parentDeviceId,
        toDeviceId: access.id,
        fromPortId: access.parentPortId || '',
        label: access.parentPortId ? 'IoT uplink via port' : 'IoT uplink',
        vlanRef: access.mgmtVlanRef || access.serviceVlanRef || '',
        meta: { accessNode: deepClone(access) }
      });
      if (access.parentPortId) addLink(graph, {
        id: `iot_access_port_${access.id}_${access.parentPortId}`,
        source: 'netwizard-iot',
        kind: 'iot_port_attachment',
        medium: 'ethernet',
        from: access.parentPortId,
        to: access.id,
        fromPortId: access.parentPortId,
        toDeviceId: access.id,
        label: 'IoT access port',
        vlanRef: access.mgmtVlanRef || access.serviceVlanRef || '',
        meta: { accessNode: deepClone(access) }
      });
    });

    safeArray(project.iot?.devices).forEach(device => {
      addNode(graph, {
        id: device.id,
        source: 'netwizard-iot',
        kind: 'iot_device',
        type: device.type || 'iot',
        name: device.name || device.id,
        tech: device.tech || '',
        identifier: device.identifier || '',
        vlanRef: device.vlanRef || '',
        vlanName: vlanNameById(project, device.vlanRef || ''),
        accessNodeId: device.accessNodeId || '',
        locationId: device.locationId || '',
        physicalLocation: device.physicalLocation || '',
        meta: deepClone(device)
      });
      if (device.accessNodeId) addLink(graph, {
        id: `iot_device_access_${device.id}_${device.accessNodeId}`,
        source: 'netwizard-iot',
        kind: 'iot_access_link',
        medium: device.tech || 'iot',
        from: device.accessNodeId,
        to: device.id,
        label: device.tech || 'IoT',
        vlanRef: device.vlanRef || '',
        meta: { iotDevice: deepClone(device) }
      });
      else addWarning(graph, 'iot_device_without_access', `El dispositivo IoT ${device.name || device.id} no tiene infraestructura de acceso asociada.`, { deviceId: device.id });
    });

    safeArray(project.links).forEach(link => {
      const aPortId = getLinkPortA(link);
      const bPortId = getLinkPortB(link);
      const aPort = aPortId ? portsById.get(aPortId) : null;
      const bPort = bPortId ? portsById.get(bPortId) : null;
      const aDeviceId = aPort ? getPortDeviceId(aPort) : '';
      const bDeviceId = bPort ? getPortDeviceId(bPort) : '';

      addLink(graph, {
        id: link.id,
        source: 'netwizard',
        kind: 'physical',
        medium: 'ethernet',
        from: aPortId,
        to: bPortId,
        fromPortId: aPortId,
        toPortId: bPortId,
        fromDeviceId: aDeviceId,
        toDeviceId: bDeviceId,
        label: link.notes || link.label || 'ethernet',
        meta: deepClone(link)
      });

      if (aDeviceId && bDeviceId) {
        addLink(graph, {
          id: `device_${link.id}`,
          source: 'netwizard',
          kind: 'physical_device_path',
          medium: 'ethernet',
          from: aDeviceId,
          to: bDeviceId,
          fromPortId: aPortId,
          toPortId: bPortId,
          label: `${aPort?.name || aPortId} ↔ ${bPort?.name || bPortId}`,
          meta: { originalLinkId: link.id }
        });
      } else {
        addWarning(graph, 'link_unresolved_endpoint', `El enlace ${link.id} no se pudo resolver completamente a dispositivos.`, { linkId: link.id, aPortId, bPortId, aDeviceId, bDeviceId });
      }
    });

    graph.meta.warningCount = graph.warnings.length;
    return graph;
  }

  function validateUnifiedGraph(graph){
    const result = {
      ok: !!graph?.ok,
      warnings: safeArray(graph?.warnings),
      summary: {
        nodes: safeArray(graph?.nodes).length,
        links: safeArray(graph?.links).length,
        segments: safeArray(graph?.segments).length,
        warnings: safeArray(graph?.warnings).length
      }
    };
    return result;
  }

  function saveUnifiedSnapshot(){
    const snapshot = getProjectSnapshot();
    const graph = makeUnifiedGraph(snapshot.ok ? snapshot.project : null);
    const payload = {
      schema: 'netwizard-unified-export-v1',
      bridgeVersion: BRIDGE_VERSION,
      exportedAt: nowIso(),
      snapshot,
      graph,
      validation: validateUnifiedGraph(graph)
    };
    localStorage.setItem(UNIFIED_STORAGE_KEY, JSON.stringify(payload));
    return payload;
  }

  function downloadUnifiedSnapshot(filename){
    const payload = saveUnifiedSnapshot();
    const name = filename || `netwizard-unified-${Date.now()}.json`;
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = name;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    return payload;
  }

  window.NetWizardBridge = Object.freeze({
    version: BRIDGE_VERSION,
    schema: UNIFIED_SCHEMA_VERSION,
    storageKey: UNIFIED_STORAGE_KEY,
    getProjectSnapshot,
    makeUnifiedGraph,
    validateUnifiedGraph,
    saveUnifiedSnapshot,
    downloadUnifiedSnapshot
  });

  window.dispatchEvent(new CustomEvent('netwizard:bridge-ready', {
    detail: { version: BRIDGE_VERSION, schema: UNIFIED_SCHEMA_VERSION }
  }));
})();
