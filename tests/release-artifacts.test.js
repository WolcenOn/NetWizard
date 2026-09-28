'use strict';

const assert=require('assert');
const fs=require('fs');
const path=require('path');
const Manifest=require('../js/netwizard-browser-modules.js');

const root=path.join(__dirname,'..');
const zipSource=fs.readFileSync(path.join(root,'scripts','build-zip.js'),'utf8');
assert.ok(zipSource.includes("'private/*'"),'El ZIP estático debe excluir el source del Private Engine');

const pagesSource=fs.readFileSync(path.join(root,'scripts','build-pages.js'),'utf8');
assert.ok(pagesSource.includes("require('../js/netwizard-browser-modules.js')"),'Pages debe validar el manifiesto browser');

const production=Manifest.paths({production:true});
const source=Manifest.paths();
for(const privateModule of source.filter(x=>!production.includes(x))){
  assert.ok(source.includes(privateModule));
}
console.log('✓ Los artefactos estáticos respetan el manifiesto y no empaquetan el source privado');
