'use strict';

const assert=require('assert');
const fs=require('fs');
const path=require('path');

const html=fs.readFileSync(path.join(__dirname,'..','index.html'),'utf8');

function section(id){
  const start=html.indexOf(`<div class="pg" id="${id}">`);
  assert.ok(start>=0,`missing section ${id}`);
  const next=html.indexOf('<!-- ═══════════',start+1);
  return html.slice(start,next>=0?next:html.length);
}

const ports=section('pg-ports');
const links=section('pg-links');

assert.ok(ports.includes('id="btnBuildLy"'),'port layout preview must live in Puertos & Interfaces');
assert.ok(ports.includes('id="btnApplyLy"'),'bulk port generation must live in Puertos & Interfaces');
assert.ok(!links.includes('id="btnBuildLy"'),'Enlaces must not expose a second port-layout editor');
assert.ok(!links.includes('id="btnApplyLy"'),'Enlaces must not create ports');
assert.ok(links.includes('id="btnAddLink"'),'Enlaces must keep link creation');
assert.ok(links.includes('id="lnkA"')&&links.includes('id="lnkB"'),'Enlaces must consume existing ports');
assert.match(html,/data-step="links"[^>]*><div class="sb-num">6<\/div><span class="sb-label" data-i18n="nav\.links">🔗 Enlaces<\/span><\/div>/);

console.log('✓ La navegación separa autoridad de puertos y creación de enlaces');
