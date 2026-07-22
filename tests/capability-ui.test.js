'use strict';
const assert=require('assert');
global.NetWizardCapabilityRegistry=require('../js/netwizard-capability-registry.js');
const UI=require('../js/netwizard-capability-ui.js');
function test(name,fn){try{fn();console.log(`✓ ${name}`);}catch(err){console.error(`✗ ${name}`);throw err;}}
const project={routing:{strategy:'ospf'},devices:[{id:'r1',name:'R1',vendorOs:'cisco_ios',osVersion:'17.9',model:'C9300'},{id:'x1',name:'Unknown',vendorOs:'unknown_os'}]};
test('Capability UI construye resumen por dispositivo',()=>{const m=UI.buildModel(project);assert.strictEqual(m.devices.length,2);assert.strictEqual(m.devices[0].platform.id,'cisco_ios');assert.ok(m.devices[0].rows.some(r=>r.id==='ospf'));});
test('Capability UI refleja plataforma no registrada',()=>{const m=UI.buildModel(project);assert.strictEqual(m.devices[1].platform,null);assert.ok(m.devices[1].issues.some(i=>i.code==='NW-CAP-000'));});
console.log('\nTests capability UI completados.');