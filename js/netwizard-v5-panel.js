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
    const i18n=typeof globalThis!=='undefined'?globalThis.NetWizardI18n:null;
    const tr=(key,params={},fallback='')=>i18n&&typeof i18n.t==='function'?i18n.t(key,params):String(fallback||key).replace(/\{([A-Za-z0-9_.-]+)\}/g,(_,k)=>Object.prototype.hasOwnProperty.call(params,k)?String(params[k]):'');
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
      br.append(button(tr('graphs.actions.addLocation',{},'📍 Nueva ubicación'),()=>action('addLocation')),button(visual().fs?tr('graphs.actions.exitFullscreen',{},'🗗 Salir pantalla completa'):tr('graphs.actions.fullscreen',{},'⛶ Pantalla completa'),()=>action('fullscreen')),button(o.proMode()?tr('graphs.panel.proOn',{},'🧱 Profesional ON'):tr('graphs.panel.proOff',{},'🧱 Profesional OFF'),()=>action('setProMode',!o.proMode())));
      box.appendChild(br);
    }
    function portEditor(device){
      const ports=o.portsByDevice(device.id).slice().sort((a,b)=>(a.position||999)-(b.position||999)||String(a.name||'').localeCompare(String(b.name||'')));
      if(!ports.length)return makeEl('div','v5-empty',tr('graphs.panel.noPorts',{},'Este equipo no tiene puertos definidos todavía.'));
      const wrap=makeEl('div','v5-ports');
      const vlanOptions=()=>[{value:'',label:'—'}].concat(project().vlans.slice().sort((a,b)=>a.vlanId-b.vlanId).map(v=>({value:v.id,label:`VLAN ${v.vlanId} — ${v.name||''}`})));
      for(const p of ports){
        const card=makeEl('div','v5-port');card.appendChild(makeEl('h4','',p.name||p.id));
        card.appendChild(row('v5-row3',field(tr('form.name',{},'Nombre'),input(p.name||'',v=>action('updatePort',p.id,'name',v))),field(tr('graphs.fields.media',{},'Medio'),select([{value:'FE',label:'FE'},{value:'GE',label:'GE'},{value:'SFP',label:'SFP'}],p.media||'GE',v=>action('updatePort',p.id,'media',v))),field(tr('graphs.fields.mode',{},'Modo'),select([{value:'access',label:'access'},{value:'trunk',label:'trunk'},{value:'layer3',label:'layer3'}],p.mode||'access',v=>action('updatePort',p.id,'mode',v)))));
        card.appendChild(row('v5-row3',field(tr('graphs.fields.accessVlan',{},'VLAN access'),select(vlanOptions(),p.accessVlanRef||'',v=>action('updatePort',p.id,'accessVlanRef',v||null))),field(tr('graphs.fields.role',{},'Rol'),input(p.role||'',v=>action('updatePort',p.id,'role',v||null))),field(tr('graphs.fields.description',{},'Descripción'),input(p.desc||'',v=>action('updatePort',p.id,'desc',v||null)))));
        wrap.appendChild(card);
      }
      return wrap;
    }
    function renderEmpty(box){
      box.appendChild(makeEl('div','card-t',tr('graphs.panel.title',{},'Panel V5')));
      const br=row('brow');br.style.margin='0 0 10px 0';br.append(button(tr('graphs.actions.addLocation',{},'📍 Nueva ubicación'),()=>action('addLocation')),button(tr('graphs.actions.fit',{},'⊞ Ajustar vista'),()=>action('fit')),button(visual().fs?tr('graphs.actions.exitFullscreen',{},'🗗 Salir pantalla completa'):tr('graphs.actions.fullscreen',{},'⛶ Pantalla completa'),()=>action('fullscreen')));box.appendChild(br);
      const br2=row('brow');br2.style.margin='0 0 10px 0';br2.appendChild(button(o.proMode()?tr('graphs.panel.proModeOn',{},'🧱 Modo profesional: ON'):tr('graphs.panel.proModeOff',{},'🧱 Modo profesional: OFF'),()=>action('setProMode',!o.proMode())));box.appendChild(br2);
      box.appendChild(makeEl('div','v5-empty',tr('graphs.panel.selectHint',{},'Selecciona una ubicación, un dispositivo o un host para retocarlo usando los datos ya construidos en V4.')));
      box.appendChild(makeEl('div','v5-note',o.proMode()?tr('graphs.panel.proModeHint',{},'Modo profesional activo: las sububicaciones se muestran anidadas y heredan su contenedor superior.'):tr('graphs.panel.freeModeHint',{},'Modo libre activo: puedes mover y redimensionar ubicaciones sin jerarquía visual automática.')));
      const list=makeEl('div','v5-list');
      for(const l of o.locations())list.appendChild(listItem('',`${'· '.repeat(o.locationDepth(l.id))}${l.name}`,tr('graphs.panel.locationSummary',{devices:o.devicesInLocation(l.id).length,hosts:o.hostsInLocation(l.id).length},'{devices} equipos · {hosts} hosts'),()=>action('select','loc',l.id)));
      box.appendChild(list);
    }
    function renderLocation(box,sel){
      const l=o.locationById(sel.id);if(!l)return;
      box.appendChild(makeEl('div','card-t',`📍 ${l.name}`));controls(box);
      box.appendChild(meta(['b bac',tr('graphs.panel.devicesCount',{count:o.devicesInLocation(l.id).length},'{count} equipos')],['b bgr',tr('graphs.panel.hostsCount',{count:o.hostsInLocation(l.id).length},'{count} hosts')],['b byw',tr('graphs.panel.sublocationsCount',{count:o.locationChildren(l.id).length},'{count} sububicaciones')]));
      box.appendChild(row('v5-row2',field(tr('form.name',{},'Nombre'),input(l.name||'',v=>action('updateLocationMeta',l.id,'name',v))),field(tr('graphs.fields.color',{},'Color'),input(l.color||'#10233c',v=>action('updateLocationMeta',l.id,'color',v),'color'))));
      const b=o.locationBounds(l);
      box.appendChild(row('v5-row3',field(tr('graphs.fields.width',{},'Ancho'),input(Math.round(b.w),v=>action('updateLocationSize',l.id,'w',v),'number')),field(tr('graphs.fields.height',{},'Alto'),input(Math.round(b.h),v=>action('updateLocationSize',l.id,'h',v),'number')),field(tr('graphs.fields.linkLabels',{},'Etiquetas enlaces'),select([{value:'compact',label:tr('graphs.options.compact',{},'Compactas')},{value:'full',label:tr('graphs.options.full',{},'Completas')}],visual().compactLabels===false?'full':'compact',v=>action('setCompactLabels',v==='compact')))));
      const br=row('brow');br.append(button(tr('graphs.actions.deleteLocation',{},'🗑 Eliminar ubicación'),()=>action('removeLocation',l.id)),button(tr('graphs.actions.center',{},'⊞ Centrar'),()=>action('fit')));box.appendChild(br);
      box.appendChild(makeEl('div','v5-note',o.proMode()&&l.parentId?tr('graphs.panel.nestedHint',{},'Esta sububicación se dibuja anidada dentro de su ubicación superior.'):tr('graphs.panel.locationHint',{},'Puedes reorganizar esta ubicación libremente o usar el modo profesional para anidarla visualmente.')));
      const list=makeEl('div','v5-list');
      for(const d of o.devicesInLocation(l.id))list.appendChild(listItem('🔀',d.name||d.id,tr('graphs.panel.deviceMini',{type:d.type||'',mgmt:d.mgmtIp||tr('graphs.common.noMgmt',{},'sin mgmt')},'{type} · {mgmt}'),()=>action('select','device',d.id)));
      for(const h of o.hostsInLocation(l.id)){const v=o.vlanByRef(h.vlanRef);list.appendChild(listItem('💻',h.name||h.id,`${v?('VLAN '+v.vlanId+' · '+v.name):tr('graphs.common.noVlan',{},'Sin VLAN')} · ${o.effectiveHostIp(h)}`,()=>action('select','host',h.id)));}
      box.appendChild(list);
    }
    function renderDevice(box,sel){
      const d=o.deviceById(sel.id);if(!d)return;
      box.appendChild(makeEl('div','card-t',`🧩 ${d.name||d.id}`));
      box.appendChild(row('v5-row2',field(tr('form.name',{},'Nombre'),input(d.name||'',v=>action('updateDevice',d.id,'name',v))),field(tr('graphs.fields.visualLocation',{},'Ubicación visual'),select(o.locations().map(l=>({value:l.id,label:l.name})),o.deviceVisualLocation(d.id),v=>action('moveDevice',d.id,v)))));
      box.appendChild(row('v5-row3',field(tr('form.type',{},'Tipo'),select(o.deviceKindOptions(),o.deviceKind(d),v=>action('updateDevice',d.id,'kind',v))),field(tr('graphs.fields.management',{},'Gestión'),input(d.mgmtIp||'',v=>action('updateDevice',d.id,'mgmtIp',v))),field('Vendor/OS',select(o.vendors(),d.vendorOs||'',v=>action('updateDevice',d.id,'vendorOs',v)))));
      box.appendChild(row('v5-row2',field('Internet edge',select([{value:'no',label:tr('common.no',{},'No')},{value:'yes',label:tr('common.yes',{},'Sí')}],d.internetEdge==='yes'?'yes':'no',v=>action('updateDevice',d.id,'internetEdge',v))),field('WAN IF',input(d.wanIf||'',v=>action('updateDevice',d.id,'wanIf',v||null)))));
      box.append(field(tr('form.notes',{},'Notas'),input(d.notes||'',v=>action('updateDevice',d.id,'notes',v))),meta(['b bac',o.deviceLabel(d)],['b bgr',tr('graphs.panel.portsCount',{count:o.portsByDevice(d.id).length},'{count} puertos')],['b bgr',d.vendorOs||'—']),makeEl('div','v5-note',tr('graphs.panel.deviceEditHint',{},'Todos los cambios aquí alimentan la configuración generada en la V4.')),makeEl('div','card-t',tr('graphs.panel.devicePorts',{},'Puertos del equipo')),portEditor(d));
    }
    function renderHost(box,sel){
      const h=project().hosts.find(x=>x.id===sel.id);if(!h)return;
      const vlan=o.vlanByRef(h.vlanRef),linked=o.deviceById(o.hostConnectedDeviceId(h)||'');
      box.appendChild(makeEl('div','card-t',`🖥 ${h.name||h.id}`));
      box.appendChild(row('v5-row2',field(tr('form.name',{},'Nombre'),input(h.name||'',v=>action('updateHost',h.id,'name',v))),field(tr('hosts.form.diagramLocation',{},'Ubicación en esquema'),select([{value:'',label:tr('hosts.select.autoLocation',{},'Automática / según equipo')}].concat(o.locations().map(l=>({value:l.id,label:l.name}))),o.hostVisualLocation(h.id)||'',v=>action('moveHost',h.id,v)))));
      box.appendChild(row('v5-row3',field(tr('form.type',{},'Tipo'),select(o.hostTypeOptions(),h.type||'pc',v=>action('updateHost',h.id,'type',v))),field('VLAN',select([{value:'',label:tr('graphs.common.noVlanOption',{},'— sin VLAN —')}].concat(project().vlans.slice().sort((a,b)=>a.vlanId-b.vlanId).map(v=>({value:v.id,label:`VLAN ${v.vlanId} — ${v.name||''}`}))),h.vlanRef||'',v=>action('updateHost',h.id,'vlanRef',v||null))),field(tr('graphs.fields.ipMode',{},'Modo IP'),select([{value:'dhcp',label:'DHCP'},{value:'static',label:tr('hosts.ipMode.static',{},'Static')}],h.ipMode||'dhcp',v=>action('updateHost',h.id,'ipMode',v)))));
      box.appendChild(row('v5-row3',field(tr('hosts.form.staticIp',{},'IP estática'),input(h.staticIp||'',v=>action('updateHost',h.id,'staticIp',v))),field('MAC',input(h.mac||'',v=>action('updateHost',h.id,'mac',v))),field(tr('hosts.form.physicalLocation',{},'Ubicación física'),input(h.physicalLocation||'',v=>action('updateHost',h.id,'physicalLocation',v)))));
      box.appendChild(row('v5-row3',field(tr('hosts.form.connectedDevice',{},'Equipo conectado'),select([{value:'',label:tr('hosts.select.noDevice',{},'— sin equipo —')}].concat(o.connectableDevices().map(d=>({value:d.id,label:`${d.name} · ${d.type||tr('hosts.device.generic',{},'equipo')}`}))),o.hostConnectedDeviceId(h)||'',v=>action('setHostConnectedDevice',h.id,v||null))),field(tr('graphs.fields.portMode',{},'Modo puerto'),select([{value:'auto',label:tr('hosts.portMode.auto',{},'Automático')},{value:'manual',label:'Manual'}],h.portAssignMode||'manual',v=>action('setHostPortMode',h.id,v))),field(tr('graphs.fields.associatedPort',{},'Puerto asociado'),select([{value:'',label:tr('hosts.select.noPort',{},'— sin puerto —')}].concat(o.hostAssignablePorts(o.hostConnectedDeviceId(h)||'').map(p=>({value:p.id,label:`${p.name}${o.hostPortUsedByOther(p.id,h.id)?tr('hosts.port.occupiedSuffix',{},' · ocupado'):''}`}))),h.portRef||'',v=>action('updateHostPort',h.id,v)))));
      box.append(field(tr('form.notes',{},'Notas'),input(h.notes||'',v=>action('updateHost',h.id,'notes',v))),meta(['b bac',h.type||'host'],['b bgr',vlan?('VLAN '+vlan.vlanId):tr('graphs.common.noVlanLower',{},'sin vlan')],['b bgr',o.effectiveHostIp(h)],['b bpu',linked?linked.name:tr('graphs.common.noDeviceLower',{},'sin equipo')]));
    }
    function render(box){
      if(!box)return;
      box.dataset.v5PanelModule='netwizard-v5-panel-v1';
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