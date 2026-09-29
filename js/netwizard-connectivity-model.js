/* =========================================================
   NetWizard Connectivity Model v1
   Diagnóstico lógico/físico reutilizable por UI y tests.
   No envía tráfico real.
========================================================= */
(function initNetWizardConnectivityModel(root,factory){
  'use strict';
  const api=factory(root);
  root.NetWizardConnectivityModel=api;
  if(typeof module!=='undefined'&&module.exports)module.exports=api;
})(typeof window!=='undefined'?window:globalThis,function(root){
  'use strict';

  const SERVICES={
    icmp:{id:'icmp',label:'Ping / ICMP',proto:'icmp',port:null},
    dns:{id:'dns',label:'DNS',proto:'udp',port:53},
    https:{id:'https',label:'HTTPS',proto:'tcp',port:443},
    mqtt:{id:'mqtt',label:'MQTT',proto:'tcp',port:1883},
    rtsp:{id:'rtsp',label:'RTSP',proto:'tcp',port:554}
  };

  const arr=v=>Array.isArray(v)?v:[];
  const clean=v=>String(v==null?'':v).trim();
  const lower=v=>clean(v).toLowerCase();
  const byId=(list,id)=>arr(list).find(x=>x&&x.id===id)||null;
  let requiredCabling=null;
  function structuredCabling(){
    if(root&&root.NetWizardStructuredCabling)return root.NetWizardStructuredCabling;
    if(requiredCabling)return requiredCabling;
    try{if(typeof require==='function')requiredCabling=require('./netwizard-structured-cabling.js');}catch(_){}
    return requiredCabling;
  }

  function ipv4Int(value){
    const parts=clean(value).split('.');
    if(parts.length!==4)return null;
    let n=0;
    for(const part of parts){
      if(!/^\d{1,3}$/.test(part))return null;
      const oct=Number(part);
      if(oct<0||oct>255)return null;
      n=(n<<8)|oct;
    }
    return n>>>0;
  }

  function cidrContains(cidr,ip){
    const parts=clean(cidr).split('/');
    if(parts.length!==2)return false;
    const net=ipv4Int(parts[0]),addr=ipv4Int(ip),prefix=Number(parts[1]);
    if(net==null||addr==null||!Number.isInteger(prefix)||prefix<0||prefix>32)return false;
    const mask=prefix===0?0:(0xffffffff<<(32-prefix))>>>0;
    return (net&mask)===(addr&mask);
  }

  function ipOnly(value){
    const m=clean(value).match(/(?:DHCP\s*·\s*)?(\d{1,3}(?:\.\d{1,3}){3})/i);
    return m&&ipv4Int(m[1])!=null?m[1]:'';
  }

  function linkPortA(link){return link&&(link.aPortId||link.a||link.fromPortId||link.from||link.portA)||null;}
  function linkPortB(link){return link&&(link.bPortId||link.b||link.toPortId||link.to||link.portB)||null;}

  function serviceProfile(serviceId){
    return SERVICES[clean(serviceId).toLowerCase()]||SERVICES.icmp;
  }

  function endpointList(project,options){
    project=project||{};options=options||{};
    const endpoints=[];
    const vlans=arr(project.vlans);
    const resolveHostIp=typeof options.resolveHostIp==='function'?options.resolveHostIp:null;
    for(const host of arr(project.hosts)){
      const vlan=byId(vlans,host&&host.vlanRef);
      const ipText=resolveHostIp?clean(resolveHostIp(host)):clean(host&&host.staticIp);
      endpoints.push({
        kind:'host',id:'host:'+host.id,entityId:host.id,name:host.name||host.id,type:host.type||'host',
        vlanRef:host.vlanRef||null,vlanLabel:vlan?`VLAN ${vlan.vlanId} ${vlan.name||''}`.trim():'sin VLAN',
        ipText:ipText||'sin IP',ip:ipOnly(ipText),raw:host
      });
    }
    const iotState=options.iotState||project.iot||{};
    for(const device of arr(iotState.devices)){
      const vlan=byId(vlans,device&&device.vlanRef);
      const ipText=clean(device&&device.identifier);
      endpoints.push({
        kind:'iot',id:'iot:'+device.id,entityId:device.id,name:device.name||device.id,type:device.tech||device.type||'iot',
        vlanRef:device.vlanRef||null,vlanLabel:vlan?`VLAN ${vlan.vlanId} ${vlan.name||''}`.trim():'sin VLAN',
        ipText:ipText||'sin IP',ip:ipOnly(ipText),raw:device
      });
    }
    return endpoints;
  }

  function vlan(project,ref){return byId(project&&project.vlans,ref);}
  function subnet(project,ref){return arr(project&&project.subnets).find(x=>x&&x.vlanRef===ref)||null;}

  function endpointAccess(project,endpoint,options){
    project=project||{};options=options||{};
    if(!endpoint)return{port:null,device:null,accessNode:null};
    if(endpoint.kind==='host'){
      const h=endpoint.raw||{};
      const cabling=structuredCabling();
      const physical=cabling&&typeof cabling.hostAccess==='function'?cabling.hostAccess(project,h.id):null;
      const portId=physical&&physical.structured&&physical.complete
        ? physical.switchPortId
        : (h.portRef||h.portId||h.connectedPortId||h.port||null);
      const port=byId(project.ports,portId);
      const device=port?byId(project.devices,port.deviceId):null;
      return{port,device,accessNode:null,physicalAccess:physical||null,accessSource:physical&&physical.structured?'structured-cabling':'direct'};
    }
    const iotState=options.iotState||project.iot||{};
    const d=endpoint.raw||{};
    const accessNode=byId(iotState.accessNodes,d.accessNodeId);
    const deviceId=(accessNode&&accessNode.parentDeviceId)||d.parentDeviceId||null;
    const portId=(accessNode&&accessNode.parentPortId)||d.parentPortId||null;
    return{
      accessNode,
      port:byId(project.ports,portId),
      device:byId(project.devices,deviceId)
    };
  }

  function portVlanCheck(project,endpoint,options){
    const access=endpointAccess(project,endpoint,options);
    if(endpoint.kind!=='host'){
      if(access.accessNode||access.device)return{ok:true,msg:'Acceso IoT documentado.',access};
      return{ok:null,msg:'Endpoint IoT sin acceso físico completo; se valida parcialmente por VLAN.',access};
    }
    if(!access.port)return{ok:false,msg:'Host sin puerto físico asignado.',access};
    if(access.port.mode!=='access')return{ok:false,msg:`El puerto ${access.port.name||access.port.id} no está en modo access.`,access};
    if(access.port.accessVlanRef!==endpoint.vlanRef)return{ok:false,msg:`El puerto ${access.port.name||access.port.id} no tiene la VLAN del host.`,access};
    return{ok:true,msg:`Puerto OK: ${access.device&&access.device.name||'?'} / ${access.port.name||access.port.id} en access.`,access};
  }

  function sameSubnet(project,a,b){
    if(!a.ip||!b.ip||!a.vlanRef||a.vlanRef!==b.vlanRef)return false;
    const sn=subnet(project,a.vlanRef);
    return !!(sn&&sn.cidr&&cidrContains(sn.cidr,a.ip)&&cidrContains(sn.cidr,b.ip));
  }

  function hasGateway(project,endpoint){
    const sn=subnet(project,endpoint&&endpoint.vlanRef);
    return !!(sn&&sn.gateway&&sn.cidr);
  }

  function matrixAllows(project,a,b){
    const matrix=project&&project.vlanMatrix||{};
    const key=`${a.vlanRef}_${b.vlanRef}`;
    return matrix[key]!==false;
  }

  function addressMatches(project,token,endpoint){
    const t=lower(token);
    if(!t||t==='any'||t==='all')return true;
    if(endpoint.ip){
      if(t===lower(endpoint.ip))return true;
      if(t.includes('/')&&cidrContains(t,endpoint.ip))return true;
    }
    const v=vlan(project,endpoint.vlanRef);
    if(v){
      const name=lower(v.name),id=String(v.vlanId==null?'':v.vlanId).toLowerCase();
      if(t===name||t===id||t===`vlan ${id}`||t===`vlan${id}`)return true;
    }
    const sn=subnet(project,endpoint.vlanRef);
    if(sn&&lower(sn.cidr)===t)return true;
    return false;
  }

  function protocolMatches(ruleProto,profile){
    const p=lower(ruleProto)||'any';
    if(p==='any'||p==='ip')return true;
    if(p==='tcp_udp')return profile.proto==='tcp'||profile.proto==='udp';
    return p===profile.proto;
  }

  function portExpressionMatches(expr,port){
    if(port==null)return true;
    const value=lower(expr);
    if(!value||value==='any'||value==='*')return true;
    for(const token0 of value.split(',')){
      const token=token0.trim();
      if(!token)continue;
      if(/^\d+$/.test(token)&&Number(token)===Number(port))return true;
      const range=token.match(/^(?:range\s+)?(\d+)\s*[-:]\s*(\d+)$/);
      if(range&&Number(port)>=Number(range[1])&&Number(port)<=Number(range[2]))return true;
      const spaced=token.match(/^range\s+(\d+)\s+(\d+)$/);
      if(spaced&&Number(port)>=Number(spaced[1])&&Number(port)<=Number(spaced[2]))return true;
    }
    return false;
  }

  function firewallDecision(project,a,b,serviceId){
    const profile=serviceProfile(serviceId);
    const rules=arr(project&&project.fwRules).filter(r=>r&&r.enabled!==false).slice().sort((x,y)=>Number(x.prio||100)-Number(y.prio||100));
    if(!rules.length)return{allowed:true,matched:null,profile,reason:'Sin reglas firewall explícitas.'};
    for(const rule of rules){
      if(!protocolMatches(rule.proto,profile))continue;
      if(!portExpressionMatches(rule.port,profile.port))continue;
      if(!addressMatches(project,rule.src,a)||!addressMatches(project,rule.dst,b))continue;
      const action=lower(rule.action);
      const allowed=action!=='deny'&&action!=='reject';
      return{allowed,matched:rule,profile,reason:`Regla ${rule.name||rule.id||'sin nombre'}: ${action||'allow'}.`};
    }
    return{allowed:true,matched:null,profile,reason:'No hay una regla coincidente; el simulador no detecta bloqueo explícito.'};
  }

  function buildDeviceGraph(project){
    const ports=new Map(arr(project&&project.ports).filter(Boolean).map(p=>[p.id,p]));
    const devices=new Set(arr(project&&project.devices).filter(Boolean).map(d=>d.id));
    const graph=new Map();
    const add=(from,to,edge)=>{const list=graph.get(from)||[];list.push({to,...edge});graph.set(from,list);};
    for(const link of arr(project&&project.links)){
      const a=ports.get(linkPortA(link)),b=ports.get(linkPortB(link));
      if(!a||!b||!devices.has(a.deviceId)||!devices.has(b.deviceId))continue;
      add(a.deviceId,b.deviceId,{link,fromPort:a,toPort:b});
      add(b.deviceId,a.deviceId,{link,fromPort:b,toPort:a});
    }
    return graph;
  }

  function shortestDevicePath(project,fromId,toId){
    if(!fromId||!toId)return null;
    if(fromId===toId)return{devices:[fromId],edges:[]};
    const graph=buildDeviceGraph(project);
    const queue=[fromId],seen=new Set([fromId]),prev=new Map();
    while(queue.length){
      const cur=queue.shift();
      for(const edge of graph.get(cur)||[]){
        if(seen.has(edge.to))continue;
        seen.add(edge.to);
        prev.set(edge.to,{from:cur,edge});
        if(edge.to===toId){
          const devices=[toId],edges=[];
          let node=toId;
          while(node!==fromId){
            const p=prev.get(node);
            if(!p)return null;
            edges.unshift(p.edge);
            node=p.from;
            devices.unshift(node);
          }
          return{devices,edges};
        }
        queue.push(edge.to);
      }
    }
    return null;
  }

  function deviceLabel(project,id){
    const d=byId(project&&project.devices,id);
    return d?d.name||d.id:id||'Equipo';
  }

  function addHop(list,hop){
    if(!hop||!hop.label)return;
    const last=list[list.length-1];
    if(last&&last.kind===hop.kind&&last.id&&hop.id&&last.id===hop.id)return;
    list.push(hop);
  }

  function buildPath(project,a,b,options,deviceRoute){
    const hops=[];
    const aAccess=endpointAccess(project,a,options),bAccess=endpointAccess(project,b,options);
    addHop(hops,{kind:'endpoint',id:a.id,label:a.name,detail:a.ip||a.vlanLabel});
    if(a.kind==='iot'&&aAccess.accessNode)addHop(hops,{kind:'iot-access',id:aAccess.accessNode.id,label:aAccess.accessNode.name||aAccess.accessNode.id,detail:aAccess.accessNode.type||'acceso IoT'});
    if(aAccess.port)addHop(hops,{kind:'port',id:aAccess.port.id,label:aAccess.port.name||aAccess.port.id,detail:aAccess.device?deviceLabel(project,aAccess.device.id):'Puerto de acceso'});
    if(aAccess.device)addHop(hops,{kind:'device',id:aAccess.device.id,label:deviceLabel(project,aAccess.device.id),detail:aAccess.device.type||aAccess.device.kind||'equipo'});

    if(a.vlanRef)addHop(hops,{kind:'vlan',id:a.vlanRef,label:a.vlanLabel,detail:a.ip||'sin IP'});
    if(a.vlanRef&&b.vlanRef&&a.vlanRef!==b.vlanRef){
      const sn=subnet(project,a.vlanRef);
      if(sn&&sn.gateway)addHop(hops,{kind:'gateway',id:'gw:'+a.vlanRef,label:`Gateway ${sn.gateway}`,detail:sn.cidr||''});
    }

    if(deviceRoute&&deviceRoute.edges.length){
      for(const edge of deviceRoute.edges){
        const medium=edge.link.media||edge.link.medium||edge.link.cableType||'medio no documentado';
        addHop(hops,{kind:'link',id:edge.link.id,label:`${edge.fromPort.name||edge.fromPort.id} ↔ ${edge.toPort.name||edge.toPort.id}`,detail:medium});
        addHop(hops,{kind:'device',id:edge.to,label:deviceLabel(project,edge.to),detail:'salto de red'});
      }
    }

    if(a.vlanRef&&b.vlanRef&&a.vlanRef!==b.vlanRef)addHop(hops,{kind:'vlan',id:b.vlanRef,label:b.vlanLabel,detail:b.ip||'sin IP'});
    if(bAccess.device)addHop(hops,{kind:'device',id:bAccess.device.id,label:deviceLabel(project,bAccess.device.id),detail:bAccess.device.type||bAccess.device.kind||'equipo'});
    if(bAccess.port)addHop(hops,{kind:'port',id:bAccess.port.id,label:bAccess.port.name||bAccess.port.id,detail:bAccess.device?deviceLabel(project,bAccess.device.id):'Puerto de acceso'});
    if(b.kind==='iot'&&bAccess.accessNode)addHop(hops,{kind:'iot-access',id:bAccess.accessNode.id,label:bAccess.accessNode.name||bAccess.accessNode.id,detail:bAccess.accessNode.type||'acceso IoT'});
    addHop(hops,{kind:'endpoint',id:b.id,label:b.name,detail:b.ip||b.vlanLabel});
    return hops;
  }

  function policyDeviceId(project,deviceRoute){
    const ids=deviceRoute&&deviceRoute.devices||[];
    const devices=ids.map(id=>byId(project&&project.devices,id)).filter(Boolean);
    const firewall=devices.find(d=>lower(d.type||d.kind)==='firewall');
    if(firewall)return firewall.id;
    const router=devices.find(d=>lower(d.type||d.kind)==='router');
    return router&&router.id||ids[Math.floor(ids.length/2)]||null;
  }

  function visualTrace(a,b,accessChecks,deviceRoute,blockage){
    const aAccess=accessChecks&&accessChecks[0]&&accessChecks[0].access||{};
    const bAccess=accessChecks&&accessChecks[1]&&accessChecks[1].access||{};
    return{
      source:{kind:a.kind,entityId:a.entityId,endpointId:a.id,deviceId:aAccess.device&&aAccess.device.id||null,portId:aAccess.port&&aAccess.port.id||null},
      target:{kind:b.kind,entityId:b.entityId,endpointId:b.id,deviceId:bAccess.device&&bAccess.device.id||null,portId:bAccess.port&&bAccess.port.id||null},
      deviceIds:deviceRoute&&deviceRoute.devices?deviceRoute.devices.slice():[aAccess.device&&aAccess.device.id,bAccess.device&&bAccess.device.id].filter(Boolean),
      linkIds:deviceRoute&&deviceRoute.edges?deviceRoute.edges.map(e=>e.link&&e.link.id).filter(Boolean):[],
      blockage:blockage||null
    };
  }

  function simulate(project,aId,bId,serviceId,options){
    project=project||{};options=options||{};
    const endpoints=endpointList(project,options);
    const a=endpoints.find(e=>e.id===aId),b=endpoints.find(e=>e.id===bId);
    const profile=serviceProfile(serviceId);
    const steps=[];
    let ok=true,partial=false,blockage=null;
    const block=value=>{if(!blockage)blockage=value;};
    if(!a||!b)return{ok:false,partial:false,service:profile,steps:[{ok:false,msg:'Selecciona origen y destino.'}],path:[],visualTrace:null};
    if(a.id===b.id)return{ok:false,partial:false,service:profile,source:a,target:b,steps:[{ok:false,msg:'Origen y destino no pueden ser el mismo.'}],path:[],visualTrace:{source:{kind:a.kind,entityId:a.entityId,endpointId:a.id},target:{kind:b.kind,entityId:b.entityId,endpointId:b.id},deviceIds:[],linkIds:[],blockage:{kind:'endpoint',endpointId:a.id,entityId:a.entityId,reason:'Origen y destino son el mismo endpoint.'}}};

    if(!a.vlanRef||!b.vlanRef){ok=false;block({kind:'endpoint',endpointId:!a.vlanRef?a.id:b.id,entityId:!a.vlanRef?a.entityId:b.entityId,reason:'Falta VLAN en uno de los extremos.'});steps.push({ok:false,msg:'Falta VLAN en origen o destino.'});}

    const accessChecks=[];
    for(const endpoint of [a,b]){
      const check=portVlanCheck(project,endpoint,options);
      accessChecks.push(check);
      if(check.ok===false){
        ok=false;
        block({kind:check.access&&check.access.port?'port':'endpoint',endpointId:endpoint.id,entityId:endpoint.entityId,portId:check.access&&check.access.port&&check.access.port.id||null,deviceId:check.access&&check.access.device&&check.access.device.id||null,reason:check.msg});
      }
      if(check.ok==null)partial=true;
      steps.push({ok:check.ok,msg:`${endpoint.name}: ${check.msg}`});
      if(!endpoint.ip){partial=true;steps.push({ok:null,msg:`${endpoint.name}: no hay IP concreta; la validación IP es parcial.`});}
    }

    const aDevice=accessChecks[0].access&&accessChecks[0].access.device;
    const bDevice=accessChecks[1].access&&accessChecks[1].access.device;
    let deviceRoute=null;
    if(aDevice&&bDevice){
      deviceRoute=shortestDevicePath(project,aDevice.id,bDevice.id);
      if(deviceRoute){
        const names=deviceRoute.devices.map(id=>deviceLabel(project,id));
        steps.push({ok:true,msg:`Ruta física documentada: ${names.join(' → ')}.`});
      }else{
        ok=false;
        block({kind:'physical-gap',fromDeviceId:aDevice.id,toDeviceId:bDevice.id,deviceId:aDevice.id,reason:`No hay ruta física documentada hasta ${deviceLabel(project,bDevice.id)}.`});
        steps.push({ok:false,msg:`No hay ruta física documentada entre ${deviceLabel(project,aDevice.id)} y ${deviceLabel(project,bDevice.id)}.`});
      }
    }else{
      partial=true;
      steps.push({ok:null,msg:'No se puede reconstruir completamente la ruta física de ambos extremos.'});
    }

    if(a.vlanRef&&b.vlanRef&&a.vlanRef===b.vlanRef){
      if(sameSubnet(project,a,b)||(!a.ip||!b.ip))steps.push({ok:true,msg:'Misma VLAN/subnet: la conectividad L2 es coherente con los datos disponibles.'});
      else{ok=false;block({kind:'vlan',vlanRef:a.vlanRef,deviceId:aDevice&&aDevice.id||null,reason:'Las IP no pertenecen a la misma subnet documentada.'});steps.push({ok:false,msg:'Misma VLAN pero las IP no pertenecen a la misma subnet documentada.'});}
    }else if(a.vlanRef&&b.vlanRef){
      if(!hasGateway(project,a)||!hasGateway(project,b)){
        ok=false;
        const missing=!hasGateway(project,a)?a:b;
        block({kind:'gateway',vlanRef:missing.vlanRef,deviceId:policyDeviceId(project,deviceRoute)||(missing===a&&aDevice&&aDevice.id)||(bDevice&&bDevice.id)||null,reason:'Falta gateway/subnet para routing inter-VLAN.'});
        steps.push({ok:false,msg:'Inter-VLAN requiere gateway/subnet en ambas VLANs.'});
      }else steps.push({ok:true,msg:'Gateways de ambas VLAN presentes para routing inter-VLAN.'});

      if(!matrixAllows(project,a,b)){
        ok=false;
        block({kind:'policy',deviceId:policyDeviceId(project,deviceRoute),reason:'La matriz inter-VLAN bloquea este flujo.'});
        steps.push({ok:false,msg:'La matriz inter-VLAN bloquea este flujo.'});
      }else steps.push({ok:true,msg:'La matriz inter-VLAN permite este flujo.'});

      const fw=firewallDecision(project,a,b,profile.id);
      if(!fw.allowed){
        ok=false;
        block({kind:'firewall',deviceId:policyDeviceId(project,deviceRoute),ruleId:fw.matched&&fw.matched.id||null,reason:fw.reason});
      }
      steps.push({ok:fw.allowed,msg:`Firewall / ${profile.label}: ${fw.reason}`,ruleId:fw.matched&&fw.matched.id||null});
    }

    const path=buildPath(project,a,b,options,deviceRoute);
    const trace=visualTrace(a,b,accessChecks,deviceRoute,blockage);
    return{ok,partial,confidence:partial?'partial':'full',service:profile,source:a,target:b,steps,path,deviceRoute,blockage,visualTrace:trace};
  }

  return{
    version:'netwizard-connectivity-model-v2',
    SERVICES,
    serviceProfile,
    endpointList,
    endpointAccess,
    portVlanCheck,
    firewallDecision,
    buildDeviceGraph,
    shortestDevicePath,
    buildPath,
    simulate,
    linkPortA,
    linkPortB,
    cidrContains
  };
});
