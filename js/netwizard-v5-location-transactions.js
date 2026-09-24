/* =========================================================
   NetWizard V5 Location Transactions v1
   Planifica y aplica cambios físicos/visuales de ubicación
   sin DOM, persistencia ni refresh.
========================================================= */
(function initNetWizardV5LocationTransactions(root,factory){
  'use strict';
  const api=factory();
  root.NetWizardV5LocationTransactions=api;
  if(typeof module!=='undefined'&&module.exports)module.exports=api;
})(typeof window!=='undefined'?window:globalThis,function(){
  'use strict';

  const arr=v=>Array.isArray(v)?v:[];
  const clean=v=>String(v==null?'':v).trim();
  const lower=v=>clean(v).toLowerCase();
  const clone=v=>JSON.parse(JSON.stringify(v==null?null:v));
  const cloneArray=v=>clone(arr(v))||[];

  function visualState(project){
    const src=project&&project.visual;
    const visual=clone(src||{})||{};
    if(!Array.isArray(visual.locs))visual.locs=[];
    if(!visual.assign||typeof visual.assign!=='object')visual.assign={};
    if(!visual.assign.devices||typeof visual.assign.devices!=='object')visual.assign.devices={};
    if(!visual.assign.hosts||typeof visual.assign.hosts!=='object')visual.assign.hosts={};
    if(!visual.pos||typeof visual.pos!=='object')visual.pos={};
    return visual;
  }
  function snapshot(project){
    return{
      physicalLocations:cloneArray(project&&project.physicalLocations),
      devices:cloneArray(project&&project.devices),
      hosts:cloneArray(project&&project.hosts),
      racks:cloneArray(project&&project.racks),
      telecomOutlets:cloneArray(project&&project.telecomOutlets),
      visual:visualState(project||{})
    };
  }
  function names(locations){
    return locations.map(l=>clean(l&&l.name)).filter(Boolean).sort((a,b)=>a.localeCompare(b,'es',{sensitivity:'base'}));
  }
  function findPhysical(locations,id){return locations.find(l=>l&&l.id===id)||null;}
  function findVisualByPhysical(visual,id){
    if(!id)return null;
    return arr(visual&&visual.locs).find(l=>l&&(l.physicalLocationId===id||l.id===id))||null;
  }
  function validateParent(locations,id,parentId){
    if(!parentId)return null;
    if(parentId===id)return 'Una ubicación no puede ser su propia superior.';
    if(!findPhysical(locations,parentId))return 'La ubicación superior seleccionada ya no existe.';
    const byId=new Map(locations.map(l=>[l.id,l]));
    const seen=new Set([id]);
    let cursor=parentId;
    while(cursor){
      if(seen.has(cursor))return 'La jerarquía de ubicaciones produciría un ciclo.';
      seen.add(cursor);
      const node=byId.get(cursor);
      cursor=node&&node.parentId||'';
    }
    return null;
  }
  function updateNamedRefs(items,id,oldName,newName){
    let count=0;
    const oldKey=lower(oldName);
    for(const item of items){
      if(!item)continue;
      let touched=false;
      if(oldKey&&lower(item.physicalLocation)===oldKey){item.physicalLocation=newName||'';touched=true;}
      if(item.locationId===id){item.locationId=id;touched=true;}
      if(item.physicalLocationId===id){item.physicalLocationId=id;touched=true;}
      if(touched)count++;
    }
    return count;
  }
  function replaceDeletedRefs(items,id,oldName,fallbackId,fallbackName){
    let count=0;
    const oldKey=lower(oldName);
    for(const item of items){
      if(!item)continue;
      let touched=false;
      if(oldKey&&lower(item.physicalLocation)===oldKey){item.physicalLocation=fallbackName||'';touched=true;}
      if(item.locationId===id){item.locationId=fallbackId||'';touched=true;}
      if(item.physicalLocationId===id){item.physicalLocationId=fallbackId||'';touched=true;}
      if(touched)count++;
    }
    return count;
  }
  function visualPatch(input,index){
    const v=input&&input.visual||{};
    return{
      id:v.id||null,
      color:v.color||'#12324f',
      x:Number.isFinite(v.x)?v.x:80+index*360,
      y:Number.isFinite(v.y)?v.y:90+(index%2)*260,
      w:Number.isFinite(v.w)?v.w:undefined,
      h:Number.isFinite(v.h)?v.h:undefined
    };
  }

  function planUpsert(project,input,options){
    const opts=options||{};
    const next=snapshot(project||{});
    const requestedId=clean(input&&input.id);
    const id=requestedId||(opts.idFactory?opts.idFactory('pl'):('pl-'+Date.now()));
    const name=clean(input&&input.name);
    const type=clean(input&&input.type)||'other';
    const parentId=clean(input&&input.parentId);
    const distance=input&&input.distance!=null?clean(input.distance):'';
    const notes=clean(input&&input.notes);
    if(!name)return{ok:false,error:'Nombre de ubicación requerido.'};

    const existing=findPhysical(next.physicalLocations,id);
    const duplicate=next.physicalLocations.find(l=>l&&l.id!==id&&lower(l.name)===lower(name));
    if(duplicate)return{ok:false,error:'Ya existe una ubicación con ese nombre.',code:'duplicate-name'};
    const parentError=validateParent(next.physicalLocations,id,parentId);
    if(parentError)return{ok:false,error:parentError,code:'invalid-parent'};

    const oldName=existing?existing.name:'';
    const record={id,name,type,parentId,distance,notes};
    if(existing)Object.assign(existing,record);
    else next.physicalLocations.push(record);

    let refCount=0;
    if(existing&&lower(oldName)!==lower(name)){
      refCount+=updateNamedRefs(next.devices,id,oldName,name);
      refCount+=updateNamedRefs(next.hosts,id,oldName,name);
      refCount+=updateNamedRefs(next.racks,id,oldName,name);
      refCount+=updateNamedRefs(next.telecomOutlets,id,oldName,name);
    }

    const patch=visualPatch(input,next.visual.locs.length);
    let visual=next.visual.locs.find(l=>l&&(l.physicalLocationId===id||(existing&&lower(l.name)===lower(oldName))));
    if(!visual){
      visual={
        id:patch.id||(opts.visualIdFactory?opts.visualIdFactory('loc'):('loc-'+id)),
        name,color:patch.color,x:patch.x,y:patch.y,type,physicalLocationId:id
      };
      if(patch.w!==undefined)visual.w=patch.w;
      if(patch.h!==undefined)visual.h=patch.h;
      next.visual.locs.push(visual);
    }else{
      visual.name=name;
      visual.type=type;
      visual.physicalLocationId=id;
      if(input&&input.visual){
        if(input.visual.color)visual.color=input.visual.color;
        if(Number.isFinite(input.visual.x))visual.x=input.visual.x;
        if(Number.isFinite(input.visual.y))visual.y=input.visual.y;
        if(Number.isFinite(input.visual.w))visual.w=input.visual.w;
        if(Number.isFinite(input.visual.h))visual.h=input.visual.h;
      }
    }
    const parentVisual=findVisualByPhysical(next.visual,parentId);
    if(parentId&&parentVisual&&parentVisual.id!==visual.id)visual.parentId=parentVisual.id;
    else if(!parentId&&visual.parentId&&existing)visual.parentId='';

    const plan={
      ok:true,
      operation:existing?'update':'create',
      id,
      visualId:visual.id,
      next:{...next,hostPhysicalLocations:names(next.physicalLocations)},
      impact:{created:!existing,renamed:!!existing&&oldName!==name,updatedReferences:refCount,name,oldName:oldName||null,parentId}
    };
    return plan;
  }

  function planDelete(project,input){
    const next=snapshot(project||{});
    const id=clean(input&&input.id);
    const loc=findPhysical(next.physicalLocations,id);
    if(!loc)return{ok:false,error:'No se ha encontrado la ubicación a eliminar.',code:'not-found'};
    const oldName=loc.name;
    const parent=findPhysical(next.physicalLocations,loc.parentId||'');
    const fallbackId=parent?parent.id:'';
    const fallbackName=parent?parent.name:'';
    const children=next.physicalLocations.filter(l=>l&&l.parentId===id);
    for(const child of children)child.parentId=fallbackId;

    const refs={
      devices:replaceDeletedRefs(next.devices,id,oldName,fallbackId,fallbackName),
      hosts:replaceDeletedRefs(next.hosts,id,oldName,fallbackId,fallbackName),
      racks:replaceDeletedRefs(next.racks,id,oldName,fallbackId,fallbackName),
      outlets:replaceDeletedRefs(next.telecomOutlets,id,oldName,fallbackId,fallbackName)
    };
    next.physicalLocations=next.physicalLocations.filter(l=>l&&l.id!==id);

    const removeVisualIds=new Set(
      next.visual.locs
        .filter(l=>l&&(l.physicalLocationId===id||l.id===id||(!l.physicalLocationId&&lower(l.name)===lower(oldName))))
        .map(l=>l.id)
    );
    const parentVisual=findVisualByPhysical(next.visual,fallbackId);
    const fallbackVisualId=(parentVisual&&!removeVisualIds.has(parentVisual.id)?parentVisual.id:'')||
      (next.visual.locs.find(l=>l&&!removeVisualIds.has(l.id))||{}).id||'';

    for(const l of next.visual.locs){
      if(l&&removeVisualIds.has(l.parentId))l.parentId=fallbackVisualId;
    }
    for(const [deviceId,lid] of Object.entries(next.visual.assign.devices||{})){
      if(removeVisualIds.has(lid))next.visual.assign.devices[deviceId]=fallbackVisualId;
    }
    for(const [hostId,lid] of Object.entries(next.visual.assign.hosts||{})){
      if(removeVisualIds.has(lid))next.visual.assign.hosts[hostId]=fallbackVisualId;
    }
    next.visual.locs=next.visual.locs.filter(l=>l&&!removeVisualIds.has(l.id));
    if(next.visual.sel&&next.visual.sel.t==='loc'&&removeVisualIds.has(next.visual.sel.id))next.visual.sel=null;

    return{
      ok:true,
      operation:'delete',
      id,
      next:{...next,hostPhysicalLocations:names(next.physicalLocations)},
      impact:{
        name:oldName,
        fallbackId:fallbackId||null,
        fallbackName:fallbackName||null,
        children:children.length,
        visualLocations:removeVisualIds.size,
        devices:refs.devices,
        hosts:refs.hosts,
        racks:refs.racks,
        outlets:refs.outlets
      }
    };
  }

  function commit(project,plan){
    if(!project||!plan||!plan.ok||!plan.next)return{ok:false,error:plan&&plan.error||'Plan de ubicación inválido.'};
    const keys=['physicalLocations','devices','hosts','racks','telecomOutlets','visual','hostPhysicalLocations'];
    const backup={};
    for(const key of keys)backup[key]=project[key];
    try{
      for(const key of keys)project[key]=plan.next[key];
      return{ok:true,operation:plan.operation,id:plan.id,impact:plan.impact||{},visualId:plan.visualId||null};
    }catch(error){
      for(const key of keys)project[key]=backup[key];
      return{ok:false,error:error&&error.message||String(error)};
    }
  }

  return{
    version:'netwizard-v5-location-transactions-v1',
    planUpsert,planDelete,commit
  };
});