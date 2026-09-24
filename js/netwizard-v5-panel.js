/* =========================================================
   NetWizard V5 Panel v1
   Presentación DOM del panel lateral. No modifica el proyecto:
   todas las acciones se delegan al controlador.
========================================================= */
(function initNetWizardV5Panel(root,factory){
  'use strict';
  const api=factory();
  root.NetWizardV5Panel=api;
  if(typeof module!=='undefined'&&module.exports)module.exports=api;
})(typeof window!=='undefined'?window:globalThis,function(){
  'use strict';

  function create(options){
    const o=options||{};
    const makeEl=(tag,cls,text)=>{
      const el=document.createElement(tag);
      if(cls)el.className=cls;
      if(text!==undefined&&text!==null)el.textContent=String(text);
      return el;
    };
    const option=(value,label,selected)=>{const el=document.createElement('option');el.value=value??'';el.textContent=label??'';if(selected)el.selected=true;return el;};
    const field=(label,control)=>{const box=makeEl('div',''),lab=makeEl('label','fl',label);box.append(lab,control);return box;};
    const input=(value,onInput,type='text')=>{const el=document.createElement('input');el.type=type;el.value=value??'';el.addEventListener('input',e=>onInput?.(e.target.value));return el;};
    const select=(options,value,onChange)=>{const el=document.createElement('select');for(const item of options||[])el.appendChild(option(item.value,item.label,String(item.value)===String(value)));el.value=value??'';el.addEventListener('change',e=>onChange?.(e.target.value));return el;};
    const row=(cls,...items)=>{const el=makeEl('div',cls||'v5-row2');for(const item of items)el.appendChild(item);return el;};
    const button=(label,fn,cls='btn bs bsm')=>{const el=makeEl('button',cls,label);el.type='button';el.addEventListener('click',fn);return el;};
    const meta=(...items)=>{const el=makeEl('div','v5-meta');for(const [cls,text] of items)el.appendChild(makeEl('span',cls,text));return el;};
    const listItem=(icon,title,mini,fn)=>{const el=makeEl('div','v5-item');el.style.cursor='pointer';el.addEventListener('click',fn);if(icon)el.appendChild(document.createTextNode(icon+' '));el.appendChild(makeEl('b','',title));if(mini!==undefined)el.appendChild(makeEl('div','v5-mini',mini));return el;};
    const project=()=>o.project();
    const visual=()=>o.visual();
    const action=(name,...args)=>o.actions?.[name]?.(...args);

    function controls(box){
      const br=row('brow');br.style.margin='0 0 10px 0';
      br.append(button('📍 Nueva ubicación',()=>action('addLocation')),button(visual().fs?'🗗 Salir pantalla completa':'⛶ Pantalla completa',()=>action('fullscreen')),button(o.proMode()?'🧱 Profesional ON':'🧱 Profesional OFF',()=>action('setProMode',!o.proMode())));
      box.appendChild(br);
    }
    function portEditor(device){
      const ports=o.portsByDevice(device.id).slice().sort((a,b)=>(a.position||999)-(b.position||999)||String(a.name||'').localeCompare(String(b.name||'')));
      if(!ports.length)return makeEl('div','v5-empty','Este equipo no tiene puertos definidos todavía.');
      const wrap=makeEl('div','v5-ports');
      const vlanOptions=()=>[{value:'',label:'—'}].concat(project().vlans.slice().sort((a,b)=>a.vlanId-b.vlanId).map(v=>({value:v.id,label:`VLAN ${v.vlanId} — ${v.name||''}`})));
      for(const p of ports){
        const card=makeEl('div','v5-port');card.appendChild(makeEl('h4','',p.name||p.id));
        card.appendChild(row('v5-row3',field('Nombre',input(p.name||'',v=>action('updatePort',p.id,'name',v))),field('Medio',select([{value:'FE',label:'FE'},{value:'GE',label:'GE'},{value:'SFP',label:'SFP'}],p.media||'GE',v=>action('updatePort',p.id,'media',v))),field('Modo',select([{value:'access',label:'access'},{value:'trunk',label:'trunk'},{value:'layer3',label:'layer3'}],p.mode||'access',v=>action('updatePort',p.id,'mode',v)))));
        card.appendChild(row('v5-row3',field('VLAN access',select(vlanOptions(),p.accessVlanRef||'',v=>action('updatePort',p.id,'accessVlanRef',v||null))),field('Rol',input(p.role||'',v=>action('updatePort',p.id,'role',v||null))),field('Descripción',input(p.desc||'',v=>action('updatePort',p.id,'desc',v||null)))));
        wrap.appendChild(card);
      }
      return wrap;
    }
    function renderEmpty(box){
      box.appendChild(makeEl('div','card-t','Panel V5'));
      const br=row('brow');br.style.margin='0 0 10px 0';br.append(button('📍 Nueva ubicación',()=>action('addLocation')),button('⊞ Ajustar vista',()=>action('fit')),button(visual().fs?'🗗 Salir pantalla completa':'⛶ Pantalla completa',()=>action('fullscreen')));box.appendChild(br);
      const br2=row('brow');br2.style.margin='0 0 10px 0';br2.appendChild(button(o.proMode()?'🧱 Modo profesional: ON':'🧱 Modo profesional: OFF',()=>action('setProMode',!o.proMode())));box.appendChild(br2);
      box.appendChild(makeEl('div','v5-empty','Selecciona una ubicación, un dispositivo o un host para retocarlo usando los datos ya construidos en V4.'));
      box.appendChild(makeEl('div','v5-note',o.proMode()?'Modo profesional activo: las sububicaciones se muestran anidadas y heredan su contenedor superior.':'Modo libre activo: puedes mover y redimensionar ubicaciones sin jerarquía visual automática.'));
      const list=makeEl('div','v5-list');
      for(const l of o.locations())list.appendChild(listItem('',`${'· '.repeat(o.locationDepth(l.id))}${l.name}`,`${o.devicesInLocation(l.id).length} equipos · ${o.hostsInLocation(l.id).length} hosts`,()=>action('select','loc',l.id)));
      box.appendChild(list);
    }
    function renderLocation(box,sel){
      const l=o.locationById(sel.id);if(!l)return;
      box.appendChild(makeEl('div','card-t',`📍 ${l.name}`));controls(box);
      box.appendChild(meta(['b bac',`${o.devicesInLocation(l.id).length} equipos`],['b bgr',`${o.hostsInLocation(l.id).length} hosts`],['b byw',`${o.locationChildren(l.id).length} sububicaciones`]));
      box.appendChild(row('v5-row2',field('Nombre',input(l.name||'',v=>action('updateLocationMeta',l.id,'name',v))),field('Color',input(l.color||'#10233c',v=>action('updateLocationMeta',l.id,'color',v),'color'))));
      const b=o.locationBounds(l);
      box.appendChild(row('v5-row3',field('Ancho',input(Math.round(b.w),v=>action('updateLocationSize',l.id,'w',v),'number')),field('Alto',input(Math.round(b.h),v=>action('updateLocationSize',l.id,'h',v),'number')),field('Etiquetas enlaces',select([{value:'compact',label:'Compactas'},{value:'full',label:'Completas'}],visual().compactLabels===false?'full':'compact',v=>action('setCompactLabels',v==='compact')))));
      const br=row('brow');br.append(button('🗑 Eliminar ubicación',()=>action('removeLocation',l.id)),button('⊞ Centrar',()=>action('fit')));box.appendChild(br);
      box.appendChild(makeEl('div','v5-note',o.proMode()&&l.parentId?'Esta sububicación se dibuja anidada dentro de su ubicación superior.':'Puedes reorganizar esta ubicación libremente o usar el modo profesional para anidarla visualmente.'));
      const list=makeEl('div','v5-list');
      for(const d of o.devicesInLocation(l.id))list.appendChild(listItem('🔀',d.name||d.id,`${d.type||''} · ${d.mgmtIp||'sin mgmt'}`,()=>action('select','device',d.id)));
      for(const h of o.hostsInLocation(l.id)){const v=o.vlanByRef(h.vlanRef);list.appendChild(listItem('💻',h.name||h.id,`${v?('VLAN '+v.vlanId+' · '+v.name):'Sin VLAN'} · ${o.effectiveHostIp(h)}`,()=>action('select','host',h.id)));}
      box.appendChild(list);
    }
    function renderDevice(box,sel){
      const d=o.deviceById(sel.id);if(!d)return;
      box.appendChild(makeEl('div','card-t',`🧩 ${d.name||d.id}`));
      box.appendChild(row('v5-row2',field('Nombre',input(d.name||'',v=>action('updateDevice',d.id,'name',v))),field('Ubicación visual',select(o.locations().map(l=>({value:l.id,label:l.name})),o.deviceVisualLocation(d.id),v=>action('moveDevice',d.id,v)))));
      box.appendChild(row('v5-row3',field('Tipo',select(o.deviceKindOptions(),o.deviceKind(d),v=>action('updateDevice',d.id,'kind',v))),field('Gestión',input(d.mgmtIp||'',v=>action('updateDevice',d.id,'mgmtIp',v))),field('Vendor/OS',select(o.vendors(),d.vendorOs||'',v=>action('updateDevice',d.id,'vendorOs',v)))));
      box.appendChild(row('v5-row2',field('Internet edge',select([{value:'no',label:'No'},{value:'yes',label:'Sí'}],d.internetEdge==='yes'?'yes':'no',v=>action('updateDevice',d.id,'internetEdge',v))),field('WAN IF',input(d.wanIf||'',v=>action('updateDevice',d.id,'wanIf',v||null)))));
      box.append(field('Notas',input(d.notes||'',v=>action('updateDevice',d.id,'notes',v))),meta(['b bac',o.deviceLabel(d)],['b bgr',`${o.portsByDevice(d.id).length} puertos`],['b bgr',d.vendorOs||'—']),makeEl('div','v5-note','Todos los cambios aquí alimentan la configuración generada en la V4.'),makeEl('div','card-t','Puertos del equipo'),portEditor(d));
    }
    function renderHost(box,sel){
      const h=project().hosts.find(x=>x.id===sel.id);if(!h)return;
      const vlan=o.vlanByRef(h.vlanRef),linked=o.deviceById(o.hostConnectedDeviceId(h)||'');
      box.appendChild(makeEl('div','card-t',`🖥 ${h.name||h.id}`));
      box.appendChild(row('v5-row2',field('Nombre',input(h.name||'',v=>action('updateHost',h.id,'name',v))),field('Ubicación en esquema',select([{value:'',label:'Automática / según equipo'}].concat(o.locations().map(l=>({value:l.id,label:l.name}))),o.hostVisualLocation(h.id)||'',v=>action('moveHost',h.id,v)))));
      box.appendChild(row('v5-row3',field('Tipo',select(o.hostTypeOptions(),h.type||'pc',v=>action('updateHost',h.id,'type',v))),field('VLAN',select([{value:'',label:'— sin VLAN —'}].concat(project().vlans.slice().sort((a,b)=>a.vlanId-b.vlanId).map(v=>({value:v.id,label:`VLAN ${v.vlanId} — ${v.name||''}`}))),h.vlanRef||'',v=>action('updateHost',h.id,'vlanRef',v||null))),field('Modo IP',select([{value:'dhcp',label:'DHCP'},{value:'static',label:'Static'}],h.ipMode||'dhcp',v=>action('updateHost',h.id,'ipMode',v)))));
      box.appendChild(row('v5-row3',field('IP estática',input(h.staticIp||'',v=>action('updateHost',h.id,'staticIp',v))),field('MAC',input(h.mac||'',v=>action('updateHost',h.id,'mac',v))),field('Ubicación física',input(h.physicalLocation||'',v=>action('updateHost',h.id,'physicalLocation',v)))));
      box.appendChild(row('v5-row3',field('Equipo conectado',select([{value:'',label:'— sin equipo —'}].concat(o.connectableDevices().map(d=>({value:d.id,label:`${d.name} · ${d.type||'equipo'}`}))),o.hostConnectedDeviceId(h)||'',v=>action('setHostConnectedDevice',h.id,v||null))),field('Modo puerto',select([{value:'auto',label:'Automático'},{value:'manual',label:'Manual'}],h.portAssignMode||'manual',v=>action('setHostPortMode',h.id,v))),field('Puerto asociado',select([{value:'',label:'— sin puerto —'}].concat(o.hostAssignablePorts(o.hostConnectedDeviceId(h)||'').map(p=>({value:p.id,label:`${p.name}${o.hostPortUsedByOther(p.id,h.id)?' · ocupado':''}`}))),h.portRef||'',v=>action('updateHostPort',h.id,v)))));
      box.append(field('Notas',input(h.notes||'',v=>action('updateHost',h.id,'notes',v))),meta(['b bac',h.type||'host'],['b bgr',vlan?('VLAN '+vlan.vlanId):'sin vlan'],['b bgr',o.effectiveHostIp(h)],['b bpu',linked?linked.name:'sin equipo']));
    }
    function render(box){
      if(!box)return;
      while(box.firstChild)box.removeChild(box.firstChild);
      const sel=visual().sel;
      if(!sel)return renderEmpty(box);
      if(sel.t==='loc')return renderLocation(box,sel);
      if(sel.t==='device')return renderDevice(box,sel);
      if(sel.t==='host')return renderHost(box,sel);
      return renderEmpty(box);
    }
    return{version:'netwizard-v5-panel-v1',render};
  }
  return{version:'netwizard-v5-panel-factory-v1',create};
});