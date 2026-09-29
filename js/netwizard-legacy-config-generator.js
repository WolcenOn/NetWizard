/* NetWizard extracted legacy browser config generator v1
 * Source/Pages/offline compatibility module.
 * Production Docker excludes this file; cloud generation uses Private Engine.
 */
(function initNetWizardLegacyConfigGenerator(root){
'use strict';

function load(globalName,path){
  if(root&&root[globalName])return root[globalName];
  try{
    if(typeof require==='function'){
      const value=require(path);
      if(value&&root&&!root[globalName])root[globalName]=value;
      return value||{};
    }
  }catch{}
  return {};
}

const NWCore=load('NetWizardCoreUtils','./netwizard-core-utils.js');
const NWU=load('NetWizardNetworkUtils','./netwizard-network-utils.js');
const NWL3=load('NetWizardL3ConfigUtils','./netwizard-l3-config-utils.js');
const NWR=load('NetWizardRoutingUtils','./netwizard-routing-utils.js');
const NWPOL=load('NetWizardPolicyUtils','./netwizard-policy-utils.js');
const NWDHCP=load('NetWizardDhcpUtils','./netwizard-dhcp-utils.js');
const NWDevice=load('NetWizardDeviceModel','./netwizard-device-model.js');

const cleanStr=NWCore.cleanStr||((v)=>(v??'').toString().trim());
const cliText=NWCore.safeCliText||((v,max=160)=>cleanStr(v).replace(/[\r\n\t]/g,' ').replace(/\s+/g,' ').slice(0,max));
const cliToken=NWCore.safeCliToken||((v,fallback='item',max=64)=>(cliText(v||fallback,max).replace(/[^A-Za-z0-9_.-]/g,'_').replace(/_+/g,'_').slice(0,max)||fallback));
const cliQuoted=NWCore.safeQuotedCli||((v,max=160)=>cliText(v,max).replace(/"/g,"'"));
const parseIp=NWU.parseIp||((ip)=>{const p=(ip||'').trim().split('.');if(p.length!==4)return null;let n=0;for(const x of p){if(!/^\d+$/.test(x))return null;const v=+x;if(v<0||v>255)return null;n=(n<<8)|v;}return n>>>0;});
const ip4s=NWU.ip4s||((n)=>{n=n>>>0;return[(n>>>24)&255,(n>>>16)&255,(n>>>8)&255,n&255].join('.');});
const parseCidr=NWU.parseCidr||((cidr)=>{const m=(cidr||'').trim().match(/^(\d{1,3}(?:\.\d{1,3}){3})\/(\d{1,2})$/);if(!m)return null;const ip=parseIp(m[1]);const pfx=+m[2];if(ip===null||pfx>32)return null;const mask=pfx===0?0:(0xFFFFFFFF<<(32-pfx))>>>0;const net=(ip&mask)>>>0;const bc=(net|(~mask>>>0))>>>0;return{ip,pfx,mask,net,bc,fh:pfx>=31?null:(net+1)>>>0,lh:pfx>=31?null:(bc-1)>>>0,cidr:`${ip4s(net)}/${pfx}`};});
const msk=m=>NWCore.maskToString?NWCore.maskToString(m,ip4s):ip4s(m>>>0);
const devKind=d=>NWDevice&&typeof NWDevice.normalizeKind==='function'?NWDevice.normalizeKind(d):(d&&d.kind||d&&d.type||'appliance');
const isSwitchDevice=d=>NWDevice&&typeof NWDevice.isSwitching==='function'?NWDevice.isSwitching(d):devKind(d)==='switch';

let S={devices:[],ports:[],vlans:[],subnets:[],hosts:[],links:[],fwRules:[],vlanMatrix:{},roas:{},dhcp:{},security:{},vtp:{roles:{}}};
const devById=id=>(S.devices||[]).find(d=>d&&d.id===id)||null;
const vByRef=r=>(S.vlans||[]).find(v=>v&&v.id===r)||null;
const vByNum=n=>(S.vlans||[]).find(v=>v&&v.vlanId===n)||null;
const snByVRef=r=>(S.subnets||[]).find(s=>s&&s.vlanRef===r)||null;
const portsByDev=did=>(S.ports||[]).filter(p=>p&&p.deviceId===did);
function getVtpRole(devId){return (S.vtp&&S.vtp.roles&&S.vtp.roles[devId])||'off';}

function withProject(project,fn){
  const previous=S;
  S=project&&typeof project==='object'?project:{};
  try{return fn();}
  finally{S=previous;}
}

// ─────────────────── CONFIG GENERATORS ───────────────────


function l3InterfacesForDevice(d){
  if(NWL3 && typeof NWL3.collectDeviceL3Interfaces==='function') return NWL3.collectDeviceL3Interfaces(S, d.id);
  return portsByDev(d.id).filter(p=>p.l3Ip&&p.l3Cidr).map(p=>({portId:p.id,portName:p.name,ip:p.l3Ip,cidr:p.l3Cidr,mask:'',prefix:null,description:p.desc||''}));
}
function l3ByPortId(d){
  const m={};
  for(const item of l3InterfacesForDevice(d)) m[item.portId]=item;
  return m;
}
function l3Desc(item, fallback){
  const auto=(NWL3 && typeof NWL3.peerDescription==='function') ? NWL3.peerDescription(item) : '';
  return cliText(fallback || auto || 'Transit L3', 160);
}
function ciscoL3Lines(item){
  const out=[];
  if(item && item.description) out.push(` description ${cliText(item.description,160)}`);
  else if(item) out.push(` description ${l3Desc(item)}`);
  if(item && item.ip && item.mask) out.push(` ip address ${item.ip} ${item.mask}`);
  else if(item && item.ip && item.cidr){
    const ci=parseCidr(item.cidr); if(ci) out.push(` ip address ${item.ip} ${msk(ci.mask)}`);
  }
  return out;
}


function staticRoutesForDevice(d){
  if(NWR && typeof NWR.inferStaticRoutes==='function') return NWR.inferStaticRoutes(S, d.id);
  return [];
}
function ciscoStaticRouteLines(d){
  const routes=staticRoutesForDevice(d);
  if(!routes.length)return [];
  const out=['!','! Rutas estáticas inferidas desde enlaces de tránsito L3'];
  for(const r of routes){
    if(r.network && r.mask && r.nextHop) out.push(`ip route ${r.network} ${r.mask} ${r.nextHop} ! ${cliText(r.reason||'',80)}`);
  }
  return out;
}
function asaStaticRouteLines(d){
  const routes=staticRoutesForDevice(d);
  if(!routes.length)return [];
  const out=['!','! Rutas estáticas inferidas desde enlaces de tránsito L3'];
  for(const r of routes){
    if(r.network && r.mask && r.nextHop) out.push(`route ${cliToken(r.outPortName||'outside','outside',64)} ${r.network} ${r.mask} ${r.nextHop} 1 ! ${cliText(r.reason||'',80)}`);
  }
  return out;
}
function juniperStaticRouteLines(d){
  const routes=staticRoutesForDevice(d);
  const out=[];
  for(const r of routes){ if(r.destination && r.nextHop) out.push(`set routing-options static route ${r.destination} next-hop ${r.nextHop}`); }
  return out;
}
function fortigateStaticRouteBlocks(d){
  const routes=staticRoutesForDevice(d);
  const out=[];let idx=1;
  for(const r of routes){
    if(!r.network || !r.mask || !r.nextHop) continue;
    out.push(`config router static`,` edit ${idx++}`,`  set dst ${r.network} ${r.mask}`,`  set gateway ${r.nextHop}`, r.outPortName?`  set device "${cliQuoted(r.outPortName,64)}"`:'', r.peerDeviceName?`  set comment "${cliQuoted('Inferida hacia '+r.peerDeviceName,120)}"`:'',' next','end','');
  }
  return out;
}

function allFirewallRules(){
  if(NWPOL && typeof NWPOL.mergeWithManualRules==='function') return NWPOL.mergeWithManualRules(S);
  return S.fwRules || [];
}
function policyRulesForExport(){
  const rules=allFirewallRules().filter(x=>x.enabled!==false).sort((a,b)=>(a.prio||100)-(b.prio||100));
  if(NWPOL && typeof NWPOL.enrichPolicyRules==='function') return NWPOL.enrichPolicyRules(S,rules);
  return rules;
}
function policyAddressObjectsForExport(rules){
  if(NWPOL && typeof NWPOL.buildAddressObjects==='function') return NWPOL.buildAddressObjects(S,rules||policyRulesForExport());
  return [];
}
function asaAddressObjectLines(rules){
  const out=[]; const objs=policyAddressObjectsForExport(rules);
  if(!objs.length)return out;
  out.push('!','! Objetos de red derivados de VLANs/políticas');
  for(const o of objs){
    out.push(`object network ${cliToken(o.name,'OBJ',60)}`);
    if(o.type==='host'&&o.ip) out.push(` host ${o.ip}`);
    else if(o.subnet&&o.mask) out.push(` subnet ${o.subnet} ${o.mask}`);
    if(o.label) out.push(` description ${cliText(o.label,120)}`);
    out.push(' exit');
  }
  return out;
}
function asaEndpoint(a){
  if(!a||a.kind==='any'||a.raw==='any')return'any';
  if(a.objectName&&a.kind!=='label')return`object ${cliToken(a.objectName,'OBJ',60)}`;
  if(a.kind==='host'&&a.ip)return`host ${a.ip}`;
  return cliText(a.raw||'any',120);
}
function splitPorts(port){return String(port||'any').split(',').map(x=>x.trim()).filter(Boolean);}
function fortigateAddressObjectLines(rules){
  const objs=policyAddressObjectsForExport(rules); const out=[]; if(!objs.length)return out;
  out.push('# Objetos de red derivados de VLANs/políticas');
  for(const o of objs){
    out.push('config firewall address',` edit "${cliQuoted(o.name,60)}"`);
    if(o.type==='host'&&o.ip) out.push(`  set subnet ${o.ip} 255.255.255.255`);
    else if(o.subnet&&o.mask) out.push(`  set subnet ${o.subnet} ${o.mask}`);
    if(o.label) out.push(`  set comment "${cliQuoted(o.label,120)}"`);
    out.push(' next','end','');
  }
  return out;
}
function fortigateZoneLines(){
  if(!NWPOL||typeof NWPOL.buildPolicyContext!=='function')return[];
  const ctx=NWPOL.buildPolicyContext(S); const out=[];
  for(const z of ctx.zones||[]){ if(!z.interfaces||!z.interfaces.length)continue; out.push('config system zone',` edit "${cliQuoted(z.name,60)}"`,`  set interface ${z.interfaces.map(x=>'"'+cliQuoted(x,60)+'"').join(' ')}`,' next','end',''); }
  return out;
}
function fortigateServiceList(r){
  if(r.serviceNames&&r.serviceNames.length)return r.serviceNames.map(x=>'"'+cliQuoted(x,50)+'"').join(' ');
  if(r.proto==='any'||!r.proto)return'"ALL"';
  if(r.proto==='tcp'&&String(r.port)==='80,443')return'"HTTP" "HTTPS"';
  return '"ALL"';
}
function pfsensePolicyContextComments(){
  if(!NWPOL||typeof NWPOL.summarizePolicyContext!=='function')return[];
  return ['', '# Objetos y zonas derivados de VLANs:', ...NWPOL.summarizePolicyContext(S).split('\n').map(l=>'# '+l)];
}

function pfsenseStaticRouteComments(d){
  const routes=staticRoutesForDevice(d);
  if(!routes.length)return [];
  const out=['','# Rutas estáticas inferidas (System → Routing → Static Routes):'];
  for(const r of routes) out.push(`# ${r.destination} via ${r.nextHop}${r.outPortName?' dev '+r.outPortName:''}${r.peerDeviceName?'  # '+r.peerDeviceName:''}`);
  return out;
}

// Cisco IOS Switch
function genCiscoSwitch(d){
  const L=['!',`! ${'═'.repeat(40)}`,`! ${cliText(d.name,80)}  —  Cisco IOS Switch`,`! ${'═'.repeat(40)}`,'configure terminal',`hostname ${cliToken(d.name,'device')}`,'!','! VLANs'];
  const vtp=S.vtp||{};
  const vtpRole=getVtpRole(d.id);
  if(vtpRole!=='off' && (vtp.domain||vtp.password||vtp.version||vtp.pruning==='yes')){
    L.push('!','! VTP');
    if(vtp.domain)L.push(`vtp domain ${cliToken(vtp.domain,'VTP_DOMAIN',64)}`);
    if(vtp.password)L.push(`vtp password ${cliText(vtp.password,64)}`);
    L.push(`vtp mode ${vtpRole}`);
    if(vtp.version)L.push(`vtp version ${vtp.version}`);
    if(vtp.pruning==='yes')L.push('vtp pruning');
  }
  for(const v of S.vlans.slice().sort((a,b)=>a.vlanId-b.vlanId)){
    if(vtpRole==='client') continue;
    L.push(`vlan ${v.vlanId}`);if(v.name)L.push(` name ${cliText(v.name,32)}`);L.push('exit');
  }
  const sec=S.security;
  if(sec.ds==='yes'){const sv=(sec.dsV||'').trim()||S.vlans.map(v=>v.vlanId).join(',');L.push('!','! DHCP Snooping','ip dhcp snooping');if(sv)L.push(`ip dhcp snooping vlan ${sv}`);L.push('no ip dhcp snooping information option');}
  if(sec.dai==='yes'&&S.vlans.length){L.push('!','! DAI',`ip arp inspection vlan ${S.vlans.map(v=>v.vlanId).join(',')}`);}
  const ports=portsByDev(d.id).slice().sort((a,b)=>(a.position??9999)-(b.position??9999)||(a.name.localeCompare(b.name)));
  const l3Map=l3ByPortId(d);
  if(ports.length){L.push('!','! Interfaces');
    for(const p of ports){
      const l3=l3Map[p.id];
      L.push(`interface ${p.name}`);
      if(p.mode==='routed' || l3){
        L.push(' no switchport');
        L.push(...ciscoL3Lines(l3 || {description:p.desc, ip:p.l3Ip||p.routedIp, cidr:p.l3Cidr||p.routedCidr}));
        L.push(' no shutdown',' exit');
        continue;
      }
      if(p.desc)L.push(` description ${cliText(p.desc,160)}`);
      const connH=S.hosts.filter(h=>h.portRef===p.id);
      if(connH.length)L.push(`! Hosts: ${connH.map(h=>`${h.name}${h.staticIp?' ('+h.staticIp+')':''}`).join(', ')}`);
      L.push(' switchport',' switchport nonegotiate');
      if(p.mode==='access'){
        const v=vByRef(p.accessVlanRef);
        L.push(' switchport mode access');
        if(v)L.push(` switchport access vlan ${v.vlanId}`);
        if(sec.bpdu==='yes'){L.push(' spanning-tree portfast',' spanning-tree bpduguard enable');}
        if(sec.ps==='yes'){L.push(' switchport port-security',' switchport port-security maximum 2',' switchport port-security violation restrict',' switchport port-security mac-address sticky');}
        if(sec.ds==='yes')L.push(' no ip dhcp snooping trust');
        if(sec.dai==='yes')L.push(' no ip arp inspection trust');
        if(sec.ipsg==='yes')L.push(' ip verify source');
      }else if(p.mode==='trunk'){
        L.push(' switchport mode trunk');
        const nv=vByRef(p.nativeVlanRef);if(nv)L.push(` switchport trunk native vlan ${nv.vlanId}`);
        const al=(p.allowedVlans||[]).slice().sort((a,b)=>a-b);if(al.length)L.push(` switchport trunk allowed vlan ${al.join(',')}`);
        if(sec.ds==='yes')L.push(' ip dhcp snooping trust');
        if(sec.dai==='yes')L.push(' ip arp inspection trust');
      }
      L.push(' no shutdown',' exit');
    }
  }
  L.push(...ciscoStaticRouteLines(d));
  L.push('end','write memory','!');
  return L.join('\n')+'\n';
}

// Cisco IOS Router
function genCiscoRouter(d){
  const L=['!',`! ${'═'.repeat(40)}`,`! ${cliText(d.name,80)}  —  Cisco IOS Router/Firewall`,`! ${'═'.repeat(40)}`,'configure terminal',`hostname ${cliToken(d.name,'device')}`];
  const ifs=portsByDev(d.id).slice().sort((a,b)=>a.name.localeCompare(b.name));
  const l3Map=l3ByPortId(d);
  if(ifs.length){L.push('!','! Interfaces físicas');for(const p of ifs){const l3=l3Map[p.id];L.push(`interface ${p.name}`);if(p.desc && !l3)L.push(` description ${cliText(p.desc,160)}`);if(l3)L.push(...ciscoL3Lines(l3));L.push(' no shutdown',' exit');}}
  if(S.roas.gwId===d.id){
    const lanIf=(S.roas.lanIf||'').trim();
    if(lanIf){
      L.push('!','! RoaS — subinterfaces VLAN',`interface ${lanIf}`,' no ip address',' no shutdown',' exit');
      for(const v of S.vlans.slice().sort((a,b)=>a.vlanId-b.vlanId)){
        const sn=snByVRef(v.id);if(!sn?.gateway)continue;
        const ci=parseCidr(sn.cidr);const mask=ci?msk(ci.mask):'255.255.255.0';
        L.push(`interface ${lanIf}.${v.vlanId}`,` encapsulation dot1Q ${v.vlanId}${S.roas.natVRef===v.id?' native':''}`);
        L.push(` description GW_VLAN${v.vlanId}_${cliToken(v.name||'VLAN', 'VLAN', 32)}`,` ip address ${sn.gateway} ${mask}`,' ip nat inside',' no shutdown',' exit');
      }
    }
    // DHCP
    const dhL=[];
    for(const v of S.vlans.slice().sort((a,b)=>a.vlanId-b.vlanId)){
      const rawCfg=S.dhcp[String(v.vlanId)];
      const cfg=NWDHCP?NWDHCP.normalizeDhcpConfig(rawCfg):rawCfg;
      if(!cfg?.enabled)continue;
      const sn=snByVRef(v.id);if(!sn)continue;
      const ci=parseCidr(sn.cidr);if(!ci?.fh)continue;
      const exclusions=NWDHCP?NWDHCP.excludedRangesForCisco(S,v,cfg):[];
      if(exclusions.length){
        for(const ex of exclusions){
          if(ex.start===ex.end)dhL.push(`ip dhcp excluded-address ${ex.start}`);
          else dhL.push(`ip dhcp excluded-address ${ex.start} ${ex.end}`);
        }
      }else{
        if(sn.gateway)dhL.push(`ip dhcp excluded-address ${sn.gateway}`);
        for(const h of S.hosts.filter(hx=>hx.vlanRef===v.id&&hx.ipMode==='static'&&hx.staticIp))dhL.push(`ip dhcp excluded-address ${h.staticIp} ! ${cliText(h.name,80)}`);
      }
      dhL.push(`ip dhcp pool VLAN${v.vlanId}`,` network ${ip4s(ci.net)} ${msk(ci.mask)}`);
      if(sn.gateway)dhL.push(` default-router ${sn.gateway}`);
      const dns=(cfg.dns||'').trim();if(dns)dhL.push(` dns-server ${dns.replace(/,/g,' ')}`);
      if(cfg.domain)dhL.push(` domain-name ${cliText(cfg.domain,120)}`);
      dhL.push(` lease ${cfg.lease||1}`,' exit');
    }
    if(dhL.length)L.push('!','! DHCP Pools',...dhL);
    // WAN + NAT
    const wanCidr=(S.roas.wanCidr||'').trim();const nh=(S.roas.wanNh||'').trim();const wanIf=(d.wanIf||'').trim();
    if(d.internetEdge==='yes'&&wanIf&&wanCidr){const ci=parseCidr(wanCidr);if(ci)L.push('!','! WAN',`interface ${wanIf}`,` ip address ${ip4s(ci.ip)} ${msk(ci.mask)}`,' ip nat outside',' no shutdown',' exit');}
    if(d.internetEdge==='yes'&&nh)L.push('!','! Default route',`ip route 0.0.0.0 0.0.0.0 ${nh}`);
    if(d.internetEdge==='yes'&&wanIf)L.push('!','! NAT overload','access-list 100 permit ip any any',`ip nat inside source list 100 interface ${wanIf} overload`);
    // Static hosts table
    const stH=S.hosts.filter(h=>h.ipMode==='static'&&h.staticIp);
    if(stH.length){L.push('!','! Hosts con IP estática (para referencia)');for(const h of stH){const v=vByRef(h.vlanRef);L.push(`! ${cliText(h.name,24).padEnd(24)} ${(h.staticIp||'').padEnd(15)} VLAN:${v?.vlanId||'?'} MAC:${cliText(h.mac||'-',32)}`);}
    }
    // FW ACLs
    const fwAcl=genFwAcl();if(fwAcl)L.push('',fwAcl);
  }
  L.push(...ciscoStaticRouteLines(d));
  L.push('end','write memory','!');
  return L.join('\n')+'\n';
}

// Cisco ASA
function genCiscoAsa(d){
  const L=['!',`! ${cliText(d.name,80)}  —  Cisco ASA`,'!',`hostname ${cliToken(d.name,'device')}`,'!'];
  for(const v of S.vlans.slice().sort((a,b)=>a.vlanId-b.vlanId)){
    const sn=snByVRef(v.id);
    L.push(`interface GigabitEthernet0/0.${v.vlanId}`,` vlan ${v.vlanId}`,` nameif vlan${v.vlanId}`,` security-level 100`,sn?.gateway?` ip address ${sn.gateway} ${parseCidr(sn.cidr)?msk(parseCidr(sn.cidr).mask):'255.255.255.0'}`:'',` no shutdown`,' exit');
  }
  L.push('! WAN',`interface GigabitEthernet0/0`,' nameif outside',' security-level 0');
  if(S.roas.wanCidr){const ci=parseCidr(S.roas.wanCidr);if(ci)L.push(` ip address ${ip4s(ci.ip)} ${msk(ci.mask)}`);}
  L.push(' no shutdown',' exit');
  const prules=policyRulesForExport();
  L.push('!','! NAT','object network OBJ_ANY',' subnet 0.0.0.0 0.0.0.0',' nat (inside,outside) dynamic interface');
  L.push(...asaAddressObjectLines(prules));
  L.push('!','! ACLs derivadas de reglas manuales e intención VLAN');
  for(const r of prules){
    const act=r.action==='deny'?'deny':'permit';
    const proto=r.proto==='any'?'ip':(r.proto==='tcp_udp'?'tcp':r.proto||'ip');
    const ports=(r.port&&r.port!=='any')?splitPorts(r.port):[''];
    for(const pp of ports){
      L.push(`access-list OUTSIDE_IN extended ${act} ${proto} ${asaEndpoint(r.srcResolved)} ${asaEndpoint(r.dstResolved)}${pp?' eq '+cliText(pp,30):''} ! ${cliText(r.name||'',80)}`);
      if(r.proto==='tcp_udp') L.push(`access-list OUTSIDE_IN extended ${act} udp ${asaEndpoint(r.srcResolved)} ${asaEndpoint(r.dstResolved)}${pp?' eq '+cliText(pp,30):''} ! ${cliText(r.name||'',80)} [UDP]`);
    }
  }
  L.push(...asaStaticRouteLines(d));
  L.push('access-group OUTSIDE_IN in interface outside','write memory','!');
  return L.join('\n')+'\n';
}

// Juniper Junos
function genJuniper(d){
  const sJn=v=>(v.name||`VLAN${v.vlanId}`).replace(/[^A-Za-z0-9_-]/g,'_');
  const L=[`# ${'═'.repeat(40)}`,`# ${cliText(d.name,80)}  —  Juniper Junos`,`# ${'═'.repeat(40)}`,''];
  for(const v of S.vlans.slice().sort((a,b)=>a.vlanId-b.vlanId))L.push(`set vlans ${sJn(v)} vlan-id ${v.vlanId}`);
  L.push('');
  if(d.type==='router'&&S.roas.gwId===d.id){
    const lanIf=(S.roas.lanIf||'ge-0/0/0').replace(/\./g,'');
    for(const v of S.vlans.slice().sort((a,b)=>a.vlanId-b.vlanId)){const sn=snByVRef(v.id);if(!sn?.gateway)continue;const ci=parseCidr(sn.cidr);L.push(`set interfaces ${lanIf} unit ${v.vlanId} vlan-id ${v.vlanId}`,`set interfaces ${lanIf} unit ${v.vlanId} family inet address ${sn.gateway}/${ci?.pfx||24}`,'');}
  }
  const l3Map=l3ByPortId(d);
  for(const p of portsByDev(d.id).slice().sort((a,b)=>(a.position??9999)-(b.position??9999))){
    const l3=l3Map[p.id];
    if(l3){
      const desc=l3.description || l3Desc(l3);
      if(desc)L.push(`set interfaces ${p.name} description "${cliQuoted(desc,120)}"`);
      L.push(`set interfaces ${p.name} unit 0 family inet address ${l3.ip}/${l3.prefix || 30}`,'');
      continue;
    }
    L.push(`set interfaces ${p.name} unit 0 family ethernet-switching`);
    if(p.mode==='access'){L.push(`set interfaces ${p.name} unit 0 family ethernet-switching port-mode access`);const v=vByRef(p.accessVlanRef);if(v)L.push(`set interfaces ${p.name} unit 0 family ethernet-switching vlan members ${sJn(v)}`);}
    else if(p.mode==='trunk'){L.push(`set interfaces ${p.name} unit 0 family ethernet-switching port-mode trunk`);for(const vid of(p.allowedVlans||[])){const v=vByNum(vid);L.push(`set interfaces ${p.name} unit 0 family ethernet-switching vlan members ${v?sJn(v):'VLAN'+vid}`);}}
    L.push('');
  }
  const rt=juniperStaticRouteLines(d); if(rt.length)L.push('',...rt);
  return L.join('\n').trimEnd()+'\n';
}

// Aruba AOS-S
function genAruba(d){
  const L=[`hostname "${cliQuoted(d.name,64)}"`,`! ${'═'.repeat(40)} Aruba AOS-S`];
  for(const v of S.vlans.slice().sort((a,b)=>a.vlanId-b.vlanId)){L.push(`vlan ${v.vlanId}`);if(v.name)L.push(` name "${cliQuoted(v.name,64)}"`);L.push('exit','!');}
  for(const p of portsByDev(d.id).slice().sort((a,b)=>(a.position??9999)-(b.position??9999))){
    L.push(`interface ${p.name}`);if(p.desc)L.push(` name "${cliQuoted(p.desc,120)}"`);
    if(p.mode==='access'){const v=vByRef(p.accessVlanRef);L.push(` untagged vlan ${v?v.vlanId:1}`);}
    else if(p.mode==='trunk'){const al=(p.allowedVlans||[]).slice().sort((a,b)=>a-b);if(al.length)L.push(` tagged vlan ${al.join(',')}`);}
    L.push('exit','!');
  }
  return L.join('\n')+'\n';
}

// pfSense
function genPfSense(d){
  const L=[`# ${'═'.repeat(40)}`,`# ${cliText(d.name,80)}  —  pfSense`,`# ${'═'.repeat(40)}`,`# Configurar en GUI: Interfaces → Assignments + VLAN Tags`,''];
  const lanBase=(S.roas.lanIf||'em1').replace(/\.\d+$/,'');
  L.push(`# Interfaz LAN principal: ${lanBase}`);
  for(const v of S.vlans.slice().sort((a,b)=>a.vlanId-b.vlanId)){const sn=snByVRef(v.id);L.push(`# VLAN ${v.vlanId} (${v.name||''}): Parent=${lanBase}  VLAN-ID=${v.vlanId}  GW=${sn?.gateway||'?'}  Subnet=${sn?.cidr||'?'}`);}
  const l3=l3InterfacesForDevice(d);
  if(l3.length){L.push('','# Interfaces L3 de tránsito detectadas:');for(const it of l3)L.push(`# ${it.portName}: ${it.ip}/${it.prefix||'?'}  ${it.peerDeviceName?('↔ '+it.peerDeviceName+' '+(it.peerPortName||'')):''}  ${it.vlanId?('VLAN '+it.vlanId):''}`);}
  L.push(...pfsenseStaticRouteComments(d));
  L.push(...pfsensePolicyContextComments());
  L.push('','# Reglas de firewall (pfSense rules via GUI o config.xml):');
  for(const r of policyRulesForExport())L.push(`# [${String(r.action||'').toUpperCase()}] ${r.srcObject||r.src} (${r.srcZone||'any'}) → ${r.dstObject||r.dst} (${r.dstZone||'any'})  service:${(r.serviceNames||[]).join(',')||r.proto+':'+(r.port||'any')}  | ${r.generatedFromIntent?'[intent] ':''}${r.name||''}`);
  L.push('','# DHCP (Services → DHCP Server, una sección por VLAN):');
  for(const v of S.vlans){
    const cfg=NWDHCP?NWDHCP.normalizeDhcpConfig(S.dhcp[String(v.vlanId)]):S.dhcp[String(v.vlanId)];
    if(!cfg?.enabled)continue;const sn=snByVRef(v.id);
    L.push(`# VLAN ${v.vlanId}: subnet=${sn?.cidr}  gateway=${sn?.gateway}  range=${cfg.start||'?'}-${cfg.end||'?'}  dns=${cfg.dns||'8.8.8.8'}  lease=${cfg.lease||1}d`);
  }
  return L.join('\n')+'\n';
}

// FortiGate
function genFortigate(d){
  const L=[`# ${'═'.repeat(40)}`,`# ${cliText(d.name,80)}  —  FortiGate`,`# ${'═'.repeat(40)}`,''];
  const lanBase=S.roas.lanIf||'port2';
  const prules=policyRulesForExport();
  L.push(...fortigateAddressObjectLines(prules));
  L.push(...fortigateZoneLines());
  for(const v of S.vlans.slice().sort((a,b)=>a.vlanId-b.vlanId)){
    const sn=snByVRef(v.id);const ci=sn?parseCidr(sn.cidr):null;const mask=ci?msk(ci.mask):'255.255.255.0';
    L.push(`config system interface`,` edit "VLAN${v.vlanId}"`,`  set vdom "root"`,`  set type vlan`,`  set vlanid ${v.vlanId}`,`  set interface "${lanBase}"`,`  set mode static`,`  set ip ${sn?.gateway||'10.0.0.1'} ${mask}`,`  set allowaccess ping ssh`,' next','end','');
  }
  for(const it of l3InterfacesForDevice(d)){
    L.push(`config system interface`,` edit "${it.portName}"`,`  set vdom "root"`,`  set mode static`,`  set ip ${it.ip} ${it.mask || '255.255.255.252'}`,`  set allowaccess ping ssh`, it.peerDeviceName?`  set description "${cliQuoted(l3Desc(it),120)}"`:'',' next','end','');
  }
  let dhId=1;
  for(const v of S.vlans.slice().sort((a,b)=>a.vlanId-b.vlanId)){
    const cfg=NWDHCP?NWDHCP.normalizeDhcpConfig(S.dhcp[String(v.vlanId)]):S.dhcp[String(v.vlanId)];
    const sn=snByVRef(v.id);const ci=sn?parseCidr(sn.cidr):null;
    if(!cfg?.enabled||!sn||!ci||!cfg.start||!cfg.end)continue;
    L.push(`config system dhcp server`,` edit ${dhId++}`,`  set interface "VLAN${v.vlanId}"`,`  set default-gateway ${sn.gateway||ip4s(ci.fh||ci.net)}`,`  set netmask ${msk(ci.mask)}`,`  set lease-time ${(cfg.lease||1)*86400}`);
    if(cfg.dns)L.push(`  set dns-server1 ${String(cfg.dns).split(',')[0].trim()}`);
    L.push(`  config ip-range`,`   edit 1`,`    set start-ip ${cfg.start}`,`    set end-ip ${cfg.end}`,`   next`,`  end`,` next`,`end`,'');
  }
  L.push(...fortigateStaticRouteBlocks(d));
  let pnum=1;
  for(const r of prules){
    const act=r.action==='deny'?'deny':'accept';
    L.push(`config firewall policy`,` edit ${pnum++}`,`  set name "${cliQuoted(r.name||'rule'+pnum,80)}"`,`  set srcintf "${cliQuoted(r.srcZone&&r.srcZone!=='any'?'ZONE_'+String(r.srcZone).toUpperCase():(r.srcInterface||'any'),60)}"`,`  set dstintf "${cliQuoted(r.dstZone&&r.dstZone!=='any'?'ZONE_'+String(r.dstZone).toUpperCase():(r.dstInterface||'any'),60)}"`,`  set srcaddr "${cliQuoted(r.srcObject==='all'?'all':(r.srcObject||r.src||'all'),60)}"`,`  set dstaddr "${cliQuoted(r.dstObject==='all'?'all':(r.dstObject||r.dst||'all'),60)}"`,`  set action ${act}`,`  set service ${fortigateServiceList(r)}`,`  set logtraffic all`,' next','end','');
  }
  return L.join('\n')+'\n';
}

// Windows Server (static IP config)
function genWindowsServer(d){
  const L=[`# ${'═'.repeat(40)}`,`# ${cliText(d.name,80)}  —  Windows Server / Windows 10+`,`# PowerShell commands`,`# ${'═'.repeat(40)}`,''];
  // Find hosts of type server
  const servers=S.hosts.filter(h=>h.type==='server'&&h.staticIp);
  if(servers.length){
    for(const h of servers){
      const v=vByRef(h.vlanRef);const sn=snByVRef(h.vlanRef);const ci=sn?parseCidr(sn.cidr):null;
      L.push(`# Host: ${cliText(h.name,80)}${v?' (VLAN '+v.vlanId+')':''}`,`$adapter = Get-NetAdapter | Select-Object -First 1`);
      if(h.staticIp){L.push(`New-NetIPAddress -InterfaceIndex $adapter.ifIndex \\`,`    -IPAddress "${h.staticIp}" \\`,`    -PrefixLength ${ci?.pfx||24} \\`,`    -DefaultGateway "${sn?.gateway||'10.0.0.1'}"`);
      L.push(`Set-DnsClientServerAddress -InterfaceIndex $adapter.ifIndex \\`,`    -ServerAddresses "8.8.8.8","8.8.4.4"`);}
      L.push('# Firewall rules (PowerShell):',`New-NetFirewallRule -DisplayName "${cliQuoted(h.name,60)} HTTP" -Direction Inbound -Protocol TCP -LocalPort 80,443 -Action Allow`,'');
    }
  } else {
    L.push('# No hay servidores con IP estática definidos.');
    L.push('# Ejemplo de configuración estática (PowerShell):','');
    L.push('$adapter = Get-NetAdapter | Where-Object {$_.Status -eq "Up"} | Select-Object -First 1','New-NetIPAddress -InterfaceIndex $adapter.ifIndex \\','    -IPAddress "10.10.10.10" \\','    -PrefixLength 24 \\','    -DefaultGateway "10.10.10.1"','Set-DnsClientServerAddress -InterfaceIndex $adapter.ifIndex \\','    -ServerAddresses "8.8.8.8","8.8.4.4"');
  }
  L.push('','# Unir al dominio (si aplica):','# Add-Computer -DomainName "miempresa.local" -Restart','','# Habilitar RDP:','Set-ItemProperty -Path "HKLM:\\System\\CurrentControlSet\\Control\\Terminal Server" -Name "fDenyTSConnections" -Value 0','Enable-NetFirewallRule -DisplayGroup "Remote Desktop"');
  return L.join('\n')+'\n';
}

// Linux (ip addr / systemd-networkd / iptables)
function genLinux(d){
  const L=[`# ${'═'.repeat(40)}`,`# ${cliText(d.name,80)}  —  Linux (Ubuntu/Debian/RHEL)`,`# ${'═'.repeat(40)}`,''];
  const servers=S.hosts.filter(h=>(h.type==='server'||h.type==='ap')&&h.staticIp);
  if(servers.length){
    for(const h of servers){
      const v=vByRef(h.vlanRef);const sn=snByVRef(h.vlanRef);const ci=sn?parseCidr(sn.cidr):null;
      L.push(`# Host: ${cliText(h.name,80)}${v?' — VLAN '+v.vlanId:''}`,`# ── ip command (temporal) ──`);
      if(h.staticIp)L.push(`ip addr add ${h.staticIp}/${ci?.pfx||24} dev eth0`,`ip route add default via ${sn?.gateway||'10.0.0.1'}`);
      L.push('','# ── /etc/network/interfaces (Debian/Ubuntu) ──','auto eth0','iface eth0 inet static',`    address ${h.staticIp||'10.0.0.10'}/${ci?.pfx||24}`,`    gateway ${sn?.gateway||'10.0.0.1'}`,`    dns-nameservers 8.8.8.8 8.8.4.4`,'');
      L.push('# ── systemd-networkd (/etc/systemd/network/10-eth0.network) ──','[Match]','Name=eth0','','[Network]',`Address=${h.staticIp||'10.0.0.10'}/${ci?.pfx||24}`,`Gateway=${sn?.gateway||'10.0.0.1'}`,'DNS=8.8.8.8','','systemctl restart systemd-networkd','');
    }
  } else {
    L.push('# No hay servidores Linux definidos. Ejemplo genérico:','');
    L.push('# Configurar IP estática:','ip addr add 10.10.10.10/24 dev eth0','ip route add default via 10.10.10.1','','# Configuración permanente (/etc/netplan/01-netcfg.yaml):','network:','  version: 2','  ethernets:','    eth0:','      addresses: [10.10.10.10/24]','      routes:','        - to: default','          via: 10.10.10.1','      nameservers:','        addresses: [8.8.8.8]','','netplan apply','');
  }
  // iptables for FW rules
  if(S.fwRules.length){
    L.push('# ── iptables / nftables (firewall) ──','iptables -F  # limpiar reglas','iptables -P INPUT DROP','iptables -P FORWARD DROP','iptables -P OUTPUT ACCEPT','iptables -A INPUT -m state --state ESTABLISHED,RELATED -j ACCEPT','iptables -A INPUT -i lo -j ACCEPT');
    for(const r of allFirewallRules().filter(x=>x.enabled!==false&&x.action!=='deny').sort((a,b)=>(a.prio||100)-(b.prio||100))){
      const proto=r.proto==='any'?'':` -p ${r.proto}`;const port=r.port&&r.port!=='any'?` --dport ${r.port.split(',')[0]}`:'';
      L.push(`iptables -A INPUT${proto}${port} -j ACCEPT  # ${cliText(r.name||'',80)}`);
    }
    L.push('iptables-save > /etc/iptables/rules.v4');
  }
  return L.join('\n')+'\n';
}


function genFwAcl(){
  const rules=policyRulesForExport();
  if(!rules.length)return'';
  const L=['!','! FW Policy ACL','ip access-list extended FW_POLICY'];
  for(const r of rules){
    const action=r.action==='deny'?'deny':'permit';
    const proto=r.proto==='any'?'ip':(r.proto==='tcp_udp'?null:r.proto);
    const srcA=r.src==='any'?'any':r.src.includes('/')?formatWild(r.src):`host ${r.src}`;
    const dstA=r.dst==='any'?'any':r.dst.includes('/')?formatWild(r.dst):`host ${r.dst}`;
    const ports=(r.port&&r.port!=='any')?splitPorts(r.port):[''];
    for(const pp of ports){
      const port=pp?` eq ${pp}`:'';
      if(proto){L.push(` ${action} ${proto} ${srcA} ${dstA}${port}${r.action==='log'?' log':''} ! ${cliText(r.name||'',80)}`);}
      else{L.push(` ${action} tcp ${srcA} ${dstA}${port} ! ${cliText(r.name||'',80)} [TCP]`);L.push(` ${action} udp ${srcA} ${dstA}${port} ! ${cliText(r.name||'',80)} [UDP]`);}
    }
  }
  L.push(' deny ip any any log ! Implicit deny');
  return L.join('\n');
}
function formatWild(cidr){const c=parseCidr(cidr);if(!c)return cidr;return`${ip4s(c.net)} ${ip4s(~c.mask>>>0)}`;}


function genConfig(devId,format){
  const d=devById(devId);if(!d)return'';
  const vo=format||d.vendorOs;
  if(vo==='cisco_ios')return isSwitchDevice(d)?genCiscoSwitch(d):genCiscoRouter(d);
  if(vo==='cisco_asa')return genCiscoAsa(d);
  if(vo==='juniper_junos')return genJuniper(d);
  if(vo==='aruba_aoss')return genAruba(d);
  if(vo==='pfsense')return genPfSense(d);
  if(vo==='fortinet')return genFortigate(d);
  if(vo==='windows')return genWindowsServer(d);
  if(vo==='linux')return genLinux(d);
  return`! Sin vendor asignado: ${d.name}\n`;
}

function generate(project,deviceId,format){
  return withProject(project,()=>genConfig(deviceId,format));
}
function firewallAcl(project){
  return withProject(project,()=>genFwAcl());
}

const api={
  version:'netwizard-legacy-config-generator-v1',
  generate,
  genFwAcl:firewallAcl
};
root.NetWizardLegacyConfigGenerator=api;
if(typeof module!=='undefined'&&module.exports)module.exports=api;
})(typeof window!=='undefined'?window:globalThis);
