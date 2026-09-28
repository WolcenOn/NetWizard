'use strict';

const assert=require('assert');
const Engine=require('../private/vendor-config-engine.js');

const project={
  _schemaVersion:'3.50.0',
  projName:'Private vendor generation',
  devices:[
    {id:'r1',name:'EDGE-1',type:'router',kind:'router',vendorOs:'cisco_ios',internetEdge:'yes',wanIf:'GigabitEthernet0/0'},
    {id:'sw1',name:'ACCESS-1',type:'switch',kind:'switch',vendorOs:'cisco_ios'},
    {id:'win1',name:'UTIL-1',type:'server',kind:'server',vendorOs:'windows'}
  ],
  ports:[
    {id:'r1-wan',deviceId:'r1',name:'GigabitEthernet0/0',mode:'routed',role:'wan'},
    {id:'r1-lan',deviceId:'r1',name:'GigabitEthernet0/1',mode:'trunk',role:'lan',allowedVlans:[10]},
    {id:'sw1-uplink',deviceId:'sw1',name:'GigabitEthernet1/0/1',mode:'trunk',allowedVlans:[10]},
    {id:'sw1-user',deviceId:'sw1',name:'GigabitEthernet1/0/2',mode:'access',accessVlanRef:'v10'}
  ],
  vlans:[{id:'v10',vlanId:10,name:'Users'}],
  subnets:[{id:'s10',vlanRef:'v10',cidr:'10.10.10.0/24',gateway:'10.10.10.1'}],
  hosts:[],links:[],
  dhcp:{'10':{enabled:true,dns:'1.1.1.1'}},
  roas:{gwId:'r1',lanIf:'GigabitEthernet0/1',wanCidr:'192.0.2.2/30',wanNh:'192.0.2.1'},
  routing:{strategy:'static'},
  fwRules:[{id:'fw1',name:'DNS outbound',src:'10.10.10.0/24',dst:'8.8.8.8',proto:'udp',port:'53',action:'allow',dir:'out',prio:10,enabled:true}],
  management:{},highAvailability:{},accessSecurity:{},linkAggregations:[]
};

const legacy={
  r1:'CLIENT MUST NOT OVERRIDE PRIVATE CISCO',
  sw1:'CLIENT MUST NOT OVERRIDE PRIVATE SWITCH',
  win1:'powershell.exe -File netwizard.ps1\n'
};
const result=Engine.generateAll(project,legacy);

assert.strictEqual(result.contractVersion,'netwizard-private-vendor-config-v1');
assert.strictEqual(result.ok,true);
assert.strictEqual(result.sources.r1,'private');
assert.strictEqual(result.sources.sw1,'private');
assert.strictEqual(result.sources.win1,'legacy-client-fallback');
assert.doesNotMatch(result.configs.r1,/CLIENT MUST NOT OVERRIDE/);
assert.doesNotMatch(result.configs.sw1,/CLIENT MUST NOT OVERRIDE/);
assert.match(result.configs.r1,/FW Policy ACL/);
assert.match(result.configs.r1,/DNS outbound/);
assert.match(result.configs.sw1,/NetWizard switching profesional/);
assert.match(result.configPaths.r1,/^configs\/01-EDGE-1-r1-cisco_ios\.cfg$/);
assert.match(result.configPaths.win1,/\.ps1$/);
assert.deepStrictEqual(
  result.pipeline.renderers.map(x=>x.id),
  ['edge.firewall','device.switching','vendor.base']
);
assert.deepStrictEqual(
  result.pipeline.stages.map(x=>x.id),
  ['routing.cisco','routing.multivendor','security.access','management.baseline','ha.services']
);
assert.ok(result.issues.some(x=>x.code==='NW-PRIVATE-CONFIG-001'&&x.deviceId==='win1'&&!x.blocking));

const noLegacy=Engine.generateAll(project,{});
assert.strictEqual(noLegacy.ok,false);
assert.ok(noLegacy.issues.some(x=>x.code==='NW-PRIVATE-CONFIG-003'&&x.deviceId==='win1'&&x.blocking));

console.log('✓ Private vendor engine genera vendors migrados en servidor e ignora overrides cliente');
