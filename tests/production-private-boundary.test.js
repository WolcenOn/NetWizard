'use strict';

const assert=require('assert');
const fs=require('fs');
const path=require('path');
const Boundary=require('../scripts/prepare-production-index.js');

const root=path.join(__dirname,'..');
const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
const production=Boundary.stripPrivateRoutingScripts(html);

for(const asset of Boundary.PRIVATE_ROUTING_BROWSER_MODULES){
  assert.ok(html.includes('./'+asset),'local browser entrypoint should keep '+asset);
  assert.ok(!production.includes('./'+asset),'production entrypoint must omit '+asset);
}

for(const required of [
  './js/netwizard-config-pipeline.js',
  './js/netwizard-firewall-edge-generator.js',
  './js/netwizard-runtime.js'
]){
  assert.ok(production.includes(required),'production entrypoint must preserve '+required);
}

const docker=fs.readFileSync(path.join(root,'Dockerfile'),'utf8');
for(const asset of Boundary.PRIVATE_ROUTING_BROWSER_MODULES){
  const base=path.basename(asset);
  assert.ok(docker.includes(base),'Docker boundary must explicitly guard '+base);
}

console.log('✓ El frontend de producción excluye los generadores de routing privados');
