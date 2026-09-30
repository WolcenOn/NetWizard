'use strict';
const assert=require('assert');
const G=require('../js/netwizard-switching-generator.js');
function test(name,fn){try{fn();console.log(`✓ ${name}`);}catch(e){console.error(`✗ ${name}`);throw e;}}
function project(vendor){return {devices:[{id:'sw1',name:'SW-ACCESS-01',type:'switch',vendorOs:vendor}],vlans:[{id:'v10',vlanId:10,name:'Users'},{id:'v20',vlanId:20,name:'Voice'},{id:'v999',vlanId:999,name:'Native'}],ports:[{id:'p1',deviceId:'sw1',name:'Gi1/0/1',mode:'access',accessVlanRef:'v10',desc:'User desk'},{id:'p2',deviceId:'sw1',name:'Gi1/0/48',mode:'trunk',allowedVlans:[10,20,999],nativeVlanRef:'v999',desc:'Uplink'}]};}
test('Cisco genera VLANs, trunk mínimo, RSTP y protección de acceso',()=>{const out=G.render(project('cisco_ios'),'sw1');assert.ok(out.includes('spanning-tree mode rapid-pvst'));assert.ok(out.includes('switchport trunk allowed vlan 10,20,999'));assert.ok(out.includes('switchport trunk native vlan 999'));assert.ok(out.includes('spanning-tree bpduguard enable'));assert.ok(out.includes('storm-control broadcast'));});
test('Cisco VTP server usa placeholder de secreto y conserva creación local de VLANs',()=>{
  const p=project('cisco_ios');
  p.vtp={domain:'EMPRESA',password:'super-secret-plain',version:'2',pruning:'yes',roles:{sw1:'server'}};
  const out=G.render(p,'sw1');
  assert.ok(out.includes('vtp domain EMPRESA'));
  assert.ok(out.includes('vtp password ${SECRET:VTP_PASSWORD}'));
  assert.ok(out.includes('vtp mode server'));
  assert.ok(out.includes('vtp version 2'));
  assert.ok(out.includes('vtp pruning'));
  assert.ok(out.includes('vlan 10'));
  assert.ok(!out.includes('super-secret-plain'));
});
test('Cisco VTP client no crea VLANs localmente pero mantiene puertos',()=>{
  const p=project('cisco_ios');
  p.vtp={domain:'EMPRESA',version:'3',pruning:'no',roles:{sw1:'client'}};
  const out=G.render(p,'sw1');
  assert.ok(out.includes('vtp mode client'));
  assert.ok(!/^vlan 10$/m.test(out));
  assert.ok(!/^vlan 20$/m.test(out));
  assert.ok(out.includes('interface Gi1/0/1'));
  assert.ok(out.includes('switchport access vlan 10'));
  assert.ok(out.includes('interface Gi1/0/48'));
});
test('Junos genera switching access/trunk y RSTP edge',()=>{const out=G.render(project('juniper_junos'),'sw1');assert.ok(out.includes('set protocols rstp interface all'));assert.ok(out.includes('interface-mode trunk'));assert.ok(out.includes('native-vlan-id 999'));assert.ok(out.includes('interface-mode access'));assert.ok(out.includes('edge'));});
test('Huawei genera RSTP, trunk limitado y protección BPDU',()=>{const out=G.render(project('huawei_vrp'),'sw1');assert.ok(out.includes('stp mode rstp'));assert.ok(out.includes('port trunk allow-pass vlan 10 20 999'));assert.ok(out.includes('port default vlan 10'));assert.ok(out.includes('stp bpdu-protection'));});
test('MikroTik genera bridge vlan-filtering y entradas tagged/untagged',()=>{const out=G.render(project('mikrotik_routeros'),'sw1');assert.ok(out.includes('vlan-filtering=yes protocol-mode=rstp'));assert.ok(out.includes('pvid=10 edge=yes bpdu-guard=yes'));assert.ok(out.includes('vlan-ids=10'));assert.ok(out.includes('tagged=bridge-lan,Gi1/0/48'));});
test('Aruba genera VLANs, tagged/untagged y edge protection',()=>{const out=G.render(project('aruba_aoss'),'sw1');assert.ok(out.includes('spanning-tree'));assert.ok(out.includes('tagged vlan 10,20,999'));assert.ok(out.includes('untagged vlan 10'));assert.ok(out.includes('bpdu-protection'));});
test('Hardening canónico desactiva edge/BPDU cuando el usuario lo desactiva',()=>{
  const p=project('cisco_ios');
  p.accessSecurity={bpduGuard:false,portFast:false,portSecurity:false,dhcpSnooping:false,arpInspection:false};
  const out=G.render(p,'sw1');
  assert.ok(!out.includes('spanning-tree portfast'));
  assert.ok(!out.includes('spanning-tree bpduguard'));
});

test('VLAN quarantine sustituye la VLAN solo en puertos access sin conexión',()=>{
  const p=project('cisco_ios');
  p.accessSecurity={quarantineVlanRef:'v999'};
  let out=G.render(p,'sw1');
  assert.ok(out.includes('switchport access vlan 999'));
  p.hosts=[{id:'h1',name:'PC',portRef:'p1'}];
  out=G.render(p,'sw1');
  assert.ok(out.includes('switchport access vlan 10'));
  assert.ok(!out.includes('switchport access vlan 999'));
});

test('No genera bloque switching para routers',()=>{const p=project('cisco_ios');p.devices[0].type='router';assert.strictEqual(G.render(p,'sw1'),'');});
console.log('\nTests switching generator completados.');
