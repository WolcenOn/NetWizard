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

function parseSpeeds(raw){return clean(raw).split(',').map(x=>Number(x.trim())).filter(Number.isFinite).filter((v,i,a)=>v>=0&&a.indexOf(v)===i).sort((a,b)=>a-b);}
function parsePortGroups(text){
  const out=[];
  const lines=String(text||'').split(/?
/).map(x=>x.trim()).filter(Boolean);
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
  s.appendChild(mk('option',{value:''},'— modelo manual / catálogo global —'));
  for(const m of arr(snap.customDeviceModels)){
    s.appendChild(mk('option',{value:m.id},`${m.manufacturer||'Genérico'} · ${m.model||m.id}`));
  }
  if(arr(snap.customDeviceModels).some(m=>m.id===current))s.value=current;
}
function showEditor(show){const box=el('nwCustomModelEditor');if(box)box.style.display=show?'':'none';}
function saveModel(){
  const S=state();if(!S)return;
  const model=modelFromEditor();
  if(!model.manufacturer||!model.model)return root.alert('Fabricante y modelo son obligatorios.');
  const snap=S.getSnapshot(), list=arr(snap.customDeviceModels).slice();
  const idx=list.findIndex(x=>x.id===model.id);
  if(idx>=0)list[idx]=model;else list.push(model);
  snap.customDeviceModels=list;
  S.replaceProject(snap,{source:'custom-device-model-ui'});
  refreshSelect(model.id);showEditor(false);
}
function deleteModel(){
  const S=state(),id=clean(el('nwCustomModelSelect')?.value);if(!S||!id)return;
  const snap=S.getSnapshot();
  if(arr(snap.devices).some(d=>d.modelSource==='custom'&&d.modelRef===id))return root.alert('No se puede borrar: hay dispositivos que usan este modelo.');
  const model=arr(snap.customDeviceModels).find(x=>x.id===id);
  if(!model)return;
  if(!root.confirm(`¿Borrar el modelo personalizado "${model.manufacturer} ${model.model}"?`))return;
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
  if(hint)hint.textContent=`${model.manufacturer} ${model.model} · ${model.rackUnits||'—'}U · ${model.powerTypicalWatts??'—'}W típico · ${arr(M.expandPortGroups(model)).length} puertos definidos`;
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
      desc:'Generado desde modelo personalizado'
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
  const title=mk('div',{className:'card-t'},'🧩 Modelo personalizado del proyecto');
  const row=mk('div',{className:'row'});
  const left=mk('div');left.append(mk('label',{className:'fl',htmlFor:'nwCustomModelSelect'},'Modelo local'),mk('select',{id:'nwCustomModelSelect'}));
  const right=mk('div');right.append(mk('label',{className:'fl'},'Acciones'));
  const actions=mk('div',{className:'brow'});
  actions.append(
    mk('button',{type:'button',className:'btn bs bsm',id:'nwCustomNew'},'➕ Nuevo'),
    mk('button',{type:'button',className:'btn bs bsm',id:'nwCustomEdit'},'✏️ Editar'),
    mk('button',{type:'button',className:'btn bs bsm',id:'nwCustomDelete'},'🗑 Borrar'),
    mk('button',{type:'button',className:'btn bp bsm',id:'nwCustomApply'},'Aplicar al equipo')
  );
  right.append(actions);row.append(left,right);
  const hint=mk('div',{id:'nwCustomModelHint',className:'hint'},'Los modelos locales viajan con el proyecto y no modifican el catálogo global.');
  const gen=mk('label',{className:'chk'});gen.append(mk('input',{type:'checkbox',id:'nwGenerateModelPorts'}),root.document.createTextNode(' Generar los puertos del modelo al guardar el equipo'));
  block.append(title,row,hint,gen,mk('input',{type:'hidden',id:'nwDeviceModelSource',value:'manual'}),mk('input',{type:'hidden',id:'nwDeviceModelRef'}));

  const editor=mk('div',{id:'nwCustomModelEditor'});editor.style.display='none';editor.style.marginTop='10px';
  editor.append(mk('input',{type:'hidden',id:'nwCustomModelId'}));
  const rows=[
    [['Fabricante','nwCustomManufacturer','ACME'],['Modelo','nwCustomModel','X48P']],
    [['SKU / part number','nwCustomSku','X48P-POE'],['Revisión','nwCustomRevision','Rev A']],
    [['Altura (U)','nwCustomRackUnits','1'],['Peso (kg)','nwCustomWeightKg','4.8']],
    [['Consumo típico (W)','nwCustomPowerTypical','82'],['Consumo máximo (W)','nwCustomPowerMax','370']],
    [['PoE budget (W)','nwCustomPoeBudget','240'],['Número PSU','nwCustomPsuCount','2']],
    [['Voltaje','nwCustomVoltage','230V'],['','nwCustomKind','']]
  ];
  for(const pair of rows){
    const r=mk('div',{className:'row'});
    pair.forEach(([label,id,placeholder])=>{
      const w=mk('div');
      if(id==='nwCustomKind'){
        w.append(mk('label',{className:'fl',htmlFor:id},'Tipo'));
        const s=mk('select',{id});
        [['switch','Switch'],['router','Router'],['firewall','Firewall'],['access_point','Access Point'],['wlan_controller','WLAN Controller'],['server','Servidor'],['appliance','Appliance']].forEach(([v,l])=>s.append(mk('option',{value:v},l)));
        w.append(s);
      }else{
        w.append(mk('label',{className:'fl',htmlFor:id},label),mk('input',{id,placeholder}));
      }
      r.append(w);
    });editor.append(r);
  }
  const red=mk('label',{className:'chk'});red.append(mk('input',{type:'checkbox',id:'nwCustomPsuRedundant'}),root.document.createTextNode(' PSU redundantes'));
  editor.append(red,mk('label',{className:'fl',htmlFor:'nwCustomPortGroups'},'Grupos de puertos'));
  const ta=mk('textarea',{id:'nwCustomPortGroups',rows:'5',placeholder:'Gi1/0/{n}|48|copper|1000|10,100,1000|yes\nSFP+{n}|4|sfp+|10000|1000,10000|no'});editor.append(ta);
  editor.append(mk('div',{className:'hint'},'Formato por línea: patrón | cantidad | medio | velocidad máxima Mbps | velocidades soportadas | PoE yes/no'));
  editor.append(mk('label',{className:'fl',htmlFor:'nwCustomNotes'},'Notas'),mk('textarea',{id:'nwCustomNotes',rows:'2'}));
  const eb=mk('div',{className:'brow'});eb.append(mk('button',{type:'button',className:'btn bp',id:'nwCustomSave'},'💾 Guardar modelo'),mk('button',{type:'button',className:'btn bs',id:'nwCustomCancel'},'Cancelar'));editor.append(eb);
  block.append(editor);
  anchor.parentNode.insertBefore(block,anchor.nextSibling);

  refreshSelect('');
  el('nwCustomNew').onclick=()=>{setEditor(null);showEditor(true);};
  el('nwCustomEdit').onclick=()=>{const m=models()?.get(state()?.getSnapshot?.(),el('nwCustomModelSelect').value);if(!m)return root.alert('Selecciona un modelo local.');setEditor(m);showEditor(true);};
  el('nwCustomDelete').onclick=deleteModel;
  el('nwCustomApply').onclick=applySelectedToForm;
  el('nwCustomSave').onclick=saveModel;
  el('nwCustomCancel').onclick=()=>showEditor(false);
  el('nwCustomModelSelect').onchange=()=>{const id=el('nwCustomModelSelect').value;el('nwDeviceModelSource').value=id?'custom':'manual';el('nwDeviceModelRef').value=id||'';};
  return true;
}
function install(attempt){
  if(!root.document)return false;
  ensureUi();
  const wrapped=wrapDeviceSave();
  if(!wrapped&&(attempt||0)<50){root.setTimeout(()=>install((attempt||0)+1),100);return false;}
  bindEditSync();
  root.document.addEventListener('nw:project:changed',()=>refreshSelect(el('nwCustomModelSelect')?.value||''));
  return true;
}

const api={version:'netwizard-custom-device-model-ui-v1',parsePortGroups,serializePortGroups,modelFromEditor,install};
root.NetWizardCustomDeviceModelUi=api;
if(typeof module!=='undefined'&&module.exports)module.exports=api;
if(root.document){if(root.document.readyState==='loading')root.document.addEventListener('DOMContentLoaded',()=>install(0));else install(0);}
})(typeof window!=='undefined'?window:globalThis);
