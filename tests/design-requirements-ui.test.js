'use strict';

const assert=require('assert');
global.NetWizardDesignRequirements=require('../js/netwizard-design-requirements.js');
const Ui=require('../js/netwizard-design-requirements-ui.js');

const project={
  designRequirements:{locationPlans:[]},
  physicalLocations:[{id:'l1',name:'Planta 1'}]
};
let next=Ui.upsertLocationPlan(project,{
  id:'plan1',locationId:'l1',rackMode:'own',servingLocationId:'',
  capacityPolicy:{portGrowthPercent:25,minFreePorts:12,rackGrowthPercent:20,minFreeRackUnits:4},
  rackPolicy:{patchPanelPorts:24,organizerPerSwitch:true,layoutPattern:'patch-manager-switch'},
  demands:[]
});
assert.strictEqual(next.designRequirements.locationPlans.length,1);
assert.strictEqual(next.designRequirements.locationPlans[0].capacityPolicy.portGrowthPercent,25);

next=Ui.upsertDemand(next,'l1',{
  id:'d1',label:'AP',category:'access_point',count:6,media:'copper',speedMinMbps:2500,poeRequired:true,poeWattsEach:25
});
assert.strictEqual(next.designRequirements.locationPlans[0].demands.length,1);
assert.strictEqual(next.designRequirements.locationPlans[0].demands[0].count,6);

next=Ui.upsertDemand(next,'l1',{
  id:'d1',label:'AP WiFi',category:'access_point',count:8,media:'copper',speedMinMbps:2500,poeRequired:true,poeWattsEach:25
});
assert.strictEqual(next.designRequirements.locationPlans[0].demands.length,1);
assert.strictEqual(next.designRequirements.locationPlans[0].demands[0].count,8);

next=Ui.removeDemand(next,'l1','d1');
assert.strictEqual(next.designRequirements.locationPlans[0].demands.length,0);
assert.strictEqual(project.designRequirements.locationPlans.length,0,'UI helpers must not mutate source project');

console.log('✓ UI Golden Path actualiza requisitos sin duplicar entidades ni mutar el origen');
