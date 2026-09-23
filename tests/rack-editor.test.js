'use strict';
const assert=require('assert');
const UI=require('../js/netwizard-rack-ui.js');
let project={devices:[{id:'sw1',name:'SW-01'}],physicalLocations:[{id:'room1',name:'CPD'}]};
project=UI.addRack(project,{id:'rack1',name:'Rack principal',locationId:'room1',rackUnits:24,powerCapacityWatts:4000});
assert.strictEqual(project.racks.length,1);
assert.strictEqual(project.racks[0].rackUnits,24);
project=UI.upsertRackItem(project,{id:'item1',rackId:'rack1',type:'device',deviceId:'sw1',label:'SW-01',startUnit:20,heightUnits:1});
assert.strictEqual(project.rackItems.length,1);
assert.strictEqual(project.devices[0].rackId,'rack1');
assert.strictEqual(project.devices[0].rackUnit,20);
project=UI.addPdu(project,{id:'pdu1',rackId:'rack1',name:'PDU-A',feed:'A',outletCount:12,maxPowerWatts:3680});
assert.strictEqual(project.pdus[0].outletCount,12);
project=UI.addPowerConnection(project,{id:'power1',deviceId:'sw1',pduId:'pdu1',outlet:3,powerSupplyIndex:0,feed:'A'});
assert.strictEqual(project.powerConnections[0].outlet,3);
const untouched={devices:project.devices.length,racks:project.racks.length};
const removed=UI.removeEntity(project,'pdu','pdu1');
assert.strictEqual(removed.pdus.length,0);
assert.strictEqual(removed.powerConnections.length,0);
assert.deepStrictEqual(untouched,{devices:removed.devices.length,racks:removed.racks.length});
const cleared=UI.removeEntity(project,'rack','rack1');
assert.strictEqual(cleared.racks.length,0);
assert.strictEqual(cleared.rackItems.length,0);
assert.strictEqual(cleared.pdus.length,0);
assert.strictEqual(cleared.devices[0].rackId,null);

let interactive={
  devices:[
    {id:'sw2',name:'SW-02',rackId:'rackA',rackUnit:10,rackUnits:1},
    {id:'srv1',name:'SRV-01',rackId:'rackA',rackUnit:7,rackUnits:2}
  ],
  racks:[
    {id:'rackA',name:'Rack A',rackUnits:24},
    {id:'rackB',name:'Rack B',rackUnits:24}
  ],
  rackItems:[
    {id:'ri-sw2',rackId:'rackA',type:'device',deviceId:'sw2',label:'SW-02',startUnit:10,heightUnits:1,face:'front'},
    {id:'ri-srv1',rackId:'rackA',type:'device',deviceId:'srv1',label:'SRV-01',startUnit:7,heightUnits:2,face:'front'},
    {id:'ri-pp1',rackId:'rackA',type:'patch-panel',patchPanelId:'pp1',label:'PP-01',startUnit:20,heightUnits:1,face:'front'}
  ],
  patchPanels:[{id:'pp1',rackId:'rackA',rackUnit:20,name:'PP-01',portCount:24}],
  cableRuns:[{id:'run1',patchPanelId:'pp1',patchPort:1,outletId:'to1',outletPort:1}],
  patchConnections:[{id:'pc1',patchPanelId:'pp1',patchPort:1,switchPortId:'p1'}],
  pdus:[],powerConnections:[]
};
let moved=UI.moveRackItem(interactive,'ri-sw2','rackB',15);
assert.strictEqual(moved.ok,true);
assert.strictEqual(moved.project.rackItems.find(x=>x.id==='ri-sw2').rackId,'rackB');
assert.strictEqual(moved.project.rackItems.find(x=>x.id==='ri-sw2').startUnit,15);
assert.strictEqual(moved.project.devices.find(x=>x.id==='sw2').rackId,'rackB');
assert.strictEqual(moved.project.devices.find(x=>x.id==='sw2').rackUnit,15);

let panelMoved=UI.moveRackItem(interactive,'ri-pp1','rackB',18);
assert.strictEqual(panelMoved.ok,true);
assert.strictEqual(panelMoved.project.patchPanels[0].rackId,'rackB');
assert.strictEqual(panelMoved.project.patchPanels[0].rackUnit,18);
assert.strictEqual(panelMoved.project.cableRuns[0].patchPanelId,'pp1');
assert.strictEqual(panelMoved.project.patchConnections[0].patchPanelId,'pp1');

const collision=UI.moveRackItem(interactive,'ri-sw2','rackA',7);
assert.strictEqual(collision.ok,false);
assert.match(collision.message,/colisionaría/i);
assert.strictEqual(collision.project.devices.find(x=>x.id==='sw2').rackUnit,10);

const outOfRange=UI.moveRackItem(interactive,'ri-srv1','rackA',24);
assert.strictEqual(outOfRange.ok,false);
assert.match(outOfRange.message,/no admite/i);

const removedPanelItem=UI.removeEntity(interactive,'rackItem','ri-pp1');
assert.strictEqual(removedPanelItem.patchPanels[0].rackId,null);
assert.strictEqual(removedPanelItem.patchPanels[0].rackUnit,null);
assert.strictEqual(removedPanelItem.cableRuns[0].patchPanelId,'pp1');

console.log('✓ Editor de racks crea, coloca, conecta y elimina entidades manteniendo referencias coherentes');
