#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const i18nDir = path.join(root, 'i18n');
const manifestPath = path.join(i18nDir, 'locales.json');
const code = String(process.argv[2]||'').trim();
const label = String(process.argv[3]||code).trim();
const sourceLocale = String(process.argv[4]||'en').trim();

if(!code){
  console.error('Uso: node scripts/i18n-new-locale.js <locale> [Nombre visible] [idioma-origen]');
  console.error('Ejemplo: npm run i18n:new -- pt-BR "Português (Brasil)" en');
  process.exit(1);
}
function readJson(file){ return JSON.parse(fs.readFileSync(file, 'utf8')); }
function writeJson(file, data){ fs.writeFileSync(file, JSON.stringify(data, null, 2)+'\n', 'utf8'); }
const sourcePath = path.join(i18nDir, `${sourceLocale}.json`);
if(!fs.existsSync(sourcePath)) throw new Error(`No existe idioma origen ${sourceLocale}.`);
const targetPath = path.join(i18nDir, `${code}.json`);
if(fs.existsSync(targetPath)) throw new Error(`${path.relative(root,targetPath)} ya existe.`);
const source = readJson(sourcePath);
const target = {};
Object.keys(source).sort().forEach(k => { target[k] = source[k]; });
target[`locale.${code}`] = label;
writeJson(targetPath, target);
let manifest = readJson(manifestPath);
if(!manifest.some(x => x.code === code)){
  manifest.push({code, label, nativeName:label, rtl:false});
  writeJson(manifestPath, manifest);
}
console.log(`Creado ${path.relative(root,targetPath)} desde ${sourceLocale}.`);
console.log('Traduce sus valores, ejecuta npm run i18n:check y después npm run i18n:sync.');
