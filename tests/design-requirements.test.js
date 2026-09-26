'use strict';

const assert=require('assert');
const Planner=require('../js/netwizard-design-requirements.js');
const Schema=require('../js/netwizard-project-schema.js');
const Rack=require('../js/netwizard-rack-model.js');

const project={
  workflow:{mode:'design'},
  physicalLocations:[
    {id:'hq',name:'CPD',type:'room'},
    {id:'floor1',name:'Planta 1',type:'floor',parentId:'hq'}
  ],
  designRequirements:{
    capacityPolicy:{portGrowthPercent:20,minFreePorts:8,rackGrowthPercent:20,minFreeRackUnits:4},
    rackPolicy:{patchPanelPorts:24,organizerPerSwitch:true,layoutPattern:'patch-manager-switch'},
    locationPlans:[
      {
        id:'plan-hq',locationId:'hq',rackMode:'own',servingLocationId:'',
        capacityPolicy:{portGrowthPercent:20,minFreePorts:8,rackGrowthPercent:20,minFreeRackUnits:4},
        rackPolicy:{patchPanelPorts:24,organizerPerSwitch:true,layoutPattern:'patch-manager-switch'},
        demands:[{id:'servers',label:'Servidores fibra',category:'server',count:4,media:'fiber',speedMinMbps:10000,poeRequired:false,poeWattsEach:0}]
      },
      {
        id:'plan-floor1',locationId:'floor1',rackMode:'served',servingLocationId:'hq',
        capacityPolicy:{portGrowthPercent:20,minFreePorts:8,rackGrowthPercent:20,minFreeRackUnits:4},
        rackPolicy:{patchPanelPorts:24,organizerPerSwitch:true,layoutPattern:'patch-manager-switch'},
        demands:[
          {id:'users',label:'Puestos',category:'user',count:42,media:'copper',speedMinMbps:1000,poeRequired:false,poeWattsEach:0},
          {id:'aps',label:'AP WiFi',category:'access_point',count:6,media:'copper',speedMinMbps:2500,poeRequired:true,poeWattsEach:25},
          {id:'cams',label:'Cámaras',category:'camera',count:8,media:'copper',speedMinMbps:1000,poeRequired:true,poeWattsEach:12},
          {id:'phones',label:'Teléfonos',category:'phone',count:35,media:'copper',speedMinMbps:1000,poeRequired:true,poeWattsEach:7}
        ]
      }
    ]
  },
  customDeviceModels:[],devices:[],ports:[],vlans:[],subnets:[],hosts:[],links:[],fwRules:[],dhcp:{},
  racks:[],rackItems:[],pdus:[],powerConnections:[],patchPanels:[],telecomOutlets:[],cableRuns:[],patchConnections:[],hostOutletConnections:[],
  iot:{accessNodes:[],devices:[],map:{show:{}}}
};

const resolved=Planner.resolveServingLocation(project,'floor1');
assert.strictEqual(resolved.ok,true);
assert.strictEqual(resolved.locationId,'hq');

const plan=Planner.buildLocationPlan(project,'hq');
assert.deepStrictEqual(plan.contributors.sort(),['floor1','hq']);
assert.strictEqual(plan.summary.currentPorts,95);
assert.strictEqual(plan.summary.targetPorts,114);
assert.strictEqual(plan.summary.targetFiberPorts,5);
assert.strictEqual(plan.summary.targetCopperPorts,109);
assert.strictEqual(plan.summary.targetMultigigPorts,8);
assert.strictEqual(plan.summary.currentPoePorts,49);
assert.strictEqual(plan.summary.targetPoePorts,59);
assert.strictEqual(plan.summary.targetPoeWatts,590);
assert.strictEqual(plan.switches.length,3);
assert.deepStrictEqual(plan.switches.map(x=>x.ports),[24,48,48]);
assert.strictEqual(plan.switches[0].speedClass,'multigig');
assert.strictEqual(plan.rack.patchPanels,5);
assert.strictEqual(plan.rack.organizerUnits,3);
assert.strictEqual(plan.rack.fiberPanelUnits,1);
assert.strictEqual(plan.rack.baseUnits,12);
assert.strictEqual(plan.rack.reserveUnits,4);
assert.strictEqual(plan.rack.rackCount,1);
assert.strictEqual(plan.rack.rackUnits,18);

let seq=0;
const result=Planner.materializeLocationPlan(project,'hq',{idFactory:prefix=>`${prefix}-${++seq}`});
assert.strictEqual(result.ok,true,result.message);
assert.deepStrictEqual(result.created,{racks:1,devices:3,ports:120,patchPanels:5,organizers:3,fiberPanels:1,reservedBlocks:1});
assert.strictEqual(project.racks.length,0,'materialize must not mutate source project');
assert.strictEqual(result.project.racks[0].rackUnits,18);
assert.strictEqual(result.project.devices.length,3);
assert.ok(result.project.devices.every(d=>d.planningSource==='design-requirements'));
assert.ok(result.project.devices.every(d=>d.locationId==='hq'));
assert.strictEqual(result.project.ports.length,120);
assert.strictEqual(result.project.patchPanels.length,5);
assert.ok(result.project.rackItems.some(x=>x.type==='fiber-patch-panel'));
const reserved=result.project.rackItems.find(x=>x.type==='reserved');
assert.ok(reserved);
assert.strictEqual(reserved.heightUnits,4);
assert.strictEqual(reserved.startUnit,1);
assert.strictEqual(Rack.validate(result.project).ok,true);

const second=Planner.materializeLocationPlan(result.project,'hq',{idFactory:prefix=>prefix+'-again'});
assert.strictEqual(second.ok,false);
assert.strictEqual(second.code,'already_materialized');

const served=Planner.materializeLocationPlan(project,'floor1');
assert.strictEqual(served.ok,false);
assert.strictEqual(served.code,'rack_not_owned');

const loopProject=JSON.parse(JSON.stringify(project));
loopProject.designRequirements.locationPlans[0].rackMode='served';
loopProject.designRequirements.locationPlans[0].servingLocationId='floor1';
assert.strictEqual(Planner.resolveServingLocation(loopProject,'hq').ok,false);

const prepared=Schema.prepareImport(project);
assert.strictEqual(prepared.ok,true,prepared.errors.join('\n'));
assert.strictEqual(prepared.project.designRequirements.locationPlans.length,2);
assert.strictEqual(prepared.project.designRequirements.capacityPolicy.portGrowthPercent,20);
const exported=Schema.prepareExport(prepared.project);
assert.strictEqual(exported.project.designRequirements.locationPlans[1].servingLocationId,'hq');

const invalid=Schema.prepareImport({...project,designRequirements:{...project.designRequirements,locationPlans:[
  {...project.designRequirements.locationPlans[1],servingLocationId:'missing'}
]}});
assert.strictEqual(invalid.ok,false);
assert.ok(invalid.errors.some(x=>x.includes('servingLocationId inexistente')));

console.log('✓ Golden Path por ubicación dimensiona capacidad y materializa infraestructura canónica');
