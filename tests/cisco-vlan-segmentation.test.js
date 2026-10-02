'use strict';

const assert=require('assert');
const Seg=require('../private/cisco-vlan-segmentation.js');

const project={
  devices:[{id:'r1',name:'RTR-01',type:'router',kind:'router',vendorOs:'cisco_ios',lanIf:'GigabitEthernet0/1'}],
  ports:[{id:'lan',deviceId:'r1',name:'GigabitEthernet0/1',mode:'trunk',role:'lan',allowedVlans:[10,20,99]}],
  vlans:[
    {id:'v10',vlanId:10,name:'Users',intent:{type:'users'}},
    {id:'v20',vlanId:20,name:'Servers',intent:{type:'servers'}},
    {id:'v99',vlanId:99,name:'Mgmt',intent:{type:'management'}}
  ],
  subnets:[
    {id:'s10',vlanRef:'v10',cidr:'10.0.10.0/24',gateway:'10.0.10.1',gatewayDeviceRef:'r1'},
    {id:'s20',vlanRef:'v20',cidr:'10.0.20.0/24',gateway:'10.0.20.1',gatewayDeviceRef:'r1'},
    {id:'s99',vlanRef:'v99',cidr:'10.0.99.0/24',gateway:'10.0.99.1',gatewayDeviceRef:'r1'}
  ],
  vlanMatrix:{v10_v99:false,v20_v99:false}
};

const report=Seg.validateDevice(project,'r1');
assert.strictEqual(report.ok,true,JSON.stringify(report.issues));
assert.strictEqual(report.parentInterface,'GigabitEthernet0/1');
assert.strictEqual(report.policies.length,2);

const out=Seg.render(project,'r1');
assert.match(out,/ip access-list extended NW_SEG_V10/);
assert.match(out,/deny ip 10\.0\.10\.0 0\.0\.0\.255 10\.0\.99\.0 0\.0\.0\.255/);
assert.match(out,/permit ip 10\.0\.10\.0 0\.0\.0\.255 any/);
assert.match(out,/interface GigabitEthernet0\/1\.10/);
assert.match(out,/ip access-group NW_SEG_V10 in/);
assert.match(out,/ip access-list extended NW_SEG_V20/);
assert.doesNotMatch(out,/NW_SEG_V99/);

const once=Seg.append('hostname RTR-01\n',project,'r1');
const twice=Seg.append(once,project,'r1');
assert.strictEqual(once,twice);

const clean=JSON.parse(JSON.stringify(project));
clean.vlanMatrix={};
assert.strictEqual(Seg.render(clean,'r1'),'','Sin bloqueos explícitos no debe inventar ACLs.');

console.log('✓ Cisco VLAN segmentation aplica vlanMatrix como ACL inbound por subinterfaz');
