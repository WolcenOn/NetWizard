/* =========================================================
   NetWizard Firewall Edge Generator v0.2
   Traduce el proyecto y el plan neutral a configuraciones de borde.
   FortiGate: CLI ejecutable prudente. pfSense: plan aplicable/revisable.
========================================================= */
(function initNetWizardFirewallEdgeGenerator(root){
  'use strict';

  function arr(v){ return Array.isArray(v) ? v : []; }
  function clean(v){ return String(v == null ? '' : v).trim(); }
  function token(v, fallback){ return (clean(v || fallback).replace(/[^A-Za-z0-9_.-]/g,'_').replace(/_+/g,'_').slice(0,63) || fallback); }
  function tryRequire(p){ try { return require(p); } catch { return null; } }
  function networkUtils(){ return root.NetWizardNetworkUtils || (typeof require === 'function' ? tryRequire('./netwizard-network-utils.js') : null); }
  function routingPlan(){ return root.NetWizardRoutingPlan || (typeof require === 'function' ? tryRequire('./netwizard-routing-plan.js') : null); }

  function parse(cidr){ const n=networkUtils(); return n&&n.parseCidr?n.parseCidr(cidr):null; }
  function ip4(n){ const u=networkUtils(); return u&&u.ip4s?u.ip4s(n>>>0):[n>>>24&255,n>>>16&255,n>>>8&255,n&255].join('.'); }
  function mask(cidr){ const p=parse(cidr); return p?ip4(p.mask):''; }
  function net(cidr){ const p=parse(cidr); return p?ip4(p.net):''; }
  function device(project,id){ return arr(project&&project.devices).find(d=>d.id===id)||null; }
  function ports(project,id){ return arr(project&&project.ports).filter(p=>p.deviceId===id); }
  function subnet(project,ref){ return arr(project&&project.subnets).find(s=>s.vlanRef===ref)||null; }
  function planFor(project,id,supplied){ const plan=supplied||(routingPlan()&&routingPlan().build?routingPlan().build(project||{}):null); return plan&&arr(plan.devices).find(p=>p.deviceId===id)||null; }

  function interfaceRole(port){
    const text=`${clean(port&&port.role)} ${clean(port&&port.desc)} ${clean(port&&port.name)}`.toLowerCase();
    if(/wan|outside|internet|isp/.test(text)) return 'wan';
    if(/dmz/.test(text)) return 'dmz';
    return 'lan';
  }

  function fortiInterfaces(project,dev){
    const lines=['config system interface'];
    for(const p of ports(project,dev.id)){
      if(clean(p.mode).toLowerCase()!=='routed') continue;
      const ip=clean(p.l3Ip||p.routedIp||(p.l3Cidr||p.routedCidr||'').split('/')[0]);
      const cidr=clean(p.l3Cidr||p.routedCidr);
      if(!ip||!cidr||!mask(cidr)) continue;
      lines.push(` edit "${clean(p.name||p.id)}"`,`  set ip ${ip} ${mask(cidr)}`,'  set allowaccess ping https ssh','  set role '+(interfaceRole(p)==='wan'?'wan':'lan'),' next');
    }
    for(const v of arr(project&&project.vlans)){
      const sn=subnet(project,v.id); if(!sn||!sn.gateway||!sn.cidr) continue;
      if(clean(sn.gatewayDeviceRef)&&sn.gatewayDeviceRef!==dev.id) continue;
      const parent=clean((project.roas||{}).lanIf)||clean(ports(project,dev.id).find(p=>clean(p.mode)==='trunk')?.name);
      if(!parent) continue;
      lines.push(` edit "VLAN${v.vlanId}_${token(v.name,'VLAN')}"`,`  set interface "${parent}"`,`  set vlanid ${Number(v.vlanId)}` ,`  set ip ${sn.gateway} ${mask(sn.cidr)}`,'  set allowaccess ping','  set role lan',' next');
    }
    lines.push('end');
    return lines;
  }

  function fortiAddresses(project){
    const lines=['config firewall address'];
    for(const v of arr(project&&project.vlans)){
      const sn=subnet(project,v.id); if(!sn||!sn.cidr||!mask(sn.cidr)) continue;
      lines.push(` edit "NET_${token(v.name,'VLAN'+v.vlanId)}"`,`  set subnet ${net(sn.cidr)} ${mask(sn.cidr)}`,' next');
    }
    lines.push('end'); return lines;
  }

  function fortiRouting(project,dev,plan){
    const lines=[];
    const staticRoutes=plan&&plan.strategy==='static'?arr(plan.staticRoutes):[];
    const defaultNextHop=clean((project.roas||{}).wanNh||dev.defaultGateway||dev.wanGateway);
    const isInternetEdge=clean(dev.internetEdge).toLowerCase()==='yes'||dev.internetEdge===true;

    if((plan&&plan.strategy==='static')&&(staticRoutes.length||(isInternetEdge&&defaultNextHop))){
      lines.push('config router static'); let seq=10;
      for(const r of staticRoutes){
        const destination=clean(r.destination||r.destinationCidr||r.cidr);
        const nextHop=clean(r.nextHop||r.gateway);
        if(!destination||!nextHop) continue;
        lines.push(` edit ${seq}`,`  set dst ${destination}`,`  set gateway ${nextHop}`,' next'); seq+=10;
      }
      if(isInternetEdge&&defaultNextHop){
        lines.push(` edit ${seq}`,'  set dst 0.0.0.0/0',`  set gateway ${defaultNextHop}`,' next');
      }
      lines.push('end');
    } else if(plan&&plan.strategy==='ospf'&&plan.ospf){
      lines.push('config router ospf');
      if(clean(plan.ospf.routerId)) lines.push(` set router-id ${plan.ospf.routerId}`);
      lines.push(' config area','  edit 0.0.0.0','  next',' end',' config network'); let i=1;
      for(const n of arr(plan.ospf.networks)){ lines.push(`  edit ${i}`,`   set prefix ${n.cidr}`,'   set area 0.0.0.0','  next'); i++; }
      lines.push(' end','end');
    }
    return lines;
  }

  function fortiPolicies(project,dev){
    const wan=ports(project,dev.id).find(p=>interfaceRole(p)==='wan');
    const lines=['config firewall policy']; let id=10;
    for(const v of arr(project&&project.vlans)){
      const sn=subnet(project,v.id); if(!sn||!sn.cidr) continue;
      if(clean(sn.gatewayDeviceRef)&&sn.gatewayDeviceRef!==dev.id) continue;
      const intf=`VLAN${v.vlanId}_${token(v.name,'VLAN')}`;
      if(wan){
        lines.push(` edit ${id}`,`  set name "${token(v.name,'VLAN')}_to_Internet"`,`  set srcintf "${intf}"`,`  set dstintf "${clean(wan.name||wan.id)}"`,`  set srcaddr "NET_${token(v.name,'VLAN'+v.vlanId)}"`,'  set dstaddr "all"','  set action accept','  set schedule "always"','  set service "ALL"','  set nat enable','  set logtraffic all',' next'); id+=10;
      }
    }
    for(const rule of arr(project&&project.fwRules).filter(r=>r.enabled!==false)){
      lines.push(` edit ${id}`,`  set name "${token(rule.name||rule.id,'policy')}"`,'  set srcintf "any"','  set dstintf "any"','  set srcaddr "all"','  set dstaddr "all"',`  set action ${clean(rule.action).toLowerCase()==='deny'?'deny':'accept'}`,'  set schedule "always"','  set service "ALL"','  set logtraffic all',' next'); id+=10;
    }
    lines.push('end'); return lines;
  }

  function renderFortiGate(project,deviceId,suppliedPlan){
    const dev=device(project,deviceId); if(!dev) return '';
    const plan=planFor(project,deviceId,suppliedPlan);
    const lines=['# NetWizard FortiGate edge configuration','# Revisar nombres físicos, FortiOS y orden de políticas antes de aplicar.',`config system global`,` set hostname "${token(dev.name,'FortiGate')}"`,'end','',...fortiInterfaces(project,dev),'',...fortiAddresses(project),'',...fortiRouting(project,dev,plan),'',...fortiPolicies(project,dev)];
    return lines.join('\n').replace(/\n{3,}/g,'\n\n')+'\n';
  }

  function renderPfsensePlan(project,deviceId,suppliedPlan){
    const dev=device(project,deviceId); if(!dev) return '';
    const plan=planFor(project,deviceId,suppliedPlan);
    const lines=['# NetWizard pfSense deployment plan','# Tipo: procedimiento aplicable/revisable; no es XML importable universal.','# Motivo: aliases, IDs internos y XML cambian según versión/paquetes.','',`Hostname: ${clean(dev.name||dev.id)}`,'','Interfaces:'];
    for(const p of ports(project,dev.id)){
      const cidr=clean(p.l3Cidr||p.routedCidr); lines.push(`- ${clean(p.name||p.id)} · ${interfaceRole(p).toUpperCase()}${cidr?' · '+cidr:''}`);
    }
    lines.push('','VLANs y gateways:');
    for(const v of arr(project&&project.vlans)){
      const sn=subnet(project,v.id); if(!sn||!sn.cidr) continue;
      if(clean(sn.gatewayDeviceRef)&&sn.gatewayDeviceRef!==dev.id) continue;
      lines.push(`- VLAN ${v.vlanId} ${clean(v.name)}: ${sn.cidr}, gateway ${sn.gateway||'definir'}`);
    }
    lines.push('','Routing:');
    if(plan&&plan.strategy==='static') arr(plan.staticRoutes).forEach(r=>lines.push(`- Ruta estática ${r.destination||r.destinationCidr} vía ${r.nextHop}`));
    else if(plan&&plan.strategy==='ospf') lines.push('- Instalar/configurar FRR y crear OSPF según el plan neutral.','- Router ID: '+clean(plan.ospf&&plan.ospf.routerId),' - Área: '+clean(plan.ospf&&plan.ospf.area||'0'));
    else lines.push('- Estrategia no declarada.');
    lines.push('','Firewall/NAT:','- Crear aliases por subnet/VLAN.','- Aplicar reglas en la interfaz origen; pfSense filtra inbound por interfaz.','- Activar Outbound NAT híbrido o automático solo para redes internas aprobadas.','- Mantener invitados/IoT aislados de redes privadas salvo servicios explícitos.','- Registrar bloqueos relevantes y validar el orden de reglas.');
    return lines.join('\n')+'\n';
  }

  function render(project,deviceId,vendor,suppliedPlan){
    const v=clean(vendor||device(project,deviceId)?.vendorOs).toLowerCase();
    if(v==='fortinet') return renderFortiGate(project,deviceId,suppliedPlan);
    if(v==='pfsense') return renderPfsensePlan(project,deviceId,suppliedPlan);
    return '';
  }

  const api={version:'netwizard-firewall-edge-generator-v2',render,renderFortiGate,renderPfsensePlan,fortiInterfaces,fortiAddresses,fortiRouting,fortiPolicies};
  root.NetWizardFirewallEdgeGenerator=api;
  if(typeof module!=='undefined'&&module.exports) module.exports=api;
})(typeof window!=='undefined'?window:globalThis);
