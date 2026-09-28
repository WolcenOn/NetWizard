#!/usr/bin/env node
'use strict';

const fs=require('fs');

const PRIVATE_ROUTING_BROWSER_MODULES=[
  'js/netwizard-routing-plan.js',
  'js/netwizard-cisco-routing-generator.js',
  'js/netwizard-multivendor-routing-generator.js',
  'js/netwizard-cisco-routing-integration.js',
  'js/netwizard-multivendor-routing-integration.js'
];

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

function main(argv){
  const input=argv[2],output=argv[3]||input;
  if(!input)throw new Error('usage: prepare-production-index.js <input> [output]');
  fs.writeFileSync(output,stripPrivateRoutingScripts(fs.readFileSync(input,'utf8')));
}

if(require.main===module)main(process.argv);
module.exports={PRIVATE_ROUTING_BROWSER_MODULES,stripPrivateRoutingScripts};
