/* =========================================================
   NetWizard Production Gate v3.48
   Puerta final de preparación para exportar/aplicar en modo producción.
   Agrega auditorías L1/L2/L3/IP/DHCP/PoE/Broadcast/Políticas y
   devuelve una decisión prudente: ready / review / blocked, con guía de corrección.
   Cargable en navegador clásico y en Node.js.
========================================================= */
/*
Mantenimiento:
- Este módulo debe actuar como orquestador, no como validador profundo. Las reglas
  específicas pertenecen a módulos como L2, DHCP, PoE, Broadcast o Vendor Hardening.
- Para añadir una nueva familia de validación, crear primero un módulo testeable y
  después integrarlo en collectModuleIssues().
- No degradar errores bloqueantes a warnings sin actualizar tests y documentación de
  producción.
*/
(function initNetWizardProductionGate(root){
  'use strict';

  function arr(v){ return Array.isArray(v) ? v : []; }
  function obj(v){ return v && typeof v === 'object' && !Array.isArray(v) ? v : {}; }
  function clean(v){ return String(v == null ? '' : v).trim(); }
  function clone(v){ return JSON.parse(JSON.stringify(v == null ? null : v)); }
  function tryRequire(p){ try { return require(p); } catch { return null; } }
  function auditCore(){ return root.NetWizardAudit || (typeof require === 'function' ? tryRequire('./netwizard-audit.js') : null); }
  function planner(){ return root.NetWizardPlanner || (typeof require === 'function' ? tryRequire('./netwizard-vlsm-physical-planner.js') : null); }
  function schema(){ return root.NetWizardProjectSchema || (typeof require === 'function' ? tryRequire('./netwizard-project-schema.js') : null); }
  function dhcp(){ return root.NetWizardDhcpUtils || (typeof require === 'function' ? tryRequire('./netwizard-dhcp-utils.js') : null); }
  function policy(){ return root.NetWizardPolicyUtils || (typeof require === 'function' ? tryRequire('./netwizard-policy-utils.js') : null); }
  function broadcast(){ return root.NetWizardBroadcastUtils || (typeof require === 'function' ? tryRequire('./netwizard-broadcast-utils.js') : null); }
  function cabling(){ return root.NetWizardCablingUtils || (typeof require === 'function' ? tryRequire('./netwizard-cabling-utils.js') : null); }
  function poe(){ return root.NetWizardPoeUtils || (typeof require === 'function' ? tryRequire('./netwizard-poe-utils.js') : null); }
  function l2(){ return root.NetWizardL2Utils || (typeof require === 'function' ? tryRequire('./netwizard-l2-utils.js') : null); }
  function vendorHardening(){ return root.NetWizardVendorHardening || (typeof require === 'function' ? tryRequire('./netwizard-vendor-hardening.js') : null); }

  function i18n(){ return root.NetWizardI18n || null; }
  function localeForReport(options){ return (options && options.locale) || (i18n() && i18n().getReportLocale && i18n().getReportLocale()) || (i18n() && i18n().getLocale && i18n().getLocale()) || 'es'; }
  const FALLBACK_LABELS = {
    'pg.guide.empty':'✅ No hay incidencias que requieran corrección con los filtros actuales.',
    'pg.guide.title':'Guía de corrección priorizada',
    'pg.guide.section':'Sección recomendada',
    'pg.guide.why':'Por qué importa',
    'pg.guide.how':'Cómo corregir',
    'pg.guide.shown':'Mostradas {count} incidencias priorizadas. Ajusta filtros o resuelve las primeras y vuelve a ejecutar.',
    'pg.severity.error':'ERROR','pg.severity.warning':'AVISO','pg.severity.info':'INFO',
    'pg.status.ready':'LISTO','pg.status.review':'REQUIERE REVISIÓN','pg.status.blocked':'BLOQUEADO',
    'pg.mode.production':'producción','pg.mode.demo':'demo','pg.mode.strict':'estricto',
    'pg.checklist.title':'Checklist de producción NetWizard','pg.checklist.state':'Estado','pg.checklist.mode':'Modo','pg.checklist.generated':'Generado',
    'pg.checklist.errors':'Errores','pg.checklist.warnings':'Avisos','pg.checklist.info':'Info','pg.checklist.byCategory':'Resumen por categoría',
    'pg.checklist.noIssues':'Sin incidencias.','pg.checklist.recommendedFixes':'Correcciones recomendadas','pg.checklist.noFixes':'No hay correcciones pendientes con los datos actuales.',
    'pg.checklist.message':'Mensaje','pg.checklist.section':'Sección','pg.checklist.why':'Por qué importa','pg.checklist.steps':'Pasos','pg.checklist.exitCriteria':'Criterio de salida',
    'pg.checklist.exit.noBlocked':'La puerta de producción no está BLOQUEADA.','pg.checklist.exit.rulesReviewed':'Las reglas generadas han sido revisadas.',
    'pg.checklist.exit.vendorReviewed':'Las exportaciones vendor han sido revisadas en laboratorio.','pg.checklist.exit.snapshot':'Se conserva snapshot/export JSON antes del despliegue.'
  };
  function tr(key, params, locale){
    if(i18n() && i18n().t) return i18n().t(key, params || {}, locale || localeForReport());
    const tpl = FALLBACK_LABELS[key] || key;
    return String(tpl).replace(/\{([A-Za-z0-9_.-]+)\}/g, (_,k)=>params && Object.prototype.hasOwnProperty.call(params,k) ? String(params[k]) : '');
  }
  function severityLabel(sev, loc){ return tr(sev === 'error' ? 'pg.severity.error' : sev === 'info' ? 'pg.severity.info' : 'pg.severity.warning', {}, loc); }
  function statusLabel(status, loc){ return tr(status === 'ready' ? 'pg.status.ready' : status === 'review' ? 'pg.status.review' : 'pg.status.blocked', {}, loc); }

  const DEFAULTS = {
    productionMode:false,
    strict:true,
    requireSnapshot:false,
    maxHighBroadcastVlans:0,
    maxWarningCount:25,
    minProjectObjects:1
  };

  const CATEGORY_META = {
    schema: {label:'Schema/importación', section:'Importar/Exportar proyecto', why:'Un proyecto corrupto o con referencias inválidas puede perder datos o generar configuraciones inconsistentes.'},
    readiness: {label:'Preparación general', section:'Dashboard · Puerta de producción', why:'La validación general confirma que hay datos suficientes para revisar el diseño.'},
    l1: {label:'Capa 1 física', section:'Puertos & Enlaces · Auditoría capa 1', why:'Los problemas físicos impiden que la topología funcione aunque IP/VLAN estén bien.'},
    l2: {label:'Switching / Capa 2', section:'Puertos & Interfaces · Auditoría L2 avanzada', why:'Las VLANs deben llegar correctamente por access/trunk hasta sus gateways y servicios.'},
    routing: {label:'Routing / Capa 3', section:'VLANs & Subnets / Puertos & Enlaces', why:'Sin gateways, rutas o redes de tránsito correctas, las VLANs no tendrán conectividad.'},
    ip: {label:'Direccionamiento IP', section:'VLANs & Subnets · VLSM automático', why:'IPs duplicadas, fuera de rango o reservadas provocan fallos difíciles de diagnosticar.'},
    dhcp: {label:'DHCP', section:'VLANs & Subnets · DHCP', why:'Un scope DHCP incorrecto puede asignar direcciones inválidas o pisar IPs críticas.'},
    policy: {label:'Políticas firewall/ACL', section:'Firewall & Seguridad · Políticas desde intención VLAN', why:'Las reglas deben reflejar la intención de seguridad antes de exportarse.'},
    broadcast: {label:'Eficiencia broadcast', section:'Dashboard · Riesgo broadcast', why:'Dominios broadcast demasiado grandes reducen eficiencia y complican incidencias.'},
    cabling: {label:'Cableado', section:'Puertos & Enlaces · Cableado físico', why:'La longitud/medio deben respetar límites para evitar enlaces inestables.'},
    poe: {label:'PoE', section:'Puertos & Interfaces · PoE', why:'APs, cámaras y teléfonos necesitan potencia suficiente en el puerto y en el switch.'},
    'vendor-export': {label:'Exportación vendor', section:'Configuraciones / Hardening exportación vendor', why:'Cada fabricante exige datos concretos; exportar incompleto puede ser peligroso.'},
    general: {label:'General', section:'Dashboard', why:'Revisa la incidencia antes de aplicar o exportar cambios.'}
  };

  const CODE_REMEDIATION = [
    [/^NW-L2-042$/, {why:'Hay hosts o VLANs con gateway definido, pero la VLAN no parece tener continuidad L2 hasta el dispositivo que debería hacer de gateway.', steps:['Revisa los enlaces trunk entre switches.', 'Asegura que la VLAN está en allowed VLANs en todos los trunks necesarios.', 'Comprueba que el puerto hacia router/firewall/switch L3 transporta esa VLAN.', 'Vuelve a ejecutar la Auditoría L2 avanzada.']}],
    [/^NW-L2-0(01|02|03|04|20|21|22)$/, {why:'La configuración trunk/native VLAN puede provocar pérdida de conectividad, fugas de VLAN o comportamientos inconsistentes.', steps:['Define allowed VLANs explícitas en trunks.', 'Evita usar VLAN 1 como nativa en producción.', 'Alinea la native VLAN en ambos extremos.', 'Verifica que trunk conecta contra trunk y access contra host/endpoint.']}],
    [/^NW-L3-0(10|11|12|13|20)$/, {why:'La conectividad entre VLANs o dispositivos L3 requiere gateways, redes de tránsito e IPs consistentes.', steps:['Crea o revisa la VLAN/red de tránsito L3 si aplica.', 'Asigna IPs L3 a ambos extremos del enlace.', 'Asegura gateway por VLAN de usuario/servidor/IoT.', 'Revisa rutas estáticas generadas o necesarias.']}],
    [/^NW-IP-/, {why:'El direccionamiento IP inconsistente puede dejar equipos aislados o provocar conflictos.', steps:['Ejecuta el preflight de direccionamiento.', 'Corrige IPs duplicadas o fuera de subnet.', 'Evita usar gateway, network o broadcast como IP de host.', 'Reaplica VLSM o asignación automática si procede.']}],
    [/^NW-DHCP-/, {why:'Un DHCP incorrecto puede entregar IPs fuera de rango, pisar gateways o solaparse con estáticas.', steps:['Usa “Proponer pools DHCP” y revisa el diff.', 'Excluye gateway e IPs estáticas.', 'Asegura DNS/dominio/lease adecuados.', 'Valida DHCP antes de exportar.']}],
    [/^NW-POE-/, {why:'Si PoE no está dimensionado, APs/cámaras/teléfonos pueden no arrancar o reiniciarse.', steps:['Define presupuesto PoE del switch.', 'Marca modo PoE y capacidad de cada puerto.', 'Define consumo estimado del host.', 'Reubica dispositivos o usa switch/injector con potencia suficiente.']}],
    [/^NW-CABLE-/, {why:'Medio, velocidad y longitud fuera de especificación pueden causar errores físicos intermitentes.', steps:['Revisa medio físico y categoría del cable.', 'Comprueba longitud máxima para la velocidad prevista.', 'Usa fibra/DAC/categoría superior si hace falta.', 'Vuelve a ejecutar auditoría de capa 1.']}],
    [/^NW-BCAST-/, {why:'Un dominio broadcast grande o mal segmentado reduce eficiencia y aumenta ruido ARP/multicast.', steps:['Reduce tamaño de subnet con VLSM.', 'Separa IoT/cámaras/voz en VLANs dedicadas.', 'Limita VLANs transportadas por trunks.', 'Revisa crecimiento previsto por VLAN.']}],
    [/^NW-POL-/, {why:'Las políticas deben estar revisadas y alineadas con la intención antes de producción.', steps:['Previsualiza políticas desde intención VLAN.', 'Revisa el diff antes de aplicar.', 'Marca reglas generadas como revisadas tras validarlas.', 'Asegura que invitados/IoT/cámaras no tienen acceso lateral innecesario.']}],
    [/^NW-CISCO-|^NW-FW-|^NW-JUNOS-|^NW-FORTI-|^NW-PFSENSE-|^NW-LINUX-|^NW-WIN-/, {why:'El exportador vendor no tiene datos suficientes o detecta un patrón peligroso para producción.', steps:['Completa vendor/OS, roles e interfaces.', 'Corrige trunks, VLANs, gateways o IPs L3 faltantes.', 'Ejecuta Hardening exportación vendor.', 'Exporta de nuevo solo cuando la puerta quede en LISTO o revisión aceptada.']}],
    [/^NW-SCHEMA-/, {why:'El proyecto no cumple el modelo esperado o tiene referencias inválidas.', steps:['Reimporta desde un JSON válido.', 'Revisa IDs duplicados y referencias inexistentes.', 'Usa samples oficiales como referencia.', 'Exporta de nuevo tras migrar el proyecto.']}]
  ];

  function categoryMeta(category){ return CATEGORY_META[clean(category)] || CATEGORY_META.general; }

  function remediationForIssue(issue){
    const i = normalizeIssue(issue);
    const cat = categoryMeta(i.category);
    let match = null;
    for(const [re, data] of CODE_REMEDIATION){ if(re.test(i.code)){ match = data; break; } }
    const steps = (match && match.steps) || ['Abre la sección recomendada.', 'Corrige los datos indicados en la incidencia.', 'Ejecuta de nuevo la Puerta de producción.', 'No exportes en producción hasta resolver errores bloqueantes.'];
    return {
      code:i.code,
      severity:i.severity,
      category:i.category || 'general',
      title:`${cat.label}: ${i.code}`,
      message:i.message,
      why:(match && match.why) || cat.why,
      section:cat.section,
      steps:steps.slice(),
      blocking:!!(i.blocking || i.severity === 'error')
    };
  }

  function buildRemediationGuide(report, options){
    const opts = Object.assign({includeInfo:false, limit:120}, obj(options));
    const list = arr(report && report.issues).map(normalizeIssue).filter(i => opts.includeInfo || i.severity !== 'info');
    const priority = {error:0, warning:1, info:2};
    const sorted = list.sort((a,b) => (priority[a.severity]??9) - (priority[b.severity]??9) || String(a.category).localeCompare(String(b.category)) || String(a.code).localeCompare(String(b.code)));
    return sorted.slice(0, opts.limit).map(remediationForIssue);
  }

  function summarizeRemediationGuide(report, options){
    const opts = Object.assign({limit:40, includeInfo:false}, obj(options));
    const loc = localeForReport(opts);
    const guide = buildRemediationGuide(report, opts);
    const lines = [];
    if(!guide.length) return tr('pg.guide.empty', {}, loc);
    lines.push(tr('pg.guide.title', {}, loc));
    lines.push('===============================');
    guide.forEach((g, idx) => {
      lines.push('');
      lines.push(`${idx + 1}. [${severityLabel(g.severity, loc)}] [${g.code}] ${g.message}`);
      lines.push(`   ${tr('pg.guide.section', {}, loc)}: ${g.section}`);
      lines.push(`   ${tr('pg.guide.why', {}, loc)}: ${g.why}`);
      lines.push(`   ${tr('pg.guide.how', {}, loc)}:`);
      g.steps.forEach((step, n) => lines.push(`   ${n + 1}) ${step}`));
    });
    if(arr(report && report.issues).length > guide.length){ lines.push(''); lines.push(tr('pg.guide.shown', {count:guide.length}, loc)); }
    return lines.join('\n');
  }


  function exportChecklistMarkdown(report, options){
    const opts = obj(options);
    const loc = localeForReport(opts);
    const r = report || {};
    const counts = r.counts || summarizeCounts(r.issues || []);
    const guide = buildRemediationGuide(r, Object.assign({includeInfo:false, limit:200}, opts));
    const status = statusLabel(r.status, loc);
    const mode = `${r.productionMode ? tr('pg.mode.production', {}, loc) : tr('pg.mode.demo', {}, loc)}${r.strict ? ' · ' + tr('pg.mode.strict', {}, loc) : ''}`;
    const lines = [];
    lines.push(`# ${tr('pg.checklist.title', {}, loc)}`);
    lines.push('');
    lines.push(`- ${tr('pg.checklist.state', {}, loc)}: **${status}**`);
    lines.push(`- ${tr('pg.checklist.mode', {}, loc)}: ${mode}`);
    lines.push(`- ${tr('pg.checklist.generated', {}, loc)}: ${r.generatedAt || new Date().toISOString()}`);
    lines.push(`- ${tr('pg.checklist.errors', {}, loc)}: ${counts.errors || 0}`);
    lines.push(`- ${tr('pg.checklist.warnings', {}, loc)}: ${counts.warnings || 0}`);
    lines.push(`- ${tr('pg.checklist.info', {}, loc)}: ${counts.info || 0}`);
    lines.push('');
    lines.push(`## ${tr('pg.checklist.byCategory', {}, loc)}`);
    Object.keys(counts.byCategory || {}).sort().forEach(cat => {
      const c = counts.byCategory[cat];
      lines.push(`- ${cat}: ${c.errors || 0} ${tr('pg.checklist.errors', {}, loc).toLowerCase()} · ${c.warnings || 0} ${tr('pg.checklist.warnings', {}, loc).toLowerCase()} · ${c.info || 0} ${tr('pg.checklist.info', {}, loc).toLowerCase()}`);
    });
    if(!Object.keys(counts.byCategory || {}).length) lines.push(`- ${tr('pg.checklist.noIssues', {}, loc)}`);
    lines.push('');
    lines.push(`## ${tr('pg.checklist.recommendedFixes', {}, loc)}`);
    if(!guide.length) lines.push(`- ${tr('pg.checklist.noFixes', {}, loc)}`);
    guide.forEach((g, idx) => {
      lines.push('');
      lines.push(`### ${idx + 1}. [${severityLabel(g.severity, loc)}] ${g.code}`);
      lines.push(`- ${tr('pg.checklist.message', {}, loc)}: ${g.message}`);
      lines.push(`- ${tr('pg.checklist.section', {}, loc)}: ${g.section}`);
      lines.push(`- ${tr('pg.checklist.why', {}, loc)}: ${g.why}`);
      lines.push(`- ${tr('pg.checklist.steps', {}, loc)}:`);
      g.steps.forEach(step => lines.push(`  - [ ] ${step}`));
    });
    lines.push('');
    lines.push(`## ${tr('pg.checklist.exitCriteria', {}, loc)}`);
    lines.push(`- [ ] ${tr('pg.checklist.exit.noBlocked', {}, loc)}`);
    lines.push(`- [ ] ${tr('pg.checklist.exit.rulesReviewed', {}, loc)}`);
    lines.push(`- [ ] ${tr('pg.checklist.exit.vendorReviewed', {}, loc)}`);
    lines.push(`- [ ] ${tr('pg.checklist.exit.snapshot', {}, loc)}`);
    return lines.join('\n');
  }


  function mkIssue(code, severity, category, message, extra){
    const NWA = auditCore();
    const base = Object.assign({code, severity, category, message, source:'production-gate'}, extra || {});
    return NWA && NWA.createIssue ? NWA.createIssue(base) : Object.assign(base, {blocking:severity === 'error'});
  }

  function normalizeIssue(issue, fallback){
    const NWA = auditCore();
    if(NWA && NWA.normalizeIssue) return NWA.normalizeIssue(issue, fallback || {});
    if(typeof issue === 'string') return mkIssue((fallback && fallback.code) || 'NW-GATE-000', (fallback && fallback.severity) || 'warning', (fallback && fallback.category) || 'general', issue);
    return mkIssue(clean(issue && issue.code) || (fallback && fallback.code) || 'NW-GATE-000', clean(issue && issue.severity) || (fallback && fallback.severity) || 'warning', clean(issue && issue.category) || (fallback && fallback.category) || 'general', clean(issue && issue.message) || clean(issue && issue.msg));
  }

  function pushLegacy(issues, report, defaults){
    const r = report || {};
    arr(r.errors).forEach(msg => issues.push(normalizeIssue(msg, Object.assign({}, defaults, {severity:'error'}))));
    arr(r.warnings).forEach(msg => issues.push(normalizeIssue(msg, Object.assign({}, defaults, {severity:'warning'}))));
    arr(r.info).forEach(msg => issues.push(normalizeIssue(msg, Object.assign({}, defaults, {severity:'info'}))));
  }

  function dedupeIssues(issues){
    const seen = new Set();
    const out = [];
    for(const raw of arr(issues)){
      const i = normalizeIssue(raw);
      const key = [i.code, i.severity, i.category, i.message].join('\u0001');
      if(seen.has(key)) continue;
      seen.add(key); out.push(i);
    }
    return out;
  }

  function projectObjectCount(p){
    return arr(p.devices).length + arr(p.ports).length + arr(p.vlans).length + arr(p.subnets).length + arr(p.hosts).length + arr(p.links).length + arr(p.fwRules).length;
  }

  function hasGeneratedUnreviewedPolicy(p){
    return arr(p.fwRules).some(r => r && (r.generated || r.source === 'intent') && !r.reviewed && !r.reviewedAt);
  }

  function missingGatewayForProduction(p){
    const subnetsByVlan = new Map(arr(p.subnets).map(s => [s.vlanRef, s]));
    const vlanHasHosts = new Set(arr(p.hosts).map(h => h.vlanRef).filter(Boolean));
    const vlanHasIntent = new Set(arr(p.vlans).filter(v => v && v.intent && v.intent.type && v.intent.type !== 'transit').map(v => v.id));
    const out = [];
    for(const v of arr(p.vlans)){
      if(!v || !v.id) continue;
      const intentType = clean(v.intent && v.intent.type).toLowerCase();
      if(intentType === 'transit') continue;
      if(!vlanHasHosts.has(v.id) && !vlanHasIntent.has(v.id)) continue;
      const sn = subnetsByVlan.get(v.id);
      if(!sn) continue;
      if(!clean(sn.gateway)) out.push(`VLAN ${v.vlanId || v.id} ${v.name || ''}: tiene subnet ${sn.cidr || ''} pero no gateway.`.trim());
    }
    return out;
  }

  function auditSchema(p){
    const S = schema();
    const issues = [];
    if(!S || !S.validateProject) return issues;
    try{
      const v = S.validateProject(p || {});
      arr(v.errors).forEach(msg => issues.push(mkIssue('NW-SCHEMA-001', 'error', 'schema', msg)));
      arr(v.warnings).forEach(msg => issues.push(mkIssue('NW-SCHEMA-101', 'warning', 'schema', msg)));
    }catch(e){ issues.push(mkIssue('NW-SCHEMA-900', 'error', 'schema', 'No se pudo validar el schema del proyecto: ' + (e && e.message ? e.message : e))); }
    return issues;
  }

  function collectModuleIssues(project, options){
    const p = project || {};
    const opts = Object.assign({}, DEFAULTS, obj(options));
    const issues = [];

    if(projectObjectCount(p) < opts.minProjectObjects){
      issues.push(mkIssue('NW-GATE-001', opts.productionMode ? 'error' : 'warning', 'readiness', 'El proyecto está vacío o no tiene elementos suficientes para una validación de producción.'));
    }

    issues.push(...auditSchema(p));

    const PL = planner();
    if(PL && PL.readinessAudit){
      try{
        const r = PL.readinessAudit(p, {productionMode:!!opts.productionMode});
        arr(r.issues).forEach(i => issues.push(normalizeIssue(i)));
        if(!arr(r.issues).length) pushLegacy(issues, r, {code:'NW-READY-LEGACY', category:'readiness'});
      }catch(e){ issues.push(mkIssue('NW-GATE-PLANNER', 'error', 'readiness', 'No se pudo ejecutar la auditoría principal: ' + (e && e.message ? e.message : e))); }
    }else{
      issues.push(mkIssue('NW-GATE-PLANNER-MISSING', 'warning', 'readiness', 'El planificador/auditor principal no está disponible.'));
    }


    const L2 = l2();
    if(L2 && L2.auditL2){
      try{ arr(L2.auditL2(p).issues).forEach(i => issues.push(normalizeIssue(i, {category:'l2'}))); }
      catch(e){ issues.push(mkIssue('NW-GATE-L2', 'warning', 'l2', 'No se pudo ejecutar la auditoría L2 avanzada: ' + (e && e.message ? e.message : e))); }
    }

    const DH = dhcp();
    if(DH && DH.validateDhcpForProject){
      try{ arr(DH.validateDhcpForProject(p).issues).forEach(i => issues.push(normalizeIssue(i, {category:'dhcp'}))); }
      catch(e){ issues.push(mkIssue('NW-GATE-DHCP', 'warning', 'dhcp', 'No se pudo ejecutar la validación DHCP: ' + (e && e.message ? e.message : e))); }
    }

    const POL = policy();
    if(POL && POL.validatePolicyForProject){
      try{ arr(POL.validatePolicyForProject(p).issues).forEach(i => issues.push(normalizeIssue(i, {category:'policy'}))); }
      catch(e){ issues.push(mkIssue('NW-GATE-POLICY', 'warning', 'policy', 'No se pudo ejecutar la validación de políticas: ' + (e && e.message ? e.message : e))); }
    }

    const BC = broadcast();
    if(BC && BC.auditBroadcastDomains){
      try{ arr(BC.auditBroadcastDomains(p).issues).forEach(i => issues.push(normalizeIssue(i, {category:'broadcast'}))); }
      catch(e){ issues.push(mkIssue('NW-GATE-BCAST', 'warning', 'broadcast', 'No se pudo ejecutar la auditoría broadcast: ' + (e && e.message ? e.message : e))); }
    }

    const CAB = cabling();
    if(CAB && CAB.validateCabling){
      try{ pushLegacy(issues, CAB.validateCabling(p), {code:'NW-CABLE-000', category:'cabling'}); }
      catch(e){ issues.push(mkIssue('NW-GATE-CABLING', 'warning', 'cabling', 'No se pudo ejecutar la auditoría de cableado: ' + (e && e.message ? e.message : e))); }
    }

    const POE = poe();
    if(POE && POE.validatePoe){
      try{ pushLegacy(issues, POE.validatePoe(p), {code:'NW-POE-000', category:'poe'}); }
      catch(e){ issues.push(mkIssue('NW-GATE-POE', 'warning', 'poe', 'No se pudo ejecutar la auditoría PoE: ' + (e && e.message ? e.message : e))); }
    }

    const VH = vendorHardening();
    if(VH && VH.validateAllExports){
      try{ arr(VH.validateAllExports(p, {productionMode:!!opts.productionMode}).issues).forEach(i => issues.push(normalizeIssue(i, {category:'vendor-export'}))); }
      catch(e){ issues.push(mkIssue('NW-GATE-VENDOR', 'warning', 'vendor-export', 'No se pudo ejecutar el hardening de exportación vendor: ' + (e && e.message ? e.message : e))); }
    }

    missingGatewayForProduction(p).forEach(msg => issues.push(mkIssue('NW-L3-020', opts.productionMode ? 'error' : 'warning', 'routing', msg)));
    if(opts.productionMode && hasGeneratedUnreviewedPolicy(p)) issues.push(mkIssue('NW-POL-020', 'warning', 'policy', 'Hay reglas firewall generadas automáticamente sin marca de revisión. Revísalas antes de producción.'));

    return dedupeIssues(issues).filter(i => i.code !== 'NW-OK-001' && i.code !== 'NW-BCAST-OK' && i.code !== 'NW-L2-OK');
  }

  function applyStrictProductionEscalation(issues, options){
    const opts = Object.assign({}, DEFAULTS, obj(options));
    const NWA = auditCore();
    let list = arr(issues).map(normalizeIssue);
    if(opts.productionMode && NWA && NWA.applyProductionPolicy) list = NWA.applyProductionPolicy(list);
    if(!opts.productionMode || !opts.strict) return list;
    return list.map(raw => {
      const i = normalizeIssue(raw);
      const elevate = i.severity === 'warning' && /^(NW-L1-|NW-L2-|NW-L3-010|NW-L3-011|NW-L3-012|NW-L3-013|NW-L3-020|NW-IP-|NW-DHCP-|NW-POE-|NW-CABLE-|NW-POL-001|NW-POL-002|NW-SCHEMA-|NW-CISCO-|NW-FW-|NW-JUNOS-)/.test(i.code);
      if(elevate){
        return mkIssue(i.code, 'error', i.category, 'Producción: ' + i.message, {source:i.source || 'production-gate'});
      }
      return i;
    });
  }

  function summarizeCounts(issues){
    const list = arr(issues).map(normalizeIssue);
    const counts = {errors:0, warnings:0, info:0, blocking:0, byCategory:{}};
    for(const i of list){
      if(i.severity === 'error') counts.errors += 1;
      else if(i.severity === 'info') counts.info += 1;
      else counts.warnings += 1;
      if(i.blocking || i.severity === 'error') counts.blocking += 1;
      const cat = i.category || 'general';
      counts.byCategory[cat] = counts.byCategory[cat] || {errors:0, warnings:0, info:0};
      if(i.severity === 'error') counts.byCategory[cat].errors += 1;
      else if(i.severity === 'info') counts.byCategory[cat].info += 1;
      else counts.byCategory[cat].warnings += 1;
    }
    return counts;
  }

  function runProductionGate(project, options){
    const opts = Object.assign({}, DEFAULTS, obj(options));
    const initial = collectModuleIssues(clone(project || {}), opts);
    const issues = applyStrictProductionEscalation(initial, opts);
    const counts = summarizeCounts(issues);
    const blocking = issues.filter(i => i.severity === 'error' || i.blocking);
    const status = blocking.length ? 'blocked' : (counts.warnings > 0 ? 'review' : 'ready');
    const ready = status === 'ready';
    const canExport = !blocking.length;
    return {ok:canExport, ready, canExport, status, productionMode:!!opts.productionMode, strict:!!opts.strict, issues, counts, generatedAt:new Date().toISOString()};
  }

  function summarizeGate(report, options){
    const r = report || {};
    const opts = options || {};
    const counts = r.counts || summarizeCounts(r.issues || []);
    const icon = r.status === 'ready' ? '✅' : r.status === 'review' ? '⚠️' : '⛔';
    const lines = [];
    lines.push(`${icon} Puerta de producción: ${r.status === 'ready' ? 'LISTO' : r.status === 'review' ? 'REQUIERE REVISIÓN' : 'BLOQUEADO'}`);
    lines.push(`Modo: ${r.productionMode ? 'producción' : 'demo'}${r.strict ? ' · estricto' : ''}`);
    lines.push(`Errores: ${counts.errors || 0} · Avisos: ${counts.warnings || 0} · Info: ${counts.info || 0}`);
    const cats = Object.keys(counts.byCategory || {}).sort();
    if(cats.length){
      lines.push(''); lines.push('Resumen por categoría:');
      cats.forEach(cat => {
        const c = counts.byCategory[cat];
        lines.push(`• ${cat}: ${c.errors || 0} errores · ${c.warnings || 0} avisos · ${c.info || 0} info`);
      });
    }
    const relevant = arr(r.issues).filter(i => opts.includeInfo || i.severity !== 'info');
    if(relevant.length){
      lines.push(''); lines.push('Incidencias principales:');
      relevant.slice(0, opts.limit || 80).forEach(i => lines.push(`• [${i.severity.toUpperCase()}] [${i.code}] ${i.message}`));
      if(relevant.length > (opts.limit || 80)) lines.push(`• ... ${relevant.length - (opts.limit || 80)} incidencias más`);
    }
    if(r.status === 'ready'){
      lines.push(''); lines.push('Resultado: no hay bloqueos detectados con los datos actuales. Aun así, revisa el despliegue real y prueba en laboratorio antes de producción.');
    }else if(r.status === 'review'){
      lines.push(''); lines.push('Resultado: se puede continuar en modo demo, pero conviene resolver los avisos antes de declarar producción.');
    }else{
      lines.push(''); lines.push('Resultado: no exportes ni apliques configuraciones en producción hasta corregir los errores bloqueantes.');
    }
    return lines.join('\n');
  }

  function bindBrowserUi(attempt){
    if(!root.document) return;
    const doc = root.document; const $ = id => doc.getElementById(id);
    if(!$('pg-dash') || !root.NetWizardState){
      if((attempt || 0) < 40 && root.setTimeout) root.setTimeout(() => bindBrowserUi((attempt || 0) + 1), 150);
      return;
    }
    if($('productionGateCard')) return;
    const card = doc.createElement('div');
    card.className = 'card';
    card.id = 'productionGateCard';
    const staticHtml = '<div class="card-h"><div class="card-t" data-i18n="pg.card.title">🚦 Puerta de producción</div><span class="b bac" data-i18n="pg.card.badge">v3.48 i18n</span></div>'+
      '<div class="co co-ac" data-i18n="pg.card.desc">Validación final agregada antes de exportar o aplicar cambios. Incluye guía de corrección priorizada y checklist exportable.</div>'+
      '<label class="chk"><input type="checkbox" id="pgateStrict" checked> <span data-i18n="pg.strict">Perfil estricto de producción</span></label>'+
      '<label class="chk"><input type="checkbox" id="pgateShowGuide" checked> <span data-i18n="pg.showGuide">Mostrar guía de corrección</span></label>'+
      '<div class="brow"><button class="btn bs" id="btnProductionGate" data-i18n="pg.run">Ejecutar puerta</button><button class="btn bp" id="btnProductionGateGuide" data-i18n="pg.guide">Guía de corrección</button><button class="btn" id="btnProductionGateChecklist" data-i18n="pg.downloadChecklist">Descargar checklist</button><button class="btn bp" id="btnProductionGateToCfg" data-i18n="pg.goExport">Ir a exportación</button></div>'+
      '<pre class="cfg" id="productionGateOut" style="min-height:160px;white-space:pre-wrap;"></pre>';
    card.appendChild(doc.createRange().createContextualFragment(staticHtml));
    if(root.NetWizardI18n && root.NetWizardI18n.applyI18n) root.NetWizardI18n.applyI18n(card);
    $('pg-dash').appendChild(card);
    let lastReport = null;
    function run(){
      const prod = root.NetWizardAudit && root.NetWizardAudit.isProduction ? root.NetWizardAudit.isProduction() : false;
      const report = runProductionGate(root.NetWizardState.getSnapshot(), {productionMode:prod, strict:!!$('pgateStrict')?.checked});
      lastReport = report;
      $('productionGateOut').textContent = summarizeGate(report, {limit:80, remediationPreview:$('pgateShowGuide')?.checked ? 6 : 0});
      return report;
    }
    function ensureReport(){ return lastReport || run(); }
    function downloadText(filename, text, type){
      const blob = new Blob([text], {type:type || 'text/plain;charset=utf-8'});
      const url = URL.createObjectURL(blob);
      const a = doc.createElement('a'); a.href = url; a.download = filename; doc.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);
    }
    $('btnProductionGate').onclick = run;
    $('btnProductionGateGuide').onclick = () => { $('productionGateOut').textContent = summarizeRemediationGuide(ensureReport(), {limit:60}); };
    $('btnProductionGateChecklist').onclick = () => { downloadText('netwizard-production-checklist.md', exportChecklistMarkdown(ensureReport(), {locale:localeForReport()}), 'text/markdown;charset=utf-8'); };
    $('btnProductionGateToCfg').onclick = () => { if(root.navTo) root.navTo('cfg'); };
    try{ run(); }catch(_e){}
    doc.addEventListener('nw:project:changed', () => { try{ run(); }catch(_e){} });
    root.addEventListener && root.addEventListener('nw:mode:changed', () => { try{ run(); }catch(_e){} });
  }

  const api = {version:'netwizard-production-gate-v3.48', runProductionGate, summarizeGate, summarizeCounts, collectModuleIssues, applyStrictProductionEscalation, remediationForIssue, buildRemediationGuide, summarizeRemediationGuide, exportChecklistMarkdown};
  root.NetWizardProductionGate = api;
  if(typeof module !== 'undefined' && module.exports) module.exports = api;
  if(root.document){
    if(root.document.readyState === 'loading') root.document.addEventListener('DOMContentLoaded', () => bindBrowserUi(0));
    else bindBrowserUi(0);
  }
})(typeof window !== 'undefined' ? window : globalThis);
