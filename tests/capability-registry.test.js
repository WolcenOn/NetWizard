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
  assert.deepStrictEqual(Registry.getCapability('cisco_ios','arpInspection').requires,['dhcpSnooping']);
})();

(function testPlannedCapabilityBlocks(){
  const report=Registry.validateProject({devices:[{id:'r1',vendorOs:'cisco_ios',features:{bgp:true}}]});
  assert.strictEqual(report.ok,false);
  assert(report.issues.some(i=>i.code==='NW-CAP-001'&&i.capability==='bgp'));
})();

(function testMinimumVersionBlocks(){
  const report=Registry.validateProject({devices:[{id:'mt1',vendorOs:'mikrotik_routeros',osVersion:'6.49',features:{vrf:true}}]});
  assert(report.issues.some(i=>i.code==='NW-CAP-003'&&i.capability==='vrf'));
})();

(function testLicenseRequirement(){
  const report=Registry.validateProject({devices:[{id:'fw1',vendorOs:'fortinet',license:'base',features:{utm:true}}]});
  assert(report.issues.some(i=>i.code==='NW-CAP-005'&&i.capability==='utm'));
})();

(function testPartialCapabilityWarns(){
  const report=Registry.validateProject({devices:[{id:'j1',vendorOs:'juniper_junos',features:{arpInspection:true,dhcpSnooping:true}}]});
  assert.strictEqual(report.ok,true);
  assert(report.issues.some(i=>i.code==='NW-CAP-002'&&!i.blocking));
})();

(function testMissingDependencyBlocks(){
  const project={devices:[{id:'sw1',vendorOs:'cisco_ios',features:{arpInspection:true}}]};
  const report=Registry.validateProject(project);
  assert.strictEqual(report.ok,false);
  assert(report.issues.some(i=>i.code==='NW-CAP-007'&&i.dependency==='dhcpSnooping'));
})();

(function testConflictBlocks(){
  const project={devices:[{id:'r1',vendorOs:'cisco_ios',features:{hsrp:true,vrrp:true}}]};
  const report=Registry.validateProject(project);
  assert.strictEqual(report.ok,false);
  assert(report.issues.some(i=>i.code==='NW-CAP-008'&&i.conflict==='vrrp'));
})();

(function testQuantitativeLimitBlocks(){
  Registry.registerPlatform({id:'tiny_os',vendor:'Tiny',capabilities:{lacp:{status:'supported',limits:{linkAggregations:1}}}});
  const project={devices:[{id:'sw1',vendorOs:'tiny_os',features:{lacp:true}}],linkAggregations:[{id:'a',deviceId:'sw1'},{id:'b',deviceId:'sw1'}]};
  const report=Registry.validateProject(project);
  assert.strictEqual(report.ok,false);
  const issue=report.issues.find(i=>i.code==='NW-CAP-009');
  assert(issue&&issue.actual===2&&issue.max===1);
})();

(function testRequiredParameterBlocks(){
  Registry.registerPlatform({id:'bgp_lab',vendor:'Lab',capabilities:{bgp:{status:'supported',parameters:{asn:{required:true},routerId:{required:true}}}}});
  const report=Registry.validateProject({devices:[{id:'r',vendorOs:'bgp_lab',features:{bgp:{asn:65000}}}]});
  assert(report.issues.some(i=>i.code==='NW-CAP-006'&&i.parameter==='routerId'));
})();

(function testExtensibleRegistration(){
  Registry.registerPlatform({id:'lab_os',vendor:'Lab',capabilities:{featureX:{status:'supported',minVersion:'2.0',licenses:['pro']}}});
  const bad=Registry.validateProject({devices:[{id:'x',vendorOs:'lab_os',osVersion:'1.0',license:'basic',features:{featureX:true}}]});
  assert.strictEqual(bad.ok,false);
  assert(bad.issues.some(i=>i.code==='NW-CAP-003'));
  assert(bad.issues.some(i=>i.code==='NW-CAP-005'));
})();

console.log('capability-registry.test.js: OK');