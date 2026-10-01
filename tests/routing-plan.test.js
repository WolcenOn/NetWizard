'use strict';

const assert = require('assert');
require('../js/netwizard-network-utils.js');
require('../js/netwizard-l3-config-utils.js');
require('../js/netwizard-routing-utils.js');
const RoutingPlan = require('../js/netwizard-routing-plan.js');

function test(name, fn){
  try { fn(); console.log(`✓ ${name}`); }
  catch (err) { console.error(`✗ ${name}`); throw err; }
}

function project(strategy){
  return {
    routing: strategy === 'ospf' ? {protocol:'ospf', area:'0', processId:10, routerIds:{r1:'1.1.1.1', r2:'2.2.2.2'}} : {strategy:'static'},
    devices:[
      {id:'r1', name:'RTR-HQ', type:'router', vendorOs:'cisco_ios', vlanGateway:'yes'},
      {id:'r2', name:'RTR-BRANCH', type:'router', vendorOs:'juniper_junos', vlanGateway:'yes'}
    ],
    vlans:[
      {id:'v10', vlanId:10, name:'HQ Users'},
      {id:'v20', vlanId:20, name:'Branch Users'}
    ],
    subnets:[
      {id:'s10', vlanRef:'v10', cidr:'10.10.10.0/24', gateway:'10.10.10.1', gatewayDeviceRef:'r1'},
      {id:'s20', vlanRef:'v20', cidr:'10.20.20.0/24', gateway:'10.20.20.1', gatewayDeviceRef:'r2'}
    ],
    ports:[
      {id:'r1-wan', deviceId:'r1', name:'Gi0/0', mode:'routed', l3Ip:'172.16.0.1', l3Cidr:'172.16.0.1/30'},
      {id:'r2-wan', deviceId:'r2', name:'ge-0/0/0', mode:'routed', l3Ip:'172.16.0.2', l3Cidr:'172.16.0.2/30'}
    ],
    links:[{id:'wan', aPortId:'r1-wan', bPortId:'r2-wan'}],
    roas:{gwId:'r1'}
  };
}

test('Routing plan estático devuelve planes neutrales y next-hop del vecino', () => {
  const plan = RoutingPlan.build(project('static'));
  assert.strictEqual(plan.strategy, 'static');
  assert.strictEqual(plan.devices.length, 2);
  const hq = plan.devices.find(item => item.deviceId === 'r1');
  assert.ok(hq.interfaces.some(item => item.ip === '172.16.0.1'));
  assert.ok(hq.staticRoutes.some(route => route.destination === '10.20.20.0/24' && route.nextHop === '172.16.0.2'));
});

test('Routing estático explícito tiene prioridad sobre la inferencia y conserva distancia', () => {
  const p = project('static');
  p.routing.staticRoutesByDevice={
    r1:[{id:'rt-explicit',destination:'10.20.20.0/24',nextHop:'172.16.0.2',distance:5,description:'Branch explícita'}]
  };
  const plan=RoutingPlan.build(p),hq=plan.devices.find(item=>item.deviceId==='r1');
  const routes=hq.staticRoutes.filter(route=>route.destination==='10.20.20.0/24');
  assert.strictEqual(routes.length,1);
  assert.strictEqual(routes[0].source,'explicit');
  assert.strictEqual(routes[0].distance,5);
  assert.strictEqual(routes[0].outPortName,'Gi0/0');
  assert.deepStrictEqual(hq.staticRouteIssues,[]);
});

test('Routing estático explícito rechaza next-hop no directamente conectado', () => {
  const p = project('static');
  p.routing.staticRoutesByDevice={
    r1:[{id:'rt-bad',destination:'10.99.0.0/24',nextHop:'203.0.113.1',distance:1}]
  };
  const plan=RoutingPlan.build(p),hq=plan.devices.find(item=>item.deviceId==='r1');
  assert.ok(hq.staticRouteIssues.some(issue=>issue.code==='NW-ROUTE-STATIC-006'));
  assert.strictEqual(hq.staticRoutes.some(route=>route.destination==='10.99.0.0/24'),false);
});

test('Routing plan OSPF conserva intención, router-id y redes neutrales', () => {
  const plan = RoutingPlan.build(project('ospf'));
  const hq = plan.devices.find(item => item.deviceId === 'r1');
  assert.strictEqual(hq.ospf.processId, 10);
  assert.strictEqual(hq.ospf.area, '0');
  assert.strictEqual(hq.ospf.routerId, '1.1.1.1');
  assert.ok(hq.ospf.networks.some(network => network.cidr === '172.16.0.0/30'));
  assert.ok(hq.ospf.networks.some(network => network.cidr === '10.10.10.0/24' && network.passive));
  assert.strictEqual(hq.ospf.networks.some(network => network.cidr === '10.20.20.0/24'), false);
});

test('Routing plan no inventa estrategia cuando falta declaración', () => {
  const p = project('static');
  delete p.routing;
  const plan = RoutingPlan.build(p);
  assert.strictEqual(plan.ok, false);
  assert.ok(plan.warnings.some(message => message.includes('routing.strategy')));
});

console.log('\nTests routing plan completados.');