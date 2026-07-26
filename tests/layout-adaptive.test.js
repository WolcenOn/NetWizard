'use strict';
const assert=require('assert');
const fs=require('fs');
const path=require('path');

const css=fs.readFileSync(path.join(__dirname,'../css/netwizard-layout.css'),'utf8');
const rackUi=fs.readFileSync(path.join(__dirname,'../js/netwizard-rack-ui.js'),'utf8');

assert.ok(css.includes('.g2 > :only-child'),'Una sección única en g2 debe ocupar toda la fila.');
assert.ok(css.includes(':last-child:nth-child(odd)'),'La última tarjeta impar debe poder expandirse.');
assert.ok(css.includes('.nw-card-grid'),'Debe existir una rejilla adaptativa para tarjetas.');
assert.ok(css.includes('min-width: 0'),'Las tarjetas no deben forzar columnas vacías por desbordamiento.');
assert.ok(rackUi.includes('nw-grid-adaptive'),'La vista de rack debe usar la rejilla adaptativa.');
assert.ok(rackUi.includes('nw-card-grid'),'Los racks deben distribuirse en tarjetas fluidas.');
assert.ok(rackUi.includes("dataset.layoutSection='full'"),'El montaje dinámico debe marcarse como sección completa.');
assert.ok(!rackUi.includes('x.label||x.type}`'),'La lista de materiales debe conservar descripciones humanas.');

console.log('✓ Layout adaptativo evita huecos en paneles mixtos y racks');
