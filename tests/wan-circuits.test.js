'use strict';
const assert=require('assert');
const Wan=require('../js/netwizard-wan-circuits.js');
function test(name,fn){try{fn();console.log(`✓ ${name}`);}catch(err){console.error(`✗ ${name}`);throw err;}}
const base={devices:[{id:'fw1'},{id:'fw2'}],ports:[{id:'wan1',deviceId:'fw1'},{id:'wan2',deviceId:'fw2'}],trafficProfiles:[{id:'tp1',peakMbps:120}],wanCircuits:[{id:'c1',name:'DIA principal',deviceId:'fw1',portId:'wan1',provider:'ISP-A',role:'primary',bandwidthDownMbps:500,bandwidthUpMbps:200,latencyTargetMs:20,lossTargetPercent:1,slaAvailability:99.9,physicalPath:'duct-a'},{id:'c2',name:'Backup',deviceId:'fw2',portId:'wan2',provider:'ISP-B',role:'backup',bandwidthDownMbps:200,bandwidthUpMbps:150,physicalPath:'duct-b'}]};
test('WAN coherente pasa validación',()=>{const r=Wan.validateProject(base);assert.strictEqual(r.ok,true);assert.strictEqual(r.counts.blocking,0);});
test('Demanda superior a capacidad bloquea',()=>{const p=JSON.parse(JSON.stringify(base));p.wanCircuits[0].expectedPeakMbps=250;const r=Wan.validateProject(p);assert(r.issues.some(i=>i.code==='NW-WAN-008'&&i.blocking));});
test('Redundancia con mismo proveedor avisa',()=>{const p=JSON.parse(JSON.stringify(base));p.wanCircuits[1].provider='ISP-A';const r=Wan.validateProject(p);assert(r.issues.some(i=>i.code==='NW-WAN-010'&&!i.blocking));});
test('Referencia WAN inexistente bloquea',()=>{const p=JSON.parse(JSON.stringify(base));p.wanCircuits[0].portId='missing';const r=Wan.validateProject(p);assert(r.issues.some(i=>i.code==='NW-WAN-004'));});
console.log('\nTests WAN circuits completados.');
