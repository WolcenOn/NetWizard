'use strict';
const assert=require('assert');
require('../js/netwizard-network-utils.js');
require('../js/netwizard-l3-config-utils.js');
require('../js/netwizard-routing-utils.js');
const Ospf=require('../js/netwizard-ospf.js');

function fixture(){
  return {
    routing:{strategy:'ospf',protocol:'ospf',ospf:{devices:{
      r1:{processId:10,routerId:'1.1.1.1',defaultArea:'0',passiveDefault:true,interfaces:{
        r1r2:{enabled:true,area:'0',passive:false,cost:10}
      }},
      r2:{processId:10,routerId:'2.2.2.2',defaultArea:'0',passiveDefault:true,interfaces:{
        r2r1:{enabled:true,area:'0',passive:false,cost:10},
        r2r3:{enabled:true,area:'10',passive:false,cost:20}
      }},
      r3:{processId:10,routerId:'3.3.3.3',defaultArea:'10',passiveDefault:true,interfaces:{
        r3r2:{enabled:true,area:'10',passive:false,cost:20}
      }}
    }}},
    devices:[
      {id:'r1',name:'RTR-HQ',type:'router',vendorOs:'cisco_ios'},
      {id:'r2',name:'RTR-CORE',type:'router',vendorOs:'cisco_ios'},
      {id:'r3',name:'RTR-BRANCH',type:'router',vendorOs:'cisco_ios'},
      {id:'r4',name:'RTR-NO-OSPF',type:'router',vendorOs:'cisco_ios'}
    ],
    ports:[
      {id:'r1r2',deviceId:'r1',name:'Gi0/0',mode:'routed',l3Ip:'10.255.0.1',l3Cidr:'10.255.0.0/30'},
      {id:'r2r1',deviceId:'r2',name:'Gi0/0',mode:'routed',l3Ip:'10.255.0.2',l3Cidr:'10.255.0.0/30'},
      {id:'r2r3',deviceId:'r2',name:'Gi0/1',mode:'routed',l3Ip:'10.255.0.5',l3Cidr:'10.255.0.4/30'},
      {id:'r3r2',deviceId:'r3',name:'Gi0/0',mode:'routed',l3Ip:'10.255.0.6',l3Cidr:'10.255.0.4/30'}
    ],
    links:[
      {id:'l12',aPortId:'r1r2',bPortId:'r2r1'},
      {id:'l23',aPortId:'r2r3',bPortId:'r3r2'}
    ],
    vlans:[{id:'v1',vlanId:10,name:'HQ'},{id:'v3',vlanId:30,name:'Branch'}],
    subnets:[
      {id:'s1',vlanRef:'v1',cidr:'10.10.0.0/24',gateway:'10.10.0.1',gatewayDeviceRef:'r1'},
      {id:'s3',vlanRef:'v3',cidr:'10.30.0.0/24',gateway:'10.30.0.1',gatewayDeviceRef:'r3'}
    ],
    observedState:null
  };
}

let p=fixture(),report=Ospf.validateProject(p);
assert.strictEqual(report.ok,true,JSON.stringify(report.issues));
assert.strictEqual(report.neighbors.length,4);
assert.strictEqual(report.plans.some(x=>x.deviceId==='r4'),false);
assert.ok(report.neighbors.some(n=>n.deviceId==='r2'&&n.peerDeviceId==='r3'&&n.area==='10'));
const r2=report.plans.find(x=>x.deviceId==='r2');
assert.ok(r2.networks.some(n=>n.portId==='r2r3'&&n.cost===20&&n.area==='10'));
assert.ok(report.plans.find(x=>x.deviceId==='r1').networks.some(n=>n.cidr==='10.10.0.0/24'&&n.passive));

let path=Ospf.adjacencyPath(p,'r1','r3',{useObserved:true});
assert.deepStrictEqual(path.devices,['r1','r2','r3']);
assert.strictEqual(path.confidence,'planned');

p.observedState={ospfNeighbors:{
  r1:[{localPortId:'r1r2',peerDeviceId:'r2',peerRouterId:'2.2.2.2',area:'0',state:'full'}],
  r2:[
    {localPortId:'r2r1',peerDeviceId:'r1',peerRouterId:'1.1.1.1',area:'0',state:'full'},
    {localPortId:'r2r3',peerDeviceId:'r3',peerRouterId:'3.3.3.3',area:'10',state:'full'}
  ],
  r3:[{localPortId:'r3r2',peerDeviceId:'r2',peerRouterId:'2.2.2.2',area:'10',state:'full'}]
}};
path=Ospf.adjacencyPath(p,'r1','r3',{useObserved:true});
assert.deepStrictEqual(path.devices,['r1','r2','r3']);
assert.strictEqual(path.confidence,'observed');
assert.strictEqual(Ospf.compareObserved(p,'r2').ok,true);

p=fixture();
p.routing.ospf.devices.r3.routerId='2.2.2.2';
report=Ospf.validateProject(p);
assert.strictEqual(report.ok,false);
assert.ok(report.issues.some(x=>x.code==='NW-OSPF-007'&&x.blocking));

p=fixture();
p.routing.ospf.devices.r2.interfaces.r2r3.area='20';
report=Ospf.validateProject(p);
assert.ok(report.issues.some(x=>x.code==='NW-OSPF-008'&&x.deviceId==='r2'));

console.log('✓ OSPF valida áreas, costes, router-id, vecinos esperados y estado Observed');
