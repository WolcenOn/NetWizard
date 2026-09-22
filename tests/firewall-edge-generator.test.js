'use strict';

const assert=require('assert');
require('../js/netwizard-network-utils.js');
require('../js/netwizard-l3-config-utils.js');
require('../js/netwizard-routing-utils.js');
require('../js/netwizard-routing-plan.js');
const Edge=require('../js/netwizard-firewall-edge-generator.js');

function test(name,fn){try{fn();console.log(`✓ ${name}`);}catch(err){console.error(`✗ ${name}`);throw err;}}

function project(vendor){return {
 routing:{strategy:'static'},
 devices:[{id:'fw1',name:'FW-HQ',type:'firewall',vendorOs:vendor,internetEdge:'yes'}],
 ports:[
  {id:'wan',deviceId:'fw1',name:'wan1',mode:'routed',role:'wan',l3Ip:'203.0.113.2',l3Cidr:'203.0.113.2/30'},
  {id:'lan',deviceId:'fw1',name:'internal1',mode:'trunk',role:'lan'}
 ],
 vlans:[{id:'v10',vlanId:10,name:'Users'}],
 subnets:[{id:'s10',vlanRef:'v10',cidr:'10.10.10.0/24',gateway:'10.10.10.1',gatewayDeviceRef:'fw1'}],
 fwRules:[{id:'deny1',name:'Block IoT',action:'deny',enabled:true}],
 links:[],roas:{gwId:'fw1',lanIf:'internal1',wanNh:'203.0.113.1'}
};}

test('FortiGate genera interfaces, VLAN, objetos, NAT y política explícita',()=>{
 const cfg=Edge.render(project('fortinet'),'fw1','fortinet');
 assert.ok(cfg.includes('config system interface'));
 assert.ok(cfg.includes('set vlanid 10'));
 assert.ok(cfg.includes('set subnet 10.10.10.0 255.255.255.0'));
 assert.ok(cfg.includes('set nat enable'));
 assert.ok(cfg.includes('set action deny'));
 assert.ok(cfg.includes('set gateway 203.0.113.1'));
});

test('pfSense genera script PHP revisable con VLAN, alias, NAT y reglas',()=>{
 const p=project('pfsense');
 p.ports.find(x=>x.id==='lan').allowedVlans=[10];
 p.fwRules.push({id:'dns',name:'DNS',action:'allow',proto:'udp',port:'53',dir:'out'});
 const out=Edge.render(p,'fw1','pfsense');
 assert.ok(out.includes('<?php'));
 assert.ok(out.includes('pfSense provisioning candidate'));
 assert.ok(out.includes('write_config($nw_note)'));
 assert.ok(out.includes('$config["nat"]["outbound"]["mode"]="automatic"'));
 assert.ok(out.includes('// VLAN 10 Users'));
 assert.ok(out.includes('nw_alias("NET_Users"'));
 assert.ok(out.includes('nw_rule('));
});


test('pfSense limita las VLANs a las transportadas por su trunk cuando no hay gatewayDeviceRef',()=>{
 const p=project('pfsense');
 p.vlans.push({id:'v20',vlanId:20,name:'Remote'});
 p.subnets.push({id:'s20',vlanRef:'v20',cidr:'10.20.20.0/24',gateway:'10.20.20.1'});
 p.ports.find(x=>x.id==='lan').allowedVlans=[10];
 const out=Edge.render(p,'fw1','pfsense');
 assert.ok(out.includes('// VLAN 10 Users'));
 assert.ok(!out.includes('// VLAN 20 Remote'));
});
test('Generador no devuelve contenido para vendor ajeno',()=>{
 assert.strictEqual(Edge.render(project('cisco_ios'),'fw1','cisco_ios'),'');
});

console.log('\nTests firewall edge generator completados.');
