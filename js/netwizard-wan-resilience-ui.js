/* NetWizard WAN Resilience UI v1 */
(function initNetWizardWanResilienceUi(root){
'use strict';
const arr=v=>Array.isArray(v)?v:[];
function tr(key,params,fallback){const i18n=root.NetWizardI18n;if(i18n&&typeof i18n.t==='function')return i18n.t(key,params||{});return String(fallback||key).replace(/\{([A-Za-z0-9_.-]+)\}/g,(_m,k)=>Object.prototype.hasOwnProperty.call(params||{},k)?String(params[k]):'');}
function text(tag,value,cls){const el=root.document.createElement(tag);if(cls)el.className=cls;el.textContent=String(value==null?'':value);return el;}
function renderInto(container,project){
  if(!container||!root.NetWizardWanResilience)return null;
  container.textContent='';
  const report=root.NetWizardWanResilience.analyzeProject(project||{});
  const head=root.document.createElement('div');head.className='card-h';
  head.append(text('div',tr('validation.wan.title',{},'🛡 Resiliencia WAN'),'card-t'),text('span',tr('validation.common.derived',{},'Derived'),'b bac'));container.appendChild(head);
  container.appendChild(text('div',tr('validation.wan.hint',{},'Simula automáticamente pérdida de circuito, proveedor, router y VPN sobre una copia degradada del proyecto. Reachability decide qué tráfico realmente sobrevive.'),'hint'));
  const summary=text('div',
    tr('validation.wan.summary',{design:report.validation.ok?tr('validation.wan.valid',{},'válido'):tr('validation.wan.review',{},'revisar'),scenarios:report.scenarios.length,spof:report.singlePoints.length},'Diseño: {design} · escenarios: {scenarios} · SPOF detectados: {spof}'),
    report.validation.ok&&!report.singlePoints.length?'co co-gn':'co co-rd');
  summary.style.marginTop='8px';container.appendChild(summary);

  if(report.validation.issues.length){
    const issues=root.document.createElement('div');issues.style.marginTop='8px';
    report.validation.issues.slice(0,20).forEach(i=>issues.appendChild(text('div',(i.blocking?'✗ ':'⚠ ')+i.message,i.blocking?'co co-rd':'co')));
    container.appendChild(issues);
  }

  const scenarios=root.document.createElement('div');scenarios.style.marginTop='10px';
  for(const s of report.scenarios.slice(0,30)){
    const row=root.document.createElement('div');row.style.cssText='padding:8px 0;border-top:1px solid rgba(127,127,127,.22)';
    row.appendChild(text('strong',(s.status==='failed'?'✗ ':'✓ ')+s.name));
    row.appendChild(text('div',tr('validation.wan.scenarioSummary',{baseline:s.baselineReachablePairs,surviving:s.survivingReachablePairs,lost:s.lostReachability.length,groups:s.wanGroupsLost.join(', ')},s.wanGroupsLost.length?'Reachability baseline {baseline} · sobrevive {surviving} · perdida {lost} · WAN sin salida: {groups}':'Reachability baseline {baseline} · sobrevive {surviving} · perdida {lost}'),'hint'));
    if(s.lostReachability.length){
      s.lostReachability.slice(0,5).forEach(item=>{
        const src=item.source&&item.source.label||item.source&&item.source.cidr||item.source&&item.source.id||tr('validation.reach.sourceLower',{},'origen');
        const dst=item.target&&item.target.label||item.target&&item.target.cidr||item.target&&item.target.id||tr('validation.reach.destinationLower',{},'destino');
        row.appendChild(text('div','↳ '+src+' → '+dst+' · '+item.reason,'hint'));
      });
    }
    scenarios.appendChild(row);
  }
  if(!report.scenarios.length)scenarios.appendChild(text('div',tr('validation.wan.empty',{},'No hay circuitos, routers o VPN suficientes para generar escenarios automáticos.'),'hint'));
  container.appendChild(scenarios);
  root.NetWizardLastWanResilienceReport=report;
  return report;
}
function projectSnapshot(){
  const state=root.NetWizardState;
  return state&&state.getSnapshot?state.getSnapshot():root.S||{};
}
function ensurePanel(){
  if(!root.document||!root.NetWizardWanResilience)return null;
  const host=root.document.getElementById('pg-validate');if(!host)return null;
  const project=projectSnapshot();
  if(!arr(project.wanCircuits).length&&!arr(project.routing&&project.routing.siteToSiteVpns).length){
    root.document.getElementById('nwWanResiliencePanel')?.remove();return null;
  }
  let panel=root.document.getElementById('nwWanResiliencePanel');
  if(!panel){
    panel=root.document.createElement('div');panel.id='nwWanResiliencePanel';panel.className='card';panel.style.marginTop='12px';
    const head=root.document.createElement('div');head.className='card-h';
    head.append(text('div','🛡 Resiliencia WAN','card-t'),text('span',tr('validation.wan.onDemand',{},'On demand'),'b bac'));
    const hint=text('div',tr('validation.wan.onDemandHint',{},'El análisis de fallos WAN puede ser costoso en proyectos grandes. Se ejecuta únicamente bajo demanda y el resultado queda marcado como obsoleto cuando cambia el proyecto.'),'hint');
    const actions=root.document.createElement('div');actions.className='brow';actions.style.marginTop='8px';
    const run=root.document.createElement('button');run.id='nwWanResilienceRun';run.type='button';run.className='btn bp';run.textContent=tr('validation.wan.run',{},'▶ Analizar resiliencia WAN');
    const status=text('span',tr('validation.wan.pending',{},'Pendiente de análisis'),'hint');status.id='nwWanResilienceStatus';
    const results=root.document.createElement('div');results.id='nwWanResilienceResults';results.style.marginTop='10px';
    actions.append(run,status);panel.append(head,hint,actions,results);
    host.appendChild(panel);
    run.onclick=()=>{
      status.textContent=tr('validation.wan.running',{},'Analizando…');
      const report=renderInto(results,projectSnapshot());
      root.NetWizardLastWanResilienceReport=report;
      status.textContent=tr('validation.wan.updated',{},'Análisis actualizado');
    };
  }
  return panel;
}
function markStale(){
  root.NetWizardLastWanResilienceReport=null;
  const panel=root.document&&root.document.getElementById('nwWanResiliencePanel');
  if(!panel)return;
  const status=root.document.getElementById('nwWanResilienceStatus');
  if(status)status.textContent=tr('validation.wan.stale',{},'Proyecto modificado · análisis pendiente');
}
function inject(){
  return ensurePanel();
}
function install(){
  if(!root.document)return false;
  const active=()=>root.document.getElementById('pg-validate')?.classList.contains('on');
  root.document.addEventListener('nw:project:changed',()=>{markStale();if(active())ensurePanel();});
  root.document.addEventListener('nw:view:changed',event=>{if(event.detail?.step==='validate')ensurePanel();});root.addEventListener&&root.addEventListener('netwizard:i18n',()=>{if(active()){root.document.getElementById('nwWanResiliencePanel')?.remove();ensurePanel();}});
  if(root.document.readyState==='loading')root.document.addEventListener('DOMContentLoaded',()=>root.setTimeout(()=>{if(active())ensurePanel();},100));
  else root.setTimeout(()=>{if(active())ensurePanel();},0);
  return true;
}
const api={version:'netwizard-wan-resilience-ui-v2',renderInto,inject,install,ensurePanel,markStale};
root.NetWizardWanResilienceUi=api;
if(typeof module!=='undefined'&&module.exports)module.exports=api;
if(root.document)install();
})(typeof window!=='undefined'?window:globalThis);
