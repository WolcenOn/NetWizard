'use strict';

const assert = require('assert');
require('../js/netwizard-network-utils.js');
require('../js/netwizard-l3-config-utils.js');
require('../js/netwizard-routing-utils.js');
const RoutingPlan = require('../js/netwizard-routing-plan.js');
const Generator = require('../js/netwizard-multivendor-routing-generator.js');

function test(name, fn){
  try { fn(); console.log(`✓ ${name}`); }
  catch (err) { console.error(`✗ ${name}`); throw err; }
}

function project(strategy){
  return {
    routing: strategy === 'ospf'
      ? {protocol:'ospf', area:'0.0.0.0', processId:10, routerIds:{r1:'1.1.1.1', r2:'2.2.2.2'}}
      : {strategy:'static'},
    devices:[
      {id:'r1', name:'RTR-HQ', type:'router', vendorOs:'huawei_vrp', vlanGateway:'yes'},
      {id:'r2', name:'RTR-BRANCH', type:'router', vendorOs:'juniper_junos', vlanGateway:'yes'},
      {id:'r3', name:'RTR-MTK', type:'router', vendorOs:'mikrotik_routeros'}
    ],
    vlans:[{id:'v10', vlanId:10, name:'HQ Users'},{id:'v20', vlanId:20, name:'Branch Users'}],
    subnets:[
      {id:'s10', vlanRef:'v10', cidr:'10.10.10.0/24', gateway:'10.10.10.1', gatewayDeviceRef:'r1'},
      {id:'s20', vlanRef:'v20', cidr:'10.20.20.0/24', gateway:'10.20.20.1', gatewayDeviceRef:'r2'}
    ],
    ports:[
      {id:'r1-wan', deviceId:'r1', name:'GigabitEthernet0/0/0', mode:'routed', l3Ip:'172.16.0.1', l3Cidr:'172.16.0.1/30'},
      {id:'r2-wan', deviceId:'r2', name:'ge-0/0/0.0', mode:'routed', l3Ip:'172.16.0.2', l3Cidr:'172.16.0.2/30'},
      {id:'r2-mtk', deviceId:'r2', name:'ge-0/0/1.0', mode:'routed', l3Ip:'172.16.1.1', l3Cidr:'172.16.1.1/30'},
      {id:'r3-wan', deviceId:'r3', name:'ether1', mode:'routed', l3Ip:'172.16.1.2', l3Cidr:'172.16.1.2/30'}
    ],
    links:[
      {id:'wan1', aPortId:'r1-wan', bPortId:'r2-wan'},
      {id:'wan2', aPortId:'r2-mtk', bPortId:'r3-wan'}
    ],
    roas:{gwId:'r1'}
  };
}

test('Junos genera ruta estática desde el plan neutral', () => {
  const p = project('static');
  const plan = RoutingPlan.build(p);
  const out = Generator.render(p, 'r2', 'juniper_junos', plan);
  assert.ok(out.includes('set routing-options static route 10.10.10.0/24 next-hop 172.16.0.1'));
});

test('Huawei genera rutas y OSPF con router-id y wildcard', () => {
  const p = project('ospf');
  const plan = RoutingPlan.build(p);
  const out = Generator.render(p, 'r1', 'huawei_vrp', plan);
  assert.ok(out.includes('ospf 10 router-id 1.1.1.1'));
  assert.ok(out.includes('network 172.16.0.0 0.0.0.3'));
  assert.ok(out.includes('silent-interface all'));
  assert.ok(out.includes('undo silent-interface GigabitEthernet0/0/0'));
});

test('MikroTik RouterOS v7 genera instancia, área y templates OSPF', () => {
  const p = project('ospf');
  p.routing.routerIds.r3 = '3.3.3.3';
  const plan = RoutingPlan.build(p);
  const out = Generator.render(p, 'r3', 'mikrotik_routeros', plan);
  assert.ok(out.includes('/routing/ospf/instance/add name=nw-ospf-10 version=2 router-id=3.3.3.3'));
  assert.ok(out.includes('/routing/ospf/area/add name=nw-backbone instance=nw-ospf-10 area-id=0.0.0.0'));
  assert.ok(out.includes('networks=172.16.1.0/30 passive=no'));
});

test('La inserción multivendor es idempotente', () => {
  const p = project('static');
  const plan = RoutingPlan.build(p);
  const once = Generator.appendToConfig('system-view\nsave\n', p, 'r1', 'huawei_vrp', plan);
  const twice = Generator.appendToConfig(once, p, 'r1', 'huawei_vrp', plan);
  assert.strictEqual(once, twice);
  assert.strictEqual((once.match(/Routing generado desde plan neutral/g) || []).length, 1);
});

console.log('\nTests multivendor routing generator completados.');
