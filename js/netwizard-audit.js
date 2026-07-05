/* =========================================================
   NetWizard Audit Core v3.9
   Severidades, códigos de auditoría y modo demo/producción.
   Cargable en navegador clásico y en Node.js para tests.
========================================================= */
(function initNetWizardAudit(root){
  'use strict';

  const STORAGE_KEY = 'nwp_run_mode_v1';
  const MODES = { DEMO:'demo', PRODUCTION:'production' };
  const SEVERITY = { INFO:'info', WARNING:'warning', ERROR:'error' };

  function cleanStr(v){ return String(v==null?'':v).trim(); }
  function isBrowser(){ return !!(root && root.document); }
  function nowIso(){ try{return new Date().toISOString();}catch(_e){return '';} }

  function normalizeSeverity(sev){
    const s = cleanStr(sev).toLowerCase();
    return s===SEVERITY.ERROR || s==='err' ? SEVERITY.ERROR : s===SEVERITY.INFO ? SEVERITY.INFO : SEVERITY.WARNING;
  }

  function createIssue(input){
    const i = input || {};
    const severity = normalizeSeverity(i.severity || SEVERITY.WARNING);
    return {
      code: cleanStr(i.code || 'NW-GEN-000'),
      severity,
      category: cleanStr(i.category || 'general'),
      message: cleanStr(i.message || i.msg || ''),
      blocking: i.blocking === true || severity === SEVERITY.ERROR,
      source: cleanStr(i.source || ''),
      createdAt: i.createdAt || nowIso()
    };
  }

  function normalizeIssue(issue, fallback){
    if(typeof issue === 'string') return createIssue(Object.assign({}, fallback || {}, {message:issue}));
    return createIssue(Object.assign({}, fallback || {}, issue || {}));
  }

  function fromLegacyArrays(report, defaults){
    const r = report || {};
    const d = defaults || {};
    const issues = [];
    (Array.isArray(r.errors)?r.errors:[]).forEach(msg=>issues.push(normalizeIssue(msg, Object.assign({}, d, {severity:SEVERITY.ERROR}))));
    (Array.isArray(r.warnings)?r.warnings:[]).forEach(msg=>issues.push(normalizeIssue(msg, Object.assign({}, d, {severity:SEVERITY.WARNING}))));
    (Array.isArray(r.info)?r.info:[]).forEach(msg=>issues.push(normalizeIssue(msg, Object.assign({}, d, {severity:SEVERITY.INFO}))));
    return issues;
  }

  function splitIssues(issues){
    const out = { ok:true, errors:[], warnings:[], info:[], issues:Array.isArray(issues)?issues.map(normalizeIssue):[] };
    for(const i of out.issues){
      const line = `[${i.code}] ${i.message}`;
      if(i.severity===SEVERITY.ERROR){ out.errors.push(line); out.ok = false; }
      else if(i.severity===SEVERITY.INFO) out.info.push(line);
      else out.warnings.push(line);
    }
    return out;
  }

  function applyProductionPolicy(issues){
    return (Array.isArray(issues)?issues:[]).map(raw=>{
      const i = normalizeIssue(raw);
      const criticalWarning = i.severity === SEVERITY.WARNING && /^(NW-VLAN-001|NW-L3-001|NW-IP-004|NW-DHCP-001)$/.test(i.code);
      if(criticalWarning){
        return createIssue(Object.assign({}, i, {
          severity: SEVERITY.ERROR,
          blocking: true,
          message: 'Producción: ' + i.message
        }));
      }
      return i;
    });
  }

  function summarizeIssues(issues, options){
    const opts = options || {};
    const list = Array.isArray(issues) ? issues.map(normalizeIssue) : fromLegacyArrays(issues || {}, opts.defaults || {});
    const errors = list.filter(i=>i.severity===SEVERITY.ERROR);
    const warnings = list.filter(i=>i.severity===SEVERITY.WARNING);
    const info = list.filter(i=>i.severity===SEVERITY.INFO);
    const lines = [];
    if(opts.title) lines.push(opts.title);
    if(errors.length) lines.push('ERRORES:\n' + errors.map(i=>`• [${i.code}] ${i.message}`).join('\n'));
    if(warnings.length) lines.push('AVISOS:\n' + warnings.map(i=>`• [${i.code}] ${i.message}`).join('\n'));
    if(info.length) lines.push('INFO:\n' + info.map(i=>`• [${i.code}] ${i.message}`).join('\n'));
    return lines.join('\n\n') || (opts.empty || 'Sin incidencias.');
  }

  function hasBlockingIssues(issues){ return (Array.isArray(issues)?issues:[]).some(i=>normalizeIssue(i).blocking); }

  function getMode(){
    try{
      const raw = root.localStorage && root.localStorage.getItem(STORAGE_KEY);
      return raw === MODES.PRODUCTION ? MODES.PRODUCTION : MODES.DEMO;
    }catch(_e){ return MODES.DEMO; }
  }
  function setMode(mode){
    const next = mode === MODES.PRODUCTION ? MODES.PRODUCTION : MODES.DEMO;
    try{ if(root.localStorage) root.localStorage.setItem(STORAGE_KEY, next); }catch(_e){}
    try{ if(root.dispatchEvent && root.CustomEvent) root.dispatchEvent(new root.CustomEvent('nw:mode:changed', {detail:{mode:next}})); }catch(_e){}
    return next;
  }
  function isProduction(){ return getMode() === MODES.PRODUCTION; }

  function bindBrowserUi(){
    if(!isBrowser()) return;
    const doc = root.document;
    const $ = id => doc.getElementById(id);
    function ensureModeCard(){
      const pg = $('pg-dash');
      if(!pg || $('nwRunMode')) return;
      const target = pg.querySelector('.g2 > div:last-child') || pg;
      const card = doc.createElement('div');
      card.className = 'card';
      const title = doc.createElement('div'); title.className = 'card-t'; title.textContent = '🛡️ Modo de ejecución'; card.appendChild(title);
      const copy = doc.createElement('div'); copy.className = 'co co-ac'; copy.textContent = 'Demo permite diseños incompletos. Producción bloquea exportaciones y acciones si hay errores críticos.'; card.appendChild(copy);
      const selMode = doc.createElement('select'); selMode.id = 'nwRunMode';
      [['demo','Demo / formación'], ['production','Producción']].forEach(([value,label]) => { const opt = doc.createElement('option'); opt.value = value; opt.textContent = label; selMode.appendChild(opt); });
      card.appendChild(selMode);
      const hintBox = doc.createElement('div'); hintBox.className = 'hint'; hintBox.id = 'nwRunModeHint'; hintBox.style.marginTop = '8px'; card.appendChild(hintBox);
      target.appendChild(card);
      const sel = $('nwRunMode');
      sel.value = getMode();
      sel.onchange = () => { setMode(sel.value); paintHint(); };
      paintHint();
    }
    function paintHint(){
      const hint = $('nwRunModeHint');
      if(!hint) return;
      hint.textContent = isProduction()
        ? 'Modo producción activo: las validaciones críticas pueden bloquear exportación/aplicación.'
        : 'Modo demo activo: útil para diseñar y aprender aunque falten datos.';
    }
    function boot(){ ensureModeCard(); }
    if(doc.readyState==='loading') doc.addEventListener('DOMContentLoaded', boot); else boot();
    doc.addEventListener('nw:project:changed', ()=>setTimeout(boot, 0));
    root.addEventListener && root.addEventListener('nw:mode:changed', ()=>{
      if($('nwRunMode')) $('nwRunMode').value = getMode();
      paintHint();
    });
  }

  const api = {version:'netwizard-audit-v1', MODES, SEVERITY, createIssue, normalizeIssue, fromLegacyArrays, splitIssues, applyProductionPolicy, summarizeIssues, hasBlockingIssues, getMode, setMode, isProduction};
  root.NetWizardAudit = api;
  if(typeof module!=='undefined' && module.exports) module.exports = api;
  bindBrowserUi();
})(typeof window!=='undefined'?window:globalThis);
