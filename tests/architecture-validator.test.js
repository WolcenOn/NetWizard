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

test('Architecture validator bloquea direcciones IP duplicadas entre interfaces', () => {
  const project = {
    devices:[
      {id:'fw1', name:'FW-EDGE-HQ', type:'firewall'},
      {id:'r1', name:'RTR-HQ-CORE', type:'router'}
    ],
    ports:[
      {id:'fw-wan', deviceId:'fw1', name:'wan1', mode:'routed', l3Cidr:'203.0.113.2/30'},
      {id:'r-wan', deviceId:'r1', name:'GigabitEthernet0/0', mode:'routed', l3Ip:'203.0.113.2'}
    ],
    links:[]
  };
  const report = ArchitectureValidator.validate(project);
  const issue = report.issues.find(item => item.code === 'NW-IP-001');
  assert.ok(issue);
  assert.strictEqual(issue.blocking, true);
  assert.ok(issue.message.includes('203.0.113.2'));
  assert.ok(issue.message.includes('FW-EDGE-HQ / wan1'));
  assert.ok(issue.message.includes('RTR-HQ-CORE / GigabitEthernet0/0'));
  assert.ok(issue.suggestions[0].steps.length >= 3);
});

test('Architecture validator avisa cuando existen varios bordes de Internet', () => {
  const project = {
    devices:[
      {id:'fw1', name:'FW-EDGE-HQ', type:'firewall', internetEdge:'yes'},
      {id:'r1', name:'RTR-HQ-CORE', type:'router', internetEdge:'yes'}
    ],
    ports:[],
    links:[]
  };
  const report = ArchitectureValidator.validate(project);
  const issue = report.issues.find(item => item.code === 'NW-ARCH-002');
  assert.ok(issue);
  assert.strictEqual(issue.severity, 'warning');
  assert.strictEqual(issue.blocking, false);
  assert.ok(issue.why.includes('alta disponibilidad'));
  assert.strictEqual(issue.suggestions.length, 2);
});

test('Architecture validator acepta un único borde de Internet', () => {
  const project = {
    devices:[
      {id:'fw1', name:'FW-EDGE-HQ', type:'firewall', internetEdge:'yes'},
      {id:'r1', name:'RTR-HQ-CORE', type:'router', internetEdge:'no'}
    ],
    ports:[],
    links:[]
  };
  const report = ArchitectureValidator.validate(project);
  assert.strictEqual(report.issues.some(item => item.code === 'NW-ARCH-002'), false);
});

console.log('\nTests architecture validator completados.');
