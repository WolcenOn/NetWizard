#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const {spawnSync} = require('child_process');

const root = path.resolve(__dirname, '..');
const sourceRoots = ['js', 'scripts', 'tests'];

function javascriptFiles(directory){
  const entries = fs.readdirSync(directory, {withFileTypes:true});
  return entries.flatMap(entry => {
    const target = path.join(directory, entry.name);
    if(entry.isDirectory()) return javascriptFiles(target);
    return entry.isFile() && entry.name.endsWith('.js') ? [target] : [];
  });
}

const files = sourceRoots.flatMap(directory => javascriptFiles(path.join(root, directory))).sort();
for(const file of files){
  const result = spawnSync(process.execPath, ['--check', file], {stdio:'inherit'});
  if(result.status !== 0) process.exit(result.status || 1);
}

console.log(`Syntax check: OK · ${files.length} archivos`);
