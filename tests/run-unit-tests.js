#!/usr/bin/env node
'use strict';

const fs=require('fs');
const path=require('path');
const {spawnSync}=require('child_process');

const testsDir=__dirname;
const discovered=fs.readdirSync(testsDir,{withFileTypes:true})
  .filter(entry=>entry.isFile()&&entry.name.endsWith('.test.js'))
  .map(entry=>entry.name)
  .sort((a,b)=>a.localeCompare(b,'en'));

const files=['run-tests.js',...discovered];
if(!files.length){
  console.error('No se encontraron tests unitarios.');
  process.exit(1);
}

console.log(`NetWizard unit tests: ${files.length} archivos\n`);
for(let i=0;i<files.length;i++){
  const file=files[i];
  console.log(`[${i+1}/${files.length}] ${file}`);
  const result=spawnSync(process.execPath,[path.join(testsDir,file)],{stdio:'inherit'});
  if(result.error){
    console.error(`No se pudo ejecutar ${file}: ${result.error.message}`);
    process.exit(1);
  }
  if(result.status!==0){
    console.error(`✗ ${file} falló con código ${result.status}`);
    process.exit(result.status||1);
  }
}
console.log(`\n✓ ${files.length} archivos de tests unitarios completados`);
