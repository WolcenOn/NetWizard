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

function routedHubProject(){
  return {
    devices:[
      {id:'hq', name:'RTR-HQ', type:'router'},
      {id:'mad', name:'RTR-MAD', type:'router'},
      {id:'bcn', name:'RTR-BCN', type:'router'},
      {id:'sev', name:'RTR-SEV', type:'router'}
    ],
    ports:[
      {id:'hq-mad', deviceId:'hq', name:'Gi0/1', mode:'routed', l3Cidr:'172.16.1.1/30'},
      {id:'mad-hq', deviceId:'mad', name:'Gi0/0', mode:'routed', l3Cidr:'172.16.1.2/30'},
      {id:'hq-bcn', deviceId:'hq', name:'Gi0/2', mode:'routed', l3Cidr:'172.16.2.1/30'},
      {id:'bcn-hq', deviceId:'bcn', name:'ether1', mode:'routed', l3Cidr:'172.16.2.2/30'},
      {id:'hq-sev', deviceId:'hq', name:'Gi0/3', mode:'routed', l3Cidr:'172.16.3.1/30'},
      {id:'sev-hq', deviceId:'sev', name:'Gi0/0', mode:'routed', l3Cidr:'172.16.3.2/30'}
    ],
    links:[
      {id:'l-mad', aPortId:'hq-mad', bPortId:'mad-hq'},
      {id:'l-bcn', aPortId:'hq-bcn', bPortId:'bcn-hq'},
      {id:'l-sev', aPortId:'hq-sev', bPortId:'sev-hq'}
    ]
  };
}

test('Architecture validator bloquea un enlace trunk contra routed con explicación', () => {
  const report = ArchitectureValidator.validate(baseProject());
  const issue = report.issues.find(item => item.code === 'NW-LINK-001');
  assert.ok(issue);
  assert.strictEqual(issue.severity, 'error');
  assert.strictEqual(issue.blocking, true);
  assert.ok(issue.message.includes('FW-EDGE-HQ / internal1'));
  assert.ok(issue.message.includes('RTR-HQ-CORE / GigabitEthernet0/0'));
  assert.ok(issue.why.includes('802.1Q'));
  assert.ok(issue.impact.length > 20);
  assert.strictEqual(issue.suggestions.length, 2);
});

test('Architecture validator acepta enlaces trunk-trunk y routed-routed', () => {
  const trunkProject = baseProject();
  trunkProject.ports[1].mode = 'trunk';
  delete trunkProject.ports[1].l3Ip;
  delete trunkProject.ports[1].l3Cidr;
  assert.strictEqual(ArchitectureValidator.validate(trunkProject).issues.some(i => i.code === 'NW-LINK-001'), false);

  const routedProject = baseProject();
  routedProject.ports[0].mode = 'routed';
  routedProject.ports[0].l3Ip = '172.16.0.1';
  routedProject.ports[0].l3Cidr = '172.16.0.1/30';
  routedProject.ports[0].allowedVlans = [];
  assert.strictEqual(ArchitectureValidator.validate(routedProject).issues.some(i => i.code === 'NW-LINK-001'), false);
});

test('Architecture validator ignora temporalmente enlaces con referencias incompletas', () => {
  const project = baseProject();
  project.links = [{id:'broken-link', aPortId:'fw-inside', bPortId:'missing'}];
  const report = ArchitectureValidator.validate(project);
  assert.strictEqual(report.issues.length, 0);
});

test('Architecture validator bloquea direcciones IP duplicadas entre interfaces', () => {
  const project = {
    devices:[{id:'fw1', name:'FW-EDGE-HQ', type:'firewall'}, {id:'r1', name:'RTR-HQ-CORE', type:'router'}],
    ports:[
      {id:'fw-wan', deviceId:'fw1', name:'wan1', mode:'routed', l3Cidr:'203.0.113.2/30'},
      {id:'r-wan', deviceId:'r1', name:'GigabitEthernet0/0', mode:'routed', l3Ip:'203.0.113.2'}
    ], links:[]
  };
  const issue = ArchitectureValidator.validate(project).issues.find(item => item.code === 'NW-IP-001');
  assert.ok(issue);
  assert.strictEqual(issue.blocking, true);
  assert.ok(issue.message.includes('203.0.113.2'));
});

test('Architecture validator avisa cuando existen varios bordes de Internet', () => {
  const project = {
    devices:[
      {id:'fw1', name:'FW-EDGE-HQ', type:'firewall', internetEdge:'yes'},
      {id:'r1', name:'RTR-HQ-CORE', type:'router', internetEdge:'yes'}
    ], ports:[], links:[]
  };
  const issue = ArchitectureValidator.validate(project).issues.find(item => item.code === 'NW-ARCH-002');
  assert.ok(issue);
  assert.strictEqual(issue.severity, 'warning');
  assert.strictEqual(issue.blocking, false);
});

test('Architecture validator bloquea topología multisede sin estrategia de routing', () => {
  const project = routedHubProject();
  const report = ArchitectureValidator.validate(project);
  const issue = report.issues.find(item => item.code === 'NW-ROUTE-001');
  assert.ok(issue);
  assert.strictEqual(issue.blocking, true);
  assert.ok(issue.message.includes('4 equipos L3'));
  assert.ok(issue.why.includes('vecino directo'));
  assert.strictEqual(issue.suggestions.length, 2);
});

test('Architecture validator acepta OSPF o rutas estáticas declaradas', () => {
  const ospf = routedHubProject();
  ospf.routing = {protocol:'ospf'};
  assert.strictEqual(ArchitectureValidator.validate(ospf).issues.some(i => i.code === 'NW-ROUTE-001'), false);

  const staticProject = routedHubProject();
  staticProject.routing = {strategy:'static'};
  assert.strictEqual(ArchitectureValidator.validate(staticProject).issues.some(i => i.code === 'NW-ROUTE-001'), false);
});

test('Architecture validator detecta punto único de fallo en hub L3', () => {
  const project = routedHubProject();
  project.routing = {protocol:'ospf'};
  const issue = ArchitectureValidator.validate(project).issues.find(item => item.code === 'NW-HA-001');
  assert.ok(issue);
  assert.strictEqual(issue.severity, 'warning');
  assert.ok(issue.message.includes('RTR-HQ'));
  assert.ok(issue.impact.includes('mantenimiento'));
});

test('Architecture validator no marca SPOF cuando existe camino alternativo', () => {
  const project = routedHubProject();
  project.routing = {protocol:'ospf'};
  project.ports.push(
    {id:'mad-bcn', deviceId:'mad', name:'Gi0/1', mode:'routed', l3Cidr:'172.16.4.1/30'},
    {id:'bcn-mad', deviceId:'bcn', name:'ether2', mode:'routed', l3Cidr:'172.16.4.2/30'}
  );
  project.links.push({id:'l-backup', aPortId:'mad-bcn', bPortId:'bcn-mad'});
  assert.strictEqual(ArchitectureValidator.validate(project).issues.some(i => i.code === 'NW-HA-001'), false);
});

console.log('\nTests architecture validator completados.');
