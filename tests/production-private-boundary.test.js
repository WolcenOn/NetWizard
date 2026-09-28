'use strict';

const assert=require('assert');
const fs=require('fs');
const path=require('path');
const Manifest=require('../js/netwizard-browser-modules.js');
const Boundary=require('../scripts/prepare-production-index.js');

const root=path.join(__dirname,'..');
const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
const production=Boundary.stripPrivateRoutingScripts(html);
const privateModules=Manifest.paths().filter(p=>!Manifest.paths({production:true}).includes(p));

assert.deepStrictEqual(Boundary.PRIVATE_ROUTING_BROWSER_MODULES,privateModules);
assert.ok(privateModules.length>0,'Debe existir al menos un módulo privado excluido de producción');

for(const asset of privateModules){
  assert.ok(html.includes('./'+asset),'local browser entrypoint should keep '+asset);
  assert.ok(!production.includes('./'+asset),'production entrypoint must omit '+asset);
}

for(const required of [
  './js/netwizard-browser-modules.js',
  './js/netwizard-config-pipeline.js',
  './js/netwizard-firewall-edge-generator.js',
  './js/netwizard-runtime.js',
  './js/netwizard-rack-model.js',
  './js/netwizard-structured-cabling.js'
]){
  assert.ok(production.includes(required),'production entrypoint must preserve '+required);
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
assert.ok(docker.includes('private/deployment-worker.js --bundle'),'Vendor generation debe viajar solo dentro del bundle privado de deployment');

console.log('✓ El frontend de producción deriva exclusiones privadas del manifiesto browser y conserva workers fuera de public');
