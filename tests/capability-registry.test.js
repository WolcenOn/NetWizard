const assert=require('assert');
const Registry=require('../js/netwizard-capability-registry.js');

(function testVersionComparison(){
  assert.strictEqual(Registry.compareVersions('7.10','7.2'),1);
  assert.strictEqual(Registry.compareVersions('6.4.12','6.4'),1);
  assert.strictEqual(Registry.compareVersions('15.0','15.0'),0);
})();

(function testKnownPlatformAndCapability(){
  const p=Registry.resolvePlatform({vendorOs:'cisco_ios'});
  assert(p&&p.vendor==='Cisco');
  assert.strictEqual(Registry.getCapability('cisco_ios','dhcpSnooping').status,'supported');
  assert.strictEqual(Registry.getCapability('cisco_ios','bgp').status,'planned');
})();

(function testPlannedCapabilityBlocks(){
  const project={devices:[{id:'r1',vendorOs:'cisco_ios',features:{bgp:true}}]};
  const report=Registry.validateProject(project);
  assert.strictEqual(report.ok,false);
  assert(report.issues.some(i=>i.code==='NW-CAP-001'&&i.capability==='bgp'));
})();

(function testMinimumVersionBlocks(){
  const project={devices:[{id:'mt1',vendorOs:'mikrotik_routeros',osVersion:'6.49',features:{vrf:true}}]};
  const report=Registry.validateProject(project);
  assert(report.issues.some(i=>i.code==='NW-CAP-003'&&i.capability==='vrf'));
})();

(function testLicenseRequirement(){
  const project={devices:[{id:'fw1',vendorOs:'fortinet',license:'base',features:{utm:true}}]};
  const report=Registry.validateProject(project);
  assert(report.issues.some(i=>i.code==='NW-CAP-005'&&i.capability==='utm'));
})();

(function testPartialCapabilityWarns(){
  const project={devices:[{id:'j1',vendorOs:'juniper_junos',features:{arpInspection:true}}]};
  const report=Registry.validateProject(project);
  assert.strictEqual(report.ok,true);
  assert(report.issues.some(i=>i.code==='NW-CAP-002'&&!i.blocking));
})();

(function testExtensibleRegistration(){
  Registry.registerPlatform({id:'lab_os',vendor:'Lab',capabilities:{featureX:{status:'supported',minVersion:'2.0',licenses:['pro']}}});
  const bad=Registry.validateProject({devices:[{id:'x',vendorOs:'lab_os',osVersion:'1.0',license:'basic',features:{featureX:true}}]});
  assert.strictEqual(bad.ok,false);
  assert(bad.issues.some(i=>i.code==='NW-CAP-003'));
  assert(bad.issues.some(i=>i.code==='NW-CAP-005'));
})();

console.log('capability-registry.test.js: OK');