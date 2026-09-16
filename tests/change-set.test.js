'use strict';

const assert=require('assert');
const ChangeSet=require('../js/netwizard-change-set.js');

const generatedAt='2026-09-16T12:00:00.000Z';
const desired='hostname SW1\ninterface Gi0/1\n description Usuarios\n switchport access vlan 10\n';
function project(content,extra){return Object.assign({
  projName:'Cambio controlado',
  devices:[{id:'sw1',name:'SW1',vendorOs:'cisco_ios'}],
  deployment:{changeMode:'incremental',maxObservedAgeHours:24},
  observedState:{observedAt:'2026-09-16T10:00:00.000Z',deviceConfigs:{sw1:{vendor:'cisco_ios',capturedAt:'2026-09-16T10:00:00.000Z',source:'manual',content}}}
},extra||{});}
function build(value){return ChangeSet.buildChangeSet(value,{generatedAt,desiredConfigs:{sw1:desired},configPaths:{sw1:'configs/sw1.cfg'}});}

const unchanged=build(project(desired));
assert.strictEqual(unchanged.ok,true);
assert.strictEqual(unchanged.requestedMode,'incremental');
assert.strictEqual(unchanged.coverage.observed,1);
assert.strictEqual(unchanged.coverage.noChange,1);
assert.strictEqual(unchanged.devices[0].status,'no-change');
assert.strictEqual(unchanged.artifacts.length,0);

const previous='hostname SW1\ninterface Gi0/1\n description Invitados\n switchport access vlan 20\n';
const changed=build(project(previous));
assert.strictEqual(changed.ok,true);
assert.strictEqual(changed.coverage.changed,1);
assert.strictEqual(changed.devices[0].status,'change-required');
assert.strictEqual(changed.devices[0].stats.addedLines,2);
assert.strictEqual(changed.devices[0].stats.removedLines,2);
assert.strictEqual(changed.artifacts.length,2);
assert.match(changed.artifacts[0].content,/^- description Invitados$/m);
assert.match(changed.artifacts[0].content,/^\+ description Usuarios$/m);
assert.match(changed.artifacts[1].content,/^- description Usuarios$/m);
assert.match(ChangeSet.buildSummaryMarkdown(changed),/no son comandos|no son comandos/i);
assert.match(ChangeSet.buildPostChangeChecklist(changed,{postchecks:['Validar DHCP.']}),/Validar DHCP/);
assert.ok(!Object.prototype.hasOwnProperty.call(ChangeSet.publicChangeSet(changed),'artifacts'));

const missing=build({projName:'Sin snapshot',devices:[{id:'sw1',name:'SW1',vendorOs:'cisco_ios'}],deployment:{changeMode:'incremental'}});
assert.strictEqual(missing.ok,false);
assert.ok(missing.issues.some(item=>item.code==='NW-CHANGE-001'&&item.blocking));

const full=build({projName:'Baseline',devices:[{id:'sw1',name:'SW1',vendorOs:'cisco_ios'}],deployment:{changeMode:'full'}});
assert.strictEqual(full.ok,true);
assert.strictEqual(full.devices[0].status,'baseline-required');
assert.ok(full.issues.some(item=>item.code==='NW-CHANGE-001'&&!item.blocking));

const stale=build(project(previous,{deployment:{changeMode:'incremental',maxObservedAgeHours:1}}));
assert.strictEqual(stale.ok,false);
assert.ok(stale.issues.some(item=>item.code==='NW-CHANGE-003'));

const wrongVendor=project(previous);
wrongVendor.observedState.deviceConfigs.sw1.vendor='juniper_junos';
assert.ok(build(wrongVendor).issues.some(item=>item.code==='NW-CHANGE-004'&&item.blocking));

const missingVendor=project(previous);
delete missingVendor.observedState.deviceConfigs.sw1.vendor;
assert.ok(build(missingVendor).issues.some(item=>item.code==='NW-CHANGE-010'&&item.blocking));

const invalidDate=project(previous);
invalidDate.observedState.deviceConfigs.sw1.capturedAt='fecha-invalida';
assert.ok(build(invalidDate).issues.some(item=>item.code==='NW-CHANGE-007'&&item.blocking));

const futureDate=project(previous);
futureDate.observedState.deviceConfigs.sw1.capturedAt='2026-09-17T12:00:00.000Z';
assert.ok(build(futureDate).issues.some(item=>item.code==='NW-CHANGE-009'&&item.blocking));

const invalidAge=project(previous,{deployment:{changeMode:'incremental',maxObservedAgeHours:'invalid'}});
assert.ok(build(invalidAge).issues.some(item=>item.code==='NW-CHANGE-011'&&item.blocking));

const invalidMode=project(previous,{deployment:{changeMode:'incremental-change',maxObservedAgeHours:24}});
assert.strictEqual(build(invalidMode).executionMode,'invalid');
assert.ok(build(invalidMode).issues.some(item=>item.code==='NW-CHANGE-012'&&item.blocking));

const truncated=project(previous);
truncated.observedState.deviceConfigs.sw1.contentTruncated=true;
assert.ok(build(truncated).issues.some(item=>item.code==='NW-CHANGE-005'&&item.blocking));

const truncatedSet=project(previous);
truncatedSet.observedState.deviceConfigsTruncated=true;
assert.ok(build(truncatedSet).issues.some(item=>item.code==='NW-CHANGE-006'&&item.blocking));

assert.strictEqual(ChangeSet.fingerprint('a\r\n'),'fnv1a32:e40c292c');
console.log('✓ Change Set compara snapshots, genera diffs reversibles y bloquea evidencia no fiable');
