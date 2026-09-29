'use strict';

const assert=require('assert');
const Cap=require('../private/vendor-config-capabilities.js');
const Engine=require('../private/vendor-config-engine.js');

assert.deepStrictEqual(
  Cap.capabilityFor({vendorOs:'cisco_ios',kind:'switch'}).supported,
  true
);
assert.strictEqual(Cap.capabilityFor({vendorOs:'huawei_vrp',kind:'access_point'}).supported,false);
assert.strictEqual(Cap.capabilityFor({vendorOs:'ubiquiti_unifi',kind:'access_point'}).mode,'procedure');
assert.strictEqual(Cap.capabilityFor({vendorOs:'windows',kind:'server'}).mode,'script');
assert.strictEqual(Cap.capabilityFor({vendorOs:'generic_network',kind:'router'}).mode,'unsupported');

const asa=Engine.finalizeCiscoAsaConfig('! ASA\nhostname EDGE\nwrite memory\n');
assert.strictEqual((asa.match(/^configure terminal$/gm)||[]).length,1);
assert.strictEqual((asa.match(/^end$/gm)||[]).length,1);
assert.strictEqual((asa.match(/^write memory$/gm)||[]).length,1);
assert.ok(asa.indexOf('hostname EDGE')<asa.indexOf('\nend\n'));

const junos=Engine.finalizeJunosConfig('# Junos\nset system host-name EDGE\n# Management\nset system services ssh\n');
assert.ok(junos.startsWith('configure\n'));
assert.ok(junos.includes('set system host-name EDGE'));
assert.ok(junos.endsWith('commit check\ncommit and-quit\n'));
assert.strictEqual((junos.match(/^commit and-quit$/gm)||[]).length,1);

const huawei=Engine.finalizeHuaweiConfig('# Huawei\nsystem-view\nsysname EDGE\nreturn\n# Management\nstelnet server enable\n');
assert.ok(huawei.startsWith('system-view\n'));
assert.ok(huawei.includes('sysname EDGE'));
assert.ok(huawei.indexOf('stelnet server enable')<huawei.lastIndexOf('\nreturn\n'));
assert.ok(huawei.endsWith('return\nsave\n'));
assert.strictEqual((huawei.match(/^system-view$/gm)||[]).length,1);

const aruba=Engine.finalizeArubaAosConfig('; Aruba\nhostname "SW1"\nwrite memory\n');
assert.ok(aruba.startsWith('configure terminal\n'));
assert.ok(aruba.endsWith('exit\nwrite memory\n'));
assert.strictEqual((aruba.match(/^write memory$/gm)||[]).length,1);

const base={
  _schemaVersion:'3.50.0',
  projName:'Vendor capability test',
  vlans:[{id:'v10',vlanId:10,name:'Users'}],
  subnets:[{id:'s10',vlanRef:'v10',cidr:'10.10.10.0/24',gateway:'10.10.10.1'}],
  hosts:[],links:[],fwRules:[],dhcp:{},routing:{strategy:'static'},
  roas:{gwId:null,lanIf:'',wanCidr:'',wanNh:''},
  management:{},highAvailability:{},accessSecurity:{},linkAggregations:[]
};

const junosProject=Object.assign({},base,{
  devices:[{id:'j1',name:'JUNOS-EDGE',type:'router',kind:'router',vendorOs:'juniper_junos'}],
  ports:[{id:'j1-lan',deviceId:'j1',name:'ge-0/0/1',mode:'trunk',role:'lan',allowedVlans:[10]}]
});
const jr=Engine.generateAll(junosProject);
assert.strictEqual(jr.ok,true);
assert.strictEqual(jr.configCapabilities.j1.mode,'cli');
assert.match(jr.configs.j1,/^configure$/m);
assert.match(jr.configs.j1,/^commit check$/m);
assert.match(jr.configs.j1,/^commit and-quit$/m);
assert.strictEqual(jr.configReadiness.j1.status,'review-required');

const huaweiProject=Object.assign({},base,{
  devices:[{id:'h1',name:'HUAWEI-EDGE',type:'router',kind:'router',vendorOs:'huawei_vrp'}],
  ports:[{id:'h1-lan',deviceId:'h1',name:'GigabitEthernet0/0/1',mode:'trunk',role:'lan',allowedVlans:[10]}]
});
const hr=Engine.generateAll(huaweiProject);
assert.strictEqual(hr.ok,true);
assert.match(hr.configs.h1,/^system-view$/m);
assert.match(hr.configs.h1,/^return$/m);
assert.match(hr.configs.h1,/^save$/m);
assert.strictEqual(hr.configReadiness.h1.status,'review-required');

const wrongKind=Object.assign({},base,{
  devices:[{id:'ap1',name:'AP-HUAWEI',type:'access_point',kind:'access_point',vendorOs:'huawei_vrp'}],
  ports:[{id:'ap1-uplink',deviceId:'ap1',name:'GE0/0/1',mode:'trunk',role:'uplink',allowedVlans:[10]}]
});
const bad=Engine.generateAll(wrongKind);
assert.strictEqual(bad.ok,false);
assert.ok(bad.issues.some(x=>x.code==='NW-PRIVATE-CONFIG-004'&&x.deviceId==='ap1'));
assert.strictEqual(bad.configs.ap1,undefined);

console.log('✓ Private Engine aplica matriz vendor/tipo y finalizadores CLI antes de certificar');
