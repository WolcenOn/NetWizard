/* NetWizard Rack UI and editor */
(function(root){
'use strict';
const MODEL=root.NetWizardRackModel||(typeof require==='function'?require('./netwizard-rack-model.js'):null);
const arr=v=>Array.isArray(v)?v:[];
const clean=v=>String(v==null?'':v).trim();
function tr(key,params,fallback){const i=root.NetWizardI18n;if(i&&typeof i.t==='function'){const v=i.t(key,params||{});if(v!==key)return v;}return String(fallback||key).replace(/\{([A-Za-z0-9_.-]+)\}/g,(_,k)=>Object.prototype.hasOwnProperty.call(params||{},k)?String(params[k]):'');}
const num=v=>{const n=Number(v);return Number.isFinite(n)?n:null;};
const optionalNum=v=>clean(v)===''?null:num(v);
const nonNegativeOptional=v=>{const n=optionalNum(v);return n==null?null:(n>=0?n:null);};
const clone=v=>JSON.parse(JSON.stringify(v||{}));
const uid=prefix=>`${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2,7)}`;
let selectedRackItemId='';
let selectedRackId='';
let rackEditorNotice='';
let selectedRackNotice='';
let rackLayoutPreview=null;
let suppressRackClickUntil=0;
function ensureArrays(project){for(const key of ['racks','rackItems','pdus','powerConnections'])if(!Array.isArray(project[key]))project[key]=[];return project;}
function addRack(project,input){const next=ensureArrays(clone(project));const requested=Math.floor(num(input.rackUnits)||42);const rack={id:clean(input.id)||uid('rack'),name:clean(input.name)||tr('rack.defaultName',{},'Rack sin nombre'),locationId:clean(input.locationId)||null,rackUnits:Math.max(1,Math.min(100,requested)),widthMm:nonNegativeOptional(input.widthMm),depthMm:nonNegativeOptional(input.depthMm),maxLoadKg:nonNegativeOptional(input.maxLoadKg),powerCapacityWatts:nonNegativeOptional(input.powerCapacityWatts),coolingCapacityWatts:nonNegativeOptional(input.coolingCapacityWatts),numberingDirection:input.numberingDirection==='top-down'?'top-down':'bottom-up'};next.racks.push(rack);return next;}
function updateRack(project,rackId,input){
  const next=ensureArrays(clone(project)),rack=next.racks.find(x=>x.id===rackId);
  if(!rack)return{ok:false,project:next,message:tr('rack.error.missing',{},'Rack inexistente.')};
  const rawUnits=clean(input.rackUnits)===''?Number(rack.rackUnits||42):num(input.rackUnits);
  const requestedUnits=Math.floor(rawUnits==null?0:rawUnits);
  const resize=MODEL.validateRackResize?MODEL.validateRackResize(project,rackId,requestedUnits):{ok:requestedUnits>=1,message:tr('rack.error.minUnits',{},'La altura del rack debe ser al menos 1U.')};
  if(!resize.ok)return{ok:false,project:clone(project),message:resize.message,resize};
  const numericFields=[
    ['widthMm',input.widthMm],['depthMm',input.depthMm],['maxLoadKg',input.maxLoadKg],
    ['powerCapacityWatts',input.powerCapacityWatts],['coolingCapacityWatts',input.coolingCapacityWatts]
  ];
  for(const [key,value] of numericFields){
    const parsed=optionalNum(value);
    if(parsed!=null&&parsed<0)return{ok:false,project:clone(project),message:tr('rack.error.nonNegative',{field:key},'{field} no puede ser negativo.'),resize};
  }
  Object.assign(rack,{
    name:clean(input.name)||rack.name||tr('rack.defaultName',{},'Rack sin nombre'),
    locationId:clean(input.locationId)||null,
    rackUnits:requestedUnits,
    widthMm:nonNegativeOptional(input.widthMm),
    depthMm:nonNegativeOptional(input.depthMm),
    maxLoadKg:nonNegativeOptional(input.maxLoadKg),
    powerCapacityWatts:nonNegativeOptional(input.powerCapacityWatts),
    coolingCapacityWatts:nonNegativeOptional(input.coolingCapacityWatts),
    numberingDirection:input.numberingDirection==='top-down'?'top-down':'bottom-up'
  });
  return{ok:true,project:next,rack:Object.assign({},rack),resize};
}
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
  if(!item||!rack)return{ok:false,message:tr('rack.error.itemOrRackMissing',{},'Elemento o rack inexistente.')};
  const start=Math.floor(num(startUnit)||0),height=Math.max(1,Math.floor(num(heightOverride)!=null?num(heightOverride):(num(item.heightUnits)||1)));
  if(start<1||start+height-1>Number(rack.rackUnits||42))return{ok:false,message:tr('rack.error.positionOutOfRange',{start,height,max:rack.rackUnits||42},'La posición U{start} no admite {height}U dentro de {max}U.')};
  const face=item.face||'front',movingUnits=new Set(Array.from({length:height},(_,i)=>start+i));
  for(const other of MODEL.allRackItems(project)){
    if(other.id===itemId||other.rackId!==rackId||(other.face||'front')!==face)continue;
    for(const u of MODEL.occupiedUnits(other))if(movingUnits.has(u))return{ok:false,message:tr('rack.error.placementCollision',{item:item.label||item.id,other:other.label||other.id,unit:u},'{item} colisionaría con {other} en U{unit}.')};
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
  if(!explicit)return{ok:false,project:next,message:tr('rack.error.itemNotEditable',{},'El elemento no puede editarse porque no existe en el modelo de rack.')};
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
    const content=el('div',hit?'rack-u-used':'rack-u-free',hit?(hit.label||hit.name||hit.type):tr('rack.diagram.free',{},'Libre'));
    if(hit){
      row.dataset.action='select-rack-item';row.dataset.itemId=hit.id;row.dataset.dragRackItem='1';
      row.title=tr('rack.diagram.dragHint',{},'Clic para editar · arrastra la fila completa para cambiar de U o rack');
      content.dataset.action='select-rack-item';content.dataset.itemId=hit.id;content.dataset.rackId=rack.id;
      content.draggable=false;content.title=tr('rack.diagram.dragHintShort',{},'Clic para editar · arrastra para cambiar de U o rack');
      if(hit.id===selectedRackItemId)content.classList.add('is-selected');
      const meta=el('small','rack-u-meta',tr('rack.diagram.meta',{type:hit.type||tr('rack.common.item',{},'elemento'),height:hit.heightUnits||1},'{type} · {height}U'));
      content.appendChild(meta);
    }
    row.append(label,content);box.appendChild(row);
  }
  return box;
}
function rackTopologyView(project,rack){
  const topology=MODEL.rackTopology?MODEL.rackTopology(project,rack.id):{dataEdges:[],powerEdges:[]};
  const wrap=el('div','rack-topology');
  const data=el('section','rack-topology-group');data.appendChild(el('h4','',tr('rack.topology.dataTitle',{},'🌐 Datos')));
  for(const edge of arr(topology.dataEdges)){
    const row=el('div','rack-topology-edge');
    row.append(el('span','rack-topology-from',edge.fromLabel),el('span',`rack-topology-arrow ${edge.internal?'is-internal':'is-external'}`,edge.internal?'↔':'⇢'),el('span','rack-topology-to',edge.toLabel));
    const meta=el('small','rack-topology-meta',[edge.media||tr('rack.topology.mediaUnknown',{},'medio sin documentar'),edge.capacityMbps?edge.capacityMbps+' Mbps':null,edge.internal?tr('rack.topology.internal',{},'interno al rack'):tr('rack.topology.external',{},'sale del rack')].filter(Boolean).join(' · '));
    row.appendChild(meta);data.appendChild(row);
  }
  if(!arr(topology.dataEdges).length)data.appendChild(el('div','empty',tr('rack.topology.noData',{},'No hay enlaces de datos asociados a equipos de este rack.')));
  const power=el('section','rack-topology-group');power.appendChild(el('h4','',tr('rack.topology.powerTitle',{},'⚡ Alimentación')));
  for(const edge of arr(topology.powerEdges)){
    const row=el('div','rack-topology-edge');
    row.append(el('span','rack-topology-from',edge.fromLabel),el('span','rack-topology-arrow is-power','→'),el('span','rack-topology-to',edge.toLabel));
    row.appendChild(el('small','rack-topology-meta',tr('rack.topology.feed',{feed:edge.feed||'—'},'Feed {feed}')));power.appendChild(row);
  }
  if(!arr(topology.powerEdges).length)power.appendChild(el('div','empty',tr('rack.topology.noPower',{},'No hay conexiones eléctricas asociadas a este rack.')));
  const cable=el('section','rack-topology-group');cable.appendChild(el('h4','',tr('rack.topology.cablingTitle',{},'🧵 Cableado estructurado')));
  for(const edge of arr(topology.cablingEdges)){
    const row=el('div','rack-topology-edge');
    row.append(el('span','rack-topology-from',edge.switchPortLabel),el('span','rack-topology-arrow is-cabling','⇢'),el('span','rack-topology-to',`${edge.panelLabel} P${edge.patchPort} → ${edge.outletLabel} P${edge.outletPort} → ${edge.hostLabel}`));
    row.appendChild(el('small','rack-topology-meta',[edge.cableType,edge.lengthM!=null?edge.lengthM+' m':null,edge.route,edge.complete?tr('rack.topology.routeComplete',{},'ruta completa'):tr('rack.topology.routeIncomplete',{},'ruta incompleta')].filter(Boolean).join(' · ')));cable.appendChild(row);
  }
  if(!arr(topology.cablingEdges).length)cable.appendChild(el('div','empty',tr('rack.topology.noCabling',{},'No hay cableado estructurado asociado a este rack.')));
  wrap.append(data,power,cable);return wrap;
}
function editorCard(project){const card=el('div','card nw-card-wide');card.appendChild(el('div','card-t',tr('rack.editor.title',{},'✏️ Editor de racks y alimentación')));const tabs=el('div','rack-editor-grid');
const rackForm=el('form','rack-editor-form');rackForm.dataset.form='rack';const rackName=input('text',tr('rack.editor.mainRackPlaceholder',{},'Rack principal'));const rackUnits=input('number','42',42);rackUnits.min='1';rackUnits.max='100';const rackLocation=select([['',tr('rack.common.noLocation',{},'Sin ubicación')],...arr(project.physicalLocations).map(x=>[x.id,x.name||x.id])],'');const rackPower=input('number','7000');rackForm.append(field(tr('form.name',{},'Nombre'),rackName),field(tr('rack.field.units',{},'Unidades'),rackUnits),field(tr('rack.field.location',{},'Ubicación'),rackLocation),field(tr('rack.field.powerCapacity',{},'Capacidad eléctrica W'),rackPower),button(tr('rack.actions.createRack',{},'➕ Crear rack'),'bp','add-rack'));rackForm.elementsRef={rackName,rackUnits,rackLocation,rackPower};
const itemForm=el('form','rack-editor-form');itemForm.dataset.form='item';const itemRack=select(arr(project.racks).map(x=>[x.id,x.name||x.id]),'');const itemType=select([['device',tr('rack.item.device',{},'Equipo')],['patch-panel',tr('rack.item.patchPanel',{},'Patch panel')],['cable-manager',tr('rack.item.cableManager',{},'Pasacables')],['shelf',tr('rack.item.shelf',{},'Bandeja')],['ups','UPS'],['blanking-panel',tr('rack.item.blankingPanel',{},'Panel ciego')],['other',tr('rack.item.other',{},'Otro')]],'device');const itemDevice=select([['',tr('rack.common.noDevice',{},'Sin equipo')],...arr(project.devices).map(x=>[x.id,x.name||x.id])],'');const itemLabel=input('text','Patch panel Cat6A');const itemStart=input('number','20');itemStart.min='1';const itemHeight=input('number','1',1);itemHeight.min='1';itemForm.append(field('Rack',itemRack),field(tr('form.type',{},'Tipo'),itemType),field(tr('rack.field.device',{},'Equipo'),itemDevice),field(tr('rack.field.label',{},'Etiqueta'),itemLabel),field(tr('rack.field.startUnit',{},'Unidad inicial'),itemStart),field(tr('rack.field.heightUnits',{},'Altura U'),itemHeight),button(tr('rack.actions.placeItem',{},'➕ Colocar elemento'),'bp','add-item'));itemForm.elementsRef={itemRack,itemType,itemDevice,itemLabel,itemStart,itemHeight};
const pduForm=el('form','rack-editor-form');pduForm.dataset.form='pdu';const pduRack=select(arr(project.racks).map(x=>[x.id,x.name||x.id]),'');const pduName=input('text','PDU-A');const pduFeed=select([['A',tr('rack.power.feedA',{},'Alimentación A')],['B',tr('rack.power.feedB',{},'Alimentación B')],['UPS','UPS']],'A');const pduOutlets=input('number','12',12);pduOutlets.min='1';const pduPower=input('number','3680');pduForm.append(field('Rack',pduRack),field(tr('form.name',{},'Nombre'),pduName),field('Feed',pduFeed),field(tr('rack.field.outlets',{},'Tomas'),pduOutlets),field(tr('rack.field.maxPower',{},'Potencia máxima W'),pduPower),button(tr('rack.actions.createPdu',{},'➕ Crear PDU'),'bp','add-pdu'));pduForm.elementsRef={pduRack,pduName,pduFeed,pduOutlets,pduPower};
const powerForm=el('form','rack-editor-form');powerForm.dataset.form='power';const powerDevice=select(arr(project.devices).map(x=>[x.id,x.name||x.id]),'');const powerPdu=select(arr(project.pdus).map(x=>[x.id,x.name||x.id]),'');const powerOutlet=input('number','1',1);powerOutlet.min='1';const powerPsu=input('number','0',0);powerPsu.min='0';powerForm.append(field(tr('rack.field.device',{},'Equipo'),powerDevice),field('PDU',powerPdu),field(tr('rack.field.outlet',{},'Toma'),powerOutlet),field(tr('rack.field.psuNumber',{},'Fuente nº'),powerPsu),button(tr('rack.actions.connectPower',{},'🔌 Conectar alimentación'),'bp','add-power'));powerForm.elementsRef={powerDevice,powerPdu,powerOutlet,powerPsu};
for(const [title,form] of [[tr('rack.editor.newRack',{},'Nuevo rack'),rackForm],[tr('rack.editor.rackItem',{},'Elemento de rack'),itemForm],[tr('rack.editor.pduStrip',{},'PDU / regleta'),pduForm],[tr('rack.editor.powerConnection',{},'Conexión eléctrica'),powerForm]]){const group=el('section','rack-editor-group');group.append(el('h3','',title),form);tabs.appendChild(group);}card.appendChild(tabs);return card;}

function rackLayoutPreviewCard(project){
  if(!rackLayoutPreview||!MODEL||typeof MODEL.planRackAutoLayout!=='function')return null;
  const plan=MODEL.planRackAutoLayout(project,rackLayoutPreview.rackId,rackLayoutPreview.options||{});
  const rack=arr(project.racks).find(x=>x.id===rackLayoutPreview.rackId);
  const card=el('div','card nw-card-wide rack-layout-preview');card.dataset.rackLayoutPreview=plan.rackId||'';
  const head=el('div','card-h');head.append(el('div','card-t',tr('rack.auto.previewTitle',{},'✨ Vista previa de organización')),el('span','b bac',rack&&rack.name||plan.rackId||'Rack'));card.appendChild(head);
  card.appendChild(el('p','hint',tr('rack.auto.previewHint',{},'Solo se moverán switches y elementos de cableado seleccionados por el planner. El resto del rack permanece fijo.')));
  if(!plan.ok){
    card.appendChild(el('div','co co-yw',plan.message||tr('rack.auto.previewUnavailable',{},'No se puede generar una organización automática.')));
    const actions=el('div','rack-selected-actions');actions.appendChild(button(tr('actions.close',{},'Cerrar'),'bs','cancel-rack-layout'));card.appendChild(actions);return card;
  }
  const policyLabel=plan.policy.layoutPattern==='patch-manager-switch'?tr('rack.auto.patternManaged',{},'patch panel → organizador → switch'):tr('rack.auto.patternCompact',{},'patch panel → switch');
  card.appendChild(el('p','',
    tr('rack.auto.previewSummary',{pattern:policyLabel,switches:plan.summary.switches,panels:plan.summary.panels,managers:plan.summary.managers},'Patrón: {pattern} · {switches} switch(es) · {panels} patch panel(es) · {managers} organizador(es).')
  ));
  const list=el('div','nw-panel-stack');
  for(const cluster of plan.clusters){
    const row=el('div','rack-list-row rack-layout-preview-row');
    const sequence=[];
    cluster.panels.forEach(x=>sequence.push(x.label+' U'+x.startUnit));
    if(cluster.manager)sequence.push(cluster.manager.label+' U'+cluster.manager.startUnit);
    let switchLabel=cluster.switchName+' U'+cluster.switchStartUnit;
    if(cluster.switchHeight>1)switchLabel+='-U'+(cluster.switchStartUnit+cluster.switchHeight-1);
    sequence.push(switchLabel);
    row.append(el('span','',sequence.join(' → ')));list.appendChild(row);
  }
  card.appendChild(list);
  if(plan.warnings&&plan.warnings.length){
    const warnings=el('ul','rack-issues');plan.warnings.forEach(x=>warnings.appendChild(el('li','',x)));card.appendChild(warnings);
  }
  card.appendChild(el('p','hint',
    tr('rack.auto.previewCreate',{panels:plan.summary.createPanels,items:plan.summary.createItems,maxUnit:plan.proposedMaxUnit},'Se crearán {panels} patch panel(es) y {items} elemento(s) de rack nuevos. U más alta tras organizar: {maxUnit}.')
  ));
  const actions=el('div','rack-selected-actions');
  const apply=button(tr('rack.actions.applyLayout',{},'✅ Aplicar organización'),'bp','apply-rack-layout');apply.dataset.id=plan.rackId;
  const cancel=button(tr('actions.cancel',{},'Cancelar'),'bs','cancel-rack-layout');
  actions.append(apply,cancel);card.appendChild(actions);return card;
}
function selectedRackEditor(project){
  const rack=arr(project.racks).find(x=>x.id===selectedRackId);
  if(!rack)return null;
  const card=el('div','card nw-card-wide rack-selected-editor');
  const title=el('div','card-h');title.append(el('div','card-t',tr('rack.edit.title',{},'🗄 Editar rack')),el('span','b bac',rack.name||rack.id));card.appendChild(title);
  if(selectedRackNotice)card.appendChild(el('div','co co-yw',selectedRackNotice));
  const occupancy=MODEL.rackOccupancy?MODEL.rackOccupancy(project,rack.id):{usedCount:0,maxUsedUnit:0};
  const recommendation=MODEL.recommendedRackUnits?MODEL.recommendedRackUnits(project,rack.id):{recommendedUnits:rack.rackUnits};
  card.appendChild(el('p','hint',tr('rack.edit.occupancy',{used:occupancy.usedCount||0,max:occupancy.maxUsedUnit||0,recommended:recommendation.recommendedUnits},'Ocupación actual: {used}U · U más alta ocupada: {max} · Tamaño recomendado con reserva: {recommended}U.')));
  const form=el('form','rack-editor-form rack-selected-form');form.dataset.form='selected-rack';form.dataset.rackId=rack.id;
  const name=input('text',tr('rack.editor.mainRackPlaceholder',{},'Rack principal'),rack.name||'');
  const units=input('number','42',rack.rackUnits||42);units.min='1';units.max='100';
  const location=select([['',tr('rack.common.noLocation',{},'Sin ubicación')],...arr(project.physicalLocations).map(x=>[x.id,x.name||x.id])],rack.locationId||'');
  const width=input('number','600',rack.widthMm);width.min='0';
  const depth=input('number','1000',rack.depthMm);depth.min='0';
  const load=input('number','800',rack.maxLoadKg);load.min='0';load.step='0.1';
  const power=input('number','7000',rack.powerCapacityWatts);power.min='0';
  const cooling=input('number','5000',rack.coolingCapacityWatts);cooling.min='0';
  const numbering=select([['bottom-up',tr('rack.numbering.bottomUp',{},'Numeración ascendente desde abajo')],['top-down',tr('rack.numbering.topDown',{},'Numeración descendente desde arriba')]],rack.numberingDirection||'bottom-up');
  form.append(field(tr('form.name',{},'Nombre'),name),field(tr('rack.field.units',{},'Unidades'),units),field(tr('rack.field.location',{},'Ubicación'),location),field(tr('rack.field.width',{},'Ancho mm'),width),field(tr('rack.field.depth',{},'Profundidad mm'),depth),field(tr('rack.field.maxLoad',{},'Carga máxima kg'),load),field(tr('rack.field.powerCapacity',{},'Capacidad eléctrica W'),power),field(tr('rack.field.cooling',{},'Refrigeración W'),cooling),field(tr('rack.field.numbering',{},'Numeración'),numbering));
  const actions=el('div','rack-selected-actions');
  const recommended=button(tr('rack.actions.useRecommended',{units:recommendation.recommendedUnits},'↕ Usar {units}U recomendadas'),'bs','use-recommended-rack-units');recommended.dataset.units=String(recommendation.recommendedUnits);
  const save=button(tr('rack.actions.saveRack',{},'💾 Guardar rack'),'bp','update-selected-rack');save.dataset.id=rack.id;
  const cancel=button(tr('actions.cancel',{},'Cancelar'),'bs','cancel-rack-edit');
  actions.append(recommended,save,cancel);form.appendChild(actions);
  form.elementsRef={name,units,location,width,depth,load,power,cooling,numbering};
  card.appendChild(form);return card;
}
function selectedItemEditor(project){
  const item=MODEL.allRackItems(project).find(x=>x.id===selectedRackItemId);
  const card=el('div','card nw-card-wide rack-selected-editor');
  const title=el('div','card-h');title.append(el('div','card-t',tr('rack.itemEditor.title',{},'🎛 Elemento seleccionado')));
  if(!item){card.append(title,el('p','hint',tr('rack.itemEditor.hint',{},'Haz clic en un elemento del rack para cargar sus propiedades. También puedes arrastrarlo directamente a otra U.')));return card;}
  title.appendChild(el('span','b bac',item.type||tr('rack.common.item',{},'elemento')));card.appendChild(title);
  if(rackEditorNotice)card.appendChild(el('div','co co-yw',rackEditorNotice));
  const form=el('form','rack-editor-form rack-selected-form');form.dataset.form='selected-item';form.dataset.itemId=item.id;
  const rack=select(arr(project.racks).map(x=>[x.id,x.name||x.id]),item.rackId);
  const label=input('text',tr('rack.field.label',{},'Etiqueta'),item.label||item.name||'');
  const start=input('number','U',item.startUnit);start.min='1';
  const height=input('number',tr('rack.field.heightUnits',{},'Altura U'),item.heightUnits||1);height.min='1';
  const face=select([['front',tr('rack.face.front',{},'Frontal')],['rear',tr('rack.face.rear',{},'Trasera')]],item.face||'front');
  const mounting=input('text',tr('rack.field.mounting',{},'Montaje'),item.mounting||'');
  const weight=input('number',tr('rack.field.weight',{},'Peso kg'),item.weightKg);weight.min='0';weight.step='0.1';
  const power=input('number',tr('rack.field.powerDraw',{},'Consumo W'),item.powerDrawWatts);power.min='0';power.step='0.1';
  form.append(
    field('Rack',rack),field(tr('rack.field.label',{},'Etiqueta'),label),field(tr('rack.field.startUnit',{},'Unidad inicial'),start),field(tr('rack.field.heightUnits',{},'Altura U'),height),
    field(tr('rack.field.face',{},'Cara'),face),field(tr('rack.field.mounting',{},'Montaje'),mounting),field(tr('rack.field.weight',{},'Peso kg'),weight),field(tr('rack.field.powerDraw',{},'Consumo W'),power)
  );
  const actions=el('div','rack-selected-actions');
  const save=button(tr('rack.actions.saveChanges',{},'💾 Guardar cambios'),'bp','update-selected-item');save.dataset.id=item.id;
  const remove=button(tr('rack.actions.removeFromRack',{},'🗑 Eliminar del rack'),'bd','remove-rack-item');remove.dataset.id=item.id;
  actions.append(save,remove);form.appendChild(actions);form.elementsRef={rack,label,start,height,face,mounting,weight,power};
  const relation=[];
  if(item.deviceId)relation.push(tr('rack.relation.device',{},'Equipo: ') +(arr(project.devices).find(x=>x.id===item.deviceId)?.name||item.deviceId));
  if(item.patchPanelId)relation.push(tr('rack.relation.patchPanel',{},'Patch panel: ') +(arr(project.patchPanels).find(x=>x.id===item.patchPanelId)?.name||item.patchPanelId));
  if(relation.length)card.appendChild(el('p','hint',relation.join(' · ')+' · '+tr('rack.relation.preserved',{},'Las conexiones se conservan al moverlo.')));
  card.appendChild(form);return card;
}
function summaryCard(project,rack,validation){const card=el('div','card');const h=el('div','card-h');h.append(el('div','card-t',`🗄 ${rack.name||rack.id}`),el('span','b bac',`${rack.rackUnits}U`));const auto=button(tr('rack.actions.organize',{},'✨ Organizar'),'bp bxs','preview-rack-layout');auto.dataset.id=rack.id;const edit=button(tr('actions.edit',{},'Editar'),'bs bxs','edit-rack');edit.dataset.id=rack.id;const del=button(tr('actions.delete',{},'Eliminar'),'bd bxs','remove-rack');del.dataset.id=rack.id;h.append(auto,edit,del);card.appendChild(h);const loc=arr(project.physicalLocations).find(x=>x.id===rack.locationId);card.appendChild(el('div','hint',`${loc?loc.name:tr('rack.common.locationUndefined',{},'Ubicación no definida')} · ${rack.widthMm||'—'}×${rack.depthMm||'—'} mm`));const grid=el('div','g2 nw-grid-adaptive');grid.appendChild(rackDiagram(project,rack));const details=el('div','nw-panel-stack');const issues=arr(validation.issues).filter(i=>i.rackId===rack.id);const items=MODEL.allRackItems(project).filter(i=>i.rackId===rack.id);const used=new Set();items.forEach(i=>{for(let u=Number(i.startUnit);u<Number(i.startUnit)+Number(i.heightUnits||1);u++)used.add(u);});details.append(el('p','',tr('rack.summary.occupancy',{used:used.size,total:rack.rackUnits},'Ocupación: {used}/{total}U')),el('p','',tr('rack.summary.items',{count:items.length},'Elementos: {count}')),el('p','',tr('rack.summary.issues',{count:issues.length},'Incidencias: {count}')));const pdus=arr(project.pdus).filter(x=>x.rackId===rack.id);details.appendChild(el('p','',tr('rack.summary.pdus',{count:pdus.length},'PDU/regletas: {count}')));for(const pdu of pdus){const line=el('div','rack-list-row');line.append(el('span','',(pdu.name||pdu.id)+' · '+tr('rack.summary.pduLine',{count:pdu.outletCount||0,feed:pdu.feed||'—'},'{count} tomas · feed {feed}')));const b=button(tr('rack.actions.remove',{},'Quitar'),'bd bxs','remove-pdu');b.dataset.id=pdu.id;line.appendChild(b);details.appendChild(line);}if(issues.length){const ul=el('ul','rack-issues');issues.slice(0,8).forEach(i=>ul.appendChild(el('li','',i.message)));details.appendChild(ul);}grid.append(details);card.appendChild(grid);card.appendChild(rackTopologyView(project,rack));return card;}
function connectionsCard(project){const card=el('div','card nw-card-wide');card.appendChild(el('div','card-t',tr('rack.connections.title',{},'🔌 Conexiones de alimentación')));const list=el('div','nw-panel-stack');for(const c of arr(project.powerConnections)){const d=arr(project.devices).find(x=>x.id===c.deviceId),p=arr(project.pdus).find(x=>x.id===c.pduId);const row=el('div','rack-list-row');row.appendChild(el('span','',tr('rack.connections.line',{device:d?.name||c.deviceId||tr('rack.field.device',{},'Equipo'),psu:Number(c.powerSupplyIndex||0)+1,pdu:p?.name||c.pduId||'PDU',outlet:c.outlet||'—'},'{device} PSU-{psu} → {pdu} / toma {outlet}')));const b=button(tr('rack.actions.remove',{},'Quitar'),'bd bxs','remove-power');b.dataset.id=c.id;row.appendChild(b);list.appendChild(row);}if(!arr(project.powerConnections).length)list.appendChild(el('div','empty',tr('rack.connections.empty',{},'No hay conexiones eléctricas definidas.')));card.appendChild(list);return card;}
function render(project){ensureLayoutCss();project=ensureArrays(clone(project));const wrap=el('div','nw-panel-stack');const validation=MODEL.validate(project);const head=el('div','card nw-card-wide');const hh=el('div','card-h');hh.append(el('div','card-t',tr('rack.page.title',{},'🗄 Racks, alimentación y material pasivo')),el('span',`b ${validation.ok?'bgn':'brd'}`,validation.ok?tr('rack.page.noBlocks',{},'Sin bloqueos'):tr('rack.page.issueCount',{count:validation.issues.length},'{count} incidencias')));head.appendChild(hh);head.appendChild(el('p','hint',tr('rack.page.hint',{},'Crea racks, coloca equipos y material pasivo por unidades, define PDU y conecta fuentes de alimentación.')));wrap.append(head,editorCard(project));const rackEdit=selectedRackEditor(project);if(rackEdit)wrap.appendChild(rackEdit);const layoutPreview=rackLayoutPreviewCard(project);if(layoutPreview)wrap.appendChild(layoutPreview);wrap.appendChild(selectedItemEditor(project));if(validation.racks.length){const rackGrid=el('div','nw-card-grid');validation.racks.forEach(r=>rackGrid.appendChild(summaryCard(project,r,validation)));wrap.appendChild(rackGrid);}else wrap.appendChild(el('div','co co-yw',tr('rack.page.empty',{},'No hay racks definidos. Usa el editor para crear el primero.')));wrap.appendChild(connectionsCard(project));const bom=MODEL.billOfMaterials(project);const card=el('div','card nw-card-wide');card.appendChild(el('div','card-t',tr('rack.bom.title',{},'📦 Materiales de rack')));const ul=el('ul','');bom.forEach(x=>ul.appendChild(el('li','',`${x.quantity} × ${x.description||x.label||x.name||x.kind||x.type||tr('rack.bom.material',{},'Material')}`)));if(!bom.length)ul.appendChild(el('li','empty',tr('rack.bom.empty',{},'No hay materiales definidos.')));card.appendChild(ul);wrap.appendChild(card);return wrap;}
function updateRackItemFromEditor(project,itemId,values){
  const item=MODEL.allRackItems(project).find(x=>x.id===itemId);
  if(!item)return{ok:false,project:clone(project),message:tr('rack.error.itemMissing',{},'Elemento de rack inexistente.')};
  const placement=rackItemPlacement(project,item.id,values.rackId,values.startUnit,values.heightUnits);
  if(!placement.ok)return{ok:false,project:clone(project),message:placement.message};
  const next=upsertRackItem(project,{
    id:item.id,rackId:values.rackId,type:item.type,deviceId:item.deviceId,patchPanelId:item.patchPanelId,
    label:values.label,startUnit:values.startUnit,heightUnits:values.heightUnits,face:values.face,
    mounting:values.mounting,weightKg:values.weightKg,powerDrawWatts:values.powerDrawWatts
  });
  const audit=MODEL.validate(next),blocking=arr(audit.issues).find(i=>i.rackItemId===item.id&&i.blocking);
  if(blocking)return{ok:false,project:clone(project),message:blocking.message};
  return{ok:true,project:next,item:MODEL.allRackItems(next).find(x=>x.id===item.id)};
}
function rerenderMount(mount,state){
  mount.textContent='';mount.appendChild(render(state.getSnapshot()));bind(mount,state);
}
function bind(mount,state){
  mount.onclick=e=>{
    const actionNode=e.target&&e.target.closest&&e.target.closest('[data-action]');const action=actionNode&&actionNode.dataset.action;if(!action)return;
    if(action==='preview-rack-layout'){
      const id=actionNode.dataset.id||'';selectedRackId=id;selectedRackNotice='';rackLayoutPreview={rackId:id,options:{}};rerenderMount(mount,state);return;
    }
    if(action==='cancel-rack-layout'){
      rackLayoutPreview=null;rerenderMount(mount,state);return;
    }
    if(action==='apply-rack-layout'){
      e.preventDefault();
      const id=actionNode.dataset.id||(rackLayoutPreview&&rackLayoutPreview.rackId)||'';
      const result=MODEL.applyRackAutoLayout(state.getSnapshot(),id,rackLayoutPreview&&rackLayoutPreview.options||{});
      selectedRackId=id;
      if(!result.ok){selectedRackNotice=result.message||tr('rack.auto.applyFailed',{},'No se ha podido aplicar la organización.');rerenderMount(mount,state);return;}
      rackLayoutPreview=null;
      selectedRackNotice=tr('rack.auto.applied',{},'Organización aplicada. Se han reutilizado los elementos existentes y creado solo el material necesario.');
      state.replaceProject(result.project,{source:'rack-auto-layout'});
      return;
    }
    if(action==='edit-rack'){
      selectedRackId=actionNode.dataset.id||'';selectedRackNotice='';rerenderMount(mount,state);return;
    }
    if(action==='cancel-rack-edit'){
      selectedRackId='';selectedRackNotice='';rerenderMount(mount,state);return;
    }
    if(action==='use-recommended-rack-units'){
      const f=mount.querySelector('[data-form="selected-rack"]');
      if(f&&f.elementsRef)f.elementsRef.units.value=actionNode.dataset.units||f.elementsRef.units.value;
      return;
    }
    if(action==='update-selected-rack'){
      e.preventDefault();
      const f=mount.querySelector('[data-form="selected-rack"]'),r=f&&f.elementsRef,id=actionNode.dataset.id||selectedRackId;
      if(!r||!id)return;
      const result=updateRack(state.getSnapshot(),id,{
        name:r.name.value,rackUnits:r.units.value,locationId:r.location.value,widthMm:r.width.value,depthMm:r.depth.value,
        maxLoadKg:r.load.value,powerCapacityWatts:r.power.value,coolingCapacityWatts:r.cooling.value,numberingDirection:r.numbering.value
      });
      selectedRackId=id;
      if(!result.ok){selectedRackNotice=result.message;rerenderMount(mount,state);return;}
      selectedRackNotice=tr('rack.edit.saved',{},'Rack actualizado. Se han conservado sus equipos, material pasivo, PDUs y cableado.');
      state.replaceProject(result.project,{source:'rack-editor-update',skipNormalize:true,skipRefresh:true,notify:false,silent:true,returnSnapshot:false});
      rerenderMount(mount,state);return;
    }
    if(action==='select-rack-item'){
      if(Date.now()<suppressRackClickUntil)return;
      selectedRackItemId=actionNode.dataset.itemId||'';rackEditorNotice='';rerenderMount(mount,state);return;
    }
    const snapshot=state.getSnapshot();let next=snapshot;
    if(action==='add-rack'){const f=mount.querySelector('[data-form="rack"]');const r=f.elementsRef;next=addRack(snapshot,{name:r.rackName.value,rackUnits:r.rackUnits.value,locationId:r.rackLocation.value,powerCapacityWatts:r.rackPower.value});}
    if(action==='add-item'){const f=mount.querySelector('[data-form="item"]');const r=f.elementsRef;next=upsertRackItem(snapshot,{rackId:r.itemRack.value,type:r.itemType.value,deviceId:r.itemDevice.value,label:r.itemLabel.value,startUnit:r.itemStart.value,heightUnits:r.itemHeight.value});}
    if(action==='add-pdu'){const f=mount.querySelector('[data-form="pdu"]');const r=f.elementsRef;next=addPdu(snapshot,{rackId:r.pduRack.value,name:r.pduName.value,feed:r.pduFeed.value,outletCount:r.pduOutlets.value,maxPowerWatts:r.pduPower.value});}
    if(action==='add-power'){const f=mount.querySelector('[data-form="power"]');const r=f.elementsRef;const pdu=arr(snapshot.pdus).find(x=>x.id===r.powerPdu.value);next=addPowerConnection(snapshot,{deviceId:r.powerDevice.value,pduId:r.powerPdu.value,outlet:r.powerOutlet.value,powerSupplyIndex:r.powerPsu.value,feed:pdu&&pdu.feed});}
    if(action==='remove-rack'){if(selectedRackId===actionNode.dataset.id){selectedRackId='';selectedRackNotice='';}if(rackLayoutPreview&&rackLayoutPreview.rackId===actionNode.dataset.id)rackLayoutPreview=null;next=removeEntity(snapshot,'rack',actionNode.dataset.id);}
    if(action==='remove-pdu')next=removeEntity(snapshot,'pdu',actionNode.dataset.id);
    if(action==='remove-power')next=removeEntity(snapshot,'powerConnection',actionNode.dataset.id);
    if(next!==snapshot)state.replaceProject(next,{source:'rack-editor'});
  };
  const selectedForm=mount.querySelector('[data-form="selected-item"]');
  if(selectedForm&&selectedForm.elementsRef){
    const save=selectedForm.querySelector('[data-action="update-selected-item"]');
    const remove=selectedForm.querySelector('[data-action="remove-rack-item"]');
    if(save)save.onclick=e=>{
      e.preventDefault();e.stopPropagation();
      const r=selectedForm.elementsRef,id=save.dataset.id;
      const result=updateRackItemFromEditor(state.getSnapshot(),id,{
        rackId:r.rack.value,label:r.label.value,startUnit:r.start.value,heightUnits:r.height.value,
        face:r.face.value,mounting:r.mounting.value,weightKg:r.weight.value,powerDrawWatts:r.power.value
      });
      selectedRackItemId=id;
      if(!result.ok){rackEditorNotice=result.message;rerenderMount(mount,state);return;}
      rackEditorNotice=tr('rack.itemEditor.saved',{},'Cambios guardados. Las referencias de cableado y equipo se han conservado.');
      state.replaceProject(result.project,{source:'rack-item-editor',skipNormalize:true,skipRefresh:true,notify:false,silent:true,returnSnapshot:false});
      rerenderMount(mount,state);
    };
    if(remove)remove.onclick=e=>{
      e.preventDefault();e.stopPropagation();
      const id=remove.dataset.id;selectedRackItemId='';rackEditorNotice='';
      state.replaceProject(removeEntity(state.getSnapshot(),'rackItem',id),{source:'rack-item-editor-remove'});
    };
  }
  for(const node of mount.querySelectorAll('[data-drag-rack-item="1"][data-item-id]')){
    let pointer=null;
    const clearTargets=()=>mount.querySelectorAll('.rack-u.is-drop-target').forEach(x=>x.classList.remove('is-drop-target'));
    node.onpointerdown=e=>{
      if(e.button!==0)return;
      e.preventDefault();
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
      rackEditorNotice=tr('rack.itemEditor.moved',{rack:arr(result.project.racks).find(x=>x.id===row.dataset.rackId)?.name||row.dataset.rackId,unit:row.dataset.unit},'Movido a {rack} · U{unit}. Cableado y referencias conservados.');
      state.replaceProject(result.project,{source:'rack-pointer-drag',skipNormalize:true,skipRefresh:true,notify:false,silent:true,returnSnapshot:false});
      rerenderMount(mount,state);
    };
    node.onpointerup=finishPointer;
    node.onpointercancel=e=>{
      if(pointer&&pointer.id===e.pointerId)pointer=null;
      node.classList.remove('is-dragging');clearTargets();
    };
  }
}
function inject(){if(!root.document||!MODEL)return;ensureLayoutCss();const page=root.document.getElementById('pg-physical')||root.document.getElementById('pg-dev')||root.document.getElementById('pg-dash');const state=root.NetWizardState;if(!page||!state||typeof state.getSnapshot!=='function')return;let mount=root.document.getElementById('rackPlannerMount');if(!mount){mount=root.document.createElement('div');mount.id='rackPlannerMount';mount.dataset.layoutSection='full';page.appendChild(mount);}mount.textContent='';mount.appendChild(render(state.getSnapshot()));bind(mount,state);}
const api={version:'netwizard-rack-ui-v9',render,inject,ensureLayoutCss,ensureArrays,addRack,updateRack,upsertRackItem,rackItemPlacement,moveRackItem,updateRackItemFromEditor,addPdu,addPowerConnection,removeEntity};root.NetWizardRackUi=api;if(typeof module!=='undefined'&&module.exports)module.exports=api;if(root.document){const active=()=>root.document.getElementById('pg-physical')?.classList.contains('on');const refresh=()=>{if(active())setTimeout(inject,0);};root.document.addEventListener('DOMContentLoaded',refresh);root.document.addEventListener('nw:project:changed',refresh);root.document.addEventListener('nw:view:changed',event=>{if(event.detail?.step==='physical')setTimeout(inject,0);});root.addEventListener&&root.addEventListener('netwizard:i18n',refresh);}
})(typeof window!=='undefined'?window:globalThis);