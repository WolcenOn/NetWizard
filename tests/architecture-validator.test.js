'use strict';

const assert = require('assert');
const ArchitectureValidator = require('../js/netwizard-architecture-validator.js');

function test(name, fn){
  try { fn(); console.log(`✓ ${name}`); }
  catch (err) { console.error(`✗ ${name}`); throw err; }
}

function baseProject(){
  return {
    devices:[
      {id:'fw1', name:'FW-EDGE-HQ', type:'firewall'},
      {id:'r1', name:'RTR-HQ-CORE', type:'router'}
    ],
    ports:[
      {id:'fw-inside', deviceId:'fw1', name:'internal1', mode:'trunk', allowedVlans:[10,20,99]},
      {id:'r-wan', deviceId:'r1', name:'GigabitEthernet0/0', mode:'routed', l3Ip:'172.16.0.2', l3Cidr:'172.16.0.2/30'}
    ],
    links:[{id:'link-fw-router', aPortId:'fw-inside', bPortId:'r-wan'}]
  };
}

test('Architecture validator bloquea un enlace trunk contra routed con explicación', () => {
  const report = ArchitectureValidator.validate(baseProject());
  assert.strictEqual(report.ok, false);
  assert.strictEqual(report.issues.length, 1);
  const issue = report.issues[0];
  assert.strictEqual(issue.code, 'NW-LINK-001');
  assert.strictEqual(issue.severity, 'error');
  assert.strictEqual(issue.blocking, true);
  assert.ok(issue.message.includes('FW-EDGE-HQ / internal1'));
  assert.ok(issue.message.includes('RTR-HQ-CORE / GigabitEthernet0/0'));
  assert.ok(issue.why.includes('802.1Q'));
  assert.ok(issue.impact.length > 20);
  assert.strictEqual(issue.suggestions.length, 2);
  assert.ok(issue.suggestions[0].steps.length >= 3);
});

test('Architecture validator acepta enlaces trunk-trunk y routed-routed', () => {
  const trunkProject = baseProject();
  trunkProject.ports[1].mode = 'trunk';
  delete trunkProject.ports[1].l3Ip;
  delete trunkProject.ports[1].l3Cidr;
  assert.strictEqual(ArchitectureValidator.validate(trunkProject).ok, true);

  const routedProject = baseProject();
  routedProject.ports[0].mode = 'routed';
  routedProject.ports[0].l3Ip = '172.16.0.1';
  routedProject.ports[0].l3Cidr = '172.16.0.1/30';
  routedProject.ports[0].allowedVlans = [];
  assert.strictEqual(ArchitectureValidator.validate(routedProject).ok, true);
});

test('Architecture validator ignora temporalmente enlaces con referencias incompletas', () => {
  const project = baseProject();
  project.links = [{id:'broken-link', aPortId:'fw-inside', bPortId:'missing'}];
  const report = ArchitectureValidator.validate(project);
  assert.strictEqual(report.ok, true);
  assert.strictEqual(report.issues.length, 0);
});

console.log('\nTests architecture validator completados.');
