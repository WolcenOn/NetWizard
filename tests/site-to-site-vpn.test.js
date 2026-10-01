'use strict';
const assert=require('assert');
const Vpn=require('../js/netwizard-site-to-site-vpn.js');

function fixture(){
  return {
    devices:[
      {id:'r1',name:'RTR-HQ',type:'router',vendorOs:'cisco_ios'},
      {id:'r2',name:'RTR-BRANCH',type:'router',vendorOs:'cisco_ios'}
    ],
    ports:[
      {id:'r1-wan',deviceId:'r1',name:'Gi0/0',mode:'routed',role:'wan',l3Ip:'203.0.113.2',l3Cidr:'203.0.113.2/30'},
      {id:'r2-wan',deviceId:'r2',name:'Gi0/0',mode:'routed',role:'wan',l3Ip:'198.51.100.2',l3Cidr:'198.51.100.2/30'}
    ],
    wanCircuits:[
      {id:'c1',name:'HQ Internet',deviceId:'r1',portId:'r1-wan',provider:'ISP-A',role:'primary',enabled:true,bandwidthDownMbps:500,bandwidthUpMbps:200},
      {id:'c2',name:'Branch Internet',deviceId:'r2',portId:'r2-wan',provider:'ISP-B',role:'primary',enabled:true,bandwidthDownMbps:300,bandwidthUpMbps:100}
    ],
    vlans:[{id:'v10',vlanId:10,name:'HQ'},{id:'v20',vlanId:20,name:'Branch'}],
    subnets:[
      {id:'s1',vlanRef:'v10',cidr:'10.10.0.0/24',gateway:'10.10.0.1',gatewayDeviceRef:'r1'},
      {id:'s2',vlanRef:'v20',cidr:'10.20.0.0/24',gateway:'10.20.0.1',gatewayDeviceRef:'r2'}
    ],
    routing:{
      strategy:'static',
      siteToSiteVpns:[{
        id:'vpn1',name:'HQ-BRANCH',enabled:true,
        localDeviceId:'r1',remoteDeviceId:'r2',
        localCircuitRef:'c1',remoteCircuitRef:'c2',
        localPrefixes:['10.10.0.0/24'],remotePrefixes:['10.20.0.0/24'],
        ikeVersion:'2',encryption:'aes256',integrity:'sha256',dhGroup:14,pfsGroup:14,
        ikeLifetimeSeconds:28800,ipsecLifetimeSeconds:3600,
        secretAlias:'VPN_HQ_BRANCH_PSK'
      }]
    },
    observedState:null
  };
}

let p=fixture(),report=Vpn.validateProject(p);
assert.strictEqual(report.ok,true,JSON.stringify(report.issues));
assert.strictEqual(report.counts.blocking,0);
assert.strictEqual(report.plans[0].localEndpoint,'203.0.113.2');
assert.strictEqual(report.plans[0].remoteEndpoint,'198.51.100.2');

const remote=Vpn.buildDevicePlan(p,'r2');
assert.strictEqual(remote.ok,true);
assert.strictEqual(remote.tunnels[0].localEndpoint,'198.51.100.2');
assert.strictEqual(remote.tunnels[0].remoteEndpoint,'203.0.113.2');
assert.deepStrictEqual(remote.tunnels[0].localPrefixes,['10.20.0.0/24']);
assert.deepStrictEqual(remote.tunnels[0].remotePrefixes,['10.10.0.0/24']);

let overlay=Vpn.findOverlay(p,'r1','r2','10.10.0.0/24','10.20.0.0/24');
assert.strictEqual(overlay.matched,true);
assert.strictEqual(overlay.available,true);
assert.strictEqual(overlay.status,'unknown');

p=fixture();
p.observedState={siteToSiteVpns:{vpn1:{status:'down',localEndpoint:'203.0.113.2',remoteEndpoint:'198.51.100.2',observedAt:'2026-10-01T08:00:00.000Z'}}};
overlay=Vpn.findOverlay(p,'r1','r2','10.10.0.0/24','10.20.0.0/24');
assert.strictEqual(overlay.available,false);
assert.strictEqual(overlay.status,'down');

p=fixture();
p.routing.siteToSiteVpns[0].psk='super-secret';
report=Vpn.validateProject(p);
assert.strictEqual(report.ok,false);
assert.ok(report.issues.some(x=>x.code==='NW-VPN-020'&&x.blocking));

p=fixture();
p.routing.siteToSiteVpns[0].remoteCircuitRef='c1';
report=Vpn.validateProject(p);
assert.ok(report.issues.some(x=>x.code==='NW-VPN-008'&&x.blocking));

console.log('✓ VPN site-to-site valida overlay, orientación, Observed y secretos por alias');
