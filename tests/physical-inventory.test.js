'use strict';
const assert=require('assert');
const Inventory=require('../js/netwizard-physical-inventory.js');
function test(name,fn){try{fn();console.log(`✓ ${name}`);}catch(err){console.error(`✗ ${name}`);throw err;}}
test('detecta consumo superior al presupuesto',()=>{const r=Inventory.validateProject({devices:[{id:'sw1',name:'SW1',powerBudgetWatts:500,powerDrawWatts:650}],ports:[]});assert(r.issues.some(i=>i.code==='NW-PHY-004'&&i.blocking));});
test('detecta velocidad negociada superior al máximo',()=>{const r=Inventory.validateProject({devices:[],ports:[{id:'p1',deviceId:'sw1',name:'Gi1/0/1',speedMaxMbps:1000,negotiatedSpeedMbps:10000}]});assert(r.issues.some(i=>i.code==='NW-IF-001'));});
test('avisa de utilización alta y óptica sin transceptor',()=>{const r=Inventory.validateProject({devices:[],ports:[{id:'p1',deviceId:'sw1',name:'Te1/1/1',media:'SFP+',utilizationPercent:92}]});assert(r.issues.some(i=>i.code==='NW-IF-004'));assert(r.issues.some(i=>i.code==='NW-IF-006'));});
test('acepta inventario coherente',()=>{const r=Inventory.validateProject({devices:[{id:'sw1',rackUnit:20,rackUnits:1,powerBudgetWatts:500,powerDrawWatts:200}],ports:[{id:'p1',deviceId:'sw1',speedMaxMbps:10000,negotiatedSpeedMbps:10000,mtu:1500,utilizationPercent:40,adminState:'up',operState:'up',media:'SFP+',transceiver:'10GBASE-LR'}]});assert.strictEqual(r.ok,true);});
console.log('\nTests physical inventory completados.');
