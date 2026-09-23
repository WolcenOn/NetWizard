'use strict';

const assert=require('assert');
const core=require('../js/netwizard-v5-core.js');

const project={
  physicalLocations:[
    {id:'site',name:'Sede',type:'site'},
    {id:'cpd',name:'CPD',type:'room',parentId:'site'},
    {id:'office',name:'Oficina',type:'room',parentId:'site'}
  ],
  racks:[{id:'rack1',name:'Rack 1',locationId:'cpd'}],
  devices:[
    {id:'sw1',name:'SW-01',type:'switch',rackId:'rack1'},
    {id:'r1',name:'RTR-01',type:'router',physicalLocation:'CPD'}
  ],
  ports:[
    {id:'p1',deviceId:'sw1',name:'Te1/1'},
    {id:'p2',deviceId:'r1',name:'Te0/0'}
  ],
  links:[{id:'l1',fromPortId:'p1',toPortId:'p2'}],
  hosts:[{id:'h1',name:'PC-01',type:'pc'}],
  telecomOutlets:[{id:'to1',name:'TO-01',locationId:'office'}],
  hostOutletConnections:[{id:'hc1',hostId:'h1',outletId:'to1'}],
  visual:{
    locs:[
      {id:'v-site',name:'Sede',physicalLocationId:'site'},
      {id:'v-cpd',name:'CPD',physicalLocationId:'cpd',parentId:'v-site'},
      {id:'v-office',name:'Oficina',physicalLocationId:'office',parentId:'v-site'}
    ],
    assign:{devices:{sw1:'v-cpd',r1:'v-cpd'},hosts:{h1:'v-office'}},
    pos:{sw1:{x:100,y:80},r1:{x:350,y:80},h1:{x:600,y:90}},
    view:{px:20,py:30,zoom:2},
    sel:null
  }
};

const visual=core.ensureVisualState(project);
assert.strictEqual(core.version,'netwizard-v5-core-v1');
assert.deepStrictEqual(core.locRoots(visual).map(x=>x.id),['v-site']);
assert.strictEqual(core.locDepth(visual,'v-cpd'),1);
assert.strictEqual(core.rootLocationId(visual,'v-office'),'v-site');

assert.strictEqual(core.inferDeviceVisualLocation(project,visual,project.devices[0]),'v-cpd');
assert.strictEqual(core.inferHostVisualLocation(project,visual,project.hosts[0]),'v-office');

assert.strictEqual(core.linkPortA(project.links[0]),'p1');
assert.strictEqual(core.linkPortB(project.links[0]),'p2');
assert.deepStrictEqual(core.linkedDeviceIds(project,'sw1'),['r1']);
const graph=core.buildRootGraph(project,visual);
assert.strictEqual(graph.roots.length,1);

assert.strictEqual(core.showDevice(visual,project.devices[0]),true);
assert.strictEqual(core.showHost(visual,project.hosts[0],()=>false),true);
core.ensureFilters(visual).hosts=false;
assert.strictEqual(core.showHost(visual,project.hosts[0],()=>false),false);
core.ensureFilters(visual).hosts=true;

const bounds=core.nodeBounds(visual,'dev','sw1',{devW:176,devH:62});
assert.deepStrictEqual(bounds,{x:100,y:80,w:176,h:62});
const center=core.nodeCenter(visual,'dev','sw1',{devW:176,devH:62});
assert.deepStrictEqual(center,{x:188,y:111});
const screen=core.worldToScreen(visual,188,111);
assert.deepStrictEqual(screen,{x:396,y:252});
assert.deepStrictEqual(core.screenToWorld(visual,screen.x,screen.y),{x:188,y:111});

const minimal={};
const v2=core.ensureVisualState(minimal);
assert.ok(Array.isArray(v2.locs));
assert.deepStrictEqual(v2.assign,{devices:{},hosts:{}});
assert.deepStrictEqual(v2.view,{px:60,py:50,zoom:1});

console.log('✓ V5 core centraliza estado, filtros, topología, inferencia física y geometría');