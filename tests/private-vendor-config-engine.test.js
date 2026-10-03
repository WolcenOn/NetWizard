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
assert.strictEqual(result.configReadiness.r1.status,'apply-ready');
assert.deepStrictEqual(result.configReadiness.r1.reasons,[]);
assert.strictEqual(result.configReadiness.sw1.status,'apply-ready');
assert.strictEqual(result.configReadiness.asa1.status,'review-required');
assert.strictEqual(result.configReadiness.win1.status,'review-required');

assert.match(result.configs.r1,/FW Policy ACL/);
assert.match(result.configs.r1,/DNS outbound/);
assert.match(result.configs.r1,/interface GigabitEthernet0\/1\.10[\s\S]*ip access-group FW_POLICY in/);
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
  ['routing.cisco','routing.multivendor','segmentation.cisco','vpn.site-to-site','security.access','management.baseline','ha.services']
);
assert.deepStrictEqual(result.issues,[]);

const cleanRouterProject=JSON.parse(JSON.stringify(project));
cleanRouterProject.fwRules=[];
cleanRouterProject.devices=[JSON.parse(JSON.stringify(project.devices[0]))];
cleanRouterProject.ports=project.ports.filter(x=>x.deviceId==='r1');
const cleanRouter=Engine.generateAll(cleanRouterProject);
assert.strictEqual(cleanRouter.configReadiness.r1.status,'apply-ready');


const canonicalWanProject=JSON.parse(JSON.stringify(cleanRouterProject));
canonicalWanProject.roas={gwId:'r1',lanIf:'GigabitEthernet0/1'};
canonicalWanProject.ports=canonicalWanProject.ports.map(x=>x.id==='r1-wan'
  ?Object.assign({},x,{mode:'routed',l3Ip:'192.0.2.2',l3Cidr:'192.0.2.0/30'})
  :x);
canonicalWanProject.wanCircuits=[{
  id:'r1-primary',deviceId:'r1',portId:'r1-wan',role:'primary',enabled:true,
  provider:'ISP-A',bandwidthDownMbps:1000,bandwidthUpMbps:1000
}];
canonicalWanProject.highAvailability={devices:{r1:{
  defaultRoutes:[{nextHop:'192.0.2.1',distance:1,circuitRef:'r1-primary'}],
  tracking:[],dhcpRelays:[],firstHopGroups:[]
}}};
const canonicalWan=Engine.generateAll(canonicalWanProject);
assert.strictEqual(canonicalWan.configReadiness.r1.status,'apply-ready');
assert.match(canonicalWan.configs.r1,/ip nat outside/);
assert.match(canonicalWan.configs.r1,/ip route 0\.0\.0\.0 0\.0\.0\.0 192\.0\.2\.1 1/);

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

const interSiteProject={
  _schemaVersion:'3.50.0',
  projName:'Static inter-site routing',
  devices:[
    {id:'r1',name:'RTR-CENTRAL',type:'router',kind:'router',vendorOs:'cisco_ios'},
    {id:'r2',name:'RTR-NORTE',type:'router',kind:'router',vendorOs:'cisco_ios'},
    {id:'r3',name:'RTR-SUR',type:'router',kind:'router',vendorOs:'cisco_ios'}
  ],
  ports:[
    {id:'r1-n',deviceId:'r1',name:'GigabitEthernet0/1',mode:'routed',role:'transit',l3Ip:'10.255.0.1',l3Cidr:'10.255.0.0/30'},
    {id:'r2-w',deviceId:'r2',name:'GigabitEthernet0/1',mode:'routed',role:'transit',l3Ip:'10.255.0.2',l3Cidr:'10.255.0.0/30'},
    {id:'r1-s',deviceId:'r1',name:'GigabitEthernet0/2',mode:'routed',role:'transit',l3Ip:'10.255.0.5',l3Cidr:'10.255.0.4/30'},
    {id:'r3-w',deviceId:'r3',name:'GigabitEthernet0/1',mode:'routed',role:'transit',l3Ip:'10.255.0.6',l3Cidr:'10.255.0.4/30'},
    {id:'r1-lan',deviceId:'r1',name:'GigabitEthernet0/0',mode:'routed',role:'lan',l3Ip:'10.10.0.1',l3Cidr:'10.10.0.0/24'},
    {id:'r2-lan',deviceId:'r2',name:'GigabitEthernet0/0',mode:'routed',role:'lan',l3Ip:'10.20.0.1',l3Cidr:'10.20.0.0/24'},
    {id:'r3-lan',deviceId:'r3',name:'GigabitEthernet0/0',mode:'routed',role:'lan',l3Ip:'10.30.0.1',l3Cidr:'10.30.0.0/24'}
  ],
  links:[
    {id:'ln',aPortId:'r1-n',bPortId:'r2-w'},
    {id:'ls',aPortId:'r1-s',bPortId:'r3-w'}
  ],
  vlans:[],subnets:[],hosts:[],fwRules:[],dhcp:{},roas:{},vtp:{roles:{}},
  routing:{
    strategy:'static',
    staticRoutesByDevice:{
      r2:[{id:'r2-sur',destination:'10.30.0.0/24',nextHop:'10.255.0.1',distance:5,description:'SUR vía CENTRAL'}],
      r3:[{id:'r3-norte',destination:'10.20.0.0/24',nextHop:'10.255.0.5',distance:5,description:'NORTE vía CENTRAL'}]
    }
  },
  management:{},highAvailability:{},accessSecurity:{},linkAggregations:[]
};
const interSiteResult=Engine.generateAll(interSiteProject);
assert.strictEqual(interSiteResult.ok,true);
assert.strictEqual(interSiteResult.configReadiness.r1.status,'apply-ready');
assert.strictEqual(interSiteResult.configReadiness.r2.status,'apply-ready');
assert.strictEqual(interSiteResult.configReadiness.r3.status,'apply-ready');
assert.match(interSiteResult.configs.r2,/ip route 10\.30\.0\.0 255\.255\.255\.0 10\.255\.0\.1 5/);
assert.match(interSiteResult.configs.r3,/ip route 10\.20\.0\.0 255\.255\.255\.0 10\.255\.0\.5 5/);

const invalidInterSite=JSON.parse(JSON.stringify(interSiteProject));
invalidInterSite.routing.staticRoutesByDevice.r2[0].nextHop='192.0.2.1';
const invalidInterSiteResult=Engine.generateAll(invalidInterSite);
assert.strictEqual(invalidInterSiteResult.configReadiness.r2.status,'review-required');
assert.ok(invalidInterSiteResult.configReadiness.r2.reasons.some(x=>/next-hop .* directamente conectada/.test(x)));

const ospfProject={
  _schemaVersion:'3.50.0',
  projName:'Private OSPF generation',
  devices:[
    {id:'ospf-r1',name:'OSPF-HQ',type:'router',kind:'router',vendorOs:'cisco_ios'},
    {id:'ospf-r2',name:'OSPF-BRANCH',type:'router',kind:'router',vendorOs:'cisco_ios'}
  ],
  ports:[
    {id:'ospf-r1-wan',deviceId:'ospf-r1',name:'GigabitEthernet0/0',mode:'routed',role:'transit',l3Ip:'10.255.10.1',l3Cidr:'10.255.10.0/30'},
    {id:'ospf-r1-lan',deviceId:'ospf-r1',name:'GigabitEthernet0/1',mode:'routed',role:'lan',l3Ip:'10.10.10.1',l3Cidr:'10.10.10.0/24'},
    {id:'ospf-r2-wan',deviceId:'ospf-r2',name:'GigabitEthernet0/0',mode:'routed',role:'transit',l3Ip:'10.255.10.2',l3Cidr:'10.255.10.0/30'},
    {id:'ospf-r2-lan',deviceId:'ospf-r2',name:'GigabitEthernet0/1',mode:'routed',role:'lan',l3Ip:'10.20.20.1',l3Cidr:'10.20.20.0/24'}
  ],
  links:[{id:'ospf-link',aPortId:'ospf-r1-wan',bPortId:'ospf-r2-wan'}],
  vlans:[],subnets:[],hosts:[],fwRules:[],dhcp:{},roas:{},vtp:{roles:{}},
  routing:{strategy:'ospf',protocol:'ospf',ospf:{devices:{
    'ospf-r1':{processId:10,routerId:'1.1.1.1',defaultArea:'0',passiveDefault:true,interfaces:{
      'ospf-r1-wan':{enabled:true,area:'0',passive:false,cost:10},
      'ospf-r1-lan':{enabled:true,area:'0',passive:true,cost:10}
    }},
    'ospf-r2':{processId:10,routerId:'2.2.2.2',defaultArea:'0',passiveDefault:true,interfaces:{
      'ospf-r2-wan':{enabled:true,area:'0',passive:false,cost:10},
      'ospf-r2-lan':{enabled:true,area:'0',passive:true,cost:10}
    }}
  }}},
  management:{},highAvailability:{},accessSecurity:{},linkAggregations:[]
};
const ospfResult=Engine.generateAll(ospfProject);
assert.strictEqual(ospfResult.ok,true);
assert.strictEqual(ospfResult.configReadiness['ospf-r1'].status,'apply-ready',JSON.stringify(ospfResult.configReadiness['ospf-r1'].reasons));
assert.strictEqual(ospfResult.configReadiness['ospf-r2'].status,'apply-ready',JSON.stringify(ospfResult.configReadiness['ospf-r2'].reasons));
assert.match(ospfResult.configs['ospf-r1'],/router ospf 10/);
assert.match(ospfResult.configs['ospf-r1'],/router-id 1\.1\.1\.1/);
assert.match(ospfResult.configs['ospf-r1'],/no passive-interface GigabitEthernet0\/0/);
assert.match(ospfResult.configs['ospf-r1'],/ip ospf cost 10/);

const badOspf=JSON.parse(JSON.stringify(ospfProject));
badOspf.routing.ospf.devices['ospf-r2'].interfaces['ospf-r2-wan'].area='10';
const badOspfResult=Engine.generateAll(badOspf);
assert.strictEqual(badOspfResult.configReadiness['ospf-r1'].status,'review-required');
assert.ok(badOspfResult.configReadiness['ospf-r1'].reasons.some(x=>/OSPF: .*no tiene vecino esperado compatible/i.test(x)));

const wanResilienceProject={
  _schemaVersion:'3.50.0',
  projName:'Private WAN resilience',
  devices:[{id:'wr1',name:'WAN-EDGE',type:'router',kind:'router',vendorOs:'cisco_ios',internetEdge:'yes',wanIf:'GigabitEthernet0/0'}],
  ports:[
    {id:'wr1-a',deviceId:'wr1',name:'GigabitEthernet0/0',mode:'routed',role:'wan',l3Ip:'203.0.113.2',l3Cidr:'203.0.113.2/30'},
    {id:'wr1-b',deviceId:'wr1',name:'GigabitEthernet0/1',mode:'routed',role:'wan',l3Ip:'198.51.100.2',l3Cidr:'198.51.100.2/30'}
  ],
  wanCircuits:[
    {id:'wr-c1',name:'ISP-A',deviceId:'wr1',portId:'wr1-a',provider:'ISP-A',role:'primary',siteRef:'HQ',enabled:true,bandwidthDownMbps:500,bandwidthUpMbps:200},
    {id:'wr-c2',name:'ISP-B',deviceId:'wr1',portId:'wr1-b',provider:'ISP-B',role:'backup',siteRef:'HQ',enabled:true,bandwidthDownMbps:300,bandwidthUpMbps:100}
  ],
  vlans:[],subnets:[],hosts:[],links:[],fwRules:[],dhcp:{},roas:{},vtp:{roles:{}},
  routing:{strategy:'static'},
  highAvailability:{devices:{wr1:{
    defaultRoutes:[
      {nextHop:'203.0.113.1',distance:1,trackId:'1',circuitRef:'wr-c1',description:'primary'},
      {nextHop:'198.51.100.1',distance:20,circuitRef:'wr-c2',description:'floating backup'}
    ],
    tracking:[{id:'1',target:'1.1.1.1',sourceInterface:'GigabitEthernet0/0',circuitRef:'wr-c1',frequency:5,timeout:1000}]
  }}},
  management:{},accessSecurity:{},linkAggregations:[]
};
const wanResilienceResult=Engine.generateAll(wanResilienceProject);
assert.strictEqual(wanResilienceResult.configReadiness.wr1.status,'apply-ready',JSON.stringify(wanResilienceResult.configReadiness.wr1.reasons));
assert.match(wanResilienceResult.configs.wr1,/ip sla 1/);
assert.match(wanResilienceResult.configs.wr1,/ip route 0\.0\.0\.0 0\.0\.0\.0 203\.0\.113\.1 1 track 1/);
assert.match(wanResilienceResult.configs.wr1,/ip route 0\.0\.0\.0 0\.0\.0\.0 198\.51\.100\.1 20/);
assert.match(wanResilienceResult.configs.wr1,/ip nat inside source list 100 interface GigabitEthernet0\/0 overload/);
assert.match(wanResilienceResult.configs.wr1,/ip nat inside source list 100 interface GigabitEthernet0\/1 overload/);
assert.match(wanResilienceResult.configs.wr1,/interface GigabitEthernet0\/1[\s\S]*ip nat outside/);

const badWanResilience=JSON.parse(JSON.stringify(wanResilienceProject));
badWanResilience.highAvailability.devices.wr1.defaultRoutes[1].distance=1;
const badWanResilienceResult=Engine.generateAll(badWanResilience);
assert.strictEqual(badWanResilienceResult.configReadiness.wr1.status,'review-required');
assert.ok(badWanResilienceResult.configReadiness.wr1.reasons.some(x=>/Resiliencia WAN: .*distancia mayor/i.test(x)));


const managedSwitchProject={
  _schemaVersion:'3.50.0',projName:'Managed switch readiness',
  devices:[{id:'msw',name:'MGMT-SW',type:'switch',kind:'switch',vendorOs:'cisco_ios',mgmtIp:'10.99.0.10'}],
  ports:[{id:'msw-uplink',deviceId:'msw',name:'GigabitEthernet1/0/48',mode:'trunk',allowedVlans:[99],nativeVlanRef:'v99'}],
  vlans:[{id:'v99',vlanId:99,name:'Management',intent:{type:'management'}}],
  subnets:[{id:'s99',vlanRef:'v99',cidr:'10.99.0.0/24',gateway:'10.99.0.1'}],
  hosts:[],links:[],fwRules:[],dhcp:{},roas:{},vtp:{roles:{}},routing:{strategy:'static'},
  management:{sourceNetworks:['10.99.0.0/24']},highAvailability:{},accessSecurity:{},linkAggregations:[],ipv6Networks:[]
};
const managedSwitchResult=Engine.generateAll(managedSwitchProject);
assert.strictEqual(managedSwitchResult.configReadiness.msw.status,'apply-ready',JSON.stringify(managedSwitchResult.configReadiness.msw.reasons));
assert.match(managedSwitchResult.configs.msw,/interface Vlan99[\s\S]*ip address 10\.99\.0\.10 255\.255\.255\.0/);
assert.match(managedSwitchResult.configs.msw,/ip default-gateway 10\.99\.0\.1/);

const dualStackProject={
  _schemaVersion:'3.50.0',projName:'Dual-stack segmentation readiness',
  devices:[{id:'r6',name:'R6',type:'router',kind:'router',vendorOs:'cisco_ios',lanIf:'GigabitEthernet0/1'}],
  ports:[{id:'r6-lan',deviceId:'r6',name:'GigabitEthernet0/1',mode:'trunk',role:'lan',allowedVlans:[10,40]}],
  vlans:[
    {id:'v10',vlanId:10,name:'Trusted',intent:{type:'users',internet:false,isolation:'standard'}},
    {id:'v40',vlanId:40,name:'IoT',intent:{type:'iot',internet:false,isolation:'isolated'}}
  ],
  subnets:[
    {id:'s10',vlanRef:'v10',cidr:'10.6.10.0/24',gateway:'10.6.10.1',gatewayDeviceRef:'r6'},
    {id:'s40',vlanRef:'v40',cidr:'10.6.40.0/24',gateway:'10.6.40.1',gatewayDeviceRef:'r6'}
  ],
  ipv6Networks:[
    {id:'v6-10',vlanRef:'v10',prefix:'2001:db8:6:10::/64',gateway:'2001:db8:6:10::1',slaac:true,routerAdvertisement:true},
    {id:'v6-40',vlanRef:'v40',prefix:'2001:db8:6:40::/64',gateway:'2001:db8:6:40::1',slaac:true,routerAdvertisement:true}
  ],
  vlanMatrix:{'v40_v10':false},
  hosts:[],links:[],fwRules:[],dhcp:{},roas:{},vtp:{roles:{}},routing:{strategy:'static'},
  management:{},highAvailability:{},accessSecurity:{},linkAggregations:[],wanCircuits:[]
};
const dualStackAcl=Engine.firewallIpv6Acl(dualStackProject,'r6');
assert.deepStrictEqual(dualStackAcl.unsupported,[]);
assert.match(dualStackAcl.text,/deny ipv6 2001:db8:6:40::\/64 2001:db8:6:10::\/64/);
const dualStackResult=Engine.generateAll(dualStackProject);
assert.strictEqual(dualStackResult.configReadiness.r6.status,'apply-ready',JSON.stringify(dualStackResult.configReadiness.r6.reasons));
assert.match(dualStackResult.configs.r6,/^ipv6 unicast-routing$/m);
assert.match(dualStackResult.configs.r6,/interface GigabitEthernet0\/1\.10[\s\S]*ipv6 address 2001:db8:6:10::1\/64/);
assert.match(dualStackResult.configs.r6,/interface GigabitEthernet0\/1\.40[\s\S]*ipv6 address 2001:db8:6:40::1\/64/);
assert.match(dualStackResult.configs.r6,/ipv6 access-list FW_POLICY_V6/);
assert.match(dualStackResult.configs.r6,/interface GigabitEthernet0\/1\.40[\s\S]*ipv6 traffic-filter FW_POLICY_V6 in/);
assert.match(dualStackResult.configs.r6,/ip access-list extended FW_POLICY/);
assert.doesNotMatch(dualStackResult.configs.r6,/ip access-list extended NW_SEG_V40/);

const vpnProject={
  _schemaVersion:'3.50.0',
  projName:'Private VPN generation',
  devices:[
    {id:'vpn-r1',name:'VPN-HQ',type:'router',kind:'router',vendorOs:'cisco_ios'},
    {id:'vpn-r2',name:'VPN-BRANCH',type:'router',kind:'router',vendorOs:'cisco_ios'}
  ],
  ports:[
    {id:'vpn-r1-wan',deviceId:'vpn-r1',name:'GigabitEthernet0/0',mode:'routed',role:'wan',l3Ip:'203.0.113.2',l3Cidr:'203.0.113.2/30'},
    {id:'vpn-r1-lan',deviceId:'vpn-r1',name:'GigabitEthernet0/1',mode:'routed',role:'lan',l3Ip:'10.10.0.1',l3Cidr:'10.10.0.0/24'},
    {id:'vpn-r2-wan',deviceId:'vpn-r2',name:'GigabitEthernet0/0',mode:'routed',role:'wan',l3Ip:'198.51.100.2',l3Cidr:'198.51.100.2/30'},
    {id:'vpn-r2-lan',deviceId:'vpn-r2',name:'GigabitEthernet0/1',mode:'routed',role:'lan',l3Ip:'10.20.0.1',l3Cidr:'10.20.0.0/24'}
  ],
  wanCircuits:[
    {id:'vpn-c1',name:'HQ Internet',deviceId:'vpn-r1',portId:'vpn-r1-wan',provider:'ISP-A',role:'primary',enabled:true,bandwidthDownMbps:500,bandwidthUpMbps:200},
    {id:'vpn-c2',name:'Branch Internet',deviceId:'vpn-r2',portId:'vpn-r2-wan',provider:'ISP-B',role:'primary',enabled:true,bandwidthDownMbps:300,bandwidthUpMbps:100}
  ],
  vlans:[],
  subnets:[
    {id:'vpn-s1',cidr:'10.10.0.0/24',gateway:'10.10.0.1',gatewayDeviceRef:'vpn-r1'},
    {id:'vpn-s2',cidr:'10.20.0.0/24',gateway:'10.20.0.1',gatewayDeviceRef:'vpn-r2'}
  ],
  hosts:[],links:[],fwRules:[],dhcp:{},roas:{},vtp:{roles:{}},
  routing:{
    strategy:'static',
    siteToSiteVpns:[{
      id:'vpn-hq-branch',name:'HQ-BRANCH',enabled:true,
      localDeviceId:'vpn-r1',remoteDeviceId:'vpn-r2',
      localCircuitRef:'vpn-c1',remoteCircuitRef:'vpn-c2',
      localPrefixes:['10.10.0.0/24'],remotePrefixes:['10.20.0.0/24'],
      secretAlias:'VPN_HQ_BRANCH_PSK',ikeVersion:'2',encryption:'aes256',integrity:'sha256',
      dhGroup:14,pfsGroup:14,ikeLifetimeSeconds:28800,ipsecLifetimeSeconds:3600
    }]
  },
  management:{},highAvailability:{},accessSecurity:{},linkAggregations:[]
};
const vpnResult=Engine.generateAll(vpnProject);
assert.strictEqual(vpnResult.ok,true);
for(const id of ['vpn-r1','vpn-r2']){
  assert.strictEqual(vpnResult.configReadiness[id].status,'review-required');
  assert.ok(vpnResult.configReadiness[id].reasons.some(x=>/alias de secretos/.test(x)));
  assert.match(vpnResult.configs[id],/VPN site-to-site generada desde plan neutral/);
  assert.match(vpnResult.configs[id],/\$\{SECRET:VPN_HQ_BRANCH_PSK\}/);
  assert.strictEqual((vpnResult.configs[id].match(/^configure terminal$/gm)||[]).length,1);
  assert.strictEqual((vpnResult.configs[id].match(/^end$/gm)||[]).length,1);
  assert.strictEqual((vpnResult.configs[id].match(/^write memory$/gm)||[]).length,1);
}

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


const verifiedVtp=JSON.parse(JSON.stringify(vtpProject));
verifiedVtp.vtp={domain:'EMPRESA',password:'',version:'3',pruning:'yes',roles:{sw1:'server'}};
verifiedVtp.observedState={
  observedAt:'2026-09-30T12:00:00.000Z',
  vtpDevices:{
    sw1:{
      domain:'EMPRESA',version:'3',mode:'server',revision:42,
      primary:true,primaryId:'0011.2233.4455',primaryConflict:false,
      digestErrors:0,revisionErrors:0,observedAt:'2026-09-30T12:00:00.000Z'
    }
  }
};
const verifiedVtpResult=Engine.generateAll(verifiedVtp);
assert.strictEqual(verifiedVtpResult.ok,true);
assert.strictEqual(verifiedVtpResult.configReadiness.sw1.status,'apply-ready');

const mismatchedVtp=JSON.parse(JSON.stringify(verifiedVtp));
mismatchedVtp.observedState.vtpDevices.sw1.domain='OTRO-DOMINIO';
const mismatchedVtpResult=Engine.generateAll(mismatchedVtp);
assert.strictEqual(mismatchedVtpResult.configReadiness.sw1.status,'review-required');
assert.ok(mismatchedVtpResult.configReadiness.sw1.reasons.some(x=>/Dominio VTP observado/.test(x)));

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
