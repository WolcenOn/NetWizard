'use strict';

const assert=require('assert');
const Ui=require('../js/netwizard-custom-device-model-ui.js');

const parsed=Ui.parsePortGroups(
  'Gi1/0/{n}|48|copper|1000|10,100,1000|yes\n'+
  'SFP+{n}|4|sfp+|10000|1000,10000|no'
);
assert.strictEqual(parsed.length,2);
assert.deepStrictEqual(parsed[0],{
  id:'group_1',
  namePattern:'Gi1/0/{n}',
  count:48,
  startIndex:1,
  media:'copper',
  speedMaxMbps:1000,
  supportedSpeedsMbps:[10,100,1000],
  poeCapable:true
});
assert.strictEqual(parsed[1].count,4);
assert.strictEqual(parsed[1].poeCapable,false);

const serialized=Ui.serializePortGroups(parsed);
const roundtrip=Ui.parsePortGroups(serialized);
assert.strictEqual(roundtrip.length,2);
assert.strictEqual(roundtrip[0].namePattern,'Gi1/0/{n}');
assert.strictEqual(roundtrip[1].speedMaxMbps,10000);

const malformed=Ui.parsePortGroups('sin-separadores\nport{n}|0|copper|1000|1000|yes');
assert.deepStrictEqual(malformed,[]);

console.log('✓ Editor de modelos personalizados parsea y serializa grupos de puertos de forma determinista');
