'use strict';

const assert=require('assert');
const fs=require('fs');
const path=require('path');

const ui=fs.readFileSync(path.join(__dirname,'..','js','netwizard-physical-inventory-ui.js'),'utf8');
const html=fs.readFileSync(path.join(__dirname,'..','index.html'),'utf8');

assert.ok(ui.includes("Inventario del equipo"),'device form must keep intrinsic inventory fields');
assert.ok(ui.includes('Número de serie'),'device form must keep serial number');
assert.ok(ui.includes('Presupuesto eléctrico (W)'),'device form must keep device power budget');
assert.ok(ui.includes('Consumo estimado (W)'),'device form must keep device power draw');

for(const forbidden of ['devRack','devRackUnit','devRackUnits']){
  assert.ok(!ui.includes(`field('${forbidden}'`),`${forbidden} must not be editable from Dispositivos`);
}

const patchMatch=ui.match(/function readDevicePatch\(\)\{return\{([^}]*)\};\}/);
assert.ok(patchMatch,'readDevicePatch must remain explicit');
for(const key of ['rack:','rackUnit:','rackUnits:']){
  assert.ok(!patchMatch[1].includes(key),`device patch must not overwrite ${key}`);
}

assert.ok(!html.includes('placeholder="Modelo, rack, ubicación…'),'device notes must not invite structured physical data');
assert.ok(ui.includes('se gestiona en Inventario físico'),'device form must direct rack placement to the authoritative UI');

console.log('✓ Dispositivos no compite con Inventario físico por la colocación en rack');
