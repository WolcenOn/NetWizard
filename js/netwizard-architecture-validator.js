/* =========================================================
   NetWizard Architecture Validator v3.49-dev
   Reglas de coherencia arquitectónica independientes del vendor.
   Cargable en navegador clásico y en Node.js.
========================================================= */
(function initNetWizardArchitectureValidator(root){
  'use strict';

  function arr(v){ return Array.isArray(v) ? v : []; }
  function clean(v){ return String(v == null ? '' : v).trim(); }
  function tryRequire(p){ try { return require(p); } catch { return null; } }
  function auditCore(){ return root.NetWizardAudit || (typeof require === 'function' ? tryRequire('./netwizard-audit.js') : null); }

  function makeIssue(input){
    const audit = auditCore();
    const base = Object.assign({
      code:'NW-ARCH-000',
      severity:'warning',
      blocking:false,
      category:'architecture',
      source:'architecture-validator'
    }, input || {});
    if(audit && typeof audit.createIssue === 'function') return audit.createIssue(base);
    return base;
  }

  function endpointLabel(port, devicesById){
    const device = devicesById.get(port && port.deviceId);
    const deviceName = clean(device && device.name) || clean(port && port.deviceId) || 'dispositivo desconocido';
    const portName = clean(port && port.name) || clean(port && port.id) || 'puerto desconocido';
    return `${deviceName} / ${portName}`;
  }

  function normalizedMode(port){
    const mode = clean(port && (port.mode || port.role)).toLowerCase();
    if(mode === 'l3') return 'routed';
    return mode;
  }

  function validateLinkCompatibility(project){
    const p = project || {};
    const portsById = new Map(arr(p.ports).map(port => [port.id, port]));
    const devicesById = new Map(arr(p.devices).map(device => [device.id, device]));
    const issues = [];

    for(const link of arr(p.links)){
      const aId = link.aPortId || link.a;
      const bId = link.bPortId || link.b;
      const a = portsById.get(aId);
      const b = portsById.get(bId);
      if(!a || !b) continue;

      const aMode = normalizedMode(a);
      const bMode = normalizedMode(b);
      const mixedTrunkRouted = (aMode === 'trunk' && bMode === 'routed') || (aMode === 'routed' && bMode === 'trunk');
      if(!mixedTrunkRouted) continue;

      const aLabel = endpointLabel(a, devicesById);
      const bLabel = endpointLabel(b, devicesById);
      issues.push(makeIssue({
        code:'NW-LINK-001',
        severity:'error',
        blocking:true,
        category:'layer2-layer3',
        title:'Extremos de enlace incompatibles',
        message:`El enlace ${clean(link.id) || '(sin id)'} conecta ${aLabel} (${aMode}) con ${bLabel} (${bMode}).`,
        why:'Un puerto trunk transporta tramas Ethernet etiquetadas 802.1Q, mientras que un puerto routed espera una interfaz de capa 3. Ambos extremos deben compartir el mismo modelo de enlace.',
        impact:'El enlace no puede proporcionar conectividad coherente y las VLAN o la red de tránsito pueden quedar inoperativas.',
        affectedObjects:[clean(link.id), clean(a.id), clean(b.id)].filter(Boolean),
        suggestions:[
          {
            label:'Convertir el enlace en tránsito L3',
            steps:[
              `Configura ${aLabel} y ${bLabel} como routed.`,
              'Asigna a ambos extremos direcciones de la misma red /30 o /31.',
              'Añade las rutas necesarias hacia las redes remotas.'
            ]
          },
          {
            label:'Usar trunk con subinterfaces',
            steps:[
              `Mantén ${aLabel} y ${bLabel} como trunk.`,
              'Elimina la dirección IP directa de la interfaz física.',
              'Crea subinterfaces 802.1Q o interfaces VLAN compatibles en el equipo que realizará routing.'
            ]
          }
        ]
      }));
    }

    return {
      ok: !issues.some(issue => issue.blocking || issue.severity === 'error'),
      issues,
      errors: issues.filter(issue => issue.severity === 'error').map(issue => `[${issue.code}] ${issue.message}`),
      warnings: issues.filter(issue => issue.severity === 'warning').map(issue => `[${issue.code}] ${issue.message}`)
    };
  }

  function validate(project){
    const linkReport = validateLinkCompatibility(project);
    return {
      ok: linkReport.ok,
      issues: linkReport.issues,
      errors: linkReport.errors,
      warnings: linkReport.warnings
    };
  }

  const api = {
    version:'netwizard-architecture-validator-v1',
    validate,
    validateLinkCompatibility
  };

  root.NetWizardArchitectureValidator = api;
  if(typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
