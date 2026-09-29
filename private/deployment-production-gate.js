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

const BaseGate=require('../js/netwizard-production-gate.js');
const ArchitectureGate=require('../js/netwizard-production-gate-architecture.js');

const CONTRACT_VERSION='netwizard-private-production-gate-v1';
const UNSUPPORTED_OUTPUT=/(todavía no implementado|no implementado en navegador de producción|generación local está desactivada|sin vendor asignado)/i;

function arr(value){return Array.isArray(value)?value:[];}
function obj(value){return value&&typeof value==='object'&&!Array.isArray(value)?value:{};}
function clean(value,max){return String(value==null?'':value).trim().slice(0,max||500);}
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
function compactProjectGate(project,generatedAt){
  const gate=ArchitectureGate.install()||BaseGate;
  const report=gate.runProductionGate(project||{},{
    productionMode:true,
    strict:true
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
function validateArtifacts(project,result,generated){
  const p=obj(project),r=obj(result),g=obj(generated),issues=[];
  const artifacts=arr(r.artifacts),byPath=new Map(),devices=arr(p.devices);
  for(const artifact of artifacts){
    const path=clean(artifact&&artifact.path,512);
    if(!safeArtifactPath(path)){
      issues.push(issue('NW-PRIVATE-GATE-004','Artefacto con ruta no segura o inválida.',{path}));
      continue;
    }
    const count=(byPath.get(path)||0)+1;
    byPath.set(path,count);
    if(count>1)issues.push(issue('NW-PRIVATE-GATE-005','Ruta de artefacto duplicada: '+path,{path}));
  }

  const configSources=obj(r.configSources);
  for(const device of devices){
    const id=clean(device&&device.id,256),name=clean(device&&device.name,160)||id||'dispositivo';
    if(!id)continue;
    if(configSources[id]!=='private'){
      issues.push(issue('NW-PRIVATE-GATE-001',name+': la configuración objetivo no está acreditada como privada.',{deviceId:id}));
    }
    const expectedPath=clean(obj(g.configPaths)[id],512);
    const configArtifacts=expectedPath?artifacts.filter(file=>clean(file&&file.path,512)===expectedPath):[];
    if(!expectedPath||configArtifacts.length!==1){
      issues.push(issue(
        'NW-PRIVATE-GATE-002',
        name+': se esperaba exactamente un artefacto de configuración privado en la ruta derivada y se encontraron '+configArtifacts.length+'.',
        {deviceId:id,path:expectedPath}
      ));
      continue;
    }
    const output=String(configArtifacts[0].content==null?'':configArtifacts[0].content);
    if(output.trim().length<20||UNSUPPORTED_OUTPUT.test(output)){
      issues.push(issue('NW-PRIVATE-GATE-003',name+': el artefacto de configuración está vacío, es demasiado corto o contiene un fallback no ejecutable.',{
        deviceId:id,path:expectedPath
      }));
    }
    const readiness=obj(obj(g.configReadiness)[id]);
    const status=clean(readiness.status,40);
    if(clean(device&&device.vendorOs,80)==='cisco_ios'&&status!=='apply-ready'){
      const reasons=arr(readiness.reasons).map(x=>clean(x,300)).filter(Boolean);
      issues.push(issue('NW-PRIVATE-GATE-010',name+': la configuración Cisco IOS no está certificada como apply-ready.'+(reasons.length?' '+reasons.join(' '):''),{
        deviceId:id,path:expectedPath,configReadiness:status||'missing'
      }));
    }
  }

  if(!obj(r.changeSet)||!obj(r.incrementalPlan)||!obj(r.deploymentPlan)){
    issues.push(issue('NW-PRIVATE-GATE-006','El resultado privado no contiene change set, plan incremental y deployment plan completos.'));
  }
  if(clean(r.runbookMarkdown,20000).length<20){
    issues.push(issue('NW-PRIVATE-GATE-007','El deployment privado no produjo un runbook utilizable.'));
  }
  if(clean(r.rollbackMarkdown,20000).length<20){
    issues.push(issue('NW-PRIVATE-GATE-008','El deployment privado no produjo un rollback utilizable.'));
  }
  if(clean(r.postChangeChecklistMarkdown,20000).length<20){
    issues.push(issue('NW-PRIVATE-GATE-009','El deployment privado no produjo un checklist post-change utilizable.'));
  }
  return issues;
}
function summarize(report){
  const r=obj(report),c=obj(r.counts),lines=[];
  const icon=r.status==='ready'?'✅':r.status==='review'?'⚠️':'⛔';
  const label=r.status==='ready'?'LISTO':r.status==='review'?'REQUIERE REVISIÓN':'BLOQUEADO';
  lines.push(icon+' Private Production Gate: '+label);
  lines.push('Errores: '+(c.errors||0)+' · Avisos: '+(c.warnings||0)+' · Info: '+(c.info||0));
  const relevant=arr(r.issues).filter(item=>item&&item.severity!=='info');
  if(relevant.length){
    lines.push('','Incidencias:');
    for(const item of relevant.slice(0,100)){
      lines.push('• ['+String(item.severity||'warning').toUpperCase()+'] ['+clean(item.code,80)+'] '+clean(item.message,500));
    }
    if(relevant.length>100)lines.push('• ... '+(relevant.length-100)+' incidencia(s) más');
  }
  lines.push('');
  if(r.status==='ready')lines.push('Resultado: proyecto y artefactos privados cumplen la puerta estricta actual.');
  else if(r.status==='review')lines.push('Resultado: no hay bloqueos, pero existen avisos que requieren revisión antes de declarar producción.');
  else lines.push('Resultado: no presentes ni apliques este deployment como listo para producción.');
  return lines.join('\n')+'\n';
}
function evaluate(project,result,generatedAt,generated){
  const projectGate=compactProjectGate(project,generatedAt);
  const artifactIssues=result&&result.ok?validateArtifacts(project,result,generated):[
    issue('NW-PRIVATE-GATE-000','El plan privado no se completó; no puede certificarse para producción.')
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
  report.summaryMarkdown=summarize(report);
  return report;
}

module.exports={CONTRACT_VERSION,evaluate,validateArtifacts,safeArtifactPath,summarize};
