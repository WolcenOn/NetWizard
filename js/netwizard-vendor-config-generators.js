/* =========================================================
   NetWizard Vendor Config Generators v3.50
   Generación de configuración por fabricante.

   Mantenimiento:
   - Solo devuelve texto para textarea/descarga; no inyecta HTML.
   - Cisco IOS conserva el generador principal cuando RoaS está configurado.
   - Para controladores cloud se genera procedimiento aplicable, no CLI inventada.
   - API Node/browser para tests: createEnhancedGenConfig() e install().
========================================================= */
(function initNetWizardVendorConfigGenerators(root){
  'use strict';

  function arr(v){ return Array.isArray(v) ? v : []; }
  function clean(v){ return String(v == null ? '' : v).trim(); }
  function defaultCliText(v,max=160){ return clean(v).replace(/[\r\n\t]/g,' ').replace(/\s+/g,' ').slice(0,max); }
  function defaultCliToken(v,fallback='item',max=64){ return (defaultCliText(v || fallback,max).replace(/[^A-Za-z0-9_.-]/g,'_').replace(/_+/g,'_').slice(0,max) || fallback); }

  function createEnhancedGenConfig(options){
    const opts = options || {};
    const originalGenConfig = opts.originalGenConfig;
    const getProject = opts.getProject || (() => ({}));
    const getFwAcl = opts.getFwAcl || (() => '');
    const net = opts.netUtils || {};
    const core = opts.coreUtils || root.NetWizardCoreUtils || {};
    const cliText = core.safeCliText || defaultCliText;
    const cliToken = core.safeCliToken || defaultCliToken;

    function quote(v,max=120){ return cliText(v,max).replace(/"/g,"'"); }
    function project(){ return getProject() || {}; }
    function devById(p,id){ return arr(p.devices).find(d=>d.id===id)||null; }
    function portsByDev(p,id){ return arr(p.ports).filter(x=>x.deviceId===id); }
    function vlanByRef(p,ref){ return arr(p.vlans).find(v=>v.id===ref)||null; }
    function subnetByVlan(p,ref){ return arr(p.subnets).find(s=>s.vlanRef===ref)||null; }
    function parseC(cidr){
      if(typeof net.parseCidr === 'function') return net.parseCidr(cidr);
      const m=clean(cidr).match(/^(\d{1,3}(?:\.\d{1,3}){3})\/(\d{1,2})$/); if(!m) return null;
      const parts=m[1].split('.').map(Number); if(parts.some(n=>n<0||n>255)) return null;
      const ip=((parts[0]<<24)>>>0)+(parts[1]<<16)+(parts[2]<<8)+parts[3];
      const pfx=Number(m[2]); if(pfx<0||pfx>32) return null;
      const mask=pfx===0?0:(0xffffffff<<(32-pfx))>>>0;
      const bc=(ip&mask)|(~mask>>>0);
      return {ip:ip>>>0,pfx,mask,net:(ip&mask)>>>0,bc:bc>>>0,cidr:clean(cidr)};
    }
    function ip4(n){
      if(typeof net.ip4s === 'function') return net.ip4s(n>>>0);
      return [n>>>24&255,n>>>16&255,n>>>8&255,n&255].join('.');
    }
    function mask(cidrOrMask){
      if(typeof cidrOrMask === 'number') return ip4(cidrOrMask>>>0);
      const c=parseC(cidrOrMask); return c ? ip4(c.mask) : '255.255.255.0';
    }
    function cidrIp(cidr){ const c=parseC(cidr); return c ? ip4(c.ip) : ''; }
    function cidrNet(cidr){ const c=parseC(cidr); return c ? ip4(c.net) : ''; }
    function prefix(cidr){ const c=parseC(cidr); return c ? c.pfx : 24; }
    function firstUsable(cidr,offset){ const c=parseC(cidr); if(!c) return ''; return ip4((c.net + (offset || 1)) >>> 0); }
    function lastUsable(cidr,offset){ const c=parseC(cidr); if(!c) return ''; return ip4((c.bc - (offset || 1)) >>> 0); }
    function vendor(d){ return clean(d&&d.vendorOs) || 'cisco_ios'; }
    function isRouterLike(d){ return /router|firewall|gateway/i.test(clean(d&&d.type)); }
    function vlanName(v){ return cliToken((v && v.name) || ('VLAN'+(v && v.vlanId || '')), 'VLAN', 32); }
    function enabledDhcp(p,v){ const raw=(p.dhcp||{})[String(v.vlanId)] || {}; return !!raw.enabled; }
    function dhcpDns(p,v){ const raw=(p.dhcp||{})[String(v.vlanId)] || {}; return clean(Array.isArray(raw.dns) ? raw.dns.join(' ') : raw.dns)||'8.8.8.8 1.1.1.1'; }
    function dhcpLease(p,v){ const raw=(p.dhcp||{})[String(v.vlanId)] || {}; return raw.lease || 1; }
    function vlanComment(v,sn){ return `VLAN ${v.vlanId} ${cliText(v.name||'',48)}${sn&&sn.cidr?' · '+sn.cidr:''}`; }
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
    function originalOrEmpty(devId,format){ return originalGenConfig ? originalGenConfig(devId,format) : ''; }
    function isUnsupported(out){ return /^! Sin vendor asignado:/i.test(out||'') || /^# Vendor\/OS todavía no implementado/i.test(out||''); }

    function genCiscoRouterAuto(d){
      const p=project();
      const lanIf=inferLanPort(p,d), wanIf=inferWanPort(p,d);
      const L=['!',`! ${'═'.repeat(40)}`,`! ${cliText(d.name,80)} — Cisco IOS Router/Firewall`,`! ${'═'.repeat(40)}`,'! Aviso: gateway RoaS inferido automáticamente porque este router no estaba seleccionado en RoaS.','! Revisa Configuración → RoaS/DHCP para fijar explícitamente la interfaz LAN.','configure terminal',`hostname ${cliToken(d.name,'router')}`];
      const ports=portsByDev(p,d.id).sort((a,b)=>clean(a.name).localeCompare(clean(b.name),'es',{numeric:true}));
      if(ports.length){
        L.push('!','! Interfaces físicas');
        ports.forEach(pt=>{
          L.push(`interface ${cliText(pt.name,80)}`);
          if(pt.desc) L.push(` description ${cliText(pt.desc,120)}`);
          if(pt.mode==='routed' && (pt.l3Ip||pt.routedIp) && (pt.l3Cidr||pt.routedCidr)) L.push(` ip address ${cliText(pt.l3Ip||pt.routedIp,40)} ${mask(pt.l3Cidr||pt.routedCidr)}`);
          L.push(' no shutdown',' exit');
        });
      }
      if(lanIf && arr(p.vlans).length){
        L.push('!','! RoaS — subinterfaces VLAN',`interface ${cliText(lanIf,80)}`,' no ip address',' no shutdown',' exit');
        arr(p.vlans).slice().sort((a,b)=>(a.vlanId||0)-(b.vlanId||0)).forEach(v=>{
          const sn=subnetByVlan(p,v.id); if(!sn||!sn.gateway||!sn.cidr) return;
          L.push(`interface ${cliText(lanIf,80)}.${v.vlanId}`,` encapsulation dot1Q ${v.vlanId}`,` description GW_VLAN${v.vlanId}_${vlanName(v)}`,` ip address ${cliText(sn.gateway,40)} ${mask(sn.cidr)}`,' ip nat inside',' no shutdown',' exit');
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
      if(d.internetEdge==='yes' && wanIf && wanCidr) L.push('!','! WAN',`interface ${cliText(wanIf,80)}`,` ip address ${cidrIp(wanCidr)} ${mask(wanCidr)}`,' ip nat outside',' no shutdown',' exit');
      if(d.internetEdge==='yes' && nh) L.push('!','! Default route',`ip route 0.0.0.0 0.0.0.0 ${nh}`);
      if(d.internetEdge==='yes' && wanIf) L.push('!','! NAT overload','access-list 100 permit ip any any',`ip nat inside source list 100 interface ${cliText(wanIf,80)} overload`);
      const acl=getFwAcl(); if(acl) L.push('',acl);
      L.push('end','write memory','!');
      return L.join('\n')+'\n';
    }

    function genMikrotik(d){
      const p=project(), lanBridge='bridge-lan', wanIf=inferWanPort(p,d);
      const L=[`# ${'═'.repeat(40)}`,`# ${cliText(d.name,80)} — MikroTik RouterOS`,`# ${'═'.repeat(40)}`,'# Revisar nombres de interfaz antes de aplicar.','/system identity set name="'+quote(d.name||'router',64)+'"','/interface bridge add name='+lanBridge+' vlan-filtering=yes comment="LAN VLAN bridge"'];
      portsByDev(p,d.id).forEach(pt=>{ if(pt.name!==wanIf) L.push(`/interface bridge port add bridge=${lanBridge} interface=${quote(pt.name,64)}`); });
      arr(p.vlans).slice().sort((a,b)=>(a.vlanId||0)-(b.vlanId||0)).forEach(v=>{
        const sn=subnetByVlan(p,v.id);
        L.push(`# ${vlanComment(v,sn)}`);
        L.push(`/interface vlan add name=vlan${v.vlanId} vlan-id=${v.vlanId} interface=${lanBridge}`);
        if(sn&&sn.gateway&&sn.cidr) L.push(`/ip address add address=${sn.gateway}/${prefix(sn.cidr)} interface=vlan${v.vlanId} comment="${quote(v.name||'VLAN',80)}"`);
        L.push(`/interface bridge vlan add bridge=${lanBridge} vlan-ids=${v.vlanId} tagged=${lanBridge}`);
        if(enabledDhcp(p,v)&&sn&&sn.cidr) L.push(`/ip pool add name=pool_vlan${v.vlanId} ranges=${firstUsable(sn.cidr,20)}-${lastUsable(sn.cidr,1)}`, `/ip dhcp-server add name=dhcp_vlan${v.vlanId} interface=vlan${v.vlanId} address-pool=pool_vlan${v.vlanId} disabled=no`, `/ip dhcp-server network add address=${sn.cidr} gateway=${sn.gateway||''} dns-server=${dhcpDns(p,v).replace(/\s+/g,',')}`);
      });
      if(d.internetEdge==='yes') L.push('# WAN / NAT',`/ip dhcp-client add interface=${quote(wanIf,64)} disabled=no`,`/ip firewall nat add chain=srcnat out-interface=${quote(wanIf,64)} action=masquerade comment="NetWizard NAT Internet"`);
      L.push('# Seguridad mínima recomendada','/ip service disable telnet,ftp,www,api,api-ssl','/ip service set ssh address=0.0.0.0/0  # Limitar a VLAN de gestión en producción');
      return L.join('\n')+'\n';
    }

    function genHuawei(d){
      const p=project(), lanIf=inferLanPort(p,d), wanIf=inferWanPort(p,d);
      const L=[`# ${'═'.repeat(40)}`,`# ${cliText(d.name,80)} — Huawei VRP`,`# ${'═'.repeat(40)}`,'system-view',`sysname ${cliToken(d.name,'device')}`];
      const vids=arr(p.vlans).map(v=>v.vlanId).filter(Boolean).sort((a,b)=>a-b);
      if(vids.length) L.push(`vlan batch ${vids.join(' ')}`);
      arr(p.vlans).slice().sort((a,b)=>(a.vlanId||0)-(b.vlanId||0)).forEach(v=>{
        const sn=subnetByVlan(p,v.id); L.push(`interface Vlanif${v.vlanId}`);
        if(sn&&sn.gateway&&sn.cidr) L.push(` description ${cliText(v.name||'VLAN',80)}`,` ip address ${sn.gateway} ${mask(sn.cidr)}`);
        if(enabledDhcp(p,v)) L.push(' dhcp select interface');
        L.push('quit');
      });
      if(vids.length) L.push('dhcp enable');
      if(lanIf){ L.push(`interface ${cliText(lanIf,80)}`,' port link-type trunk'); if(vids.length)L.push(` port trunk allow-pass vlan ${vids.join(' ')}`); L.push('quit'); }
      if(d.internetEdge==='yes') L.push(`# WAN: revisar interfaz ${wanIf}`,'# NAT/route pueden variar según modelo/licencia VRP.',`ip route-static 0.0.0.0 0.0.0.0 ${(p.roas||{}).wanNh||'NEXT_HOP_WAN'}`);
      L.push('return'); return L.join('\n')+'\n';
    }

    function genFortinet(d){
      const p=project(), lanIf=inferLanPort(p,d), wanIf=inferWanPort(p,d);
      const L=[`# ${'═'.repeat(40)}`,`# ${cliText(d.name,80)} — Fortinet FortiGate CLI`,`# ${'═'.repeat(40)}`,'config system global',` set hostname ${cliToken(d.name,'FGT')}`,'end','config system interface'];
      arr(p.vlans).slice().sort((a,b)=>(a.vlanId||0)-(b.vlanId||0)).forEach(v=>{ const sn=subnetByVlan(p,v.id); L.push(` edit "VLAN${v.vlanId}_${vlanName(v)}"`,`  set interface "${quote(lanIf,60)}"`,`  set vlanid ${v.vlanId}`); if(sn&&sn.gateway&&sn.cidr)L.push(`  set ip ${sn.gateway} ${mask(sn.cidr)}`); L.push('  set allowaccess ping https ssh',' next'); });
      L.push('end');
      arr(p.vlans).forEach(v=>{ const sn=subnetByVlan(p,v.id); if(enabledDhcp(p,v)&&sn&&sn.cidr){ L.push('config system dhcp server',' edit 0',`  set interface "VLAN${v.vlanId}_${vlanName(v)}"`,`  set default-gateway ${sn.gateway||firstUsable(sn.cidr,1)}`,'  config ip-range','   edit 1',`    set start-ip ${firstUsable(sn.cidr,20)}`,`    set end-ip ${lastUsable(sn.cidr,1)}`,'   next','  end',' next','end'); } });
      L.push('config firewall address');
      arr(p.vlans).forEach(v=>{ const sn=subnetByVlan(p,v.id); if(sn&&sn.cidr)L.push(` edit "NET_VLAN${v.vlanId}_${vlanName(v)}"`,`  set subnet ${cidrNet(sn.cidr)} ${mask(sn.cidr)}`,' next'); });
      L.push('end');
      if(d.internetEdge==='yes') L.push('config firewall policy',' edit 0','  set name "LAN_to_Internet"','  set srcintf "any"',`  set dstintf "${quote(wanIf,60)}"`,'  set srcaddr "all"','  set dstaddr "all"','  set action accept','  set schedule "always"','  set service "ALL"','  set nat enable',' next','end');
      return L.join('\n')+'\n';
    }

    function genJuniper(d){
      const p=project(), lanIf=inferLanPort(p,d), wanIf=inferWanPort(p,d);
      const L=[`# ${'═'.repeat(40)}`,`# ${cliText(d.name,80)} — Juniper Junos set commands`,`# ${'═'.repeat(40)}`,`set system host-name ${cliToken(d.name,'router')}`];
      arr(p.vlans).slice().sort((a,b)=>(a.vlanId||0)-(b.vlanId||0)).forEach(v=>{ const sn=subnetByVlan(p,v.id); L.push(`set vlans ${vlanName(v)} vlan-id ${v.vlanId}`,`set vlans ${vlanName(v)} l3-interface irb.${v.vlanId}`,`set interfaces ${lanIf} unit 0 family ethernet-switching interface-mode trunk`,`set interfaces ${lanIf} unit 0 family ethernet-switching vlan members ${vlanName(v)}`); if(sn&&sn.gateway&&sn.cidr)L.push(`set interfaces irb unit ${v.vlanId} family inet address ${sn.gateway}/${prefix(sn.cidr)}`); });
      arr(p.vlans).forEach(v=>{ const sn=subnetByVlan(p,v.id); if(enabledDhcp(p,v)&&sn&&sn.cidr)L.push(`set access address-assignment pool VLAN${v.vlanId} family inet network ${sn.cidr}`,`set access address-assignment pool VLAN${v.vlanId} family inet range DHCP low ${firstUsable(sn.cidr,20)}`,`set access address-assignment pool VLAN${v.vlanId} family inet range DHCP high ${lastUsable(sn.cidr,1)}`,`set access address-assignment pool VLAN${v.vlanId} family inet dhcp-attributes router ${sn.gateway}`); });
      if(d.internetEdge==='yes') L.push(`set security nat source rule-set LAN-to-WAN from zone trust`,`set security nat source rule-set LAN-to-WAN to zone untrust`,`set security nat source rule-set LAN-to-WAN rule SRC-NAT match source-address 0.0.0.0/0`,`set security nat source rule-set LAN-to-WAN rule SRC-NAT then source-nat interface`,`set interfaces ${wanIf} unit 0 family inet dhcp`);
      return L.join('\n')+'\n';
    }

    function genAruba(d){
      const p=project();
      const L=[`# ${'═'.repeat(40)}`,`# ${cliText(d.name,80)} — Aruba AOS-Switch`,`# ${'═'.repeat(40)}`,`hostname "${quote(d.name||'aruba',64)}"`];
      arr(p.vlans).slice().sort((a,b)=>(a.vlanId||0)-(b.vlanId||0)).forEach(v=>{ const sn=subnetByVlan(p,v.id); L.push(`vlan ${v.vlanId}`,`   name "${quote(v.name||('VLAN'+v.vlanId),64)}"`); const access=portsByDev(p,d.id).filter(pt=>pt.mode==='access'&&pt.accessVlanRef===v.id).map(pt=>pt.name); const trunks=portsByDev(p,d.id).filter(pt=>pt.mode==='trunk'&&arr(pt.allowedVlans).includes(v.vlanId)).map(pt=>pt.name); if(access.length)L.push(`   untagged ${access.join(',')}`); if(trunks.length)L.push(`   tagged ${trunks.join(',')}`); if(sn&&sn.gateway&&sn.cidr)L.push(`   ip address ${sn.gateway} ${mask(sn.cidr)}`); L.push('   exit'); });
      L.push('write memory'); return L.join('\n')+'\n';
    }

    function genPfsense(d){
      const p=project();
      const lanIf=inferLanPort(p,d), wanIf=inferWanPort(p,d);
      const L=[`# ${'═'.repeat(40)}`,`# ${cliText(d.name,80)} — pfSense CE/Plus configuration artifact`,`# ${'═'.repeat(40)}`,'# pfSense no tiene una CLI universal para crear toda la config persistente.','# Este bloque documenta los cambios a aplicar en GUI/API/config.xml.'];
      L.push(`WAN interface: ${wanIf}`,`LAN parent interface for VLANs: ${lanIf}`);
      arr(p.vlans).slice().sort((a,b)=>(a.vlanId||0)-(b.vlanId||0)).forEach(v=>{ const sn=subnetByVlan(p,v.id); L.push('',`# VLAN ${v.vlanId} ${cliText(v.name||'',64)}`,'<vlan>','  <if>'+cliText(lanIf,80)+'</if>','  <tag>'+v.vlanId+'</tag>','  <descr>VLAN'+v.vlanId+'_'+vlanName(v)+'</descr>','</vlan>'); if(sn&&sn.gateway&&sn.cidr)L.push('Interface IP: '+sn.gateway+'/'+prefix(sn.cidr)); if(enabledDhcp(p,v)&&sn&&sn.cidr)L.push('DHCP range: '+firstUsable(sn.cidr,20)+' - '+lastUsable(sn.cidr,1)); });
      L.push('','Firewall/NAT: crear reglas por VLAN según matriz NetWizard; activar outbound NAT para VLANs con salida Internet.');
      return L.join('\n')+'\n';
    }

    function genCloudPlan(d,label){
      const p=project(), ports=portsByDev(p,d.id), uplink=ports.find(x=>x.mode==='trunk')||ports[0];
      const L=[`# ${'═'.repeat(40)}`,`# ${cliText(d.name,80)} — ${label}`,`# ${'═'.repeat(40)}`,'# Configuración de controlador/cloud. Aplicar en la consola del fabricante.'];
      L.push(`# Modelo: ${cliText(d.model||'—',80)}`,`# Gestión: ${cliText(d.mgmtIp||'sin IP gestión',80)}`,`# Uplink recomendado: ${uplink?cliText(uplink.name,80):'definir puerto uplink'}${uplink&&uplink.mode==='trunk'?' trunk':' trunk recomendado'}`);
      const allowed=(uplink&&arr(uplink.allowedVlans).length)?arr(uplink.allowedVlans):arr(p.vlans).map(v=>v.vlanId);
      L.push(`# VLANs a transportar: ${allowed.join(', ')||'definir'}`);
      arr(p.vlans).slice().sort((a,b)=>(a.vlanId||0)-(b.vlanId||0)).forEach(v=>{ const sn=subnetByVlan(p,v.id); L.push(`- Crear/usar red VLAN ${v.vlanId} "${cliText(v.name||'VLAN',80)}"${sn?` (${sn.cidr}, GW ${sn.gateway||'—'})`:''}`); });
      L.push('- SSID IoT: VLAN IoT, aislamiento de clientes, acceso solo a broker/controlador/DNS/NTP.','- SSID invitados: VLAN dedicada, solo Internet, sin acceso lateral a LAN.','- Guardar credenciales como alias/secretAlias; no exportar contraseñas reales.');
      return L.join('\n')+'\n';
    }

    function genGenericPlan(d){
      const p=project();
      const L=[`# ${'═'.repeat(40)}`,`# ${cliText(d.name,80)} — Configuración genérica`,`# ${'═'.repeat(40)}`,`# Vendor/OS no implementado directamente: ${vendor(d)}`];
      portsByDev(p,d.id).forEach(pt=>{ L.push(`interface ${cliText(pt.name,80)}`,` description ${cliText(pt.desc||pt.role||'',80)}`,` mode ${pt.mode||'—'}`,` access-vlan ${(vlanByRef(p,pt.accessVlanRef)||{}).vlanId||'—'}`,` allowed-vlans ${arr(pt.allowedVlans).join(',')||'—'}`,' exit'); });
      arr(p.vlans).forEach(v=>{ const sn=subnetByVlan(p,v.id); L.push(`vlan ${v.vlanId} name ${cliText(v.name||'',60)} ${sn?sn.cidr:'sin-subnet'} gw=${sn&&sn.gateway?sn.gateway:'—'}`); });
      return L.join('\n')+'\n';
    }

    function enhancedGenConfig(devId,format){
      const p=project(); const d=devById(p,devId);
      if(!d) return originalOrEmpty(devId,format);
      const vo=format||d.vendorOs||'cisco_ios';
      if(vo==='cisco_ios' && isRouterLike(d) && !(p.roas&&p.roas.gwId===d.id)) return genCiscoRouterAuto(d);
      if(vo==='mikrotik_routeros') return genMikrotik(d);
      if(vo==='huawei_vrp') return genHuawei(d);
      if(vo==='fortinet') return genFortinet(d);
      if(vo==='juniper_junos') return genJuniper(d);
      if(vo==='aruba_aoss') return genAruba(d);
      if(vo==='pfsense') return genPfsense(d);
      if(vo==='ubiquiti_unifi') return genCloudPlan(d,'Ubiquiti UniFi');
      if(vo==='tplink_omada') return genCloudPlan(d,'TP-Link Omada');
      if(vo==='galgus_cloud') return genCloudPlan(d,'Galgus Cloud');
      const out=originalOrEmpty(devId,format);
      if(isUnsupported(out)) return genGenericPlan(d);
      return out;
    }

    return enhancedGenConfig;
  }

  function install(options){
    const original = options && options.originalGenConfig ? options.originalGenConfig : ((typeof genConfig === 'function') ? genConfig : root.genConfig);
    if(typeof original !== 'function') return null;
    const enhanced = createEnhancedGenConfig(Object.assign({}, options || {}, {
      originalGenConfig: original,
      getProject: (options && options.getProject) || (() => {
        if(root.NetWizardState && typeof root.NetWizardState.getSnapshot === 'function') return root.NetWizardState.getSnapshot();
        try { return S; } catch { return {}; }
      }),
      getFwAcl: (options && options.getFwAcl) || (() => {
        if(typeof root.genFwAcl === 'function') return root.genFwAcl();
        try { return (typeof genFwAcl === 'function') ? genFwAcl() : ''; } catch { return ''; }
      }),
      netUtils: (options && options.netUtils) || {
        parseCidr: (typeof parseCidr === 'function') ? parseCidr : root.NetWizardNetworkUtils && root.NetWizardNetworkUtils.parseCidr,
        ip4s: (typeof ip4s === 'function') ? ip4s : root.NetWizardNetworkUtils && root.NetWizardNetworkUtils.ip4s
      }
    }));
    try { if(typeof genConfig === 'function') genConfig = enhanced; } catch {}
    root.genConfig = enhanced;
    return enhanced;
  }

  const api = { version:'netwizard-vendor-config-generators-v3.50', createEnhancedGenConfig, install };
  root.NetWizardVendorConfigGenerators = api;
  if(typeof module !== 'undefined' && module.exports) module.exports = api;

  if(typeof document !== 'undefined') install();
})(typeof window !== 'undefined' ? window : globalThis);
