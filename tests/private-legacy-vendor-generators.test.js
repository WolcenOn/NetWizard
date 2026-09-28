'use strict';

const assert=require('assert');
const Legacy=require('../private/legacy-vendor-generators.js');

const project={
  devices:[
    {id:'asa1',name:'EDGE-ASA',type:'firewall',vendorOs:'cisco_asa'},
    {id:'win1',name:'WIN-UTIL',type:'server',vendorOs:'windows'},
    {id:'lin1',name:'LIN-UTIL',type:'server',vendorOs:'linux'}
  ],
  vlans:[{id:'v10',vlanId:10,name:'Users'}],
  subnets:[{id:'s10',vlanRef:'v10',cidr:'10.10.10.0/24',gateway:'10.10.10.1'}],
  hosts:[{id:'h1',name:'APP-01',type:'server',vlanRef:'v10',ipMode:'static',staticIp:'10.10.10.20'}],
  ports:[],links:[],
  roas:{wanCidr:'198.51.100.2/30'},
  fwRules:[{id:'fw1',name:'HTTPS inbound',src:'any',dst:'10.10.10.20',proto:'tcp',port:'443',action:'allow',dir:'in',prio:10,enabled:true}]
};

const asa=Legacy.render(project,'asa1','cisco_asa');
assert.match(asa,/hostname EDGE-ASA/);
assert.match(asa,/interface GigabitEthernet0\/0\.10/);
assert.match(asa,/ip address 10\.10\.10\.1 255\.255\.255\.0/);
assert.match(asa,/object network NW_/);
assert.match(asa,/access-list OUTSIDE_IN extended permit tcp any host 10\.10\.10\.20 eq 443/);

const windows=Legacy.render(project,'win1','windows');
assert.match(windows,/Windows Server \/ Windows 10\+/);
assert.match(windows,/New-NetIPAddress/);
assert.match(windows,/-IPAddress "10\.10\.10\.20"/);
assert.match(windows,/Enable-NetFirewallRule -DisplayGroup "Remote Desktop"/);

const linux=Legacy.render(project,'lin1','linux');
assert.match(linux,/Linux \(Ubuntu\/Debian\/RHEL\)/);
assert.match(linux,/ip addr add 10\.10\.10\.20\/24 dev eth0/);
assert.match(linux,/iptables -P INPUT DROP/);
assert.match(linux,/--dport 443 -j ACCEPT/);

assert.strictEqual(Legacy.render(project,'asa1','future_os'),'');
console.log('✓ Cisco ASA, Windows y Linux se generan íntegramente en el Private Engine');
