/* =========================================================
   NetWizard Audit Core v3.48
   Severidades, códigos de auditoría y modo demo/producción.
   Cargable en navegador clásico y en Node.js para tests.
========================================================= */
(function initNetWizardAudit(root){
  'use strict';

  const STORAGE_KEY = 'nwp_run_mode_v1';
  const MODES = { DEMO:'demo', PRODUCTION:'production' };
  const SEVERITY = { INFO:'info', WARNING:'warning', ERROR:'error' };

  function cleanStr(v){ return String(v==null?'':v).trim(); }
  function tr(key,params,locale,fallback){ const i18n=root.NetWizardI18n; if(i18n&&typeof i18n.t==='function') return i18n.t(key,params||{},locale); return String(fallback||key).replace(/\{([A-Za-z0-9_.-]+)\}/g,(_m,k)=>Object.prototype.hasOwnProperty.call(params||{},k)?String(params[k]):''); }
  function cleanList(v){ return Array.isArray(v) ? v.map(cleanStr).filter(Boolean) : []; }
  function cleanSuggestions(v){
    return (Array.isArray(v) ? v : []).map(item => ({
      label: cleanStr(item && item.label),
      steps: cleanList(item && item.steps)
    })).filter(item => item.label || item.steps.length);
  }
  function isBrowser(){ return !!(root && root.document); }
  function nowIso(){ try{return new Date().toISOString();}catch(_e){return '';} }

  function normalizeSeverity(sev){
    const s = cleanStr(sev).toLowerCase();
    return s===SEVERITY.ERROR || s==='err' ? SEVERITY.ERROR : s===SEVERITY.INFO ? SEVERITY.INFO : SEVERITY.WARNING;
  }

  function createIssue(input){
    const i = input || {};
    const severity = normalizeSeverity(i.severity || SEVERITY.WARNING);
    const out = {
      code: cleanStr(i.code || 'NW-GEN-000'),
      severity,
      category: cleanStr(i.category || 'general'),
      title: cleanStr(i.title || ''),
      message: cleanStr(i.message || i.msg || ''),
      why: cleanStr(i.why || ''),
      impact: cleanStr(i.impact || ''),
      blocking: i.blocking === true || severity === SEVERITY.ERROR,
      affectedObjects: cleanList(i.affectedObjects),
      suggestions: cleanSuggestions(i.suggestions),
      source: cleanStr(i.source || ''),
      createdAt: i.createdAt || nowIso()
    };
    const messageKey=cleanStr(i.messageKey || '');
    if(messageKey){
      out.messageKey=messageKey;
      out.messageParams=i.messageParams&&typeof i.messageParams==='object'&&!Array.isArray(i.messageParams)?Object.assign({},i.messageParams):{};
    }
    return out;
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
          message: tr('validation.audit.productionPrefix',{message:i.message},'es','Producción: {message}'),
          messageKey: 'validation.audit.productionPrefix',
          messageParams: {baseMessageKey:i.messageKey||'',baseMessageParams:i.messageParams||{},message:i.message}
        }));
      }
      return i;
    });
  }

  function localizeIssue(issue,locale){ const i=normalizeIssue(issue); if(i.messageKey){ const params=Object.assign({},i.messageParams||{}); if(i.messageKey==='validation.audit.productionPrefix'&&params.baseMessageKey) params.message=tr(params.baseMessageKey,params.baseMessageParams||{},locale,params.message||params.baseMessageKey); i.message=tr(i.messageKey,params,locale,i.message||i.messageKey); } return i; }

  function summarizeIssues(issues, options){
    const opts = options || {}, locale=opts.locale;
    const list = Array.isArray(issues) ? issues.map(x=>localizeIssue(x,locale)) : fromLegacyArrays(issues || {}, opts.defaults || {}).map(x=>localizeIssue(x,locale));
    const errors = list.filter(i=>i.severity===SEVERITY.ERROR);
    const warnings = list.filter(i=>i.severity===SEVERITY.WARNING);
    const info = list.filter(i=>i.severity===SEVERITY.INFO);
    const lines = [];
    if(opts.title) lines.push(opts.title);
    if(errors.length) lines.push(tr('validation.audit.errors',{},locale,'ERRORES:')+'\n' + errors.map(i=>`• [${i.code}] ${i.message}`).join('\n'));
    if(warnings.length) lines.push(tr('validation.audit.warnings',{},locale,'AVISOS:')+'\n' + warnings.map(i=>`• [${i.code}] ${i.message}`).join('\n'));
    if(info.length) lines.push(tr('validation.audit.info',{},locale,'INFO:')+'\n' + info.map(i=>`• [${i.code}] ${i.message}`).join('\n'));
    return lines.join('\n\n') || (opts.empty || tr('validation.audit.empty',{},locale,'Sin incidencias.'));
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
      const title = doc.createElement('div'); title.className = 'card-t'; title.dataset.i18n='validation.mode.title'; title.textContent = tr('validation.mode.title',{},null,'🛡️ Modo de ejecución'); card.appendChild(title);
      const copy = doc.createElement('div'); copy.className = 'co co-ac'; copy.dataset.i18n='validation.mode.help'; copy.textContent = tr('validation.mode.help',{},null,'Demo permite diseños incompletos. Producción bloquea exportaciones y acciones si hay errores críticos.'); card.appendChild(copy);
      const selMode = doc.createElement('select'); selMode.id = 'nwRunMode';
      [['demo','validation.mode.demo'], ['production','validation.mode.production']].forEach(([value,key]) => { const opt = doc.createElement('option'); opt.value = value; opt.dataset.i18n=key; opt.textContent = tr(key,{},null,value==='demo'?'Demo / formación':'Producción'); selMode.appendChild(opt); });
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
        ? tr('validation.mode.productionHint',{},null,'Modo producción activo: las validaciones críticas pueden bloquear exportación/aplicación.')
        : tr('validation.mode.demoHint',{},null,'Modo demo activo: útil para diseñar y aprender aunque falten datos.');
    }
    function boot(){ ensureModeCard(); }
    if(doc.readyState==='loading') doc.addEventListener('DOMContentLoaded', boot); else boot();
    doc.addEventListener('nw:project:changed', ()=>setTimeout(boot, 0));
    root.addEventListener && root.addEventListener('nw:mode:changed', ()=>{ if($('nwRunMode')) $('nwRunMode').value = getMode(); paintHint(); });
    root.addEventListener && root.addEventListener('netwizard:i18n', ()=>{ const card=$('nwRunMode')?.closest('.card'); if(card&&root.NetWizardI18n?.applyI18n) root.NetWizardI18n.applyI18n(card); paintHint(); });
  }

  const api = {version:'netwizard-audit-v2', MODES, SEVERITY, createIssue, normalizeIssue, localizeIssue, fromLegacyArrays, splitIssues, applyProductionPolicy, summarizeIssues, hasBlockingIssues, getMode, setMode, isProduction};
  root.NetWizardAudit = api;
  if(typeof module!=='undefined' && module.exports) module.exports = api;
  bindBrowserUi();
})(typeof window!=='undefined'?window:globalThis);
