/* =========================================================
   NetWizard Vendor Config Patch v3.49
   - Mantiene el generador Cisco existente cuando RoaS está configurado.
   - Añade fallback Cisco IOS Router si falta RoaS explícito.
   - Añade salida útil para MikroTik RouterOS, Huawei VRP, UniFi,
     TP-Link Omada, Galgus Cloud y vendors aún no implementados.
   - No inyecta HTML: solo genera texto de configuración/plan.
========================================================= */
(function initNetWizardVendorConfigPatch(root){
  'use strict';
  const originalGenConfig = (typeof genConfig === 'function') ? genConfig : root.genConfig;
  if(typeof originalGenConfig !== 'function') return;

  function safeS(){ try { return S; } catch { return null; } }
  function arr(v){ return Array.isArray(v) ? v : []; }
  function clean(v){ return String(v == null ? '' : v).trim(); }
  function cliText(v,max=160){
    const core=root.NetWizardCoreUtils||{};
    if(typeof core.safeCliText === 'function') return core.safeCliText(v,max);
    return clean(v).replace(/[\r\n\t]/g,' ').replace(/\s+/g,' ').slice(0,max);
  }
  function cliToken(v,fallback='item',max=64){
    const core=root.NetWizardCoreUtils||{};
    if(typeof core.safeCliToken === 'function') return core.safeCliToken(v,fallback,max);
    return (cliText(v||fallback,max).replace(/[^A-Za-z0-9_.-]/g,'_').replace(/_+/g,'_').slice(0,max) || fallback);
  }
  function quote(v,max=120){ return cliText(v,max).replace(/"/g,"'"); }
  function devById(p,id){ return arr(p.devices).find(d=>d.id===id)||null; }
  function portsByDev(p,id){ return arr(p.ports).filter(x=>x.deviceId===id); }
  function vlanByRef(p,ref){ return arr(p.vlans).find(v=>v.id===ref)||null; }
  function subnetByVlan(p,ref){ return arr(p.subnets).find(s=>s.vlanRef===ref)||null; }
  function parseC(cidr){
    if(typeof parseCidr === 'function') return parseCidr(cidr);
    const m=clean(cidr).match(/^(\d{1,3}(?:\.\d{1,3}){3})\/(\d{1,2})$/); if(!m) return null;
    const parts=m[1].split('.').map(Number); if(parts.some(n=>n<0||n>255)) return null;
    const ip=((parts[0]<<24)>>>0)+(parts[1]<<16)+(parts[2]<<8)+parts[3];
    const pfx=Number(m[2]); if(pfx<0||pfx>32) return null;
    const mask=pfx===0?0:(0xffffffff<<(32-pfx))>>>0;
    return {ip:ip>>>0,pfx,mask,net:(ip&mask)>>>0,cidr:clean(cidr)};
  }
  function ip4(n){
    if(typeof ip4s === 'function') return ip4s(n>>>0);
    return [n>>>24&255,n>>>16&255,n>>>8&255,n&255].join('.');
  }
  function mask(cidrOrMask){
    if(typeof cidrOrMask === 'number') return ip4(cidrOrMask>>>0);
    const c=parseC(cidrOrMask); return c ? ip4(c.mask) : '255.255.255.0';
  }
  function cidrIp(cidr){ const c=parseC(cidr); return c ? ip4(c.ip) : ''; }
  function cidrNet(cidr){ const c=parseC(cidr); return c ? ip4(c.net) : ''; }
  function vendor(d){ return clean(d&&d.vendorOs) || 'cisco_ios'; }
  function isRouterLike(d){ return /router|firewall|gateway/i.test(clean(d&&d.type)); }
  function inferLanPort(p,d){
    const roas=p.roas||{};
    if(roas.gwId===d.id && roas.lanIf) return roas.lanIf;
    const ports=portsByDev(p,d.id);
    const byRole=ports.find(x=>/lan|inside/i.test(clean(x.role||x.desc)));
    if(byRole) return byRole.name;
    const nonWan=ports.find(x=>!/wan|outside/i.test(clean(x.role||x.desc||x.name)));
    return nonWan ? nonWan.name : 'GigabitEthernet0/1';
  }
  function inferWanPort(p,d){
    if(d.wanIf) return d.wanIf;
    const ports=portsByDev(p,d.id);
    const byRole=ports.find(x=>/wan|outside/i.test(clean(x.role||x.desc||x.name)));
    return byRole ? byRole.name : 'GigabitEthernet0/0';
  }
  function enabledDhcp(p,v){
    const raw=(p.dhcp||{})[String(v.vlanId)] || {};
    return !!raw.enabled;
  }
  function dhcpDns(p,v){ const raw=(p.dhcp||{})[String(v.vlanId)] || {}; return clean(raw.dns)||'8.8.8.8 1.1.1.1'; }
  function dhcpLease(p,v){ const raw=(p.dhcp||{})[String(v.vlanId)] || {}; return raw.lease || 1; }
  function vlanComment(v,sn){ return `VLAN ${v.vlanId} ${cliText(v.name||'',48)}${sn&&sn.cidr?' · '+sn.cidr:''}`; }

  function genCiscoRouterAuto(d){
    const p=safeS(); if(!p) return originalGenConfig(d.id,d.vendorOs);
    const lanIf=inferLanPort(p,d), wanIf=inferWanPort(p,d);
    const L=['!',`! ${'═'.repeat(40)}`,`! ${cliText(d.name,80)} — Cisco IOS Router/Firewall`,`! ${'═'.repeat(40)}`,'! Aviso: gateway RoaS inferido automáticamente porque este router no estaba seleccionado en RoaS.','! Revisa Configuración → RoaS/DHCP para fijar explícitamente la interfaz LAN.','configure terminal',`hostname ${cliToken(d.name,'router')}`];
    const ports=portsByDev(p,d.id).sort((a,b)=>clean(a.name).localeCompare(clean(b.name),'es',{numeric:true}));
    if(ports.length){
      L.push('!','! Interfaces físicas');
      ports.forEach(pt=>{
        L.push(`interface ${cliText(pt.name,80)}`);
        if(pt.desc) L.push(` description ${cliText(pt.desc,120)}`);
        if(pt.mode==='routed' && (pt.l3Ip||pt.routedIp) && (pt.l3Cidr||pt.routedCidr)){
          L.push(` ip address ${cliText(pt.l3Ip||pt.routedIp,40)} ${mask(pt.l3Cidr||pt.routedCidr)}`);
        }
        L.push(' no shutdown',' exit');
      });
    }
    if(lanIf && arr(p.vlans).length){
      L.push('!','! RoaS — subinterfaces VLAN inferidas',`interface ${cliText(lanIf,80)}`,' no ip address',' no shutdown',' exit');
      arr(p.vlans).slice().sort((a,b)=>(a.vlanId||0)-(b.vlanId||0)).forEach(v=>{
        const sn=subnetByVlan(p,v.id); if(!sn||!sn.gateway||!sn.cidr) return;
        L.push(`interface ${cliText(lanIf,80)}.${v.vlanId}`,` encapsulation dot1Q ${v.vlanId}`,` description GW_VLAN${v.vlanId}_${cliToken(v.name||'VLAN','VLAN',32)}`,` ip address ${cliText(sn.gateway,40)} ${mask(sn.cidr)}`,' ip nat inside',' no shutdown',' exit');
      });
    }
    const dh=[];
    arr(p.vlans).slice().sort((a,b)=>(a.vlanId||0)-(b.vlanId||0)).forEach(v=>{
      if(!enabledDhcp(p,v)) return;
      const sn=subnetByVlan(p,v.id); if(!sn||!sn.cidr) return;
      const c=parseC(sn.cidr); if(!c) return;
      if(sn.gateway) dh.push(`ip dhcp excluded-address ${sn.gateway}`);
      arr(p.hosts).filter(h=>h.vlanRef===v.id && h.ipMode==='static' && h.staticIp).forEach(h=>dh.push(`ip dhcp excluded-address ${h.staticIp} ! ${cliText(h.name,60)}`));
      dh.push(`ip dhcp pool VLAN${v.vlanId}`,` network ${ip4(c.net)} ${ip4(c.mask)}`);
      if(sn.gateway) dh.push(` default-router ${sn.gateway}`);
      dh.push(` dns-server ${dhcpDns(p,v).replace(/,/g,' ')}`,` lease ${dhcpLease(p,v)}`,' exit');
    });
    if(dh.length) L.push('!','! DHCP Pools',...dh);
    const wanCidr=clean((p.roas||{}).wanCidr), nh=clean((p.roas||{}).wanNh);
    if(d.internetEdge==='yes' && wanIf && wanCidr){ L.push('!','! WAN',`interface ${cliText(wanIf,80)}`,` ip address ${cidrIp(wanCidr)} ${mask(wanCidr)}`,' ip nat outside',' no shutdown',' exit'); }
    if(d.internetEdge==='yes' && nh) L.push('!','! Default route',`ip route 0.0.0.0 0.0.0.0 ${nh}`);
    if(d.internetEdge==='yes' && wanIf) L.push('!','! NAT overload','access-list 100 permit ip any any',`ip nat inside source list 100 interface ${cliText(wanIf,80)} overload`);
    if(typeof root.genFwAcl === 'function'){ const acl=root.genFwAcl(); if(acl) L.push('',acl); }
    L.push('end','write memory','!');
    return L.join('\n')+'\n';
  }

  function genMikrotik(d){
    const p=safeS(); if(!p) return '';
    const lanBridge='bridge-lan'; const wanIf=inferWanPort(p,d);
    const L=[`# ${'═'.repeat(40)}`,`# ${cliText(d.name,80)} — MikroTik RouterOS`,`# ${'═'.repeat(40)}`,'# Plan generado desde NetWizard. Revisar nombres de interfaz antes de aplicar.','/system identity set name="'+quote(d.name||'router',64)+'"','/interface bridge add name='+lanBridge+' vlan-filtering=yes comment="LAN VLAN bridge"'];
    portsByDev(p,d.id).forEach(pt=>{ if(pt.name!==wanIf) L.push(`/interface bridge port add bridge=${lanBridge} interface=${quote(pt.name,64)}`); });
    arr(p.vlans).slice().sort((a,b)=>(a.vlanId||0)-(b.vlanId||0)).forEach(v=>{
      const sn=subnetByVlan(p,v.id);
      L.push(`# ${vlanComment(v,sn)}`);
      L.push(`/interface vlan add name=vlan${v.vlanId} vlan-id=${v.vlanId} interface=${lanBridge}`);
      if(sn&&sn.gateway&&sn.cidr){ const c=parseC(sn.cidr); L.push(`/ip address add address=${sn.gateway}/${c?c.pfx:24} interface=vlan${v.vlanId} comment="${quote(v.name||'VLAN',80)}"`); }
      L.push(`/interface bridge vlan add bridge=${lanBridge} vlan-ids=${v.vlanId} tagged=${lanBridge}`);
      if(enabledDhcp(p,v)&&sn&&sn.cidr){ L.push(`/ip pool add name=pool_vlan${v.vlanId} ranges=${cidrNet(sn.cidr)}-${cidrNet(sn.cidr)}  # Ajustar rango DHCP`, `/ip dhcp-server add name=dhcp_vlan${v.vlanId} interface=vlan${v.vlanId} address-pool=pool_vlan${v.vlanId} disabled=no`, `/ip dhcp-server network add address=${sn.cidr} gateway=${sn.gateway||''} dns-server=${dhcpDns(p,v).replace(/\s+/g,',')}`); }
    });
    if(d.internetEdge==='yes'){ L.push('# WAN / NAT',`/ip dhcp-client add interface=${quote(wanIf,64)} disabled=no`,`/ip firewall nat add chain=srcnat out-interface=${quote(wanIf,64)} action=masquerade comment="NetWizard NAT Internet"`); }
    L.push('# Seguridad mínima recomendada','/ip service disable telnet,ftp,www,api,api-ssl','/ip service set ssh address=0.0.0.0/0  # Limitar a VLAN de gestión en producción');
    return L.join('\n')+'\n';
  }

  function genHuawei(d){
    const p=safeS(); if(!p) return '';
    const lanIf=inferLanPort(p,d), wanIf=inferWanPort(p,d);
    const L=[`# ${'═'.repeat(40)}`,`# ${cliText(d.name,80)} — Huawei VRP`,`# ${'═'.repeat(40)}`,'system-view',`sysname ${cliToken(d.name,'device')}`];
    const vids=arr(p.vlans).map(v=>v.vlanId).filter(Boolean).sort((a,b)=>a-b);
    if(vids.length) L.push(`vlan batch ${vids.join(' ')}`);
    arr(p.vlans).slice().sort((a,b)=>(a.vlanId||0)-(b.vlanId||0)).forEach(v=>{
      const sn=subnetByVlan(p,v.id); L.push(`interface Vlanif${v.vlanId}`);
      if(sn&&sn.gateway&&sn.cidr) L.push(` description ${cliText(v.name||'VLAN',80)}`,` ip address ${sn.gateway} ${mask(sn.cidr)}`);
      L.push('quit');
    });
    if(lanIf){ L.push(`interface ${cliText(lanIf,80)}`,' port link-type trunk'); if(vids.length)L.push(` port trunk allow-pass vlan ${vids.join(' ')}`); L.push('quit'); }
    if(d.internetEdge==='yes'){ L.push(`# WAN: revisar interfaz ${wanIf}`,'# NAT/route pueden variar según modelo/licencia VRP.',`ip route-static 0.0.0.0 0.0.0.0 ${(p.roas||{}).wanNh||'NEXT_HOP_WAN'}`); }
    arr(p.vlans).forEach(v=>{ if(enabledDhcp(p,v)){ const sn=subnetByVlan(p,v.id); if(sn&&sn.gateway) L.push(`dhcp enable`,`interface Vlanif${v.vlanId}`,' dhcp select interface','quit'); } });
    L.push('return'); return L.join('\n')+'\n';
  }

  function genCloudPlan(d,label){
    const p=safeS(); if(!p) return '';
    const ports=portsByDev(p,d.id); const uplink=ports.find(x=>x.mode==='trunk')||ports[0];
    const L=[`# ${'═'.repeat(40)}`,`# ${cliText(d.name,80)} — ${label}`,`# ${'═'.repeat(40)}`,'# Plan neutral. No es CLI directa: aplicar en el controlador/cloud del fabricante.'];
    L.push(`# Modelo: ${cliText(d.model||'—',80)}`,`# Gestión: ${cliText(d.mgmtIp||'sin IP gestión',80)}`,`# Uplink recomendado: ${uplink?cliText(uplink.name,80):'definir puerto uplink'}${uplink&&uplink.mode==='trunk'?' trunk':' trunk recomendado'}`);
    const allowed=(uplink&&arr(uplink.allowedVlans).length)?arr(uplink.allowedVlans):arr(p.vlans).map(v=>v.vlanId);
    L.push(`# VLANs a transportar: ${allowed.join(', ')||'definir'}`);
    arr(p.vlans).slice().sort((a,b)=>(a.vlanId||0)-(b.vlanId||0)).forEach(v=>{ const sn=subnetByVlan(p,v.id); L.push(`- Crear/usar red VLAN ${v.vlanId} "${cliText(v.name||'VLAN',80)}"${sn?` (${sn.cidr}, GW ${sn.gateway||'—'})`:''}`); });
    L.push('- Para SSID IoT: asociar SSID a VLAN IoT, activar aislamiento de clientes y limitar acceso a LAN por firewall.','- Para SSID invitados: VLAN dedicada, solo salida a Internet, sin acceso a redes internas.','- Guardar credenciales como alias/secretAlias, nunca como contraseñas reales dentro del proyecto.');
    return L.join('\n')+'\n';
  }

  function genGenericPlan(d){
    const p=safeS(); if(!p) return '';
    const L=[`# ${'═'.repeat(40)}`,`# ${cliText(d.name,80)} — Plan genérico de configuración`,`# ${'═'.repeat(40)}`,`# Vendor/OS todavía no implementado directamente: ${vendor(d)}`,'# NetWizard genera una guía segura para no dejar el dispositivo sin salida útil.'];
    portsByDev(p,d.id).forEach(pt=>{ L.push(`- Puerto ${cliText(pt.name,80)}: modo=${pt.mode||'—'} rol=${pt.role||'—'} VLAN access=${(vlanByRef(p,pt.accessVlanRef)||{}).vlanId||'—'} allowed=${arr(pt.allowedVlans).join(',')||'—'}`); });
    arr(p.vlans).forEach(v=>{ const sn=subnetByVlan(p,v.id); L.push(`- VLAN ${v.vlanId} ${cliText(v.name||'',60)}: ${sn?sn.cidr:'sin subnet'} GW=${sn&&sn.gateway?sn.gateway:'—'}`); });
    return L.join('\n')+'\n';
  }

  function enhancedGenConfig(devId,format){
    const p=safeS(); const d=p ? devById(p,devId) : null;
    if(!d) return originalGenConfig(devId,format);
    const vo=format||d.vendorOs||'cisco_ios';
    if(vo==='cisco_ios' && isRouterLike(d) && !(p.roas&&p.roas.gwId===d.id)) return genCiscoRouterAuto(d);
    if(vo==='mikrotik_routeros') return genMikrotik(d);
    if(vo==='huawei_vrp') return genHuawei(d);
    if(vo==='ubiquiti_unifi') return genCloudPlan(d,'Ubiquiti UniFi');
    if(vo==='tplink_omada') return genCloudPlan(d,'TP-Link Omada');
    if(vo==='galgus_cloud') return genCloudPlan(d,'Galgus Cloud');
    const out=originalGenConfig(devId,format);
    if(/^! Sin vendor asignado:/i.test(out||'')) return genGenericPlan(d);
    return out;
  }

  try { if(typeof genConfig === 'function') genConfig = enhancedGenConfig; } catch {}
  root.genConfig = enhancedGenConfig;
  root.NetWizardVendorConfigGenerators = {version:'netwizard-vendor-config-generators-v3.49',genConfig:enhancedGenConfig};
})(typeof window !== 'undefined' ? window : globalThis);

/* =========================================================
   NetWizard Connectivity Checker v0.1
   Simulación de reachability tipo ping: IP, VLAN, puerto access,
   gateway/subnet y matriz inter-VLAN. No envía tráfico real.
========================================================= */
(function(){
  'use strict';
  const $=id=>document.getElementById(id);
  const esc=s=>{const sec=window.NetWizardSecurityUtils||window.NetWizardCoreUtils;return sec&&typeof sec.escapeHtml==='function'?sec.escapeHtml(s):String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));};
  function safeS(){try{return S;}catch{return null;}}
  function ipOnly(v){const s=String(v||'').trim();const m=s.match(/(?:DHCP\s*·\s*)?(\d{1,3}(?:\.\d{1,3}){3})/);return m?m[1]:'';}
  function endpointList(){
    const S=safeS(); if(!S)return [];
    const eps=[];
    for(const h of (S.hosts||[])){
      const vlan=(S.vlans||[]).find(v=>v.id===h.vlanRef)||null;
      const ip=(typeof effectiveHostIp==='function')?effectiveHostIp(h):(h.staticIp||'');
      eps.push({kind:'host',id:'host:'+h.id,name:h.name||h.id,type:h.type||'host',vlanRef:h.vlanRef,vlanLabel:vlan?`VLAN ${vlan.vlanId} ${vlan.name}`:'sin VLAN',ipText:ip,ip:ipOnly(ip),raw:h});
    }
    try{
      const st=window.NetWizardIoTEmbedded?.getState?.();
      for(const d of (st?.devices||[])){
        const vlan=(S.vlans||[]).find(v=>v.id===d.vlanRef)||null;
        const idip=ipOnly(d.identifier||'');
        eps.push({kind:'iot',id:'iot:'+d.id,name:d.name||d.id,type:d.tech||d.type||'iot',vlanRef:d.vlanRef,vlanLabel:vlan?`VLAN ${vlan.vlanId} ${vlan.name}`:'sin VLAN',ipText:d.identifier||'sin IP',ip:idip,raw:d});
      }
    }catch{}
    return eps;
  }
  function vlan(ref){const S=safeS();return (S?.vlans||[]).find(v=>v.id===ref)||null;}
  function subnet(ref){const S=safeS();return (S?.subnets||[]).find(s=>s.vlanRef===ref)||null;}
  function portForEndpoint(ep){
    const S=safeS(); if(!S||ep.kind!=='host')return null;
    const h=ep.raw; const p=(S.ports||[]).find(x=>x.id===h.portRef)||null;
    const d=p?(S.devices||[]).find(x=>x.id===p.deviceId):null;
    return {port:p,device:d};
  }
  function portVlanOk(ep){
    if(ep.kind!=='host')return {ok:true,msg:'Dispositivo no cableado o IoT: se valida por VLAN lógica/acceso IoT.'};
    const pp=portForEndpoint(ep);
    if(!pp?.port)return {ok:false,msg:'Host sin puerto físico asignado.'};
    const p=pp.port;
    if(p.mode!=='access')return {ok:false,msg:`El puerto ${p.name} no está en modo access.`};
    if(p.accessVlanRef!==ep.vlanRef)return {ok:false,msg:`El puerto ${p.name} no tiene la VLAN del host.`};
    return {ok:true,msg:`Puerto OK: ${pp.device?.name||'?'} / ${p.name} en access.`};
  }
  function sameSubnet(a,b){
    if(!a.ip||!b.ip)return false;
    const sn=subnet(a.vlanRef); if(!sn||typeof parseCidr!=='function'||typeof ipInSn!=='function')return false;
    return ipInSn(a.ip,sn.cidr)&&ipInSn(b.ip,sn.cidr);
  }
  function hasGateway(ep){const sn=subnet(ep.vlanRef);return !!(sn&&sn.gateway&&sn.cidr);}
  function matrixAllows(a,b){
    const S=safeS(); if(!S)return true;
    const key=`${a.vlanRef}_${b.vlanRef}`;
    return S.vlanMatrix?.[key]!==false;
  }
  function icmpRuleAllows(a,b){
    const S=safeS(); if(!S)return true;
    const rules=(S.fwRules||[]).filter(r=>r.enabled!==false).sort((x,y)=>(x.prio||100)-(y.prio||100));
    if(!rules.length)return true;
    const va=vlan(a.vlanRef), vb=vlan(b.vlanRef);
    for(const r of rules){
      const proto=String(r.proto||'any').toLowerCase();
      if(proto!=='any'&&proto!=='icmp')continue;
      const src=String(r.src||'any').toLowerCase(), dst=String(r.dst||'any').toLowerCase();
      const srcOk=src==='any'||src===(va?.name||'').toLowerCase()||src===String(va?.vlanId||'')||src===`vlan ${va?.vlanId}`.toLowerCase();
      const dstOk=dst==='any'||dst===(vb?.name||'').toLowerCase()||dst===String(vb?.vlanId||'')||dst===`vlan ${vb?.vlanId}`.toLowerCase();
      if(srcOk&&dstOk)return r.action!=='deny';
    }
    return true;
  }
  function simulate(aId,bId){
    const eps=endpointList(); const a=eps.find(e=>e.id===aId), b=eps.find(e=>e.id===bId);
    const steps=[]; let ok=true;
    if(!a||!b)return {ok:false,steps:[{ok:false,msg:'Selecciona origen y destino.'}]};
    if(a.id===b.id)return {ok:false,steps:[{ok:false,msg:'Origen y destino no pueden ser el mismo.'}]};
    if(!a.vlanRef||!b.vlanRef){ok=false;steps.push({ok:false,msg:'Falta VLAN en origen o destino.'});}
    for(const ep of [a,b]){
      const pv=portVlanOk(ep); if(!pv.ok)ok=false; steps.push({ok:pv.ok,msg:`${ep.name}: ${pv.msg}`});
      if(!ep.ip){steps.push({ok:null,msg:`${ep.name}: no hay IP concreta; se valida parcialmente por VLAN/subnet.`});}
    }
    if(a.vlanRef===b.vlanRef){
      if(sameSubnet(a,b)||(!a.ip||!b.ip)){steps.push({ok:true,msg:'Misma VLAN/subnet: debería haber conectividad L2 si ambos puertos/accesos están bien.'});}
      else {ok=false;steps.push({ok:false,msg:'Misma VLAN pero las IP no parecen pertenecer a la misma subnet.'});}
    }else{
      if(!hasGateway(a)||!hasGateway(b)){ok=false;steps.push({ok:false,msg:'Inter-VLAN requiere gateway/subnet en ambas VLANs.'});}
      else steps.push({ok:true,msg:'Gateways de VLAN presentes para routing inter-VLAN.'});
      if(!matrixAllows(a,b)){ok=false;steps.push({ok:false,msg:'La matriz inter-VLAN bloquea este flujo.'});}
      else steps.push({ok:true,msg:'La matriz inter-VLAN permite este flujo.'});
      if(!icmpRuleAllows(a,b)){ok=false;steps.push({ok:false,msg:'Reglas firewall: ICMP aparece bloqueado por una regla deny.'});}
      else steps.push({ok:true,msg:'Reglas firewall: no se detecta bloqueo ICMP explícito.'});
    }
    return {ok,source:a,target:b,steps};
  }
  function clear(el){ if(el) el.textContent=''; }
  function opt(select, value, label){ const o=document.createElement('option'); o.value=String(value||''); o.textContent=String(label||''); select.appendChild(o); }
  function render(){
    const root=$('nwConnectivityChecker'); if(!root)return;
    const eps=endpointList();
    if(!root.dataset.ready){
      root.textContent='';
      const head=document.createElement('div'); head.className='card-h';
      const title=document.createElement('div'); title.className='card-t'; title.textContent='🧪 Verificador de conectividad';
      const refresh=document.createElement('button'); refresh.className='btn bs bsm'; refresh.id='nwConnRefresh'; refresh.type='button'; refresh.textContent='↻ Actualizar';
      head.append(title, refresh); root.appendChild(head);
      const intro=document.createElement('div'); intro.className='co co-ac'; intro.textContent='Simula un ping lógico entre dos endpoints usando IP/subnet, VLAN, puerto access, matriz inter-VLAN y reglas ICMP/firewall. No envía tráfico real.'; root.appendChild(intro);
      const g=document.createElement('div'); g.className='g2';
      const a=document.createElement('div'); const la=document.createElement('label'); la.className='fl'; la.textContent='Origen'; const src=document.createElement('select'); src.id='nwConnSrc'; a.append(la,src);
      const b=document.createElement('div'); const lb=document.createElement('label'); lb.className='fl'; lb.textContent='Destino'; const dst=document.createElement('select'); dst.id='nwConnDst'; b.append(lb,dst);
      g.append(a,b); root.appendChild(g);
      const brow=document.createElement('div'); brow.className='brow'; const runBtn=document.createElement('button'); runBtn.className='btn bp'; runBtn.id='nwConnRun'; runBtn.type='button'; runBtn.textContent='▶ Simular ping'; brow.appendChild(runBtn); root.appendChild(brow);
      const out=document.createElement('div'); out.id='nwConnResult'; out.style.marginTop='10px'; root.appendChild(out);
      root.dataset.ready='1';
      runBtn.onclick=()=>run(); refresh.onclick=()=>render();
    }
    const src=$('nwConnSrc'), dst=$('nwConnDst'); clear(src); clear(dst);
    eps.forEach(e=>{ const label=`${e.name} · ${e.type} · ${e.vlanLabel} · ${e.ipText}`; opt(src,e.id,label); opt(dst,e.id,label); });
    if(eps[1])dst.selectedIndex=1;
  }
  function run(){
    const res=simulate($('nwConnSrc')?.value,$('nwConnDst')?.value);
    const out=$('nwConnResult'); if(!out)return; out.textContent='';
    const cls=res.ok?'co-gn':'co-rd';
    const summary=document.createElement('div'); summary.className='co '+cls;
    const b=document.createElement('b'); b.textContent=res.ok?'PING POSIBLE':'PING NO GARANTIZADO / BLOQUEADO'; summary.appendChild(b);
    if(res.source){ summary.appendChild(document.createElement('br')); summary.appendChild(document.createTextNode(`${res.source.name} → ${res.target.name}`)); }
    out.appendChild(summary);
    (res.steps||[]).forEach(s=>{ const d=document.createElement('div'); d.className='co '+(s.ok===true?'co-gn':s.ok===false?'co-rd':'co-yw'); d.textContent=(s.ok===true?'✓':s.ok===false?'✗':'•')+' '+String(s.msg||''); out.appendChild(d); });
  }
  function inject(){
    const cfg=document.getElementById('pg-cfg'); if(!cfg||$('nwConnectivityChecker'))return;
    const card=document.createElement('div');card.className='card';card.id='nwConnectivityChecker';
    const first=cfg.querySelector('.g2'); if(first)cfg.insertBefore(card,first); else cfg.appendChild(card);
    render();
  }
  document.addEventListener('DOMContentLoaded',()=>setTimeout(inject,100));
  document.addEventListener('click',e=>{if(e.target.closest('[data-step="cfg"]'))setTimeout(()=>{inject();render();},150);});
  window.NetWizardConnectivityChecker={render,simulate,endpointList};
})();
