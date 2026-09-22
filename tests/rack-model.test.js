'use strict';
const assert=require('assert');
const rack=require('../js/netwizard-rack-model.js');
const report=require('../js/netwizard-report-model.js');
const project={
 projName:'CPD ejemplo',
 racks:[{id:'rack1',name:'Rack HQ',rackUnits:12,maxLoadKg:100,powerCapacityWatts:1000,coolingCapacityWatts:1000}],
 devices:[
  {id:'sw1',name:'SW-CORE',rackId:'rack1',rackUnit:8,rackUnits:1,weightKg:8,powerDrawWatts:120},
  {id:'fw1',name:'FW-EDGE',rackId:'rack1',rackUnit:6,rackUnits:2,weightKg:10,powerDrawWatts:90}
 ],
 rackItems:[
  {id:'pp1',rackId:'rack1',type:'patch-panel',label:'Patch panel 24p',startUnit:10,heightUnits:1},
  {id:'cm1',rackId:'rack1',type:'cable-manager',label:'Pasacables',startUnit:9,heightUnits:1}
 ],
 patchPanels:[{id:'patch1',rackId:'rack1',name:'PP cobre',portCount:24}],
 pdus:[{id:'pduA',rackId:'rack1',name:'PDU A',outletCount:12},{id:'pduB',rackId:'rack1',name:'PDU B',outletCount:12}],
 powerConnections:[
  {id:'pc1',deviceId:'sw1',pduId:'pduA',outlet:1,feed:'A'},
  {id:'pc2',deviceId:'sw1',pduId:'pduB',outlet:1,feed:'B'}
 ],
 ports:[{id:'p1',deviceId:'sw1',name:'Gi1/0/1'},{id:'p2',deviceId:'fw1',name:'port1'}],
 links:[{id:'l1',aPortId:'p1',bPortId:'p2',cableType:'Cat6A',capacityMbps:1000}],
 hosts:[],vlans:[],wanCircuits:[]
};
let audit=rack.validate(project);
assert.strictEqual(audit.ok,true);
assert.strictEqual(audit.issues.length,0);
assert.ok(rack.billOfMaterials(project).some(x=>x.kind==='Patch panel'));
const model=report.build(project,{});
assert.strictEqual(model.summary.racks,1);
assert.strictEqual(model.connectivity[0].aPort,'SW-CORE · Gi1/0/1');
assert.ok(model.materials.some(x=>x.kind==='PDU'));
project.rackItems.push({id:'collision',rackId:'rack1',type:'shelf',label:'Bandeja',startUnit:8,heightUnits:1});
audit=rack.validate(project);
assert.ok(audit.issues.some(i=>i.code==='NW-RACK-001'));
project.powerConnections.push({id:'pc3',deviceId:'fw1',pduId:'pduA',outlet:1,feed:'A'});
audit=rack.validate(project);
assert.ok(audit.issues.some(i=>i.code==='NW-RACK-007'));
console.log('✓ Racks validan ocupación, alimentación y alimentan inventario/conectividad del informe');
