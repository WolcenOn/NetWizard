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

console.log('\nTests vendor config generators completados.');
