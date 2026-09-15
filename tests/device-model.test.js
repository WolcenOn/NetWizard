'use strict';

const assert = require('assert');
const model = require('../js/netwizard-device-model.js');

assert.deepStrictEqual(model.kinds, ['switch','router','firewall','access_point','wlan_controller','server','appliance']);
assert.strictEqual(model.normalizeKind({type:'switch'}), 'switch');
assert.strictEqual(model.normalizeKind({type:'switch', wifiRole:'ap'}), 'access_point');
assert.strictEqual(model.normalizeKind({kind:'switch',type:'switch', wifiRole:'ap'}), 'access_point');
assert.strictEqual(model.normalizeKind({type:'AP'}), 'access_point');
assert.strictEqual(model.normalizeKind({type:'wireless controller'}), 'wlan_controller');
assert.strictEqual(model.normalizeKind({type:'servidor'}), 'server');
assert.strictEqual(model.isSwitching({kind:'access_point',type:'switch'}), false);
assert.strictEqual(model.isEdgeCapable({kind:'firewall'}), true);
assert.strictEqual(model.isEdgeCapable({kind:'server'}), false);

const source={id:'ap1',type:'switch',wifiRole:'ap',internetEdge:'yes',wanIf:'eth1'};
const normalized=model.normalizeDevice(source);
assert.notStrictEqual(normalized, source);
assert.strictEqual(normalized.kind, 'access_point');
assert.strictEqual(normalized.type, 'access_point');
assert.strictEqual(normalized.internetEdge, 'no');
assert.strictEqual(normalized.wanIf, null);
assert.strictEqual(source.type, 'switch');

const vendorIds=model.vendors().map(item=>item.id);
assert.strictEqual(new Set(vendorIds).size, vendorIds.length);
assert.ok(vendorIds.includes('generic_network'));
assert.ok(vendorIds.includes('windows'));
assert.ok(vendorIds.includes('linux'));
assert.strictEqual(model.normalizeVendor('fortigate'), 'fortinet');
assert.strictEqual(model.normalizeVendor('JUNOS'), 'juniper_junos');
assert.strictEqual(model.normalizeVendor('unifi'), 'ubiquiti_unifi');
assert.strictEqual(model.normalizeVendor('unknown-os'), 'unknown-os');
assert.strictEqual(model.normalizeDevice({type:'firewall',vendorOs:'fortigate'}).vendorOs, 'fortinet');
assert.strictEqual(model.normalizeDevice({type:'appliance',vendorOs:'future_network_os'}).vendorOs, 'future_network_os');
assert.strictEqual(model.hasVendor('fortios'), true);

console.log('✓ Modelo 3.50 centraliza kinds, compatibilidad legacy y vendors');
