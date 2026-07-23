'use strict';
const assert=require('assert');
const Failure=require('../js/netwizard-failure-simulation.js');
function test(name,fn){try{fn();console.log(`✓ ${name}`);}catch(err){console.error(`✗ ${name}`);throw err;}}
const base={devices:[{id:'fw1',rack:'r1'},{id:'fw2',rack:'r2'},{id:'dns1'}],ports:[],links:[{id:'l1'}],wanCircuits:[{id:'c1',deviceId:'fw1',provider:'ISP-A'},{id:'c2',deviceId:'fw2',provider:'ISP-B'}],internalServices:[{id:'dns',critical:true,endpoints:[{deviceId:'dns1'}]},{id:'radius',critical:false,endpoints:[{deviceId:'fw1'}],dependsOn:['dns']}],failureScenarios:[{id:'s1',name:'Caída ISP-A',events:[{type:'provider',targetRef:'ISP-A'}],mustSurvive:[{type:'wan',ref:'internet'}]},{id:'s2',name:'Caída DNS',events:[{type:'device',targetRef:'dns1'}],mustSurvive:[{type:'service',ref:'dns'}]}]};
test('Failover WAN mantiene conectividad',()=>{const r=Failure.simulateScenario(base,base.failureScenarios[0]);assert.notStrictEqual(r.status,'failed');assert.deepStrictEqual(r.activeCircuitIds,['c2']);});
test('Servicio crítico caído bloquea',()=>{const r=Failure.simulateScenario(base,base.failureScenarios[1]);assert.strictEqual(r.status,'failed');assert(r.issues.some(i=>i.code==='NW-FAIL-004'&&i.blocking));});
test('Objetivo inexistente bloquea',()=>{const r=Failure.simulateScenario(base,{id:'bad',events:[{type:'device',targetRef:'missing'}]});assert(r.issues.some(i=>i.code==='NW-FAIL-001'));});
test('Informe de proyecto agrega escenarios',()=>{const r=Failure.validateProject(base);assert.strictEqual(r.scenarios.length,2);assert.strictEqual(r.ok,false);});
console.log('\nTests failure simulation completados.');
