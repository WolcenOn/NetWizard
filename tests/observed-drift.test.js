'use strict';
const assert=require('assert');
const Drift=require('../js/netwizard-observed-drift.js');
function test(name,fn){try{fn();console.log(`✓ ${name}`);}catch(err){console.error(`✗ ${name}`);throw err;}}
const base={devices:[{id:'fw1',name:'Firewall',critical:true,enabled:true}],ports:[{id:'p1',deviceId:'fw1',adminState:'up',operState:'up'}],links:[],vlans:[{id:'v10',name:'Users'}],wanCircuits:[{id:'c1',provider:'ISP-A',bandwidthUpMbps:500,bandwidthDownMbps:1000}],internalServices:[],wifiAccessPoints:[],wifiSsids:[],vrfs:[],ipv6Networks:[],observedState:{observedAt:'2026-07-23T10:00:00Z',devices:[{id:'fw1',name:'Firewall',critical:true,enabled:true}],ports:[{id:'p1',deviceId:'fw1',adminState:'up',operState:'up'}],links:[],vlans:[{id:'v10',name:'Users'}],wanCircuits:[{id:'c1',provider:'ISP-A',bandwidthUpMbps:500,bandwidthDownMbps:1000}],internalServices:[],wifiAccessPoints:[],wifiSsids:[],vrfs:[],ipv6Networks:[]}};
test('Estado observado coherente no genera drift',()=>{const r=Drift.validateProject(base);assert.strictEqual(r.ok,true);assert.strictEqual(r.drift.length,0);});
test('Dispositivo crítico ausente bloquea',()=>{const p=JSON.parse(JSON.stringify(base));p.observedState.devices=[];const r=Drift.validateProject(p);assert(r.issues.some(i=>i.code==='NW-DRIFT-001'&&i.blocking));});
test('Cambio crítico de proveedor bloquea',()=>{const p=JSON.parse(JSON.stringify(base));p.observedState.wanCircuits[0].provider='ISP-B';const r=Drift.validateProject(p);assert(r.issues.some(i=>i.code==='NW-DRIFT-002'&&i.field==='provider'&&i.blocking));});
test('Recurso inesperado genera aviso',()=>{const p=JSON.parse(JSON.stringify(base));p.observedState.vlans.push({id:'v99',name:'Shadow'});const r=Drift.validateProject(p);assert(r.issues.some(i=>i.code==='NW-DRIFT-003'&&!i.blocking));});
console.log('\nTests observed drift completados.');
