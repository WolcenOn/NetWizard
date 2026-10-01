'use strict';
const assert=require('assert');
const Routing=require('../js/netwizard-routing-utils.js');

const p={
  devices:[
    {id:'r1',name:'RTR-CENTRAL',type:'router',vendorOs:'cisco_ios'},
    {id:'r2',name:'RTR-NORTE',type:'router',vendorOs:'cisco_ios'}
  ],
  ports:[
    {id:'r1-lan',deviceId:'r1',name:'Gi0/0',mode:'routed',l3Ip:'10.10.0.1',l3Cidr:'10.10.0.0/24'},
    {id:'r1-wan',deviceId:'r1',name:'Gi0/1',mode:'routed',role:'transit',l3Ip:'10.255.0.1',l3Cidr:'10.255.0.0/30'},
    {id:'r2-wan',deviceId:'r2',name:'Gi0/1',mode:'routed',role:'transit',l3Ip:'10.255.0.2',l3Cidr:'10.255.0.0/30'},
    {id:'r2-lan',deviceId:'r2',name:'Gi0/0',mode:'routed',l3Ip:'10.20.0.1',l3Cidr:'10.20.0.0/24'}
  ],
  links:[{id:'l1',aPortId:'r1-wan',bPortId:'r2-wan',notes:'MPLS'}],
  vlans:[],subnets:[],roas:{}
};

const routes1=Routing.inferStaticRoutes(p,'r1');
const routes2=Routing.inferStaticRoutes(p,'r2');
assert.ok(routes1.some(r=>r.destination==='10.20.0.0/24'&&r.nextHop==='10.255.0.2'));
assert.ok(routes2.some(r=>r.destination==='10.10.0.0/24'&&r.nextHop==='10.255.0.1'));
console.log('✓ Routing Utils descubre redes remotas a través de tránsito L3 canónico');
