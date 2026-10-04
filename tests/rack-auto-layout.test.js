'use strict';

const assert=require('assert');
const Rack=require('../js/netwizard-rack-model.js');

function fixture(){
  return{
    designRequirements:{
      capacityPolicy:{rackGrowthPercent:20,minFreeRackUnits:4},
      rackPolicy:{patchPanelPorts:24,organizerPerSwitch:true,layoutPattern:'patch-manager-switch'}
    },
    racks:[{id:'rack1',name:'Rack oficina',rackUnits:18,numberingDirection:'bottom-up'}],
    devices:[
      {id:'router1',name:'RTR-01',kind:'router',type:'router',rackId:'rack1',rack:'rack1',rackUnit:1,rackUnits:1,rackFace:'front'},
      {id:'sw2',name:'SW-ACCESS-02',kind:'switch',type:'switch',rackId:'rack1',rack:'rack1',rackUnit:9,rackUnits:1,rackFace:'front'},
      {id:'sw1',name:'SW-ACCESS-01',kind:'switch',type:'switch',rackId:'rack1',rack:'rack1',rackUnit:12,rackUnits:1,rackFace:'front'}
    ],
    ports:[
      {id:'sw1-p1',deviceId:'sw1',name:'Gi1/0/1',mode:'access',media:'GE'},
      {id:'sw1-up',deviceId:'sw1',name:'Gi1/0/48',mode:'trunk',role:'uplink',media:'SFP+'},
      {id:'sw2-p1',deviceId:'sw2',name:'Gi1/0/1',mode:'access',media:'GE'},
      {id:'sw2-up',deviceId:'sw2',name:'Gi1/0/48',mode:'trunk',role:'uplink',media:'SFP+'}
    ],
    patchPanels:[
      {id:'pp-existing',rackId:'rack1',name:'PP-SW1',portCount:24,category:'Cat6A',rackUnit:14}
    ],
    patchConnections:[
      {id:'pc-sw1',patchPanelId:'pp-existing',patchPort:1,switchPortId:'sw1-p1',patchCordLengthM:1}
    ],
    rackItems:[
      {id:'pp-item-existing',rackId:'rack1',type:'patch-panel',patchPanelId:'pp-existing',label:'PP-SW1',startUnit:14,heightUnits:1,face:'front'},
      {id:'cm-existing',rackId:'rack1',type:'cable-manager',label:'Organizador existente',startUnit:13,heightUnits:1,face:'front'}
    ],
    pdus:[],powerConnections:[],links:[],hosts:[]
  };
}

let project=fixture();
const plan=Rack.planRackAutoLayout(project,'rack1');
assert.strictEqual(plan.ok,true,plan.message);
assert.strictEqual(plan.policy.layoutPattern,'patch-manager-switch');
assert.strictEqual(plan.summary.switches,2);
assert.strictEqual(plan.summary.panels,2);
assert.strictEqual(plan.summary.managers,2);
assert.strictEqual(plan.summary.createPanels,1,'SW2 debe necesitar un panel nuevo');
assert.strictEqual(plan.createdPanels[0].id,'rackauto-pp-rack1-sw2-1');

const sw2Plan=plan.clusters.find(x=>x.switchId==='sw2');
const sw1Plan=plan.clusters.find(x=>x.switchId==='sw1');
assert.strictEqual(sw2Plan.panels[0].startUnit,2,'El router fijo en U1 debe conservarse como obstáculo');
assert.strictEqual(sw2Plan.manager.startUnit,3);
assert.strictEqual(sw2Plan.switchStartUnit,4);
assert.strictEqual(sw1Plan.panels[0].panelId,'pp-existing','Debe reutilizar el panel cableado a SW1');
assert.strictEqual(sw1Plan.panels[0].startUnit,5);
assert.strictEqual(sw1Plan.manager.itemId,'cm-existing','Debe conservar el organizador cercano a SW1');
assert.strictEqual(sw1Plan.manager.startUnit,6);
assert.strictEqual(sw1Plan.switchStartUnit,7);
assert.strictEqual(plan.proposedMaxUnit,7);

const first=Rack.applyRackAutoLayout(project,'rack1');
assert.strictEqual(first.ok,true,first.message);
project=first.project;
assert.strictEqual(project.devices.find(x=>x.id==='router1').rackUnit,1,'El router no debe moverse');
assert.strictEqual(project.devices.find(x=>x.id==='sw2').rackUnit,4);
assert.strictEqual(project.devices.find(x=>x.id==='sw1').rackUnit,7);
assert.strictEqual(project.patchPanels.find(x=>x.id==='pp-existing').rackUnit,5);
assert.strictEqual(project.rackItems.find(x=>x.id==='cm-existing').startUnit,6);
assert.ok(project.patchPanels.some(x=>x.id==='rackauto-pp-rack1-sw2-1'));
assert.ok(project.rackItems.some(x=>x.id==='rackauto-manager-rack1-sw2'));
assert.deepStrictEqual(project.patchConnections,[{id:'pc-sw1',patchPanelId:'pp-existing',patchPort:1,switchPortId:'sw1-p1',patchCordLengthM:1}],'El autolayout no debe reescribir cableado estructurado');
assert.strictEqual(Rack.validate(project).issues.filter(x=>x.code==='NW-RACK-001'||x.code==='NW-RACK-002').length,0);

const countsBefore={panels:project.patchPanels.length,items:project.rackItems.length};
const second=Rack.applyRackAutoLayout(project,'rack1');
assert.strictEqual(second.ok,true,second.message);
assert.strictEqual(second.project.patchPanels.length,countsBefore.panels,'Reaplicar no debe duplicar patch panels');
assert.strictEqual(second.project.rackItems.length,countsBefore.items,'Reaplicar no debe duplicar organizadores o rackItems');
assert.strictEqual(second.project.devices.find(x=>x.id==='sw2').rackUnit,4);
assert.strictEqual(second.project.devices.find(x=>x.id==='sw1').rackUnit,7);
assert.strictEqual(second.project.rackItems.find(x=>x.id==='cm-existing').startUnit,6);

const compact=fixture();
compact.rackItems=compact.rackItems.filter(x=>x.type!=='cable-manager');
const compactPlan=Rack.planRackAutoLayout(compact,'rack1',{layoutPattern:'patch-switch'});
assert.strictEqual(compactPlan.ok,true,compactPlan.message);
assert.strictEqual(compactPlan.summary.managers,0);
assert.ok(compactPlan.clusters.every(x=>!x.manager));
const compactApplied=Rack.applyRackAutoLayout(compact,'rack1',{layoutPattern:'patch-switch'});
assert.strictEqual(compactApplied.ok,true,compactApplied.message);
assert.ok(!compactApplied.project.rackItems.some(x=>x.id.startsWith('rackauto-manager-')));

const manual=Rack.planRackAutoLayout(fixture(),'rack1',{layoutPattern:'manual'});
assert.strictEqual(manual.ok,false);
assert.strictEqual(manual.code,'manual_policy');

const tight=fixture();
tight.racks[0].rackUnits=3;
tight.devices=tight.devices.filter(x=>x.id==='router1'||x.id==='sw1');
tight.ports=tight.ports.filter(x=>x.deviceId==='sw1');
tight.patchPanels=[];
tight.patchConnections=[];
tight.rackItems=[];
const tightPlan=Rack.planRackAutoLayout(tight,'rack1');
assert.strictEqual(tightPlan.ok,false);
assert.strictEqual(tightPlan.code,'insufficient_space');
const tightApply=Rack.applyRackAutoLayout(tight,'rack1');
assert.strictEqual(tightApply.ok,false);
assert.deepStrictEqual(tightApply.project,tight,'Un plan imposible no debe mutar el proyecto');

const shared=fixture();
shared.devices.push({id:'sw3',name:'SW-ACCESS-03',kind:'switch',type:'switch',rackId:'rack1',rack:'rack1',rackUnit:16,rackUnits:1,rackFace:'front'});
shared.ports.push({id:'sw3-p1',deviceId:'sw3',name:'Gi1/0/1',mode:'access',media:'GE'});
shared.patchConnections.push({id:'pc-sw3',patchPanelId:'pp-existing',patchPort:2,switchPortId:'sw3-p1',patchCordLengthM:1});
const sharedPlan=Rack.planRackAutoLayout(shared,'rack1');
assert.strictEqual(sharedPlan.ok,true,sharedPlan.message);
assert.ok(sharedPlan.warnings.some(x=>/compartido/.test(x)));
assert.ok(sharedPlan.clusters.find(x=>x.switchId==='sw1').sharedPanelIds.includes('pp-existing'));
assert.ok(sharedPlan.clusters.find(x=>x.switchId==='sw3').sharedPanelIds.includes('pp-existing'));

console.log('✓ Rack auto-layout compacta, reutiliza paneles/organizadores y es idempotente');
