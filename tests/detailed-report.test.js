'use strict';
const assert=require('assert');
const report=require('../js/netwizard-detailed-report.js');

const project={
  _schemaVersion:'3.48.0',
  name:'Red <Principal>',
  devices:[{id:'sw1',name:'SW-CORE',type:'switch',vendorOs:'cisco_ios',model:'C9500',osVersion:'17.12',rack:'R1'}],
  ports:[{id:'p1',deviceId:'sw1',name:'Gi1/0/1',mode:'access',accessVlanRef:'v10',adminState:'up',operState:'up'}],
  vlans:[{id:'v10',vlanId:10,name:'USERS',vrfRef:'corp'}],
  subnets:[{id:'s10',vlanRef:'v10',cidr:'10.10.10.0/24',gateway:'10.10.10.1'}],
  hosts:[{id:'h1',name:'PC-01',deviceId:'sw1',portId:'p1',vlanRef:'v10',subnetRef:'s10',ip:'10.10.10.10'}],
  links:[],vrfs:[],wanCircuits:[],internalServices:[],wifiSsids:[],wifiAccessPoints:[],haGroups:[],stacks:[],mlagDomains:[],failureScenarios:[],fwRules:[]
};
const gate={status:'ready',issues:[],counts:{errors:0,warnings:0,blocking:0},failureSimulation:{scenarios:[]},observedDrift:{drift:[]}};
const html=report.build(project,{gateReport:gate});
assert.ok(html.includes('Informe detallado'));
assert.ok(html.includes('Inventario de dispositivos'));
assert.ok(html.includes('Hosts y endpoints'));
assert.ok(html.includes('SW-CORE'));
assert.ok(html.includes('PC-01'));
assert.ok(html.includes('10.10.10.0/24'));
assert.ok(html.includes('Red &lt;Principal&gt;'));
assert.ok(!html.includes('<h1>Red <Principal></h1>'));
assert.ok(html.includes('Imprimir / Guardar PDF'));
console.log('✓ El informe detallado incluye las secciones y datos principales');
