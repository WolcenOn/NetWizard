'use strict';
const assert=require('assert');
const Capacity=require('../js/netwizard-traffic-capacity.js');
function test(name,fn){try{fn();console.log(`✓ ${name}`);}catch(err){console.error(`✗ ${name}`);throw err;}}
const base={ports:[{id:'p1',negotiatedSpeedMbps:1000},{id:'p2',negotiatedSpeedMbps:1000}],links:[{id:'l1',name:'Core uplink',aPortId:'p1',bPortId:'p2'}],wanCircuits:[{id:'c1',name:'Internet',bandwidthUpMbps:500,bandwidthDownMbps:1000}],trafficProfiles:[{id:'voice',name:'VoIP',circuitRef:'c1',averageMbps:20,peakMbps:80,criticalMbps:60,latencyMaxMs:150,jitterMaxMs:30,lossMaxPercent:1},{id:'lan',name:'LAN',linkRef:'l1',averageMbps:200,peakMbps:700,criticalMbps:200}]};
test('Perfiles coherentes generan análisis',()=>{const r=Capacity.validateProject(base);assert.strictEqual(r.ok,true);assert(r.analyses.some(a=>a.id==='c1'&&a.peakMbps===80));assert(r.analyses.some(a=>a.id==='l1'&&a.capacityMbps===1000));});
test('Pico superior a capacidad bloquea',()=>{const p=JSON.parse(JSON.stringify(base));p.trafficProfiles[0].peakMbps=600;const r=Capacity.validateProject(p);assert(r.issues.some(i=>i.code==='NW-CAPACITY-010'&&i.blocking));});
test('Utilización superior al 80 por ciento avisa',()=>{const p=JSON.parse(JSON.stringify(base));p.trafficProfiles[1].peakMbps=900;const r=Capacity.validateProject(p);assert(r.issues.some(i=>i.code==='NW-CAPACITY-011'&&!i.blocking));});
test('Media superior al pico avisa',()=>{const p=JSON.parse(JSON.stringify(base));p.trafficProfiles[0].averageMbps=100;const r=Capacity.validateProject(p);assert(r.issues.some(i=>i.code==='NW-CAPACITY-003'));});
console.log('\nTests traffic capacity completados.');
