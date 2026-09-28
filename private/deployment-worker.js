'use strict';

const ChangeSet=require('../js/netwizard-change-set.js');
const Incremental=require('../js/netwizard-incremental-generators.js');
const Runbook=require('../js/netwizard-deployment-runbook.js');

const CONTRACT_VERSION='netwizard-private-deployment-plan-v1';
const MAX_DEVICES=1000;
const MAX_CONFIG_BYTES=16*1024*1024;
const MAX_TOTAL_CONFIG_BYTES=64*1024*1024;

function obj(value){return value&&typeof value==='object'&&!Array.isArray(value)?value:{};}
function arr(value){return Array.isArray(value)?value:[];}
function clean(value,max){return String(value==null?'':value).trim().slice(0,max||240);}
function byteLength(value){return Buffer.byteLength(String(value==null?'':value),'utf8');}

function validateInput(request){
  const req=obj(request),project=obj(req.project),desired=obj(req.desiredConfigs),paths=obj(req.configPaths);
  const devices=arr(project.devices);
  if(!Object.keys(project).length)throw new Error('project required');
  if(devices.length>MAX_DEVICES)throw new Error('too many devices');
  const ids=new Set(devices.map(d=>clean(d&&d.id,256)).filter(Boolean));
  let total=0;
  for(const [id,value] of Object.entries(desired)){
    if(!ids.has(clean(id,256)))throw new Error('desired config references unknown device: '+id);
    const size=byteLength(value);
    if(size>MAX_CONFIG_BYTES)throw new Error('desired config too large: '+id);
    total+=size;
  }
  if(total>MAX_TOTAL_CONFIG_BYTES)throw new Error('desired configs payload too large');
  for(const [id,value] of Object.entries(paths)){
    if(!ids.has(clean(id,256)))throw new Error('config path references unknown device: '+id);
    if(clean(value,300)!==String(value==null?'':value).trim())throw new Error('config path too long: '+id);
  }
  return {project,desiredConfigs:desired,configPaths:paths};
}

function handle(request){
  const req=obj(request);
  const input=validateInput(req);
  const generatedAt=clean(req.generatedAt,80)||new Date().toISOString();
  const changeSet=ChangeSet.buildChangeSet(input.project,{
    generatedAt,
    desiredConfigs:input.desiredConfigs,
    configPaths:input.configPaths
  });
  const incrementalPlan=Incremental.buildPlan(input.project,{
    generatedAt,
    changeSet,
    desiredConfigs:input.desiredConfigs,
    configPaths:input.configPaths
  });
  const deploymentPlan=Runbook.buildDeploymentPlan(input.project,{
    generatedAt,
    changeSet,
    incrementalPlan,
    configPaths:input.configPaths
  });
  const ok=!!(changeSet.ok&&incrementalPlan.ok&&deploymentPlan.ok);
  const artifacts=[
    ...arr(changeSet.artifacts).map(file=>({path:file.path,content:file.content,mime:'text/x-diff;charset=utf-8'})),
    ...arr(incrementalPlan.artifacts).map(file=>({path:file.path,content:file.content,mime:file.mime||'text/plain;charset=utf-8'}))
  ];
  return {
    contractVersion:CONTRACT_VERSION,
    generatedAt,
    ok,
    projectName:clean(input.project.projName,160),
    changeSet:ChangeSet.publicChangeSet(changeSet),
    incrementalPlan:Incremental.publicPlan(incrementalPlan),
    deploymentPlan,
    runbookMarkdown:Runbook.buildMarkdown(deploymentPlan),
    rollbackMarkdown:Runbook.buildRollbackMarkdown(deploymentPlan),
    changeSummaryMarkdown:ChangeSet.buildSummaryMarkdown(changeSet),
    incrementalSummaryMarkdown:Incremental.buildSummaryMarkdown(incrementalPlan),
    postChangeChecklistMarkdown:ChangeSet.buildPostChangeChecklist(changeSet,deploymentPlan),
    artifacts,
    issues:[...arr(changeSet.issues),...arr(incrementalPlan.issues),...arr(deploymentPlan.issues)]
  };
}

function main(){
  let raw='';
  process.stdin.setEncoding('utf8');
  process.stdin.on('data',chunk=>{raw+=chunk;});
  process.stdin.on('end',()=>{
    try{
      const request=JSON.parse(raw||'{}');
      process.stdout.write(JSON.stringify(handle(request)));
    }catch(error){
      process.stderr.write(String(error&&error.message||error));
      process.exitCode=1;
    }
  });
}

if(require.main===module)main();
module.exports={CONTRACT_VERSION,handle,validateInput};
