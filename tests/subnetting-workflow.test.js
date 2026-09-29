'use strict';

const assert=require('assert');
const fs=require('fs');
const path=require('path');
const Planner=require('../js/netwizard-vlsm-physical-planner.js');
const Preview=require('../js/netwizard-change-preview.js');

const project={
  vlans:[
    {id:'v10',vlanId:10,name:'Usuarios'},
    {id:'v20',vlanId:20,name:'Servidores'},
    {id:'v30',vlanId:30,name:'IoT'}
  ],
  subnets:[{id:'sn10',vlanRef:'v10',cidr:'10.10.0.0/24',gateway:'10.10.0.1'}],
  hosts:[],ports:[],devices:[],links:[]
};

const quick=Planner.buildFixedSubnetPlan(project,'10.10.0.0/16',24,{gatewayMode:'first'});
assert.strictEqual(quick.ok,true,quick.msg);
assert.strictEqual(quick.kind,'fixed-missing');
assert.strictEqual(quick.replaceExisting,false);
assert.deepStrictEqual(quick.plans.map(x=>x.vlanRef),['v20','v30']);
assert.deepStrictEqual(quick.plans.map(x=>x.cidr),['10.10.1.0/24','10.10.2.0/24']);

const quickDiff=Preview.computeSubnetPlanDiff(project,quick,{assignMode:'none',replaceExisting:false});
assert.strictEqual(quickDiff.add.filter(x=>x.scope==='Subnet').length,2);
assert.strictEqual(quickDiff.change.filter(x=>x.scope==='Subnet').length,0);

const quickApplied=Planner.applySubnetPlan(project,quick,{assignMode:'none',replaceExisting:false});
assert.strictEqual(quickApplied.subnets.length,3);
assert.deepStrictEqual(
  quickApplied.subnets.find(x=>x.vlanRef==='v10'),
  {id:'sn10',vlanRef:'v10',cidr:'10.10.0.0/24',gateway:'10.10.0.1'}
);
assert.strictEqual(quickApplied.subnets.find(x=>x.vlanRef==='v20').cidr,'10.10.1.0/24');

const vlsm=Planner.buildVlsmPlan('172.16.0.0/24',[
  {vlanRef:'v10',vlanId:10,name:'Usuarios',hostsRequired:40},
  {vlanRef:'v20',vlanId:20,name:'Servidores',hostsRequired:10}
],{margin:0});
const viaLegacy=Planner.applyVlsmPlan(project,vlsm,{assignMode:'none'});
const viaCommon=Planner.applySubnetPlan(project,vlsm,{assignMode:'none',replaceExisting:true});
assert.deepStrictEqual(viaLegacy.subnets,viaCommon.subnets,'VLSM debe reutilizar el motor común de aplicación');

const root=path.resolve(__dirname,'..');
const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
const main=fs.readFileSync(path.join(root,'js/netwizard.js'),'utf8');
const changePlan=fs.readFileSync(path.join(root,'js/netwizard-change-plan.js'),'utf8');
assert.ok(html.includes('Subnet canónica por VLAN'));
assert.ok(html.includes('Asignación rápida conservadora'));
assert.ok(html.includes('id="btnAutoSnPreview"'));
assert.ok(main.includes('planner.buildFixedSubnetPlan'));
assert.ok(main.includes('planner.applySubnetPlan'));
const quickFlow=main.slice(main.indexOf('function buildQuickSubnetPlan'),main.indexOf('function renderVlans'));
assert.ok(quickFlow.length>0);
assert.ok(!quickFlow.includes('S.subnets.push'),'La asignación rápida no debe escribir S.subnets directamente');
assert.ok(changePlan.includes('pl.applySubnetPlan||pl.applyVlsmPlan'),'El Plan común debe reutilizar el motor de subnetting');

console.log('✓ Subnetting usa S.subnets como autoridad y un único motor para automatismos');
