'use strict';

const assert=require('assert');
const fs=require('fs');
const path=require('path');
const Manifest=require('../js/netwizard-browser-modules.js');

const root=path.join(__dirname,'..');
const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
const scripts=Array.from(
  html.matchAll(/<script\s+[^>]*src=["']\.\/(js\/[^"']+)["'][^>]*><\/script>/g),
  match=>match[1]
);
const expected=Manifest.paths();

assert.deepStrictEqual(scripts,expected,'index.html debe seguir exactamente el orden del manifiesto de módulos');

const validation=Manifest.validate(Manifest.list(),{
  exists:modulePath=>fs.existsSync(path.join(root,modulePath))
});
assert.strictEqual(validation.ok,true,validation.errors.join('\n'));

const production=Manifest.paths({production:true});
assert.ok(production.length<expected.length,'El perfil de producción debe excluir módulos privados');
for(const p of production)assert.ok(expected.includes(p),`Producción referencia un módulo fuera del grafo source: ${p}`);

const productionEntries=Manifest.list().filter(item=>item.production!==false);
const productionValidation=Manifest.validate(productionEntries,{
  exists:modulePath=>fs.existsSync(path.join(root,modulePath))
});
assert.strictEqual(
  productionValidation.ok,
  true,
  'El grafo de producción no puede depender de módulos privados: '+productionValidation.errors.join('\n')
);

const duplicates=scripts.filter((script,index)=>scripts.indexOf(script)!==index);
assert.deepStrictEqual(duplicates,[],'El entrypoint no debe contener scripts duplicados');

const badMissingFile=Manifest.validate([{path:'js/not-real.js'}],{exists:()=>false});
assert.ok(badMissingFile.errors.some(x=>x.includes('module file missing')));

const badMissingDependency=Manifest.validate([{path:'a.js',dependsOn:['missing.js']}]);
assert.ok(badMissingDependency.errors.some(x=>x.includes('depends on missing module')));

const badCycle=Manifest.validate([
  {path:'a.js',dependsOn:['b.js']},
  {path:'b.js',dependsOn:['a.js']}
]);
assert.ok(badCycle.errors.some(x=>x.includes('dependency cycle')));

const badDuplicate=Manifest.validate([{path:'a.js'},{path:'a.js'}]);
assert.ok(badDuplicate.errors.some(x=>x.includes('duplicate module')));

const badOrder=Manifest.validate([
  {path:'b.js',dependsOn:['a.js']},
  {path:'a.js'}
]);
assert.ok(badOrder.errors.some(x=>x.includes('invalid order')));

assert.ok(!scripts.includes('js/netwizard-poe-utils.js'),'El loader PoE legacy no debe formar parte del entrypoint canónico');
assert.ok(scripts.includes('js/netwizard-poe-model.js'),'El entrypoint debe cargar el modelo PoE canónico');
assert.ok(scripts.includes('js/netwizard-poe-utils-v2.js'),'El entrypoint debe cargar PoE v2 directamente');

for(const required of [
  'js/netwizard-structured-cabling.js',
  'js/netwizard-rack-model.js',
  'js/netwizard-rack-ui.js',
  'js/netwizard-structured-cabling-ui.js',
  'js/netwizard-rack-production-integration.js',
  'js/netwizard-report-model.js',
  'js/netwizard-detailed-report-v3.js'
]){
  assert.ok(scripts.includes(required),`El entrypoint browser debe cargar ${required}`);
}

const architectureSource=fs.readFileSync(path.join(root,'js/netwizard-production-gate-architecture.js'),'utf8');
assert.ok(
  architectureSource.includes("['NetWizardArchitectureValidator','./js/netwizard-architecture-validator.js'"),
  'El fallback dinámico debe incluir ArchitectureValidator'
);
const connectivitySource=fs.readFileSync(path.join(root,'js/netwizard-connectivity-checker.js'),'utf8');
assert.ok(!connectivitySource.includes("createElement('script')"),'Connectivity Checker no debe alterar el grafo de scripts del entrypoint');

console.log('✓ Entrypoint, dependencias y perfiles browser siguen un único manifiesto declarativo');
