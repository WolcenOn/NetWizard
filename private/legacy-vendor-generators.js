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
  const p=obj(project),d=obj(device);
  const lines=['# '+('═'.repeat(40)),'# '+cliText(d.name,80)+'  —  Windows Server / Windows 10+','# PowerShell commands','# '+('═'.repeat(40)),''];
  const servers=arr(p.hosts).filter(h=>h&&h.type==='server'&&h.staticIp);
  if(servers.length){
    for(const host of servers){
      const vlan=vlanByRef(p,host.vlanRef),subnet=subnetByVlan(p,host.vlanRef),parsed=subnet?Network.parseCidr(subnet.cidr):null;
      lines.push('# Host: '+cliText(host.name,80)+(vlan?' (VLAN '+vlan.vlanId+')':''),'$adapter = Get-NetAdapter | Select-Object -First 1');
      if(host.staticIp){
        lines.push(
          'New-NetIPAddress -InterfaceIndex $adapter.ifIndex \\',
          '    -IPAddress "'+host.staticIp+'" \\',
          '    -PrefixLength '+(parsed&&parsed.pfx||24)+' \\',
          '    -DefaultGateway "'+(subnet&&subnet.gateway||'10.0.0.1')+'"',
          'Set-DnsClientServerAddress -InterfaceIndex $adapter.ifIndex \\',
          '    -ServerAddresses "8.8.8.8","8.8.4.4"'
        );
      }
      lines.push(
        '# Firewall rules (PowerShell):',
        'New-NetFirewallRule -DisplayName "'+cliQuoted(host.name,60)+' HTTP" -Direction Inbound -Protocol TCP -LocalPort 80,443 -Action Allow',
        ''
      );
    }
  }else{
    lines.push(
      '# No hay servidores con IP estática definidos.',
      '# Ejemplo de configuración estática (PowerShell):','',
      '$adapter = Get-NetAdapter | Where-Object {$_.Status -eq "Up"} | Select-Object -First 1',
      'New-NetIPAddress -InterfaceIndex $adapter.ifIndex \\',
      '    -IPAddress "10.10.10.10" \\',
      '    -PrefixLength 24 \\',
      '    -DefaultGateway "10.10.10.1"',
      'Set-DnsClientServerAddress -InterfaceIndex $adapter.ifIndex \\',
      '    -ServerAddresses "8.8.8.8","8.8.4.4"'
    );
  }
  lines.push(
    '',
    '# Unir al dominio (si aplica):',
    '# Add-Computer -DomainName "miempresa.local" -Restart',
    '',
    '# Habilitar RDP:',
    'Set-ItemProperty -Path "HKLM:\\System\\CurrentControlSet\\Control\\Terminal Server" -Name "fDenyTSConnections" -Value 0',
    'Enable-NetFirewallRule -DisplayGroup "Remote Desktop"'
  );
  return lines.join('\n')+'\n';
}

function renderLinux(project,device){
  const p=obj(project),d=obj(device);
  const lines=['# '+('═'.repeat(40)),'# '+cliText(d.name,80)+'  —  Linux (Ubuntu/Debian/RHEL)','# '+('═'.repeat(40)),''];
  const servers=arr(p.hosts).filter(h=>h&&(h.type==='server'||h.type==='ap')&&h.staticIp);
  if(servers.length){
    for(const host of servers){
      const vlan=vlanByRef(p,host.vlanRef),subnet=subnetByVlan(p,host.vlanRef),parsed=subnet?Network.parseCidr(subnet.cidr):null;
      lines.push('# Host: '+cliText(host.name,80)+(vlan?' — VLAN '+vlan.vlanId:''),'# ── ip command (temporal) ──');
      if(host.staticIp)lines.push('ip addr add '+host.staticIp+'/'+(parsed&&parsed.pfx||24)+' dev eth0','ip route add default via '+(subnet&&subnet.gateway||'10.0.0.1'));
      lines.push(
        '',
        '# ── /etc/network/interfaces (Debian/Ubuntu) ──',
        'auto eth0','iface eth0 inet static',
        '    address '+(host.staticIp||'10.0.0.10')+'/'+(parsed&&parsed.pfx||24),
        '    gateway '+(subnet&&subnet.gateway||'10.0.0.1'),
        '    dns-nameservers 8.8.8.8 8.8.4.4',
        '',
        '# ── systemd-networkd (/etc/systemd/network/10-eth0.network) ──',
        '[Match]','Name=eth0','','[Network]',
        'Address='+(host.staticIp||'10.0.0.10')+'/'+(parsed&&parsed.pfx||24),
        'Gateway='+(subnet&&subnet.gateway||'10.0.0.1'),
        'DNS=8.8.8.8','','systemctl restart systemd-networkd',''
      );
    }
  }else{
    lines.push(
      '# No hay servidores Linux definidos. Ejemplo genérico:','',
      '# Configurar IP estática:','ip addr add 10.10.10.10/24 dev eth0','ip route add default via 10.10.10.1','',
      '# Configuración permanente (/etc/netplan/01-netcfg.yaml):',
      'network:','  version: 2','  ethernets:','    eth0:','      addresses: [10.10.10.10/24]',
      '      routes:','        - to: default','          via: 10.10.10.1',
      '      nameservers:','        addresses: [8.8.8.8]','','netplan apply',''
    );
  }
  if(arr(p.fwRules).length){
    lines.push(
      '# ── iptables / nftables (firewall) ──',
      'iptables -F  # limpiar reglas',
      'iptables -P INPUT DROP',
      'iptables -P FORWARD DROP',
      'iptables -P OUTPUT ACCEPT',
      'iptables -A INPUT -m state --state ESTABLISHED,RELATED -j ACCEPT',
      'iptables -A INPUT -i lo -j ACCEPT'
    );
    for(const rule of Policy.mergeWithManualRules(p).filter(x=>x&&x.enabled!==false&&x.action!=='deny').sort((a,b)=>(a.prio||100)-(b.prio||100))){
      const proto=rule.proto==='any'?'':' -p '+rule.proto;
      const port=rule.port&&rule.port!=='any'?' --dport '+String(rule.port).split(',')[0]:'';
      lines.push('iptables -A INPUT'+proto+port+' -j ACCEPT  # '+cliText(rule.name||'',80));
    }
    lines.push('iptables-save > /etc/iptables/rules.v4');
  }
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

module.exports={VERSION,render,renderCiscoAsa,renderWindows,renderLinux,policyRules,asaEndpoint};
