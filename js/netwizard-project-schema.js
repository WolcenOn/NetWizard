/* =========================================================
   NetWizard Project Schema v3.48
   Validación, migración ligera y sanitización centralizada del proyecto.
   Cargable tanto en navegador clásico como en Node.js.
========================================================= */
/*
Mantenimiento:
- Este módulo es la frontera de confianza de import/export. Cualquier campo nuevo
  del proyecto debe normalizarse aquí antes de usarse en UI, planificación o exports.
- Mantener prepareImport() tolerante con proyectos antiguos y prepareExport() estricto
  con el formato versionado.
- Los errores devueltos por validateProjectReferences() deben ser comprensibles para
  la Puerta de Producción y para tests de regresión.
*/
(function initNetWizardProjectSchema(root){
  'use strict';

  const SCHEMA_VERSION = '3.48.0';
  const FORMAT = 'netwizard-project';

  function clone(value){
    return JSON.parse(JSON.stringify(value == null ? null : value));
  }

  function cleanText(value, maxLen){
    const max = Number.isFinite(maxLen) ? maxLen : 240;
    return (value ?? '')
      .toString()
      .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '')
      .trim()
      .slice(0, max);
  }

  function cleanId(value, fallback){
    const raw = cleanText(value || fallback || '', 120);
    return raw.replace(/[^a-zA-Z0-9_:\-.]/g, '_').slice(0, 120);
  }

  function cleanNumber(value, fallback){
    const n = parseInt(value, 10);
    return Number.isFinite(n) ? n : fallback;
  }

  function asObject(value){
    return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
  }

  function asArray(value){
    return Array.isArray(value) ? value : [];
  }

  function defaultProject(defaults){
    return typeof defaults === 'function' ? defaults() : clone(defaults || {});
  }

  function normalizeWithDefaults(project, defaults){
    const def = defaultProject(defaults);
    const p = { ...def, ...asObject(project) };
    const arrayKeys = ['devices','ports','vlans','subnets','hosts','links','fwRules','physicalLocations','hostPhysicalLocations'];
    for(const key of arrayKeys) p[key] = asArray(p[key]);
    p.vlanMatrix = asObject(p.vlanMatrix);
    p.dhcp = asObject(p.dhcp);
    p.security = { ...asObject(def.security), ...asObject(p.security) };
    p.roas = { ...asObject(def.roas), ...asObject(p.roas) };
    p.vtp = { ...asObject(def.vtp), ...asObject(p.vtp), roles: asObject(asObject(p.vtp).roles) };
    p.topo = { ...asObject(def.topo), ...asObject(p.topo), pos: asObject(asObject(p.topo).pos) };
    p.uiSort = asObject(p.uiSort);
    p.visual = { ...asObject(def.visual), ...asObject(p.visual) };
    p.visual.locs = asArray(p.visual.locs);
    p.visual.assign = asObject(p.visual.assign);
    p.visual.assign.devices = asObject(p.visual.assign.devices);
    p.visual.assign.hosts = asObject(p.visual.assign.hosts);
    p.visual.pos = asObject(p.visual.pos);
    p.visual.view = { ...asObject(asObject(def.visual).view), ...asObject(p.visual.view) };
    p.iot = { ...asObject(def.iot), ...asObject(p.iot) };
    p.iot.accessNodes = asArray(p.iot.accessNodes);
    p.iot.devices = asArray(p.iot.devices);
    p.iot.map = { ...asObject(asObject(def.iot).map), ...asObject(p.iot.map) };
    p.iot.map.show = { ...asObject(asObject(asObject(def.iot).map).show), ...asObject(asObject(p.iot.map).show) };
    return p;
  }

  function sanitizeObjectStrings(obj, maxLen){
    const out = {};
    for(const [k,v] of Object.entries(asObject(obj))){
      if(typeof v === 'string') out[k] = cleanText(v, maxLen);
      else if(v && typeof v === 'object') out[k] = clone(v);
      else out[k] = v;
    }
    return out;
  }


  function sanitizeDhcpMap(dhcp){
    const out = {};
    for(const [key, raw] of Object.entries(asObject(dhcp))){
      const cfg = asObject(raw);
      const cleanKey = cleanText(key, 20);
      out[cleanKey] = {
        enabled: cfg.enabled === true || cfg.enabled === 'true' || cfg.enabled === '1' || cfg.enabled === 1,
        dns: cleanText(Array.isArray(cfg.dns) ? cfg.dns.join(',') : (cfg.dns || '8.8.8.8'), 160),
        domain: cleanText(cfg.domain || '', 120),
        lease: Math.max(1, Math.min(365, cleanNumber(cfg.lease, 1))),
        start: cleanText(cfg.start || cfg.poolStart || '', 80),
        end: cleanText(cfg.end || cfg.poolEnd || '', 80),
        exclusions: asArray(cfg.exclusions).map((x) => ({
          start: cleanText(asObject(x).start || asObject(x).ip || '', 80),
          end: cleanText(asObject(x).end || asObject(x).start || asObject(x).ip || '', 80),
          reason: cleanText(asObject(x).reason || '', 120)
        })).filter(x => x.start),
        reservations: asArray(cfg.reservations).map((x) => ({
          name: cleanText(asObject(x).name || '', 80),
          ip: cleanText(asObject(x).ip || '', 80),
          mac: cleanText(asObject(x).mac || '', 80),
          hostRef: cleanId(asObject(x).hostRef || '', '')
        })).filter(x => x.ip || x.mac || x.hostRef)
      };
    }
    return out;
  }

  function sanitizeProject(project, options){
    const defaults = options && options.defaults;
    const p = normalizeWithDefaults(clone(project || {}), defaults);
    p._schemaVersion = SCHEMA_VERSION;
    p.projName = cleanText(p.projName, 160);
    p.step = cleanText(p.step || 'dash', 40);
    p.selected = p.selected ? cleanId(p.selected, '') : null;
    p.dhcp = sanitizeDhcpMap(p.dhcp);

    p.devices = p.devices.map((d, idx) => {
      const x = sanitizeObjectStrings(d, 500);
      x.id = cleanId(x.id, `dev_${idx+1}`);
      x.name = cleanText(x.name || `Dispositivo ${idx+1}`, 80);
      x.type = cleanText(x.type || 'switch', 40);
      x.vendorOs = cleanText(x.vendorOs || 'cisco_ios', 40);
      x.notes = cleanText(x.notes, 1000);
      const poeBudget = Number(x.poeBudgetW != null ? x.poeBudgetW : x.poeBudgetWatts);
      x.poeBudgetW = Number.isFinite(poeBudget) && poeBudget >= 0 ? Math.round(poeBudget * 10) / 10 : null;
      x.poeBudgetWatts = x.poeBudgetW;
      return x;
    });

    p.ports = p.ports.map((d, idx) => {
      const x = sanitizeObjectStrings(d, 500);
      x.id = cleanId(x.id, `port_${idx+1}`);
      x.deviceId = cleanId(x.deviceId, '');
      x.name = cleanText(x.name || `port${idx+1}`, 80);
      x.mode = cleanText(x.mode || 'access', 30);
      x.accessVlanRef = cleanId(x.accessVlanRef || '', '');
      x.nativeVlanRef = cleanId(x.nativeVlanRef || x.nativeVlan || '', '');
      const allowedRaw = Array.isArray(x.allowedVlans) ? x.allowedVlans : (Array.isArray(x.allowed) ? x.allowed : []);
      x.allowedVlans = allowedRaw.map(v => Number(v)).filter(v => Number.isFinite(v) && v >= 1 && v <= 4094).filter((v,i,a)=>a.indexOf(v)===i).sort((a,b)=>a-b);
      x.transitVlanRef = cleanId(x.transitVlanRef || '', '');
      x.routedVlanRef = cleanId(x.routedVlanRef || '', '');
      x.l3Ip = cleanText(x.l3Ip || x.routedIp, 80);
      x.l3Cidr = cleanText(x.l3Cidr || x.routedCidr, 80);
      x.routedCidr = cleanText(x.routedCidr || x.l3Cidr, 80);
      x.routedIp = cleanText(x.routedIp || x.l3Ip, 80);
      x.poeMode = cleanText(x.poeMode || x.poe || 'auto', 40);
      const pmax = Number(x.poeWattsMax != null ? x.poeWattsMax : x.poeBudgetW);
      x.poeWattsMax = Number.isFinite(pmax) && pmax >= 0 ? Math.round(pmax * 10) / 10 : null;
      x.portfast = x.portfast === true || x.portFast === true || x.portfast === 'true' || x.portFast === 'true';
      x.portFast = x.portfast;
      x.bpduGuard = !(x.bpduGuard === false || x.bpduguard === false || x.bpduGuard === 'false' || x.bpduguard === 'false');
      x.uplink = x.uplink === true || x.isUplink === true || x.uplink === 'true' || x.isUplink === 'true';
      x.desc = cleanText(x.desc, 240);
      return x;
    });

    p.vlans = p.vlans.map((d, idx) => {
      const x = sanitizeObjectStrings(d, 500);
      x.id = cleanId(x.id, `vlan_${idx+1}`);
      x.vlanId = cleanNumber(x.vlanId, idx + 1);
      x.name = cleanText(x.name || `VLAN ${x.vlanId}`, 80);
      x.color = cleanText(x.color, 32);
      if(x.intent && typeof x.intent === 'object'){
        const rawIntent = x.intent;
        x.intent = {
          type: cleanText(rawIntent.type || '', 40),
          label: cleanText(rawIntent.label || '', 80),
          expectedHosts: Math.max(0, cleanNumber(rawIntent.expectedHosts, 0)),
          growthHosts: Math.max(0, cleanNumber(rawIntent.growthHosts, 0)),
          dhcp: rawIntent.dhcp === true || rawIntent.dhcp === 'true' || rawIntent.dhcp === '1' || rawIntent.dhcp === 1,
          internet: rawIntent.internet === true || rawIntent.internet === 'true' || rawIntent.internet === '1' || rawIntent.internet === 1,
          isolation: cleanText(rawIntent.isolation || '', 40),
          criticality: cleanText(rawIntent.criticality || '', 40),
          notes: cleanText(rawIntent.notes || '', 500)
        };
      }
      return x;
    });

    p.subnets = p.subnets.map((d, idx) => {
      const x = sanitizeObjectStrings(d, 500);
      x.id = cleanId(x.id, `subnet_${idx+1}`);
      x.vlanRef = cleanId(x.vlanRef, '');
      x.cidr = cleanText(x.cidr, 80);
      x.gateway = cleanText(x.gateway, 80);
      return x;
    });

    p.hosts = p.hosts.map((d, idx) => {
      const x = sanitizeObjectStrings(d, 500);
      x.id = cleanId(x.id, `host_${idx+1}`);
      x.name = cleanText(x.name || `Host ${idx+1}`, 80);
      x.type = cleanText(x.type || 'pc', 40);
      x.vlanRef = cleanId(x.vlanRef, '');
      x.portRef = cleanId(x.portRef, '');
      x.ipMode = cleanText(x.ipMode || 'dhcp', 20);
      x.staticIp = cleanText(x.staticIp, 80);
      x.notes = cleanText(x.notes, 1000);
      x.poeMode = cleanText(x.poeMode || x.poe || 'auto', 40);
      if(x.poeRequired === true || x.poeRequired === 'true' || x.poeRequired === '1' || x.poeRequired === 1) x.poeRequired = true;
      else if(x.poeRequired === false || x.poeRequired === 'false' || x.poeRequired === '0' || x.poeRequired === 0) x.poeRequired = false;
      else x.poeRequired = null;
      const hw = Number(x.poeWatts != null ? x.poeWatts : x.powerWatts);
      x.poeWatts = Number.isFinite(hw) && hw >= 0 ? Math.round(hw * 10) / 10 : null;
      return x;
    });

    p.links = p.links.map((d, idx) => {
      const x = sanitizeObjectStrings(d, 500);
      x.id = cleanId(x.id, `link_${idx+1}`);
      x.aPortId = cleanId(x.aPortId || x.a, '');
      x.bPortId = cleanId(x.bPortId || x.b, '');
      x.a = cleanId(x.a || x.aPortId, '');
      x.b = cleanId(x.b || x.bPortId, '');
      x.transitVlanRef = cleanId(x.transitVlanRef || x.l3VlanRef || x.vlanRef, '');
      x.l3VlanRef = cleanId(x.l3VlanRef || x.transitVlanRef, '');
      x.vlanRef = cleanId(x.vlanRef || x.transitVlanRef, '');
      x.medium = cleanText(x.medium || 'auto', 40);
      x.cableType = cleanText(x.cableType || x.category || 'auto', 40);
      x.category = cleanText(x.category || x.cableType || '', 40);
      const lm = Number(x.lengthM != null ? x.lengthM : x.lengthMeters);
      x.lengthM = Number.isFinite(lm) && lm >= 0 ? Math.round(lm * 100) / 100 : null;
      x.lengthMeters = x.lengthM;
      x.speed = cleanText(x.speed || 'auto', 40);
      x.poeRequired = x.poeRequired === true || x.poeRequired === 'true' || x.poeRequired === '1' || x.poeRequired === 1;
      x.notes = cleanText(x.notes, 500);
      return x;
    });

    p.fwRules = p.fwRules.map((d, idx) => {
      const x = sanitizeObjectStrings(d, 500);
      x.id = cleanId(x.id, `fw_${idx+1}`);
      x.name = cleanText(x.name || `Regla ${idx+1}`, 80);
      x.src = cleanText(x.src || 'any', 120);
      x.dst = cleanText(x.dst || 'any', 120);
      x.proto = cleanText(x.proto || 'any', 20);
      x.port = cleanText(x.port || 'any', 80);
      x.action = cleanText(x.action || 'allow', 20);
      return x;
    });

    p.physicalLocations = p.physicalLocations.map((d, idx) => {
      const x = sanitizeObjectStrings(d, 500);
      x.id = cleanId(x.id, `loc_${idx+1}`);
      x.name = cleanText(x.name || `Ubicación ${idx+1}`, 100);
      x.type = cleanText(x.type || 'other', 40);
      x.parentId = cleanId(x.parentId, '');
      x.notes = cleanText(x.notes, 1000);
      return x;
    });

    p.iot.accessNodes = p.iot.accessNodes.map((d, idx) => {
      const x = sanitizeObjectStrings(d, 800);
      x.id = cleanId(x.id, `iot_access_${idx+1}`);
      x.name = cleanText(x.name || `Acceso IoT ${idx+1}`, 100);
      x.type = cleanText(x.type, 50);
      x.parentDeviceId = cleanId(x.parentDeviceId, '');
      x.parentPortId = cleanId(x.parentPortId, '');
      x.serviceVlanRef = cleanId(x.serviceVlanRef, '');
      x.mgmtVlanRef = cleanId(x.mgmtVlanRef, '');
      x.mgmtIp = cleanText(x.mgmtIp, 80);
      x.notes = cleanText(x.notes, 1000);
      return x;
    });

    p.iot.devices = p.iot.devices.map((d, idx) => {
      const x = sanitizeObjectStrings(d, 800);
      x.id = cleanId(x.id, `iot_device_${idx+1}`);
      x.name = cleanText(x.name || `IoT ${idx+1}`, 100);
      x.type = cleanText(x.type, 50);
      x.protocol = cleanText(x.protocol || x.tech, 50);
      x.accessNodeId = cleanId(x.accessNodeId, '');
      x.vlanRef = cleanId(x.vlanRef, '');
      x.identifier = cleanText(x.identifier, 120);
      x.notes = cleanText(x.notes, 1000);
      return x;
    });

    return { project: p, warnings: [] };
  }

  function validateProject(project, options){
    const nw = root.NetWizardNetworkUtils || (typeof require === 'function' ? tryRequireNetworkUtils() : null);
    const p = normalizeWithDefaults(project || {}, options && options.defaults);
    const errors = [];
    const warnings = [];
    const infos = [];

    function checkIds(items, label){
      const seen = new Set();
      for(const item of asArray(items)){
        if(!item.id) errors.push(`${label}: elemento sin id.`);
        else if(seen.has(item.id)) errors.push(`${label}: id duplicado ${item.id}.`);
        seen.add(item.id);
      }
    }

    checkIds(p.devices, 'devices');
    checkIds(p.ports, 'ports');
    checkIds(p.vlans, 'vlans');
    checkIds(p.subnets, 'subnets');
    checkIds(p.hosts, 'hosts');

    const devIds = new Set(p.devices.map(x=>x.id));
    const portIds = new Set(p.ports.map(x=>x.id));
    const vlanIds = new Set(p.vlans.map(x=>x.id));
    const subnetCidrs = [];

    for(const vlan of p.vlans){
      if(!Number.isFinite(parseInt(vlan.vlanId, 10)) || vlan.vlanId < 1 || vlan.vlanId > 4094) errors.push(`VLAN ${vlan.name || vlan.id}: vlanId fuera de rango 1-4094.`);
    }

    for(const port of p.ports){
      if(port.deviceId && !devIds.has(port.deviceId)) errors.push(`Puerto ${port.name || port.id}: deviceId inexistente.`);
      if(port.accessVlanRef && !vlanIds.has(port.accessVlanRef)) warnings.push(`Puerto ${port.name || port.id}: VLAN access inexistente.`);
    }

    for(const subnet of p.subnets){
      if(subnet.vlanRef && !vlanIds.has(subnet.vlanRef)) errors.push(`Subnet ${subnet.cidr || subnet.id}: VLAN inexistente.`);
      if(nw && subnet.cidr){
        const parsed = nw.parseCidr(subnet.cidr);
        if(!parsed) errors.push(`Subnet ${subnet.cidr}: CIDR inválido.`);
        else {
          for(const other of subnetCidrs){
            if(nw.cidrOverlaps(parsed.cidr, other.cidr)) warnings.push(`Subnets solapadas: ${parsed.cidr} y ${other.cidr}.`);
          }
          subnetCidrs.push({ id: subnet.id, cidr: parsed.cidr });
          if(subnet.gateway){
            const valid = nw.validateSubnetAssignment({ id:subnet.id, vlanRef:subnet.vlanRef, cidr:parsed.cidr, gateway:subnet.gateway }, p.subnets.filter(s=>s.id!==subnet.id));
            if(!valid.ok && valid.code !== 'subnet_overlap') errors.push(`Subnet ${parsed.cidr}: gateway inválido (${valid.message || valid.code}).`);
          }
        }
      }
    }

    for(const host of p.hosts){
      if(host.vlanRef && !vlanIds.has(host.vlanRef)) warnings.push(`Host ${host.name || host.id}: VLAN inexistente.`);
      if(host.portRef && !portIds.has(host.portRef)) errors.push(`Host ${host.name || host.id}: puerto inexistente.`);
    }

    for(const link of p.links){
      const aRef = link.aPortId || link.a;
      const bRef = link.bPortId || link.b;
      if(aRef && !portIds.has(aRef)) errors.push(`Enlace ${link.id}: puerto A inexistente.`);
      if(bRef && !portIds.has(bRef)) errors.push(`Enlace ${link.id}: puerto B inexistente.`);
      if(aRef && bRef && aRef === bRef) errors.push(`Enlace ${link.id}: conecta el mismo puerto consigo mismo.`);
      const transitRef = link.transitVlanRef || link.l3VlanRef || link.vlanRef;
      if(transitRef && !vlanIds.has(transitRef)) errors.push(`Enlace ${link.id}: VLAN de tránsito inexistente.`);
    }

    return { ok: errors.length === 0, errors, warnings, infos };
  }

  function tryRequireNetworkUtils(){
    try { return require('./netwizard-network-utils.js'); } catch { return null; }
  }

  function migrateProject(raw, options){
    const warnings = [];
    const migrations = [];
    const wrapped = raw && raw.project && typeof raw.project === 'object' ? raw.project : raw;
    const p = clone(wrapped || {});
    if(!p._schemaVersion){
      p._schemaVersion = 'legacy';
      migrations.push('legacy->3.48.0');
    }
    if(!p.iot && raw && raw.iot && typeof raw.iot === 'object'){
      p.iot = clone(raw.iot);
      migrations.push('external-iot->project.iot');
    }
    const sanitized = sanitizeProject(p, options || {});
    return { project: sanitized.project, warnings: warnings.concat(sanitized.warnings || []), migrations };
  }

  function prepareImport(raw, options){
    const migrated = migrateProject(raw, options || {});
    const validation = validateProject(migrated.project, options || {});
    return {
      ok: validation.ok,
      project: migrated.project,
      errors: validation.errors,
      warnings: migrated.warnings.concat(validation.warnings || []),
      infos: validation.infos || [],
      migrations: migrated.migrations
    };
  }

  function prepareExport(project, options){
    const sanitized = sanitizeProject(project, options || {}).project;
    return {
      format: FORMAT,
      schemaVersion: SCHEMA_VERSION,
      exportedAt: new Date().toISOString(),
      project: sanitized
    };
  }

  const api = {
    version: 'netwizard-project-schema-v3.48',
    schemaVersion: SCHEMA_VERSION,
    cleanText,
    cleanId,
    sanitizeProject,
    validateProject,
    migrateProject,
    prepareImport,
    prepareExport
  };

  root.NetWizardProjectSchema = api;
  if(typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
