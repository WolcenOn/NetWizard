'use strict';
const assert=require('assert');
const R=require('../js/netwizard-resilience-topology.js');
function test(name,fn){try{fn();console.log(`✓ ${name}`);}catch(e){console.error(`✗ ${name}`);throw e;}}
const devices=[{id:'a',rack:'R1',powerDomain:'PDU-A'},{id:'b',rack:'R1',powerDomain:'PDU-A'},{id:'c',rack:'R2',powerDomain:'PDU-B'}];
test('Stack exige dos miembros',()=>{const r=R.validateProject({devices,stacks:[{id:'s1',members:[{deviceId:'a',priority:15}]}]});assert(r.issues.some(i=>i.code==='NW-RES-001'&&i.blocking));});
test('MLAG exige dos peers y peer-link',()=>{const r=R.validateProject({devices,ports:[],mlagDomains:[{id:'m1',peerDeviceIds:['a']} ]});assert(r.issues.some(i=>i.code==='NW-RES-010'));assert(r.issues.some(i=>i.code==='NW-RES-012'));});
test('HA detecta dominio de fallo compartido',()=>{const r=R.validateProject({devices,haGroups:[{id:'h1',mode:'active-passive',memberDeviceIds:['a','b']}]});assert(r.issues.some(i=>i.code==='NW-RES-022'&&i.failureDimension==='rack'));assert(r.issues.some(i=>i.code==='NW-RES-023'));});
test('Diversidad física bloquea racks compartidos',()=>{const r=R.validateProject({devices,diversityPolicies:[{id:'d1',deviceIds:['a','b'],requiredDistinct:['rack','powerDomain']}]});assert.strictEqual(r.ok,false);assert(r.issues.some(i=>i.code==='NW-RES-032'));});
test('Diseño diverso coherente no bloquea',()=>{const r=R.validateProject({devices,haGroups:[{id:'h2',memberDeviceIds:['a','c'],heartbeatLinkRef:'l1'}],diversityPolicies:[{id:'d2',deviceIds:['a','c'],requiredDistinct:['rack','powerDomain']}]});assert.strictEqual(r.ok,true);});
console.log('\nTests resilience topology completados.');
