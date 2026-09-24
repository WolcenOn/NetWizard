'use strict';

const assert=require('assert');
const interaction=require('../js/netwizard-v5-interaction.js');

const locations=[{id:'l1',x:0,y:0,w:500,h:400},{id:'l2',x:520,y:0,w:400,h:400}];
const locationBounds=l=>({x:l.x,y:l.y,w:l.w,h:l.h});
const nodeBounds=(kind,id)=>{
  const m={h1:{x:300,y:200,w:100,h:40},d1:{x:100,y:100,w:120,h:50}};
  return m[id];
};

assert.strictEqual(interaction.version,'netwizard-v5-interaction-v1');
assert.strictEqual(interaction.inside({x:110,y:110},nodeBounds('dev','d1')),true);
assert.deepStrictEqual(interaction.hitTest({
  point:{x:110,y:110},hosts:[{id:'h1'}],devices:[{id:'d1'}],locations,
  showHost:()=>true,showDevice:()=>true,nodeBounds,locationBounds,zoom:1
}),{t:'device',id:'d1'});
assert.deepStrictEqual(interaction.hitTest({
  point:{x:320,y:220},hosts:[{id:'h1'}],devices:[{id:'d1'}],locations,
  showHost:()=>true,showDevice:()=>true,nodeBounds,locationBounds,zoom:1
}),{t:'host',id:'h1'});

const resize=interaction.resizeHandleHit({point:{x:480,y:380},locations:[locations[0]],locationBounds,zoom:1});
assert.deepStrictEqual(resize,{t:'loc-resize',id:'l1'});
assert.strictEqual(interaction.locationAt({point:{x:600,y:100},locations,locationBounds}).id,'l2');

const drag={dx:10,dy:20,downX:100,downY:100,startX:40,startY:50,startW:300,startH:200,startPx:10,startPy:20};
assert.strictEqual(interaction.moved(drag,{x:110,y:110}),true);
assert.deepStrictEqual(interaction.nodePosition(drag,{x:200,y:210}),{x:190,y:190});
assert.deepStrictEqual(interaction.locationMove(drag,{x:200,y:210}),{x:190,y:190,deltaX:150,deltaY:140});
assert.deepStrictEqual(interaction.resizeLocation(drag,{x:180,y:170}),{w:440,h:320});
assert.deepStrictEqual(interaction.panView(drag,80,100),{px:50,py:70});

const view={px:20,py:30,zoom:1};
const worldBefore={x:(200-view.px)/view.zoom,y:(150-view.py)/view.zoom};
const zoomed=interaction.zoomAt(view,200,150,-120,.25,2.8);
const worldAfter={x:(200-zoomed.px)/zoomed.zoom,y:(150-zoomed.py)/zoomed.zoom};
assert.ok(Math.abs(worldBefore.x-worldAfter.x)<1e-9);
assert.ok(Math.abs(worldBefore.y-worldAfter.y)<1e-9);
assert.ok(zoomed.zoom>1);

const dots=[{id:'a',x:20,y:20,r:5},{id:'b',x:40,y:40,r:10}];
assert.strictEqual(interaction.linkDotAt(dots,42,42).id,'b');
assert.strictEqual(interaction.linkDotAt(dots,100,100),null);

console.log('✓ V5 interaction model centraliza hit-testing, drag, pan y zoom');