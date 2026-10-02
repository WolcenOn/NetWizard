/* NetWizard WAN Circuits UI v2 */
(function initNetWizardWanCircuitsUi(root){
'use strict';

let editingId='';

function arr(v){return Array.isArray(v)?v:[];}
function clean(v){return String(v==null?'':v).trim();}
function num(v){const n=Number(v);return Number.isFinite(n)?n:null;}
function text(tag,value,cls){
  const el=document.createElement(tag);
  if(cls)el.className=cls;
  el.textContent=String(value==null?'':value);
  return el;
}
function option(value,label,selected){
  const el=document.createElement('option');
  el.value=String(value==null?'':value);
  el.textContent=String(label==null?'':label);
  if(selected)el.selected=true;
  return el;
}
function uid(){
  if(root.crypto&&typeof root.crypto.randomUUID==='function')return 'wan_'+root.crypto.randomUUID();
  return 'wan_'+Date.now().toString(36)+'_'+Math.random().toString(36).slice(2,10);
}
function stateApi(){return root.NetWizardState||null;}
function project(){const state=stateApi();return state&&typeof state.getSnapshot==='function'?state.getSnapshot():{};}
function updateProject(updater,source){
  const state=stateApi();
  if(!state||typeof state.updateProject!=='function')return null;
  return state.updateProject(updater,{source:source||'wan-circuit-editor'});
}
function buildModel(input){
  const engine=root.NetWizardWanCircuits;
  if(!engine)return{circuits:[],issues:[],counts:{blocking:0,warnings:0}};
  return engine.validateProject(input||{});
}
function circuitIssues(model,id){
  return arr(model&&model.issues).filter(issue=>clean(issue&&issue.circuitId)===clean(id));
}
function renderInto(container,input){
  if(!container)return null;
  container.textContent='';
  const model=buildModel(input);
  container.appendChild(text('div','Circuitos WAN, proveedores y capacidad','card-t'));
  container.appendChild(text('p',`Circuitos: ${model.circuits.length} · Bloqueantes: ${model.counts.blocking||0} · Avisos: ${model.counts.warnings||0}`,'hint'));
  if(!model.circuits.length){
    container.appendChild(text('p','No hay circuitos WAN definidos. Edítalos desde Enlaces → Circuitos WAN.','hint'));
    return model;
  }
  const table=document.createElement('table');
  table.style.cssText='width:100%;border-collapse:collapse;font-size:13px';
  const head=document.createElement('thead');
  const hr=document.createElement('tr');
  for(const label of ['Circuito','Proveedor','Rol','Capacidad','Pico','Estado']){
    const th=text('th',label);th.align='left';hr.appendChild(th);
  }
  head.appendChild(hr);table.appendChild(head);
  const body=document.createElement('tbody');
  for(const c of model.circuits){
    const issues=circuitIssues(model,c.id);
    const status=issues.some(i=>i.blocking)?'bloqueado':issues.length?'revisar':'correcto';
    const tr=document.createElement('tr');
    const values=[c.name||c.id,c.provider||'—',c.role||'—',`${c.bandwidthDownMbps||0}/${c.bandwidthUpMbps||0} Mbps`,`${c.expectedPeakMbps||0} Mbps`,status];
    values.forEach(v=>{const td=text('td',v);td.style.cssText='padding:5px;border-top:1px solid rgba(127,127,127,.25)';tr.appendChild(td);});
    body.appendChild(tr);
  }
  table.appendChild(body);container.appendChild(table);
  for(const issue of arr(model.issues)){
    const p=text('p',`${issue.code} · ${issue.message}`,issue.blocking?'co co-rd':'co co-yw');
    p.style.marginTop='6px';container.appendChild(p);
  }
  return model;
}
function eligibleDevices(input){
  return arr(input&&input.devices)
    .filter(d=>['router','firewall','switch'].includes(clean(d.kind||d.type).toLowerCase()))
    .sort((a,b)=>clean(a.name||a.id).localeCompare(clean(b.name||b.id),'es',{numeric:true,sensitivity:'base'}));
}
function portsForDevice(input,deviceId){
  return arr(input&&input.ports)
    .filter(p=>clean(p.deviceId)===clean(deviceId))
    .sort((a,b)=>clean(a.name||a.id).localeCompare(clean(b.name||b.id),'es',{numeric:true,sensitivity:'base'}));
}
function field(label,input){
  const wrap=document.createElement('div');
  const lab=text('label',label,'fl');
  if(input.id)lab.htmlFor=input.id;
  wrap.append(lab,input);
  return wrap;
}
function inputEl(id,type,placeholder){
  const el=document.createElement('input');
  el.id=id;el.type=type||'text';
  if(placeholder)el.placeholder=placeholder;
  return el;
}
function selectEl(id){const el=document.createElement('select');el.id=id;return el;}
function row(){
  const el=document.createElement('div');el.className='row';
  for(const child of arguments)el.appendChild(child);
  return el;
}
function currentCircuit(input){
  return arr(input&&input.wanCircuits).find(c=>clean(c.id)===clean(editingId))||null;
}
function setOptionalNumber(target,key,value){
  const n=num(value);
  if(value===''||value==null||!Number.isFinite(n))delete target[key];
  else target[key]=n;
}
function circuitPayload(input,form,existing){
  const name=clean(form.name.value),provider=clean(form.provider.value),deviceId=clean(form.device.value),portId=clean(form.port.value);
  const down=num(form.down.value),up=num(form.up.value);
  if(!name)throw new Error('Indica un nombre para el circuito WAN.');
  if(!deviceId)throw new Error('Selecciona el equipo de red donde termina el circuito.');
  if(!portId)throw new Error('Selecciona el puerto WAN del dispositivo.');
  if(!portsForDevice(input,deviceId).some(p=>p.id===portId))throw new Error('El puerto WAN no pertenece al dispositivo seleccionado.');
  if(!(down>0)||!(up>0))throw new Error('La capacidad de bajada y subida debe ser mayor que 0 Mbps.');
  const result=Object.assign({},existing||{},{
    id:existing&&existing.id?existing.id:uid(),
    name,
    provider,
    role:clean(form.role.value)||'primary',
    enabled:!!form.enabled.checked,
    deviceId,
    portId,
    bandwidthDownMbps:down,
    bandwidthUpMbps:up,
    siteRef:clean(form.group.value)||'global',
    physicalPath:clean(form.path.value)
  });
  setOptionalNumber(result,'expectedPeakMbps',form.peak.value);
  setOptionalNumber(result,'latencyTargetMs',form.latency.value);
  setOptionalNumber(result,'lossTargetPercent',form.loss.value);
  setOptionalNumber(result,'slaAvailability',form.sla.value);
  if(result.lossTargetPercent!=null&&(result.lossTargetPercent<0||result.lossTargetPercent>100))throw new Error('La pérdida objetivo debe estar entre 0 y 100%.');
  if(result.slaAvailability!=null&&(result.slaAvailability<0||result.slaAvailability>100))throw new Error('El SLA debe estar entre 0 y 100%.');
  return result;
}
function renderEditor(){
  if(!root.document)return null;
  const mount=document.getElementById('nwWanCircuitsEditorMount');
  if(!mount)return null;
  const p=project();
  if(editingId&&!currentCircuit(p))editingId='';
  mount.textContent='';

  const card=document.createElement('div');card.className='card';card.id='nwWanCircuitsEditor';
  const head=document.createElement('div');head.className='card-h';
  head.appendChild(text('div','🌐 Circuitos WAN','card-t'));
  head.appendChild(text('span','Diseño canónico','b bac'));
  card.appendChild(head);
  card.appendChild(text('p','Modela circuitos del operador y su terminación física. Estos datos alimentan Validación/Production Gate; no sustituyen la configuración IP del puerto ni inventan CLI por sí solos.','hint'));

  const form={};
  form.name=inputEl('nwWanName','text','DIA principal / Fibra backup');
  form.provider=inputEl('nwWanProvider','text','ISP / carrier');
  form.role=selectEl('nwWanRole');
  form.role.append(option('primary','Principal'),option('backup','Backup'));
  form.enabled=inputEl('nwWanEnabled','checkbox');form.enabled.checked=true;
  form.device=selectEl('nwWanDevice');
  form.port=selectEl('nwWanPort');
  form.down=inputEl('nwWanDown','number','500');form.down.min='0';form.down.step='1';
  form.up=inputEl('nwWanUp','number','200');form.up.min='0';form.up.step='1';
  form.peak=inputEl('nwWanPeak','number','120');form.peak.min='0';form.peak.step='1';
  form.group=inputEl('nwWanGroup','text','Sede / grupo de failover');
  form.latency=inputEl('nwWanLatency','number','20');form.latency.min='0';form.latency.step='0.1';
  form.loss=inputEl('nwWanLoss','number','1');form.loss.min='0';form.loss.max='100';form.loss.step='0.1';
  form.sla=inputEl('nwWanSla','number','99.9');form.sla.min='0';form.sla.max='100';form.sla.step='0.01';
  form.path=inputEl('nwWanPath','text','Demarcación / recorrido físico diferente');

  const devices=eligibleDevices(p);
  form.device.appendChild(option('','— equipo de terminación —'));
  for(const d of devices)form.device.appendChild(option(d.id,`${d.name||d.id} · ${d.vendorOs||d.kind||d.type||'—'}`));

  function refillPorts(preferred){
    const old=preferred===undefined?form.port.value:preferred;
    form.port.textContent='';form.port.appendChild(option('','— puerto WAN —'));
    for(const port of portsForDevice(p,form.device.value)){
      form.port.appendChild(option(port.id,`${port.name||port.id} · ${port.mode||'—'}`,port.id===old));
    }
    if(old&&Array.from(form.port.options).some(o=>o.value===old))form.port.value=old;
  }
  form.device.addEventListener('change',()=>refillPorts(''));

  const existing=currentCircuit(p);
  if(existing){
    form.name.value=existing.name||'';
    form.provider.value=existing.provider||'';
    form.role.value=existing.role||'primary';
    form.enabled.checked=existing.enabled!==false;
    form.device.value=existing.deviceId||'';
    refillPorts(existing.portId||'');
    form.down.value=existing.bandwidthDownMbps==null?'':existing.bandwidthDownMbps;
    form.up.value=existing.bandwidthUpMbps==null?'':existing.bandwidthUpMbps;
    form.peak.value=existing.expectedPeakMbps==null?'':existing.expectedPeakMbps;
    form.group.value=existing.siteRef||existing.wanGroupRef||existing.failoverGroupRef||existing.locationRef||'';
    form.latency.value=existing.latencyTargetMs==null?'':existing.latencyTargetMs;
    form.loss.value=existing.lossTargetPercent==null?'':existing.lossTargetPercent;
    form.sla.value=existing.slaAvailability==null?'':existing.slaAvailability;
    form.path.value=existing.physicalPath||existing.demarcLocation||'';
  }else refillPorts('');

  card.append(
    row(field('Nombre',form.name),field('Proveedor',form.provider),field('Rol',form.role)),
    row(field('Dispositivo de terminación',form.device),field('Puerto WAN',form.port),field('Activo',form.enabled)),
    row(field('Bajada (Mbps)',form.down),field('Subida (Mbps)',form.up),field('Pico esperado (Mbps)',form.peak)),
    row(field('Grupo de failover / sede',form.group),field('Latencia objetivo (ms)',form.latency),field('Pérdida objetivo (%)',form.loss)),
    row(field('SLA disponibilidad (%)',form.sla),field('Demarcación / recorrido',form.path))
  );

  const status=text('div',devices.length?'':'Añade primero un router/firewall con al menos un puerto.','hint');
  status.id='nwWanEditorStatus';card.appendChild(status);
  const actions=document.createElement('div');actions.className='brow';
  const save=document.createElement('button');save.type='button';save.className='btn bp';save.id='nwWanSave';save.textContent=existing?'💾 Guardar circuito':'➕ Añadir circuito';
  const cancel=document.createElement('button');cancel.type='button';cancel.className='btn bs';cancel.id='nwWanCancel';cancel.textContent='Cancelar';cancel.style.display=existing?'':'none';
  actions.append(save,cancel);card.appendChild(actions);

  save.addEventListener('click',()=>{
    try{
      const snap=project(),old=currentCircuit(snap),payload=circuitPayload(snap,form,old),wasEditing=!!old;
      editingId='';
      updateProject(current=>{
        const list=arr(current.wanCircuits).slice();
        const at=list.findIndex(x=>x.id===payload.id);
        if(at>=0)list[at]=payload;else list.push(payload);
        return{wanCircuits:list};
      },wasEditing?'wan-circuit-update':'wan-circuit-add');
    }catch(error){
      status.className='co co-rd';status.textContent=error&&error.message||String(error);
    }
  });
  cancel.addEventListener('click',()=>{editingId='';renderEditor();});

  const listCard=document.createElement('div');listCard.className='card';listCard.style.marginTop='12px';
  const listHead=document.createElement('div');listHead.className='card-h';listHead.appendChild(text('div','Circuitos definidos','card-t'));listHead.appendChild(text('span',String(arr(p.wanCircuits).length),'b bgr'));listCard.appendChild(listHead);
  const model=buildModel(p);
  if(!arr(p.wanCircuits).length)listCard.appendChild(text('div','No hay circuitos WAN. Añade el primero arriba.','empty'));
  for(const circuit of arr(p.wanCircuits)){
    const line=document.createElement('div');line.style.cssText='display:flex;gap:8px;align-items:center;justify-content:space-between;padding:9px 0;border-top:1px solid rgba(127,127,127,.2)';
    const left=document.createElement('div');
    left.appendChild(text('strong',circuit.name||circuit.id));
    const issues=circuitIssues(model,circuit.id);
    left.appendChild(text('div',`${circuit.provider||'sin proveedor'} · ${circuit.role||'—'} · ${circuit.bandwidthDownMbps||0}/${circuit.bandwidthUpMbps||0} Mbps · ${issues.some(i=>i.blocking)?'bloqueado':issues.length?'revisar':'correcto'}`,'hint'));
    const buttons=document.createElement('div');buttons.className='brow';buttons.style.margin='0';
    const edit=document.createElement('button');edit.type='button';edit.className='btn bs bsm';edit.textContent='Editar';edit.dataset.wanEdit=circuit.id;
    const del=document.createElement('button');del.type='button';del.className='btn br bsm';del.textContent='Eliminar';del.dataset.wanDelete=circuit.id;
    buttons.append(edit,del);line.append(left,buttons);listCard.appendChild(line);
  }
  listCard.querySelectorAll('[data-wan-edit]').forEach(btn=>btn.addEventListener('click',()=>{editingId=btn.dataset.wanEdit||'';renderEditor();card.scrollIntoView?.({behavior:'smooth',block:'start'});}));
  listCard.querySelectorAll('[data-wan-delete]').forEach(btn=>btn.addEventListener('click',()=>{
    const id=btn.dataset.wanDelete||'',item=arr(project().wanCircuits).find(x=>x.id===id);
    if(root.confirm&&!root.confirm(`¿Eliminar el circuito WAN "${item&&item.name||id}"?`))return;
    if(editingId===id)editingId='';
    updateProject(current=>({wanCircuits:arr(current.wanCircuits).filter(x=>x.id!==id)}),'wan-circuit-delete');
  }));

  mount.append(card,listCard);
  return model;
}
function inject(){
  if(!root.document)return null;
  const host=document.getElementById('pg-validate');
  const p=project(),model=buildModel(p);
  let panel=document.getElementById('nwWanCircuitsPanel');
  if(!host)return model;
  if(!model.circuits.length){panel?.remove();return model;}
  if(!panel){panel=document.createElement('div');panel.id='nwWanCircuitsPanel';panel.className='card';panel.style.marginTop='12px';host.appendChild(panel);}
  return renderInto(panel,p);
}
function refresh(){inject();renderEditor();}
function install(){
  if(!root.document)return false;
  const linksActive=()=>root.document.getElementById('pg-links')?.classList.contains('on');
  const validateActive=()=>root.document.getElementById('pg-validate')?.classList.contains('on');
  const refreshActive=()=>{
    if(linksActive())renderEditor();
    if(validateActive())inject();
  };
  document.addEventListener('nw:project:changed',refreshActive);
  document.addEventListener('nw:view:changed',event=>{
    if(event.detail?.step==='links')renderEditor();
    else if(event.detail?.step==='validate')inject();
  });
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>setTimeout(refreshActive,100));
  else setTimeout(refreshActive,0);
  return true;
}
const api={version:'netwizard-wan-circuits-ui-v2',buildModel,renderInto,renderEditor,inject,refresh,install};
root.NetWizardWanCircuitsUi=api;
if(typeof module!=='undefined'&&module.exports)module.exports=api;
if(root.document)install();
})(typeof window!=='undefined'?window:globalThis);
