#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const output = path.join(root, 'dist', 'pages');
const files = ['index.html'];
const directories = ['css', 'js', 'i18n'];

fs.rmSync(output, {recursive:true, force:true});
fs.mkdirSync(output, {recursive:true});

for(const file of files) fs.copyFileSync(path.join(root, file), path.join(output, file));
for(const directory of directories){
  fs.cpSync(path.join(root, directory), path.join(output, directory), {recursive:true});
}
fs.writeFileSync(path.join(output, '.nojekyll'), '');

const html = fs.readFileSync(path.join(output, 'index.html'), 'utf8');
const localAssets = Array.from(html.matchAll(/(?:src|href)=["']\.\/([^"']+)["']/g), match => match[1]);
const missing = localAssets.filter(asset => !fs.existsSync(path.join(output, asset)));
if(missing.length) throw new Error(`El artefacto Pages omite assets: ${missing.join(', ')}`);

console.log(`GitHub Pages artifact: ${output}`);
