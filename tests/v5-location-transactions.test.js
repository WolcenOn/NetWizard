'use strict';

const assert=require('assert');
const TX=require('../js/netwizard-v5-location-transactions.js');

function fixture(){
  return{
    physicalLocations:[
      {id:'site1',name:'Sede',type:'site',parentId:'',distance:'',notes:''},
      {id:'room1',name:'CPD',type:'room',parentId:'site1',distance:'',notes:''},
      {id:'zone1',name:'Zona A',type:'zone',parentId:'room1',distance:'',notes:''}
    ],
    devices:[
      {id:'d1',name:'SW-01',physicalLocation:'CPD',locationId:'room1'},
      {id:'d2',name:'AP-01',physicalLocation:'Zona A',locationId:'zone1'}
    ],
    hosts:[{id:'h1',name:'PC-01',physicalLocation:'CPD',physicalLocationId:'room1'}],
    racks:[{id:'rack1',name:'RACK-01',physicalLocation:'CPD',locationId:'room1'}],
    telecomOutlets:[{id:'out1',name:'TO-01',physicalLocation:'CPD',physicalLocationId:'room1'}],
    visual:{
      locs:[
        {id:'vsite',name:'Sede',type:'site',physicalLocationId:'site1',x:0,y:0},
        {id:'vroom',name:'CPD',type:'room',physicalLocationId:'room1',parentId:'vsite',x:100,y:100},
        {id:'vzone',name:'Zona A',type:'zone',physicalLocationId:'zone1',parentId:'vroom',x:200,y:200}
      ],
      assign:{devices:{d1:'vroom',d2:'vzone'},hosts:{h1:'vroom'}},
      pos:{d1:{x:120,y:140},d2:{x:230,y:250},h1:{x:140,y:220}},
      sel:{t:'loc',id:'vroom'}
    },
    hostPhysicalLocations:['CPD','Sede','Zona A']
  };
}

assert.strictEqual(TX.version,'netwizard-v5-location-transactions-v1');

const p=fixture();
const original=JSON.stringify(p);
let plan=TX.planUpsert(p,{
  id:'room1',name:'Sala técnica',type:'room',parentId:'site1',distance:'12',notes:'Renombrada',
  visual:{id:'vroom',color:'#112233'}
},{idFactory:prefix=>prefix+'-new',visualIdFactory:prefix=>prefix+'-new'});

assert.strictEqual(plan.ok,true);
assert.strictEqual(JSON.stringify(p),original,'planUpsert no debe mutar el proyecto antes de commit');
assert.strictEqual(plan.next.devices[0].physicalLocation,'Sala técnica');
assert.strictEqual(plan.next.hosts[0].physicalLocation,'Sala técnica');
assert.strictEqual(plan.next.racks[0].physicalLocation,'Sala técnica');
assert.strictEqual(plan.next.telecomOutlets[0].physicalLocation,'Sala técnica');
assert.strictEqual(plan.next.visual.locs.find(l=>l.id==='vroom').name,'Sala técnica');

let committed=TX.commit(p,plan);
assert.strictEqual(committed.ok,true);
assert.strictEqual(p.physicalLocations.find(l=>l.id==='room1').name,'Sala técnica');
assert.ok(p.hostPhysicalLocations.includes('Sala técnica'));

const duplicate=TX.planUpsert(p,{id:'room1',name:'Sede',type:'room',parentId:'site1'});
assert.strictEqual(duplicate.ok,false);
assert.strictEqual(duplicate.code,'duplicate-name');

const cycle=TX.planUpsert(p,{id:'site1',name:'Sede',type:'site',parentId:'zone1'});
assert.strictEqual(cycle.ok,false);
assert.strictEqual(cycle.code,'invalid-parent');

const create=TX.planUpsert(p,{
  name:'Armario B',type:'rack',parentId:'site1',
  visual:{color:'#223344',x:500,y:90,w:420,h:220}
},{idFactory:prefix=>prefix+'-created',visualIdFactory:prefix=>prefix+'-created'});
assert.strictEqual(create.ok,true);
assert.strictEqual(create.id,'pl-created');
assert.strictEqual(create.visualId,'loc-created');
TX.commit(p,create);
assert.ok(p.physicalLocations.some(l=>l.id==='pl-created'));
assert.strictEqual(p.visual.locs.find(l=>l.id==='loc-created').physicalLocationId,'pl-created');

plan=TX.planDelete(p,{id:'room1'});
assert.strictEqual(plan.ok,true);
assert.strictEqual(plan.impact.children,1);
assert.strictEqual(plan.impact.devices,1);
assert.strictEqual(plan.impact.hosts,1);
assert.strictEqual(plan.impact.racks,1);
assert.strictEqual(plan.impact.outlets,1);
assert.strictEqual(plan.next.physicalLocations.find(l=>l.id==='zone1').parentId,'site1');
assert.strictEqual(plan.next.devices.find(d=>d.id==='d1').physicalLocation,'Sede');
assert.strictEqual(plan.next.devices.find(d=>d.id==='d1').locationId,'site1');
assert.strictEqual(plan.next.hosts.find(h=>h.id==='h1').physicalLocationId,'site1');
assert.strictEqual(plan.next.racks.find(r=>r.id==='rack1').locationId,'site1');
assert.strictEqual(plan.next.telecomOutlets.find(o=>o.id==='out1').physicalLocationId,'site1');
assert.ok(!plan.next.visual.locs.some(l=>l.id==='vroom'));
assert.strictEqual(plan.next.visual.locs.find(l=>l.id==='vzone').parentId,'vsite');
assert.strictEqual(plan.next.visual.assign.devices.d1,'vsite');
assert.strictEqual(plan.next.visual.assign.hosts.h1,'vsite');
assert.strictEqual(plan.next.visual.sel,null);
TX.commit(p,plan);
assert.ok(!p.physicalLocations.some(l=>l.id==='room1'));
assert.ok(!p.visual.locs.some(l=>l.id==='vroom'));

console.log('✓ V5 location transactions valida, planifica y evita referencias huérfanas');