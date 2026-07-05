#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const i18nDir = path.join(root, 'i18n');
const manifestPath = path.join(i18nDir, 'locales.json');
const baseLocale = process.env.I18N_BASE || 'es';

function readJson(file){ return JSON.parse(fs.readFileSync(file, 'utf8')); }
function placeholders(value){
  const out = new Set();
  String(value).replace(/\{([A-Za-z0-9_.-]+)\}/g, (_, key) => { out.add(key); return ''; });
  return Array.from(out).sort();
}
function sameArray(a,b){ return a.length===b.length && a.every((x,i)=>x===b[i]); }
function dangerous(value){ return /<[^>]*>|on\w+\s*=|javascript:/i.test(String(value)); }

const manifest = readJson(manifestPath);
const codes = manifest.map(x => x.code).filter(Boolean);
if(!codes.includes(baseLocale)) throw new Error(`El idioma base ${baseLocale} no está en i18n/locales.json.`);
const base = readJson(path.join(i18nDir, `${baseLocale}.json`));
const baseKeys = Object.keys(base).sort();
let errors = [];

for(const code of codes){
  const file = path.join(i18nDir, `${code}.json`);
  if(!fs.existsSync(file)){ errors.push(`Falta ${path.relative(root,file)}.`); continue; }
  const dict = readJson(file);
  const keys = Object.keys(dict).sort();
  const missing = baseKeys.filter(k => !Object.prototype.hasOwnProperty.call(dict,k));
  const extra = keys.filter(k => !Object.prototype.hasOwnProperty.call(base,k));
  if(missing.length) errors.push(`${code}: faltan ${missing.length} claves: ${missing.slice(0,15).join(', ')}${missing.length>15?'...':''}`);
  if(extra.length) errors.push(`${code}: sobran ${extra.length} claves: ${extra.slice(0,15).join(', ')}${extra.length>15?'...':''}`);
  for(const key of keys){
    const value = dict[key];
    if(typeof value !== 'string') errors.push(`${code}.${key}: la traducción debe ser string.`);
    if(dangerous(value)) errors.push(`${code}.${key}: contiene HTML/JS potencialmente peligroso.`);
    if(Object.prototype.hasOwnProperty.call(base,key) && !sameArray(placeholders(base[key]), placeholders(value))){
      errors.push(`${code}.${key}: placeholders no coinciden. base={${placeholders(base[key]).join(',')}} ${code}={${placeholders(value).join(',')}}`);
    }
  }
}

if(errors.length){
  console.error('i18n-check: FALLÓ');
  errors.forEach(e => console.error(' - '+e));
  process.exit(1);
}
console.log(`i18n-check: OK · ${codes.length} idiomas · ${baseKeys.length} claves · base=${baseLocale}`);
