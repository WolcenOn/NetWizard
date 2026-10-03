'use strict';

const assert=require('assert');
const Policy=require('../js/netwizard-policy-utils.js');

const project={
  vlans:[
    {id:'v20',vlanId:20,name:'Services',intent:{type:'servers',dhcp:false,internet:false,isolation:'restricted'}},
    {id:'v40',vlanId:40,name:'Cameras',intent:{type:'cameras',dhcp:true,internet:false,isolation:'isolated'}},
    {id:'v70',vlanId:70,name:'IoT',intent:{type:'iot',dhcp:true,internet:true,isolation:'isolated'}}
  ],
  subnets:[
    {id:'s20',vlanRef:'v20',cidr:'10.70.20.0/24',gateway:'10.70.20.1'},
    {id:'s40',vlanRef:'v40',cidr:'10.70.40.0/24',gateway:'10.70.40.1'},
    {id:'s70',vlanRef:'v70',cidr:'10.70.70.0/24',gateway:'10.70.70.1'}
  ],
  dhcp:{
    '40':{enabled:true,dns:'10.70.20.10,1.1.1.1'},
    '70':{enabled:true,dns:'10.70.20.10,10.70.20.11'}
  },
  internalServices:[
    {id:'dns',type:'dns',endpoints:[{ip:'10.70.20.10'},{ip:'10.70.20.11'}]},
    {id:'ntp',type:'ntp',endpoints:[{ip:'10.70.20.10'}]}
  ]
};

for(const ref of ['v40','v70']){
  const vlan=project.vlans.find(v=>v.id===ref);
  const rules=Policy.buildRulesForVlan(project,vlan);
  const denyServices=rules.find(r=>r.action==='deny'&&r.dst==='10.70.20.0/24');
  const dnsPermit=rules.find(r=>r.action==='allow'&&r.dst==='10.70.20.10'&&r.proto==='udp'&&r.port==='53');
  const ntpPermit=rules.find(r=>r.action==='allow'&&r.dst==='10.70.20.10'&&r.proto==='udp'&&r.port==='123');
  assert.ok(denyServices,ref+': debe conservar aislamiento hacia la subnet de servicios');
  assert.ok(dnsPermit,ref+': debe permitir el DNS interno explícito');
  assert.ok(ntpPermit,ref+': debe permitir el NTP interno explícito');
  assert.ok(dnsPermit.prio<denyServices.prio,ref+': DNS interno debe evaluarse antes del deny lateral');
  assert.ok(ntpPermit.prio<denyServices.prio,ref+': NTP interno debe evaluarse antes del deny lateral');
  assert.ok(!rules.some(r=>r.code==='NW-POL-INTERNAL-DNS'&&r.dst==='1.1.1.1'),'DNS externo no debe convertirse en excepción interna previa');
}

const cameraRules=Policy.buildRulesForVlan(project,project.vlans.find(v=>v.id==='v40'));
const cameraDeny=cameraRules.find(r=>r.action==='deny'&&r.dst==='10.70.20.0/24');
const broadVideo=cameraRules.find(r=>r.code==='NW-POL-CAM-SVC'&&r.port==='554,8000,443');
assert.ok(broadVideo.prio>cameraDeny.prio,'el permiso genérico de vídeo no debe saltarse el aislamiento interno');

console.log('✓ Política isolated permite DNS/NTP internos explícitos antes del deny sin abrir lateralidad');
