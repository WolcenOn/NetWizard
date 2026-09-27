/* =========================================================
   NetWizard Project Schema v3.50
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

  const SCHEMA_VERSION = '3.50.0';
  const FORMAT = 'netwizard-project';
  const SUPPORTED_SCHEMA = /^3\.(?:2[89]|3\d|4\d|50)\.0$/;
  const DEVICE_MODEL = root.NetWizardDeviceModel || (typeof require === 'function' ? tryRequireDeviceModel() : null);
  const DEVICE_KINDS = DEVICE_MODEL ? DEVICE_MODEL.kinds.slice() : ['switch','router','firewall','access_point','wlan_controller','server','appliance'];
  const MAX_OBSERVED_CONFIG_CHARS = 256 * 1024;
  const MAX_OBSERVED_TOTAL_CHARS = 4 * 1024 * 1024;
  const ADVANCED_ARRAY_KEYS = [
    'vrfs','wanCircuits','trafficProfiles','internalServices','wifiControllers','wifiAccessPoints','wifiSsids',
    'ipv6Networks','failureScenarios','stacks','mlagDomains','haGroups','diversityPolicies','linkAggregations'
  ];
  const ADVANCED_OBJECT_KEYS = ['routing','highAvailability','accessSecurity','management','driftPolicy','deployment'];
  const WORKFLOW_MODES = Object.freeze(['inventory','design']);

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

  function normalizeDeviceKind(value){
    if(DEVICE_MODEL) return DEVICE_MODEL.normalizeKind(value);
    const raw=cleanText(value && typeof value === 'object' ? (value.kind || value.type || '') : value || '', 40).toLowerCase();
    if(DEVICE_KINDS.includes(raw)) return raw;
    if(raw.includes('switch')) return 'switch';
    if(raw.includes('router') || raw.includes('gateway')) return 'router';
    if(raw.includes('firewall')) return 'firewall';
    if(raw === 'ap' || raw.includes('access_point')) return 'access_point';
    if(raw.includes('controller') || raw.includes('wlc')) return 'wlan_controller';
    if(raw.includes('server') || raw.includes('servidor')) return 'server';
    return 'appliance';
  }

  function tryRequireDeviceModel(){
    try { return require('./netwizard-device-model.js'); } catch { return null; }
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
    const arrayKeys = [
      'devices','ports','vlans','subnets','hosts','links','fwRules','physicalLocations','hostPhysicalLocations','customDeviceModels',
      'racks','rackItems','pdus','powerConnections',
      'patchPanels','telecomOutlets','cableRuns','patchConnections','hostOutletConnections',
      ...ADVANCED_ARRAY_KEYS
    ];
    for(const key of arrayKeys) p[key] = asArray(p[key]);
    for(const key of ADVANCED_OBJECT_KEYS) p[key] = asObject(p[key]);
    p.workflow = asObject(p.workflow);
    p.designRequirements = asObject(p.designRequirements);
    p.observedState = p.observedState && typeof p.observedState === 'object' && !Array.isArray(p.observedState) ? p.observedState : null;
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
      else if(v && typeof v === 'object') out[k] = sanitizeLooseValue(v, maxLen);
      else out[k] = v;
    }
    return out;
  }

  function sanitizeLooseValue(value, maxLen, depth){
    const level = depth || 0;
    if(level > 16) return null;
    if(typeof value === 'string') return cleanText(value, maxLen || 1000);
    if(Array.isArray(value)) return value.map(item => sanitizeLooseValue(item, maxLen, level + 1));
    if(value && typeof value === 'object'){
      const out = {};
      for(const [key, item] of Object.entries(value)){
        if(['__proto__','prototype','constructor'].includes(key)) continue;
        out[cleanText(key, 120)] = sanitizeLooseValue(item, maxLen, level + 1);
      }
      return out;
    }
    return value;
  }

  function cleanConfigText(value){
    return String(value == null ? '' : value)
      .replace(/\r\n?/g, '\n')
      .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '');
  }

  function sanitizeObservedState(value){
    if(!value || typeof value !== 'object' || Array.isArray(value)) return null;
    const source = asObject(value);
    const out = sanitizeLooseValue(Object.fromEntries(Object.entries(source).filter(([key]) => key !== 'deviceConfigs')), 1000);
    const rawConfigs = Array.isArray(source.deviceConfigs)
      ? Object.fromEntries(source.deviceConfigs.map(entry => [cleanId(asObject(entry).deviceId, ''), entry]).filter(([id]) => id))
      : asObject(source.deviceConfigs);
    const configs = {};
    let total = 0;
    for(const [rawId, rawEntry] of Object.entries(rawConfigs).slice(0, 1000)){
      const id = cleanId(rawId || asObject(rawEntry).deviceId, '');
      if(!id) continue;
      const entry = typeof rawEntry === 'string' ? { content: rawEntry } : asObject(rawEntry);
      const content = cleanConfigText(entry.content);
      const remaining = Math.max(0, MAX_OBSERVED_TOTAL_CHARS - total);
      const limit = Math.min(MAX_OBSERVED_CONFIG_CHARS, remaining);
      const kept = content.slice(0, limit);
      total += kept.length;
      configs[id] = {
        vendor: cleanText(entry.vendor, 80),
        capturedAt: cleanText(entry.capturedAt || source.observedAt, 80),
        source: cleanText(entry.source, 160),
        content: kept,
        contentTruncated: entry.contentTruncated === true || kept.length < content.length
      };
    }
    out.deviceConfigs = configs;
    out.deviceConfigsTruncated = Object.keys(rawConfigs).length > Object.keys(configs).length;
    return out;
  }


  function sanitizeCustomDeviceModel(raw, idx){
    const x=sanitizeObjectStrings(raw, 1000);
    x.id=cleanId(x.id,`custom_model_${idx+1}`);
    x.manufacturer=cleanText(x.manufacturer||'',120);
    x.model=cleanText(x.model||'',120);
    x.sku=cleanText(x.sku||x.partNumber||'',120);
    x.revision=cleanText(x.revision||'',80);
    x.kind=normalizeDeviceKind(x.kind||x.type||'appliance');
    x.type=x.kind;
    x.notes=cleanText(x.notes||'',1000);
    for(const key of ['rackUnits','widthMm','depthMm','weightKg','powerTypicalWatts','powerMaxWatts','poeBudgetWatts']){
      if(x[key]==null||x[key]===''){delete x[key];continue;}
      const n=Number(x[key]);
      if(Number.isFinite(n)&&n>=0)x[key]=Math.round(n*100)/100;else delete x[key];
    }
    if(x.rackUnits!=null)x.rackUnits=Math.max(0.5,x.rackUnits);
    const psu=asObject(x.powerSupplies);
    x.powerSupplies={
      count:Math.max(0,Math.min(16,cleanNumber(psu.count,0))),
      redundant:psu.redundant===true||psu.redundant==='true'||psu.redundant===1||psu.redundant==='1',
      voltage:cleanText(psu.voltage||'',40)
    };
    x.portGroups=asArray(x.portGroups).slice(0,128).map((g,gidx)=>{
      const p=sanitizeObjectStrings(g,500);
      p.id=cleanId(p.id,`group_${gidx+1}`);
      p.name=cleanText(p.name||'',120);
      p.namePattern=cleanText(p.namePattern||'port{n}',120);
      p.count=Math.max(0,Math.min(2048,cleanNumber(p.count,0)));
      p.startIndex=Math.max(0,cleanNumber(p.startIndex,1));
      p.media=cleanText(p.media||'',40);
      const speed=Number(p.speedMaxMbps);p.speedMaxMbps=Number.isFinite(speed)&&speed>=0?Math.round(speed):null;
      p.supportedSpeedsMbps=asArray(p.supportedSpeedsMbps).map(Number).filter(v=>Number.isFinite(v)&&v>=0).map(v=>Math.round(v)).filter((v,i,a)=>a.indexOf(v)===i).sort((a,b)=>a-b);
      p.poeCapable=p.poeCapable===true||p.poeCapable==='true'||p.poeCapable===1||p.poeCapable==='1';
      return p;
    });
    x.capabilities=sanitizeLooseValue(asObject(x.capabilities),500);
    return x;
  }

  function sanitizeDesignCapacityPolicy(raw){
    const x=asObject(raw);
    const number=(value,fallback,min,max)=>{
      const n=Number(value);const safe=Number.isFinite(n)?n:fallback;
      return Math.max(min,Math.min(max,safe));
    };
    return {
      portGrowthPercent:number(x.portGrowthPercent,20,0,200),
      minFreePorts:Math.round(number(x.minFreePorts,8,0,10000)),
      rackGrowthPercent:number(x.rackGrowthPercent,20,0,200),
      minFreeRackUnits:Math.round(number(x.minFreeRackUnits,4,0,1000))
    };
  }

  function sanitizeDesignRackPolicy(raw){
    const x=asObject(raw);
    const panelPorts=Math.max(1,Math.min(192,cleanNumber(x.patchPanelPorts,24)));
    const pattern=cleanText(x.layoutPattern||'patch-manager-switch',40);
    return {
      patchPanelPorts:panelPorts,
      organizerPerSwitch:!(x.organizerPerSwitch===false||x.organizerPerSwitch==='false'||x.organizerPerSwitch===0||x.organizerPerSwitch==='0'),
      layoutPattern:['patch-manager-switch','patch-switch','manual'].includes(pattern)?pattern:'patch-manager-switch'
    };
  }

  function sanitizeDesignRequirements(raw){
    const source=asObject(raw);
    return {
      version:'netwizard-design-requirements-v1',
      capacityPolicy:sanitizeDesignCapacityPolicy(source.capacityPolicy),
      rackPolicy:sanitizeDesignRackPolicy(source.rackPolicy),
      locationPlans:asArray(source.locationPlans).slice(0,1000).map((entry,idx)=>{
        const x=asObject(entry);
        const mode=cleanText(x.rackMode||'own',20).toLowerCase();
        return {
          id:cleanId(x.id,`location_plan_${idx+1}`),
          locationId:cleanId(x.locationId,''),
          rackMode:['own','served','none'].includes(mode)?mode:'own',
          servingLocationId:cleanId(x.servingLocationId,''),
          capacityPolicy:sanitizeDesignCapacityPolicy(x.capacityPolicy),
          rackPolicy:sanitizeDesignRackPolicy(x.rackPolicy),
          demands:asArray(x.demands).slice(0,1000).map((d,didx)=>{
            const item=asObject(d);
            return {
              id:cleanId(item.id,`demand_${didx+1}`),
              label:cleanText(item.label||`Necesidad ${didx+1}`,120),
              category:cleanText(item.category||'other',40),
              count:Math.max(0,Math.min(100000,cleanNumber(item.count,0))),
              media:cleanText(item.media||'copper',40).toLowerCase(),
              speedMinMbps:Math.max(0,Number.isFinite(Number(item.speedMinMbps))?Math.round(Number(item.speedMinMbps)):1000),
              poeRequired:item.poeRequired===true||item.poeRequired==='true'||item.poeRequired===1||item.poeRequired==='1',
              poeWattsEach:Math.max(0,Number.isFinite(Number(item.poeWattsEach))?Math.round(Number(item.poeWattsEach)*100)/100:0),
              notes:cleanText(item.notes||'',500)
            };
          }).filter(d=>d.count>0)
        };
      }).filter(x=>x.locationId)
    };
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
    const workflowSource = asObject(p.workflow);
    const workflowMode = cleanText(workflowSource.mode || 'design', 20).toLowerCase();
    const workflowWarnings = [];
    if(workflowSource.mode != null && !WORKFLOW_MODES.includes(workflowMode)){
      workflowWarnings.push(`workflow.mode desconocido (${cleanText(workflowSource.mode, 40)}); se usa design por compatibilidad.`);
    }
    p.workflow = {
      ...sanitizeObjectStrings(workflowSource, 240),
      mode: WORKFLOW_MODES.includes(workflowMode) ? workflowMode : 'design'
    };
    const derivedFromSource = asObject(asObject(p.workflow).derivedFrom);
    if(cleanText(derivedFromSource.type, 40).toLowerCase()==='inventory'){
      p.workflow.derivedFrom = {
        type:'inventory',
        snapshotId:cleanId(derivedFromSource.snapshotId || '', ''),
        sourceProjectName:cleanText(derivedFromSource.sourceProjectName || '', 160),
        sourceSchemaVersion:cleanText(derivedFromSource.sourceSchemaVersion || '', 40),
        createdAt:cleanText(derivedFromSource.createdAt || '', 80)
      };
      p.workflow.designPhase = 'to-be';
    }else{
      delete p.workflow.derivedFrom;
      if(p.workflow.designPhase != null) p.workflow.designPhase = cleanText(p.workflow.designPhase, 40);
    }
    p.dhcp = sanitizeDhcpMap(p.dhcp);
    p.customDeviceModels = p.customDeviceModels.map(sanitizeCustomDeviceModel);

    p.devices = p.devices.map((d, idx) => {
      const x = sanitizeObjectStrings(d, 500);
      x.id = cleanId(x.id, `dev_${idx+1}`);
      x.name = cleanText(x.name || `Dispositivo ${idx+1}`, 80);
      x.kind = normalizeDeviceKind(x);
      x.type = x.kind;
      x.vendorOs = DEVICE_MODEL
        ? DEVICE_MODEL.normalizeVendor(x.vendorOs || x.platform || x.os || 'generic_network')
        : cleanText(x.vendorOs || 'generic_network', 40);
      x.notes = cleanText(x.notes, 1000);
      x.manufacturer = cleanText(x.manufacturer || '', 120);
      x.model = cleanText(x.model || '', 120);
      x.serialNumber = cleanText(x.serialNumber || '', 160);
      x.assetTag = cleanText(x.assetTag || '', 120);
      x.originRef = cleanId(x.originRef || '', '');
      const derivedFromInventory = asObject(asObject(p.workflow).derivedFrom).type === 'inventory';
      const disposition = cleanText(x.designDisposition || '', 20).toLowerCase();
      if(x.designDisposition != null && !['keep','retire','replace','add'].includes(disposition)){
        workflowWarnings.push(`Dispositivo ${x.name}: designDisposition desconocido (${cleanText(x.designDisposition,40)}).`);
      }
      if(derivedFromInventory || x.designDisposition != null){
        x.designDisposition = ['keep','retire','replace','add'].includes(disposition) ? disposition : (x.originRef ? 'keep' : 'add');
      }else{
        delete x.designDisposition;
      }
      x.replacementDeviceRef = cleanId(x.replacementDeviceRef || '', '');
      x.replacementNote = cleanText(x.replacementNote || '', 500);
      if(x.designDisposition !== 'replace'){
        delete x.replacementDeviceRef;
        delete x.replacementNote;
      }
      const modelSource = cleanText(x.modelSource || 'manual', 20).toLowerCase();
      if(x.modelSource != null && !['manual','global','custom'].includes(modelSource)){
        workflowWarnings.push(`Dispositivo ${x.name}: modelSource desconocido (${cleanText(x.modelSource,40)}); se usa manual.`);
      }
      x.modelSource = ['manual','global','custom'].includes(modelSource) ? modelSource : 'manual';
      x.modelRef = cleanId(x.modelRef || '', '');
      const poeBudget = Number(x.poeBudgetW != null ? x.poeBudgetW : x.poeBudgetWatts);
      x.poeBudgetW = Number.isFinite(poeBudget) && poeBudget >= 0 ? Math.round(poeBudget * 10) / 10 : null;
      x.poeBudgetWatts = x.poeBudgetW;
      x.rackId = cleanId(x.rackId || x.rack, '');
      x.locationId = cleanId(x.locationId || x.physicalLocationId, '');
      x.physicalLocation = cleanText(x.physicalLocation || '', 160);
      for(const key of ['rackUnit','rackUnits','weightKg','powerDrawWatts','powerMaxWatts']){
        if(x[key] == null || x[key] === '') { delete x[key]; continue; }
        const n = Number(x[key]);
        if(Number.isFinite(n) && n >= 0) x[key] = Math.round(n * 100) / 100;
        else delete x[key];
      }
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

    p.racks = p.racks.map((d, idx) => {
      const x = sanitizeObjectStrings(d, 500);
      x.id = cleanId(x.id, `rack_${idx+1}`);
      x.name = cleanText(x.name || `Rack ${idx+1}`, 160);
      x.locationId = cleanId(x.locationId || x.physicalLocationId, '');
      x.rackUnits = Math.max(1, Math.min(100, cleanNumber(x.rackUnits, 42)));
      x.numberingDirection = x.numberingDirection === 'top-down' ? 'top-down' : 'bottom-up';
      for(const key of ['widthMm','depthMm','maxLoadKg','powerCapacityWatts','coolingCapacityWatts']){
        if(x[key] == null || x[key] === '') { delete x[key]; continue; }
        const n = Number(x[key]);
        if(Number.isFinite(n) && n >= 0) x[key] = Math.round(n * 100) / 100;
        else delete x[key];
      }
      return x;
    });

    p.rackItems = p.rackItems.map((d, idx) => {
      const x = sanitizeObjectStrings(d, 500);
      x.id = cleanId(x.id, `rackitem_${idx+1}`);
      x.rackId = cleanId(x.rackId, '');
      x.type = cleanText(x.type || 'rack-item', 60);
      x.deviceId = cleanId(x.deviceId, '');
      x.patchPanelId = cleanId(x.patchPanelId, '');
      x.label = cleanText(x.label || x.name || x.id, 160);
      if(x.startUnit == null || x.startUnit === '') delete x.startUnit;
      else { const start = Number(x.startUnit); if(Number.isFinite(start) && start >= 1) x.startUnit = Math.round(start * 100) / 100; else delete x.startUnit; }
      if(x.heightUnits == null || x.heightUnits === '') delete x.heightUnits;
      else { const height = Number(x.heightUnits); if(Number.isFinite(height) && height > 0) x.heightUnits = Math.round(height * 100) / 100; else delete x.heightUnits; }
      x.face = cleanText(x.face || 'front', 30);
      x.mounting = cleanText(x.mounting || '', 40);
      for(const key of ['weightKg','powerDrawWatts']){
        if(x[key] == null || x[key] === '') { delete x[key]; continue; }
        const n = Number(x[key]);
        if(Number.isFinite(n) && n >= 0) x[key] = Math.round(n * 100) / 100;
        else delete x[key];
      }
      return x;
    });

    p.pdus = p.pdus.map((d, idx) => {
      const x = sanitizeObjectStrings(d, 500);
      x.id = cleanId(x.id, `pdu_${idx+1}`);
      x.rackId = cleanId(x.rackId, '');
      x.name = cleanText(x.name || `PDU ${idx+1}`, 160);
      x.feed = cleanText(x.feed || '', 30);
      x.mounting = cleanText(x.mounting || '', 40);
      for(const key of ['voltage','maxCurrentAmps','maxPowerWatts']){
        if(x[key] == null || x[key] === '') { delete x[key]; continue; }
        const n = Number(x[key]);
        if(Number.isFinite(n) && n >= 0) x[key] = Math.round(n * 100) / 100;
        else delete x[key];
      }
      x.outletCount = Math.max(1, cleanNumber(x.outletCount, 1));
      return x;
    });

    p.powerConnections = p.powerConnections.map((d, idx) => {
      const x = sanitizeObjectStrings(d, 500);
      x.id = cleanId(x.id, `power_${idx+1}`);
      x.deviceId = cleanId(x.deviceId, '');
      x.pduId = cleanId(x.pduId, '');
      if(typeof x.outlet === 'string') x.outlet = cleanText(x.outlet, 40);
      else {
        const outlet = Number(x.outlet); x.outlet = Number.isFinite(outlet) && outlet >= 1 ? Math.floor(outlet) : null;
      }
      const psu = Number(x.powerSupplyIndex); x.powerSupplyIndex = Number.isFinite(psu) && psu >= 0 ? Math.floor(psu) : null;
      x.feed = cleanText(x.feed || '', 30);
      return x;
    });

    p.patchPanels = p.patchPanels.map((d, idx) => {
      const x = sanitizeObjectStrings(d, 500);
      x.id = cleanId(x.id, `patch_${idx+1}`);
      x.rackId = cleanId(x.rackId, '');
      x.name = cleanText(x.name || `Patch panel ${idx+1}`, 120);
      x.portCount = Math.max(1, cleanNumber(x.portCount, 24));
      x.category = cleanText(x.category || 'Cat6A', 40);
      const rackUnit = Number(x.rackUnit); x.rackUnit = Number.isFinite(rackUnit) ? rackUnit : null;
      return x;
    });

    p.telecomOutlets = p.telecomOutlets.map((d, idx) => {
      const x = sanitizeObjectStrings(d, 500);
      x.id = cleanId(x.id, `outlet_${idx+1}`);
      x.locationId = cleanId(x.locationId, '');
      x.name = cleanText(x.name || `Toma ${idx+1}`, 120);
      x.portCount = Math.max(1, cleanNumber(x.portCount, 1));
      x.category = cleanText(x.category || 'Cat6A', 40);
      x.room = cleanText(x.room || '', 120);
      return x;
    });

    p.cableRuns = p.cableRuns.map((d, idx) => {
      const x = sanitizeObjectStrings(d, 500);
      x.id = cleanId(x.id, `cable_${idx+1}`);
      x.label = cleanText(x.label || '', 120);
      x.patchPanelId = cleanId(x.patchPanelId, '');
      x.patchPort = Math.max(1, cleanNumber(x.patchPort, 1));
      x.outletId = cleanId(x.outletId, '');
      x.outletPort = Math.max(1, cleanNumber(x.outletPort, 1));
      x.cableType = cleanText(x.cableType || 'Cat6A', 40);
      const lengthM = Number(x.lengthM); x.lengthM = Number.isFinite(lengthM) && lengthM >= 0 ? Math.round(lengthM * 10) / 10 : null;
      x.route = cleanText(x.route || x.physicalPath || '', 500);
      return x;
    });

    p.patchConnections = p.patchConnections.map((d, idx) => {
      const x = sanitizeObjectStrings(d, 500);
      x.id = cleanId(x.id, `patchcord_${idx+1}`);
      x.patchPanelId = cleanId(x.patchPanelId, '');
      x.patchPort = Math.max(1, cleanNumber(x.patchPort, 1));
      x.switchPortId = cleanId(x.switchPortId, '');
      const lengthM = Number(x.patchCordLengthM); x.patchCordLengthM = Number.isFinite(lengthM) && lengthM >= 0 ? Math.round(lengthM * 10) / 10 : null;
      return x;
    });

    p.hostOutletConnections = p.hostOutletConnections.map((d, idx) => {
      const x = sanitizeObjectStrings(d, 500);
      x.id = cleanId(x.id, `hostcord_${idx+1}`);
      x.hostId = cleanId(x.hostId, '');
      x.outletId = cleanId(x.outletId, '');
      x.outletPort = Math.max(1, cleanNumber(x.outletPort, 1));
      const lengthM = Number(x.patchCordLengthM); x.patchCordLengthM = Number.isFinite(lengthM) && lengthM >= 0 ? Math.round(lengthM * 10) / 10 : null;
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
      x.gatewayDeviceRef = cleanId(x.gatewayDeviceRef, '');
      return x;
    });

    p.hosts = p.hosts.map((d, idx) => {
      const x = sanitizeObjectStrings(d, 500);
      x.id = cleanId(x.id, `host_${idx+1}`);
      x.name = cleanText(x.name || `Host ${idx+1}`, 80);
      x.type = cleanText(x.type || 'pc', 40);
      x.vlanRef = cleanId(x.vlanRef, '');
      x.portRef = cleanId(x.portRef, '');
      x.deviceRef = cleanId(x.deviceRef, '');
      x.ipMode = cleanText(x.ipMode || 'dhcp', 20);
      x.staticIp = cleanText(x.staticIp, 80);
      x.notes = cleanText(x.notes, 1000);
      x.locationId = cleanId(x.locationId || x.physicalLocationId, '');
      x.physicalLocation = cleanText(x.physicalLocation || '', 160);
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
      x.physicalPath = cleanText(x.physicalPath || '', 500);
      const capacity = Number(x.capacityMbps); x.capacityMbps = Number.isFinite(capacity) && capacity >= 0 ? Math.round(capacity * 100) / 100 : null;
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

    p.designRequirements = sanitizeDesignRequirements(p.designRequirements);

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

    for(const key of ADVANCED_ARRAY_KEYS){
      p[key] = sanitizeLooseValue(p[key], 1000).filter(item => item && typeof item === 'object' && !Array.isArray(item)).map((item, idx) => {
        item.id = cleanId(item.id, `${key}_${idx+1}`);
        return item;
      });
    }
    for(const key of ADVANCED_OBJECT_KEYS) p[key] = sanitizeLooseValue(p[key], 1000);
    p.observedState = sanitizeObservedState(p.observedState);

    return { project: p, warnings: workflowWarnings };
  }

  function validateProject(project, options){
    const nw = root.NetWizardNetworkUtils || (typeof require === 'function' ? tryRequireNetworkUtils() : null);
    const p = normalizeWithDefaults(project || {}, options && options.defaults);
    const errors = [];
    const warnings = [];
    const infos = [];
    if(!WORKFLOW_MODES.includes(cleanText(asObject(p.workflow).mode || 'design', 20).toLowerCase())){
      errors.push('workflow.mode debe ser inventory o design.');
    }

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
    checkIds(p.customDeviceModels, 'customDeviceModels');
    for(const key of ADVANCED_ARRAY_KEYS) checkIds(p[key], key);

    const locationIds = new Set(p.physicalLocations.map(x=>x.id));
    const requirementPlans = asArray(asObject(p.designRequirements).locationPlans);
    const requirementLocations = new Set();
    for(const plan of requirementPlans){
      if(!['own','served','none'].includes(cleanText(plan.rackMode||'',20).toLowerCase())) errors.push(`designRequirements ${plan.locationId||plan.id}: rackMode inválido.`);
      if(requirementLocations.has(plan.locationId)) errors.push(`designRequirements: ubicación duplicada ${plan.locationId}.`);
      requirementLocations.add(plan.locationId);
      if(plan.locationId && !locationIds.has(plan.locationId)) errors.push(`designRequirements: ubicación inexistente (${plan.locationId}).`);
      if(plan.rackMode==='served'){
        if(!plan.servingLocationId) errors.push(`designRequirements ${plan.locationId}: rackMode served requiere servingLocationId.`);
        else if(plan.servingLocationId===plan.locationId) errors.push(`designRequirements ${plan.locationId}: una ubicación no puede servirse a sí misma.`);
        else if(!locationIds.has(plan.servingLocationId)) errors.push(`designRequirements ${plan.locationId}: servingLocationId inexistente (${plan.servingLocationId}).`);
      }
      const demandIds=new Set();
      for(const demand of asArray(plan.demands)){
        if(demandIds.has(demand.id)) errors.push(`designRequirements ${plan.locationId}: demanda duplicada ${demand.id}.`);
        demandIds.add(demand.id);
      }
    }
    const reqMap=new Map(requirementPlans.map(x=>[x.locationId,x]));
    for(const plan of requirementPlans){
      const seen=new Set();let current=plan;
      while(current&&current.rackMode==='served'&&current.servingLocationId){
        if(seen.has(current.locationId)){errors.push(`designRequirements: ciclo de dependencia de rack detectado desde ${plan.locationId}.`);break;}
        seen.add(current.locationId);current=reqMap.get(current.servingLocationId)||null;
      }
    }

    const devIds = new Set(p.devices.map(x=>x.id));
    const customModelIds = new Set(p.customDeviceModels.map(x=>x.id));
    const portIds = new Set(p.ports.map(x=>x.id));
    const vlanIds = new Set(p.vlans.map(x=>x.id));
    const vrfIds = new Set(p.vrfs.map(x=>x.id));
    const circuitIds = new Set(p.wanCircuits.map(x=>x.id));
    const controllerIds = new Set(p.wifiControllers.map(x=>x.id));
    const subnetCidrs = [];

    for(const device of p.devices){
      const kind=device.kind || device.type;
      if(kind && !DEVICE_KINDS.includes(kind)) warnings.push(`Dispositivo ${device.name || device.id}: kind no normalizado (${kind}).`);
      const source=cleanText(device.modelSource||'manual',20).toLowerCase();
      if(!['manual','global','custom'].includes(source)) errors.push(`Dispositivo ${device.name || device.id}: modelSource inválido.`);
      if(source==='custom' && !device.modelRef) errors.push(`Dispositivo ${device.name || device.id}: modelSource custom requiere modelRef.`);
      if(source==='custom' && device.modelRef && !customModelIds.has(device.modelRef)) errors.push(`Dispositivo ${device.name || device.id}: modelRef personalizado inexistente (${device.modelRef}).`);
      if(device.designDisposition != null && !['keep','retire','replace','add'].includes(cleanText(device.designDisposition,20).toLowerCase())) errors.push(`Dispositivo ${device.name || device.id}: designDisposition inválido.`);
      if(device.designDisposition==='add' && device.originRef) warnings.push(`Dispositivo ${device.name || device.id}: marcado como add pero conserva originRef.`);
      if(device.designDisposition!=='add' && asObject(asObject(p.workflow).derivedFrom).type==='inventory' && !device.originRef) warnings.push(`Dispositivo ${device.name || device.id}: no tiene originRef dentro de un diseño derivado de inventario.`);
      if(device.replacementDeviceRef && !devIds.has(device.replacementDeviceRef)) errors.push(`Dispositivo ${device.name || device.id}: replacementDeviceRef inexistente (${device.replacementDeviceRef}).`);
    }

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
      if(host.deviceRef && !devIds.has(host.deviceRef)) errors.push(`Host ${host.name || host.id}: deviceRef inexistente.`);
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

    for(const circuit of p.wanCircuits){
      if(circuit.deviceId && !devIds.has(circuit.deviceId)) errors.push(`Circuito WAN ${circuit.name || circuit.id}: dispositivo inexistente.`);
      if(circuit.portId && !portIds.has(circuit.portId)) errors.push(`Circuito WAN ${circuit.name || circuit.id}: puerto inexistente.`);
    }
    for(const profile of p.trafficProfiles){
      if(profile.circuitRef && !circuitIds.has(profile.circuitRef)) errors.push(`Perfil de tráfico ${profile.name || profile.id}: circuito WAN inexistente.`);
      if(profile.linkRef && !p.links.some(link => link.id === profile.linkRef)) errors.push(`Perfil de tráfico ${profile.name || profile.id}: enlace inexistente.`);
    }
    for(const ap of p.wifiAccessPoints){
      if(ap.deviceId && !devIds.has(ap.deviceId)) errors.push(`AP ${ap.name || ap.id}: dispositivo inexistente.`);
      if(ap.uplinkPortRef && !portIds.has(ap.uplinkPortRef)) errors.push(`AP ${ap.name || ap.id}: puerto uplink inexistente.`);
      if(ap.controllerRef && !controllerIds.has(ap.controllerRef)) errors.push(`AP ${ap.name || ap.id}: controlador inexistente.`);
    }
    for(const network of p.ipv6Networks){
      if(network.vrfRef && !vrfIds.has(network.vrfRef)) errors.push(`Red IPv6 ${network.name || network.id}: VRF inexistente.`);
      if(network.vlanRef && !vlanIds.has(network.vlanRef)) errors.push(`Red IPv6 ${network.name || network.id}: VLAN inexistente.`);
    }
    for(const aggregation of p.linkAggregations){
      for(const portRef of asArray(aggregation.memberPortIds)) if(!portIds.has(portRef)) errors.push(`Agregación ${aggregation.name || aggregation.id}: puerto miembro inexistente (${portRef}).`);
    }
    for(const service of p.internalServices){
      for(const endpoint of asArray(service.endpoints)) if(endpoint.deviceId && !devIds.has(endpoint.deviceId)) errors.push(`Servicio ${service.name || service.id}: dispositivo endpoint inexistente (${endpoint.deviceId}).`);
    }

    return { ok: errors.length === 0, errors, warnings, infos };
  }

  function tryRequireNetworkUtils(){
    try { return require('./netwizard-network-utils.js'); } catch { return null; }
  }

  function migrateProject(raw, options){
    const warnings = [];
    const migrations = [];
    const errors = [];
    const wrapped = raw && raw.project && typeof raw.project === 'object' ? raw.project : raw;
    const p = clone(wrapped || {});
    const sourceSchemaVersion = cleanText(p._schemaVersion || (raw && raw.schemaVersion) || 'legacy', 40) || 'legacy';
    if(sourceSchemaVersion !== 'legacy' && !SUPPORTED_SCHEMA.test(sourceSchemaVersion)) errors.push(`Versión de schema no soportada: ${sourceSchemaVersion}.`);
    if(sourceSchemaVersion !== SCHEMA_VERSION) migrations.push(`${sourceSchemaVersion}->${SCHEMA_VERSION}`);
    if(!p.iot && raw && raw.iot && typeof raw.iot === 'object'){
      p.iot = clone(raw.iot);
      migrations.push('external-iot->project.iot');
    }
    const sanitized = sanitizeProject(p, options || {});
    return { project: sanitized.project, warnings: warnings.concat(sanitized.warnings || []), errors, migrations, sourceSchemaVersion };
  }

  function prepareImport(raw, options){
    const migrated = migrateProject(raw, options || {});
    const validation = validateProject(migrated.project, options || {});
    return {
      ok: validation.ok && !migrated.errors.length,
      project: migrated.project,
      errors: migrated.errors.concat(validation.errors),
      warnings: migrated.warnings.concat(validation.warnings || []),
      infos: validation.infos || [],
      migrations: migrated.migrations,
      sourceSchemaVersion: migrated.sourceSchemaVersion
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
    version: 'netwizard-project-schema-v3.50',
    schemaVersion: SCHEMA_VERSION,
    model: {
      version:SCHEMA_VERSION,
      deviceKinds:DEVICE_KINDS.slice(),
      advancedArrays:ADVANCED_ARRAY_KEYS.slice(),
      advancedObjects:ADVANCED_OBJECT_KEYS.slice(),
      workflowModes:WORKFLOW_MODES.slice(),
      customDeviceModelVersion:'netwizard-custom-device-model-v1',
      designRequirementsVersion:'netwizard-design-requirements-v1'
    },
    normalizeDeviceKind,
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
