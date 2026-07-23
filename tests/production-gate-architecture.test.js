'use strict';

const assert = require('assert');
require('../js/netwizard-audit.js');
require('../js/netwizard-architecture-validator.js');
const BaseGate = require('../js/netwizard-production-gate.js');
const Extension = require('../js/netwizard-production-gate-architecture.js');

function test(name, fn){
  try { fn(); console.log(`✓ ${name}`); }
  catch (err) { console.error(`✗ ${name}`); throw err; }
}

function projectWithMixedLink(){
  return {
    devices:[
      {id:'fw1', name:'FW-EDGE-HQ', type:'firewall'},
      {id:'r1', name:'RTR-HQ-CORE', type:'router'}
    ],
    ports:[
      {id:'fw-inside', deviceId:'fw1', name:'internal1', mode:'trunk', allowedVlans:[10,20,99]},
      {id:'r-wan', deviceId:'r1', name:'GigabitEthernet0/0', mode:'routed', l3Ip:'172.16.0.2', l3Cidr:'172.16.0.2/30'}
    ],
    links:[{id:'link-fw-router', aPortId:'fw-inside', bPortId:'r-wan'}],
    vlans:[], subnets:[], hosts:[], fwRules:[], dhcp:{}, vlanMatrix:{}, iot:{accessNodes:[],devices:[],map:{show:{}}}
  };
}

test('La extensión integra NW-LINK-001 y bloquea producción', () => {
  Extension.install();
  const report = BaseGate.runProductionGate(projectWithMixedLink(), {productionMode:true, strict:true});
  assert.strictEqual(report.status, 'blocked');
  assert.strictEqual(report.canExport, false);
  assert.ok(report.counts.blocking > 0);
  const issue = report.issues.find(i => i.code === 'NW-LINK-001');
  assert.ok(issue);
  assert.strictEqual(issue.blocking, true);
  assert.ok(issue.why.includes('802.1Q'));
  assert.ok(issue.suggestions.length >= 2);
});

test('La extensión conserva un proyecto arquitectónicamente coherente', () => {
  const project = projectWithMixedLink();
  project.ports[0].mode = 'routed';
  project.ports[0].l3Ip = '172.16.0.1';
  project.ports[0].l3Cidr = '172.16.0.1/30';
  project.ports[0].allowedVlans = [];
  const report = BaseGate.runProductionGate(project, {productionMode:false, strict:true});
  assert.ok(!report.issues.some(i => i.code === 'NW-LINK-001'));
});

console.log('\nTests production gate architecture completados.');
