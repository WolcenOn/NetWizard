'use strict';

const assert = require('assert');
require('../js/netwizard-network-utils.js');
require('../js/netwizard-l3-config-utils.js');
require('../js/netwizard-routing-utils.js');
const RoutingPlan = require('../js/netwizard-routing-plan.js');
const Cisco = require('../js/netwizard-cisco-routing-generator.js');
const Multi = require('../js/netwizard-multivendor-routing-generator.js');
const Worker = require('../private/routing-worker.js');

function project(vendor, strategy){
  return {
    routing: strategy === 'ospf' ? {protocol:'ospf',area:'0',processId:10,routerIds:{r1:'1.1.1.1',r2:'2.2.2.2'}} : {strategy:'static'},
    devices:[
      {id:'r1',name:'RTR-HQ',type:'router',vendorOs:vendor},
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

for(const vendor of ['cisco_ios','juniper_junos','huawei_vrp','mikrotik_routeros']){
  const p = project(vendor, vendor === 'cisco_ios' ? 'static' : 'ospf');
  if(vendor === 'mikrotik_routeros') p.routing.routerIds.r1='1.1.1.1';
  const plan = RoutingPlan.build(p);
  const expected = vendor === 'cisco_ios'
    ? Cisco.render(p,'r1',plan)
    : Multi.render(p,'r1',vendor,plan);
  const actual = Worker.handle({project:p,deviceId:'r1'});
  assert.strictEqual(actual.contractVersion,'netwizard-private-routing-v1');
  assert.strictEqual(actual.vendor,vendor);
  assert.strictEqual(actual.output,expected, vendor + ' worker output must match browser generator exactly');
}

assert.throws(()=>Worker.handle({project:project('cisco_ios','static'),deviceId:'missing'}),/device not found/);
assert.throws(()=>Worker.handle({project:project('unknown_vendor','static'),deviceId:'r1'}),/unsupported routing vendor/);

console.log('✓ Private routing worker mantiene paridad exacta con los generadores existentes');
