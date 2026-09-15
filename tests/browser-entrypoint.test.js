'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const scripts = Array.from(html.matchAll(/<script\s+[^>]*src=["']\.\/(js\/[^"']+)["'][^>]*><\/script>/g), match => match[1]);
const required = [
  'js/netwizard-device-model.js',
  'js/netwizard.js',
  'js/netwizard-config-pipeline.js',
  'js/netwizard-vendor-config-generators.js',
  'js/netwizard-architecture-validator.js',
  'js/netwizard-routing-plan.js',
  'js/netwizard-capability-registry.js',
  'js/netwizard-physical-inventory.js',
  'js/netwizard-resilience-topology.js',
  'js/netwizard-wan-circuits.js',
  'js/netwizard-traffic-capacity.js',
  'js/netwizard-internal-services.js',
  'js/netwizard-wifi-planning.js',
  'js/netwizard-ipv6-vrf.js',
  'js/netwizard-failure-simulation.js',
  'js/netwizard-observed-drift.js',
  'js/netwizard-cisco-routing-generator.js',
  'js/netwizard-multivendor-routing-generator.js',
  'js/netwizard-firewall-edge-generator.js',
  'js/netwizard-switching-generator.js',
  'js/netwizard-access-security-generator.js',
  'js/netwizard-management-generator.js',
  'js/netwizard-ha-services-generator.js',
  'js/netwizard-cisco-routing-integration.js',
  'js/netwizard-multivendor-routing-integration.js',
  'js/netwizard-firewall-edge-integration.js',
  'js/netwizard-switching-integration.js',
  'js/netwizard-access-security-integration.js',
  'js/netwizard-management-integration.js',
  'js/netwizard-ha-services-integration.js',
  'js/netwizard-production-gate-architecture.js',
  'js/netwizard-runtime.js'
];

for(const script of required){
  assert.ok(scripts.includes(script), `index.html no carga ${script}`);
  assert.ok(fs.existsSync(path.join(root, script)), `No existe ${script}`);
}

const duplicates = scripts.filter((script, index) => scripts.indexOf(script) !== index);
assert.deepStrictEqual(duplicates, [], `Scripts duplicados en index.html: ${duplicates.join(', ')}`);

function before(first, second){
  assert.ok(scripts.indexOf(first) < scripts.indexOf(second), `${first} debe cargarse antes que ${second}`);
}

before('js/netwizard-device-model.js', 'js/netwizard-project-schema.js');
before('js/netwizard-project-schema.js', 'js/netwizard.js');
before('js/netwizard.js', 'js/netwizard-vendor-config-generators.js');
before('js/netwizard.js', 'js/netwizard-config-pipeline.js');
before('js/netwizard-config-pipeline.js', 'js/netwizard-vendor-config-generators.js');
before('js/netwizard-vendor-config-generators.js', 'js/netwizard-cisco-routing-integration.js');
before('js/netwizard-routing-plan.js', 'js/netwizard-cisco-routing-generator.js');
before('js/netwizard-cisco-routing-generator.js', 'js/netwizard-cisco-routing-integration.js');
before('js/netwizard-architecture-validator.js', 'js/netwizard-production-gate-architecture.js');
before('js/netwizard-production-gate-architecture.js', 'js/netwizard-runtime.js');

const architectureSource = fs.readFileSync(path.join(root, 'js/netwizard-production-gate-architecture.js'), 'utf8');
assert.ok(architectureSource.includes("['NetWizardArchitectureValidator','./js/netwizard-architecture-validator.js'"), 'El fallback dinámico debe incluir ArchitectureValidator');
const connectivitySource = fs.readFileSync(path.join(root, 'js/netwizard-connectivity-checker.js'), 'utf8');
assert.ok(!connectivitySource.includes("createElement('script')"), 'Connectivity Checker no debe alterar el grafo de scripts del entrypoint');

console.log('✓ El entrypoint del navegador carga una sola vez el runtime funcional en orden determinista');
