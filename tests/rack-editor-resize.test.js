'use strict';

const assert=require('assert');
const RackModel=require('../js/netwizard-rack-model.js');
const RackUi=require('../js/netwizard-rack-ui.js');

const project={
  designRequirements:{
    capacityPolicy:{rackGrowthPercent:20,minFreeRackUnits:4}
  },
  physicalLocations:[
    {id:'room-a',name:'Sala A',type:'room'},
    {id:'room-b',name:'Sala B',type:'room'}
  ],
  racks:[
    {id:'rack1',name:'Rack 42U sobredimensionado',locationId:'room-a',rackUnits:42,widthMm:600,depthMm:1000,maxLoadKg:800,powerCapacityWatts:7000,coolingCapacityWatts:5000,numberingDirection:'bottom-up'}
  ],
  devices:[
    {id:'sw1',name:'SW-ACCESS-01',rackId:'rack1',rack:'rack1',rackUnit:8,rackUnits:1,rackFace:'front',powerDrawWatts:120}
  ],
  rackItems:[
    {id:'cm1',rackId:'rack1',type:'cable-manager',label:'Pasacables',startUnit:7,heightUnits:1,face:'front'},
    {id:'pp-item',rackId:'rack1',type:'patch-panel',patchPanelId:'pp1',label:'Patch panel 24p',startUnit:9,heightUnits:1,face:'front'}
  ],
  patchPanels:[
    {id:'pp1',rackId:'rack1',rackUnit:9,name:'PP-01',portCount:24},
    {id:'pp-standalone',rackId:'rack1',rackUnit:10,name:'PP-LEGACY',portCount:24}
  ],
  pdus:[{id:'pdu1',rackId:'rack1',name:'PDU-A',mounting:'vertical-rear',outletCount:12}],
  powerConnections:[{id:'pc1',deviceId:'sw1',pduId:'pdu1',outlet:1,feed:'A'}],
  ports:[],links:[],hosts:[]
};

const occupancy=RackModel.rackOccupancy(project,'rack1');
assert.strictEqual(occupancy.usedCount,4);
assert.deepStrictEqual(occupancy.usedUnits,[7,8,9,10]);
assert.strictEqual(occupancy.maxUsedUnit,10);
assert.ok(occupancy.entries.some(x=>x.id==='pp-standalone'&&x.endUnit===10),'Los patch panels sin rackItem explícito también cuentan para redimensionar');

const recommendation=RackModel.recommendedRackUnits(project,'rack1');
assert.strictEqual(recommendation.occupiedThroughUnit,10);
assert.strictEqual(recommendation.targetUnits,14);
assert.strictEqual(recommendation.recommendedUnits,15,'Con 10U ocupadas y 4U de reserva debe recomendar el siguiente tamaño estándar');

let resize=RackModel.validateRackResize(project,'rack1',9);
assert.strictEqual(resize.ok,false);
assert.ok(resize.blockers.some(x=>x.id==='pp-standalone'));
assert.match(resize.message,/PP-LEGACY/);

resize=RackModel.validateRackResize(project,'rack1',12);
assert.strictEqual(resize.ok,true);
assert.strictEqual(resize.minRackUnits,10);

let updated=RackUi.updateRack(project,'rack1',{
  name:'Rack compacto A',
  rackUnits:12,
  locationId:'room-b',
  widthMm:600,
  depthMm:800,
  maxLoadKg:500,
  powerCapacityWatts:4000,
  coolingCapacityWatts:3000,
  numberingDirection:'top-down'
});
assert.strictEqual(updated.ok,true,updated.message);
assert.strictEqual(updated.rack.id,'rack1','Editar no debe sustituir la autoridad del rack');
assert.strictEqual(updated.rack.name,'Rack compacto A');
assert.strictEqual(updated.rack.rackUnits,12);
assert.strictEqual(updated.rack.locationId,'room-b');
assert.strictEqual(updated.rack.depthMm,800);
assert.strictEqual(updated.rack.numberingDirection,'top-down');
assert.strictEqual(updated.project.devices[0].rackId,'rack1');
assert.strictEqual(updated.project.devices[0].rackUnit,8);
assert.strictEqual(updated.project.patchPanels[0].rackId,'rack1');
assert.strictEqual(updated.project.pdus[0].rackId,'rack1');
assert.strictEqual(updated.project.powerConnections[0].pduId,'pdu1');

const blocked=RackUi.updateRack(project,'rack1',{
  name:'Rack demasiado pequeño',
  rackUnits:9,
  locationId:'room-a',
  widthMm:'',
  depthMm:'',
  maxLoadKg:'',
  powerCapacityWatts:'',
  coolingCapacityWatts:'',
  numberingDirection:'bottom-up'
});
assert.strictEqual(blocked.ok,false);
assert.strictEqual(blocked.project.racks[0].rackUnits,42,'Un resize bloqueado no debe mutar el proyecto');
assert.ok(blocked.resize.blockers.some(x=>x.id==='pp-standalone'));

const cleared=RackUi.updateRack(updated.project,'rack1',{
  name:'Rack compacto A',
  rackUnits:12,
  locationId:'',
  widthMm:'',
  depthMm:'',
  maxLoadKg:'',
  powerCapacityWatts:'',
  coolingCapacityWatts:'',
  numberingDirection:'bottom-up'
});
assert.strictEqual(cleared.ok,true);
assert.strictEqual(cleared.rack.locationId,null);
assert.strictEqual(cleared.rack.widthMm,null);
assert.strictEqual(cleared.rack.depthMm,null);
assert.strictEqual(cleared.rack.maxLoadKg,null);
assert.strictEqual(cleared.rack.powerCapacityWatts,null);
assert.strictEqual(cleared.rack.coolingCapacityWatts,null);

const invalid=RackUi.updateRack(project,'rack1',{rackUnits:0});
assert.strictEqual(invalid.ok,false);
assert.match(invalid.message,/al menos 1U/);

console.log('✓ Rack editor redimensiona con seguridad, recomienda tamaño y preserva referencias físicas');
