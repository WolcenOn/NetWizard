/* =========================================================
   NetWizard Vendor Export Hardening v3.30
   Auditoría preventiva para exportaciones por fabricante.
   Cargable en navegador clásico y en Node.js para tests.
========================================================= */

/*
Mantenimiento:
- Este módulo no genera configuración: decide si el export por vendor parece seguro.
- Añadir nuevas reglas como issues NW-VENDOR-* y cubrirlas con tests.
- Evitar falsos bloqueos: en modo demo deben ser warnings cuando falten datos opcionales.
*/
(function initNetWizardVendorHardening(root){
  'use strict';

  function arr(v){ return Array.isArray(v) ? v : []; }
  function obj(v){ return v && typeof v === 'object' && !Array.isArray(v) ? v : {}; }
  function clean(v){ return String(v == null ? '' : v).trim(); }
  function num(v){ const n = Number(v); return Number.isFinite(n) ? n : null; }
  function issue(input){
    const A = root.NetWizardAudit;
    const payload = Object.assign({category:'vendor-export', source:'vendor-hardening'}, input || {});
    return A && typeof A.createIssue === 'function' ? A.createIssue(payload) : Object.assign({severity:'warning', blocking:false, code:'NW-VENDOR-000', message:''}, payload);
  }
  function byId(list){ const m = {}; arr(list).forEach(x => { if(x && x.id) m[x.id] = x; }); return m; }
  function vlanByRef(project){ const m = {}; arr(project.vlans).forEach(v => { if(v && v.id) m[v.id]=v; if(v && v.vlanId!=null) m[String(v.vlanId)]=v; }); return m; }
  function subnetByVlan(project){ const m = {}; arr(project.subnets).forEach(s => { if(s && s.vlanRef) m[s.vlanRef]=s; }); return m; }
  function portsByDevice(project, devId){ return arr(project.ports).filter(p => p && p.deviceId === devId); }
  function hostsOnPort(project, portId){ return arr(project.hosts).filter(h => h && h.portRef === portId); }
  function deviceLabel(d){ return clean(d && d.name) || clean(d && d.id) || 'dispositivo'; }
  function portLabel(p){ return clean(p && p.name) || clean(p && p.id) || 'puerto'; }
  function vendorOf(d){ return clean(d && d.vendorOs) || 'cisco_ios'; }
  function isL3Device(d){ return /router|firewall|l3|gateway/i.test(clean(d && d.type)) || vendorOf(d) === 'cisco_asa' || vendorOf(d) === 'fortinet' || vendorOf(d) === 'pfsense'; }
  function hasUsefulIp(value){ return /^\d{1,3}(\.\d{1,3}){3}$/.test(clean(value)); }
  function hasCidr(value){ return /^\d{1,3}(\.\d{1,3}){3}\/\d{1,2}$/.test(clean(value)); }
  function hasInternet(project){ return arr(project.devices).some(d => d && d.internetEdge === 'yes') || !!clean(obj(project.roas).wanCidr); }

  function validateCommon(project, device){
    const issues = [];
    if(!device || !device.id){
      issues.push(issue({code:'NW-VENDOR-001', severity:'error', blocking:true, message:'No se puede exportar un dispositivo sin ID.'}));
      return issues;
    }
    if(!clean(device.name)) issues.push(issue({code:'NW-VENDOR-002', severity:'warning', message:`${deviceLabel(device)} no tiene nombre legible; la exportación usará un fallback.`}));
    if(!clean(device.vendorOs)) issues.push(issue({code:'NW-VENDOR-003', severity:'warning', message:`${deviceLabel(device)} no tiene vendor/OS definido; se asumirá Cisco IOS.`}));
    const ports = portsByDevice(project, device.id);
    if(!ports.length) issues.push(issue({code:'NW-VENDOR-004', severity:'warning', message:`${deviceLabel(device)} no tiene puertos definidos; la configuración exportada será incompleta.`}));
    for(const p of ports){
      if(!clean(p.name)) issues.push(issue({code:'NW-VENDOR-005', severity:'error', blocking:true, message:`${deviceLabel(device)} tiene un puerto sin nombre de interfaz válido.`}));
      if((p.mode === 'routed' || p.l3Ip || p.routedIp) && !(hasUsefulIp(p.l3Ip || p.routedIp) && (p.l3Cidr || p.routedCidr))){
        issues.push(issue({code:'NW-VENDOR-006', severity:'error', blocking:true, message:`${deviceLabel(device)} ${portLabel(p)} es L3/routed pero no tiene IP/CIDR completo para exportación.`}));
      }
    }
    return issues;
  }

  function validateCiscoIos(project, device){
    const issues = [];
    const vmap = vlanByRef(project);
    const ports = portsByDevice(project, device.id);
    const isSwitch = clean(device.type) === 'switch';
    if(isSwitch){
      for(const p of ports){
        if(p.mode === 'access'){
          if(!p.accessVlanRef || !vmap[p.accessVlanRef]) issues.push(issue({code:'NW-CISCO-ACCESS-001', severity:'error', blocking:true, message:`${deviceLabel(device)} ${portLabel(p)} está en access pero no tiene VLAN válida.`}));
          if(hostsOnPort(project, p.id).length && !p.bpduGuard) issues.push(issue({code:'NW-CISCO-ACCESS-002', severity:'warning', message:`${deviceLabel(device)} ${portLabel(p)} tiene hosts y no tiene BPDU Guard marcado.`}));
          if(hostsOnPort(project, p.id).length && !p.portFast && !p.portfast) issues.push(issue({code:'NW-CISCO-ACCESS-003', severity:'info', message:`${deviceLabel(device)} ${portLabel(p)} tiene hosts; se recomienda PortFast si es puerto de usuario final.`}));
        }
        if(p.mode === 'trunk'){
          if(!arr(p.allowedVlans).length) issues.push(issue({code:'NW-CISCO-TRUNK-001', severity:'error', blocking:true, message:`${deviceLabel(device)} ${portLabel(p)} es trunk sin lista de VLANs permitidas; evita exportar trunks abiertos en producción.`}));
          if(!p.nativeVlanRef || !vmap[p.nativeVlanRef]) issues.push(issue({code:'NW-CISCO-TRUNK-002', severity:'warning', message:`${deviceLabel(device)} ${portLabel(p)} es trunk sin VLAN nativa explícita válida.`}));
        }
      }
    }else{
      const roas = obj(project.roas);
      const gwId = clean(roas.gwId);
      if(gwId === device.id){
        if(!clean(roas.lanIf) && arr(project.vlans).length > 1) issues.push(issue({code:'NW-CISCO-ROAS-001', severity:'error', blocking:true, message:`${deviceLabel(device)} está marcado como gateway RoaS pero no tiene interfaz LAN configurada.`}));
        if(device.internetEdge === 'yes'){
          if(!clean(device.wanIf)) issues.push(issue({code:'NW-CISCO-WAN-001', severity:'warning', message:`${deviceLabel(device)} es borde de Internet pero no tiene interfaz WAN definida.`}));
          if(!hasCidr(roas.wanCidr)) issues.push(issue({code:'NW-CISCO-WAN-002', severity:'error', blocking:true, message:`${deviceLabel(device)} es borde de Internet pero WAN CIDR es inválido o está vacío.`}));
          if(!hasUsefulIp(roas.wanNh)) issues.push(issue({code:'NW-CISCO-WAN-003', severity:'warning', message:`${deviceLabel(device)} es borde de Internet pero no tiene next-hop WAN válido para ruta por defecto.`}));
        }
      }
    }
    return issues;
  }

  function validateFirewallVendor(project, device){
    const issues = [];
    const snByV = subnetByVlan(project);
    const vlans = arr(project.vlans);
    if(vlans.length && !Object.keys(snByV).length) issues.push(issue({code:'NW-FW-001', severity:'error', blocking:true, message:`${deviceLabel(device)} exportaría firewall sin subredes/gateways de VLAN.`}));
    for(const v of vlans){
      const sn = snByV[v.id];
      if(!sn || !hasCidr(sn.cidr) || !hasUsefulIp(sn.gateway)){
        issues.push(issue({code:'NW-FW-002', severity:'error', blocking:true, message:`${deviceLabel(device)}: VLAN ${v.vlanId || v.id} no tiene subnet/gateway válido para interfaces firewall.`}));
      }
    }
    const policies = arr(project.fwRules);
    if(vlans.length > 1 && !policies.length) issues.push(issue({code:'NW-FW-003', severity:'warning', message:`${deviceLabel(device)} exportaría firewall sin reglas ACL/políticas definidas.`}));
    if(hasInternet(project) && !policies.some(r => /internet|wan|any/i.test(clean(r.dst)) && clean(r.action) !== 'deny')){
      issues.push(issue({code:'NW-FW-004', severity:'warning', message:`${deviceLabel(device)} tiene salida/Internet en el diseño, pero no hay política explícita hacia Internet/WAN.`}));
    }
    return issues;
  }

  function validateJuniper(project, device){
    const issues = [];
    const ports = portsByDevice(project, device.id);
    for(const p of ports){
      if(p.mode === 'trunk' && !arr(p.allowedVlans).length) issues.push(issue({code:'NW-JUNOS-TRUNK-001', severity:'error', blocking:true, message:`${deviceLabel(device)} ${portLabel(p)} es trunk Junos sin VLAN members explícitos.`}));
      if(p.mode === 'access' && !p.accessVlanRef) issues.push(issue({code:'NW-JUNOS-ACCESS-001', severity:'error', blocking:true, message:`${deviceLabel(device)} ${portLabel(p)} es access sin VLAN asignada.`}));
    }
    return issues;
  }

  function validateDhcpServerVendor(project, device){
    const issues = [];
    const dhcp = obj(project.dhcp);
    const enabled = Object.values(dhcp).filter(v => v && v.enabled);
    if((vendorOf(device) === 'windows' || vendorOf(device) === 'linux') && !enabled.length){
      issues.push(issue({code:'NW-DHCP-SRV-001', severity:'warning', message:`${deviceLabel(device)} exporta servidor ${vendorOf(device)} sin scopes DHCP activos.`}));
    }
    return issues;
  }

  function validateDeviceExport(project, device, options){
    const p = project || {};
    const d = device || {};
    const issues = [];
    issues.push(...validateCommon(p, d));
    const vendor = vendorOf(d);
    if(vendor === 'cisco_ios') issues.push(...validateCiscoIos(p, d));
    if(vendor === 'cisco_asa' || vendor === 'fortinet' || vendor === 'pfsense') issues.push(...validateFirewallVendor(p, d));
    if(vendor === 'juniper_junos') issues.push(...validateJuniper(p, d));
    if(vendor === 'windows' || vendor === 'linux') issues.push(...validateDhcpServerVendor(p, d));
    const prod = options && options.productionMode;
    if(prod && root.NetWizardAudit && typeof root.NetWizardAudit.applyProductionPolicy === 'function') return root.NetWizardAudit.applyProductionPolicy(issues);
    return issues;
  }

  function validateAllExports(project, options){
    const p = project || {};
    const issues = [];
    for(const d of arr(p.devices)) issues.push(...validateDeviceExport(p, d, options));
    const split = root.NetWizardAudit && root.NetWizardAudit.splitIssues ? root.NetWizardAudit.splitIssues(issues) : {ok:!issues.some(i=>i.severity==='error'), issues};
    return Object.assign(split, {issues, canExport: !issues.some(i => i.blocking || i.severity === 'error')});
  }

  function summarizeExportHardening(report, options){
    const r = report || {};
    const issues = arr(r.issues);
    if(root.NetWizardAudit && typeof root.NetWizardAudit.summarizeIssues === 'function'){
      return root.NetWizardAudit.summarizeIssues(issues, {title:(options&&options.title)||'Hardening de exportación vendor', empty:'Sin incidencias vendor críticas.'});
    }
    return issues.map(i => `[${i.code}] ${i.message}`).join('\n') || 'Sin incidencias vendor críticas.';
  }

  function deviceSummary(project, device){
    const r = validateDeviceExport(project, device, {});
    const errors = r.filter(i => i.severity === 'error').length;
    const warnings = r.filter(i => i.severity === 'warning').length;
    return `${deviceLabel(device)} · ${vendorOf(device)} · ${errors} errores · ${warnings} avisos`;
  }

  function bindBrowserUi(){
    if(!root.document) return;
    const doc = root.document;
    const $ = id => doc.getElementById(id);
    function render(){
      const pg = $('pg-dash');
      if(!pg || $('vendorHardeningCard')) return;
      const card = doc.createElement('div');
      card.className = 'card';
      card.id = 'vendorHardeningCard';
      const staticHtml = '<div class="card-t">🧱 Hardening exportación vendor</div>'+
        '<div class="co co-ac">Revisa si las configuraciones por fabricante tienen datos suficientes antes de exportar.</div>'+
        '<div class="brow"><button class="btn bs" id="btnVendorHardening">Revisar exports</button><button class="btn bp" id="btnVendorHardeningCfg">Ir a configuración</button></div>'+
        '<pre id="vendorHardeningOut" class="out" style="max-height:260px;overflow:auto;white-space:pre-wrap;"></pre>';
      card.appendChild(doc.createRange().createContextualFragment(staticHtml));
      pg.appendChild(card);
      $('btnVendorHardening').onclick = () => {
        const project = root.NetWizardState && root.NetWizardState.getSnapshot ? root.NetWizardState.getSnapshot() : {};
        const prod = root.NetWizardAudit && root.NetWizardAudit.isProduction && root.NetWizardAudit.isProduction();
        const report = validateAllExports(project, {productionMode:prod});
        $('vendorHardeningOut').textContent = summarizeExportHardening(report);
      };
      $('btnVendorHardeningCfg').onclick = () => { if(root.navTo) root.navTo('cfg'); };
    }
    if(doc.readyState === 'loading') doc.addEventListener('DOMContentLoaded', render); else render();
    doc.addEventListener('nw:project:changed', () => setTimeout(render, 0));
  }

  const api = {version:'netwizard-vendor-hardening-v3.30', validateDeviceExport, validateAllExports, summarizeExportHardening, deviceSummary};
  root.NetWizardVendorHardening = api;
  if(typeof module !== 'undefined' && module.exports) module.exports = api;
  bindBrowserUi();
})(typeof window !== 'undefined' ? window : globalThis);
