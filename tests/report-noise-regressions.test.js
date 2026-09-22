'use strict';
const assert=require('assert');
require('../js/netwizard-audit.js');
const Planner=require('../js/netwizard-vlsm-physical-planner.js');
const Vendor=require('../js/netwizard-vendor-hardening.js');
const Gate=require('../js/netwizard-production-gate.js');

const project={
  devices:[
    {id:'fw1',name:'FW-01',type:'firewall',kind:'firewall',vendorOs:'pfsense'},
    {id:'sw1',name:'SW-01',type:'switch',kind:'switch',vendorOs:'cisco_ios',poeBudgetW:0}
  ],
  vlans:[
    {id:'v20',vlanId:20,name:'WiFi'},
    {id:'v40',vlanId:40,name:'Voz'},
    {id:'v999',vlanId:999,name:'Cuarentena',intent:{type:'quarantine'}}
  ],
  subnets:[
    {id:'sn20',vlanRef:'v20',cidr:'10.20.0.0/24',gateway:'10.20.0.1'},
    {id:'sn40',vlanRef:'v40',cidr:'10.40.0.0/24',gateway:'10.40.0.1'}
  ],
  ports:[
    {id:'p-ap',deviceId:'sw1',name:'Gi1/0/10',mode:'trunk',allowedVlans:[20,999],nativeVlanRef:'v999'},
    {id:'p-phone',deviceId:'sw1',name:'Gi1/0/11',mode:'access',accessVlanRef:'v40',poeMode:'none'}
  ],
  hosts:[
    {id:'ap1',name:'AP-01',type:'ap',vlanRef:'v20',portRef:'p-ap',poeRequired:false},
    {id:'ph1',name:'PHONE-01',type:'phone',vlanRef:'v40',portRef:'p-phone',poeRequired:true,poeWatts:7}
  ],
  links:[],fwRules:[{id:'allow',name:'Internet',src:'10.20.0.0/24',dst:'any',proto:'any',port:'any',action:'allow',reviewed:true}],
  dhcp:{'20':{enabled:true,start:'10.20.0.50',end:'10.20.0.200'},'40':{enabled:true,start:'10.40.0.50',end:'10.40.0.200'}},
  physicalLocations:[],hostPhysicalLocations:[],vlanMatrix:{},security:{},roas:{},vtp:{roles:{}},topo:{pos:{}},uiSort:{},
  iot:{accessNodes:[],devices:[],map:{show:{}}},visual:{locs:[],assign:{devices:{},hosts:{}},pos:{},view:{}}
};

const physical=Planner.validatePhysicalCompatibility(project);
assert.ok(!physical.errors.some(x=>x.includes('AP-01')&&x.includes('puerto trunk')),'Un AP trunk con VLANs explícitas debe ser válido');

const ready=Planner.readinessAudit(project,{productionMode:true});
assert.ok(!ready.issues.some(x=>x.code==='NW-VLAN-001'&&x.message.includes('999')),'Una VLAN de cuarentena L2 no debe exigir subnet/gateway');

const vendor=Vendor.validateAllExports(project,{productionMode:true});
assert.ok(!vendor.issues.some(x=>x.code==='NW-FW-002'&&x.message.includes('999')),'El firewall no debe exigir SVI/interfaz L3 para una VLAN de cuarentena L2');

const gate=Gate.runProductionGate(project,{productionMode:false,strict:false});
const poeMsgs=gate.issues.filter(x=>String(x.message).includes('PHONE-01')&&String(x.message).includes('requiere PoE'));
assert.strictEqual(poeMsgs.length,1,'El mismo fallo PoE no debe aparecer duplicado como L1 y PoE');
assert.ok(/^NW-POE-/.test(poeMsgs[0].code),'Debe conservarse el código PoE específico');

console.log('✓ Validaciones: AP trunk, cuarentena L2 y deduplicación PoE funcionan sin ruido falso');
