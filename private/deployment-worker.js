'use strict';

const ChangeSet=require('../js/netwizard-change-set.js');
const Incremental=require('../js/netwizard-incremental-generators.js');
const Runbook=require('../js/netwizard-deployment-runbook.js');
const VendorConfig=require('./vendor-config-engine.js');

const CONTRACT_VERSION='netwizard-private-deployment-plan-v1';
const MAX_DEVICES=1000;

function obj(value){return value&&typeof value==='object'&&!Array.isArray(value)?value:{};}
function arr(value){return Array.isArray(value)?value:[];}
function clean(value,max){return String(value==null?'':value).trim().slice(0,max||240);}

function validateInput(request){
  const req=obj(request),project=obj(req.project);
  const devices=arr(project.devices);
  if(Object.prototype.hasOwnProperty.call(req,'desiredConfigs')||Object.prototype.hasOwnProperty.call(req,'configPaths')){
    throw new Error('client config inputs are no longer accepted');
  }
  if(!Object.keys(project).length)throw new Error('project required');
  if(devices.length>MAX_DEVICES)throw new Error('too many devices');
  return {project};
}

function resultBase(input,generatedAt){
  return {
    contractVersion:CONTRACT_VERSION,
    generatedAt,
    ok:false,
    projectName:clean(input.project.projName,160),
    changeSet:null,
    incrementalPlan:null,
    deploymentPlan:null,
    runbookMarkdown:'',
    rollbackMarkdown:'',
    changeSummaryMarkdown:'',
    incrementalSummaryMarkdown:'',
    postChangeChecklistMarkdown:'',
    artifacts:[],
    issues:[],
    configSources:{},
    privateConfigContract:VendorConfig.CONTRACT_VERSION
  };
}

function handle(request){
  const req=obj(request);
  const input=validateInput(req);
  const generatedAt=clean(req.generatedAt,80)||new Date().toISOString();
  const result=resultBase(input,generatedAt);

  const generated=VendorConfig.generateAll(input.project);
  result.configSources=generated.sources;
  result.artifacts.push(...arr(generated.artifacts));
  result.issues.push(...arr(generated.issues));
  if(!generated.ok)return result;

  const desiredConfigs=generated.configs;
  const configPaths=generated.configPaths;
  const changeSet=ChangeSet.buildChangeSet(input.project,{
    generatedAt,
    desiredConfigs,
    configPaths
  });
  result.changeSet=ChangeSet.publicChangeSet(changeSet);
  result.changeSummaryMarkdown=ChangeSet.buildSummaryMarkdown(changeSet);
  result.artifacts.push(...arr(changeSet.artifacts).map(file=>({
    path:file.path,content:file.content,mime:'text/x-diff;charset=utf-8'
  })));
  result.issues.push(...arr(changeSet.issues));
  if(!changeSet.ok)return result;

  const incrementalPlan=Incremental.buildPlan(input.project,{
    generatedAt,
    changeSet,
    desiredConfigs,
    configPaths
  });
  result.incrementalPlan=Incremental.publicPlan(incrementalPlan);
  result.incrementalSummaryMarkdown=Incremental.buildSummaryMarkdown(incrementalPlan);
  result.artifacts.push(...arr(incrementalPlan.artifacts).map(file=>({
    path:file.path,content:file.content,mime:file.mime||'text/plain;charset=utf-8'
  })));
  result.issues.push(...arr(incrementalPlan.issues));
  if(!incrementalPlan.ok)return result;

  const deploymentPlan=Runbook.buildDeploymentPlan(input.project,{
    generatedAt,
    changeSet,
    incrementalPlan,
    configPaths
  });
  result.deploymentPlan=deploymentPlan;
  result.issues.push(...arr(deploymentPlan.issues));
  if(!deploymentPlan.ok)return result;

  result.ok=true;
  result.runbookMarkdown=Runbook.buildMarkdown(deploymentPlan);
  result.rollbackMarkdown=Runbook.buildRollbackMarkdown(deploymentPlan);
  result.postChangeChecklistMarkdown=ChangeSet.buildPostChangeChecklist(changeSet,deploymentPlan);
  return result;
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
