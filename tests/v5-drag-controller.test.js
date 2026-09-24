'use strict';

const assert=require('assert');
const factory=require('../js/netwizard-v5-drag-controller.js');

function fakeCanvas(){
  const handlers=new Map();
  return{
    handlers,
    classList:{values:new Set(),add(v){this.values.add(v);},remove(v){this.values.delete(v);}},
    addEventListener(name,fn){handlers.set(name,fn);},
    removeEventListener(name){handlers.delete(name);},
    setPointerCapture(){},
    getBoundingClientRect(){return{left:0,top:0,width:800,height:600};}
  };
}

const canvas=fakeCanvas();
const visual={
  view:{px:0,py:0,zoom:1},
  pos:{d1:{x:100,y:100}},
  assign:{devices:{d1:'l1'},hosts:{}},
  sel:null
};
const locs={l1:{id:'l1',x:0,y:0,w:400,h:300},l2:{id:'l2',x:420,y:0,w:400,h:300}};
let draws=0,saves=0,refreshes=0,panels=0,frozen=false,selected=null;
const ctl=factory.create({
  canvas,
  visual:()=>visual,
  canvasPoint:e=>({x:e.clientX,y:e.clientY}),
  hitTest:pt=>pt.x>=100&&pt.x<=220&&pt.y>=100&&pt.y<=150?{t:'device',id:'d1'}:null,
  select:(t,id)=>{visual.sel={t,id};selected={t,id};},
  clearSelection:()=>{visual.sel=null;},
  draw:()=>draws++,
  renderPanel:()=>panels++,
  save:()=>saves++,
  refresh:()=>refreshes++,
  freezeAutoBounds:on=>{frozen=on;},
  locationById:id=>locs[id],
  locationBounds:l=>({x:l.x,y:l.y,w:l.w,h:l.h}),
  devicesInLocation:id=>id==='l1'?[{id:'d1'}]:[],
  hostsInLocation:()=>[],
  nodeBounds:()=>({x:100,y:100,w:120,h:50}),
  deviceVisualLocation:id=>visual.assign.devices[id],
  hostVisualLocation:()=>null,
  setDeviceVisualLocation:(id,lid)=>{visual.assign.devices[id]=lid;},
  setHostVisualLocation:()=>{},
  nextNodePosition:(lid)=>lid==='l2'?{x:500,y:80}:{x:100,y:100},
  locationAt:pt=>pt.x>=420?locs.l2:locs.l1,
  autoAssignHost:()=>({ok:true}),
  warn:()=>{}
});

assert.strictEqual(ctl.version,'netwizard-v5-drag-controller-v1');
ctl.bind();
assert.ok(canvas.handlers.has('pointerdown'));
assert.ok(canvas.handlers.has('wheel'));

ctl.pointerDown({clientX:110,clientY:110,pointerId:1});
assert.deepStrictEqual(selected,{t:'device',id:'d1'});
assert.strictEqual(frozen,true);
assert.strictEqual(ctl.isActive(),true);

ctl.pointerMove({clientX:500,clientY:120});
assert.ok(visual.pos.d1.x>400);
assert.strictEqual(ctl.getSession().overLoc,'l2');

ctl.pointerUp({});
assert.strictEqual(frozen,false);
assert.strictEqual(visual.assign.devices.d1,'l2');
assert.deepStrictEqual(visual.pos.d1,{x:500,y:80});
assert.ok(saves>=1);
assert.ok(refreshes>=1);
assert.strictEqual(ctl.isActive(),false);

const before={...visual.view};
ctl.wheel({clientX:200,clientY:200,deltaY:-120,preventDefault(){}});
assert.ok(visual.view.zoom>before.zoom);
assert.ok(draws>0);

ctl.destroy();
assert.strictEqual(canvas.handlers.size,0);

console.log('✓ V5 drag controller encapsula sesión pointer, drop, persistencia delegada y zoom');