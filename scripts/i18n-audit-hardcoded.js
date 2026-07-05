#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const outFile = path.join(root, 'docs', 'I18N_HARDCODED_AUDIT.txt');
const includeExt = new Set(['.js','.html']);
const skipDirs = new Set(['node_modules','.git','dist','tests','original']);
const candidate = /(['"`])([^'"`\n]*(?:[áéíóúÁÉÍÓÚñÑ¿¡]|\b(?:Añadir|Guardar|Eliminar|Cancelar|Descargar|Proyecto|Dispositivo|Puerto|VLAN|Subred|Enlace|Firewall|Configuración|Producción|Auditoría|Validar|Aplicar|Exportar)\b)[^'"`\n]*)\1/g;
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
const findings = [];
for(const file of walk(root)){
  const rel = path.relative(root, file);
  const text = fs.readFileSync(file, 'utf8');
  let m;
  while((m = candidate.exec(text))){
    const line = text.slice(0,m.index).split(/\r?\n/).length;
    const snippet = m[2].trim();
    const context = text.slice(Math.max(0,m.index-80), Math.min(text.length,m.index+160));
    if(snippet.length < 3 || allowed.some(re => re.test(context))) continue;
    findings.push({rel,line,snippet});
  }
}
let report = '# Auditoría de textos hardcoded i18n\n\n';
report += `Fecha: ${new Date().toISOString()}\n`;
report += `Candidatos detectados: ${findings.length}\n\n`;
report += 'Estos candidatos no son necesariamente errores. Sirven para convertir progresivamente textos visibles a claves i18n.\n\n';
for(const f of findings.slice(0,300)) report += `- ${f.rel}:${f.line} · ${f.snippet}\n`;
if(findings.length>300) report += `\n... ${findings.length-300} candidatos adicionales omitidos.\n`;
fs.writeFileSync(outFile, report, 'utf8');
console.log(`i18n hardcoded audit: ${findings.length} candidatos. Informe: ${path.relative(root,outFile)}`);
