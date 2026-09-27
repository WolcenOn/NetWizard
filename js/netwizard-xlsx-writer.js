/* NetWizard XLSX Writer v1
 * Minimal dependency-free OOXML writer for export-only workbooks.
 */
(function initNetWizardXlsxWriter(root){
'use strict';

const encoder=typeof TextEncoder!=='undefined'?new TextEncoder():null;
const textBytes=s=>encoder?encoder.encode(String(s)):Uint8Array.from(Buffer.from(String(s),'utf8'));
const xml=v=>String(v==null?'':v).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&apos;');
function colName(n){let s='';for(let x=n+1;x>0;x=Math.floor((x-1)/26))s=String.fromCharCode(65+((x-1)%26))+s;return s;}
function cleanSheetName(name,index){const base=String(name||('Sheet '+(index+1))).replace(/[\\/?*\[\]:]/g,' ').trim()||('Sheet '+(index+1));return base.slice(0,31);}
function uniqueSheetNames(sheets){const used=new Set();return sheets.map((s,i)=>{const base=cleanSheetName(s.name,i);let name=base,n=2;while(used.has(name)){const suffix=' '+n++;name=(base.slice(0,31-suffix.length)+suffix);}used.add(name);return name;});}
function cellXml(value,row,col,header){
  const ref=colName(col)+(row+1),style=header?' s="1"':'';
  if(value==null||value==='')return `<c r="${ref}"${style} t="inlineStr"><is><t></t></is></c>`;
  if(typeof value==='number'&&Number.isFinite(value))return `<c r="${ref}"${style}><v>${value}</v></c>`;
  if(typeof value==='boolean')return `<c r="${ref}"${style} t="b"><v>${value?1:0}</v></c>`;
  const text=String(value),preserve=/^\s|\s$|\n/.test(text)?' xml:space="preserve"':'';
  return `<c r="${ref}"${style} t="inlineStr"><is><t${preserve}>${xml(text)}</t></is></c>`;
}
function sheetXml(rows){
  const list=Array.isArray(rows)?rows:[],headers=list[0]?Object.keys(list[0]):[];
  const matrix=headers.length?[headers,...list.map(r=>headers.map(h=>r[h]))]:[['Sin datos']];
  const rowXml=matrix.map((r,ri)=>`<row r="${ri+1}">${r.map((v,ci)=>cellXml(v,ri,ci,ri===0)).join('')}</row>`).join('');
  const end=colName(Math.max(0,matrix[0].length-1)) + Math.max(1,matrix.length);
  return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'+
    '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">'+
    '<sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews>'+
    `<dimension ref="A1:${end}"/><sheetData>${rowXml}</sheetData><autoFilter ref="A1:${colName(Math.max(0,matrix[0].length-1))}${Math.max(1,matrix.length)}"/>`+
    '</worksheet>';
}
function workbookXml(names){return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'+
  '<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>'+
  names.map((n,i)=>`<sheet name="${xml(n)}" sheetId="${i+1}" r:id="rId${i+1}"/>`).join('')+
  '</sheets></workbook>';}
function workbookRels(count){return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'+
  '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'+
  Array.from({length:count},(_,i)=>`<Relationship Id="rId${i+1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i+1}.xml"/>`).join('')+
  `<Relationship Id="rId${count+1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>`+
  '</Relationships>';}
function contentTypes(count){return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'+
  '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">'+
  '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/>'+
  '<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>'+
  '<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>'+
  Array.from({length:count},(_,i)=>`<Override PartName="/xl/worksheets/sheet${i+1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join('')+
  '</Types>';}
const rootRels='<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>';
const styles='<?xml version="1.0" encoding="UTF-8" standalone="yes"?><styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><fonts count="2"><font><sz val="11"/><name val="Calibri"/></font><font><b/><color rgb="FFFFFFFF"/><sz val="11"/><name val="Calibri"/></font></fonts><fills count="3"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FF1F4E78"/><bgColor indexed="64"/></patternFill></fill></fills><borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="2"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/><xf numFmtId="0" fontId="1" fillId="2" borderId="0" xfId="0" applyFont="1" applyFill="1"/></cellXfs></styleSheet>';

let crcTable=null;
function crc32(bytes){
  if(!crcTable){crcTable=new Uint32Array(256);for(let n=0;n<256;n++){let c=n;for(let k=0;k<8;k++)c=(c&1)?0xEDB88320^(c>>>1):c>>>1;crcTable[n]=c>>>0;}}
  let c=0xFFFFFFFF;for(const b of bytes)c=crcTable[(c^b)&0xFF]^(c>>>8);return (c^0xFFFFFFFF)>>>0;
}
function u16(n){return Uint8Array.of(n&255,(n>>>8)&255);}
function u32(n){return Uint8Array.of(n&255,(n>>>8)&255,(n>>>16)&255,(n>>>24)&255);}
function concat(parts){const len=parts.reduce((s,p)=>s+p.length,0),out=new Uint8Array(len);let o=0;for(const p of parts){out.set(p,o);o+=p.length;}return out;}
function zipStore(files){
  const locals=[],centrals=[];let offset=0;
  for(const file of files){
    const name=textBytes(file.name),data=textBytes(file.content),crc=crc32(data);
    const local=concat([u32(0x04034b50),u16(20),u16(0),u16(0),u16(0),u16(0),u32(crc),u32(data.length),u32(data.length),u16(name.length),u16(0),name,data]);
    locals.push(local);
    const central=concat([u32(0x02014b50),u16(20),u16(20),u16(0),u16(0),u16(0),u16(0),u32(crc),u32(data.length),u32(data.length),u16(name.length),u16(0),u16(0),u16(0),u16(0),u32(0),u32(offset),name]);
    centrals.push(central);offset+=local.length;
  }
  const centralBlob=concat(centrals),localBlob=concat(locals);
  const end=concat([u32(0x06054b50),u16(0),u16(0),u16(files.length),u16(files.length),u32(centralBlob.length),u32(localBlob.length),u16(0)]);
  return concat([localBlob,centralBlob,end]);
}
function buildWorkbook(sheets){
  const list=Array.isArray(sheets)?sheets.filter(Boolean):[],names=uniqueSheetNames(list);
  if(!list.length)throw new Error('Se requiere al menos una hoja XLSX.');
  const files=[
    {name:'[Content_Types].xml',content:contentTypes(list.length)},
    {name:'_rels/.rels',content:rootRels},
    {name:'xl/workbook.xml',content:workbookXml(names)},
    {name:'xl/_rels/workbook.xml.rels',content:workbookRels(list.length)},
    {name:'xl/styles.xml',content:styles}
  ];
  list.forEach((s,i)=>files.push({name:`xl/worksheets/sheet${i+1}.xml`,content:sheetXml(Array.isArray(s.rows)?s.rows:[])}));
  return zipStore(files);
}
const api={version:'netwizard-xlsx-writer-v1',buildWorkbook,cleanSheetName};
root.NetWizardXlsxWriter=api;
if(typeof module!=='undefined'&&module.exports)module.exports=api;
})(typeof window!=='undefined'?window:globalThis);
