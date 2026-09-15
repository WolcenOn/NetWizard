'use strict';

const assert = require('assert');
const schema = require('../js/netwizard-project-schema.js');

const prepared = schema.prepareImport({
  projName:'Avanzado',
  devices:[], ports:[], vlans:[], subnets:[], hosts:[], links:[], fwRules:[], dhcp:{},
  iot:{accessNodes:[], devices:[], map:{}},
  wanCircuits:{invalid:true},
  vrfs:[{id:'vrf-1', name:'Corp\u0000\nVRF'}],
  routing:{strategy:'ospf\u0000', bgp:{neighbors:[{description:'Peer\u0007 externo'}]}},
  management:{syslog:{servers:['logs.example.test\u0000']}}
});

assert.strictEqual(prepared.ok, true);
assert.deepStrictEqual(prepared.project.wanCircuits, []);
assert.strictEqual(prepared.project.vrfs[0].name, 'Corp\nVRF');
assert.strictEqual(prepared.project.routing.strategy, 'ospf');
assert.strictEqual(prepared.project.routing.bgp.neighbors[0].description, 'Peer externo');
assert.strictEqual(prepared.project.management.syslog.servers[0], 'logs.example.test');

const exported = schema.prepareExport(prepared.project);
assert.ok(Array.isArray(exported.project.ipv6Networks));
assert.ok(Array.isArray(exported.project.failureScenarios));
assert.ok(exported.project.highAvailability && typeof exported.project.highAvailability === 'object');
assert.strictEqual(exported.project.observedState, null);
assert.strictEqual(exported.schemaVersion, '3.50.0');
assert.strictEqual(schema.model.version, '3.50.0');
assert.ok(schema.model.deviceKinds.includes('wlan_controller'));
assert.ok(schema.model.advancedArrays.includes('wanCircuits'));

const generatedId = schema.prepareImport({devices:[],ports:[],vlans:[],subnets:[],hosts:[],links:[],fwRules:[],wanCircuits:[{name:'WAN'}]});
assert.strictEqual(generatedId.project.wanCircuits[0].id, 'wanCircuits_1');

console.log('✓ Schema 3.50 normaliza y sanea las ramas avanzadas sin romper compatibilidad');
