'use strict';

const assert=require('assert');
const fs=require('fs');
const path=require('path');

const root=path.resolve(__dirname,'..');
const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
const css=fs.readFileSync(path.join(root,'css','netwizard.css'),'utf8');
const adaptive=fs.readFileSync(path.join(root,'css','netwizard-layout.css'),'utf8');

function pageSection(id){
  const marker='<div class="pg" id="'+id+'">';
  const start=html.indexOf(marker);
  assert.ok(start>=0,'Página inexistente: '+id);
  const next=html.indexOf('\n<div class="pg" id="',start+marker.length);
  return html.slice(start,next>start?next:html.length);
}
function count(haystack,needle){
  return haystack.split(needle).length-1;
}

const expected={
  'pg-loc':1,
  'pg-dev':2,
  'pg-vlan':2,
  'pg-hosts':1,
  'pg-iot':1,
  'pg-links':1,
  'pg-fw':2,
  'pg-cfg':1
};
for(const [id,n] of Object.entries(expected)){
  assert.strictEqual(
    count(pageSection(id),'g2 nw-workspace-stack'),
    n,
    id+' debe usar flujo vertical en sus grids principales'
  );
}

assert.strictEqual(count(pageSection('pg-dash'),'nw-workspace-stack'),0,'Dashboard puede conservar tarjetas resumen en paralelo');
assert.strictEqual(count(pageSection('pg-wiz'),'nw-workspace-stack'),0,'Wizard conserva grids compactos de elección/formulario');

assert.match(css,/\.g2\.nw-workspace-stack\{grid-template-columns:minmax\(0,1fr\);align-items:start;\}/);
assert.match(css,/\.g2\.nw-workspace-stack>\*\{grid-column:1\/-1;min-width:0;\}/);
assert.ok(!adaptive.includes('.g2.nw-workspace-stack'),'La regla de workspace debe vivir en el CSS base y no depender de módulos físicos');

assert.ok(pageSection('pg-dev').includes('<div class="g2 nw-workspace-stack">\n    <div>\n      <div class="card" id="portFormCard">'),'Puertos debe apilar formulario y lista desplegable');
assert.ok(pageSection('pg-vlan').includes('<details class="card" id="vlanListPanel" open>'),'La lista VLAN sigue siendo desplegable');
assert.ok(pageSection('pg-vlan').includes('<details class="card" id="dhcpPanel" open>'),'DHCP sigue siendo desplegable');
assert.ok(pageSection('pg-hosts').includes('<details class="card" id="ipMapPanel">'),'Mapa IP sigue siendo desplegable');
assert.ok(pageSection('pg-links').includes('<details class="card" id="linksListPanel" open>'),'Lista de enlaces sigue siendo desplegable');

console.log('✓ Workspace principal usa flujo vertical sin alterar grids compactos');
