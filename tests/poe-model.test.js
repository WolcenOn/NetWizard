'use strict';
const assert=require('assert');
const model=require('../js/netwizard-poe-model.js');
const poe=require('../js/netwizard-poe-utils.js');
const project={
 devices:[{id:'sw1',name:'SW-POE',type:'switch',poeBudgetW:120}],
 ports:[
  {id:'p1',deviceId:'sw1',name:'Gi1/0/1',poeMode:'auto',poeWattsMax:30,media:'copper'},
  {id:'p2',deviceId:'sw1',name:'Gi1/0/2',poeMode:'at',media:'copper'}
 ],
 hosts:[
  {id:'ap1',name:'AP-01',type:'ap',portId:'p1',poeMode:'auto',poeWatts:22},
  {id:'cam1',name:'CAM-01',type:'camera',connectedPortId:'p2',poeMode:'yes',poeWatts:12}
 ]
};
assert.strictEqual(model.hostPortId(project.hosts[0]),'p1');
assert.strictEqual(model.hostPortId(project.hosts[1]),'p2');
assert.strictEqual(model.normalizePoeMode('yes'),'required');
assert.strictEqual(model.portPoeCapacity(project.ports[0]).watts,30);
let audit=poe.validatePoe(project);
assert.strictEqual(audit.errors.length,0);
assert.ok(!audit.issues.some(i=>i.code==='NW-POE-002'));
assert.ok(!audit.issues.some(i=>i.code==='NW-POE-005'));
project.ports[0].poeWattsMax=20;
audit=poe.validatePoe(project);
assert.ok(audit.issues.some(i=>i.code==='NW-POE-005'));
project.ports[0].poeWattsMax=40;
audit=poe.validatePoe(project);
assert.ok(!audit.issues.some(i=>i.code==='NW-POE-005'));
console.log('✓ PoE resuelve aliases, modo requerido y elimina falsos positivos al aumentar capacidad');
