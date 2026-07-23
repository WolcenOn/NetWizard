'use strict';
const assert=require('assert');
const Plan=require('../js/netwizard-management-plan.js');
const Generator=require('../js/netwizard-management-generator.js');
function project(vendor){return{management:{domain:'corp.example',aaa:true,aaaProtocol:'radius',aaaServers:[{address:'10.0.0.10',secretAlias:'radius-primary'}],snmpv3:true,snmpUser:'nwmon',snmpAuthSecretAlias:'snmp-auth',snmpPrivSecretAlias:'snmp-priv',syslogServers:['10.0.0.20'],ntpServers:['10.0.0.30'],dnsServers:['10.0.0.40'],backup:true,backupServer:'10.0.0.50',backupCredentialAlias:'backup-sftp'},devices:[{id:'d1',name:'EDGE-01',type:'router',vendorOs:vendor}]};}
function test(name,fn){try{fn();console.log('✓ '+name);}catch(e){console.error('✗ '+name);throw e;}}
test('Plan neutral conserva servicios y alias sin secretos reales',()=>{const p=Plan.build(project('cisco_ios'),'d1');assert.strictEqual(p.aaa.servers[0].secretAlias,'radius-primary');assert.strictEqual(p.snmp.authSecretAlias,'snmp-auth');assert.ok(!JSON.stringify(p).includes('real-password'));});
test('Cisco genera AAA, SSH, NTP, Syslog y SNMPv3 con placeholders',()=>{const out=Generator.render(project('cisco_ios'),'d1','cisco_ios');assert.ok(out.includes('aaa new-model'));assert.ok(out.includes('ip ssh version 2'));assert.ok(out.includes('ntp server 10.0.0.30'));assert.ok(out.includes('logging host 10.0.0.20'));assert.ok(out.includes('${SECRET:radius-primary}'));assert.ok(out.includes('snmp-server user nwmon'));});
test('Junos, Huawei, MikroTik y FortiGate generan bloques propios',()=>{for(const v of ['juniper_junos','huawei_vrp','mikrotik_routeros','fortinet']){const out=Generator.render(project(v),'d1',v);assert.ok(out.length>80,v);assert.ok(out.includes('10.0.0.30'),v);assert.ok(out.includes('${SECRET:radius-primary}'),v);}});
test('Generador no duplica el bloque de gestión',()=>{const p=project('cisco_ios');const once=Generator.append('hostname EDGE-01',p,'d1','cisco_ios');const twice=Generator.append(once,p,'d1','cisco_ios');assert.strictEqual(once,twice);});
console.log('\nTests management generator completados.');
