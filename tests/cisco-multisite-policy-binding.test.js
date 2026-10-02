'use strict';

const assert=require('assert');
require('../js/netwizard-network-utils.js');
require('../js/netwizard-l3-config-utils.js');
require('../js/netwizard-routing-utils.js');
require('../js/netwizard-policy-utils.js');
require('../js/netwizard-connectivity-model.js');
require('../js/netwizard-site-to-site-vpn.js');
require('../js/netwizard-wan-circuits.js');
require('../js/netwizard-wan-resilience.js');
require('../js/netwizard-ospf.js');
const Engine=require('../private/vendor-config-engine.js');

const project={
  _schemaVersion:'3.50.0',
  projName:'ACL binding multisite',
  devices:[
    {id:'r1',name:'RTR-01',type:'router',kind:'router',vendorOs:'cisco_ios'},
    {id:'r2',name:'RTR-02',type:'router',kind:'router',vendorOs:'cisco_ios'}
  ],
  ports:[
    {id:'r1lan',deviceId:'r1',name:'GigabitEthernet0/1',mode:'trunk',role:'lan',allowedVlans:[10]},
    {id:'r2lan',deviceId:'r2',name:'GigabitEthernet0/1',mode:'trunk',role:'lan',allowedVlans:[20]}
  ],
  vlans:[
    {id:'v10',vlanId:10,name:'USERS-A'},
    {id:'v20',vlanId:20,name:'USERS-B'}
  ],
  subnets:[
    {id:'s10',vlanRef:'v10',cidr:'10.10.10.0/24',gateway:'10.10.10.1',gatewayDeviceRef:'r1'},
    {id:'s20',vlanRef:'v20',cidr:'10.20.20.0/24',gateway:'10.20.20.1',gatewayDeviceRef:'r2'}
  ],
  hosts:[],links:[],dhcp:{},roas:{},vtp:{roles:{}},
  routing:{strategy:'static',staticRoutesByDevice:{}},
  highAvailability:{devices:{}},
  fwRules:[
    {id:'a',name:'A HTTPS',prio:10,src:'10.10.10.0/24',dst:'10.20.20.0/24',proto:'tcp',port:'443',action:'allow',enabled:true},
    {id:'b',name:'B DNS',prio:10,src:'10.20.20.0/24',dst:'10.10.10.0/24',proto:'udp',port:'53',action:'allow',enabled:true}
  ],
  management:{},accessSecurity:{}
};

const generated=Engine.generateAll(project);
assert.strictEqual(generated.ok,true,JSON.stringify(generated.issues));
for(const id of ['r1','r2'])assert.strictEqual(generated.configReadiness[id].status,'apply-ready',JSON.stringify(generated.configReadiness[id]));

const r1=generated.configs.r1,r2=generated.configs.r2;
assert.doesNotMatch(r1,/gateway RoaS inferido automáticamente/i);
assert.doesNotMatch(r2,/gateway RoaS inferido automáticamente/i);
assert.match(r1,/interface GigabitEthernet0\/1\.10[\s\S]*ip access-group FW_POLICY in/);
assert.match(r2,/interface GigabitEthernet0\/1\.20[\s\S]*ip access-group FW_POLICY in/);
assert.match(r1,/A HTTPS/);
assert.doesNotMatch(r1,/B DNS/);
assert.match(r2,/B DNS/);
assert.doesNotMatch(r2,/A HTTPS/);

console.log('✓ Cisco multisede vincula ACL por gateway y acepta RoaS determinista');
