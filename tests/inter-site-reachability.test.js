'use strict';
const assert=require('assert');
require('../js/netwizard-network-utils.js');
require('../js/netwizard-l3-config-utils.js');
require('../js/netwizard-routing-utils.js');
require('../js/netwizard-connectivity-model.js');
const Reach=require('../js/netwizard-inter-site-reachability.js');

function fixture(){
  return {
    routing:{
      strategy:'static',
      staticRoutesByDevice:{
        r2:[{id:'r2-r3',destination:'10.30.0.0/24',nextHop:'10.255.0.1',distance:1}],
        r3:[{id:'r3-r2',destination:'10.20.0.0/24',nextHop:'10.255.0.5',distance:1}]
      }
    },
    devices:[
      {id:'r1',name:'RTR-CENTRAL',type:'router',vendorOs:'cisco_ios'},
      {id:'r2',name:'RTR-NORTE',type:'router',vendorOs:'cisco_ios'},
      {id:'r3',name:'RTR-SUR',type:'router',vendorOs:'cisco_ios'}
    ],
    ports:[
      {id:'r1-n',deviceId:'r1',name:'Gi0/1',mode:'routed',role:'transit',l3Ip:'10.255.0.1',l3Cidr:'10.255.0.0/30'},
      {id:'r2-w',deviceId:'r2',name:'Gi0/1',mode:'routed',role:'transit',l3Ip:'10.255.0.2',l3Cidr:'10.255.0.0/30'},
      {id:'r1-s',deviceId:'r1',name:'Gi0/2',mode:'routed',role:'transit',l3Ip:'10.255.0.5',l3Cidr:'10.255.0.4/30'},
      {id:'r3-w',deviceId:'r3',name:'Gi0/1',mode:'routed',role:'transit',l3Ip:'10.255.0.6',l3Cidr:'10.255.0.4/30'},
      {id:'r2-lan',deviceId:'r2',name:'Gi0/0',mode:'routed',role:'lan',l3Ip:'10.20.0.1',l3Cidr:'10.20.0.0/24'},
      {id:'r3-lan',deviceId:'r3',name:'Gi0/0',mode:'routed',role:'lan',l3Ip:'10.30.0.1',l3Cidr:'10.30.0.0/24'}
    ],
    links:[{id:'ln',aPortId:'r1-n',bPortId:'r2-w'},{id:'ls',aPortId:'r1-s',bPortId:'r3-w'}],
    vlans:[{id:'v20',vlanId:20,name:'Norte'},{id:'v30',vlanId:30,name:'Sur'}],
    subnets:[
      {id:'s20',vlanRef:'v20',cidr:'10.20.0.0/24',gateway:'10.20.0.1',gatewayDeviceRef:'r2'},
      {id:'s30',vlanRef:'v30',cidr:'10.30.0.0/24',gateway:'10.30.0.1',gatewayDeviceRef:'r3'}
    ],
    fwRules:[]
  };
}

let p=fixture(),res=Reach.analyze(p,'s20','s30','icmp');
assert.strictEqual(res.reachable,true,res.reason);
assert.strictEqual(res.forward.ok,true);
assert.strictEqual(res.reverse.ok,true);
assert.ok(res.forward.hops.some(h=>h.kind==='device'&&h.deviceId==='r1'),'La ida debe atravesar CENTRAL');
assert.ok(res.reverse.hops.some(h=>h.kind==='device'&&h.deviceId==='r1'),'El retorno debe atravesar CENTRAL');

p=fixture();
delete p.routing.staticRoutesByDevice.r3;
res=Reach.analyze(p,'s20','s30','icmp');
assert.strictEqual(res.reachable,false);
assert.match(res.reason,/RETORNO:/);
assert.match(res.reverse.reason,/No existe ruta/);

p=fixture();
p.fwRules=[{id:'deny1',name:'Bloqueo Norte Sur',src:'10.20.0.0/24',dst:'10.30.0.0/24',proto:'icmp',port:'any',action:'deny',prio:10,enabled:true}];
res=Reach.analyze(p,'s20','s30','icmp');
assert.strictEqual(res.reachable,false);
assert.match(res.reason,/POLÍTICA:/);
assert.strictEqual(res.policy.matched.id,'deny1');


p=fixture();
p.ports.push(
  {id:'r2-inet',deviceId:'r2',name:'Gi0/9',mode:'routed',role:'wan',l3Ip:'203.0.113.2',l3Cidr:'203.0.113.2/30'},
  {id:'r3-inet',deviceId:'r3',name:'Gi0/9',mode:'routed',role:'wan',l3Ip:'198.51.100.2',l3Cidr:'198.51.100.2/30'}
);
p.wanCircuits=[
  {id:'c2',deviceId:'r2',portId:'r2-inet',enabled:true},
  {id:'c3',deviceId:'r3',portId:'r3-inet',enabled:true}
];
p.routing.staticRoutesByDevice={};
p.routing.siteToSiteVpns=[{
  id:'vpn-r2-r3',name:'NORTE-SUR',enabled:true,
  localDeviceId:'r2',remoteDeviceId:'r3',localCircuitRef:'c2',remoteCircuitRef:'c3',
  localPrefixes:['10.20.0.0/24'],remotePrefixes:['10.30.0.0/24'],
  secretAlias:'VPN_NORTE_SUR_PSK',ikeVersion:'2',encryption:'aes256',integrity:'sha256',
  dhGroup:14,pfsGroup:14,ikeLifetimeSeconds:28800,ipsecLifetimeSeconds:3600
}];
res=Reach.analyze(p,'s20','s30','icmp');
assert.strictEqual(res.reachable,true,res.reason);
assert.ok(res.forward.hops.some(h=>h.kind==='vpn'&&h.tunnelId==='vpn-r2-r3'));
assert.ok(res.reverse.hops.some(h=>h.kind==='vpn'&&h.tunnelId==='vpn-r2-r3'));

p.observedState={siteToSiteVpns:{'vpn-r2-r3':{status:'down',localEndpoint:'203.0.113.2',remoteEndpoint:'198.51.100.2'}}};
res=Reach.analyze(p,'s20','s30','icmp');
assert.strictEqual(res.reachable,false);
assert.match(res.reason,/VPN .*DOWN|VPN .*figura DOWN/i);


p=fixture();
p.routing={
  strategy:'ospf',protocol:'ospf',
  ospf:{devices:{
    r1:{processId:10,routerId:'1.1.1.1',defaultArea:'0',passiveDefault:true,interfaces:{
      'r1-n':{enabled:true,area:'0',passive:false,cost:10},
      'r1-s':{enabled:true,area:'0',passive:false,cost:10}
    }},
    r2:{processId:10,routerId:'2.2.2.2',defaultArea:'0',passiveDefault:true,interfaces:{
      'r2-w':{enabled:true,area:'0',passive:false,cost:10}
    }},
    r3:{processId:10,routerId:'3.3.3.3',defaultArea:'0',passiveDefault:true,interfaces:{
      'r3-w':{enabled:true,area:'0',passive:false,cost:10}
    }}
  }}
};
res=Reach.analyze(p,'s20','s30','icmp');
assert.strictEqual(res.reachable,true,res.reason);
assert.strictEqual(res.forward.confidence,'planned');
assert.ok(res.forward.hops.some(h=>h.kind==='ospf'&&h.peerDeviceId==='r1'));
assert.ok(res.forward.hops.some(h=>h.kind==='ospf'&&h.peerDeviceId==='r3'));

p.observedState={ospfNeighbors:{
  r2:[{localPortId:'r2-w',peerDeviceId:'r1',peerRouterId:'1.1.1.1',area:'0',state:'down'}]
}};
res=Reach.analyze(p,'s20','s30','icmp');
assert.strictEqual(res.reachable,false);
assert.match(res.reason,/Observed|adyacencias OSPF/i);

console.log('✓ Reachability inter-sede valida ida, retorno, camino multi-hop y política');
