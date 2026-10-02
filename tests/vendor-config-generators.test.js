#!/usr/bin/env node
'use strict';

const assert = require('assert');
const path = require('path');

const root = path.resolve(__dirname, '..');
const NWV = require(path.join(root, 'js', 'netwizard-vendor-config-generators.js'));
const NWCore = require(path.join(root, 'js', 'netwizard-core-utils.js'));
const NWU = require(path.join(root, 'js', 'netwizard-network-utils.js'));

function test(name, fn){
  try { fn(); console.log(`✓ ${name}`); }
  catch (err) { console.error(`✗ ${name}`); throw err; }
}

function genFor(project){
  return NWV.createEnhancedGenConfig({
    originalGenConfig(devId, format){ return `! Sin vendor asignado: ${devId} ${format || ''}\n`; },
    getProject(){ return project; },
    getFwAcl(){ return '! FW ACL TEST'; },
    coreUtils: NWCore,
    netUtils: NWU
  });
}

const baseProject = {
  devices:[{id:'r1',name:'RTR Edge',type:'router',vendorOs:'cisco_ios',internetEdge:'yes',wanIf:'GigabitEthernet0/0'}],
  ports:[{id:'wan',deviceId:'r1',name:'GigabitEthernet0/0',role:'wan'},{id:'lan',deviceId:'r1',name:'GigabitEthernet0/1',role:'lan'}],
  vlans:[{id:'v10',vlanId:10,name:'Usuarios'}],
  subnets:[{id:'sn10',vlanRef:'v10',cidr:'10.10.10.0/24',gateway:'10.10.10.1'}],
  hosts:[{id:'h1',name:'PC1',vlanRef:'v10',ipMode:'static',staticIp:'10.10.10.20'}],
  dhcp:{'10':{enabled:true,dns:'1.1.1.1,8.8.8.8',lease:7}},
  roas:{wanCidr:'198.51.100.2/30',wanNh:'198.51.100.1'},
  fwRules:[]
};

test('Cisco IOS router sin RoaS explícito genera subinterfaces, DHCP, NAT y ACL', () => {
  const gen = genFor(baseProject);
  const cfg = gen('r1', 'cisco_ios');
  assert.ok(cfg.includes('interface GigabitEthernet0/1.10'));
  assert.ok(cfg.includes('encapsulation dot1Q 10'));
  assert.ok(cfg.includes('ip dhcp pool VLAN10'));
  assert.ok(cfg.includes('ip nat inside source list 100 interface GigabitEthernet0/0 overload'));
  assert.ok(cfg.includes('! FW ACL TEST'));
});


test('Cisco IOS usa WAN canónica por dispositivo sin duplicar autoridad en roas', () => {
  const project=JSON.parse(JSON.stringify(baseProject));
  project.roas={};
  project.ports[0]={
    id:'wan',deviceId:'r1',name:'GigabitEthernet0/0',mode:'routed',role:'wan',
    l3Ip:'198.51.100.2',l3Cidr:'198.51.100.0/30'
  };
  project.wanCircuits=[{
    id:'wan-primary',deviceId:'r1',portId:'wan',role:'primary',enabled:true,
    provider:'ISP-A',bandwidthDownMbps:1000,bandwidthUpMbps:1000
  }];
  project.highAvailability={devices:{r1:{defaultRoutes:[
    {nextHop:'198.51.100.1',distance:1,circuitRef:'wan-primary'}
  ]}}};
  const cfg=genFor(project)('r1','cisco_ios');
  assert.match(cfg,/interface GigabitEthernet0\/0[\s\S]*ip address 198\.51\.100\.2 255\.255\.255\.252/);
  assert.match(cfg,/interface GigabitEthernet0\/0[\s\S]*ip nat outside/);
  assert.match(cfg,/ip nat inside source list 100 interface GigabitEthernet0\/0 overload/);
});

test('Cisco IOS multi-router con gatewayDeviceRef trata RoaS como intención explícita', () => {
  const project=JSON.parse(JSON.stringify(baseProject));
  project.devices.push({id:'r2',name:'RTR Peer',type:'router',kind:'router',vendorOs:'cisco_ios'});
  project.ports.push({id:'r2-transit',deviceId:'r2',name:'GigabitEthernet0/0',mode:'routed',role:'transit',l3Ip:'10.255.0.2',l3Cidr:'10.255.0.0/30'});
  project.subnets[0].gatewayDeviceRef='r1';
  project.ports[1].mode='trunk';
  project.ports[1].allowedVlans=[10];
  project.ports[1].nativeVlanRef='v10';
  const cfg=genFor(project)('r1','cisco_ios');
  assert.match(cfg,/interface GigabitEthernet0\/1\.10/);
  assert.doesNotMatch(cfg,/gateway RoaS inferido automáticamente/);
});

test('Cisco IOS router de tránsito puro no recibe RoaS de VLANs pertenecientes a otro router', () => {
  const project=JSON.parse(JSON.stringify(baseProject));
  project.devices.push({id:'r2',name:'RTR Transit',type:'router',kind:'router',vendorOs:'cisco_ios'});
  project.ports.push({id:'r2-transit',deviceId:'r2',name:'GigabitEthernet0/0',mode:'routed',role:'transit',l3Ip:'10.255.0.2',l3Cidr:'10.255.0.0/30'});
  project.subnets[0].gatewayDeviceRef='r1';
  const cfg=genFor(project)('r2','cisco_ios');
  assert.doesNotMatch(cfg,/gateway RoaS inferido automáticamente/);
  assert.doesNotMatch(cfg,/interface GigabitEthernet0\/1\.10/);
  assert.match(cfg,/interface GigabitEthernet0\/0/);
  assert.match(cfg,/ip address 10\.255\.0\.2 255\.255\.255\.252/);
});

test('MikroTik RouterOS no cae en vendor desconocido y genera bridge VLAN filtering', () => {
  const project = JSON.parse(JSON.stringify(baseProject));
  project.devices[0].vendorOs = 'mikrotik_routeros';
  project.devices[0].model = 'MikroTik hAP ax3';
  const cfg = genFor(project)('r1', 'mikrotik_routeros');
  assert.ok(cfg.includes('MikroTik RouterOS'));
  assert.ok(cfg.includes('/interface bridge add name=bridge-lan vlan-filtering=yes'));
  assert.ok(!cfg.includes('Sin vendor asignado'));
});

test('Huawei VRP genera Vlanif y trunk', () => {
  const project = JSON.parse(JSON.stringify(baseProject));
  project.devices[0].vendorOs = 'huawei_vrp';
  const cfg = genFor(project)('r1', 'huawei_vrp');
  assert.ok(cfg.includes('Huawei VRP'));
  assert.ok(cfg.includes('interface Vlanif10'));
  assert.ok(cfg.includes('port link-type trunk'));
});

test('UniFi genera plan neutral de controlador, no CLI falsa', () => {
  const project = JSON.parse(JSON.stringify(baseProject));
  project.devices[0].vendorOs = 'ubiquiti_unifi';
  project.devices[0].model = 'UniFi U6 Pro';
  project.ports[1].mode = 'trunk';
  project.ports[1].allowedVlans = [10];
  const cfg = genFor(project)('r1', 'ubiquiti_unifi');
  assert.ok(cfg.includes('Configuración de controlador/cloud'));
  assert.ok(cfg.includes('Ubiquiti UniFi'));
  assert.ok(cfg.includes('VLANs a transportar: 10'));
});

test('Cisco IOS con RoaS explícito usa fallback modular cuando el generador legacy no está disponible', () => {
  const p = JSON.parse(JSON.stringify(baseProject));
  p.devices[0].vendorOs = 'cisco_ios';
  p.devices[0].type = 'router';
  p.devices[0].kind = 'router';
  p.roas = {gwId:'r1',lanIf:'GigabitEthernet0/1',wanCidr:'192.0.2.2/30',wanNh:'192.0.2.1'};
  const enhanced = NWV.createEnhancedGenConfig({
    originalGenConfig(){ return '! Vendor/OS todavía no implementado en Private Engine: cisco_ios\n'; },
    getProject(){ return p; },
    getFwAcl(){ return ''; },
    coreUtils: NWCore,
    netUtils: NWU
  });
  const cfg = enhanced('r1','cisco_ios');
  assert.match(cfg,/Cisco IOS Router\/Firewall/);
  assert.match(cfg,/hostname RTR_Edge|hostname RTR-Edge|hostname RTR_Edge/i);
  assert.doesNotMatch(cfg,/todavía no implementado en Private Engine/);
  assert.doesNotMatch(cfg,/gateway RoaS inferido automáticamente/);
});

console.log('\nTests vendor config generators completados.');
