#!/usr/bin/env node
'use strict';

const fs=require('fs');
const path=require('path');
const Manifest=require('../js/netwizard-browser-modules.js');

const root=path.resolve(__dirname,'..');
const output=path.join(root,'dist','pages');
const files=['index.html'];
const directories=['css','js','i18n','samples'];

fs.rmSync(output,{recursive:true,force:true});
fs.mkdirSync(output,{recursive:true});

for(const file of files)fs.copyFileSync(path.join(root,file),path.join(output,file));
for(const directory of directories)fs.cpSync(path.join(root,directory),path.join(output,directory),{recursive:true});
fs.writeFileSync(path.join(output,'.nojekyll'),'');

const html=fs.readFileSync(path.join(output,'index.html'),'utf8');
const localAssets=Array.from(html.matchAll(/(?:src|href)=["']\.\/([^"']+)["']/g),match=>match[1]);
const missing=localAssets.filter(asset=>!fs.existsSync(path.join(output,asset)));
if(missing.length)throw new Error(`El artefacto Pages omite assets: ${missing.join(', ')}`);

const scripts=Array.from(
  html.matchAll(/<script\s+[^>]*src=["']\.\/(js\/[^"']+)["'][^>]*><\/script>/g),
  match=>match[1]
);
const expected=Manifest.paths();
if(JSON.stringify(scripts)!==JSON.stringify(expected)){
  throw new Error('El artefacto Pages no coincide con el manifiesto browser.');
}
const missingModules=expected.filter(modulePath=>!fs.existsSync(path.join(output,modulePath)));
if(missingModules.length)throw new Error(`Pages omite módulos browser: ${missingModules.join(', ')}`);

console.log(`GitHub Pages artifact: ${output} · ${expected.length} módulos browser`);
