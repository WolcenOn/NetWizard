'use strict';
const assert=require('assert');
require('../js/netwizard-capability-registry.js');
const Form=require('../js/netwizard-device-capability-form.js');
function test(name,fn){try{fn();console.log(`✓ ${name}`);}catch(error){console.error(`✗ ${name}`);throw error;}}
test('normaliza capacidades desde array y objeto',()=>{
 assert.deepStrictEqual(Form.normalizeRequested(['ospf','bgp','']),{ospf:true,bgp:true});
 assert.deepStrictEqual(Form.normalizeRequested({ospf:true,bgp:false,vrf:{enabled:true}}),{ospf:true,vrf:{enabled:true}});
});
test('resuelve plataforma registrada desde vendor',()=>{
 const platform=Form.platformForVendor('fortinet');
 assert.ok(platform);
 assert.strictEqual(platform.id,'fortinet');
 assert.ok(platform.capabilities.ospf);
});
test('plataforma desconocida no se inventa',()=>{
 assert.strictEqual(Form.platformForVendor('fabricante_desconocido'),null);
});
console.log('\nTests device capability form completados.');
