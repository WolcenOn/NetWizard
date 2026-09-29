'use strict';

const assert=require('assert');
const fs=require('fs');
const path=require('path');

const ui=fs.readFileSync(path.join(__dirname,'..','js','netwizard-physical-inventory-ui.js'),'utf8');
const app=fs.readFileSync(path.join(__dirname,'..','js','netwizard.js'),'utf8');

assert.ok(ui.includes('Capacidad y configuración'),'advanced port UI must separate desired/configuration data');
assert.ok(ui.includes('Observado / As-Built'),'advanced port UI must separate observed inventory data');
assert.ok(ui.includes('Estado administrativo (To-Be)'),'admin state must be presented as intent');
assert.ok(ui.includes('Estado operativo observado'),'oper state must be presented as observed');
assert.ok(ui.includes('no son órdenes de configuración'),'observed values must not look like desired commands');

for(const key of ['speedMaxMbps','mtu','transceiver','connector','adminState','negotiatedSpeedMbps','utilizationPercent','operState']){
  assert.ok(app.includes(key),`advanced field ${key} must be wired to the port editor`);
}
assert.ok(app.includes('loadAdvancedPortFields(p);'),'editing an existing port must load advanced values');
assert.ok(app.includes('applyAdvancedPortFields(p);'),'editing a port must persist advanced values');
assert.ok(app.includes('applyAdvancedPortFields(port);S.ports.push(port);'),'creating a port must persist advanced values');
assert.ok(app.includes("if($(id))fields[key]=optionalPortNumber(id);"),'missing advanced UI must not erase existing numeric values');
assert.ok(app.includes("if($(id))fields[key]=optionalPortText(id);"),'missing advanced UI must not erase existing text values');

console.log('✓ Los puertos separan y persisten configuración To-Be y datos observados');
