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
  management:{syslog:{servers:['logs.example.test\u0000']}},
  deployment:{changeTicket:' CHG-42\u0000 ',devices:{r1:{phase:'core',dependsOnDeviceRefs:['edge\u0000']}}}
});

assert.strictEqual(prepared.ok, true);
assert.deepStrictEqual(prepared.project.wanCircuits, []);
assert.strictEqual(prepared.project.vrfs[0].name, 'Corp\nVRF');
assert.strictEqual(prepared.project.routing.strategy, 'ospf');
assert.strictEqual(prepared.project.routing.bgp.neighbors[0].description, 'Peer externo');
assert.strictEqual(prepared.project.management.syslog.servers[0], 'logs.example.test');
assert.strictEqual(prepared.project.deployment.changeTicket, 'CHG-42');
assert.strictEqual(prepared.project.deployment.devices.r1.dependsOnDeviceRefs[0], 'edge');

const exported = schema.prepareExport(prepared.project);
assert.ok(Array.isArray(exported.project.ipv6Networks));
assert.ok(Array.isArray(exported.project.failureScenarios));
assert.ok(exported.project.highAvailability && typeof exported.project.highAvailability === 'object');
assert.strictEqual(exported.project.observedState, null);
assert.strictEqual(exported.schemaVersion, '3.50.0');
assert.strictEqual(schema.model.version, '3.50.0');
assert.ok(schema.model.deviceKinds.includes('wlan_controller'));
assert.ok(schema.model.advancedArrays.includes('wanCircuits'));
assert.ok(schema.model.advancedObjects.includes('deployment'));

const observedConfig = 'interface Ethernet1\n description snapshot\n'.repeat(40);
const observed = schema.prepareImport({
  devices:[{id:'sw1',name:'SW1',kind:'switch',type:'switch',vendorOs:'cisco_ios'}],ports:[],vlans:[],subnets:[],hosts:[],links:[],fwRules:[],
  observedState:{observedAt:'2026-09-16T10:00:00Z',deviceConfigs:{sw1:{vendor:'cisco_ios',source:'manual',content:observedConfig}}},
  deployment:{changeMode:'incremental',maxObservedAgeHours:24}
});
assert.strictEqual(observed.ok,true);
assert.strictEqual(observed.project.observedState.deviceConfigs.sw1.content,observedConfig);
assert.strictEqual(observed.project.observedState.deviceConfigs.sw1.capturedAt,'2026-09-16T10:00:00Z');
assert.strictEqual(observed.project.observedState.deviceConfigs.sw1.contentTruncated,false);
assert.strictEqual(observed.project.deployment.changeMode,'incremental');

const oversized = schema.prepareImport({devices:[],ports:[],vlans:[],subnets:[],hosts:[],links:[],fwRules:[],observedState:{deviceConfigs:{sw1:{content:'x'.repeat(262145)}}}});
assert.strictEqual(oversized.project.observedState.deviceConfigs.sw1.content.length,262144);
assert.strictEqual(oversized.project.observedState.deviceConfigs.sw1.contentTruncated,true);

const legacyDevices = schema.prepareImport({
  devices:[
    {id:'legacy-ap',name:'AP antiguo',type:'switch',wifiRole:'ap',vendorOs:'ubiquiti_unifi'},
    {id:'legacy-server',name:'Servidor antiguo',type:'servidor',vendorOs:'linux'}
  ],
  ports:[],vlans:[{id:'v99',vlanId:99,name:'Gestión'}],subnets:[],
  hosts:[{id:'h-ap',name:'Gestión AP',type:'ap',vlanRef:'v99',deviceRef:'legacy-ap'}],
  links:[],fwRules:[]
});
assert.strictEqual(legacyDevices.project.devices[0].kind, 'access_point');
assert.strictEqual(legacyDevices.project.devices[0].type, 'access_point');
assert.strictEqual(legacyDevices.project.devices[1].kind, 'server');
assert.strictEqual(legacyDevices.project.hosts[0].deviceRef, 'legacy-ap');
assert.strictEqual(legacyDevices.ok, true);

const brokenDeviceRef = schema.prepareImport({
  devices:[],ports:[],vlans:[{id:'v1',vlanId:1,name:'LAN'}],subnets:[],
  hosts:[{id:'h1',name:'Host',type:'pc',vlanRef:'v1',deviceRef:'missing'}],links:[],fwRules:[]
});
assert.strictEqual(brokenDeviceRef.ok, false);
assert.ok(brokenDeviceRef.errors.some(message=>message.includes('deviceRef inexistente')));

const generatedId = schema.prepareImport({devices:[],ports:[],vlans:[],subnets:[],hosts:[],links:[],fwRules:[],wanCircuits:[{name:'WAN'}]});
assert.strictEqual(generatedId.project.wanCircuits[0].id, 'wanCircuits_1');

console.log('✓ Schema 3.50 normaliza y sanea las ramas avanzadas sin romper compatibilidad');
