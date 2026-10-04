/* NetWizard Custom Device Model UI v1 */
(function initNetWizardCustomDeviceModelUi(root){
'use strict';

function arr(v){return Array.isArray(v)?v:[];}
function clean(v){return String(v==null?'':v).trim();}
function num(v){const n=Number(v);return Number.isFinite(n)?n:null;}
function el(id){return root.document&&root.document.getElementById(id);}
function state(){return root.NetWizardState||null;}
function models(){return root.NetWizardCustomDeviceModels||null;}
function mk(tag,attrs,text){const n=root.document.createElement(tag);for(const [k,v] of Object.entries(attrs||{})){if(k==='className')n.className=v;else if(k==='htmlFor')n.htmlFor=v;else if(k==='checked')n.checked=!!v;else n.setAttribute(k,v);}if(text!=null)n.textContent=String(text);return n;}
function tr(key,params,fallback){const i=root.NetWizardI18n;if(i&&typeof i.t==='function')return i.t(key,params||{});return String(fallback||key).replace(/\{([A-Za-z0-9_.-]+)\}/g,(_,k)=>Object.prototype.hasOwnProperty.call(params||{},k)?String(params[k]):'');}
function i18nNode(tag,attrs,key,fallback){const n=mk(tag,Object.assign({},attrs||{}, {'data-i18n':key}),tr(key,{},fallback));return n;}

function parseSpeeds(raw){return clean(raw).split(',').map(x=>Number(x.trim())).filter(Number.isFinite).filter((v,i,a)=>v>=0&&a.indexOf(v)===i).sort((a,b)=>a-b);}
function parsePortGroups(text){
  const out=[];
  const lines=String(text||'').split(/\r?\n/).map(x=>x.trim()).filter(Boolean);
  for(let i=0;i<lines.length;i++){
    const parts=lines[i].split('|').map(x=>x.trim());
    if(parts.length<2)continue;
    const [namePattern,countRaw,media='',speedRaw='',supportedRaw='',poeRaw='']=parts;
    const count=Math.max(0,Math.floor(Number(countRaw)||0));
    if(!namePattern||!count)continue;
    out.push({
      id:'group_'+(i+1),
      namePattern,
      count,
      startIndex:1,
      media,
      speedMaxMbps:Number.isFinite(Number(speedRaw))?Number(speedRaw):null,
      supportedSpeedsMbps:parseSpeeds(supportedRaw),
      poeCapable:/^(1|true|yes|si|sí)$/i.test(poeRaw)
    });
  }
  return out;
}
function serializePortGroups(groups){
  return arr(groups).map(g=>[
    g.namePattern||'port{n}',
    g.count||0,
    g.media||'',
    g.speedMaxMbps==null?'':g.speedMaxMbps,
    arr(g.supportedSpeedsMbps).join(','),
    g.poeCapable?'yes':'no'
  ].join('|')).join('\n');
}
function slug(value){return clean(value).toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'').slice(0,80);}
function modelFromEditor(){
  const manufacturer=clean(el('nwCustomManufacturer')?.value);
  const model=clean(el('nwCustomModel')?.value);
  const existingId=clean(el('nwCustomModelId')?.value);
  return {
    id:existingId||['custom',slug(manufacturer),slug(model)].filter(Boolean).join('-')||('custom-model-'+Date.now()),
    manufacturer,
    model,
    sku:clean(el('nwCustomSku')?.value),
    revision:clean(el('nwCustomRevision')?.value),
    kind:clean(el('nwCustomKind')?.value)||'appliance',
    rackUnits:num(el('nwCustomRackUnits')?.value),
    weightKg:num(el('nwCustomWeightKg')?.value),
    powerTypicalWatts:num(el('nwCustomPowerTypical')?.value),
    powerMaxWatts:num(el('nwCustomPowerMax')?.value),
    poeBudgetWatts:num(el('nwCustomPoeBudget')?.value),
    powerSupplies:{
      count:Math.max(0,Math.floor(num(el('nwCustomPsuCount')?.value)||0)),
      redundant:!!el('nwCustomPsuRedundant')?.checked,
      voltage:clean(el('nwCustomVoltage')?.value)
    },
    portGroups:parsePortGroups(el('nwCustomPortGroups')?.value),
    notes:clean(el('nwCustomNotes')?.value)
  };
}
function setEditor(model){
  const m=model||{};
  el('nwCustomModelId').value=m.id||'';
  el('nwCustomManufacturer').value=m.manufacturer||'';
  el('nwCustomModel').value=m.model||'';
  el('nwCustomSku').value=m.sku||'';
  el('nwCustomRevision').value=m.revision||'';
  el('nwCustomKind').value=m.kind||'switch';
  el('nwCustomRackUnits').value=m.rackUnits??'';
  el('nwCustomWeightKg').value=m.weightKg??'';
  el('nwCustomPowerTypical').value=m.powerTypicalWatts??'';
  el('nwCustomPowerMax').value=m.powerMaxWatts??'';
  el('nwCustomPoeBudget').value=m.poeBudgetWatts??'';
  el('nwCustomPsuCount').value=m.powerSupplies?.count??'';
  el('nwCustomPsuRedundant').checked=!!m.powerSupplies?.redundant;
  el('nwCustomVoltage').value=m.powerSupplies?.voltage||'';
  el('nwCustomPortGroups').value=serializePortGroups(m.portGroups);
  el('nwCustomNotes').value=m.notes||'';
}
function refreshSelect(selected){
  const s=el('nwCustomModelSelect');if(!s)return;
  const snap=state()?.getSnapshot?.()||{};
  const current=selected||s.value;
  s.textContent='';
  s.appendChild(mk('option',{value:''},tr('device.custom.selectManual',{},'— modelo manual / catálogo global —')));
  for(const m of arr(snap.customDeviceModels)){
    s.appendChild(mk('option',{value:m.id},`${m.manufacturer||tr('device.custom.generic',{},'Genérico')} · ${m.model||m.id}`));
  }
  if(arr(snap.customDeviceModels).some(m=>m.id===current))s.value=current;
}
function showEditor(show){const box=el('nwCustomModelEditor');if(box)box.style.display=show?'':'none';}
function saveModel(){
  const S=state();if(!S)return;
  const model=modelFromEditor();
  if(!model.manufacturer||!model.model)return root.alert(tr('device.custom.alert.required',{},'Fabricante y modelo son obligatorios.'));
  const snap=S.getSnapshot(), list=arr(snap.customDeviceModels).slice();
  const idx=list.findIndex(x=>x.id===model.id);
  if(idx>=0)list[idx]=model;else list.push(model);
  snap.customDeviceModels=list;
  S.replaceProject(snap,{source:'custom-device-model-ui'});
  refreshSelect(model.id);showEditor(false);
}
async function promoteSelectedModel(){
  const id=clean(el('nwCustomModelSelect')?.value),snap=state()?.getSnapshot?.()||{};
  const model=models()?.get(snap,id),catalog=root.NetWizardGlobalDeviceCatalog;
  if(!model)return root.alert(tr('device.custom.alert.selectLocal',{},'Selecciona un modelo local.'));
  if(!catalog||typeof catalog.promote!=='function')return root.alert(tr('device.custom.alert.catalogUnavailable',{},'El catálogo global no está disponible.'));
  if(!catalog.canPromote())return root.alert(tr('device.custom.alert.adminRequired',{},'La promoción al catálogo global requiere una sesión de administrador.'));
  try{
    const result=await catalog.promote(model);
    root.alert(tr('device.custom.feedback.promoted',{manufacturer:result.manufacturer||model.manufacturer,model:result.model||model.model},'Modelo promovido al catálogo global: {manufacturer} {model}'));
  }catch(err){
    root.alert(tr('device.custom.alert.promoteFailed',{error:err&&err.message||tr('common.unknownError',{},'error desconocido')},'No se pudo promover el modelo: {error}'));
  }
}
function refreshPromotionVisibility(){
  const b=el('nwCustomPromote');if(!b)return;
  const catalog=root.NetWizardGlobalDeviceCatalog;
  b.style.display=catalog&&catalog.canPromote&&catalog.canPromote()?'':'none';
}
function deleteModel(){
  const S=state(),id=clean(el('nwCustomModelSelect')?.value);if(!S||!id)return;
  const snap=S.getSnapshot();
  if(arr(snap.devices).some(d=>d.modelSource==='custom'&&d.modelRef===id))return root.alert(tr('device.custom.alert.inUse',{},'No se puede borrar: hay dispositivos que usan este modelo.'));
  const model=arr(snap.customDeviceModels).find(x=>x.id===id);
  if(!model)return;
  if(!root.confirm(tr('device.custom.confirmDelete',{manufacturer:model.manufacturer,model:model.model},'¿Borrar el modelo personalizado "{manufacturer} {model}"?')))return;
  snap.customDeviceModels=arr(snap.customDeviceModels).filter(x=>x.id!==id);
  S.replaceProject(snap,{source:'custom-device-model-ui'});
  refreshSelect('');showEditor(false);
}
function applySelectedToForm(){
  const S=state(),M=models(),id=clean(el('nwCustomModelSelect')?.value);if(!S||!M||!id)return;
  const snap=S.getSnapshot(), model=M.get(snap,id);if(!model)return;
  if(el('devModel'))el('devModel').value=model.model||'';
  if(el('devType')){el('devType').value=model.kind||'appliance';el('devType').dispatchEvent(new Event('change'));}
  if(el('nwDeviceModelSource'))el('nwDeviceModelSource').value='custom';
  if(el('nwDeviceModelRef'))el('nwDeviceModelRef').value=model.id;
  const hint=el('nwCustomModelHint');
  if(hint)hint.textContent=tr('device.custom.hint.summary',{manufacturer:model.manufacturer,model:model.model,rackUnits:model.rackUnits||'—',watts:model.powerTypicalWatts??'—',ports:arr(M.expandPortGroups(model)).length},'{manufacturer} {model} · {rackUnits}U · {watts}W típico · {ports} puertos definidos');
}
function generatePortsForDevice(snap,device,model){
  const M=models();if(!M)return 0;
  const expanded=M.expandPortGroups(model), existing=new Set(arr(snap.ports).filter(p=>p.deviceId===device.id).map(p=>clean(p.name).toLowerCase()));
  let added=0;
  for(const spec of expanded){
    if(existing.has(clean(spec.name).toLowerCase()))continue;
    snap.ports.push({
      id:'port_'+Math.random().toString(36).slice(2,10),
      deviceId:device.id,
      name:spec.name,
      media:spec.media||'',
      mode:'access',
      accessVlanRef:'',
      nativeVlanRef:'',
      allowedVlans:[],
      role:null,
      speedMaxMbps:spec.speedMaxMbps,
      supportedSpeedsMbps:spec.supportedSpeedsMbps,
      poeCapable:spec.poeCapable,
      desc:'🧩 '+(model.manufacturer||'')+' '+(model.model||'')
    });
    existing.add(clean(spec.name).toLowerCase());added++;
  }
  return added;
}
function persistDeviceModel(context){
  const S=state(),M=models();if(!S||!M||context.source!=='custom'||!context.ref)return;
  const snap=S.getSnapshot(), model=M.get(snap,context.ref);if(!model)return;
  let target=context.editId?arr(snap.devices).find(d=>d.id===context.editId):null;
  if(!target)target=arr(snap.devices).slice().reverse().find(d=>clean(d.name)===context.name);
  if(!target)return;
  Object.assign(target,M.applyModel(target,model),{modelSource:'custom',modelRef:model.id});
  if(context.generatePorts)generatePortsForDevice(snap,target,model);
  S.replaceProject(snap,{source:'custom-device-model-ui'});
}
function wrapDeviceSave(){
  const b=el('btnAddDev');if(!b||b.__nwCustomModelWrapped||typeof b.onclick!=='function')return false;
  const original=b.onclick;
  b.onclick=function(event){
    const context={
      editId:clean(el('devEditId')?.value),
      name:clean(el('devName')?.value),
      source:clean(el('nwDeviceModelSource')?.value),
      ref:clean(el('nwDeviceModelRef')?.value),
      generatePorts:!!el('nwGenerateModelPorts')?.checked
    };
    const result=original.call(this,event);
    root.setTimeout(()=>persistDeviceModel(context),0);
    return result;
  };
  b.__nwCustomModelWrapped=true;return true;
}
function bindEditSync(){
  root.document.addEventListener('click',event=>{
    const button=event.target&&event.target.closest&&event.target.closest('button');
    if(!button)return;
    root.setTimeout(()=>{
      const id=clean(el('devEditId')?.value);if(!id)return;
      const snap=state()?.getSnapshot?.();const d=arr(snap&&snap.devices).find(x=>x.id===id);if(!d)return;
      const ref=d.modelSource==='custom'?d.modelRef:'';
      refreshSelect(ref);
      el('nwDeviceModelSource').value=d.modelSource||'manual';
      el('nwDeviceModelRef').value=d.modelRef||'';
      if(ref)applySelectedToForm();
    },0);
  });
  el('btnCancelDevEdit')?.addEventListener('click',()=>{
    el('nwDeviceModelSource').value='manual';el('nwDeviceModelRef').value='';refreshSelect('');
  });
}
function ensureUi(){
  if(!root.document||el('nwCustomModelBlock'))return !!el('nwCustomModelBlock');
  const anchor=el('devModelHint');if(!anchor||!anchor.parentNode)return false;
  const block=mk('div',{id:'nwCustomModelBlock',className:'co co-ac'});
  block.style.marginTop='8px';
  const title=i18nNode('div',{className:'card-t'},'device.custom.title','🧩 Modelo personalizado del proyecto');
  const row=mk('div',{className:'row'});
  const left=mk('div');left.append(i18nNode('label',{className:'fl',htmlFor:'nwCustomModelSelect'},'device.custom.localModel','Modelo local'),mk('select',{id:'nwCustomModelSelect'}));
  const right=mk('div');right.append(i18nNode('label',{className:'fl'},'device.custom.actions','Acciones'));
  const actions=mk('div',{className:'brow'});
  actions.append(
    i18nNode('button',{type:'button',className:'btn bs bsm',id:'nwCustomNew'},'device.custom.new','➕ Nuevo'),
    i18nNode('button',{type:'button',className:'btn bs bsm',id:'nwCustomEdit'},'device.custom.edit','✏️ Editar'),
    i18nNode('button',{type:'button',className:'btn bs bsm',id:'nwCustomDelete'},'device.custom.delete','🗑 Borrar'),
    i18nNode('button',{type:'button',className:'btn bp bsm',id:'nwCustomApply'},'device.custom.apply','Aplicar al equipo'),
    i18nNode('button',{type:'button',className:'btn bs bsm',id:'nwCustomPromote'},'device.custom.promote','☁ Promover a catálogo global')
  );
  right.append(actions);row.append(left,right);
  const hint=i18nNode('div',{id:'nwCustomModelHint',className:'hint'},'device.custom.scopeHint','Los modelos locales viajan con el proyecto y no modifican el catálogo global.');
  const gen=mk('label',{className:'chk'});gen.append(mk('input',{type:'checkbox',id:'nwGenerateModelPorts'}),i18nNode('span',{},'device.custom.generatePorts',' Generar los puertos del modelo al guardar el equipo'));
  block.append(title,row,hint,gen,mk('input',{type:'hidden',id:'nwDeviceModelSource',value:'manual'}),mk('input',{type:'hidden',id:'nwDeviceModelRef'}));

  const editor=mk('div',{id:'nwCustomModelEditor'});editor.style.display='none';editor.style.marginTop='10px';
  editor.append(mk('input',{type:'hidden',id:'nwCustomModelId'}));
  const rows=[
    [['device.custom.manufacturer',tr('device.custom.manufacturer',{},'Fabricante'),'nwCustomManufacturer','ACME'],['form.model',tr('form.model',{},'Modelo'),'nwCustomModel','X48P']],
    [['device.custom.sku',tr('device.custom.sku',{},'SKU / part number'),'nwCustomSku','X48P-POE'],['device.custom.revision',tr('device.custom.revision',{},'Revisión'),'nwCustomRevision','Rev A']],
    [['device.custom.rackUnits',tr('device.custom.rackUnits',{},'Altura (U)'),'nwCustomRackUnits','1'],['device.custom.weight',tr('device.custom.weight',{},'Peso (kg)'),'nwCustomWeightKg','4.8']],
    [['device.custom.typicalPower',tr('device.custom.typicalPower',{},'Consumo típico (W)'),'nwCustomPowerTypical','82'],['device.custom.maxPower',tr('device.custom.maxPower',{},'Consumo máximo (W)'),'nwCustomPowerMax','370']],
    [['device.custom.poeBudget',tr('device.custom.poeBudget',{},'PoE budget (W)'),'nwCustomPoeBudget','240'],['device.custom.psuCount',tr('device.custom.psuCount',{},'Número PSU'),'nwCustomPsuCount','2']],
    [['device.custom.voltage',tr('device.custom.voltage',{},'Voltaje'),'nwCustomVoltage','230V'],['form.type',tr('form.type',{},'Tipo'),'nwCustomKind','']]
  ];
  for(const pair of rows){
    const r=mk('div',{className:'row'});
    pair.forEach(([key,label,id,placeholder])=>{
      const w=mk('div');
      if(id==='nwCustomKind'){
        w.append(i18nNode('label',{className:'fl',htmlFor:id},key,label));
        const s=mk('select',{id});
        [['switch','device.kind.switch',tr('device.kind.switch',{},'Switch')],['router','device.kind.router',tr('device.kind.router',{},'Router')],['firewall','device.kind.firewall',tr('device.kind.firewall',{},'Firewall')],['access_point','device.kind.access_point',tr('device.kind.access_point',{},'Punto de acceso')],['wlan_controller','device.kind.wlan_controller',tr('device.kind.wlan_controller',{},'Controlador WLAN')],['server','device.kind.server',tr('device.kind.server',{},'Servidor gestionado')],['appliance','device.kind.appliance',tr('device.kind.appliance',{},'Appliance')]].forEach(([v,key,l])=>s.append(i18nNode('option',{value:v},key,l)));
        w.append(s);
      }else{
        w.append(i18nNode('label',{className:'fl',htmlFor:id},key,label),mk('input',{id,placeholder}));
      }
      r.append(w);
    });editor.append(r);
  }
  const red=mk('label',{className:'chk'});red.append(mk('input',{type:'checkbox',id:'nwCustomPsuRedundant'}),i18nNode('span',{},'device.custom.redundantPsu',' PSU redundantes'));
  editor.append(red,i18nNode('label',{className:'fl',htmlFor:'nwCustomPortGroups'},'device.custom.portGroups','Grupos de puertos'));
  const ta=mk('textarea',{id:'nwCustomPortGroups',rows:'5',placeholder:'Gi1/0/{n}|48|copper|1000|10,100,1000|yes\nSFP+{n}|4|sfp+|10000|1000,10000|no'});editor.append(ta);
  editor.append(i18nNode('div',{className:'hint'},'device.custom.portGroupsFormat','Formato por línea: patrón | cantidad | medio | velocidad máxima Mbps | velocidades soportadas | PoE yes/no'));
  editor.append(i18nNode('label',{className:'fl',htmlFor:'nwCustomNotes'},'form.notes','Notas'),mk('textarea',{id:'nwCustomNotes',rows:'2'}));
  const eb=mk('div',{className:'brow'});eb.append(i18nNode('button',{type:'button',className:'btn bp',id:'nwCustomSave'},'device.custom.save','💾 Guardar modelo'),i18nNode('button',{type:'button',className:'btn bs',id:'nwCustomCancel'},'actions.cancel','Cancelar'));editor.append(eb);
  block.append(editor);
  anchor.parentNode.insertBefore(block,anchor.nextSibling);

  refreshSelect('');
  el('nwCustomNew').onclick=()=>{setEditor(null);showEditor(true);};
  el('nwCustomEdit').onclick=()=>{const m=models()?.get(state()?.getSnapshot?.(),el('nwCustomModelSelect').value);if(!m)return root.alert(tr('device.custom.alert.selectLocal',{},'Selecciona un modelo local.'));setEditor(m);showEditor(true);};
  el('nwCustomDelete').onclick=deleteModel;
  el('nwCustomApply').onclick=applySelectedToForm;
  el('nwCustomPromote').onclick=promoteSelectedModel;
  el('nwCustomSave').onclick=saveModel;
  el('nwCustomCancel').onclick=()=>showEditor(false);
  el('nwCustomModelSelect').onchange=()=>{const id=el('nwCustomModelSelect').value;el('nwDeviceModelSource').value=id?'custom':'manual';el('nwDeviceModelRef').value=id||'';};
  refreshPromotionVisibility();root.setTimeout(refreshPromotionVisibility,500);
  return true;
}
function install(attempt){
  if(!root.document)return false;
  ensureUi();
  const wrapped=wrapDeviceSave();
  if(!wrapped&&(attempt||0)<50){root.setTimeout(()=>install((attempt||0)+1),100);return false;}
  bindEditSync();
  root.document.addEventListener('nw:project:changed',()=>refreshSelect(el('nwCustomModelSelect')?.value||''));
  root.addEventListener&&root.addEventListener('netwizard:i18n',()=>{
    refreshSelect(el('nwCustomModelSelect')?.value||'');
    if(el('nwCustomModelSelect')?.value)applySelectedToForm();
  });
  return true;
}

const api={version:'netwizard-custom-device-model-ui-v2',parsePortGroups,serializePortGroups,modelFromEditor,promoteSelectedModel,refreshPromotionVisibility,install};
root.NetWizardCustomDeviceModelUi=api;
if(typeof module!=='undefined'&&module.exports)module.exports=api;
if(root.document){if(root.document.readyState==='loading')root.document.addEventListener('DOMContentLoaded',()=>install(0));else install(0);}
})(typeof window!=='undefined'?window:globalThis);
