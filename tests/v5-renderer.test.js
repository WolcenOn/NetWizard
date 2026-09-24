'use strict';

const assert=require('assert');
const renderer=require('../js/netwizard-v5-renderer.js');

function mockCtx(){
  const calls=[];
  const ctx={calls,globalAlpha:1,lineWidth:1,strokeStyle:'',fillStyle:'',font:'',shadowColor:'',shadowBlur:0,
    beginPath(){calls.push('beginPath');},moveTo(x,y){calls.push(['moveTo',x,y]);},lineTo(x,y){calls.push(['lineTo',x,y]);},
    arcTo(){calls.push('arcTo');},closePath(){calls.push('closePath');},save(){calls.push('save');},restore(){calls.push('restore');},
    setLineDash(v){calls.push(['dash',...v]);},stroke(){calls.push('stroke');},fill(){calls.push('fill');},
    arc(x,y,r){calls.push(['arc',x,y,r]);},bezierCurveTo(){calls.push('bezier');},
    fillText(t,x,y){calls.push(['text',t,x,y]);}
  };
  return ctx;
}

const project={
  devices:[
    {id:'sw1',name:'ACCESS-01',type:'switch'},
    {id:'r1',name:'CORE-RTR',type:'router'}
  ],
  ports:[
    {id:'p1',deviceId:'sw1',name:'Te1/1',mode:'trunk'},
    {id:'p2',deviceId:'r1',name:'Te0/0',mode:'trunk'}
  ],
  links:[{id:'l1',fromPortId:'p1',toPortId:'p2'}]
};
const visual={
  pos:{sw1:{x:100,y:80},r1:{x:400,y:80},h1:{x:40,y:260}},
  view:{px:20,py:30,zoom:1.5},
  compactLabels:true
};
const metrics={devW:176,devH:62,hstW:158,hstH:42};

assert.strictEqual(renderer.version,'netwizard-v5-renderer-v1');
assert.match(renderer.colorFromSeed('sw1'),/^hsl\(/);
assert.match(renderer.rgbaFromCss('hsl(196 82% 63%)',.5),/^rgba\(/);
assert.strictEqual(renderer.compactLinkLabel(visual,{},{name:'SW'},{name:'Gi1/0/1'}),'SW · Gi1/0/1');

const ctx=mockCtx();
const ok=renderer.drawNetworkLink(ctx,{visual,project,a:project.ports[0],b:project.ports[1],selected:true,metrics});
assert.strictEqual(ok,true);
assert.ok(ctx.calls.includes('stroke'));
assert.ok(ctx.calls.some(x=>Array.isArray(x)&&x[0]==='dash'&&x[1]===8));

const host={id:'h1',name:'PC-01',vlanRef:'v10'};
const geometry=renderer.hostLinkGeometry(visual,host,project.devices[0],{id:'hp',name:'Gi1/0/10'},metrics);
assert.ok(geometry);
assert.ok(Number.isFinite(geometry.midX));
const g=renderer.drawHostLink(ctx,{visual,host,linkedDev:project.devices[0],port:{id:'hp',accessVlanRef:'v10'},selected:true,accent:'hsl(200 80% 60%)',metrics});
assert.ok(g);
const dot=renderer.drawLinkDot(ctx,{visual,geometry:g,host,port:{id:'hp',accessVlanRef:'v10'},accent:'hsl(200 80% 60%)'});
assert.ok(dot&&dot.r>=10);

assert.strictEqual(renderer.drawDeviceNode(ctx,{visual,device:project.devices[0],bounds:{x:100,y:80,w:176,h:62},selected:true,accent:'#fff'}),true);
assert.strictEqual(renderer.drawHostNode(ctx,{visual,host,bounds:{x:40,y:260,w:158,h:42},selected:false,accent:'#fff',vlanLabel:'V10'}),true);
assert.ok(ctx.calls.some(x=>Array.isArray(x)&&x[0]==='text'&&String(x[1]).includes('ACCESS-01')));
assert.ok(ctx.calls.some(x=>Array.isArray(x)&&x[0]==='text'&&String(x[1]).includes('PC-01')));

console.log('✓ V5 renderer encapsula enlaces, nodos, colores y geometría visual');