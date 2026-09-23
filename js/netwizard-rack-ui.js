/* NetWizard Rack UI and editor */
(function(root){
'use strict';
const MODEL=root.NetWizardRackModel||(typeof require==='function'?require('./netwizard-rack-model.js'):null);
const arr=v=>Array.isArray(v)?v:[];
const clean=v=>String(v==null?'':v).trim();
const num=v=>{const n=Number(v);return Number.isFinite(n)?n:null;};
const clone=v=>JSON.parse(JSON.stringify(v||{}));
const uid=prefix=>`${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2,7)}`;
let selectedRackItemId='';
let rackEditorNotice='';
let suppressRackClickUntil=0;
function ensureArrays(project){for(const key of ['racks','rackItems','pdus','powerConnections'])if(!Array.isArray(project[key]))project[key]=[];return project;}
function addRack(project,input){const next=ensureArrays(clone(project));const rack={id:clean(input.id)||uid('rack'),name:clean(input.name)||'Rack sin nombre',locationId:clean(input.locationId)||null,rackUnits:Math.max(1,Math.floor(num(input.rackUnits)||42)),widthMm:num(input.widthMm),depthMm:num(input.depthMm),maxLoadKg:num(input.maxLoadKg),powerCapacityWatts:num(input.powerCapacityWatts),coolingCapacityWatts:num(input.coolingCapacityWatts),numberingDirection:input.numberingDirection==='top-down'?'top-down':'bottom-up'};next.racks.push(rack);return next;}
function syncRackItemRelations(project,item,previous){
  if(previous&&previous.deviceId&&previous.deviceId!==item.deviceId){
    const old=arr(project.devices).find(x=>x.id===previous.deviceId);
    if(old){old.rackId=null;old.rack=null;old.rackUnit=null;old.rackUnits=null;old.rackFace=null;}
  }
  if(item.deviceId){
    const d=arr(project.devices).find(x=>x.id===item.deviceId);
    if(d){d.rackId=item.rackId;d.rack=item.rackId;d.rackUnit=item.startUnit;d.rackUnits=item.heightUnits;d.rackFace=item.face;}
  }
  if(previous&&previous.patchPanelId&&previous.patchPanelId!==item.patchPanelId){
    const old=arr(project.patchPanels).find(x=>x.id===previous.patchPanelId);
    if(old){old.rackId=null;old.rackUnit=null;}
  }
  if(item.patchPanelId){
    const p=arr(project.patchPanels).find(x=>x.id===item.patchPanelId);
    if(p){p.rackId=item.rackId;p.rackUnit=item.startUnit;}
  }
}
function upsertRackItem(project,input){
  const next=ensureArrays(clone(project));if(!Array.isArray(next.patchPanels))next.patchPanels=[];
  const id=clean(input.id)||uid('rackitem'),previous=next.rackItems.find(x=>x.id===id)||null;
  const type=clean(input.type)||clean(previous&&previous.type)||'other';
  const item=Object.assign({},previous||{},{
    id,rackId:clean(input.rackId),type,
    label:clean(input.label)||clean(input.name)||clean(previous&&previous.label)||type,
    startUnit:num(input.startUnit),
    heightUnits:Math.max(1,Math.floor(num(input.heightUnits)||1)),
    face:clean(input.face)||clean(previous&&previous.face)||'front',
    mounting:clean(input.mounting)||null,
    weightKg:num(input.weightKg),
    powerDrawWatts:num(input.powerDrawWatts)
  });
  if(clean(input.deviceId)||previous&&previous.deviceId)item.deviceId=clean(input.deviceId||previous.deviceId);
  if(clean(input.patchPanelId)||previous&&previous.patchPanelId)item.patchPanelId=clean(input.patchPanelId||previous.patchPanelId);
  const index=next.rackItems.findIndex(x=>x.id===item.id);
  if(index>=0)next.rackItems[index]=item;else next.rackItems.push(item);
  syncRackItemRelations(next,item,previous);
  return next;
}
function rackItemPlacement(project,itemId,rackId,startUnit,heightOverride){
  const item=MODEL.allRackItems(project).find(x=>x.id===itemId);
  const rack=arr(project.racks).find(x=>x.id===rackId);
  if(!item||!rack)return{ok:false,message:'Elemento o rack inexistente.'};
  const start=Math.floor(num(startUnit)||0),height=Math.max(1,Math.floor(num(heightOverride)!=null?num(heightOverride):(num(item.heightUnits)||1)));
  if(start<1||start+height-1>Number(rack.rackUnits||42))return{ok:false,message:`La posición U${start} no admite ${height}U dentro de ${rack.rackUnits||42}U.`};
  const face=item.face||'front',movingUnits=new Set(Array.from({length:height},(_,i)=>start+i));
  for(const other of MODEL.allRackItems(project)){
    if(other.id===itemId||other.rackId!==rackId||(other.face||'front')!==face)continue;
    for(const u of MODEL.occupiedUnits(other))if(movingUnits.has(u))return{ok:false,message:`${item.label||item.id} colisionaría con ${other.label||other.id} en U${u}.`};
  }
  return{ok:true,startUnit:start,heightUnits:height};
}
function moveRackItem(project,itemId,rackId,startUnit){
  const check=rackItemPlacement(project,itemId,rackId,startUnit);
  if(!check.ok)return{ok:false,project:clone(project),message:check.message};
  const current=MODEL.allRackItems(project).find(x=>x.id===itemId);
  let next=ensureArrays(clone(project));if(!Array.isArray(next.patchPanels))next.patchPanels=[];
  let explicit=next.rackItems.find(x=>x.id===itemId);
  if(!explicit&&current&&current.deviceId){
    explicit=Object.assign({},current);next.rackItems.push(explicit);
  }
  if(!explicit)return{ok:false,project:next,message:'El elemento no puede editarse porque no existe en el modelo de rack.'};
  const previous=Object.assign({},explicit);
  explicit.rackId=rackId;explicit.startUnit=check.startUnit;
  syncRackItemRelations(next,explicit,previous);
  return{ok:true,project:next,item:explicit};
}

function addPdu(project,input){const next=ensureArrays(clone(project));next.pdus.push({id:clean(input.id)||uid('pdu'),rackId:clean(input.rackId),name:clean(input.name)||'PDU',feed:clean(input.feed)||'A',mounting:clean(input.mounting)||'vertical-rear',voltage:num(input.voltage)||230,maxCurrentAmps:num(input.maxCurrentAmps),maxPowerWatts:num(input.maxPowerWatts),outletCount:Math.max(1,Math.floor(num(input.outletCount)||8))});return next;}
function addPowerConnection(project,input){const next=ensureArrays(clone(project));next.powerConnections.push({id:clean(input.id)||uid('power'),deviceId:clean(input.deviceId),powerSupplyIndex:Math.max(0,Math.floor(num(input.powerSupplyIndex)||0)),pduId:clean(input.pduId),outlet:Math.max(1,Math.floor(num(input.outlet)||1)),feed:clean(input.feed)||null});return next;}
function removeEntity(project,kind,id){const next=ensureArrays(clone(project));const map={rack:'racks',rackItem:'rackItems',pdu:'pdus',powerConnection:'powerConnections'};const key=map[kind];if(!key)return next;if(kind==='rack'){const removedPduIds=new Set(next.pdus.filter(x=>x.rackId===id).map(x=>x.id));next.racks=next.racks.filter(x=>x.id!==id);next.rackItems=next.rackItems.filter(x=>x.rackId!==id);next.pdus=next.pdus.filter(x=>x.rackId!==id);next.powerConnections=next.powerConnections.filter(x=>!removedPduIds.has(x.pduId));for(const d of arr(next.devices))if((d.rackId||d.rack)===id){d.rackId=null;d.rack=null;d.rackUnit=null;d.rackUnits=null;d.rackFace=null;}return next;}next[key]=next[key].filter(x=>x.id!==id);if(kind==='pdu')next.powerConnections=next.powerConnections.filter(x=>x.pduId!==id);if(kind==='rackItem'){const removed=MODEL.allRackItems(project).find(x=>x.id===id);for(const d of arr(next.devices))if(d.id===removed?.deviceId){d.rackId=null;d.rack=null;d.rackUnit=null;d.rackUnits=null;d.rackFace=null;}for(const p of arr(next.patchPanels))if(p.id===removed?.patchPanelId){p.rackId=null;p.rackUnit=null;}}return next;}
function el(tag,cls,text){const n=document.createElement(tag);if(cls)n.className=cls;if(text!==undefined)n.textContent=String(text??'');return n;}
function field(label,node){const w=el('div','');w.append(el('label','fl',label),node);return w;}
function input(type,placeholder,value){const n=document.createElement('input');n.type=type||'text';if(placeholder)n.placeholder=placeholder;if(value!=null)n.value=value;return n;}
function select(options,value){const n=document.createElement('select');for(const [v,l] of options){const o=document.createElement('option');o.value=v;o.textContent=l;o.selected=String(v)===String(value??'');n.appendChild(o);}return n;}
function button(text,cls,action){const b=el('button',`btn ${cls||'bs'}`,text);b.type='button';if(action)b.dataset.action=action;return b;}
function ensureLayoutCss(){if(!root.document||root.document.querySelector('link[data-netwizard-layout]'))return;const link=root.document.createElement('link');link.rel='stylesheet';link.href='./css/netwizard-layout.css';link.dataset.netwizardLayout='1';root.document.head.appendChild(link);}
function rackDiagram(project,rack){
  const box=el('div','rack-diagram');box.dataset.rackId=rack.id;
  const items=MODEL.allRackItems(project).filter(x=>x.rackId===rack.id);
  for(let u=rack.rackUnits;u>=1;u--){
    const row=el('div','rack-u');row.dataset.rackId=rack.id;row.dataset.unit=String(u);row.dataset.dropRackItem='1';
    const label=el('div','rack-u-label',`U${u}`);
    const hit=items.find(i=>u>=Number(i.startUnit)&&u<Number(i.startUnit)+Number(i.heightUnits||1));
    const content=el('div',hit?'rack-u-used':'rack-u-free',hit?(hit.label||hit.name||hit.type):'Libre');
    if(hit){
      content.dataset.action='select-rack-item';content.dataset.itemId=hit.id;content.dataset.rackId=rack.id;
      content.draggable=false;content.title='Clic para editar · arrastra para cambiar de U o rack';
      if(hit.id===selectedRackItemId)content.classList.add('is-selected');
      const meta=el('small','rack-u-meta',`${hit.type||'elemento'} · ${hit.heightUnits||1}U`);
      content.appendChild(meta);
    }
    row.append(label,content);box.appendChild(row);
  }
  return box;
}
function rackTopologyView(project,rack){
  const topology=MODEL.rackTopology?MODEL.rackTopology(project,rack.id):{dataEdges:[],powerEdges:[]};
  const wrap=el('div','rack-topology');
  const data=el('section','rack-topology-group');data.appendChild(el('h4','','🌐 Datos'));
  for(const edge of arr(topology.dataEdges)){
    const row=el('div','rack-topology-edge');
    row.append(el('span','rack-topology-from',edge.fromLabel),el('span',`rack-topology-arrow ${edge.internal?'is-internal':'is-external'}`,edge.internal?'↔':'⇢'),el('span','rack-topology-to',edge.toLabel));
    const meta=el('small','rack-topology-meta',[edge.media||'medio sin documentar',edge.capacityMbps?edge.capacityMbps+' Mbps':null,edge.internal?'interno al rack':'sale del rack'].filter(Boolean).join(' · '));
    row.appendChild(meta);data.appendChild(row);
  }
  if(!arr(topology.dataEdges).length)data.appendChild(el('div','empty','No hay enlaces de datos asociados a equipos de este rack.'));
  const power=el('section','rack-topology-group');power.appendChild(el('h4','','⚡ Alimentación'));
  for(const edge of arr(topology.powerEdges)){
    const row=el('div','rack-topology-edge');
    row.append(el('span','rack-topology-from',edge.fromLabel),el('span','rack-topology-arrow is-power','→'),el('span','rack-topology-to',edge.toLabel));
    row.appendChild(el('small','rack-topology-meta',`Feed ${edge.feed||'—'}`));power.appendChild(row);
  }
  if(!arr(topology.powerEdges).length)power.appendChild(el('div','empty','No hay conexiones eléctricas asociadas a este rack.'));
  const cable=el('section','rack-topology-group');cable.appendChild(el('h4','','🧵 Cableado estructurado'));
  for(const edge of arr(topology.cablingEdges)){
    const row=el('div','rack-topology-edge');
    row.append(el('span','rack-topology-from',edge.switchPortLabel),el('span','rack-topology-arrow is-cabling','⇢'),el('span','rack-topology-to',`${edge.panelLabel} P${edge.patchPort} → ${edge.outletLabel} P${edge.outletPort} → ${edge.hostLabel}`));
    row.appendChild(el('small','rack-topology-meta',[edge.cableType,edge.lengthM!=null?edge.lengthM+' m':null,edge.route,edge.complete?'ruta completa':'ruta incompleta'].filter(Boolean).join(' · ')));cable.appendChild(row);
  }
  if(!arr(topology.cablingEdges).length)cable.appendChild(el('div','empty','No hay cableado estructurado asociado a este rack.'));
  wrap.append(data,power,cable);return wrap;
}
function editorCard(project){const card=el('div','card nw-card-wide');card.appendChild(el('div','card-t','✏️ Editor de racks y alimentación'));const tabs=el('div','rack-editor-grid');
const rackForm=el('form','rack-editor-form');rackForm.dataset.form='rack';const rackName=input('text','Rack principal');const rackUnits=input('number','42',42);rackUnits.min='1';const rackLocation=select([['','Sin ubicación'],...arr(project.physicalLocations).map(x=>[x.id,x.name||x.id])],'');const rackPower=input('number','7000');rackForm.append(field('Nombre',rackName),field('Unidades',rackUnits),field('Ubicación',rackLocation),field('Capacidad eléctrica W',rackPower),button('➕ Crear rack','bp','add-rack'));rackForm.elementsRef={rackName,rackUnits,rackLocation,rackPower};
const itemForm=el('form','rack-editor-form');itemForm.dataset.form='item';const itemRack=select(arr(project.racks).map(x=>[x.id,x.name||x.id]),'');const itemType=select([['device','Equipo'],['patch-panel','Patch panel'],['cable-manager','Pasacables'],['shelf','Bandeja'],['ups','UPS'],['blanking-panel','Panel ciego'],['other','Otro']],'device');const itemDevice=select([['','Sin equipo'],...arr(project.devices).map(x=>[x.id,x.name||x.id])],'');const itemLabel=input('text','Patch panel Cat6A');const itemStart=input('number','20');itemStart.min='1';const itemHeight=input('number','1',1);itemHeight.min='1';itemForm.append(field('Rack',itemRack),field('Tipo',itemType),field('Equipo',itemDevice),field('Etiqueta',itemLabel),field('Unidad inicial',itemStart),field('Altura U',itemHeight),button('➕ Colocar elemento','bp','add-item'));itemForm.elementsRef={itemRack,itemType,itemDevice,itemLabel,itemStart,itemHeight};
const pduForm=el('form','rack-editor-form');pduForm.dataset.form='pdu';const pduRack=select(arr(project.racks).map(x=>[x.id,x.name||x.id]),'');const pduName=input('text','PDU-A');const pduFeed=select([['A','Alimentación A'],['B','Alimentación B'],['UPS','UPS']],'A');const pduOutlets=input('number','12',12);pduOutlets.min='1';const pduPower=input('number','3680');pduForm.append(field('Rack',pduRack),field('Nombre',pduName),field('Feed',pduFeed),field('Tomas',pduOutlets),field('Potencia máxima W',pduPower),button('➕ Crear PDU','bp','add-pdu'));pduForm.elementsRef={pduRack,pduName,pduFeed,pduOutlets,pduPower};
const powerForm=el('form','rack-editor-form');powerForm.dataset.form='power';const powerDevice=select(arr(project.devices).map(x=>[x.id,x.name||x.id]),'');const powerPdu=select(arr(project.pdus).map(x=>[x.id,x.name||x.id]),'');const powerOutlet=input('number','1',1);powerOutlet.min='1';const powerPsu=input('number','0',0);powerPsu.min='0';powerForm.append(field('Equipo',powerDevice),field('PDU',powerPdu),field('Toma',powerOutlet),field('Fuente nº',powerPsu),button('🔌 Conectar alimentación','bp','add-power'));powerForm.elementsRef={powerDevice,powerPdu,powerOutlet,powerPsu};
for(const [title,form] of [['Nuevo rack',rackForm],['Elemento de rack',itemForm],['PDU / regleta',pduForm],['Conexión eléctrica',powerForm]]){const group=el('section','rack-editor-group');group.append(el('h3','',title),form);tabs.appendChild(group);}card.appendChild(tabs);return card;}
function selectedItemEditor(project){
  const item=MODEL.allRackItems(project).find(x=>x.id===selectedRackItemId);
  const card=el('div','card nw-card-wide rack-selected-editor');
  const title=el('div','card-h');title.append(el('div','card-t','🎛 Elemento seleccionado'));
  if(!item){card.append(title,el('p','hint','Haz clic en un elemento del rack para cargar sus propiedades. También puedes arrastrarlo directamente a otra U.'));return card;}
  title.appendChild(el('span','b bac',item.type||'elemento'));card.appendChild(title);
  if(rackEditorNotice)card.appendChild(el('div','co co-yw',rackEditorNotice));
  const form=el('form','rack-editor-form rack-selected-form');form.dataset.form='selected-item';form.dataset.itemId=item.id;
  const rack=select(arr(project.racks).map(x=>[x.id,x.name||x.id]),item.rackId);
  const label=input('text','Etiqueta',item.label||item.name||'');
  const start=input('number','U',item.startUnit);start.min='1';
  const height=input('number','Altura U',item.heightUnits||1);height.min='1';
  const face=select([['front','Frontal'],['rear','Trasera']],item.face||'front');
  const mounting=input('text','Montaje',item.mounting||'');
  const weight=input('number','Peso kg',item.weightKg);weight.min='0';weight.step='0.1';
  const power=input('number','Consumo W',item.powerDrawWatts);power.min='0';power.step='0.1';
  form.append(
    field('Rack',rack),field('Etiqueta',label),field('Unidad inicial',start),field('Altura U',height),
    field('Cara',face),field('Montaje',mounting),field('Peso kg',weight),field('Consumo W',power)
  );
  const actions=el('div','rack-selected-actions');
  const save=button('💾 Guardar cambios','bp','update-selected-item');save.dataset.id=item.id;
  const remove=button('🗑 Eliminar del rack','bd','remove-rack-item');remove.dataset.id=item.id;
  actions.append(save,remove);form.appendChild(actions);form.elementsRef={rack,label,start,height,face,mounting,weight,power};
  const relation=[];
  if(item.deviceId)relation.push('Equipo: '+(arr(project.devices).find(x=>x.id===item.deviceId)?.name||item.deviceId));
  if(item.patchPanelId)relation.push('Patch panel: '+(arr(project.patchPanels).find(x=>x.id===item.patchPanelId)?.name||item.patchPanelId));
  if(relation.length)card.appendChild(el('p','hint',relation.join(' · ')+' · Las conexiones se conservan al moverlo.'));
  card.appendChild(form);return card;
}
function summaryCard(project,rack,validation){const card=el('div','card');const h=el('div','card-h');h.append(el('div','card-t',`🗄 ${rack.name||rack.id}`),el('span','b bac',`${rack.rackUnits}U`));const del=button('Eliminar','bd bxs','remove-rack');del.dataset.id=rack.id;h.appendChild(del);card.appendChild(h);const loc=arr(project.physicalLocations).find(x=>x.id===rack.locationId);card.appendChild(el('div','hint',`${loc?loc.name:'Ubicación no definida'} · ${rack.widthMm||'—'}×${rack.depthMm||'—'} mm`));const grid=el('div','g2 nw-grid-adaptive');grid.appendChild(rackDiagram(project,rack));const details=el('div','nw-panel-stack');const issues=arr(validation.issues).filter(i=>i.rackId===rack.id);const items=MODEL.allRackItems(project).filter(i=>i.rackId===rack.id);const used=new Set();items.forEach(i=>{for(let u=Number(i.startUnit);u<Number(i.startUnit)+Number(i.heightUnits||1);u++)used.add(u);});details.append(el('p','',`Ocupación: ${used.size}/${rack.rackUnits}U`),el('p','',`Elementos: ${items.length}`),el('p','',`Incidencias: ${issues.length}`));const pdus=arr(project.pdus).filter(x=>x.rackId===rack.id);details.appendChild(el('p','',`PDU/regletas: ${pdus.length}`));for(const pdu of pdus){const line=el('div','rack-list-row');line.append(el('span','',`${pdu.name||pdu.id} · ${pdu.outletCount||0} tomas · feed ${pdu.feed||'—'}`));const b=button('Quitar','bd bxs','remove-pdu');b.dataset.id=pdu.id;line.appendChild(b);details.appendChild(line);}if(issues.length){const ul=el('ul','rack-issues');issues.slice(0,8).forEach(i=>ul.appendChild(el('li','',i.message)));details.appendChild(ul);}grid.append(details);card.appendChild(grid);card.appendChild(rackTopologyView(project,rack));return card;}
function connectionsCard(project){const card=el('div','card nw-card-wide');card.appendChild(el('div','card-t','🔌 Conexiones de alimentación'));const list=el('div','nw-panel-stack');for(const c of arr(project.powerConnections)){const d=arr(project.devices).find(x=>x.id===c.deviceId),p=arr(project.pdus).find(x=>x.id===c.pduId);const row=el('div','rack-list-row');row.appendChild(el('span','',`${d?.name||c.deviceId||'Equipo'} PSU-${Number(c.powerSupplyIndex||0)+1} → ${p?.name||c.pduId||'PDU'} / toma ${c.outlet||'—'}`));const b=button('Quitar','bd bxs','remove-power');b.dataset.id=c.id;row.appendChild(b);list.appendChild(row);}if(!arr(project.powerConnections).length)list.appendChild(el('div','empty','No hay conexiones eléctricas definidas.'));card.appendChild(list);return card;}
function render(project){ensureLayoutCss();project=ensureArrays(clone(project));const wrap=el('div','nw-panel-stack');const validation=MODEL.validate(project);const head=el('div','card nw-card-wide');const hh=el('div','card-h');hh.append(el('div','card-t','🗄 Racks, alimentación y material pasivo'),el('span',`b ${validation.ok?'bgn':'brd'}`,validation.ok?'Sin bloqueos':`${validation.issues.length} incidencias`));head.appendChild(hh);head.appendChild(el('p','hint','Crea racks, coloca equipos y material pasivo por unidades, define PDU y conecta fuentes de alimentación.'));wrap.append(head,editorCard(project),selectedItemEditor(project));if(validation.racks.length){const rackGrid=el('div','nw-card-grid');validation.racks.forEach(r=>rackGrid.appendChild(summaryCard(project,r,validation)));wrap.appendChild(rackGrid);}else wrap.appendChild(el('div','co co-yw','No hay racks definidos. Usa el editor para crear el primero.'));wrap.appendChild(connectionsCard(project));const bom=MODEL.billOfMaterials(project);const card=el('div','card nw-card-wide');card.appendChild(el('div','card-t','📦 Materiales de rack'));const ul=el('ul','');bom.forEach(x=>ul.appendChild(el('li','',`${x.quantity} × ${x.description||x.label||x.name||x.kind||x.type||'Material'}`)));if(!bom.length)ul.appendChild(el('li','empty','No hay materiales definidos.'));card.appendChild(ul);wrap.appendChild(card);return wrap;}
function rerenderMount(mount,state){
  mount.textContent='';mount.appendChild(render(state.getSnapshot()));bind(mount,state);
}
function bind(mount,state){
  mount.onclick=e=>{
    const actionNode=e.target&&e.target.closest&&e.target.closest('[data-action]');const action=actionNode&&actionNode.dataset.action;if(!action)return;
    if(action==='select-rack-item'){
      if(Date.now()<suppressRackClickUntil)return;
      selectedRackItemId=actionNode.dataset.itemId||'';rackEditorNotice='';rerenderMount(mount,state);return;
    }
    const snapshot=state.getSnapshot();let next=snapshot;
    if(action==='add-rack'){const f=mount.querySelector('[data-form="rack"]');const r=f.elementsRef;next=addRack(snapshot,{name:r.rackName.value,rackUnits:r.rackUnits.value,locationId:r.rackLocation.value,powerCapacityWatts:r.rackPower.value});}
    if(action==='add-item'){const f=mount.querySelector('[data-form="item"]');const r=f.elementsRef;next=upsertRackItem(snapshot,{rackId:r.itemRack.value,type:r.itemType.value,deviceId:r.itemDevice.value,label:r.itemLabel.value,startUnit:r.itemStart.value,heightUnits:r.itemHeight.value});}
    if(action==='add-pdu'){const f=mount.querySelector('[data-form="pdu"]');const r=f.elementsRef;next=addPdu(snapshot,{rackId:r.pduRack.value,name:r.pduName.value,feed:r.pduFeed.value,outletCount:r.pduOutlets.value,maxPowerWatts:r.pduPower.value});}
    if(action==='add-power'){const f=mount.querySelector('[data-form="power"]');const r=f.elementsRef;const pdu=arr(snapshot.pdus).find(x=>x.id===r.powerPdu.value);next=addPowerConnection(snapshot,{deviceId:r.powerDevice.value,pduId:r.powerPdu.value,outlet:r.powerOutlet.value,powerSupplyIndex:r.powerPsu.value,feed:pdu&&pdu.feed});}
    if(action==='update-selected-item'){
      const form=mount.querySelector('[data-form="selected-item"]'),r=form&&form.elementsRef,item=MODEL.allRackItems(snapshot).find(x=>x.id===actionNode.dataset.id);
      if(r&&item){
        const placement=rackItemPlacement(snapshot,item.id,r.rack.value,r.start.value,r.height.value);
        if(!placement.ok){rackEditorNotice=placement.message;rerenderMount(mount,state);return;}
        next=upsertRackItem(snapshot,{
          id:item.id,rackId:r.rack.value,type:item.type,deviceId:item.deviceId,patchPanelId:item.patchPanelId,
          label:r.label.value,startUnit:r.start.value,heightUnits:r.height.value,face:r.face.value,mounting:r.mounting.value,
          weightKg:r.weight.value,powerDrawWatts:r.power.value
        });
        const audit=MODEL.validate(next),blocking=arr(audit.issues).find(i=>i.rackItemId===item.id&&i.blocking);
        if(blocking){rackEditorNotice=blocking.message;rerenderMount(mount,state);return;}
        selectedRackItemId=item.id;rackEditorNotice='Cambios guardados. Las referencias de cableado y equipo se han conservado.';
      }
    }
    if(action==='remove-rack-item'){
      selectedRackItemId='';rackEditorNotice='';next=removeEntity(snapshot,'rackItem',actionNode.dataset.id);
    }
    if(action==='remove-rack')next=removeEntity(snapshot,'rack',actionNode.dataset.id);
    if(action==='remove-pdu')next=removeEntity(snapshot,'pdu',actionNode.dataset.id);
    if(action==='remove-power')next=removeEntity(snapshot,'powerConnection',actionNode.dataset.id);
    if(next!==snapshot)state.replaceProject(next,{source:'rack-editor'});
  };
  for(const node of mount.querySelectorAll('[data-item-id]')){
    let pointer=null;
    const clearTargets=()=>mount.querySelectorAll('.rack-u.is-drop-target').forEach(x=>x.classList.remove('is-drop-target'));
    node.onpointerdown=e=>{
      if(e.button!==0)return;
      pointer={id:e.pointerId,x:e.clientX,y:e.clientY,dragging:false};
      selectedRackItemId=node.dataset.itemId||'';rackEditorNotice='';
      try{node.setPointerCapture(e.pointerId);}catch(_){}
    };
    node.onpointermove=e=>{
      if(!pointer||pointer.id!==e.pointerId)return;
      if(!pointer.dragging&&Math.hypot(e.clientX-pointer.x,e.clientY-pointer.y)>=5){
        pointer.dragging=true;node.classList.add('is-dragging');
      }
      if(!pointer.dragging)return;
      e.preventDefault();clearTargets();
      const hit=root.document.elementFromPoint(e.clientX,e.clientY);
      const row=hit&&hit.closest&&hit.closest('[data-drop-rack-item="1"]');
      if(row)row.classList.add('is-drop-target');
    };
    const finishPointer=e=>{
      if(!pointer||pointer.id!==e.pointerId)return;
      const wasDragging=pointer.dragging;pointer=null;
      try{node.releasePointerCapture(e.pointerId);}catch(_){}
      node.classList.remove('is-dragging');
      const hit=root.document.elementFromPoint(e.clientX,e.clientY);
      const row=hit&&hit.closest&&hit.closest('[data-drop-rack-item="1"]');
      clearTargets();
      if(!wasDragging||!row)return;
      e.preventDefault();suppressRackClickUntil=Date.now()+300;
      const id=node.dataset.itemId||selectedRackItemId;if(!id)return;
      const result=moveRackItem(state.getSnapshot(),id,row.dataset.rackId,Number(row.dataset.unit));
      selectedRackItemId=id;
      if(!result.ok){rackEditorNotice=result.message;rerenderMount(mount,state);return;}
      rackEditorNotice=`Movido a ${arr(result.project.racks).find(x=>x.id===row.dataset.rackId)?.name||row.dataset.rackId} · U${row.dataset.unit}. Cableado y referencias conservados.`;
      state.replaceProject(result.project,{source:'rack-pointer-drag'});
    };
    node.onpointerup=finishPointer;
    node.onpointercancel=e=>{
      if(pointer&&pointer.id===e.pointerId)pointer=null;
      node.classList.remove('is-dragging');clearTargets();
    };
  }
}
function inject(){if(!root.document||!MODEL)return;ensureLayoutCss();const page=root.document.getElementById('pg-physical')||root.document.getElementById('pg-dev')||root.document.getElementById('pg-dash');const state=root.NetWizardState;if(!page||!state||typeof state.getSnapshot!=='function')return;let mount=root.document.getElementById('rackPlannerMount');if(!mount){mount=root.document.createElement('div');mount.id='rackPlannerMount';mount.dataset.layoutSection='full';page.appendChild(mount);}mount.textContent='';mount.appendChild(render(state.getSnapshot()));bind(mount,state);}
const api={version:'netwizard-rack-ui-v6',render,inject,ensureLayoutCss,ensureArrays,addRack,upsertRackItem,rackItemPlacement,moveRackItem,addPdu,addPowerConnection,removeEntity};root.NetWizardRackUi=api;if(typeof module!=='undefined'&&module.exports)module.exports=api;if(root.document){root.document.addEventListener('DOMContentLoaded',()=>setTimeout(inject,0));root.document.addEventListener('nw:project:changed',()=>setTimeout(inject,0));}
})(typeof window!=='undefined'?window:globalThis);