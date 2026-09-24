/* =========================================================
   NetWizard V5 Commands v1
   Mutaciones explícitas para edición V5.
   Sin DOM, canvas, persistencia ni refresh.
========================================================= */
(function initNetWizardV5Commands(root,factory){
  'use strict';
  const api=factory();
  root.NetWizardV5Commands=api;
  if(typeof module!=='undefined'&&module.exports)module.exports=api;
})(typeof window!=='undefined'?window:globalThis,function(){
  'use strict';

  const arr=v=>Array.isArray(v)?v:[];
  const changed=(selection,mode='refresh')=>({
    changed:true,selection:selection||null,
    refresh:mode==='refresh',redraw:mode==='redraw'||mode==='panel',panel:mode==='panel'
  });
  const noop=()=>({changed:false,selection:null,refresh:false,redraw:false,panel:false});

  function create(options){
    const o=options||{};
    const project=()=>o.project?o.project():{};
    const visual=()=>o.visual?o.visual():(project().visual||{});
    const findDevice=id=>arr(project().devices).find(x=>x&&x.id===id)||null;
    const findHost=id=>arr(project().hosts).find(x=>x&&x.id===id)||null;
    const findPort=id=>arr(project().ports).find(x=>x&&x.id===id)||null;
    const findLocation=id=>arr(visual().locs).find(x=>x&&x.id===id)||null;

    function updateDevice({id,key,value}){
      const d=findDevice(id);if(!d)return noop();
      if(key==='type'||key==='kind'){
        d.type=value;d.kind=value;
        if(o.isEdgeDevice&&!o.isEdgeDevice(d)){d.internetEdge='no';d.wanIf=null;}
      }else d[key]=value;
      return changed({t:'device',id},'refresh');
    }
    function updateHost({id,key,value}){
      const h=findHost(id);if(!h)return noop();
      h[key]=value;
      return changed({t:'host',id},'refresh');
    }
    function updatePort({id,key,value}){
      const p=findPort(id);if(!p)return noop();
      p[key]=value;
      if(key==='mode'&&value!=='access'&&p.accessVlanRef)p.accessVlanRef=null;
      return changed(visual().sel||null,'refresh');
    }
    function updateHostPort({id,portId}){
      const h=findHost(id);if(!h)return noop();
      h.portRef=portId||null;
      if(portId){
        const p=findPort(portId);
        if(p){
          h.connectedDeviceId=p.deviceId;
          const lid=o.deviceVisualLocation?o.deviceVisualLocation(p.deviceId):'';
          if(o.setHostVisualLocation)o.setHostVisualLocation(id,lid);
        }
      }
      return changed({t:'host',id},'refresh');
    }

    function setHostConnectedDevice({id,deviceId}){
      const h=findHost(id);if(!h)return noop();
      h.connectedDeviceId=deviceId||null;
      if(deviceId&&(h.portAssignMode||'auto')==='auto'){
        const suggested=o.suggestHostPort?o.suggestHostPort(deviceId,id):null;
        h.portRef=suggested||null;
        const p=suggested?findPort(suggested):null;
        if(p&&o.setHostVisualLocation){
          const lid=o.deviceVisualLocation?o.deviceVisualLocation(p.deviceId):'';
          o.setHostVisualLocation(id,lid);
        }
      }
      return changed({t:'host',id},'refresh');
    }
    function setHostPortMode({id,mode}){
      const h=findHost(id);if(!h)return noop();
      h.portAssignMode=mode;
      if(mode==='auto'){
        const deviceId=h.connectedDeviceId||null;
        const suggested=deviceId&&o.suggestHostPort?o.suggestHostPort(deviceId,id):null;
        h.portRef=suggested||null;
        const p=suggested?findPort(suggested):null;
        if(p&&o.setHostVisualLocation){
          const lid=o.deviceVisualLocation?o.deviceVisualLocation(p.deviceId):'';
          o.setHostVisualLocation(id,lid);
        }
      }
      return changed({t:'host',id},'refresh');
    }
    function moveDevice({id,locationId}){
      const d=findDevice(id),loc=findLocation(locationId);if(!d||!loc)return noop();
      if(o.setDeviceVisualLocation)o.setDeviceVisualLocation(id,locationId);
      if(o.nextNodePosition)visual().pos[id]=o.nextNodePosition(locationId,'device',id);
      return changed({t:'device',id},'refresh');
    }
    function moveHost({id,locationId}){
      const h=findHost(id);if(!h)return noop();
      const fallback=locationId||(h.connectedDeviceId&&o.deviceVisualLocation?o.deviceVisualLocation(h.connectedDeviceId):'')||arr(visual().locs)[0]?.id||'';
      if(o.setHostVisualLocation)o.setHostVisualLocation(id,locationId||'');
      if(fallback&&o.nextNodePosition)visual().pos[id]=o.nextNodePosition(fallback,'host',id);
      return changed({t:'host',id},'refresh');
    }
    function updateLocationMeta({id,key,value}){
      const loc=findLocation(id);if(!loc)return noop();
      loc[key]=value;
      return changed(null,'redraw');
    }
    function updateLocationSize({id,key,value}){
      const loc=findLocation(id);if(!loc)return noop();
      loc[key]=Math.max(key==='w'?330:160,Number(value)||0);
      return changed(null,'redraw');
    }
    function addLocation({location}){
      if(!location||!location.id)return noop();
      visual().locs.push({...location});
      return changed({t:'loc',id:location.id},'panel');
    }
    function setCompactLabels({compact}){
      visual().compactLabels=!!compact;
      return changed(visual().sel||null,'panel');
    }
    function setFilter({key,on}){
      if(!visual().filters)visual().filters={};
      visual().filters[key]=!!on;
      return changed(visual().sel||null,'panel');
    }
    function setProMode({on}){
      visual().proMode=!!on;
      if(on&&o.applyProfessionalLayout)o.applyProfessionalLayout();
      return changed(visual().sel||null,'panel');
    }
    function select({type,id}){
      visual().sel=type&&id?{t:type,id}:null;
      return changed(visual().sel,'panel');
    }
    function execute(name,payload){
      const map={updateDevice,updateHost,updatePort,updateHostPort,setHostConnectedDevice,setHostPortMode,moveDevice,moveHost,updateLocationMeta,updateLocationSize,addLocation,setCompactLabels,setFilter,setProMode,select};
      return map[name]?map[name](payload||{}):noop();
    }
    return{
      version:'netwizard-v5-commands-v1',execute,updateDevice,updateHost,updatePort,updateHostPort,setHostConnectedDevice,setHostPortMode,
      moveDevice,moveHost,updateLocationMeta,updateLocationSize,addLocation,setCompactLabels,setFilter,setProMode,select
    };
  }

  return{version:'netwizard-v5-commands-factory-v1',create};
});