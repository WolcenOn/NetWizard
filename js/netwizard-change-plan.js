/* =========================================================
   NetWizard Change Plan v3.22
   Plan común y prudente para previsualizar/aplicar VLSM, DHCP,
   IPs L3 de tránsito y políticas desde intención.
   Cargable tanto en navegador clásico como en Node.js.
========================================================= */

/*
Mantenimiento:
- buildPlan() debe ser una simulación: no modificar nunca el proyecto original.
- applyPlan() es el único punto que escribe cambios del plan común; mantener snapshot
  previo desde UI antes de llamarlo.
- Cada automatismo nuevo debe aportar diff propio antes de integrarse aquí.
*/
(function initNetWizardChangePlan(root){
  'use strict';

  function clone(v){ return JSON.parse(JSON.stringify(v == null ? null : v)); }
  function arr(v){ return Array.isArray(v) ? v : []; }
  function obj(v){ return v && typeof v === 'object' && !Array.isArray(v) ? v : {}; }
  function tryRequire(p){ try { return require(p); } catch { return null; } }
  function planner(){ return root.NetWizardPlanner || (typeof require === 'function' ? tryRequire('./netwizard-vlsm-physical-planner.js') : null); }
  function dhcp(){ return root.NetWizardDhcpUtils || (typeof require === 'function' ? tryRequire('./netwizard-dhcp-utils.js') : null); }
  function policy(){ return root.NetWizardPolicyUtils || (typeof require === 'function' ? tryRequire('./netwizard-policy-utils.js') : null); }
  function preview(){ return root.NetWizardChangePreview || (typeof require === 'function' ? tryRequire('./netwizard-change-preview.js') : null); }
  function auditCore(){ return root.NetWizardAudit || (typeof require === 'function' ? tryRequire('./netwizard-audit.js') : null); }

  const DEFAULTS = {
    includeVlsm:true,
    includeDhcp:true,
    includeTransitIps:true,
    includePolicies:false,
    baseCidr:'10.10.0.0/16',
    margin:5,
    gatewayMode:'first',
    assignMode:'static_only',
    overwriteDhcp:false,
    overwriteTransitIps:false,
    replaceExistingGenerated:true,
    productionBlock:true
  };

  function normalizeOptions(options){ return Object.assign({}, DEFAULTS, obj(options)); }
  function diffCount(diff){ return arr(diff && diff.add).length + arr(diff && diff.change).length + arr(diff && diff.remove).length; }
  function hasDiff(diff){ return diffCount(diff) > 0; }
  function emptyDiff(kind){ return {kind, add:[], change:[], remove:[], keep:[], warnings:['Módulo no disponible o acción no seleccionada.']}; }

  function buildPlan(project, options){
    const opts = normalizeOptions(options);
    const original = clone(project || {});
    let simulated = clone(project || {});
    const steps = [];
    const warnings = [];
    const errors = [];

    const pl = planner();
    const dh = dhcp();
    const pol = policy();
    const cp = preview();
    const nwa = auditCore();

    function addStep(id, title, diff, extra){
      steps.push(Object.assign({id, title, diff: diff || {kind:id, add:[], change:[], remove:[], keep:[], warnings:[]}, changes: diffCount(diff)}, extra || {}));
      for(const w of arr(diff && diff.warnings)) warnings.push(`${title}: ${w}`);
    }

    if(opts.includeVlsm){
      if(!pl || !pl.inferVlanNeeds || !pl.buildVlsmPlan || !pl.applyVlsmPlan){
        const d = emptyDiff('vlsm'); addStep('vlsm', 'VLSM', d);
      } else {
        const needs = pl.inferVlanNeeds(simulated, {minPerVlan:2});
        const plan = pl.buildVlsmPlan(String(opts.baseCidr || '').trim(), needs, {margin:opts.margin, gatewayMode:opts.gatewayMode});
        if(!plan || !plan.ok){
          const d = {kind:'vlsm', add:[], change:[], remove:[], keep:[], warnings:[(plan && plan.msg) || 'No se pudo calcular el plan VLSM.']};
          addStep('vlsm', 'VLSM', d, {plan});
          errors.push((plan && plan.msg) || 'Plan VLSM inválido.');
        } else {
          const d = cp && cp.computeVlsmDiff ? cp.computeVlsmDiff(simulated, plan, {assignMode:opts.assignMode}) : emptyDiff('vlsm');
          addStep('vlsm', 'VLSM', d, {plan});
          simulated = pl.applyVlsmPlan(simulated, plan, {assignMode:opts.assignMode});
        }
      }
    }

    if(opts.includeDhcp){
      if(!dh || !dh.proposeDhcpForProject){
        addStep('dhcp', 'DHCP', emptyDiff('dhcp'));
      } else {
        const d = cp && cp.computeDhcpDiff ? cp.computeDhcpDiff(simulated, {overwrite:!!opts.overwriteDhcp}) : emptyDiff('dhcp');
        const res = dh.proposeDhcpForProject(simulated, {overwrite:!!opts.overwriteDhcp});
        addStep('dhcp', 'DHCP', d, {messages:arr(res && res.changes)});
        simulated = res.project || simulated;
      }
    }

    if(opts.includeTransitIps){
      if(!pl || !pl.assignTransitInterfaceIps){
        addStep('transitIps', 'IPs L3 de tránsito', emptyDiff('transit-ip'));
      } else {
        const d = cp && cp.computeTransitIpDiff ? cp.computeTransitIpDiff(simulated, {overwrite:!!opts.overwriteTransitIps}) : emptyDiff('transit-ip');
        const res = pl.assignTransitInterfaceIps(simulated, {overwrite:!!opts.overwriteTransitIps});
        addStep('transitIps', 'IPs L3 de tránsito', d, {assigned:arr(res && res.assigned)});
        simulated = res.project || simulated;
      }
    }

    if(opts.includePolicies){
      if(!pol || !pol.computePolicyApplyDiff || !pol.applyGeneratedRules){
        addStep('policies', 'Políticas firewall/ACL', emptyDiff('policy'));
      } else {
        const d = pol.computePolicyApplyDiff(simulated, {replaceExistingGenerated:!!opts.replaceExistingGenerated});
        const res = pol.applyGeneratedRules(simulated, {replaceExistingGenerated:!!opts.replaceExistingGenerated});
        addStep('policies', 'Políticas firewall/ACL', d, {added:res.added});
        simulated = res.project || simulated;
      }
    }

    let readiness = null;
    let productionBlocked = false;
    try{
      if(pl && pl.readinessAudit){
        const prod = nwa && nwa.isProduction ? nwa.isProduction() : false;
        readiness = pl.readinessAudit(simulated, {productionMode:prod});
        productionBlocked = !!(opts.productionBlock && prod && readiness && readiness.issues && readiness.issues.some(i=>i && (i.blocking || i.severity === 'error')));
      }
    }catch(e){ warnings.push('No se pudo ejecutar la auditoría final: '+(e && e.message ? e.message : e)); }

    const totalChanges = steps.reduce((n,s)=>n+(s.changes||0),0);
    return {ok:errors.length===0, options:opts, original, project:simulated, steps, warnings, errors, readiness, productionBlocked, totalChanges};
  }

  function summarizePlan(plan){
    const cp = preview();
    const lines = [];
    lines.push('Plan común de cambios');
    lines.push('');
    if(!plan){ lines.push('No hay plan.'); return lines.join('\n'); }
    if(plan.errors && plan.errors.length){ lines.push('Errores:'); plan.errors.forEach(e=>lines.push('✕ '+e)); lines.push(''); }
    if(plan.warnings && plan.warnings.length){ lines.push('Avisos:'); plan.warnings.slice(0,40).forEach(w=>lines.push('! '+w)); if(plan.warnings.length>40)lines.push(`! ... ${plan.warnings.length-40} avisos más`); lines.push(''); }
    for(const step of arr(plan.steps)){
      lines.push(`## ${step.title} · ${step.changes || 0} cambios`);
      if(cp && cp.summarizeDiff){
        const txt = cp.summarizeDiff(step.diff, step.title).split('\n').slice(2).join('\n').trim();
        lines.push(txt || 'No se aplicarían cambios.');
      } else {
        lines.push(`Cambios: ${step.changes || 0}`);
      }
      lines.push('');
    }
    lines.push(`Total de cambios aplicables: ${plan.totalChanges || 0}`);
    if(plan.readiness){
      const issues = arr(plan.readiness.issues);
      const errors = issues.filter(i=>i.severity==='error'||i.blocking).length;
      const warnings = issues.filter(i=>i.severity==='warning').length;
      lines.push(`Auditoría final estimada: ${errors} errores · ${warnings} avisos`);
      if(plan.productionBlocked) lines.push('Modo producción: quedan errores bloqueantes tras el plan. No se aplicará mientras esté activa la opción de bloqueo.');
    }
    return lines.join('\n');
  }

  function applyPlan(project, options){
    const plan = buildPlan(project, options);
    if(!plan.ok) return {ok:false, plan, project:clone(project||{}), message:arr(plan.errors).join('\n') || 'Plan inválido.'};
    if(plan.productionBlocked) return {ok:false, plan, project:clone(project||{}), message:'Modo producción: el plan dejaría errores bloqueantes. Revisa la auditoría antes de aplicar.'};
    return {ok:true, plan, project:plan.project, message:`Plan aplicado: ${plan.totalChanges || 0} cambios.`};
  }

  function bindBrowserUi(attempt){
    if(!root.document) return;
    const doc = root.document; const $ = id => doc.getElementById(id);
    if(!$('pg-dash') || !root.NetWizardState){
      if((attempt||0) < 30) root.setTimeout ? root.setTimeout(()=>bindBrowserUi((attempt||0)+1), 150) : null;
      return;
    }
    if($('changePlanCard')) return;
    const card = doc.createElement('div');
    card.className = 'card';
    card.id = 'changePlanCard';
    const staticHtml = '<div class="card-h"><div class="card-t">🧭 Plan común de cambios</div><button class="btn bs bsm" id="btnPlanPreview">Previsualizar</button></div>'+
      '<div class="co co-ac" style="margin-bottom:9px;">Reúne automatismos revisables: VLSM, DHCP, IPs L3 y políticas. No sustituye los botones específicos; sirve para aplicar un lote con snapshot previo.</div>'+
      '<div class="g2"><div>'+
      '<label class="chk"><input type="checkbox" id="planUseVlsm" checked> Incluir VLSM</label>'+
      '<label class="fl">Bloque base VLSM</label><input id="planBaseCidr" value="10.10.0.0/16">'+
      '<div class="row"><div><label class="fl">Reserva crecimiento</label><input id="planMargin" type="number" min="0" value="5"></div><div><label class="fl">Gateway</label><select id="planGatewayMode"><option value="first">Primera IP usable</option><option value="last">Última IP usable</option></select></div></div>'+
      '<label class="fl">IPs de hosts</label><select id="planAssignMode"><option value="static_only">Solo estáticos sin IP</option><option value="all_hosts">Todos los hosts de VLAN</option><option value="none">No tocar hosts</option></select>'+
      '</div><div>'+
      '<label class="chk"><input type="checkbox" id="planUseDhcp" checked> Incluir DHCP avanzado</label>'+
      '<label class="chk"><input type="checkbox" id="planOverwriteDhcp"> Sobrescribir pools DHCP existentes</label>'+
      '<label class="chk"><input type="checkbox" id="planUseTransit" checked> Incluir IPs L3 de tránsito</label>'+
      '<label class="chk"><input type="checkbox" id="planOverwriteTransit"> Sobrescribir IPs L3 existentes</label>'+
      '<label class="chk"><input type="checkbox" id="planUsePolicies"> Incluir políticas firewall/ACL desde intención</label>'+
      '<label class="chk"><input type="checkbox" id="planReplacePolicies" checked> Reemplazar reglas generadas obsoletas</label>'+
      '<label class="chk"><input type="checkbox" id="planProductionBlock" checked> En modo producción, bloquear si quedan errores</label>'+
      '</div></div>'+
      '<div class="brow"><button class="btn bs" id="btnPlanPreview2">🧾 Ver plan</button><button class="btn bp" id="btnPlanApply">✔ Aplicar plan revisado</button></div>'+
      '<pre class="cfg" id="changePlanOut" style="min-height:180px;white-space:pre-wrap;"></pre>';
    card.appendChild(doc.createRange().createContextualFragment(staticHtml));
    const dash = $('pg-dash');
    dash.appendChild(card);
    function optionsFromUi(){
      return {
        includeVlsm:!!$('planUseVlsm')?.checked,
        includeDhcp:!!$('planUseDhcp')?.checked,
        includeTransitIps:!!$('planUseTransit')?.checked,
        includePolicies:!!$('planUsePolicies')?.checked,
        baseCidr:($('planBaseCidr')?.value||'10.10.0.0/16').trim(),
        margin:parseInt($('planMargin')?.value,10)||0,
        gatewayMode:$('planGatewayMode')?.value||'first',
        assignMode:$('planAssignMode')?.value||'static_only',
        overwriteDhcp:!!$('planOverwriteDhcp')?.checked,
        overwriteTransitIps:!!$('planOverwriteTransit')?.checked,
        replaceExistingGenerated:!!$('planReplacePolicies')?.checked,
        productionBlock:!!$('planProductionBlock')?.checked
      };
    }
    function previewPlan(){
      const plan = buildPlan(root.NetWizardState.getSnapshot(), optionsFromUi());
      $('changePlanOut').textContent = summarizePlan(plan);
      return plan;
    }
    function applyUiPlan(){
      const current = root.NetWizardState.getSnapshot();
      const res = applyPlan(current, optionsFromUi());
      $('changePlanOut').textContent = summarizePlan(res.plan);
      if(!res.ok){ alert(res.message || 'No se pudo aplicar el plan.'); return; }
      if(!res.plan.totalChanges){ alert('No hay cambios que aplicar.'); return; }
      if(!confirm(summarizePlan(res.plan)+'\n\n¿Aplicar este plan de cambios?')) return;
      try{ if(root.NetWizardHistory && root.NetWizardHistory.createSnapshot) root.NetWizardHistory.createSnapshot('Antes de aplicar plan común', {source:'pre-change-plan', project:current, silent:true}); }catch(_e){}
      root.NetWizardState.replaceProject(res.project, {source:'change-plan'});
      if(root.refresh) try{ root.refresh(); }catch(_e){}
      const after = buildPlan(root.NetWizardState.getSnapshot(), optionsFromUi());
      $('changePlanOut').textContent = '✓ Plan aplicado. Snapshot creado: "Antes de aplicar plan común".\n\n' + summarizePlan(after);
    }
    $('btnPlanPreview').onclick = previewPlan;
    $('btnPlanPreview2').onclick = previewPlan;
    $('btnPlanApply').onclick = applyUiPlan;
  }

  const api = {version:'netwizard-change-plan-v3.22', normalizeOptions, buildPlan, summarizePlan, applyPlan, diffCount, hasDiff};
  root.NetWizardChangePlan = api;
  if(typeof module !== 'undefined' && module.exports) module.exports = api;
  if(root.document){
    if(root.document.readyState === 'loading') root.document.addEventListener('DOMContentLoaded', ()=>bindBrowserUi(0));
    else bindBrowserUi(0);
  }
})(typeof window !== 'undefined' ? window : globalThis);
