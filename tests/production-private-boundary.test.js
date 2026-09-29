'use strict';

const assert=require('assert');
const fs=require('fs');
const path=require('path');
const Manifest=require('../js/netwizard-browser-modules.js');
const Boundary=require('../scripts/prepare-production-index.js');

const root=path.join(__dirname,'..');
const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
const production=Boundary.stripPrivateBrowserScripts(html);
const privateModules=Manifest.paths().filter(p=>!Manifest.paths({production:true}).includes(p));

assert.deepStrictEqual(Boundary.PRIVATE_BROWSER_MODULES,privateModules);
assert.deepStrictEqual(Boundary.PRIVATE_ROUTING_BROWSER_MODULES,privateModules,'compatibility alias must match generalized boundary');
assert.ok(privateModules.length>0,'Debe existir al menos un módulo privado excluido de producción');

for(const asset of privateModules){
  assert.ok(html.includes('./'+asset),'local browser entrypoint should keep '+asset);
  assert.ok(!production.includes('./'+asset),'production entrypoint must omit '+asset);
}

for(const required of [
  './js/netwizard-browser-modules.js',
  './js/netwizard-config-pipeline.js',
  './js/netwizard-runtime.js',
  './js/netwizard-rack-model.js',
  './js/netwizard-structured-cabling.js',
  './js/netwizard-private-deployment-ui.js',
  './js/netwizard-self-hosted-private-client.js'
]){
  assert.ok(production.includes(required),'production entrypoint must preserve '+required);
}

for(const excluded of [
  './js/netwizard-vendor-config-generators.js',
  './js/netwizard-firewall-edge-generator.js',
  './js/netwizard-switching-generator.js',
  './js/netwizard-access-security-plan.js',
  './js/netwizard-access-security-generator.js',
  './js/netwizard-management-plan.js',
  './js/netwizard-management-generator.js',
  './js/netwizard-ha-services-plan.js',
  './js/netwizard-ha-services-generator.js',
  './js/netwizard-firewall-edge-integration.js',
  './js/netwizard-switching-integration.js',
  './js/netwizard-access-security-integration.js',
  './js/netwizard-management-integration.js',
  './js/netwizard-ha-services-integration.js'
]){
  assert.ok(!production.includes(excluded),'production entrypoint must omit specialized generator '+excluded);
}

const docker=fs.readFileSync(path.join(root,'Dockerfile'),'utf8');
assert.ok(
  docker.includes('node scripts/prepare-production-index.js /out/public/index.html /out/public'),
  'Docker debe aplicar la frontera declarativa de producción'
);
for(const asset of privateModules){
  assert.ok(!docker.includes(path.basename(asset)),'Docker no debe duplicar manualmente la lista privada: '+asset);
}
assert.ok(
  docker.includes('private/deployment-worker.js --bundle') &&
  docker.includes('/out/private/deployment-worker.cjs') &&
  docker.includes('NETWIZARD_PRIVATE_DEPLOYMENT_WORKER=/app/private/deployment-worker.cjs'),
  'Docker debe empaquetar deployment planning solo en el área privada'
);
assert.ok(docker.includes('test ! -e /out/public/private'),'El directorio private nunca debe publicarse como asset');
assert.ok(!html.includes('./private/vendor-config-engine.js'),'El motor vendor privado no debe formar parte del entrypoint browser');
assert.ok(!html.includes('./private/legacy-vendor-generators.js'),'Cisco ASA/Windows/Linux privados no deben formar parte del entrypoint browser');
assert.ok(!html.includes('./private/deployment-production-gate.js'),'La Production Gate privada nunca debe formar parte del entrypoint browser');
const selfHostedClient=fs.readFileSync(path.join(root,'js/netwizard-self-hosted-private-client.js'),'utf8');
for(const forbidden of ['NetWizardVendorConfigGenerators','netwizard-vendor-config-generators','private/vendor-config-engine','genCiscoRouter','genCiscoSwitch']){
  assert.ok(!selfHostedClient.includes(forbidden),'El transporte self-hosted no debe contener lógica vendor privada: '+forbidden);
}
assert.ok(selfHostedClient.includes('/api/private/self-hosted/deployment-plan'),'El cliente self-hosted debe delegar la generación al endpoint server-side');
assert.ok(docker.includes('private/deployment-worker.js --bundle'),'Vendor generation debe viajar solo dentro del bundle privado de deployment');
const privateWorkerSource=fs.readFileSync(path.join(root,'private/deployment-worker.js'),'utf8');
assert.ok(
  privateWorkerSource.includes("require('./deployment-production-gate.js')"),
  'El worker privado debe empaquetar la Production Gate server-side'
);

assert.ok(privateModules.includes('js/netwizard-legacy-config-generator.js'),'El generador histórico extraído debe ser source-only');
assert.ok(!production.includes('./js/netwizard-legacy-config-generator.js'),'Docker no debe cargar el generador histórico extraído');

const netwizardSource=fs.readFileSync(path.join(root,'js/netwizard.js'),'utf8');
for(const legacyFn of [
  'genCiscoSwitch','genCiscoRouter','genCiscoAsa','genJuniper','genAruba',
  'genPfSense','genFortigate','genWindowsServer','genLinux'
]){
  assert.ok(!netwizardSource.includes('function '+legacyFn+'('),'netwizard.js no debe volver a incrustar '+legacyFn);
}
assert.ok(
  netwizardSource.includes('function configForView(devId,format)')&&
  netwizardSource.includes('privateConfigArtifact(devId)')&&
  netwizardSource.includes('NetWizardPrivateDeploymentUi')&&
  netwizardSource.includes("const cfg=configForView(selDevCfg,selVendorCfg)")&&
  netwizardSource.includes('Configuración privada pendiente'),
  'La vista productiva debe priorizar el artefacto del Private Engine fuera del pipeline local y fallar de forma explícita mientras no exista'
);
assert.ok(
  !netwizardSource.includes('function genCiscoSwitch(')&&
  !netwizardSource.includes('function genCiscoRouter('),
  'La UX server-side no debe reintroducir generación Cisco en el navegador productivo'
);
assert.ok(
  netwizardSource.includes('Generación local desactivada en el navegador SaaS'),
  'Las exportaciones locales deben quedar bloqueadas cuando el generador source-only no existe'
);
const bundleSource=fs.readFileSync(path.join(root,'js/netwizard-deployment-bundle.js'),'utf8');
assert.ok(
  bundleSource.includes("missing.push('LocalConfigGenerator')"),
  'El ZIP local debe bloquearse en browser productivo sin generador local'
);
const observedSource=fs.readFileSync(path.join(root,'js/netwizard-observed-config-ui.js'),'utf8');
assert.ok(
  observedSource.includes('El preflight local no está disponible en el navegador SaaS'),
  'El preflight observado debe bloquearse en browser productivo'
);

console.log('✓ El frontend de producción excluye generadores especializados y el fallback histórico del monolito');
