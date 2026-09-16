'use strict';

const assert=require('assert');
const Incremental=require('../js/netwizard-incremental-generators.js');
const Switching=require('../js/netwizard-switching-generator.js');

const observed='## Last changed\nset system host-name old-edge\nset interfaces ge-0/0/0 unit 0 family inet address 192.0.2.2/30\n';
const desired='# NetWizard\nset system host-name new-edge\nset interfaces ge-0/0/0 unit 0 family inet address 192.0.2.2/30\nset routing-options static route 0.0.0.0/0 next-hop 192.0.2.1\n';
function project(vendor,overrides){return Object.assign({projName:'Junos seguro',devices:[{id:'r1',name:'Edge 1',kind:'router',vendorOs:vendor||'juniper_junos'}],deployment:{changeMode:'incremental'},observedState:{deviceConfigs:{r1:{vendor:vendor||'juniper_junos',capturedAt:'2026-09-16T10:00:00Z',content:observed}}}},overrides||{});}
function changeSet(status){return{format:'netwizard-change-set',requestedMode:'incremental',devices:[{deviceId:'r1',status:status||'change-required'}]};}
function build(p,desiredConfig,change){return Incremental.buildPlan(p,{generatedAt:'2026-09-16T12:00:00Z',changeSet:change||changeSet(),desiredConfigs:{r1:desiredConfig==null?desired:desiredConfig}});}

const plan=build(project());
assert.strictEqual(plan.ok,true);
assert.strictEqual(plan.counts.candidateReady,1);
assert.strictEqual(plan.counts.manualReview,0);
assert.strictEqual(plan.devices[0].adapterId,'junos.set-delta');
assert.strictEqual(plan.devices[0].commandCounts.additions,2);
assert.strictEqual(plan.devices[0].commandCounts.deletions,1);
assert.strictEqual(plan.artifacts.length,2);
const apply=plan.artifacts.find(file=>file.path.includes('/commands/')).content;
const rollback=plan.artifacts.find(file=>file.path.includes('/rollback/')).content;
assert.match(apply,/^delete system host-name old-edge$/m);
assert.match(apply,/^set system host-name new-edge$/m);
assert.match(apply,/^set routing-options static route/m);
assert.ok(!/^configure$/m.test(apply));
assert.ok(!/^commit$/m.test(apply));
assert.match(rollback,/^delete system host-name new-edge$/m);
assert.match(rollback,/^set system host-name old-edge$/m);
assert.match(Incremental.buildSummaryMarkdown(plan),/candidate-ready/);
assert.ok(!Object.prototype.hasOwnProperty.call(Incremental.publicPlan(plan),'artifacts'));

const noChange=build(project(),observed,changeSet('no-change'));
assert.strictEqual(noChange.devices[0].status,'no-change');
assert.strictEqual(noChange.artifacts.length,0);

const invalidDesired=build(project(),'set system host-name edge\ncommit\n');
assert.strictEqual(invalidDesired.ok,true);
assert.strictEqual(invalidDesired.devices[0].status,'manual-review');
assert.ok(invalidDesired.issues.some(item=>item.code==='NW-INCREMENTAL-003'&&!item.blocking));

const strictInvalid=project('juniper_junos',{deployment:{changeMode:'incremental',requireExecutableIncremental:true}});
assert.strictEqual(build(strictInvalid,'set system host-name edge\ncommit\n').ok,false);

const secretDesired='set system host-name edge\nset access radius-server 10.0.0.1 secret ${SECRET:radius}\n';
assert.strictEqual(build(project(),secretDesired).devices[0].status,'manual-review');

const ciscoObserved=`version 17.9
hostname EDGE-1
vlan 10
 name Users
 exit
interface GigabitEthernet1/0/1
 description Old desk
 switchport
 switchport mode access
 switchport access vlan 10
 storm-control broadcast level 1.00
 no shutdown
 exit
ip dhcp excluded-address 10.10.10.1
ip dhcp pool VLAN10
 network 10.10.10.0 255.255.255.0
 default-router 10.10.10.1
 dns-server 1.1.1.1
 lease 1
 exit
ip route 0.0.0.0 0.0.0.0 192.0.2.1
end
`;
const ciscoDesired=`configure terminal
hostname EDGE-1
vlan 10
 name Users
 exit
vlan 20
 name Voice
 exit
interface GigabitEthernet1/0/1
 description New desk
 switchport
 switchport mode access
 switchport access vlan 20
 storm-control broadcast level 1.00
 no shutdown
 exit
ip dhcp excluded-address 10.10.10.1
ip dhcp excluded-address 10.10.10.10 10.10.10.20
ip dhcp pool VLAN10
 network 10.10.10.0 255.255.255.0
 default-router 10.10.10.1
 dns-server 8.8.8.8
 lease 1
 exit
ip route 0.0.0.0 0.0.0.0 192.0.2.254
end
write memory
`;
const cisco=project('cisco_ios',{projName:'Cisco seguro',observedState:{deviceConfigs:{r1:{vendor:'cisco_ios',capturedAt:'2026-09-16T10:00:00Z',content:ciscoObserved}}}});
const ciscoPlan=build(cisco,ciscoDesired);
assert.strictEqual(ciscoPlan.ok,true);
assert.strictEqual(ciscoPlan.devices[0].status,'candidate-ready');
assert.strictEqual(ciscoPlan.devices[0].adapterId,'cisco-ios.managed-delta');
assert.ok(ciscoPlan.artifacts.every(file=>file.path.endsWith('.cfg')));
const ciscoApply=ciscoPlan.artifacts.find(file=>file.path.includes('/commands/')).content;
const ciscoRollback=ciscoPlan.artifacts.find(file=>file.path.includes('/rollback/')).content;
assert.match(ciscoApply,/^configure terminal$/m);
assert.match(ciscoApply,/^vlan 20$/m);
assert.match(ciscoApply,/^ switchport access vlan 20$/m);
assert.match(ciscoApply,/^ dns-server 8\.8\.8\.8$/m);
assert.match(ciscoApply,/^no ip route 0\.0\.0\.0 0\.0\.0\.0 192\.0\.2\.1$/m);
assert.match(ciscoApply,/^ip route 0\.0\.0\.0 0\.0\.0\.0 192\.0\.2\.254$/m);
assert.match(ciscoApply,/^ip dhcp excluded-address 10\.10\.10\.10 10\.10\.10\.20$/m);
assert.ok(!/^write memory$/m.test(ciscoApply));
assert.match(ciscoRollback,/^no vlan 20$/m);
assert.match(ciscoRollback,/^ switchport access vlan 10$/m);
assert.match(ciscoRollback,/^ dns-server 1\.1\.1\.1$/m);
assert.match(ciscoRollback,/^no ip dhcp excluded-address 10\.10\.10\.10 10\.10\.10\.20$/m);
assert.match(ciscoRollback,/^ip route 0\.0\.0\.0 0\.0\.0\.0 192\.0\.2\.1$/m);

const unsupportedCisco=build(cisco,ciscoDesired.replace('hostname EDGE-1','hostname EDGE-CHANGED'));
assert.strictEqual(unsupportedCisco.devices[0].status,'manual-review');
assert.ok(unsupportedCisco.issues.some(item=>item.code==='NW-INCREMENTAL-003'));
const changedUnknown=build(cisco,ciscoDesired.replace('storm-control broadcast level 1.00','storm-control broadcast level 2.00'));
assert.strictEqual(changedUnknown.devices[0].status,'manual-review');
const placeholderCisco=build(cisco,ciscoDesired.replace('description New desk','description ${SECRET:desk}'));
assert.strictEqual(placeholderCisco.devices[0].status,'manual-review');
const invalidVlanCisco=build(cisco,ciscoDesired.replace('switchport access vlan 20','switchport access vlan 5000'));
assert.strictEqual(invalidVlanCisco.devices[0].status,'manual-review');
const invalidMaskCisco=build(cisco,ciscoDesired.replace('network 10.10.10.0 255.255.255.0','network 10.10.10.0 255.0.255.0'));
assert.strictEqual(invalidMaskCisco.devices[0].status,'manual-review');
const reopenedCisco=ciscoDesired.replace('end\nwrite memory','interface GigabitEthernet1/0/1\n switchport access vlan 20\n exit\nend\nwrite memory');
assert.strictEqual(build(cisco,reopenedCisco).devices[0].status,'candidate-ready');
const conflictingReopen=reopenedCisco.replace(/(interface GigabitEthernet1\/0\/1\n switchport access vlan )20\n exit\nend/, '$130\n exit\nend');
assert.strictEqual(build(cisco,conflictingReopen).devices[0].status,'manual-review');

const sampleProject=JSON.parse(JSON.stringify(require('../samples/small-office.json').project));
const sampleSwitch=sampleProject.devices.find(device=>device.vendorOs==='cisco_ios'&&(device.kind==='switch'||device.type==='switch'));
const sampleDesired=Switching.render(sampleProject,sampleSwitch.id,'cisco_ios');
const sampleObserved=sampleDesired.replace(/^(\s*switchport access vlan )\d+$/m,(_line,prefix)=>`${prefix}999`);
const sampleCandidate=Incremental.ciscoIosAdapter({deviceName:sampleSwitch.name,observedConfig:sampleObserved,desiredConfig:sampleDesired});
assert.strictEqual(sampleCandidate.ready,true);
assert.strictEqual(sampleCandidate.noChange,false);
assert.match(sampleCandidate.applyContent,/^interface Gi0\/1$/m);
assert.match(sampleCandidate.applyContent,/^ switchport access vlan 10$/m);
assert.match(sampleCandidate.rollbackContent,/^ switchport access vlan 999$/m);

const logicalInterface=Incremental.ciscoIosAdapter({deviceName:'Edge',observedConfig:'hostname EDGE\n',desiredConfig:'hostname EDGE\ninterface GigabitEthernet0/1.10\n encapsulation dot1Q 10\n ip address 10.10.10.1 255.255.255.0\n no shutdown\n exit\n'});
assert.strictEqual(logicalInterface.ready,true);
assert.match(logicalInterface.applyContent,/^interface GigabitEthernet0\/1\.10$/m);
assert.match(logicalInterface.rollbackContent,/^no interface GigabitEthernet0\/1\.10$/m);
const absentPhysical=Incremental.ciscoIosAdapter({deviceName:'Edge',observedConfig:'hostname EDGE\n',desiredConfig:'hostname EDGE\ninterface GigabitEthernet0/2\n description New uplink\n no shutdown\n exit\n'});
assert.strictEqual(absentPhysical.ready,false);
assert.match(absentPhysical.reason,/interfaz física/i);

const unsupported=build(project('fortinet'),'config system interface\nend\n');
assert.strictEqual(unsupported.ok,true);
assert.strictEqual(unsupported.devices[0].status,'manual-review');
assert.ok(unsupported.issues.some(item=>item.code==='NW-INCREMENTAL-002'));

const strictUnsupported=project('fortinet',{deployment:{changeMode:'incremental',requireExecutableIncremental:true}});
assert.strictEqual(build(strictUnsupported,'config system interface\nend\n').ok,false);

const missingInput=Incremental.buildPlan(project(),{generatedAt:'2026-09-16T12:00:00Z',changeSet:changeSet(),desiredConfigs:{}});
assert.strictEqual(missingInput.ok,false);
assert.ok(missingInput.issues.some(item=>item.code==='NW-INCREMENTAL-005'&&item.blocking));

const registry=Incremental.createRegistry();
registry.register({id:'test',vendors:['test_os'],generate(){return{ready:true,noChange:true};}});
assert.strictEqual(registry.resolve('test_os').id,'test');
assert.throws(()=>registry.register({id:'test',vendors:['other'],generate(){}}),/duplicado/i);

console.log('✓ Registro incremental genera candidatos Junos/Cisco IOS reversibles y deriva lo ambiguo a revisión manual');
