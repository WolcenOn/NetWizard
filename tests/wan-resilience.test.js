'use strict';
const assert=require('assert');
require('../js/netwizard-network-utils.js');
require('../js/netwizard-l3-config-utils.js');
require('../js/netwizard-routing-utils.js');
require('../js/netwizard-connectivity-model.js');
require('../js/netwizard-site-to-site-vpn.js');
require('../js/netwizard-ospf.js');
require('../js/netwizard-inter-site-reachability.js');
require('../js/netwizard-wan-circuits.js');
const Resilience=require('../js/netwizard-wan-resilience.js');
const Vpn=require('../js/netwizard-site-to-site-vpn.js');

function fixture(){
  return {
    devices:[
      {id:'hq',name:'RTR-HQ',type:'router',kind:'router',vendorOs:'cisco_ios'},
      {id:'br',name:'RTR-BR',type:'router',kind:'router',vendorOs:'cisco_ios'}
    ],
    ports:[
      {id:'hq-w1',deviceId:'hq',name:'GigabitEthernet0/0',mode:'routed',role:'wan',l3Ip:'203.0.113.2',l3Cidr:'203.0.113.2/30'},
      {id:'hq-w2',deviceId:'hq',name:'GigabitEthernet0/1',mode:'routed',role:'wan',l3Ip:'203.0.114.2',l3Cidr:'203.0.114.2/30'},
      {id:'br-w1',deviceId:'br',name:'GigabitEthernet0/0',mode:'routed',role:'wan',l3Ip:'198.51.100.2',l3Cidr:'198.51.100.2/30'},
      {id:'br-w2',deviceId:'br',name:'GigabitEthernet0/1',mode:'routed',role:'wan',l3Ip:'198.51.101.2',l3Cidr:'198.51.101.2/30'}
    ],
    links:[],
    wanCircuits:[
      {id:'hq1',name:'HQ ISP-A',deviceId:'hq',portId:'hq-w1',provider:'ISP-A',role:'primary',siteRef:'HQ',enabled:true,bandwidthDownMbps:500,bandwidthUpMbps:200},
      {id:'hq2',name:'HQ ISP-B',deviceId:'hq',portId:'hq-w2',provider:'ISP-B',role:'backup',siteRef:'HQ',enabled:true,bandwidthDownMbps:300,bandwidthUpMbps:100},
      {id:'br1',name:'BR ISP-A',deviceId:'br',portId:'br-w1',provider:'ISP-A',role:'primary',siteRef:'BR',enabled:true,bandwidthDownMbps:500,bandwidthUpMbps:200},
      {id:'br2',name:'BR ISP-C',deviceId:'br',portId:'br-w2',provider:'ISP-C',role:'backup',siteRef:'BR',enabled:true,bandwidthDownMbps:300,bandwidthUpMbps:100}
    ],
    vlans:[{id:'vhq',vlanId:10,name:'HQ Users'},{id:'vbr',vlanId:20,name:'BR Users'}],
    subnets:[
      {id:'shq',vlanRef:'vhq',cidr:'10.10.0.0/24',gateway:'10.10.0.1',gatewayDeviceRef:'hq'},
      {id:'sbr',vlanRef:'vbr',cidr:'10.20.0.0/24',gateway:'10.20.0.1',gatewayDeviceRef:'br'}
    ],
    fwRules:[],
    routing:{
      strategy:'static',
      siteToSiteVpns:[
        {
          id:'vpn-primary',name:'HQ-BR PRIMARY',enabled:true,role:'primary',priority:10,
          localDeviceId:'hq',remoteDeviceId:'br',localCircuitRef:'hq1',remoteCircuitRef:'br1',
          localPrefixes:['10.10.0.0/24'],remotePrefixes:['10.20.0.0/24'],
          secretAlias:'VPN_PRIMARY_PSK',ikeVersion:'2',encryption:'aes256',integrity:'sha256',
          dhGroup:14,pfsGroup:14,ikeLifetimeSeconds:28800,ipsecLifetimeSeconds:3600
        },
        {
          id:'vpn-backup',name:'HQ-BR BACKUP',enabled:true,role:'backup',priority:20,
          localDeviceId:'hq',remoteDeviceId:'br',localCircuitRef:'hq2',remoteCircuitRef:'br2',
          localPrefixes:['10.10.0.0/24'],remotePrefixes:['10.20.0.0/24'],
          secretAlias:'VPN_BACKUP_PSK',ikeVersion:'2',encryption:'aes256',integrity:'sha256',
          dhGroup:14,pfsGroup:14,ikeLifetimeSeconds:28800,ipsecLifetimeSeconds:3600
        }
      ]
    },
    highAvailability:{devices:{
      hq:{
        defaultRoutes:[
          {nextHop:'203.0.113.1',distance:1,trackId:'1',circuitRef:'hq1',description:'ISP-A primary'},
          {nextHop:'203.0.114.1',distance:20,circuitRef:'hq2',description:'ISP-B floating'}
        ],
        tracking:[{id:'1',target:'1.1.1.1',sourceInterface:'GigabitEthernet0/0',circuitRef:'hq1',frequency:5,timeout:1000}]
      },
      br:{
        defaultRoutes:[
          {nextHop:'198.51.100.1',distance:1,trackId:'1',circuitRef:'br1',description:'ISP-A primary'},
          {nextHop:'198.51.101.1',distance:20,circuitRef:'br2',description:'ISP-C floating'}
        ],
        tracking:[{id:'1',target:'1.0.0.1',sourceInterface:'GigabitEthernet0/0',circuitRef:'br1',frequency:5,timeout:1000}]
      }
    }},
    observedState:null
  };
}

let p=fixture(),report=Resilience.validateProject(p);
assert.strictEqual(report.ok,true,JSON.stringify(report.issues));

let overlay=Vpn.findOverlay(p,'hq','br','10.10.0.0/24','10.20.0.0/24');
assert.strictEqual(overlay.available,true);
assert.strictEqual(overlay.plan.id,'vpn-primary');

p.observedState={siteToSiteVpns:{'vpn-primary':{status:'down'}}};
overlay=Vpn.findOverlay(p,'hq','br','10.10.0.0/24','10.20.0.0/24');
assert.strictEqual(overlay.available,true);
assert.strictEqual(overlay.plan.id,'vpn-backup');

p=fixture();
let sim=Resilience.simulateEvents(p,[{type:'circuit',targetRef:'hq1'}],'Fallo WAN primary HQ');
assert.strictEqual(sim.lostReachability.length,0,JSON.stringify(sim.lostReachability));
assert.strictEqual(sim.survivingReachability.length,1);
assert.strictEqual(sim.wanGroupsLost.length,0);

sim=Resilience.simulateEvents(p,[
  {type:'circuit',targetRef:'hq1'},
  {type:'circuit',targetRef:'hq2'}
],'Fallo total HQ');
assert.strictEqual(sim.lostReachability.length,1);
assert.deepStrictEqual(sim.wanGroupsLost,['HQ']);

p=fixture();
p.highAvailability.devices.hq.defaultRoutes[1].distance=1;
report=Resilience.validateProject(p);
assert.strictEqual(report.ok,false);
assert.ok(report.issues.some(x=>x.code==='NW-RES-008'&&x.blocking));

p=fixture();
p.routing.siteToSiteVpns[1].localCircuitRef='hq1';
p.routing.siteToSiteVpns[1].remoteCircuitRef='br1';
report=Resilience.validateProject(p);
assert.ok(report.issues.some(x=>x.code==='NW-RES-020'&&x.blocking));

console.log('✓ WAN resilience valida rutas flotantes, tracking, VPN backup y fallos reales');
