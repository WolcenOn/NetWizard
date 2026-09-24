'use strict';

const assert=require('assert');
const factory=require('../js/netwizard-v5-commands.js');

const project={
  devices:[
    {id:'sw1',name:'SW-01',type:'switch',kind:'switch',internetEdge:'no'},
    {id:'fw1',name:'FW-01',type:'firewall',kind:'firewall',internetEdge:'yes',wanIf:'wan0'}
  ],
  ports:[
    {id:'p1',deviceId:'sw1',name:'Gi1/0/1',mode:'access',accessVlanRef:'v10'},
    {id:'p2',deviceId:'fw1',name:'Gi0/0',mode:'layer3'}
  ],
  hosts:[{id:'h1',name:'PC-01',connectedDeviceId:'sw1',portAssignMode:'auto',portRef:null}],
  visual:{
    locs:[{id:'l1',name:'CPD',w:500,h:300},{id:'l2',name:'Oficina',w:500,h:300}],
    assign:{devices:{sw1:'l1',fw1:'l1'},hosts:{h1:'l2'}},
    pos:{sw1:{x:10,y:20},h1:{x:30,y:40}},
    filters:{hosts:true},proMode:false,sel:{t:'device',id:'sw1'}
  }
};

const cmd=factory.create({
  project:()=>project,
  visual:()=>project.visual,
  isEdgeDevice:d=>d.type==='firewall'||d.type==='router',
  deviceVisualLocation:id=>project.visual.assign.devices[id]||'',
  setDeviceVisualLocation:(id,lid)=>{project.visual.assign.devices[id]=lid;},
  setHostVisualLocation:(id,lid)=>{project.visual.assign.hosts[id]=lid;},
  nextNodePosition:(lid,kind)=>({x:lid==='l2'?500:100,y:kind==='host'?220:120}),
  applyProfessionalLayout:()=>{project.visual.layoutApplied=true;},
  suggestHostPort:(deviceId)=>deviceId==='sw1'?'p1':null
});

assert.strictEqual(factory.version,'netwizard-v5-commands-factory-v1');
assert.strictEqual(cmd.version,'netwizard-v5-commands-v1');

let r=cmd.updateDevice({id:'fw1',key:'kind',value:'switch'});
assert.strictEqual(r.changed,true);
assert.strictEqual(project.devices[1].type,'switch');
assert.strictEqual(project.devices[1].internetEdge,'no');
assert.strictEqual(project.devices[1].wanIf,null);

r=cmd.updatePort({id:'p1',key:'mode',value:'trunk'});
assert.strictEqual(project.ports[0].accessVlanRef,null);
assert.deepStrictEqual(r.selection,{t:'device',id:'sw1'});

r=cmd.setHostConnectedDevice({id:'h1',deviceId:'sw1'});
assert.strictEqual(project.hosts[0].portRef,'p1');
assert.strictEqual(project.visual.assign.hosts.h1,'l1');
assert.deepStrictEqual(r.selection,{t:'host',id:'h1'});

cmd.moveDevice({id:'sw1',locationId:'l2'});
assert.strictEqual(project.visual.assign.devices.sw1,'l2');
assert.deepStrictEqual(project.visual.pos.sw1,{x:500,y:120});

cmd.moveHost({id:'h1',locationId:'l2'});
assert.strictEqual(project.visual.assign.hosts.h1,'l2');
assert.deepStrictEqual(project.visual.pos.h1,{x:500,y:220});

cmd.updateLocationSize({id:'l2',key:'w',value:10});
cmd.updateLocationSize({id:'l2',key:'h',value:10});
assert.strictEqual(project.visual.locs[1].w,330);
assert.strictEqual(project.visual.locs[1].h,160);

cmd.setFilter({key:'hosts',on:false});
assert.strictEqual(project.visual.filters.hosts,false);
cmd.setProMode({on:true});
assert.strictEqual(project.visual.proMode,true);
assert.strictEqual(project.visual.layoutApplied,true);
cmd.setCompactLabels({compact:false});
assert.strictEqual(project.visual.compactLabels,false);

const before=project.visual.locs.length;
cmd.addLocation({location:{id:'l3',name:'Sala 3'}});
assert.strictEqual(project.visual.locs.length,before+1);

console.log('✓ V5 commands centraliza ediciones de equipos, hosts, puertos y estado visual');