'use strict';

// Cargas estáticas deliberadas: esbuild debe incluir todos los validadores dentro
// de deployment-worker.cjs. La puerta browser puede resolverlos dinámicamente,
// pero el worker privado no debe depender de fuentes JS externas al bundle.
require('../js/netwizard-audit.js');
require('../js/netwizard-network-utils.js');
require('../js/netwizard-project-schema.js');
require('../js/netwizard-vlsm-physical-planner.js');
require('../js/netwizard-dhcp-utils.js');
require('../js/netwizard-policy-utils.js');
require('../js/netwizard-broadcast-utils.js');
require('../js/netwizard-cabling-utils.js');
require('../js/netwizard-poe-utils-v2.js');
require('../js/netwizard-l2-utils.js');
require('../js/netwizard-vendor-hardening.js');
require('../js/netwizard-architecture-validator.js');
require('../js/netwizard-capability-registry.js');
require('../js/netwizard-physical-inventory.js');
require('../js/netwizard-resilience-topology.js');
require('../js/netwizard-wan-circuits.js');
require('../js/netwizard-traffic-capacity.js');
require('../js/netwizard-internal-services.js');
require('../js/netwizard-wifi-planning.js');
require('../js/netwizard-ipv6-vrf.js');
require('../js/netwizard-failure-simulation.js');
require('../js/netwizard-observed-drift.js');
require('../js/netwizard-routing-plan.js');
require('../js/netwizard-i18n.js');

const BaseGate=require('../js/netwizard-production-gate.js');
const ArchitectureGate=require('../js/netwizard-production-gate-architecture.js');

const CONTRACT_VERSION='netwizard-private-production-gate-v1';
const UNSUPPORTED_OUTPUT=/(todavía no implementado|no implementado en navegador de producción|generación local está desactivada|sin vendor asignado)/i;

function arr(value){return Array.isArray(value)?value:[];}
function obj(value){return value&&typeof value==='object'&&!Array.isArray(value)?value:{};}
function clean(value,max){return String(value==null?'':value).trim().slice(0,max||500);}
function localeOf(value){return clean(value,16).toLowerCase()==='en'?'en':'es';}
function pick(locale,es,en){return localeOf(locale)==='en'?en:es;}
function issue(code,message,extra){
  return Object.assign({
    code,
    severity:'error',
    blocking:true,
    category:'private-production-gate',
    source:'private-production-gate',
    message
  },extra||{});
}
function issueKey(item){
  const i=obj(item);
  return [i.code,i.severity,i.category,i.deviceId,i.path,i.message].map(x=>String(x==null?'':x)).join('\u0001');
}
function mergeIssues(){
  const seen=new Set(),out=[];
  for(const group of arguments){
    for(const raw of arr(group)){
      const item=obj(raw),key=issueKey(item);
      if(seen.has(key))continue;
      seen.add(key);
      out.push(item);
    }
  }
  return out;
}
function counts(issues){
  const out={errors:0,warnings:0,info:0,blocking:0,byCategory:{}};
  for(const raw of arr(issues)){
    const item=obj(raw),severity=clean(item.severity,20)||'warning',category=clean(item.category,80)||'general';
    if(severity==='error')out.errors++;
    else if(severity==='info')out.info++;
    else out.warnings++;
    if(item.blocking||severity==='error')out.blocking++;
    const bucket=out.byCategory[category]||(out.byCategory[category]={errors:0,warnings:0,info:0});
    if(severity==='error')bucket.errors++;
    else if(severity==='info')bucket.info++;
    else bucket.warnings++;
  }
  return out;
}
function compactProjectGate(project,generatedAt,locale){
  const gate=ArchitectureGate.install()||BaseGate;
  const report=gate.runProductionGate(project||{},{
    productionMode:true,
    strict:true,
    locale:localeOf(locale)
  });
  return {
    status:clean(report&&report.status,20)||'blocked',
    ready:!!(report&&report.ready),
    canExport:!!(report&&report.canExport),
    counts:obj(report&&report.counts),
    issues:arr(report&&report.issues),
    generatedAt
  };
}
function safeArtifactPath(value){
  const path=clean(value,512);
  if(!path||path.startsWith('/')||path.startsWith('\\')||path.includes('\\')||path.includes('\0'))return false;
  const parts=path.split('/');
  return parts.every(part=>part&&part!=='.'&&part!=='..');
}
function validateArtifacts(project,result,generated,locale){
  const p=obj(project),r=obj(result),g=obj(generated),issues=[];
  const artifacts=arr(r.artifacts),byPath=new Map(),devices=arr(p.devices);
  for(const artifact of artifacts){
    const path=clean(artifact&&artifact.path,512);
    if(!safeArtifactPath(path)){
      issues.push(issue('NW-PRIVATE-GATE-004',pick(locale,'Artefacto con ruta no segura o inválida.','Artifact has an unsafe or invalid path.'),{path}));
      continue;
    }
    const count=(byPath.get(path)||0)+1;
    byPath.set(path,count);
    if(count>1)issues.push(issue('NW-PRIVATE-GATE-005',pick(locale,'Ruta de artefacto duplicada: ','Duplicate artifact path: ')+path,{path}));
  }

  const configSources=obj(r.configSources);
  for(const device of devices){
    const id=clean(device&&device.id,256),name=clean(device&&device.name,160)||id||'dispositivo';
    if(!id)continue;
    if(configSources[id]!=='private'){
      issues.push(issue('NW-PRIVATE-GATE-001',name+pick(locale,': la configuración objetivo no está acreditada como privada.',': the target configuration is not attested as privately generated.'),{deviceId:id}));
    }
    const expectedPath=clean(obj(g.configPaths)[id],512);
    const configArtifacts=expectedPath?artifacts.filter(file=>clean(file&&file.path,512)===expectedPath):[];
    if(!expectedPath||configArtifacts.length!==1){
      issues.push(issue(
        'NW-PRIVATE-GATE-002',
        name+pick(locale,': se esperaba exactamente un artefacto de configuración privado en la ruta derivada y se encontraron ',': exactly one private configuration artifact was expected at the derived path; found ')+configArtifacts.length+'.',
        {deviceId:id,path:expectedPath}
      ));
      continue;
    }
    const output=String(configArtifacts[0].content==null?'':configArtifacts[0].content);
    if(output.trim().length<20||UNSUPPORTED_OUTPUT.test(output)){
      issues.push(issue('NW-PRIVATE-GATE-003',name+pick(locale,': el artefacto de configuración está vacío, es demasiado corto o contiene un fallback no ejecutable.',': the configuration artifact is empty, too short, or contains a non-executable fallback.'),{
        deviceId:id,path:expectedPath
      }));
    }
    const readiness=obj(obj(g.configReadiness)[id]);
    const status=clean(readiness.status,40);
    if(clean(device&&device.vendorOs,80)==='cisco_ios'&&status!=='apply-ready'){
      const reasons=arr(readiness.reasons).map(x=>clean(x,300)).filter(Boolean);
      issues.push(issue('NW-PRIVATE-GATE-010',name+pick(locale,': la configuración Cisco IOS no está certificada como apply-ready.',': the Cisco IOS configuration is not certified as apply-ready.')+(reasons.length?' '+reasons.join(' '):''),{
        deviceId:id,path:expectedPath,configReadiness:status||'missing'
      }));
    }
  }

  if(!obj(r.changeSet)||!obj(r.incrementalPlan)||!obj(r.deploymentPlan)){
    issues.push(issue('NW-PRIVATE-GATE-006',pick(locale,'El resultado privado no contiene change set, plan incremental y deployment plan completos.','The private result does not contain a complete change set, incremental plan, and deployment plan.')));
  }
  if(clean(r.runbookMarkdown,20000).length<20){
    issues.push(issue('NW-PRIVATE-GATE-007',pick(locale,'El deployment privado no produjo un runbook utilizable.','The private deployment did not produce a usable runbook.')));
  }
  if(clean(r.rollbackMarkdown,20000).length<20){
    issues.push(issue('NW-PRIVATE-GATE-008',pick(locale,'El deployment privado no produjo un rollback utilizable.','The private deployment did not produce a usable rollback document.')));
  }
  if(clean(r.postChangeChecklistMarkdown,20000).length<20){
    issues.push(issue('NW-PRIVATE-GATE-009',pick(locale,'El deployment privado no produjo un checklist post-change utilizable.','The private deployment did not produce a usable post-change checklist.')));
  }
  return issues;
}
function summarize(report,options){
  const locale=localeOf(options&&options.locale);
  const r=obj(report),c=obj(r.counts),lines=[];
  const icon=r.status==='ready'?'✅':r.status==='review'?'⚠️':'⛔';
  const label=r.status==='ready'?pick(locale,'LISTO','READY'):r.status==='review'?pick(locale,'REQUIERE REVISIÓN','REQUIRES REVIEW'):pick(locale,'BLOQUEADO','BLOCKED');
  lines.push(icon+' Private Production Gate: '+label);
  lines.push(pick(locale,'Errores: ','Errors: ')+(c.errors||0)+' · '+pick(locale,'Avisos: ','Warnings: ')+(c.warnings||0)+' · Info: '+(c.info||0));
  const relevant=arr(r.issues).filter(item=>item&&item.severity!=='info');
  if(relevant.length){
    lines.push('',pick(locale,'Incidencias:','Issues:'));
    for(const item of relevant.slice(0,100)){
      lines.push('• ['+String(item.severity||'warning').toUpperCase()+'] ['+clean(item.code,80)+'] '+clean(item.message,500));
    }
    if(relevant.length>100)lines.push('• ... '+(relevant.length-100)+' '+pick(locale,'incidencia(s) más','more issue(s)'));
  }
  lines.push('');
  if(r.status==='ready')lines.push(pick(locale,'Resultado: proyecto y artefactos privados cumplen la puerta estricta actual.','Result: the project and private artifacts pass the current strict gate.'));
  else if(r.status==='review')lines.push(pick(locale,'Resultado: no hay bloqueos, pero existen avisos que requieren revisión antes de declarar producción.','Result: there are no blockers, but warnings require review before declaring production readiness.'));
  else lines.push(pick(locale,'Resultado: no presentes ni apliques este deployment como listo para producción.','Result: do not present or apply this deployment as production-ready.'));
  return lines.join('\n')+'\n';
}
function evaluate(project,result,generatedAt,generated,options){
  const locale=localeOf(options&&options.locale);
  const projectGate=compactProjectGate(project,generatedAt,locale);
  const artifactIssues=result&&result.ok?validateArtifacts(project,result,generated,locale):[
    issue('NW-PRIVATE-GATE-000',pick(locale,'El plan privado no se completó; no puede certificarse para producción.','The private plan did not complete and cannot be certified for production.'))
  ];
  const issues=mergeIssues(projectGate.issues,artifactIssues);
  const summaryCounts=counts(issues);
  const blocking=issues.some(item=>item&&(item.blocking||item.severity==='error'));
  const status=blocking?'blocked':(summaryCounts.warnings>0?'review':'ready');
  const report={
    contractVersion:CONTRACT_VERSION,
    status,
    ready:status==='ready',
    canExport:!blocking,
    counts:summaryCounts,
    issues,
    projectGate:{
      status:projectGate.status,
      ready:projectGate.ready,
      canExport:projectGate.canExport,
      counts:projectGate.counts
    },
    artifactGate:{
      ready:artifactIssues.length===0,
      issueCount:artifactIssues.length
    },
    generatedAt
  };
  report.summaryMarkdown=summarize(report,{locale});
  return report;
}

module.exports={CONTRACT_VERSION,evaluate,validateArtifacts,safeArtifactPath,summarize};
