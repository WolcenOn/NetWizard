'use strict';

const assert=require('assert');
const Engine=require('../private/vendor-config-engine.js');

const project={
  _schemaVersion:'3.50.0',
  projName:'Private vendor generation',
  devices:[
    {id:'r1',name:'EDGE-1',type:'router',kind:'router',vendorOs:'cisco_ios',internetEdge:'yes',wanIf:'GigabitEthernet0/0'},
    {id:'sw1',name:'ACCESS-1',type:'switch',kind:'switch',vendorOs:'cisco_ios'},
    {id:'asa1',name:'ASA-EDGE',type:'firewall',kind:'firewall',vendorOs:'cisco_asa'},
    {id:'win1',name:'UTIL-WIN',type:'server',kind:'server',vendorOs:'windows'},
    {id:'lin1',name:'UTIL-LNX',type:'server',kind:'server',vendorOs:'linux'}
  ],
  ports:[
    {id:'r1-wan',deviceId:'r1',name:'GigabitEthernet0/0',mode:'routed',role:'wan'},
    {id:'r1-lan',deviceId:'r1',name:'GigabitEthernet0/1',mode:'trunk',role:'lan',allowedVlans:[10]},
    {id:'sw1-uplink',deviceId:'sw1',name:'GigabitEthernet1/0/1',mode:'trunk',allowedVlans:[10]},
    {id:'sw1-user',deviceId:'sw1',name:'GigabitEthernet1/0/2',mode:'access',accessVlanRef:'v10'}
  ],
  vlans:[{id:'v10',vlanId:10,name:'Users'}],
  subnets:[{id:'s10',vlanRef:'v10',cidr:'10.10.10.0/24',gateway:'10.10.10.1'}],
  hosts:[
    {id:'srv-win',name:'APP-WIN',type:'server',vlanRef:'v10',staticIp:'10.10.10.20',ipMode:'static',deviceRef:'win1'},
    {id:'srv-lin',name:'APP-LINUX',type:'server',vlanRef:'v10',staticIp:'10.10.10.21',ipMode:'static',deviceRef:'lin1'}
  ],
  links:[],
  dhcp:{'10':{enabled:true,dns:'1.1.1.1'}},
  roas:{gwId:'r1',lanIf:'GigabitEthernet0/1',wanCidr:'192.0.2.2/30',wanNh:'192.0.2.1'},
  routing:{strategy:'static'},
  fwRules:[{id:'fw1',name:'DNS outbound',src:'10.10.10.0/24',dst:'8.8.8.8',proto:'udp',port:'53',action:'allow',dir:'out',prio:10,enabled:true}],
  management:{},highAvailability:{},accessSecurity:{},linkAggregations:[]
};

const result=Engine.generateAll(project);

assert.strictEqual(result.contractVersion,'netwizard-private-vendor-config-v1');
assert.strictEqual(result.ok,true);
for(const id of ['r1','sw1','asa1','win1','lin1'])assert.strictEqual(result.sources[id],'private');
assert.strictEqual(result.configReadiness.r1.status,'review-required');
assert.ok(result.configReadiness.r1.reasons.some(x=>/políticas firewall/.test(x)));
assert.strictEqual(result.configReadiness.sw1.status,'apply-ready');
assert.strictEqual(result.configReadiness.asa1.status,'review-required');
assert.strictEqual(result.configReadiness.win1.status,'review-required');

assert.match(result.configs.r1,/FW Policy ACL/);
assert.match(result.configs.r1,/DNS outbound/);
const routerConfig=result.configs.r1;
assert.strictEqual((routerConfig.match(/^configure terminal$/gm)||[]).length,1,'Cisco IOS debe abrir config mode una sola vez');
assert.strictEqual((routerConfig.match(/^end$/gm)||[]).length,1,'Cisco IOS debe cerrar config mode una sola vez');
assert.strictEqual((routerConfig.match(/^write memory$/gm)||[]).length,1,'Cisco IOS debe guardar una sola vez al final');
assert.ok(routerConfig.indexOf('ip domain name local')<routerConfig.lastIndexOf('\nend\n'),'Gestión debe quedar dentro de config mode');
assert.ok(routerConfig.indexOf('HA y servicios generados desde plan neutral')<routerConfig.lastIndexOf('\nend\n'),'HA debe quedar dentro de config mode');
assert.ok(routerConfig.lastIndexOf('\nend\n')<routerConfig.lastIndexOf('\nwrite memory\n'),'write memory debe ejecutarse después de end');

assert.match(result.configs.sw1,/NetWizard switching profesional/);
const switchConfig=result.configs.sw1;
assert.strictEqual((switchConfig.match(/^configure terminal$/gm)||[]).length,1);
assert.strictEqual((switchConfig.match(/^end$/gm)||[]).length,1);
assert.strictEqual((switchConfig.match(/^write memory$/gm)||[]).length,1);
assert.ok(switchConfig.indexOf('LACP y seguridad de acceso generados desde plan neutral')<switchConfig.lastIndexOf('\nend\n'));
assert.ok(switchConfig.indexOf('Gestión y operación generada desde plan neutral')<switchConfig.lastIndexOf('\nend\n'));
assert.match(result.configs.asa1,/Cisco ASA/);
assert.match(result.configs.asa1,/access-list OUTSIDE_IN/);
assert.match(result.configs.win1,/Windows Server \/ Windows/);
assert.match(result.configs.win1,/APP-WIN/);
assert.match(result.configs.win1,/param\(\[Parameter\(Mandatory=\$true\)\]\[string\]\$InterfaceAlias\)/);
assert.match(result.configs.win1,/New-NetIPAddress/);
assert.doesNotMatch(result.configs.win1,/Remote Desktop|LocalPort 80,443/);
assert.match(result.configs.lin1,/Linux network configuration/);
assert.match(result.configs.lin1,/APP-LINUX/);
assert.match(result.configs.lin1,/NET_IFACE/);
assert.doesNotMatch(result.configs.lin1,/iptables -F|10\.10\.10\.10/);

assert.match(result.configPaths.r1,/^configs\/01-EDGE-1-r1-cisco_ios\.cfg$/);
assert.match(result.configPaths.asa1,/\.cfg$/);
assert.match(result.configPaths.win1,/\.ps1$/);
assert.match(result.configPaths.lin1,/\.sh$/);

assert.deepStrictEqual(
  result.pipeline.renderers.map(x=>x.id),
  ['edge.firewall','legacy.private','device.switching','vendor.base']
);
assert.deepStrictEqual(
  result.pipeline.stages.map(x=>x.id),
  ['routing.cisco','routing.multivendor','security.access','management.baseline','ha.services']
);
assert.deepStrictEqual(result.issues,[]);

const cleanRouterProject=JSON.parse(JSON.stringify(project));
cleanRouterProject.fwRules=[];
cleanRouterProject.devices=[JSON.parse(JSON.stringify(project.devices[0]))];
cleanRouterProject.ports=project.ports.filter(x=>x.deviceId==='r1');
const cleanRouter=Engine.generateAll(cleanRouterProject);
assert.strictEqual(cleanRouter.configReadiness.r1.status,'apply-ready');

const haRouterProject=JSON.parse(JSON.stringify(cleanRouterProject));
haRouterProject.highAvailability={
  devices:{
    r1:{
      dhcpRelayServers:['10.0.0.10'],
      defaultRoutes:[{nextHop:'192.0.2.1',distance:10,trackId:'1',description:'ISP principal'}],
      tracking:[{id:'1',target:'1.1.1.1',sourceInterface:'GigabitEthernet0/0',frequency:5,timeout:1000}],
      firstHopGroups:[{protocol:'hsrp',group:10,interfaceName:'GigabitEthernet0/1.10',virtualIp:'10.10.10.254',priority:110,preempt:true,trackInterface:'GigabitEthernet0/0',decrement:20}]
    }
  }
};
const haRouter=Engine.generateAll(haRouterProject);
assert.strictEqual(haRouter.ok,true);
assert.match(haRouter.configs.r1,/ip sla 1/);
assert.match(haRouter.configs.r1,/icmp-echo 1\.1\.1\.1 source-interface GigabitEthernet0\/0/);
assert.match(haRouter.configs.r1,/ip route 0\.0\.0\.0 0\.0\.0\.0 192\.0\.2\.1 10 track 1/);
assert.match(haRouter.configs.r1,/standby 10 ip 10\.10\.10\.254/);
assert.match(haRouter.configs.r1,/standby 10 priority 110/);
assert.match(haRouter.configs.r1,/standby 10 preempt/);
assert.match(haRouter.configs.r1,/standby 10 track GigabitEthernet0\/0 decrement 20/);

const vtpProject=JSON.parse(JSON.stringify(project));
vtpProject.devices=[JSON.parse(JSON.stringify(project.devices.find(x=>x.id==='sw1')))];
vtpProject.ports=project.ports.filter(x=>x.deviceId==='sw1');
vtpProject.hosts=[];
vtpProject.fwRules=[];
vtpProject.vtp={domain:'EMPRESA',password:'legacy-secret-value',version:'3',pruning:'yes',roles:{sw1:'client'}};
const vtpResult=Engine.generateAll(vtpProject);
assert.strictEqual(vtpResult.ok,true);
assert.strictEqual(vtpResult.configReadiness.sw1.status,'review-required');
assert.ok(vtpResult.configReadiness.sw1.reasons.some(x=>/VTP client está activo/.test(x)));
assert.ok(vtpResult.configReadiness.sw1.reasons.some(x=>/alias de secretos/.test(x)));
assert.match(vtpResult.configs.sw1,/vtp domain EMPRESA/);
assert.match(vtpResult.configs.sw1,/vtp password \$\{SECRET:VTP_PASSWORD\}/);
assert.match(vtpResult.configs.sw1,/vtp mode client/);
assert.match(vtpResult.configs.sw1,/vtp version 3/);
assert.match(vtpResult.configs.sw1,/vtp pruning/);
assert.doesNotMatch(vtpResult.configs.sw1,/legacy-secret-value/);
assert.doesNotMatch(vtpResult.configs.sw1,/^vlan 10$/m);
assert.strictEqual((vtpResult.configs.sw1.match(/^configure terminal$/gm)||[]).length,1);
assert.strictEqual((vtpResult.configs.sw1.match(/^end$/gm)||[]).length,1);
assert.strictEqual((vtpResult.configs.sw1.match(/^write memory$/gm)||[]).length,1);

const inferred=JSON.parse(JSON.stringify(project));
inferred.devices=[{id:'r1',name:'EDGE-INFERRED',type:'router',kind:'router',vendorOs:'cisco_ios',internetEdge:'yes'}];
inferred.ports=project.ports.filter(x=>x.deviceId==='r1');
inferred.roas={gwId:null,lanIf:'',wanCidr:'',wanNh:''};
const inferredResult=Engine.generateAll(inferred);
assert.strictEqual(inferredResult.configReadiness.r1.status,'review-required');
assert.ok(inferredResult.configReadiness.r1.reasons.some(x=>/RoaS fue inferida|WAN CIDR|next-hop WAN/.test(x)));

const unboundServer=JSON.parse(JSON.stringify(project));
unboundServer.devices=[{id:'win-unbound',name:'WIN-UNBOUND',type:'server',kind:'server',vendorOs:'windows'}];
unboundServer.hosts=[];
unboundServer.ports=[];
const unboundResult=Engine.generateAll(unboundServer);
assert.strictEqual(unboundResult.ok,false);
assert.ok(unboundResult.issues.some(x=>x.code==='NW-PRIVATE-CONFIG-002'&&x.deviceId==='win-unbound'));

const unsupported=JSON.parse(JSON.stringify(project));
unsupported.devices=[{id:'x1',name:'Unknown',type:'router',vendorOs:'future_os'}];
unsupported.ports=[];
const blocked=Engine.generateAll(unsupported);
assert.strictEqual(blocked.ok,false);
assert.ok(blocked.issues.some(x=>x.code==='NW-PRIVATE-CONFIG-003'&&x.deviceId==='x1'&&x.blocking));

console.log('✓ Private vendor engine genera todos los vendors soportados sin fallback cliente');
