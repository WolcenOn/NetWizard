/* NetWizard modern bulk port editor */
(function(root){
'use strict';

function arr(v){return Array.isArray(v)?v:[];}
function clean(v){return String(v==null?'':v).trim();}
function parseStartToken(value){
  const raw=clean(value);
  const m=raw.match(/^(.*?)(\d+)$/);
  if(!m)return{root:raw||'GigabitEthernet0/',start:1};
  return{root:m[1],start:Number(m[2])||1};
}
function buildRows(project,options){
  const p=project||{},o=options||{},deviceId=clean(o.deviceId),count=Math.max(1,Math.min(256,Number(o.count)||1)),parsed=parseStartToken(o.startToken||o.root||'GigabitEthernet0/1');
  const rootName=o.root!=null?clean(o.root):parsed.root,start=Number(o.start)||parsed.start,media=clean(o.media)||'GE',mode=clean(o.mode)||'access';
  const accessVlanRef=o.accessVlanRef||null,allowedVlans=arr(o.allowedVlans).map(Number).filter(Number.isFinite),desc=clean(o.desc)||null;
  const existing=arr(p.ports).filter(x=>x&&x.deviceId===deviceId);
  const rows=[];
  for(let i=0;i<count;i++){
    const name=rootName+(start+i),old=existing.find(x=>clean(x.name).toLowerCase()===name.toLowerCase());
    rows.push(Object.assign({},old||{},{
      id:old&&old.id||null,deviceId,name,media:old&&old.media||media,mode:old&&old.mode||mode,
      accessVlanRef:old&&old.accessVlanRef!=null?old.accessVlanRef:accessVlanRef,
      nativeVlanRef:old&&old.nativeVlanRef||null,
      allowedVlans:old&&Array.isArray(old.allowedVlans)?old.allowedVlans.slice():allowedVlans.slice(),
      desc:old&&old.desc!=null?old.desc:desc,position:old&&old.position||start+i,enabled:true,existing:!!old
    }));
  }
  return rows;
}
function applyRows(project,rows){
  const next=JSON.parse(JSON.stringify(project||{}));next.ports=arr(next.ports);
  for(const row of arr(rows)){
    if(!row||row.enabled===false||!clean(row.deviceId)||!clean(row.name))continue;
    let target=row.id?next.ports.find(x=>x.id===row.id):null;
    if(!target)target=next.ports.find(x=>x.deviceId===row.deviceId&&clean(x.name).toLowerCase()===clean(row.name).toLowerCase());
    const payload={deviceId:row.deviceId,name:clean(row.name),media:clean(row.media)||'GE',mode:clean(row.mode)||'access',accessVlanRef:row.mode==='access'?(row.accessVlanRef||null):null,nativeVlanRef:row.mode==='trunk'?(row.nativeVlanRef||null):null,allowedVlans:row.mode==='trunk'?arr(row.allowedVlans).map(Number).filter(Number.isFinite):[],desc:clean(row.desc)||null,position:Number(row.position)||null};
    if(target)Object.assign(target,payload);
    else next.ports.push(Object.assign({id:'port_bulk_'+Date.now().toString(36)+'_'+Math.random().toString(36).slice(2,8)},payload));
  }
  return next;
}

function el(tag,cls,text){const n=root.document.createElement(tag);if(cls)n.className=cls;if(text!=null)n.textContent=String(text);return n;}
function trText(key,params,fallback){const i=root.NetWizardI18n;if(i&&typeof i.t==='function')return i.t(key,params||{});return String(fallback||key).replace(/\{([A-Za-z0-9_.-]+)\}/g,(_,k)=>Object.prototype.hasOwnProperty.call(params||{},k)?String(params[k]):'');}
function i18nEl(tag,cls,key,fallback){const n=el(tag,cls,trText(key,{},fallback));n.dataset.i18n=key;return n;}
function opt(value,label,selected){const o=el('option');o.value=String(value);o.textContent=String(label);if(selected)o.selected=true;return o;}
function current(){return root.NetWizardState&&root.NetWizardState.getSnapshot?root.NetWizardState.getSnapshot():{};}
let previewRows=[];

function renderDeviceOptions(sel,project){
  sel.textContent='';sel.appendChild(opt('',trText('ports.bulk.selectDevice',{},'— dispositivo —')));
  arr(project.devices).forEach(d=>sel.appendChild(opt(d.id,d.name||d.id,false)));
}
function renderVlanOptions(sel,project,selected){
  sel.textContent='';sel.appendChild(opt('',trText('ports.bulk.noVlan',{},'— sin VLAN —'),!selected));
  arr(project.vlans).slice().sort((a,b)=>(a.vlanId||0)-(b.vlanId||0)).forEach(v=>sel.appendChild(opt(v.id,'VLAN '+v.vlanId+' · '+(v.name||''),v.id===selected)));
}
function renderPreview(host,project){
  host.textContent='';
  if(!previewRows.length){host.appendChild(el('div','hint',trText('ports.bulk.previewEmpty',{},'Genera una previsualización para editar los puertos antes de guardarlos.')));return;}
  const wrap=el('div','tw'),table=el('table'),head=el('thead'),hr=el('tr');
  [trText('ports.bulk.col.use',{},'Usar'),trText('form.port',{},'Puerto'),trText('ports.bulk.col.media',{},'Medio'),trText('form.mode',{},'Modo'),trText('ports.bulk.col.accessVlan',{},'VLAN access'),trText('ports.bulk.col.trunkVlans',{},'VLANs trunk'),trText('form.description',{},'Descripción')].forEach(x=>hr.appendChild(el('th','',x)));head.appendChild(hr);table.appendChild(head);
  const body=el('tbody');
  previewRows.forEach((row,index)=>{
    const tr=el('tr');
    const use=el('input');use.type='checkbox';use.checked=row.enabled!==false;use.onchange=()=>row.enabled=use.checked;let td=el('td');td.appendChild(use);tr.appendChild(td);
    const name=el('input');name.value=row.name||'';name.oninput=()=>row.name=name.value;td=el('td');td.appendChild(name);tr.appendChild(td);
    const media=el('select');['GE','FE','SFP','10GE'].forEach(v=>media.appendChild(opt(v,v,v===row.media)));media.onchange=()=>row.media=media.value;td=el('td');td.appendChild(media);tr.appendChild(td);
    const mode=el('select');['access','trunk','routed'].forEach(v=>mode.appendChild(opt(v,v,v===row.mode)));mode.onchange=()=>{row.mode=mode.value;renderPreview(host,project);};td=el('td');td.appendChild(mode);tr.appendChild(td);
    const vlan=el('select');renderVlanOptions(vlan,project,row.accessVlanRef);vlan.disabled=row.mode!=='access';vlan.onchange=()=>row.accessVlanRef=vlan.value||null;td=el('td');td.appendChild(vlan);tr.appendChild(td);
    const allowed=el('input');allowed.value=arr(row.allowedVlans).join(',');allowed.disabled=row.mode!=='trunk';allowed.placeholder='10,20,30';allowed.oninput=()=>row.allowedVlans=allowed.value.split(',').map(x=>Number(x.trim())).filter(Number.isFinite);td=el('td');td.appendChild(allowed);tr.appendChild(td);
    const desc=el('input');desc.value=row.desc||'';desc.oninput=()=>row.desc=desc.value;td=el('td');td.appendChild(desc);tr.appendChild(td);
    if(row.existing)tr.title=trText('ports.bulk.existingTitle',{},'Puerto existente: se actualizará');
    body.appendChild(tr);
  });
  table.appendChild(body);wrap.appendChild(table);host.appendChild(wrap);
}
function inject(){
  if(!root.document||root.document.getElementById('nwBulkPortEditor'))return;
  const pg=root.document.getElementById('pg-ports'),anchor=root.document.getElementById('portFormCard');
  if(!pg||!anchor)return;
  const card=el('div','card');card.id='nwBulkPortEditor';
  card.appendChild(i18nEl('div','card-t','ports.bulk.title','🧩 Creación y edición masiva de puertos'));
  card.appendChild(i18nEl('div','hint','ports.bulk.hint','Previsualiza un rango, edita cada fila y aplica solo cuando la tabla sea correcta.'));
  const grid=el('div','g2');
  const left=el('div'),right=el('div');
  const dev=el('select');dev.id='nwBulkDev';renderDeviceOptions(dev,current());
  const rootInput=el('input');rootInput.id='nwBulkRoot';rootInput.value='GigabitEthernet0/';rootInput.placeholder='GigabitEthernet0/';
  const start=el('input');start.type='number';start.min='1';start.value='1';
  const count=el('input');count.type='number';count.min='1';count.max='256';count.value='24';
  const media=el('select');['GE','FE','SFP','10GE'].forEach(v=>media.appendChild(opt(v,v,v==='GE')));
  const mode=el('select');['access','trunk','routed'].forEach(v=>mode.appendChild(opt(v,v,v==='access')));
  const vlan=el('select');renderVlanOptions(vlan,current(),null);
  const allowed=el('input');allowed.placeholder='10,20,30';
  const desc=el('input');desc.placeholder=trText('ports.bulk.baseDescription',{},'Descripción base');desc.dataset.i18nPlaceholder='ports.bulk.baseDescription';
  function field(key,label,node){const b=el('div');b.appendChild(i18nEl('label','fl',key,label));b.appendChild(node);return b;}
  left.append(field('form.device','Dispositivo',dev),field('ports.bulk.rootName','Raíz de nombre',rootInput));
  const r1=el('div','row');r1.append(field('ports.bulk.start','Inicio',start),field('ports.bulk.count','Cantidad',count));left.appendChild(r1);
  const r2=el('div','row');r2.append(field('ports.bulk.media','Medio',media),field('form.mode','Modo',mode));left.appendChild(r2);
  const r3=el('div','row');r3.append(field('ports.bulk.accessVlan','VLAN access',vlan),field('ports.bulk.trunkVlans','VLANs trunk',allowed));left.appendChild(r3);left.append(field('form.description','Descripción',desc));
  const buttons=el('div','brow'),preview=i18nEl('button','btn bs','ports.bulk.preview','👁 Previsualizar'),apply=i18nEl('button','btn bp','ports.bulk.apply','💾 Aplicar cambios');
  buttons.append(preview,apply);left.appendChild(buttons);
  const previewHost=el('div');right.appendChild(previewHost);grid.append(left,right);card.appendChild(grid);
  anchor.parentElement.insertAdjacentElement('afterend',card);
  const rebuild=()=>{const p=current();renderDeviceOptions(dev,p);renderVlanOptions(vlan,p,vlan.value);renderPreview(previewHost,p);};
  root.document.addEventListener('nw:project:changed',rebuild);
  root.addEventListener&&root.addEventListener('netwizard:i18n',rebuild);
  preview.onclick=()=>{
    if(!dev.value){root.alert&&root.alert(trText('ports.alert.selectDevice',{},'Selecciona un dispositivo.'));return;}
    const p=current(),allowedVlans=allowed.value.split(',').map(x=>Number(x.trim())).filter(Number.isFinite);
    previewRows=buildRows(p,{deviceId:dev.value,root:rootInput.value,start:Number(start.value)||1,count:Number(count.value)||24,media:media.value,mode:mode.value,accessVlanRef:vlan.value||null,allowedVlans,desc:desc.value});
    renderPreview(previewHost,p);
  };
  apply.onclick=()=>{
    if(!previewRows.length){root.alert&&root.alert(trText('ports.bulk.alert.previewFirst',{},'Genera primero la previsualización.'));return;}
    const next=applyRows(current(),previewRows);
    root.NetWizardState.replaceProject(next,{source:'bulk-port-editor'});
    root.alert&&root.alert(trText('ports.bulk.feedback.applied',{},'✓ Puertos aplicados correctamente.'));
  };
  renderPreview(previewHost,current());
}
const api={version:'netwizard-bulk-port-editor-v1',parseStartToken,buildRows,applyRows,inject};
root.NetWizardBulkPortEditor=api;
if(typeof module!=='undefined'&&module.exports)module.exports=api;
if(root.document){if(root.document.readyState==='loading')root.document.addEventListener('DOMContentLoaded',inject);else inject();}
})(typeof window!=='undefined'?window:globalThis);
