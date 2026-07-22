'use strict';

const assert = require('assert');
require('../js/netwizard-network-utils.js');
require('../js/netwizard-l3-config-utils.js');
require('../js/netwizard-routing-utils.js');
const RoutingPlan = require('../js/netwizard-routing-plan.js');
const CiscoRouting = require('../js/netwizard-cisco-routing-generator.js');

function test(name, fn){
  try { fn(); console.log(`✓ ${name}`); }
  catch (err) { console.error(`✗ ${name}`); throw err; }
}

function project(strategy){
  return {
    routing: strategy === 'ospf' ? {protocol:'ospf', area:'0', processId:10, routerIds:{r1:'1.1.1.1',r2:'2.2.2.2'}} : {strategy:'static'},
    devices:[
      {id:'r1',name:'RTR-HQ',type:'router',vendorOs:'cisco_ios'},
      {id:'r2',name:'RTR-BRANCH',type:'router',vendorOs:'cisco_ios'}
    ],
    vlans:[{id:'v10',vlanId:10,name:'HQ'},{id:'v20',vlanId:20,name:'Branch'}],
    subnets:[
      {id:'s10',vlanRef:'v10',cidr:'10.10.10.0/24',gateway:'10.10.10.1',gatewayDeviceRef:'r1'},
      {id:'s20',vlanRef:'v20',cidr:'10.20.20.0/24',gateway:'10.20.20.1',gatewayDeviceRef:'r2'}
    ],
    ports:[
      {id:'r1-wan',deviceId:'r1',name:'GigabitEthernet0/0',mode:'routed',l3Ip:'172.16.0.1',l3Cidr:'172.16.0.1/30'},
      {id:'r2-wan',deviceId:'r2',name:'GigabitEthernet0/0',mode:'routed',l3Ip:'172.16.0.2',l3Cidr:'172.16.0.2/30'}
    ],
    links:[{id:'wan',aPortId:'r1-wan',bPortId:'r2-wan'}]
  };
}

test('Cisco IOS traduce rutas estáticas del plan neutral', () => {
  const p = project('static');
  const plan = RoutingPlan.build(p);
  const cli = CiscoRouting.render(p, 'r1', plan);
  assert.ok(cli.includes('ip route 10.20.20.0 255.255.255.0 172.16.0.2'));
});

test('Cisco IOS traduce OSPF con router-id, network y wildcard', () => {
  const p = project('ospf');
  const plan = RoutingPlan.build(p);
  const cli = CiscoRouting.render(p, 'r1', plan);
  assert.ok(cli.includes('router ospf 10'));
  assert.ok(cli.includes('router-id 1.1.1.1'));
  assert.ok(cli.includes('network 172.16.0.0 0.0.0.3 area 0'));
  assert.ok(cli.includes('network 10.10.10.0 0.0.0.255 area 0'));
  assert.ok(cli.includes('passive-interface default'));
});

test('Cisco IOS inserta routing antes de end sin duplicarlo', () => {
  const p = project('static');
  const once = CiscoRouting.appendToConfig('configure terminal\nend\n', p, 'r1');
  const twice = CiscoRouting.appendToConfig(once, p, 'r1');
  assert.ok(once.indexOf('ip route') < once.indexOf('\nend'));
  assert.strictEqual((twice.match(/Routing generado desde plan neutral/g) || []).length, 1);
});

console.log('\nTests Cisco routing generator completados.');
