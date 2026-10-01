/* NetWizard WAN Resilience UI v1 */
(function initNetWizardWanResilienceUi(root){
'use strict';
const arr=v=>Array.isArray(v)?v:[];
function text(tag,value,cls){const el=root.document.createElement(tag);if(cls)el.className=cls;el.textContent=String(value==null?'':value);return el;}
function renderInto(container,project){
  if(!container||!root.NetWizardWanResilience)return null;
  container.textContent='';
  const report=root.NetWizardWanResilience.analyzeProject(project||{});
  const head=root.document.createElement('div');head.className='card-h';
  head.append(text('div','🛡 Resiliencia WAN','card-t'),text('span','Derived','b bac'));container.appendChild(head);
  container.appendChild(text('div','Simula automáticamente pérdida de circuito, proveedor, router y VPN sobre una copia degradada del proyecto. Reachability decide qué tráfico realmente sobrevive.','hint'));
  const summary=text('div',
    'Diseño: '+(report.validation.ok?'válido':'revisar')+
    ' · escenarios: '+report.scenarios.length+
    ' · SPOF detectados: '+report.singlePoints.length,
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
    row.appendChild(text('div','Reachability baseline '+s.baselineReachablePairs+' · sobrevive '+s.survivingReachablePairs+' · perdida '+s.lostReachability.length+(s.wanGroupsLost.length?' · WAN sin salida: '+s.wanGroupsLost.join(', '):''),'hint'));
    if(s.lostReachability.length){
      s.lostReachability.slice(0,5).forEach(item=>{
        const src=item.source&&item.source.label||item.source&&item.source.cidr||item.source&&item.source.id||'origen';
        const dst=item.target&&item.target.label||item.target&&item.target.cidr||item.target&&item.target.id||'destino';
        row.appendChild(text('div','↳ '+src+' → '+dst+' · '+item.reason,'hint'));
      });
    }
    scenarios.appendChild(row);
  }
  if(!report.scenarios.length)scenarios.appendChild(text('div','No hay circuitos, routers o VPN suficientes para generar escenarios automáticos.','hint'));
  container.appendChild(scenarios);
  root.NetWizardLastWanResilienceReport=report;
  return report;
}
function inject(){
  if(!root.document||!root.NetWizardWanResilience)return null;
  const host=root.document.getElementById('pg-validate');if(!host)return null;
  const state=root.NetWizardState,project=state&&state.getSnapshot?state.getSnapshot():root.S||{};
  if(!arr(project.wanCircuits).length&&!arr(project.routing&&project.routing.siteToSiteVpns).length){
    root.document.getElementById('nwWanResiliencePanel')?.remove();return null;
  }
  let panel=root.document.getElementById('nwWanResiliencePanel');
  if(!panel){panel=root.document.createElement('div');panel.id='nwWanResiliencePanel';panel.className='card';panel.style.marginTop='12px';host.appendChild(panel);}
  return renderInto(panel,project);
}
function install(){
  if(!root.document)return false;
  root.document.addEventListener('nw:project:changed',inject);
  if(root.document.readyState==='loading')root.document.addEventListener('DOMContentLoaded',()=>root.setTimeout(inject,100));
  else root.setTimeout(inject,0);
  return true;
}
const api={version:'netwizard-wan-resilience-ui-v1',renderInto,inject,install};
root.NetWizardWanResilienceUi=api;
if(typeof module!=='undefined'&&module.exports)module.exports=api;
if(root.document)install();
})(typeof window!=='undefined'?window:globalThis);
