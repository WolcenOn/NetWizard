/* NetWizard Management Plan v0.1 */
(function initNetWizardManagementPlan(root){
'use strict';
function arr(v){return Array.isArray(v)?v:[];} function obj(v){return v&&typeof v==='object'&&!Array.isArray(v)?v:{};} function clean(v){return String(v==null?'':v).trim();}
function build(project,deviceId){
 const p=project||{}, d=arr(p.devices).find(x=>x.id===deviceId)||null, m=obj(p.management), dm=obj(d&&d.management);
 if(!d)return null;
 const merged=Object.assign({},m,dm);
 const plan={version:'netwizard-management-plan-v1',deviceId:d.id,deviceName:clean(d.name||d.id),vendorOs:clean(d.vendorOs),domain:clean(merged.domain||p.domain||'local'),ssh:{enabled:merged.ssh!==false,version:2,sourceNetworks:arr(merged.sourceNetworks)},aaa:{enabled:!!merged.aaa,protocol:clean(merged.aaaProtocol||'radius').toLowerCase(),servers:arr(merged.aaaServers).map(s=>({address:clean(s.address||s.host),secretAlias:clean(s.secretAlias),port:Number(s.port||0)})).filter(s=>s.address),localFallback:merged.localFallback!==false},snmp:{enabled:!!merged.snmpv3,user:clean(merged.snmpUser||'netwizard-monitor'),authProtocol:clean(merged.snmpAuthProtocol||'sha'),privProtocol:clean(merged.snmpPrivProtocol||'aes'),authSecretAlias:clean(merged.snmpAuthSecretAlias),privSecretAlias:clean(merged.snmpPrivSecretAlias)},syslog:arr(merged.syslogServers).map(clean).filter(Boolean),ntp:arr(merged.ntpServers).map(clean).filter(Boolean),dns:arr(merged.dnsServers).map(clean).filter(Boolean),banner:clean(merged.banner||'Acceso restringido. Actividad monitorizada.'),backup:{enabled:!!merged.backup,server:clean(merged.backupServer),protocol:clean(merged.backupProtocol||'sftp'),credentialAlias:clean(merged.backupCredentialAlias)},warnings:[]};
 if(plan.aaa.enabled&&!plan.aaa.servers.length)plan.warnings.push('AAA habilitado sin servidores declarados.');
 if(plan.aaa.servers.some(s=>!s.secretAlias))plan.warnings.push('Servidor AAA sin secretAlias.');
 if(plan.snmp.enabled&&(!plan.snmp.authSecretAlias||!plan.snmp.privSecretAlias))plan.warnings.push('SNMPv3 requiere alias de secretos de autenticación y privacidad.');
 if(plan.backup.enabled&&(!plan.backup.server||!plan.backup.credentialAlias))plan.warnings.push('Backup habilitado sin servidor o credentialAlias.');
 return plan;
}
const api={version:'netwizard-management-plan-v1',build};root.NetWizardManagementPlan=api;if(typeof module!=='undefined'&&module.exports)module.exports=api;
})(typeof window!=='undefined'?window:globalThis);
