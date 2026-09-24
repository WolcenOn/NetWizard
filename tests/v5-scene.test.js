'use strict';

const assert=require('assert');
const scene=require('../js/netwizard-v5-scene.js');

function ctx(){
  const calls=[];
  return{
    calls,globalAlpha:1,strokeStyle:'',fillStyle:'',lineWidth:1,font:'',
    clearRect(){calls.push('clearRect');},beginPath(){calls.push('beginPath');},moveTo(){},lineTo(){},
    arcTo(){},closePath(){},stroke(){calls.push('stroke');},fill(){calls.push('fill');},
    setLineDash(){},fillRect(){calls.push('fillRect');},strokeRect(){calls.push('strokeRect');},
    fillText(t){calls.push(['text',t]);},save(){},restore(){},arc(){},bezierCurveTo(){}
  };
}

const project={
  devices:[
    {id:'sw1',name:'SW-01',type:'switch'},
    {id:'r1',name:'RTR-01',type:'router'}
  ],
  ports:[
    {id:'p1',deviceId:'sw1',name:'Te1/1',mode:'trunk'},
    {id:'p2',deviceId:'r1',name:'Te0/0',mode:'trunk'}
  ],
  links:[{id:'l1',fromPortId:'p1',toPortId:'p2'}],
  hosts:[{id:'h1',name:'PC-01',vlanRef:'v10',connectedDeviceId:'sw1',portRef:'p1'}]
};
const visual={
  locs:[{id:'loc1',name:'CPD',x:20,y:20,w:700,h:400,color:'#10233c'}],
  assign:{devices:{sw1:'loc1',r1:'loc1'},hosts:{h1:'loc1'}},
  pos:{sw1:{x:80,y:100},r1:{x:360,y:100},h1:{x:90,y:250}},
  view:{px:20,py:30,zoom:1},
  sel:{t:'device',id:'sw1'}
};
const devicesInLocation=id=>id==='loc1'?project.devices:[];
const hostsInLocation=id=>id==='loc1'?project.hosts:[];
const metrics={locHead:36,devW:176,devH:62,hstW:158,hstH:42,colW:190};

assert.strictEqual(scene.version,'netwizard-v5-scene-v1');
assert.strictEqual(scene.selectedDeviceId(project,visual,h=>h.connectedDeviceId),'sw1');
assert.strictEqual(scene.networkSelected(project,visual,project.ports[0],project.ports[1],h=>h.connectedDeviceId),true);

const c=ctx();
const result=scene.render(c,{
  project,visual,rect:{width:900,height:600},metrics,
  locations:visual.locs,
  locationDepth:()=>0,
  locationBounds:loc=>({x:loc.x,y:loc.y,w:loc.w,h:loc.h}),
  devicesInLocation,hostsInLocation,
  layoutLocation:()=>{},
  showDevice:()=>true,showHost:()=>true,
  deviceById:id=>project.devices.find(d=>d.id===id),
  hostConnectedDeviceId:h=>h.connectedDeviceId,
  vlanByRef:id=>id==='v10'?{id:'v10',vlanId:10}:null,
  hostPort:h=>project.ports.find(p=>p.id===h.portRef),
  proMode:false,drag:null
});
assert.ok(result.renderState);
assert.deepStrictEqual(result.renderState.layerOrder,['background','base-links','nodes','selected-links']);
assert.deepStrictEqual(result.renderState.sceneOrder,['background','locations','base-links','nodes','selected-links']);
assert.strictEqual(result.renderState.locationCount,1);
assert.strictEqual(result.renderState.baseNetwork,1);
assert.strictEqual(result.renderState.baseHost,1);
assert.strictEqual(result.renderState.selectedNetwork,1);
assert.strictEqual(result.renderState.selectedHost,1);
assert.ok(c.calls.includes('clearRect'));
assert.ok(c.calls.some(x=>Array.isArray(x)&&x[0]==='text'&&String(x[1]).includes('CPD')));

visual.sel={t:'host',id:'h1'};
const hostResult=scene.render(ctx(),{
  project,visual,rect:{width:900,height:600},metrics,locations:visual.locs,
  locationDepth:()=>0,locationBounds:loc=>({x:loc.x,y:loc.y,w:loc.w,h:loc.h}),
  devicesInLocation,hostsInLocation,layoutLocation:()=>{},showDevice:()=>true,showHost:()=>true,
  deviceById:id=>project.devices.find(d=>d.id===id),hostConnectedDeviceId:h=>h.connectedDeviceId,
  vlanByRef:()=>({vlanId:10}),hostPort:h=>project.ports.find(p=>p.id===h.portRef),proMode:false
});
assert.strictEqual(hostResult.renderState.selectedHost,1);
assert.strictEqual(hostResult.linkDots.length,1);

console.log('✓ V5 scene renderer orquesta capas, nodos y selección fuera de netwizard.js');