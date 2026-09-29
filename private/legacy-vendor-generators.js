'use strict';

const Core=require('../js/netwizard-core-utils.js');
const Network=require('../js/netwizard-network-utils.js');
const Policy=require('../js/netwizard-policy-utils.js');
const Routing=require('../js/netwizard-routing-utils.js');

const VERSION='netwizard-private-legacy-vendors-v1';

function arr(v){return Array.isArray(v)?v:[];}
function obj(v){return v&&typeof v==='object'&&!Array.isArray(v)?v:{};}
const cliText=Core.safeCliText||((v,max=160)=>String(v==null?'':v).trim().replace(/[\r\n\t]/g,' ').replace(/\s+/g,' ').slice(0,max));
const cliToken=Core.safeCliToken||((v,fallback='item',max=64)=>(cliText(v||fallback,max).replace(/[^A-Za-z0-9_.-]/g,'_').replace(/_+/g,'_').slice(0,max)||fallback));
const cliQuoted=Core.safeQuotedCli||((v,max=160)=>cliText(v,max).replace(/"/g,"'"));

function vlanByRef(project,ref){return arr(project&&project.vlans).find(v=>v&&v.id===ref)||null;}
function subnetByVlan(project,ref){return arr(project&&project.subnets).find(s=>s&&s.vlanRef===ref)||null;}
function mask(cidr){
  const parsed=Network.parseCidr(cidr);
  return parsed?Network.ip4s(parsed.mask):'255.255.255.0';
}
function policyRules(project){
  const merged=Policy.mergeWithManualRules(project).filter(x=>x&&x.enabled!==false).sort((a,b)=>(a.prio||100)-(b.prio||100));
  return Policy.enrichPolicyRules(project,merged);
}
function splitPorts(value){return String(value||'any').split(',').map(x=>x.trim()).filter(Boolean);}
function managedHost(project,device){
  const matches=arr(project&&project.hosts).filter(h=>h&&h.deviceRef===device.id);
  return matches.length===1?matches[0]:null;
}
function asaEndpoint(address){
  if(!address||address.kind==='any'||address.raw==='any')return'any';
  if(address.objectName&&address.kind!=='label')return 'object '+cliToken(address.objectName,'OBJ',60);
  if(address.kind==='host'&&address.ip)return 'host '+address.ip;
  return cliText(address.raw||'any',120);
}
function asaAddressObjectLines(project,rules){
  const out=[],objects=Policy.buildAddressObjects(project,rules);
  if(!objects.length)return out;
  out.push('!','! Objetos de red derivados de VLANs/políticas');
  for(const item of objects){
    out.push('object network '+cliToken(item.name,'OBJ',60));
    if(item.type==='host'&&item.ip)out.push(' host '+item.ip);
    else if(item.subnet&&item.mask)out.push(' subnet '+item.subnet+' '+item.mask);
    if(item.label)out.push(' description '+cliText(item.label,120));
    out.push(' exit');
  }
  return out;
}
function asaStaticRouteLines(project,device){
  const routes=Routing.inferStaticRoutes(project,device.id);
  if(!routes.length)return[];
  const out=['!','! Rutas estáticas inferidas desde enlaces de tránsito L3'];
  for(const route of routes){
    if(route.network&&route.mask&&route.nextHop){
      out.push('route '+cliToken(route.outPortName||'outside','outside',64)+' '+route.network+' '+route.mask+' '+route.nextHop+' 1 ! '+cliText(route.reason||'',80));
    }
  }
  return out;
}

function renderCiscoAsa(project,device){
  const p=obj(project),d=obj(device);
  const lines=['!','! '+cliText(d.name,80)+'  —  Cisco ASA','!','hostname '+cliToken(d.name,'device'),'!'];
  for(const vlan of arr(p.vlans).slice().sort((a,b)=>(a.vlanId||0)-(b.vlanId||0))){
    const subnet=subnetByVlan(p,vlan.id);
    lines.push(
      'interface GigabitEthernet0/0.'+vlan.vlanId,
      ' vlan '+vlan.vlanId,
      ' nameif vlan'+vlan.vlanId,
      ' security-level 100',
      subnet&&subnet.gateway?' ip address '+subnet.gateway+' '+mask(subnet.cidr):'',
      ' no shutdown',
      ' exit'
    );
  }
  lines.push('! WAN','interface GigabitEthernet0/0',' nameif outside',' security-level 0');
  const wanCidr=String(p.roas&&p.roas.wanCidr||'').trim();
  if(wanCidr){
    const parsed=Network.parseCidr(wanCidr);
    if(parsed)lines.push(' ip address '+Network.ip4s(parsed.ip)+' '+Network.ip4s(parsed.mask));
  }
  lines.push(' no shutdown',' exit');

  const rules=policyRules(p);
  lines.push('!','! NAT','object network OBJ_ANY',' subnet 0.0.0.0 0.0.0.0',' nat (inside,outside) dynamic interface');
  lines.push(...asaAddressObjectLines(p,rules));
  lines.push('!','! ACLs derivadas de reglas manuales e intención VLAN');
  for(const rule of rules){
    const action=rule.action==='deny'?'deny':'permit';
    const proto=rule.proto==='any'?'ip':(rule.proto==='tcp_udp'?'tcp':rule.proto||'ip');
    const ports=(rule.port&&rule.port!=='any')?splitPorts(rule.port):[''];
    for(const port of ports){
      lines.push(
        'access-list OUTSIDE_IN extended '+action+' '+proto+' '+asaEndpoint(rule.srcResolved)+' '+asaEndpoint(rule.dstResolved)+
        (port?' eq '+cliText(port,30):'')+' ! '+cliText(rule.name||'',80)
      );
      if(rule.proto==='tcp_udp'){
        lines.push(
          'access-list OUTSIDE_IN extended '+action+' udp '+asaEndpoint(rule.srcResolved)+' '+asaEndpoint(rule.dstResolved)+
          (port?' eq '+cliText(port,30):'')+' ! '+cliText(rule.name||'',80)+' [UDP]'
        );
      }
    }
  }
  lines.push(...asaStaticRouteLines(p,d));
  lines.push('access-group OUTSIDE_IN in interface outside','write memory','!');
  return lines.join('\n')+'\n';
}

function renderWindows(project,device){
  const p=obj(project),d=obj(device),host=managedHost(p,d);
  if(!host)return'';
  const vlan=vlanByRef(p,host.vlanRef),subnet=subnetByVlan(p,host.vlanRef),parsed=subnet?Network.parseCidr(subnet.cidr):null;
  const lines=[
    '# '+('═'.repeat(40)),
    '# '+cliText(d.name,80)+' — Windows Server / Windows',
    '# Host lógico: '+cliText(host.name,80)+(vlan?' · VLAN '+vlan.vlanId:''),
    '# Requiere indicar -InterfaceAlias al ejecutar.',
    '# '+('═'.repeat(40)),
    'param([Parameter(Mandatory=$true)][string]$InterfaceAlias)',
    '$adapter = Get-NetAdapter -Name $InterfaceAlias -ErrorAction Stop'
  ];
  if(host.ipMode==='static'&&host.staticIp&&subnet&&parsed&&subnet.gateway){
    lines.push(
      'Set-NetIPInterface -InterfaceIndex $adapter.ifIndex -Dhcp Disabled',
      'Get-NetIPAddress -InterfaceIndex $adapter.ifIndex -AddressFamily IPv4 -ErrorAction SilentlyContinue | Remove-NetIPAddress -Confirm:$false',
      'New-NetIPAddress -InterfaceIndex $adapter.ifIndex -IPAddress "'+host.staticIp+'" -PrefixLength '+parsed.pfx+' -DefaultGateway "'+subnet.gateway+'"'
    );
    const dhcp=obj(p.dhcp)[String(vlan&&vlan.vlanId||'')],dns=String(dhcp&&dhcp.dns||'').split(/[\s,]+/).filter(Boolean);
    if(dns.length)lines.push('Set-DnsClientServerAddress -InterfaceIndex $adapter.ifIndex -ServerAddresses '+dns.map(x=>'"'+cliQuoted(x,80)+'"').join(','));
  }else{
    lines.push(
      'Set-NetIPInterface -InterfaceIndex $adapter.ifIndex -Dhcp Enabled',
      'Set-DnsClientServerAddress -InterfaceIndex $adapter.ifIndex -ResetServerAddresses'
    );
  }
  lines.push('Get-NetIPConfiguration -InterfaceIndex $adapter.ifIndex');
  return lines.join('\n')+'\n';
}

function renderLinux(project,device){
  const p=obj(project),d=obj(device),host=managedHost(p,d);
  if(!host)return'';
  const vlan=vlanByRef(p,host.vlanRef),subnet=subnetByVlan(p,host.vlanRef),parsed=subnet?Network.parseCidr(subnet.cidr):null;
  const lines=[
    '#!/bin/sh',
    'set -eu',
    '# '+('═'.repeat(40)),
    '# '+cliText(d.name,80)+' — Linux network configuration',
    '# Host lógico: '+cliText(host.name,80)+(vlan?' · VLAN '+vlan.vlanId:''),
    '# Define NET_IFACE con la interfaz real antes de ejecutar.',
    '# '+('═'.repeat(40)),
    ': "${NET_IFACE:?Define NET_IFACE, por ejemplo NET_IFACE=ens18}"'
  ];
  if(host.ipMode==='static'&&host.staticIp&&subnet&&parsed&&subnet.gateway){
    lines.push(
      'ip link set "$NET_IFACE" up',
      'ip addr flush dev "$NET_IFACE"',
      'ip addr add '+host.staticIp+'/'+parsed.pfx+' dev "$NET_IFACE"',
      'ip route replace default via '+subnet.gateway+' dev "$NET_IFACE"'
    );
  }else{
    lines.push(
      '# DHCP: se intenta con dhclient; adapta este bloque si el sistema usa NetworkManager/systemd-networkd.',
      'command -v dhclient >/dev/null 2>&1 || { echo "dhclient no disponible; configura DHCP con el gestor de red del sistema" >&2; exit 2; }',
      'dhclient -v "$NET_IFACE"'
    );
  }
  lines.push('ip -4 addr show dev "$NET_IFACE"','ip route show');
  return lines.join('\n')+'\n';
}

function render(project,deviceId,vendor){
  const p=obj(project),device=arr(p.devices).find(d=>d&&d.id===deviceId)||null;
  if(!device)return'';
  const v=String(vendor||device.vendorOs||'').trim().toLowerCase();
  if(v==='cisco_asa')return renderCiscoAsa(p,device);
  if(v==='windows')return renderWindows(p,device);
  if(v==='linux')return renderLinux(p,device);
  return'';
}

module.exports={VERSION,render,renderCiscoAsa,renderWindows,renderLinux,policyRules,asaEndpoint,managedHost};
