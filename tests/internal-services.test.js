'use strict';
const assert=require('assert');
const Services=require('../js/netwizard-internal-services.js');
function test(name,fn){try{fn();console.log(`✓ ${name}`);}catch(err){console.error(`✗ ${name}`);throw err;}}
const base={devices:[{id:'srv1'},{id:'srv2'}],internalServices:[{id:'dns',name:'DNS',type:'dns',critical:true,endpoints:[{deviceId:'srv1',ip:'10.0.0.10'},{deviceId:'srv2',ip:'10.0.0.11'}]},{id:'radius',name:'RADIUS',type:'radius',critical:true,dependsOn:['dns'],endpoints:[{deviceId:'srv1',ip:'10.0.0.20'},{deviceId:'srv2',ip:'10.0.0.21'}]}]};
test('Servicios coherentes pasan validación',()=>{const r=Services.validateProject(base);assert.strictEqual(r.ok,true);assert.strictEqual(r.counts.blocking,0);});
test('Dependencia inexistente bloquea',()=>{const p=JSON.parse(JSON.stringify(base));p.internalServices[1].dependsOn=['missing'];const r=Services.validateProject(p);assert(r.issues.some(i=>i.code==='NW-SVC-006'&&i.blocking));});
test('Servicio crítico sin redundancia avisa',()=>{const p=JSON.parse(JSON.stringify(base));p.internalServices[0].endpoints.length=1;const r=Services.validateProject(p);assert(r.issues.some(i=>i.code==='NW-SVC-007'&&!i.blocking));});
test('Dependencia circular bloquea',()=>{const p=JSON.parse(JSON.stringify(base));p.internalServices[0].dependsOn=['radius'];const r=Services.validateProject(p);assert(r.issues.some(i=>i.code==='NW-SVC-009'&&i.blocking));});
console.log('\nTests internal services completados.');