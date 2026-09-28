#!/usr/bin/env node
'use strict';

const fs=require('fs');
const path=require('path');
const Manifest=require('../js/netwizard-browser-modules.js');

const sourcePaths=Manifest.paths();
const productionPaths=new Set(Manifest.paths({production:true}));
const PRIVATE_ROUTING_BROWSER_MODULES=sourcePaths.filter(modulePath=>!productionPaths.has(modulePath));

function stripPrivateRoutingScripts(html){
  let out=String(html||'');
  for(const asset of PRIVATE_ROUTING_BROWSER_MODULES){
    const single='<script src="./'+asset+'"></script>';
    const double='<script src=\'./'+asset+'\'></script>';
    out=out.split(single).join('');
    out=out.split(double).join('');
  }
  return out;
}

function applyProductionBoundary(indexPath,publicDir){
  const html=stripPrivateRoutingScripts(fs.readFileSync(indexPath,'utf8'));
  fs.writeFileSync(indexPath,html);
  if(publicDir){
    for(const asset of PRIVATE_ROUTING_BROWSER_MODULES){
      const target=path.join(publicDir,asset);
      if(fs.existsSync(target))fs.unlinkSync(target);
      if(fs.existsSync(target))throw new Error('Private browser module still published: '+asset);
    }
  }
  return {removed:PRIVATE_ROUTING_BROWSER_MODULES.slice()};
}

function main(argv){
  const indexPath=argv[2],publicDir=argv[3]||'';
  if(!indexPath)throw new Error('usage: prepare-production-index.js <index.html> [public-dir]');
  applyProductionBoundary(indexPath,publicDir);
}

if(require.main===module)main(process.argv);
module.exports={PRIVATE_ROUTING_BROWSER_MODULES,stripPrivateRoutingScripts,applyProductionBoundary};
