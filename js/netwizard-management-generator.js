/* NetWizard Management Generator v0.2 */
(function initNetWizardManagementGenerator(root){
'use strict';
function arr(v){return Array.isArray(v)?v:[];}
function clean(v){return String(v==null?'':v).trim();}
function req(p){try{return require(p);}catch{return null;}}
function localeOf(options){
  const explicit=options&&options.locale;
  if(clean(explicit))return clean(explicit).toLowerCase()==='en'?'en':'es';
  const i18n=root.NetWizardI18n;
  const current=i18n&&typeof i18n.getReportLocale==='function'?i18n.getReportLocale():'es';
  return clean(current).toLowerCase()==='en'?'en':'es';
}
function pick(options,es,en){return localeOf(options)==='en'?en:es;}
function ip4(n){return[(n>>>24)&255,(n>>>16)&255,(n>>>8)&255,n&255].join('.');}
function cidrAcl(value){
  const m=clean(value).match(/^(\d{1,3}(?:\.\d{1,3}){3})\/(\d|[12]\d|3[0-2])$/);
  if(!m)return null;
  const parts=m[1].split('.').map(Number);
  if(parts.some(x=>x<0||x>255))return null;
  let ip=0;for(const x of parts)ip=((ip<<8)>>>0)+x;
  const p=Number(m[2]),mask=p===0?0:(0xffffffff<<(32-p))>>>0,net=(ip&mask)>>>0,wild=(~mask)>>>0;
  return{network:ip4(net),wildcard:ip4(wild)};
}
function planner(){return root.NetWizardManagementPlan||(typeof require==='function'?req('./netwizard-management-plan.js'):null);}
function secret(alias){return '${SECRET:'+(alias||'missing-alias')+'}';}
function plan(project,id,supplied){return supplied||(planner()&&planner().build?planner().build(project,id):null);}
function cisco(p,options){
  const L=['!','! NW-MGMT-BASELINE — '+pick(options,'configura acceso administrativo, DNS/NTP, logs, AAA y SNMP según el plan de gestión.','configures administrative access, DNS/NTP, logging, AAA, and SNMP from the management plan.'),`ip domain name ${p.domain}`,'ip ssh version 2',`banner motd ^C${p.banner}^C`];
  p.dns.forEach(x=>L.push(`ip name-server ${x}`));
  p.ntp.forEach(x=>L.push(`ntp server ${x}`));
  p.syslog.forEach(x=>L.push(`logging host ${x}`));
  const sources=arr(p.ssh&&p.ssh.sourceNetworks).map(cidrAcl).filter(Boolean);
  if(sources.length){
    L.push('! '+pick(options,'Restringe SSH a las redes de gestión declaradas; el resto queda denegado y registrado.','Restricts SSH to declared management networks; all other sources are denied and logged.'),'ip access-list standard NW_MGMT_SOURCES');
    for(const x of sources)L.push(` permit ${x.network} ${x.wildcard}`);
    L.push(' deny any log',' exit');
  }
  if(p.ssh&&p.ssh.enabled){
    L.push('! '+pick(options,'Aplica la ACL de gestión a VTY y permite únicamente SSH para administración remota.','Applies the management ACL to VTY lines and allows only SSH for remote administration.'),'line vty 0 15');
    if(sources.length)L.push(' access-class NW_MGMT_SOURCES in');
    L.push(' transport input ssh',' exit');
  }
  if(p.aaa.enabled){
    L.push('! '+pick(options,'Activa AAA con RADIUS y conserva autenticación local como fallback operativo.','Enables AAA with RADIUS and keeps local authentication as an operational fallback.'),'aaa new-model');
    p.aaa.servers.forEach((s,i)=>L.push(`radius server NW_RADIUS_${i+1}`,` address ipv4 ${s.address}${s.port?` auth-port ${s.port}`:''}`,` key ${secret(s.secretAlias)}`,' exit'));
    L.push('aaa authentication login default group radius local');
  }
  if(p.snmp.enabled){
    L.push('! '+pick(options,'Configura SNMPv3 authPriv; los alias SECRET deben resolverse antes de aplicar.','Configures SNMPv3 authPriv; SECRET aliases must be resolved before applying.'));
    L.push(`snmp-server group NW-SNMP v3 priv`,`snmp-server user ${p.snmp.user} NW-SNMP v3 auth ${p.snmp.authProtocol.toUpperCase()} ${secret(p.snmp.authSecretAlias)} priv ${p.snmp.privProtocol.toUpperCase()} ${secret(p.snmp.privSecretAlias)}`);
  }
  return L.join('\n');
}
function junos(p,options){
  const L=['# NW-MGMT-BASELINE — '+pick(options,'configura gestión segura, sincronización horaria y observabilidad.','configures secure management, time synchronization, and observability.'),`set system domain-name ${p.domain}`,`set system services ssh protocol-version v2`,`set system login message "${p.banner.replace(/"/g,"'")}"`];
  p.dns.forEach(x=>L.push(`set system name-server ${x}`));p.ntp.forEach(x=>L.push(`set system ntp server ${x}`));p.syslog.forEach(x=>L.push(`set system syslog host ${x} any info`));
  if(p.aaa.enabled){L.push('# '+pick(options,'RADIUS se consulta antes de la contraseña local para mantener fallback administrativo.','RADIUS is checked before local password authentication to retain an administrative fallback.'));p.aaa.servers.forEach(s=>L.push(`set access radius-server ${s.address} secret ${secret(s.secretAlias)}`));L.push('set system authentication-order radius','set system authentication-order password');}
  if(p.snmp.enabled)L.push(`# ${pick(options,'SNMPv3 requiere resolver los alias auth/priv antes de aplicar:','SNMPv3 requires resolving auth/priv aliases before applying:')} ${p.snmp.authSecretAlias} / ${p.snmp.privSecretAlias}`);
  return L.join('\n');
}
function huawei(p,options){
  const L=['# NW-MGMT-BASELINE — '+pick(options,'habilita administración segura y servicios operativos del plano de gestión.','enables secure administration and operational management services.'),'stelnet server enable',`header login information "${p.banner.replace(/"/g,"'")}"`];
  p.dns.forEach(x=>L.push(`dns server ${x}`));p.ntp.forEach(x=>L.push(`ntp-service unicast-server ${x}`));p.syslog.forEach(x=>L.push(`info-center loghost ${x}`));
  if(p.aaa.enabled){L.push('# '+pick(options,'Define servidores RADIUS; sustituye los alias SECRET por secretos gestionados antes de aplicar.','Defines RADIUS servers; replace SECRET aliases with managed secrets before applying.'),'aaa');p.aaa.servers.forEach((s,i)=>L.push(`# radius-server shared-key cipher ${secret(s.secretAlias)}  # ${pick(options,'servidor','server')} ${s.address}`));L.push('quit');}
  if(p.snmp.enabled)L.push('snmp-agent',`# ${pick(options,'Configura usuario SNMPv3 con alias de autenticación/cifrado','Configure SNMPv3 user with authentication/privacy aliases')} ${p.snmp.user}: ${secret(p.snmp.authSecretAlias)} / ${secret(p.snmp.privSecretAlias)}`);
  return L.join('\n');
}
function mikrotik(p,options){
  const L=['# NW-MGMT-BASELINE — '+pick(options,'reduce servicios de administración expuestos y configura DNS/NTP/logs/AAA/SNMP.','reduces exposed management services and configures DNS/NTP/logging/AAA/SNMP.'),'/ip/service/set telnet disabled=yes','/ip/service/set ftp disabled=yes','/ip/service/set www disabled=yes','/ip/service/set api disabled=yes','/ip/service/set ssh disabled=no'];
  p.dns.length&&L.push(`/ip/dns/set servers=${p.dns.join(',')}`);p.ntp.length&&L.push(`/system/ntp/client/set enabled=yes servers=${p.ntp.join(',')}`);p.syslog.forEach((x,i)=>L.push(`/system/logging/action/add name=remote${i+1} target=remote remote=${x}`));if(p.aaa.enabled)p.aaa.servers.forEach(s=>L.push(`/radius/add service=login address=${s.address} secret=${secret(s.secretAlias)}`));if(p.snmp.enabled)L.push('/snmp/set enabled=yes',`/snmp/community/add name=${p.snmp.user} security=private authentication-protocol=${p.snmp.authProtocol} authentication-password=${secret(p.snmp.authSecretAlias)} encryption-protocol=${p.snmp.privProtocol} encryption-password=${secret(p.snmp.privSecretAlias)}`);return L.join('\n');
}
function fortinet(p,options){
  const L=['# NW-MGMT-BASELINE — '+pick(options,'configura identidad, DNS/NTP, syslog, RADIUS y SNMP del plano de gestión.','configures identity, DNS/NTP, syslog, RADIUS, and SNMP for the management plane.'),'config system global',` set hostname "${p.deviceName}"`,'end'];
  p.dns.length&&L.push('config system dns',` set primary ${p.dns[0]}`,p.dns[1]?` set secondary ${p.dns[1]}`:'','end');p.ntp.length&&L.push('config system ntp',' set ntpsync enable',...p.ntp.map((x,i)=>` set server${i+1} "${x}"`),'end');p.syslog.forEach((x,i)=>L.push(`config log syslogd${i?i+1:''} setting`,` set status enable`,` set server "${x}"`,'end'));if(p.aaa.enabled)p.aaa.servers.forEach((s,i)=>L.push('config user radius',` edit "NW_RADIUS_${i+1}"`,`  set server "${s.address}"`,`  set secret ${secret(s.secretAlias)}`,' next','end'));if(p.snmp.enabled)L.push('config system snmp user',` edit "${p.snmp.user}"`,`  set security-level auth-priv`,`  set auth-proto ${p.snmp.authProtocol}`,`  set auth-pwd ${secret(p.snmp.authSecretAlias)}`,`  set priv-proto ${p.snmp.privProtocol}`,`  set priv-pwd ${secret(p.snmp.privSecretAlias)}`,' next','end');return L.filter(Boolean).join('\n');
}
function render(project,id,vendor,supplied,options){const p=plan(project,id,supplied);if(!p)return'';switch(vendor||p.vendorOs){case'cisco_ios':return cisco(p,options);case'juniper_junos':return junos(p,options);case'huawei_vrp':return huawei(p,options);case'mikrotik_routeros':return mikrotik(p,options);case'fortinet':return fortinet(p,options);default:return `# NW-MGMT-BASELINE — ${pick(options,'revisa la implementación específica del vendor para SSH/NTP/Syslog.','review the vendor-specific implementation for SSH/NTP/Syslog.')}\n# SSH=${p.ssh.enabled} NTP=${p.ntp.join(',')} Syslog=${p.syslog.join(',')}`;}}
function append(config,project,id,vendor,supplied,options){const block=render(project,id,vendor,supplied,options);if(!block)return config||'';const text=String(config||'');if(text.includes('NW-MGMT-BASELINE'))return config;return text.replace(/\s*$/,'')+'\n'+block+'\n';}
const api={version:'netwizard-management-generator-v2',render,append,secret};root.NetWizardManagementGenerator=api;if(typeof module!=='undefined'&&module.exports)module.exports=api;
})(typeof window!=='undefined'?window:globalThis);
