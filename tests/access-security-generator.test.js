'use strict';
const assert=require('assert');
const Plan=require('../js/netwizard-access-security-plan.js');
const Gen=require('../js/netwizard-access-security-generator.js');
function test(name,fn){try{fn();console.log(`✓ ${name}`);}catch(e){console.error(`✗ ${name}`);throw e;}}
function project(vendorOs){return {
  accessSecurity:{dhcpSnooping:true,arpInspection:true,portSecurity:true,maxMac:3,sticky:true},
  devices:[{id:'sw1',name:'SW-ACCESS',type:'switch',vendorOs}],
  vlans:[{id:'v10',vlanId:10,name:'Users'},{id:'v20',vlanId:20,name:'Voice'}],
  ports:[
    {id:'p1',deviceId:'sw1',name:'Gi1/0/1',mode:'access',accessVlanRef:'v10'},
    {id:'p47',deviceId:'sw1',name:'Gi1/0/47',mode:'trunk',uplink:'yes'},
    {id:'p48',deviceId:'sw1',name:'Gi1/0/48',mode:'trunk',uplink:'yes'}
  ],
  linkAggregations:[{id:'lag1',number:1,protocol:'lacp',mode:'active',memberPortIds:['p47','p48'],trunk:true,allowedVlans:[10,20]}]
};}

test('Plan neutral clasifica uplinks confiables y puertos access',()=>{
  const plan=Plan.build(project('cisco_ios')).devices[0];
  assert.strictEqual(plan.trustedPorts.length,2);
  assert.strictEqual(plan.accessPorts.length,1);
  assert.strictEqual(plan.aggregates[0].memberPortNames.length,2);
  assert.deepStrictEqual(plan.protectedVlans,[10,20]);
});

test('Cisco genera DHCP snooping, DAI, port-security y LACP',()=>{
  const p=project('cisco_ios'); const out=Gen.render(p,'sw1','cisco_ios');
  assert.ok(out.includes('ip dhcp snooping vlan 10,20'));
  assert.ok(out.includes('ip arp inspection vlan 10,20'));
  assert.ok(out.includes('switchport port-security maximum 3'));
  assert.ok(out.includes('channel-group 1 mode active'));
  assert.ok(out.includes('interface Port-channel1'));
});

test('Junos, Huawei, MikroTik y Aruba generan agregación LACP',()=>{
  const cases=[
    ['juniper_junos','802.3ad ae1'],
    ['huawei_vrp','interface Eth-Trunk1'],
    ['mikrotik_routeros','mode=802.3ad'],
    ['aruba_aoss','trunk Gi1/0/47,Gi1/0/48 trk1 lacp']
  ];
  for(const [vendor,needle] of cases){const p=project(vendor);assert.ok(Gen.render(p,'sw1',vendor).includes(needle),vendor);}
});

test('Legacy security se usa como fallback pero accessSecurity explícito manda',()=>{
  const legacy=project('cisco_ios');
  delete legacy.accessSecurity;
  legacy.security={bpdu:'no',ps:'no',ds:'no',dai:'no',ipsg:'yes',dsV:'10'};
  const fallback=Plan.build(legacy).devices[0];
  assert.strictEqual(fallback.dhcpSnooping,false);
  assert.strictEqual(fallback.arpInspection,false);
  assert.strictEqual(fallback.accessPorts[0].portSecurity,false);
  assert.strictEqual(fallback.bpduGuard,false);
  assert.strictEqual(fallback.ipSourceGuard,true);
  assert.deepStrictEqual(fallback.protectedVlans,[10]);

  legacy.accessSecurity={dhcpSnooping:true,arpInspection:true,portSecurity:true,bpduGuard:true,portFast:true,ipSourceGuard:false,protectedVlanIds:[20]};
  const canonical=Plan.build(legacy).devices[0];
  assert.strictEqual(canonical.dhcpSnooping,true);
  assert.strictEqual(canonical.arpInspection,true);
  assert.strictEqual(canonical.accessPorts[0].portSecurity,true);
  assert.strictEqual(canonical.bpduGuard,true);
  assert.strictEqual(canonical.ipSourceGuard,false);
  assert.deepStrictEqual(canonical.protectedVlans,[20]);
});

test('Cisco respeta hardening desactivado e IP Source Guard explícito',()=>{
  const p=project('cisco_ios');
  p.accessSecurity={dhcpSnooping:false,arpInspection:false,portSecurity:false,bpduGuard:false,portFast:false,ipSourceGuard:false};
  let out=Gen.render(p,'sw1','cisco_ios');
  assert.ok(!out.includes('ip dhcp snooping vlan'));
  assert.ok(!out.includes('ip arp inspection vlan'));
  assert.ok(!out.includes('switchport port-security'));
  assert.ok(!out.includes('ip verify source'));
  p.accessSecurity={dhcpSnooping:true,arpInspection:false,portSecurity:false,bpduGuard:false,portFast:false,ipSourceGuard:true,protectedVlanIds:[10]};
  out=Gen.render(p,'sw1','cisco_ios');
  assert.ok(out.includes('ip dhcp snooping vlan 10'));
  assert.ok(out.includes('ip verify source'));
  assert.ok(!out.includes('ip dhcp snooping vlan 10,20'));
});

test('VLAN de cuarentena solo marca puertos access no conectados',()=>{
  const p=project('cisco_ios');
  p.vlans.push({id:'vq',vlanId:999,name:'Quarantine'});
  p.accessSecurity.quarantineVlanRef='vq';
  p.hosts=[{id:'h1',name:'PC',portRef:'p1'}];
  const connected=Plan.build(p).devices[0];
  assert.strictEqual(connected.quarantineVlanId,999);
  assert.strictEqual(connected.accessPorts[0].unused,false);
  p.hosts=[];
  const unused=Plan.build(p).devices[0];
  assert.strictEqual(unused.accessPorts[0].unused,true);
});

test('La inserción es idempotente',()=>{
  const p=project('cisco_ios');
  const once=Gen.appendToConfig('hostname SW-ACCESS\n',p,'sw1','cisco_ios');
  const twice=Gen.appendToConfig(once,p,'sw1','cisco_ios');
  assert.strictEqual(once,twice);
});
console.log('\nTests access security/LACP completados.');
