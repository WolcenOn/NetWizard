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
  deployment:{changeTicket:' CHG-42\u0000 ',requireExecutableIncremental:true,devices:{r1:{phase:'core',dependsOnDeviceRefs:['edge\u0000']}}}
});

assert.strictEqual(prepared.ok, true);
assert.deepStrictEqual(prepared.project.wanCircuits, []);
assert.strictEqual(prepared.project.vrfs[0].name, 'Corp\nVRF');
assert.strictEqual(prepared.project.routing.strategy, 'ospf');
assert.deepStrictEqual(prepared.project.routing.siteToSiteVpns, []);
assert.strictEqual(prepared.project.routing.bgp.neighbors[0].description, 'Peer externo');
assert.strictEqual(prepared.project.management.syslog.servers[0], 'logs.example.test');
assert.strictEqual(prepared.project.deployment.changeTicket, 'CHG-42');
assert.strictEqual(prepared.project.deployment.devices.r1.dependsOnDeviceRefs[0], 'edge');
assert.strictEqual(prepared.project.deployment.requireExecutableIncremental, true);

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

const vpnSchema = schema.prepareImport({
  devices:[
    {id:'r1',name:'R1',kind:'router',type:'router',vendorOs:'cisco_ios'},
    {id:'r2',name:'R2',kind:'router',type:'router',vendorOs:'cisco_ios'}
  ],
  ports:[
    {id:'p1',deviceId:'r1',name:'Gi0/0'},
    {id:'p2',deviceId:'r2',name:'Gi0/0'}
  ],
  vlans:[],subnets:[],hosts:[],links:[],fwRules:[],
  wanCircuits:[
    {id:'c1',deviceId:'r1',portId:'p1'},
    {id:'c2',deviceId:'r2',portId:'p2'}
  ],
  routing:{siteToSiteVpns:[{
    id:'vpn1',localDeviceId:'r1',remoteDeviceId:'r2',
    localCircuitRef:'c1',remoteCircuitRef:'c2',
    localPrefixes:['10.10.0.0/24'],remotePrefixes:['10.20.0.0/24'],
    secretAlias:'VPN_TEST_PSK'
  }]}
});
assert.strictEqual(vpnSchema.ok,true,vpnSchema.errors.join('\n'));
assert.strictEqual(vpnSchema.project.routing.siteToSiteVpns.length,1);
assert.strictEqual(vpnSchema.project.routing.siteToSiteVpns[0].secretAlias,'VPN_TEST_PSK');

const vpnRawSecret = schema.prepareImport({
  devices:[],ports:[],vlans:[],subnets:[],hosts:[],links:[],fwRules:[],
  routing:{siteToSiteVpns:[{id:'vpn-secret',psk:'do-not-store'}]}
});
assert.strictEqual(vpnRawSecret.ok,false);
assert.ok(vpnRawSecret.errors.some(message=>/no se permite persistir PSK\/password/.test(message)));

const brokenDeviceRef = schema.prepareImport({
  devices:[],ports:[],vlans:[{id:'v1',vlanId:1,name:'LAN'}],subnets:[],
  hosts:[{id:'h1',name:'Host',type:'pc',vlanRef:'v1',deviceRef:'missing'}],links:[],fwRules:[]
});
assert.strictEqual(brokenDeviceRef.ok, false);
assert.ok(brokenDeviceRef.errors.some(message=>message.includes('deviceRef inexistente')));

const generatedId = schema.prepareImport({devices:[],ports:[],vlans:[],subnets:[],hosts:[],links:[],fwRules:[],wanCircuits:[{name:'WAN'}]});
assert.strictEqual(generatedId.project.wanCircuits[0].id, 'wanCircuits_1');

const physical = schema.prepareImport({
  devices:[{id:' sw 1 ',name:'SW',type:'switch',rackId:' rack 1 ',rackUnit:'10',rackUnits:'1',weightKg:'8.5',powerDrawWatts:'120'}],
  ports:[],vlans:[{id:'v10',vlanId:10,name:'LAN'}],
  subnets:[{id:'sn10',vlanRef:'v10',cidr:'10.0.0.0/24',gateway:'10.0.0.1',gatewayDeviceRef:' fw 1 '}],
  hosts:[{id:'h1',name:'PC',type:'pc',vlanRef:'v10',locationId:' office 1 '}],links:[],fwRules:[],
  racks:[{id:' rack 1 ',name:'Rack',locationId:' cpd 1 ',rackUnits:'24',powerCapacityWatts:'2500'}],
  rackItems:[{id:' item 1 ',rackId:' rack 1 ',type:'shelf',startUnit:'4',heightUnits:'1'}],
  pdus:[{id:' pdu 1 ',rackId:' rack 1 ',outletCount:'12',maxPowerWatts:'3680'}],
  powerConnections:[{id:' power 1 ',deviceId:' sw 1 ',pduId:' pdu 1 ',outlet:'2',powerSupplyIndex:'0'}]
});
assert.strictEqual(physical.ok,true);
assert.strictEqual(physical.project.racks[0].id,'rack_1');
assert.strictEqual(physical.project.racks[0].locationId,'cpd_1');
assert.strictEqual(physical.project.racks[0].rackUnits,24);
assert.strictEqual(physical.project.racks[0].powerCapacityWatts,2500);
assert.strictEqual(physical.project.rackItems[0].rackId,'rack_1');
assert.strictEqual(physical.project.pdus[0].outletCount,12);
assert.strictEqual(physical.project.powerConnections[0].deviceId,'sw_1');
assert.strictEqual(physical.project.devices[0].rackId,'rack_1');
assert.strictEqual(physical.project.devices[0].rackUnit,10);
assert.strictEqual(physical.project.hosts[0].locationId,'office_1');
assert.strictEqual(physical.project.subnets[0].gatewayDeviceRef,'fw_1');

const malformedPhysical = schema.prepareImport({
  devices:[],ports:[],vlans:[],subnets:[],hosts:[],links:[],fwRules:[],
  racks:{bad:true},rackItems:'bad',pdus:{},powerConnections:42
});
assert.deepStrictEqual(malformedPhysical.project.racks,[]);
assert.deepStrictEqual(malformedPhysical.project.rackItems,[]);
assert.deepStrictEqual(malformedPhysical.project.pdus,[]);
assert.deepStrictEqual(malformedPhysical.project.powerConnections,[]);

console.log('✓ Schema 3.50 normaliza y sanea las ramas avanzadas sin romper compatibilidad');
