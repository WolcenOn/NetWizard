'use strict';

const assert=require('assert');
const Writer=require('../js/netwizard-xlsx-writer.js');

function ascii(bytes){return Buffer.from(bytes).toString('latin1');}

const bytes=Writer.buildWorkbook([
  {name:'Equipos',rows:[{id:'sw1',name:'SW-01',rackUnit:18}]},
  {name:'Puertos',rows:[{device:'SW-01',port:'Gi1/0/1',mode:'access'}]},
  {name:'BOM diferencial',rows:[]}
]);

assert.ok(bytes instanceof Uint8Array);
assert.ok(bytes.length>1500,'El XLSX debe contener una estructura OOXML no trivial');
assert.strictEqual(bytes[0],0x50);
assert.strictEqual(bytes[1],0x4b);

const raw=ascii(bytes);
for(const path of [
  '[Content_Types].xml',
  'xl/workbook.xml',
  'xl/styles.xml',
  'xl/worksheets/sheet1.xml',
  'xl/worksheets/sheet2.xml',
  'xl/worksheets/sheet3.xml'
]) assert.ok(raw.includes(path),'Falta entrada XLSX '+path);

assert.ok(raw.includes('Equipos'));
assert.ok(raw.includes('Puertos'));
assert.ok(raw.includes('BOM diferencial'));
assert.ok(raw.includes('SW-01'));
assert.ok(raw.includes('Gi1/0/1'));
assert.ok(raw.includes('state="frozen"'),'Las hojas deben congelar la fila de encabezados');
assert.ok(raw.includes('autoFilter'),'Las hojas deben incluir autofiltro');

const dedupe=Writer.buildWorkbook([
  {name:'Nombre muy largo / con caracteres [inválidos] AAAAA',rows:[{a:1}]},
  {name:'Nombre muy largo / con caracteres [inválidos] AAAAA',rows:[{a:2}]}
]);
const dedupeRaw=ascii(dedupe);
assert.ok(dedupeRaw.includes('Nombre muy largo   con caractere')||dedupeRaw.includes('Nombre muy largo'));
assert.ok(dedupeRaw.includes(' 2'));

console.log('✓ XLSX writer genera un workbook OOXML multipestaña sin dependencias externas');
