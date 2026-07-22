/* =========================================================
   NetWizard Production Gate Architecture Extension v3.49-dev
   Integra diagnósticos arquitectónicos en la puerta de producción.
   Cargable en navegador clásico y en Node.js.
========================================================= */
(function initNetWizardProductionGateArchitecture(root){
  'use strict';

  function arr(v){ return Array.isArray(v) ? v : []; }
  function tryRequire(p){ try { return require(p); } catch { return null; } }
  function baseGate(){ return root.NetWizardProductionGate || (typeof require === 'function' ? tryRequire('./netwizard-production-gate.js') : null); }
  function validator(){ return root.NetWizardArchitectureValidator || (typeof require === 'function' ? tryRequire('./netwizard-architecture-validator.js') : null); }

  function mergeIssues(baseIssues, architectureIssues){
    const seen = new Set();
    const out = [];
    for(const issue of arr(baseIssues).concat(arr(architectureIssues))){
      const key = [issue && issue.code, issue && issue.severity, issue && issue.category, issue && issue.message].join('\u0001');
      if(seen.has(key)) continue;
      seen.add(key);
      out.push(issue);
    }
    return out;
  }

  function enhanceReport(project, options, baseReport){
    const gate = baseGate();
    const architecture = validator();
    const report = baseReport || (gate && gate.runProductionGate ? gate.runProductionGate(project, options || {}) : {issues:[]});
    if(!architecture || typeof architecture.validate !== 'function') return report;

    const architectureReport = architecture.validate(project || {});
    const issues = mergeIssues(report.issues, architectureReport.issues);
    const counts = gate && gate.summarizeCounts ? gate.summarizeCounts(issues) : {
      errors:issues.filter(i => i && i.severity === 'error').length,
      warnings:issues.filter(i => i && i.severity === 'warning').length,
      info:issues.filter(i => i && i.severity === 'info').length,
      blocking:issues.filter(i => i && (i.blocking || i.severity === 'error')).length,
      byCategory:{}
    };
    const blocking = issues.filter(i => i && (i.blocking || i.severity === 'error'));
    const status = blocking.length ? 'blocked' : (counts.warnings > 0 ? 'review' : 'ready');
    return Object.assign({}, report, {
      ok:blocking.length === 0,
      ready:status === 'ready',
      canExport:blocking.length === 0,
      status,
      issues,
      counts,
      architecture:architectureReport
    });
  }

  function install(){
    const gate = baseGate();
    if(!gate || gate.__architectureExtensionInstalled) return gate;
    const originalRun = gate.runProductionGate.bind(gate);
    gate.runProductionGate = function(project, options){
      return enhanceReport(project, options, originalRun(project, options));
    };
    gate.__architectureExtensionInstalled = true;
    gate.enhanceArchitectureReport = enhanceReport;
    root.NetWizardProductionGate = gate;
    return gate;
  }

  function bindBrowserUi(attempt){
    if(!root.document) return;
    const gate = install();
    const state = root.NetWizardState;
    const button = root.document.getElementById('btnProductionGate');
    const output = root.document.getElementById('productionGateOut');
    if(!gate || !state || !button || !output){
      if((attempt || 0) < 50 && root.setTimeout) root.setTimeout(() => bindBrowserUi((attempt || 0) + 1), 120);
      return;
    }

    function runEnhanced(){
      const productionMode = root.NetWizardAudit && root.NetWizardAudit.isProduction ? root.NetWizardAudit.isProduction() : false;
      const strict = !!root.document.getElementById('pgateStrict')?.checked;
      const report = gate.runProductionGate(state.getSnapshot(), {productionMode, strict});
      output.textContent = gate.summarizeGate(report, {limit:80, remediationPreview:root.document.getElementById('pgateShowGuide')?.checked ? 6 : 0});
      root.NetWizardLastProductionGateReport = report;
      return report;
    }

    button.onclick = runEnhanced;
    root.document.addEventListener('nw:project:changed', () => { try{ runEnhanced(); }catch(_e){} });
    root.addEventListener && root.addEventListener('nw:mode:changed', () => { try{ runEnhanced(); }catch(_e){} });
    try{ runEnhanced(); }catch(_e){}
  }

  const api = {version:'netwizard-production-gate-architecture-v1', install, enhanceReport, mergeIssues};
  root.NetWizardProductionGateArchitecture = api;
  if(typeof module !== 'undefined' && module.exports){
    install();
    module.exports = api;
  }
  if(root.document){
    if(root.document.readyState === 'loading') root.document.addEventListener('DOMContentLoaded', () => bindBrowserUi(0));
    else bindBrowserUi(0);
  }
})(typeof window !== 'undefined' ? window : globalThis);
