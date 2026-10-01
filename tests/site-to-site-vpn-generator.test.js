'use strict';
const assert=require('assert');
const Gen=require('../private/site-to-site-vpn-generator.js');

function fixture(){
  return {
    devices:[
      {id:'r1',name:'RTR-HQ',type:'router',vendorOs:'cisco_ios'},
      {id:'r2',name:'RTR-BRANCH',type:'router',vendorOs:'cisco_ios'}
    ],
    ports:[
      {id:'r1-wan',deviceId:'r1',name:'GigabitEthernet0/0',mode:'routed',role:'wan',l3Ip:'203.0.113.2',l3Cidr:'203.0.113.2/30'},
      {id:'r2-wan',deviceId:'r2',name:'GigabitEthernet0/0',mode:'routed',role:'wan',l3Ip:'198.51.100.2',l3Cidr:'198.51.100.2/30'}
    ],
    wanCircuits:[
      {id:'c1',deviceId:'r1',portId:'r1-wan',enabled:true},
      {id:'c2',deviceId:'r2',portId:'r2-wan',enabled:true}
    ],
    subnets:[
      {id:'s1',cidr:'10.10.0.0/24',gatewayDeviceRef:'r1'},
      {id:'s2',cidr:'10.20.0.0/24',gatewayDeviceRef:'r2'}
    ],
    routing:{siteToSiteVpns:[{
      id:'vpn1',name:'HQ-BRANCH',enabled:true,localDeviceId:'r1',remoteDeviceId:'r2',
      localCircuitRef:'c1',remoteCircuitRef:'c2',
      localPrefixes:['10.10.0.0/24'],remotePrefixes:['10.20.0.0/24'],
      secretAlias:'VPN_HQ_BRANCH_PSK',ikeVersion:'2',encryption:'aes256',integrity:'sha256',dhGroup:14,pfsGroup:14,
      ikeLifetimeSeconds:28800,ipsecLifetimeSeconds:3600
    }]}
  };
}

const p=fixture();
const cisco=Gen.renderCisco(p,'r1');
assert.match(cisco,/crypto ikev2 proposal/);
assert.match(cisco,/address 198\.51\.100\.2/);
assert.match(cisco,/permit ip 10\.10\.0\.0 0\.0\.0\.255 10\.20\.0\.0 0\.0\.0\.255/);
assert.match(cisco,/crypto map NW_S2S_MAP 10 ipsec-isakmp/);
assert.match(cisco,/interface GigabitEthernet0\/0/);
assert.match(cisco,/\$\{SECRET:VPN_HQ_BRANCH_PSK\}/);
assert.doesNotMatch(cisco,/super-secret/);

const remote=Gen.renderCisco(p,'r2');
assert.match(remote,/address 203\.0\.113\.2/);
assert.match(remote,/permit ip 10\.20\.0\.0 0\.0\.0\.255 10\.10\.0\.0 0\.0\.0\.255/);

const forti=Gen.renderFortinet(p,'r1');
assert.match(forti,/config vpn ipsec phase1-interface/);
assert.match(forti,/set remote-gw 198\.51\.100\.2/);
assert.match(forti,/set src-subnet 10\.10\.0\.0 255\.255\.255\.0/);
assert.match(forti,/set dst-subnet 10\.20\.0\.0 255\.255\.255\.0/);
assert.match(forti,/\$\{SECRET:VPN_HQ_BRANCH_PSK\}/);

console.log('✓ Private VPN generator produce Cisco IOS and FortiGate intent without raw PSK');
