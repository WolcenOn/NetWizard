'use strict';

const assert=require('assert');
const Legacy=require('../js/netwizard-legacy-config-generator.js');

const project={
  devices:[
    {id:'sw1',name:'SW-LEGACY',type:'switch',kind:'switch',vendorOs:'cisco_ios'},
    {id:'asa1',name:'ASA-LEGACY',type:'firewall',kind:'firewall',vendorOs:'cisco_asa'},
    {id:'win1',name:'WIN-LEGACY',type:'server',kind:'server',vendorOs:'windows'},
    {id:'lin1',name:'LIN-LEGACY',type:'server',kind:'server',vendorOs:'linux'}
  ],
  ports:[
    {id:'swp1',deviceId:'sw1',name:'Gi0/1',mode:'access',accessVlanRef:'v10',position:1,desc:'Usuario'},
    {id:'swp24',deviceId:'sw1',name:'Gi0/24',mode:'trunk',allowedVlans:[10],position:24,desc:'Uplink'}
  ],
  vlans:[{id:'v10',vlanId:10,name:'Users'}],
  subnets:[{id:'s10',vlanRef:'v10',cidr:'10.10.10.0/24',gateway:'10.10.10.1'}],
  hosts:[{id:'h1',name:'APP-01',type:'server',vlanRef:'v10',ipMode:'static',staticIp:'10.10.10.20'}],
  links:[],
  fwRules:[{id:'fw1',name:'HTTPS',src:'any',dst:'10.10.10.20',proto:'tcp',port:'443',action:'allow',dir:'in',prio:10,enabled:true}],
  vlanMatrix:{},
  roas:{gwId:null,lanIf:'',natVRef:null,wanCidr:'198.51.100.2/30',wanNh:'198.51.100.1'},
  dhcp:{},
  security:{bpdu:'yes',ps:'yes',ds:'no',dai:'no',ipsg:'no',dsV:''},
  vtp:{domain:'',password:'',version:'2',pruning:'no',roles:{}},
  routing:{}
};

assert.strictEqual(Legacy.version,'netwizard-legacy-config-generator-v1');

const sw=Legacy.generate(project,'sw1','cisco_ios');
assert.match(sw,/Cisco IOS Switch/);
assert.match(sw,/hostname SW-LEGACY/);
assert.match(sw,/switchport access vlan 10/);

const asa=Legacy.generate(project,'asa1','cisco_asa');
assert.match(asa,/Cisco ASA/);
assert.match(asa,/hostname ASA-LEGACY/);
assert.match(asa,/access-list OUTSIDE_IN/);

const windows=Legacy.generate(project,'win1','windows');
assert.match(windows,/Windows Server \/ Windows 10\+/);
assert.match(windows,/New-NetIPAddress/);
assert.match(windows,/-IPAddress "10\.10\.10\.20"/);

const linux=Legacy.generate(project,'lin1','linux');
assert.match(linux,/Linux \(Ubuntu\/Debian\/RHEL\)/);
assert.match(linux,/ip addr add 10\.10\.10\.20\/24 dev eth0/);
assert.match(linux,/--dport 443 -j ACCEPT/);

const acl=Legacy.genFwAcl(project);
assert.match(acl,/FW Policy ACL/);
assert.match(acl,/permit tcp any host 10\.10\.10\.20 eq 443/);

assert.strictEqual(Legacy.generate(project,'missing','cisco_ios'),'');
console.log('✓ Generador histórico extraído mantiene fallbacks source/offline');
