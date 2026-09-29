/* NetWizard Structured Cabling UI */
(function(root){
'use strict';
const MODEL=root.NetWizardStructuredCabling||(typeof require==='function'?require('./netwizard-structured-cabling.js'):null);
const arr=v=>Array.isArray(v)?v:[];
const clean=v=>String(v==null?'':v).trim();
const num=v=>{if(v==null||String(v).trim()==='')return null;const n=Number(v);return Number.isFinite(n)?n:null;};
const clone=v=>JSON.parse(JSON.stringify(v||{}));
const uid=prefix=>`${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2,7)}`;
function ensureArrays(project){for(const k of ['patchPanels','telecomOutlets','cableRuns','patchConnections','hostOutletConnections','rackItems'])if(!Array.isArray(project[k]))project[k]=[];return project;}
function syncHostAccessMirrors(project){
 const next=ensureArrays(clone(project));
 if(!MODEL||typeof MODEL.hostAccess!=='function')return next;
 for(const host of arr(next.hosts)){
   const access=MODEL.hostAccess(next,host.id);
   if(access&&access.structured&&access.complete){
     host.portRef=access.switchPortId||host.portRef||null;
     host.connectedDeviceId=access.deviceId||host.connectedDeviceId||null;
   }
 }
 return next;
}
function addPatchPanel(project,input){const next=ensureArrays(clone(project));const panel={id:clean(input.id)||uid('patch'),rackId:clean(input.rackId),name:clean(input.name)||'Patch panel',portCount:Math.max(1,Math.floor(num(input.portCount)||24)),category:clean(input.category)||'Cat6A',rackUnit:num(input.rackUnit)};next.patchPanels.push(panel);if(panel.rackId&&panel.rackUnit!=null)next.rackItems.push({id:`rackitem-${panel.id}`,rackId:panel.rackId,type:'patch-panel',patchPanelId:panel.id,label:panel.name,startUnit:panel.rackUnit,heightUnits:1,face:'front'});return next;}
function addOutlet(project,input){const next=ensureArrays(clone(project));next.telecomOutlets.push({id:clean(input.id)||uid('outlet'),locationId:clean(input.locationId)||null,name:clean(input.name)||'Toma de red',portCount:Math.max(1,Math.floor(num(input.portCount)||1)),category:clean(input.category)||'Cat6A',room:clean(input.room)||null});return next;}
function addCableRun(project,input){const next=ensureArrays(clone(project));next.cableRuns.push({id:clean(input.id)||uid('cable'),label:clean(input.label)||null,patchPanelId:clean(input.patchPanelId),patchPort:Math.max(1,Math.floor(num(input.patchPort)||1)),outletId:clean(input.outletId),outletPort:Math.max(1,Math.floor(num(input.outletPort)||1)),cableType:clean(input.cableType)||'Cat6A',lengthM:num(input.lengthM),route:clean(input.route)||null});return next;}
function addPatchConnection(project,input){const next=ensureArrays(clone(project));next.patchConnections.push({id:clean(input.id)||uid('patchcord'),patchPanelId:clean(input.patchPanelId),patchPort:Math.max(1,Math.floor(num(input.patchPort)||1)),switchPortId:clean(input.switchPortId),patchCordLengthM:num(input.patchCordLengthM)||1});return next;}
function addHostOutletConnection(project,input){const next=ensureArrays(clone(project));next.hostOutletConnections.push({id:clean(input.id)||uid('hostcord'),hostId:clean(input.hostId),outletId:clean(input.outletId),outletPort:Math.max(1,Math.floor(num(input.outletPort)||1)),patchCordLengthM:num(input.patchCordLengthM)||2});return next;}
function removeEntity(project,kind,id){const next=ensureArrays(clone(project));if(kind==='patchPanel'){next.patchPanels=next.patchPanels.filter(x=>x.id!==id);next.rackItems=next.rackItems.filter(x=>x.patchPanelId!==id);next.cableRuns=next.cableRuns.filter(x=>x.patchPanelId!==id);next.patchConnections=next.patchConnections.filter(x=>x.patchPanelId!==id);}else if(kind==='outlet'){next.telecomOutlets=next.telecomOutlets.filter(x=>x.id!==id);next.cableRuns=next.cableRuns.filter(x=>x.outletId!==id);next.hostOutletConnections=next.hostOutletConnections.filter(x=>x.outletId!==id);}else{const map={cableRun:'cableRuns',patchConnection:'patchConnections',hostOutletConnection:'hostOutletConnections'};if(map[kind])next[map[kind]]=next[map[kind]].filter(x=>x.id!==id);}return next;}
function el(tag,cls,text){const n=document.createElement(tag);if(cls)n.className=cls;if(text!==undefined)n.textContent=String(text??'');return n;}
function field(label,node){const w=el('div');w.append(el('label','fl',label),node);return w;}
function input(type,placeholder,value){const n=document.createElement('input');n.type=type||'text';if(placeholder)n.placeholder=placeholder;if(value!=null)n.value=value;return n;}
function select(options,value){const n=document.createElement('select');for(const [v,l] of options){const o=document.createElement('option');o.value=v;o.textContent=l;o.selected=String(v)===String(value??'');n.appendChild(o);}return n;}
function button(text,action,cls){const b=el('button',`btn ${cls||'bs'}`,text);b.type='button';b.dataset.action=action;return b;}
function options(list,empty){return (empty?[['',empty]]:[]).concat(arr(list).map(x=>[x.id,x.name||x.label||x.id]));}
function portOptions(project,empty){const devs=new Map(arr(project.devices).map(d=>[d.id,d]));return (empty?[['',empty]]:[]).concat(arr(project.ports).map(p=>[p.id,`${devs.get(p.deviceId)?.name||p.deviceId||'Equipo'} · ${p.name||p.id}`]));}
function editor(project){
 const card=el('div','card nw-card-wide');card.appendChild(el('div','card-t','🧵 Cableado estructurado'));
 card.appendChild(el('p','hint','Documenta desde el puerto de switch hasta el host: switch → latiguillo → patch panel → enlace permanente → toma → latiguillo → host.'));
 const grid=el('div','rack-editor-grid');
 const panel=el('form','rack-editor-form');panel.dataset.form='cable-panel';const prack=select(options(project.racks,'Sin rack'),''),pname=input('text','PP-01'),pports=input('number','24',24),pcat=input('text','Cat6A','Cat6A'),pu=input('number','U opcional');panel.append(field('Rack',prack),field('Nombre',pname),field('Puertos',pports),field('Categoría',pcat),field('Unidad rack',pu),button('➕ Patch panel','add-cable-panel','bp'));panel.elementsRef={prack,pname,pports,pcat,pu};
 const outlet=el('form','rack-editor-form');outlet.dataset.form='cable-outlet';const oloc=select(options(project.physicalLocations,'Sin ubicación'),''),oname=input('text','TO-A01'),oports=input('number','1',1),ocat=input('text','Cat6A','Cat6A');outlet.append(field('Ubicación',oloc),field('Nombre/toma',oname),field('Puertos',oports),field('Categoría',ocat),button('➕ Toma','add-cable-outlet','bp'));outlet.elementsRef={oloc,oname,oports,ocat};
 const run=el('form','rack-editor-form');run.dataset.form='cable-run';const rpanel=select(options(project.patchPanels,'Patch panel'),''),rp=input('number','Puerto panel',1),rout=select(options(project.telecomOutlets,'Toma'),''),rop=input('number','Puerto toma',1),rtype=input('text','Cat6A','Cat6A'),rlen=input('number','Longitud m'),rroute=input('text','Bandeja CPD → planta 1');run.append(field('Patch panel',rpanel),field('Puerto panel',rp),field('Toma',rout),field('Puerto toma',rop),field('Cable',rtype),field('Longitud m',rlen),field('Recorrido',rroute),button('🔗 Tramo permanente','add-cable-run','bp'));run.elementsRef={rpanel,rp,rout,rop,rtype,rlen,rroute};
 const patch=el('form','rack-editor-form');patch.dataset.form='cable-patch';const ppanel=select(options(project.patchPanels,'Patch panel'),''),pp=input('number','Puerto panel',1),sport=select(portOptions(project,'Puerto switch'),''),plen=input('number','Latiguillo m',1);patch.append(field('Patch panel',ppanel),field('Puerto panel',pp),field('Puerto switch',sport),field('Latiguillo m',plen),button('🔌 Parchear switch','add-cable-patch','bp'));patch.elementsRef={ppanel,pp,sport,plen};
 const host=el('form','rack-editor-form');host.dataset.form='cable-host';const hout=select(options(project.telecomOutlets,'Toma'),''),hop=input('number','Puerto toma',1),hhost=select(options(project.hosts,'Host'),''),hlen=input('number','Latiguillo m',2);host.append(field('Toma',hout),field('Puerto toma',hop),field('Host',hhost),field('Latiguillo m',hlen),button('🖥 Conectar host','add-cable-host','bp'));host.elementsRef={hout,hop,hhost,hlen};
 for(const [title,form] of [['Patch panel',panel],['Toma de usuario',outlet],['Tramo permanente',run],['Parcheo rack',patch],['Toma ↔ host',host]]){const g=el('section','rack-editor-group');g.append(el('h3','',title),form);grid.appendChild(g);}card.appendChild(grid);return card;
}
function inventoryCard(project){
 const card=el('div','card nw-card-wide');card.appendChild(el('div','card-t','📋 Inventario de cableado'));
 const groups=[
  ['Patch panels',arr(project.patchPanels),'patchPanel',x=>`${x.name||x.id} · ${x.portCount||0} puertos · ${x.category||'—'}`],
  ['Tomas',arr(project.telecomOutlets),'outlet',x=>`${x.name||x.id} · ${x.portCount||1} puerto(s) · ${x.category||'—'}`],
  ['Tramos permanentes',arr(project.cableRuns),'cableRun',x=>`${x.label||x.id} · ${x.cableType||'—'} · ${x.lengthM!=null?x.lengthM+' m':'—'}`],
  ['Parcheos rack',arr(project.patchConnections),'patchConnection',x=>`${x.patchPanelId} P${x.patchPort} → ${MODEL.portLabel(project,x.switchPortId)}`],
  ['Toma ↔ host',arr(project.hostOutletConnections),'hostOutletConnection',x=>`${MODEL.outletLabel(project,x.outletId,x.outletPort)} → ${MODEL.hostLabel(project,x.hostId)}`]
 ];
 const grid=el('div','nw-card-grid');
 for(const [title,list,kind,labeler] of groups){
   const box=el('section','rack-topology-group');box.appendChild(el('h4','',title));
   if(!list.length)box.appendChild(el('div','empty','Sin elementos.'));
   for(const item of list){const row=el('div','rack-list-row');row.appendChild(el('span','',labeler(item)));const b=button('Quitar','remove-cabling','bd bxs');b.dataset.kind=kind;b.dataset.id=item.id;row.appendChild(b);box.appendChild(row);}
   grid.appendChild(box);
 }
 card.appendChild(grid);return card;
}
function pathsCard(project){
 const card=el('div','card nw-card-wide');const audit=MODEL.validate(project);const h=el('div','card-h');h.append(el('div','card-t','🧭 Rutas físicas completas'),el('span',`b ${audit.ok?'bgn':'brd'}`,audit.ok?'Cableado coherente':`${audit.issues.length} incidencias`));card.appendChild(h);
 const paths=MODEL.paths(project);if(!paths.length){card.appendChild(el('div','empty','No hay tramos permanentes documentados.'));return card;}
 const wrap=el('div','tw'),table=el('table'),thead=el('thead'),trh=el('tr');['Ruta','Switch','Patch panel','Toma','Host','Cable','Longitud'].forEach(x=>trh.appendChild(el('th','',x)));thead.appendChild(trh);table.appendChild(thead);const body=el('tbody');
 for(const p of paths){const tr=el('tr');const vals=[p.route||p.label||p.id,p.switchPortLabel,`${p.panelLabel} · P${p.patchPort}`,`${p.outletLabel} · P${p.outletPort}`,p.hostLabel,p.cableType,p.lengthM!=null?`${p.lengthM} m`:'—'];for(const v of vals)tr.appendChild(el('td','',v));if(!p.complete)tr.className='rack-path-incomplete';body.appendChild(tr);}table.appendChild(body);wrap.appendChild(table);card.appendChild(wrap);
 if(audit.issues.length){const ul=el('ul','rack-issues');audit.issues.slice(0,12).forEach(i=>ul.appendChild(el('li','',`[${i.code}] ${i.message}`)));card.appendChild(ul);}return card;
}
function bind(mount,state){mount.onclick=e=>{const a=e.target?.dataset?.action;if(!a)return;const p=state.getSnapshot();let next=p;
 if(a==='remove-cabling'){next=removeEntity(p,e.target.dataset.kind,e.target.dataset.id);state.replaceProject(next,{source:'structured-cabling-editor'});return;}
 if(a==='add-cable-panel'){const r=mount.querySelector('[data-form="cable-panel"]').elementsRef;next=addPatchPanel(p,{rackId:r.prack.value,name:r.pname.value,portCount:r.pports.value,category:r.pcat.value,rackUnit:r.pu.value});}
 if(a==='add-cable-outlet'){const r=mount.querySelector('[data-form="cable-outlet"]').elementsRef;next=addOutlet(p,{locationId:r.oloc.value,name:r.oname.value,portCount:r.oports.value,category:r.ocat.value});}
 if(a==='add-cable-run'){const r=mount.querySelector('[data-form="cable-run"]').elementsRef;next=addCableRun(p,{patchPanelId:r.rpanel.value,patchPort:r.rp.value,outletId:r.rout.value,outletPort:r.rop.value,cableType:r.rtype.value,lengthM:r.rlen.value,route:r.rroute.value});}
 if(a==='add-cable-patch'){const r=mount.querySelector('[data-form="cable-patch"]').elementsRef;next=addPatchConnection(p,{patchPanelId:r.ppanel.value,patchPort:r.pp.value,switchPortId:r.sport.value,patchCordLengthM:r.plen.value});}
 if(a==='add-cable-host'){const r=mount.querySelector('[data-form="cable-host"]').elementsRef;next=addHostOutletConnection(p,{outletId:r.hout.value,outletPort:r.hop.value,hostId:r.hhost.value,patchCordLengthM:r.hlen.value});}
 if(next!==p)state.replaceProject(syncHostAccessMirrors(next),{source:'structured-cabling-editor'});};}
function render(project){project=ensureArrays(clone(project));const wrap=el('div','nw-panel-stack');wrap.append(editor(project),inventoryCard(project),pathsCard(project));return wrap;}
function inject(){if(!root.document||!MODEL)return;const page=root.document.getElementById('pg-physical')||root.document.getElementById('pg-dev');const state=root.NetWizardState;if(!page||!state)return;let mount=root.document.getElementById('structuredCablingMount');if(!mount){mount=root.document.createElement('div');mount.id='structuredCablingMount';mount.dataset.layoutSection='full';page.appendChild(mount);}mount.textContent='';mount.appendChild(render(state.getSnapshot()));bind(mount,state);}
const api={version:'netwizard-structured-cabling-ui-v3',ensureArrays,syncHostAccessMirrors,addPatchPanel,addOutlet,addCableRun,addPatchConnection,addHostOutletConnection,removeEntity,render,inject};
root.NetWizardStructuredCablingUi=api;if(typeof module!=='undefined'&&module.exports)module.exports=api;
if(root.document){root.document.addEventListener('DOMContentLoaded',()=>setTimeout(inject,0));root.document.addEventListener('nw:project:changed',()=>setTimeout(inject,0));}
})(typeof window!=='undefined'?window:globalThis);
