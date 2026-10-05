'use strict';

const assert=require('assert');
const fs=require('fs');
const path=require('path');
const {spawnSync}=require('child_process');

const root=path.resolve(__dirname,'..');
const store=new Map();
global.localStorage={
  getItem:key=>store.has(key)?store.get(key):null,
  setItem:(key,value)=>store.set(key,String(value)),
  removeItem:key=>store.delete(key)
};

delete require.cache[require.resolve('../js/netwizard-i18n.js')];
const I18N=require('../js/netwizard-i18n.js');
global.NetWizardI18n=I18N;

delete require.cache[require.resolve('../js/netwizard-network-utils.js')];
delete require.cache[require.resolve('../js/netwizard-dhcp-utils.js')];
const Network=require('../js/netwizard-network-utils.js');
const Dhcp=require('../js/netwizard-dhcp-utils.js');

const es=JSON.parse(fs.readFileSync(path.join(root,'i18n','es.json'),'utf8'));
const en=JSON.parse(fs.readFileSync(path.join(root,'i18n','en.json'),'utf8'));
assert.deepStrictEqual(Object.keys(es).sort(),Object.keys(en).sort(),'ES y EN deben mantener paridad exacta');

for(const key of [
  'vlan.page.title','vlan.actions.add','subnet.form.title','subnet.quick.title',
  'subnet.validation.invalidCidr','roas.apply','dhcp.title','dhcp.actions.validate',
  'dhcp.validation.noSubnet','dhcp.change.poolCompleted'
]){
  assert.ok(es[key],key+' falta en ES');
  assert.ok(en[key],key+' falta en EN');
  assert.ok(I18N.dictionaries.es[key],key+' falta en bundle ES');
  assert.ok(I18N.dictionaries.en[key],key+' falta en bundle EN');
}

const subnets=[];
I18N.setLocale('es');
let r=Network.validateSubnetAssignment({vlanRef:'v1',cidr:'bad',gateway:''},subnets,{locale:'es'});
assert.strictEqual(r.code,'invalid_cidr');
assert.strictEqual(r.msg,'CIDR inválido. Usa formato tipo 10.10.10.0/24.');
assert.strictEqual(r.messageKey,'subnet.validation.invalidCidr');

r=Network.validateSubnetAssignment({vlanRef:'v1',cidr:'10.10.10.1/24',gateway:'10.10.10.1'},subnets,{locale:'en'});
assert.strictEqual(r.ok,true);
assert.strictEqual(r.cidr,'10.10.10.0/24');
assert.strictEqual(r.msg,'CIDR normalized to 10.10.10.0/24.');

const project={
  vlans:[{id:'v1',vlanId:10,name:'Users'}],
  subnets:[],
  hosts:[],
  dhcp:{'10':{enabled:true,start:'10.10.10.20',end:'10.10.10.100',dns:'8.8.8.8',lease:1}}
};
let audit=Dhcp.validateDhcpForProject(project,{locale:'es'});
assert.strictEqual(audit.ok,false);
assert.strictEqual(audit.issues[0].code,'NW-DHCP-011');
assert.strictEqual(audit.issues[0].message,'VLAN 10: DHCP activo sin subnet válida.');
assert.strictEqual(audit.issues[0].messageKey,'dhcp.validation.noSubnet');

audit=Dhcp.validateDhcpForProject(project,{locale:'en'});
assert.strictEqual(audit.issues[0].message,'VLAN 10: DHCP enabled without a valid subnet.');

const proposalProject={
  vlans:[{id:'v1',vlanId:10,name:'Users',intent:{type:'users'}}],
  subnets:[{id:'s1',vlanRef:'v1',cidr:'10.10.10.0/24',gateway:'10.10.10.1'}],
  hosts:[],
  dhcp:{}
};
const proposal=Dhcp.proposeDhcpForProject(proposalProject,{locale:'en'});
assert.ok(proposal.changes.some(x=>/Enable DHCP on VLAN 10/.test(x)),proposal.changes.join('\n'));

const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
for(const key of ['vlan.form.title','subnet.quick.hint','vlan.services.title','roas.hint','dhcp.title','dhcp.hint']){
  assert.ok(html.includes('data-i18n="'+key+'"'),'Falta contrato HTML '+key);
}

const auditRun=spawnSync(process.execPath,['scripts/i18n-audit-hardcoded.js','--check'],{cwd:root,encoding:'utf8'});
assert.strictEqual(auditRun.status,0,(auditRun.stdout||'')+'\n'+(auditRun.stderr||''));

console.log('✓ Beta i18n: VLAN/Subnets/RoaS/DHCP tienen ES/EN completo y guardrail estricto');
