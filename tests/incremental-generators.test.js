'use strict';

const assert=require('assert');
const Incremental=require('../js/netwizard-incremental-generators.js');

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

const cisco=project('cisco_ios');
cisco.observedState.deviceConfigs.r1.content='hostname old-edge\n';
const unsupported=build(cisco,'hostname new-edge\n');
assert.strictEqual(unsupported.ok,true);
assert.strictEqual(unsupported.devices[0].status,'manual-review');
assert.ok(unsupported.issues.some(item=>item.code==='NW-INCREMENTAL-002'));

cisco.deployment.requireExecutableIncremental=true;
assert.strictEqual(build(cisco,'hostname new-edge\n').ok,false);

const missingInput=Incremental.buildPlan(project(),{generatedAt:'2026-09-16T12:00:00Z',changeSet:changeSet(),desiredConfigs:{}});
assert.strictEqual(missingInput.ok,false);
assert.ok(missingInput.issues.some(item=>item.code==='NW-INCREMENTAL-005'&&item.blocking));

const registry=Incremental.createRegistry();
registry.register({id:'test',vendors:['test_os'],generate(){return{ready:true,noChange:true};}});
assert.strictEqual(registry.resolve('test_os').id,'test');
assert.throws(()=>registry.register({id:'test',vendors:['other'],generate(){}}),/duplicado/i);

console.log('✓ Registro incremental genera candidatos Junos reversibles y deriva lo ambiguo a revisión manual');
