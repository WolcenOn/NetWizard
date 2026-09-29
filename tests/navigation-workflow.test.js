'use strict';

const assert=require('assert');
const fs=require('fs');
const path=require('path');

const root=path.resolve(__dirname,'..');
const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
const main=fs.readFileSync(path.join(root,'js/netwizard.js'),'utf8');
const golden=fs.readFileSync(path.join(root,'js/netwizard-inventory-golden-path-ui.js'),'utf8');

assert.ok(main.includes("const DESIGN_STEP_ORDER=['dash','wiz','loc','dev','physical'"));
assert.ok(main.includes("const INVENTORY_STEP_ORDER=['dash','loc','dev','physical'"));
assert.ok(main.includes("return S.workflow?.mode==='inventory'?INVENTORY_STEP_ORDER:DESIGN_STEP_ORDER;"));
assert.ok(main.includes("if(S.workflow?.mode==='inventory'&&step==='wiz')return'loc';"));

const devIndex=html.indexOf('data-step="dev"');
const physicalIndex=html.indexOf('data-step="physical"');
assert.ok(devIndex>=0&&physicalIndex>=0&&devIndex<physicalIndex,'Dispositivos debe preceder a Inventario físico en la navegación lateral');
assert.ok(html.includes('Asistente de diseño'));
assert.ok(html.includes('No se usa como recorrido de inventario As-Built'));

assert.ok(golden.includes("stepCard(2,'Racks contenedores'"));
assert.ok(golden.includes("stepCard(3,'Equipos'"));
assert.ok(golden.includes("stepCard(4,'Colocación y alimentación'"));
assert.ok(golden.indexOf("stepCard(2,'Racks contenedores'")<golden.indexOf("stepCard(3,'Equipos'"));
assert.ok(golden.indexOf("stepCard(3,'Equipos'")<golden.indexOf("stepCard(4,'Colocación y alimentación'"));
assert.ok(golden.includes('s.placedDevices>0'));

const counterDefs=(main.match(/function projectCounters\(/g)||[]).length;
assert.strictEqual(counterDefs,1,'Debe existir una única función de resumen para contadores');
const navStart=main.indexOf('function renderNav()');
const dashStart=main.indexOf('function renderDash()');
assert.ok(navStart>=0&&dashStart>navStart);
const navSource=main.slice(navStart,dashStart);
const dashEnd=main.indexOf('// ─────────────────── WIZARD',dashStart);
const dashSource=main.slice(dashStart,dashEnd);
assert.ok(navSource.includes('const counts=projectCounters(S)'));
assert.ok(dashSource.includes('const counts=projectCounters(S)'));

console.log('✓ Navegación, Golden Path y contadores comparten un flujo coherente por modo');
