'use strict';

const assert=require('assert');
const ChangeSet=require('../js/netwizard-change-set.js');
const Incremental=require('../js/netwizard-incremental-generators.js');
const Ui=require('../js/netwizard-observed-config-ui.js');

const capturedAt='2026-09-17T10:00:00.000Z';
const generatedAt='2026-09-17T11:00:00.000Z';
const observed=['hostname SW1','vlan 10',' name Usuarios',' exit','interface GigabitEthernet0/1',' switchport mode access',' switchport access vlan 999',' no shutdown',' exit'].join('\n');
const desired=observed.replace('switchport access vlan 999','switchport access vlan 10');

function project(vendor){return{_schemaVersion:'3.50.0',projName:'UI incremental',devices:[{id:'sw1',name:'SW1',kind:'switch',type:'switch',vendorOs:vendor||'cisco_ios'}],deployment:{changeMode:'full'},observedState:null};}

const saved=Ui.upsertSnapshot(project(),'sw1',{content:observed,source:'show running-config',capturedAt,maxObservedAgeHours:12,requireExecutableIncremental:true});
assert.strictEqual(saved.deployment.changeMode,'incremental');
assert.strictEqual(saved.deployment.maxObservedAgeHours,12);
assert.strictEqual(saved.deployment.requireExecutableIncremental,true);
assert.strictEqual(saved.observedState.deviceConfigs.sw1.vendor,'cisco_ios');
assert.strictEqual(saved.observedState.deviceConfigs.sw1.content,observed);
assert.strictEqual(saved.observedState.deviceConfigs.sw1.contentTruncated,false);
assert.strictEqual(project().observedState,null,'upsertSnapshot no debe mutar el proyecto original');

const preview=Ui.buildDevicePreview(saved,'sw1',{generatedAt,changeSet:ChangeSet,incremental:Incremental,generateConfig:()=>desired});
assert.strictEqual(preview.ok,true);
assert.strictEqual(preview.status,'candidate-ready');
assert.match(preview.candidate,/switchport access vlan 10/);
assert.match(preview.rollback,/switchport access vlan 999/);
assert.match(preview.applyFilename,/\.cfg$/);
assert.match(Ui.statusText(preview),/Candidato incremental seguro/);

const unchanged=Ui.buildDevicePreview(saved,'sw1',{generatedAt,changeSet:ChangeSet,incremental:Incremental,generateConfig:()=>observed});
assert.strictEqual(unchanged.ok,true);
assert.strictEqual(unchanged.status,'no-change');
assert.strictEqual(unchanged.candidate,'');

const missing=Ui.buildDevicePreview(project(),'sw1',{generatedAt,changeSet:ChangeSet,incremental:Incremental,generateConfig:()=>desired});
assert.strictEqual(missing.ok,false);
assert.strictEqual(missing.status,'blocked');
assert.ok(missing.issues.some(issue=>issue.code==='NW-CHANGE-001'));

const fortinet=Ui.upsertSnapshot(project('fortinet'),'sw1',{content:'config system global\n set hostname OLD\nend',capturedAt});
const manual=Ui.buildDevicePreview(fortinet,'sw1',{generatedAt,changeSet:ChangeSet,incremental:Incremental,generateConfig:()=> 'config system global\n set hostname NEW\nend'});
assert.strictEqual(manual.ok,true);
assert.strictEqual(manual.status,'candidate-ready');
assert.match(manual.candidate,/set hostname NEW/);
assert.match(manual.rollback,/set hostname OLD/);
assert.match(manual.applyFilename,/\.conf$/);

const removed=Ui.removeSnapshot(saved,'sw1');
assert.strictEqual(removed.observedState,null);
assert.throws(()=>Ui.upsertSnapshot(project(),'sw1',{content:'x'.repeat(Ui.MAX_CONFIG_CHARS+1),capturedAt}),/supera el límite/);

console.log('✓ La UI observada persiste capturas y previsualiza candidatos seguros por dispositivo');
