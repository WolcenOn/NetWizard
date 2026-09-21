'use strict';
const assert=require('assert');
const fs=require('fs');
const path=require('path');

const root=path.resolve(__dirname,'..');
const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
const js=fs.readFileSync(path.join(root,'js','netwizard.js'),'utf8');

assert.ok(html.includes('id="impJsonFile"'),'Debe existir botón para cargar archivo JSON.');
assert.ok(html.includes('id="jsonFileInput"'),'Debe existir input file oculto.');
assert.ok(html.includes('accept=".json,application/json"'),'El selector debe limitarse a JSON.');
assert.ok(html.includes('id="jsonImportStatus"'),'Debe existir feedback del importador.');
assert.ok(js.includes('function prepareJsonImportText(text)'),'Debe reutilizarse una función común de validación.');
assert.ok(js.includes("NWSchema.prepareImport(raw,{defaults:defS})"),'La carga de archivo debe pasar por el schema.');
assert.ok(js.includes("reader.readAsText(file,'utf-8')"),'El archivo debe leerse como texto UTF-8.');
assert.ok(js.includes("applyJsonImportText(text,'json-import-file')"),'La carga de archivo debe usar la misma ruta de importación.');
assert.ok(js.includes("file.size>10*1024*1024"),'Debe existir un límite defensivo de tamaño.');

console.log('✓ Importador JSON permite archivo directo y reutiliza validación de schema');
