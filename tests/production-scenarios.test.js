'use strict';

const assert=require('assert');
const fs=require('fs');
const path=require('path');

const root=path.resolve(__dirname,'..');
require('../js/netwizard-audit.js');
require('../js/netwizard-network-utils.js');
const Schema=require('../js/netwizard-project-schema.js');
const CapabilityRegistry=require('../js/netwizard-capability-registry.js');
const DeviceModel=require('../js/netwizard-device-model.js');
const {createPipeline}=require('../js/netwizard-config-pipeline.js');
const VendorGenerator=require('../js/netwizard-vendor-config-generators.js');
const SwitchingGenerator=require('../js/netwizard-switching-generator.js');
const FirewallGenerator=require('../js/netwizard-firewall-edge-generator.js');
const Documentation=require('../js/netwizard-documentation-utils.js');
const DeploymentBundle=require('../js/netwizard-deployment-bundle.js');
const DeploymentRunbook=require('../js/netwizard-deployment-runbook.js');
const ChangeSet=require('../js/netwizard-change-set.js');
const IncrementalGenerators=require('../js/netwizard-incremental-generators.js');
require('../js/netwizard-production-gate-architecture.js');
const Gate=global.NetWizardProductionGate;
const manifest=JSON.parse(fs.readFileSync(path.join(root,'samples','production-scenarios.json'),'utf8'));

let activeProject={};
const pipeline=createPipeline({baseGenerator(){return '';},getProject(){return activeProject;}});
const vendorRenderer=VendorGenerator.createEnhancedGenConfig({
  originalGenConfig(){return '';},
  getProject(){return activeProject;},
  getFwAcl(){return '';},
  netUtils:require('../js/netwizard-network-utils.js')
});
pipeline.registerRenderer({id:'edge.firewall',priority:300,supports:ctx=>['fortinet','pfsense'].includes(ctx.vendor),render:ctx=>FirewallGenerator.render(ctx.project,ctx.deviceId,ctx.vendor)});
pipeline.registerRenderer({id:'device.switching',priority:250,supports:ctx=>ctx.device&&DeviceModel.isSwitching(ctx.device),render:ctx=>SwitchingGenerator.render(ctx.project,ctx.deviceId,ctx.vendor)});
pipeline.registerRenderer({id:'vendor.base',priority:100,render:ctx=>vendorRenderer(ctx.deviceId,ctx.vendor)});

assert.strictEqual(manifest.version,'3.50.0');
assert.ok(Array.isArray(manifest.scenarios) && manifest.scenarios.length >= 4);
assert.strictEqual(new Set(manifest.scenarios.map(item=>item.id)).size,manifest.scenarios.length);

for(const scenario of manifest.scenarios){
  const payload=JSON.parse(fs.readFileSync(path.join(root,'samples',scenario.file),'utf8'));
  assert.strictEqual(payload.schemaVersion,'3.50.0',`${scenario.id}: payload no canónico`);
  const prepared=Schema.prepareImport(payload,{defaults:{}});
  assert.strictEqual(prepared.ok,true,`${scenario.id}: ${prepared.errors.join('\n')}`);
  assert.strictEqual(prepared.project._schemaVersion,'3.50.0');
  assert.deepStrictEqual(prepared.migrations,[],`${scenario.id}: el sample 3.50 no debe necesitar migración`);

  for(const device of prepared.project.devices){
    assert.strictEqual(device.kind,device.type,`${scenario.id}/${device.id}: kind y type deben estar sincronizados`);
    assert.ok(CapabilityRegistry.resolvePlatform(device),`${scenario.id}/${device.id}: vendor sin capacidades`);
  }

  const report=Gate.runProductionGate(prepared.project,{productionMode:true,strict:true});
  assert.strictEqual(report.status,scenario.expectedStatus,`${scenario.id}: estado inesperado`);
  assert.strictEqual(report.canExport,true,`${scenario.id}: contiene bloqueos de producción`);
  const warningCodes=report.issues.filter(issue=>issue.severity==='warning').map(issue=>issue.code).sort();
  assert.deepStrictEqual(warningCodes,scenario.allowedWarningCodes.slice().sort(),`${scenario.id}: avisos fuera de contrato`);

  const release=Gate.evaluateReleaseCriteria(report,{
    allowReview:scenario.expectedStatus==='review',
    allowedWarningCodes:scenario.allowedWarningCodes,
    maxWarnings:scenario.allowedWarningCodes.length
  });
  assert.strictEqual(release.passed,true,`${scenario.id}: ${release.reasons.join(', ')}`);

  activeProject=prepared.project;
  const generatedConfigs={};
  for(const expected of scenario.configs){
    const device=prepared.project.devices.find(item=>item.id===expected.deviceId);
    assert(device,`${scenario.id}: no existe ${expected.deviceId}`);
    assert.strictEqual(device.vendorOs,expected.vendor,`${scenario.id}/${expected.deviceId}: vendor inesperado`);
    assert.ok(expected.signatures.length >= 2,`${scenario.id}/${expected.deviceId}: contrato de salida insuficiente`);
    const output=pipeline.generate(expected.deviceId,expected.vendor);
    generatedConfigs[expected.deviceId]=output;
    assert.ok(output.length > 80,`${scenario.id}/${expected.deviceId}: salida demasiado corta`);
    assert.ok(!/Sin vendor asignado|todavía no implementado/i.test(output),`${scenario.id}/${expected.deviceId}: fallback inválido`);
    for(const signature of expected.signatures) assert.ok(output.includes(signature),`${scenario.id}/${expected.deviceId}: falta ${signature}`);
  }

  const bundle=DeploymentBundle.buildDeploymentPackage(prepared.project,{
    generatedAt:'2026-09-15T00:00:00.000Z',gate:Gate,schema:Schema,documentation:Documentation,runbook:DeploymentRunbook,changeSet:ChangeSet,incremental:IncrementalGenerators,
    generateConfig:(deviceId,vendor)=>pipeline.generate(deviceId,vendor)
  });
  assert.strictEqual(bundle.ok,true,`${scenario.id}: el paquete quedó bloqueado: ${(bundle.issues||[]).map(issue=>issue.code).join(', ')}`);
  assert.strictEqual(bundle.manifest.productionStatus,scenario.expectedStatus);
  assert.strictEqual(bundle.manifest.counts.devices,prepared.project.devices.length);
  assert.strictEqual(bundle.files.filter(file=>file.path.startsWith('configs/')).length,prepared.project.devices.length);
  assert.strictEqual(bundle.deploymentPlan.steps.length,prepared.project.devices.length);
  assert.ok(bundle.files.some(file=>file.path==='deployment/runbook.md'));
  assert.ok(bundle.files.some(file=>file.path==='changes/change-set.json'));
  assert.ok(bundle.files.some(file=>file.path==='incremental/plan.json'));
  assert.ok(bundle.files.some(file=>file.path==='evidence/pre-change.json'));
  assert.ok(DeploymentBundle.encodeZip(bundle).length>1000,`${scenario.id}: ZIP vacío`);

  if(scenario===manifest.scenarios[0]){
    const incrementalProject=JSON.parse(JSON.stringify(prepared.project));
    incrementalProject.deployment=Object.assign({},incrementalProject.deployment,{changeMode:'incremental',maxObservedAgeHours:24});
    incrementalProject.observedState={observedAt:'2026-09-15T11:00:00.000Z',source:'production-scenario',deviceConfigs:{}};
    for(const device of incrementalProject.devices)incrementalProject.observedState.deviceConfigs[device.id]={vendor:device.vendorOs,capturedAt:'2026-09-15T11:00:00.000Z',source:'fixture',content:generatedConfigs[device.id]};
    const changedDevice=incrementalProject.devices[0];
    incrementalProject.observedState.deviceConfigs[changedDevice.id].content+='\n! observed-only-line\n';
    activeProject=incrementalProject;
    const incrementalBundle=DeploymentBundle.buildDeploymentPackage(incrementalProject,{generatedAt:'2026-09-15T12:00:00.000Z',gate:Gate,schema:Schema,documentation:Documentation,runbook:DeploymentRunbook,changeSet:ChangeSet,incremental:IncrementalGenerators,generateConfig:(deviceId,vendor)=>pipeline.generate(deviceId,vendor)});
    assert.strictEqual(incrementalBundle.ok,true,`${scenario.id}: change set incremental bloqueado: ${(incrementalBundle.issues||[]).map(issue=>issue.code).join(', ')}`);
    assert.strictEqual(incrementalBundle.manifest.changeSet.executionMode,'reviewed-incremental');
    assert.strictEqual(incrementalBundle.manifest.changeSet.observedDevices,incrementalProject.devices.length);
    assert.strictEqual(incrementalBundle.manifest.changeSet.changedDevices,1);
    assert.ok(incrementalBundle.files.some(file=>file.path.startsWith('changes/patches/')));
  }
}

const rejected=Gate.evaluateReleaseCriteria({issues:[{code:'NW-X',severity:'warning',message:'nuevo aviso'}]},{allowReview:true,allowedWarningCodes:[]});
assert.strictEqual(rejected.passed,false);
assert.deepStrictEqual(rejected.unexpectedWarnings.map(issue=>issue.code),['NW-X']);
const acceptedWithoutLimit=Gate.evaluateReleaseCriteria({issues:[{code:'NW-OK-WARN',severity:'warning',message:'aceptado'}]},{allowReview:true,allowedWarningCodes:['NW-OK-WARN']});
assert.strictEqual(acceptedWithoutLimit.passed,true);

console.log('✓ Escenarios 3.50 cumplen schema, puerta estricta y contratos de salida');
