'use strict';
const assert=require('assert');
const Engine=require('../js/netwizard-ipv6-vrf.js');
function test(name,fn){try{fn();console.log(`✓ ${name}`);}catch(err){console.error(`✗ ${name}`);throw err;}}
const base={vlans:[{id:'v10'}],vrfs:[{id:'corp',name:'CORP',routeDistinguisher:'65000:10'}],ipv6Networks:[{id:'n1',name:'Usuarios v6',prefix:'2001:db8:10::/64',vrfRef:'corp',vlanRef:'v10',slaac:true,routerAdvertisement:true,gateway:'2001:db8:10::1'}],ports:[{id:'p1',ipv6NetworkRefs:['n1'],vrfRef:'corp'}]};
test('IPv6 y VRF coherentes pasan',()=>{const r=Engine.validateProject(base);assert.strictEqual(r.ok,true);assert.strictEqual(r.counts.blocking,0);});
test('Prefijo IPv6 inválido bloquea',()=>{const p=JSON.parse(JSON.stringify(base));p.ipv6Networks[0].prefix='10.0.0.0/24';const r=Engine.validateProject(p);assert(r.issues.some(i=>i.code==='NW-IPV6-001'&&i.blocking));});
test('SLAAC sin RA bloquea',()=>{const p=JSON.parse(JSON.stringify(base));p.ipv6Networks[0].routerAdvertisement=false;const r=Engine.validateProject(p);assert(r.issues.some(i=>i.code==='NW-IPV6-005'));});
test('Route leaking hacia VRF inexistente bloquea',()=>{const p=JSON.parse(JSON.stringify(base));p.vrfs[0].leakTo=['guest'];const r=Engine.validateProject(p);assert(r.issues.some(i=>i.code==='NW-VRF-004'));});
console.log('\nTests IPv6/VRF completados.');
