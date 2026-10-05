#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const outFile = path.join(root, 'docs', 'I18N_HARDCODED_AUDIT.txt');
const checkMode = process.argv.includes('--check');
const strictFiles = new Set(['js/netwizard-rack-model.js','js/netwizard-rack-ui.js','js/netwizard-physical-inventory-ui.js','js/netwizard-custom-device-model-ui.js','js/netwizard-bulk-port-editor.js','js/netwizard-dhcp-utils.js','js/netwizard-network-utils.js']);
const strictRegionMarkers = {
  'js/netwizard.js': [
    ['function initDeviceVendorSelect(){','// ─────────────────── VLANs ───────────────────'],
    ["$('lyDev').onchange=", "$('visDev').onchange=renderVisPorts;"],
    ['// 08. VLANS Y SUBNETS','// ─────────────────── HOSTS ───────────────────'],
    ['function fillRoasSels(){','function renderVendorPills(']
  ]
};
const skipFiles = new Set(['js/netwizard-i18n.js']);
const includeExt = new Set(['.js','.html']);
const skipDirs = new Set(['node_modules','.git','dist','tests','original']);
const candidate = /(['"`])([^'"`\n]*(?:[áéíóúÁÉÍÓÚñÑ¿¡]|\b(?:Añadir|Guardar|Eliminar|Cancelar|Descargar|Proyecto|Dispositivo|Puerto|Puertos|VLAN|Subred|Enlace|Firewall|Configuración|Producción|Auditoría|Validar|Aplicar|Exportar|Rack|Ubicación|Equipo|Inventario|Alimentación|Organización|Ocupación|Incidencias|Elemento|Conexión|Propiedades|Modelo|Fabricante|Descripción|Medio|Modo|Cantidad|Inicio|Acciones|Notas|Revisión|Consumo|Voltaje|Peso|Servidor|Selecciona|Genera|Previsualiza|Borrar|Promover)\b)[^'"`\n]*)\1/g;
const allowed = [/data-i18n/, /console\./, /VERSION/i, /schemaVersion/, /docs\//, /CHANGELOG/];

function walk(dir, files=[]){
  for(const ent of fs.readdirSync(dir, {withFileTypes:true})){
    if(skipDirs.has(ent.name)) continue;
    const full = path.join(dir, ent.name);
    if(ent.isDirectory()) walk(full, files);
    else if(includeExt.has(path.extname(ent.name))) files.push(full);
  }
  return files;
}
function maskTranslationCalls(text,rel){
  const chars=text.split('');
  let cursor=0;
  while(cursor<text.length){
    const tokens=['tr(','localized('];if(rel==='js/netwizard-physical-inventory-ui.js')tokens.push('field(');if(rel==='js/netwizard-rack-model.js')tokens.push('localizedIssue(');if(rel==='js/netwizard-rack-ui.js')tokens.push('notice(');if(rel==='js/netwizard-network-utils.js')tokens.push('result(');if(rel==='js/netwizard-dhcp-utils.js')tokens.push('issue(');if(rel==='js/netwizard.js')tokens.push('i18nText(');if(rel==='js/netwizard-custom-device-model-ui.js')tokens.push('i18nNode(');if(rel==='js/netwizard-bulk-port-editor.js')tokens.push('trText(','i18nEl(','field(');
    const starts=tokens.map(token=>text.indexOf(token,cursor)).filter(x=>x>=0);
    if(!starts.length)break;
    const start=Math.min(...starts);
    const open=text.indexOf('(',start);
    let i=open+1,depth=1,quote='',escape=false;
    for(;i<text.length&&depth>0;i++){
      const ch=text[i];
      if(quote){
        if(escape){escape=false;continue;}
        if(ch==='\\'){escape=true;continue;}
        if(ch===quote)quote='';
        continue;
      }
      if(ch==="'"||ch==='"'||ch==='`'){quote=ch;continue;}
      if(ch==='(')depth++;
      else if(ch===')')depth--;
    }
    if(depth!==0){cursor=open+1;continue;}
    for(let j=start;j<i;j++)if(chars[j]!=='\n'&&chars[j]!=='\r')chars[j]=' ';
    cursor=i;
  }
  return chars.join('');
}
function strictRanges(rel,text){
  const defs=strictRegionMarkers[rel]||[],ranges=[];
  for(const [startMarker,endMarker] of defs){
    const start=text.indexOf(startMarker);if(start<0)continue;
    const end=text.indexOf(endMarker,start+startMarker.length);
    if(end<0)continue;
    ranges.push([start,end+endMarker.length]);
  }
  return ranges;
}
function offsetInRanges(offset,ranges){return ranges.some(([a,b])=>offset>=a&&offset<b);}
const findings = [];
for(const file of walk(root)){
  const rel = path.relative(root, file).replace(/\\/g,'/');
  if(skipFiles.has(rel)) continue;
  const raw = fs.readFileSync(file, 'utf8');
  const ranges=strictRanges(rel,raw);
  const text = (strictFiles.has(rel)||ranges.length) ? maskTranslationCalls(raw,rel) : raw;
  let m;
  while((m = candidate.exec(text))){
    const line = text.slice(0,m.index).split(/\r?\n/).length;
    const snippet = m[2].trim();
    const context = text.slice(Math.max(0,m.index-80), Math.min(text.length,m.index+160));
    if(snippet.length < 3 || /^VLAN(?:\$\{[^}]+\})?$/.test(snippet) || allowed.some(re => re.test(context))) continue;
    findings.push({rel,line,snippet,strict:strictFiles.has(rel)||offsetInRanges(m.index,ranges)});
  }
}
const strictFindings=findings.filter(x=>x.strict);
let report = '# Auditoría de textos hardcoded i18n\n\n';
report += `Fecha: ${new Date().toISOString()}\n`;
report += `Candidatos detectados: ${findings.length}\n`;
report += `Bloqueantes en superficies migradas: ${strictFindings.length}\n\n`;
report += 'Estos candidatos no son necesariamente errores. Sirven para convertir progresivamente textos visibles a claves i18n.\n\n';
for(const f of findings.slice(0,300)) report += `- ${f.rel}:${f.line} · ${f.snippet}\n`;
if(findings.length>300) report += `\n... ${findings.length-300} candidatos adicionales omitidos.\n`;
if(!checkMode) fs.writeFileSync(outFile, report, 'utf8');
console.log(`i18n hardcoded audit: ${findings.length} candidatos · strict=${strictFindings.length}${checkMode?' · check':''}.`);
if(!checkMode) console.log(`Informe: ${path.relative(root,outFile)}`);
if(checkMode&&strictFindings.length){
  console.error('i18n hardcoded audit: FALLÓ en superficies ya migradas:');
  strictFindings.slice(0,50).forEach(f=>console.error(' - '+f.rel+':'+f.line+' · '+f.snippet));
  process.exit(1);
}
