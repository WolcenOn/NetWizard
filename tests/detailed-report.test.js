'use strict';
const assert=require('assert');
const report=require('../js/netwizard-detailed-report.js');

const hiddenVlanId='vlanive38pz1cfmrux1zaz';
const project={
  _schemaVersion:'3.48.0',
  name:'Red <Principal>',
  devices:[{id:'dev_generated_123',name:'SW-CORE',type:'switch',vendorOs:'cisco_ios',model:'C9500',osVersion:'17.12',rack:'R1',internetEdge:'yes'}],
  ports:[{id:'port_generated_123',deviceId:'dev_generated_123',name:'Gi1/0/1',mode:'access',accessVlanRef:hiddenVlanId,adminState:'up',operState:'up'}],
  vlans:[{id:hiddenVlanId,vlanId:10,name:'Dirección',vrfRef:'corp'}],
  subnets:[{id:'subnet_generated_123',vlanRef:hiddenVlanId,cidr:'10.10.10.0/24',gateway:'10.10.10.1'}],
  hosts:[{id:'host_generated_123',name:'PC-01',deviceId:'dev_generated_123',portId:'port_generated_123',vlanRef:hiddenVlanId,subnetRef:'subnet_generated_123',ip:'10.10.10.10'}],
  links:[],vrfs:[],wanCircuits:[],internalServices:[],wifiSsids:[],wifiAccessPoints:[],haGroups:[],stacks:[],mlagDomains:[],failureScenarios:[],fwRules:[]
};
const blockingIssue={code:'NW-DHCP-001',severity:'error',category:'DHCP',blocking:true,message:'VLAN con hosts DHCP sin scope configurado'};
const gate={status:'blocked',issues:[blockingIssue],counts:{errors:1,warnings:0,blocking:1},failureSimulation:{scenarios:[]},observedDrift:{drift:[]}};

const professional=report.build(project,{gateReport:gate,reportMode:'professional'});
assert.ok(professional.includes('Informe detallado'));
assert.ok(professional.includes('Inventario de dispositivos'));
assert.ok(professional.includes('Hosts y endpoints'));
assert.ok(professional.includes('SW-CORE'));
assert.ok(professional.includes('PC-01'));
assert.ok(professional.includes('10.10.10.0/24'));
assert.ok(professional.includes('VLAN 10 · Dirección'));
assert.ok(!professional.includes(hiddenVlanId));
assert.ok(professional.includes('2. Acciones recomendadas'));
assert.ok(professional.includes('Riesgo'));
assert.ok(professional.includes('Impacto'));
assert.ok(professional.includes('Acción recomendada'));
assert.ok(professional.includes('BLOQUEADO'));
assert.ok(professional.includes('Checklist de corrección'));
assert.ok(professional.includes('No se han definido VRFs'));
assert.ok(professional.includes('No hay circuitos WAN declarados'));
assert.ok(professional.includes('No hay SSIDs declarados'));
assert.ok(professional.includes('Red &lt;Principal&gt;'));
assert.ok(!professional.includes('<h1>Red <Principal></h1>'));
assert.ok(professional.includes('Imprimir / Guardar PDF'));

const educational=report.build(project,{gateReport:gate,reportMode:'educational'});
assert.ok(educational.includes('Modo educativo'));
assert.ok(educational.includes('Concepto afectado'));
assert.ok(educational.includes('Por qué está mal'));
assert.ok(educational.includes('Cómo corregirlo'));
assert.ok(educational.includes('Competencia evaluada'));

const cleanGate={status:'ready',issues:[],counts:{errors:0,warnings:0,blocking:0},failureSimulation:{scenarios:[]},observedDrift:{drift:[]}};
const clean=report.build(project,{gateReport:cleanGate});
assert.ok(clean.includes('APTO'));
assert.ok(clean.includes('Riesgo'));
assert.ok(clean.includes('Bajo'));
assert.ok(clean.includes('No se detectan acciones correctivas críticas'));
assert.ok(!clean.includes('BLOQUEADO'));

assert.strictEqual(report.labelVlan(project,hiddenVlanId),'VLAN 10 · Dirección');
assert.strictEqual(report.labelVlan(project,'missing'),'Sin VLAN asignada');
assert.strictEqual(report.labelDevice(project,'missing'),'Sin equipo asignado');
assert.strictEqual(report.labelPort(project,'missing'),'Sin puerto asignado');
console.log('✓ Informes profesional y educativo muestran datos humanos, acciones, riesgo y checklist');
