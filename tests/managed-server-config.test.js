'use strict';

const assert=require('assert');
const fs=require('fs');
const path=require('path');
const Legacy=require('../private/legacy-vendor-generators.js');

const root=path.resolve(__dirname,'..');
const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
const main=fs.readFileSync(path.join(root,'js/netwizard.js'),'utf8');

assert.ok(html.includes('id="hDeviceRef"'));
assert.ok(html.includes('Dispositivo gestionado representado'));
assert.ok(main.includes('function fillHostManagedDeviceSel('));
assert.ok(main.includes("deviceRef=$('hDeviceRef')?.value||null"));
assert.ok(main.includes('portAssignMode,deviceRef'));

const project={
  devices:[{id:'win1',name:'WIN1',kind:'server',type:'server',vendorOs:'windows'}],
  hosts:[{id:'h1',name:'APP1',type:'server',deviceRef:'win1',vlanRef:'v10',ipMode:'static',staticIp:'10.10.10.20'}],
  vlans:[{id:'v10',vlanId:10,name:'Servers'}],
  subnets:[{id:'s10',vlanRef:'v10',cidr:'10.10.10.0/24',gateway:'10.10.10.1'}],
  dhcp:{'10':{dns:'10.10.10.53'}},fwRules:[]
};
const host=Legacy.managedHost(project,project.devices[0]);
assert.ok(host);
assert.strictEqual(host.id,'h1');
const script=Legacy.renderWindows(project,project.devices[0]);
assert.match(script,/APP1/);
assert.match(script,/10\.10\.10\.20/);
assert.match(script,/10\.10\.10\.1/);
assert.doesNotMatch(script,/10\.10\.10\.10|Remote Desktop|LocalPort 80,443/);

const noBinding=JSON.parse(JSON.stringify(project));
delete noBinding.hosts[0].deviceRef;
assert.strictEqual(Legacy.renderWindows(noBinding,noBinding.devices[0]),'');

console.log('✓ host.deviceRef vincula de forma explícita los scripts server-side al dispositivo gestionado');
