/* NetWizard As-Built Export Pack UI v1 */
(function initNetWizardAsBuiltExportsUi(root){
'use strict';
const doc=()=>root.document||null;
const state=()=>root.NetWizardState||null;
const exp=()=>root.NetWizardAsBuiltExports||null;
const docs=()=>root.NetWizardDocumentationUtils||null;
const tr=(key,params={},fallback='')=>root.NetWizardI18n&&typeof root.NetWizardI18n.t==='function'?root.NetWizardI18n.t(key,params):String(fallback||key).replace(/\{([A-Za-z0-9_.-]+)\}/g,(_m,k)=>Object.prototype.hasOwnProperty.call(params,k)?String(params[k]):'');
function el(tag,cls,text){const n=doc().createElement(tag);if(cls)n.className=cls;if(text!=null)n.textContent=String(text);return n;}
function snapshot(){return state()?.getSnapshot?.()||{};}
function safeBase(p){const raw=String(p&&p.projName||'netwizard').normalize('NFD').replace(/[\u0300-\u036f]/g,'');return raw.replace(/[^A-Za-z0-9_-]+/g,'_').replace(/^_+|_+$/g,'')||'netwizard';}
function download(name,text,mime){const D=docs();if(D&&D.downloadText)return D.downloadText(name,text,mime);return false;}
function downloadBytes(name,bytes,mime){
  const d=doc();if(!d||!bytes)return false;
  const blob=new Blob([bytes],{type:mime||'application/octet-stream'}),url=URL.createObjectURL(blob),a=d.createElement('a');
  a.href=url;a.download=name;d.body.appendChild(a);a.click();setTimeout(()=>{URL.revokeObjectURL(url);a.remove();},1000);return true;
}
function render(){
  const E=exp(),p=snapshot(),box=el('div','card nw-card-wide'),h=el('div','card-h');
  h.append(el('div','card-t',tr('deploy.asbuilt.title',{},'📦 Export Pack · Inventario / As-Built')));box.append(h);
  box.append(el('p','hint',tr('deploy.asbuilt.hint',{},'Exportaciones operativas por dominio físico. Reutiliza el inventario canónico y no crea copias persistentes.')));
  if(!E)return box;
  const pack=E.buildCsvPack(p),stats=el('div','stats');
  for(const [name,count] of Object.entries(pack.manifest.sheets)){const s=el('div');s.append(el('b','',count),el('span','',name));stats.append(s);}box.append(stats);
  const row=el('div','brow'),base=safeBase(p);
  const defs=[['devices',tr('deploy.asbuilt.devices',{},'Equipos')],['ports',tr('deploy.asbuilt.ports',{},'Puertos')],['cables',tr('deploy.asbuilt.cables',{},'Cableado')],['power',tr('deploy.asbuilt.power',{},'Alimentación')],['racks',tr('deploy.asbuilt.racks',{},'Racks')],['bom',tr('deploy.asbuilt.bom',{},'BOM')],['budget',tr('deploy.asbuilt.budget',{},'Presupuesto')]];
  for(const [key,label] of defs){const b=el('button','btn bs',`⬇ ${label} CSV`);b.type='button';b.onclick=()=>download(`${base}_${key}.csv`,pack.files[`${key}.csv`],'text/csv;charset=utf-8');row.append(b);}
  const xlsx=el('button','btn bp',tr('deploy.asbuilt.xlsx',{},'⬇ Excel XLSX'));xlsx.type='button';xlsx.onclick=()=>downloadBytes(`${base}_asbuilt.xlsx`,E.buildXlsx(p),'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');row.append(xlsx);
  const all=el('button','btn bs',tr('deploy.asbuilt.markdownIndex',{},'⬇ Índice Markdown'));all.type='button';all.onclick=()=>download(`${base}_asbuilt-pack.md`,E.markdown(p),'text/markdown;charset=utf-8');row.append(all);
  box.append(row);
  if(pack.tables.differentialBom.length)box.append(el('div','co co-ac',tr('deploy.asbuilt.differentialBom',{count:pack.tables.differentialBom.length},'BOM diferencial disponible: {count} filas.')));
  return box;
}
function inject(){
  const d=doc();if(!d)return;const host=d.getElementById('pg-physical');if(!host)return;
  let mount=d.getElementById('asBuiltExportPackMount');
  if(!mount){mount=d.createElement('div');mount.id='asBuiltExportPackMount';host.append(mount);}
  mount.textContent='';mount.append(render());
}
root.NetWizardAsBuiltExportsUi={version:'netwizard-asbuilt-export-pack-ui-v1',render,inject};
if(root.document){const active=()=>root.document.getElementById('pg-physical')?.classList.contains('on');const refresh=()=>{if(active())setTimeout(inject,0);};if(root.document.readyState==='loading')root.document.addEventListener('DOMContentLoaded',refresh);else refresh();root.document.addEventListener('nw:project:changed',refresh);root.document.addEventListener('nw:view:changed',event=>{if(event.detail?.step==='physical')setTimeout(inject,0);});root.addEventListener&&root.addEventListener('netwizard:i18n',refresh);}
})(typeof window!=='undefined'?window:globalThis);
