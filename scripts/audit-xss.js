#!/usr/bin/env node
/*
  Auditoría XSS estática ligera para NetWizard.
  No sustituye a una revisión manual, pero localiza puntos de riesgo:
  - asignaciones a innerHTML/outerHTML/insertAdjacentHTML/document.write
  - atributos inline con ids interpolados sin jsq()/attr()/esc()
*/
const fs = require('fs');
const path = require('path');
const root = path.resolve(__dirname, '..');
const files = [];
function walk(dir){
  for(const ent of fs.readdirSync(dir,{withFileTypes:true})){
    if(['node_modules','.git','dist','original','tests'].includes(ent.name)) continue;
    const p = path.join(dir, ent.name);
    if(ent.isDirectory()) walk(p);
    else if(/\.(js|html)$/.test(ent.name)) files.push(p);
  }
}
walk(root);
const findings = [];
const htmlSink = /\.(innerHTML|outerHTML)\s*=|insertAdjacentHTML\s*\(|document\.write\s*\(/;
const riskyInterpolatedAttr = /(on\w+|data-[\w-]+|value)="\$\{(?!\s*(?:esc|attr|jsq|escapeHtml|escapeAttr|inlineJsString)\()/;
for(const file of files){
  const rel = path.relative(root,file).replace(/\\/g,'/');
  const lines = fs.readFileSync(file,'utf8').split(/\r?\n/);
  lines.forEach((line,idx)=>{
    if(htmlSink.test(line)){
      const escaped = /\b(esc|escapeHtml|escapeAttr|html|rawHtml|textContent|createElement)\b/.test(line);
      const staticOnly = /innerHTML\s*=\s*['"][^$`]*['"]\s*;?\s*$/.test(line.trim());
      findings.push({type: escaped||staticOnly?'review':'risk', file:rel, line:idx+1, text:line.trim().slice(0,220)});
    }
    if(riskyInterpolatedAttr.test(line)){
      findings.push({type:'risk', file:rel, line:idx+1, text:line.trim().slice(0,220)});
    }
  });
}
const risks = findings.filter(f=>f.type==='risk');
console.log(`XSS audit: ${findings.length} HTML sinks reviewed, ${risks.length} patterns require manual review.`);
if(risks.length){
  for(const f of risks.slice(0,80)) console.log(`${f.file}:${f.line}: ${f.text}`);
  if(process.argv.includes('--fail')) process.exitCode = 1;
}
