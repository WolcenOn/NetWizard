'use strict';

const assert=require('assert');
const fs=require('fs');
const path=require('path');
const root=path.resolve(__dirname,'..');

require(path.join(root,'js','netwizard-audit.js'));
require(path.join(root,'js','netwizard-network-utils.js'));
require(path.join(root,'js','netwizard-l3-config-utils.js'));
require(path.join(root,'js','netwizard-routing-utils.js'));
require(path.join(root,'js','netwizard-connectivity-model.js'));

const Schema=require(path.join(root,'js','netwizard-project-schema.js'));
const Architecture=require(path.join(root,'js','netwizard-architecture-validator.js'));
const Ospf=require(path.join(root,'js','netwizard-ospf.js'));
const Reach=require(path.join(root,'js','netwizard-inter-site-reachability.js'));
const Vtp=require(path.join(root,'js','netwizard-vtp-production-verification.js'));
const Wifi=require(path.join(root,'js','netwizard-wifi-planning.js'));
const Services=require(path.join(root,'js','netwizard-internal-services.js'));
const Capacity=require(path.join(root,'js','netwizard-traffic-capacity.js'));
const Access=require(path.join(root,'js','netwizard-access-security-plan.js'));
const Management=require(path.join(root,'js','netwizard-management-plan.js'));
global.NetWizardFieldInterventionPackage=require(path.join(root,'js','netwizard-field-intervention-package.js'));
global.NetWizardXlsxWriter=require(path.join(root,'js','netwizard-xlsx-writer.js'));
const Budget=require(path.join(root,'js','netwizard-budget.js'));
const PrivateWorker=require(path.join(root,'private','deployment-worker.js'));

const defaults=()=>({
  _schemaVersion:'3.50.0',step:'dash',projName:'',
  devices:[],ports:[],vlans:[],subnets:[],hosts:[],links:[],fwRules:[],
  vlanMatrix:{},dhcp:{},security:{},roas:{},vtp:{roles:{}},observedState:null,topo:{pos:{}},
  visual:{locs:[],assign:{devices:{},hosts:{}},pos:{},view:{}},
  iot:{accessNodes:[],devices:[],map:{show:{}}},
  physicalLocations:[],hostPhysicalLocations:[],uiSort:{},
  racks:[],rackItems:[],pdus:[],powerConnections:[],patchPanels:[],telecomOutlets:[],
  cableRuns:[],patchConnections:[],hostOutletConnections:[],
  wanCircuits:[],linkAggregations:[],trafficProfiles:[],internalServices:[],
  wifiControllers:[],wifiAccessPoints:[],wifiSsids:[],vrfs:[],ipv6Networks:[],failureScenarios:[],
  customDeviceModels:[]
});

const samplePath=path.join(root,'samples','golden-path-secure-multisite.json');
const payload=JSON.parse(fs.readFileSync(samplePath,'utf8'));
const prepared=Schema.prepareImport(payload,{defaults});
assert.strictEqual(prepared.ok,true,(prepared.errors||[]).join('\n'));
const p=prepared.project;

assert.strictEqual(p.projName,'Golden Path Secure Multisite · 4 sedes');
assert.strictEqual(p.devices.filter(d=>d.kind==='router').length,6);
assert.strictEqual(p.vlans.length,37);
assert.strictEqual(p.subnets.length,37);
assert.strictEqual(p.routing.protocol,'ospf');

const architecture=Architecture.validate(p);
assert.strictEqual(architecture.ok,true,architecture.issues.map(x=>x.code+': '+x.message).join('\n'));
assert.strictEqual(architecture.issues.length,0,'El Golden seguro no debe generar warnings arquitectónicos');

const ospf=Ospf.validateProject(p);
assert.strictEqual(ospf.ok,true,ospf.issues.map(x=>x.code+': '+x.message).join('\n'));
assert.strictEqual(ospf.issues.length,0,'OSPF no debe producir warnings');
assert.strictEqual(ospf.neighbors.length,18,'9 enlaces OSPF bidireccionales');
for(const id of ['core_r1','core_r2','hq_site_rtr','north_rtr','east_rtr','south_rtr']){
  const observed=Ospf.compareObserved(p,id);
  assert.strictEqual(observed.ok,true,id+' debe tener todos los vecinos FULL');
  assert.strictEqual(observed.unexpected.length,0,id+' no debe tener vecinos inesperados');
}

const allowed=[
  ['north_sn_users','hq_sn_servers','https'],
  ['east_sn_wifi','hq_sn_servers','dns'],
  ['south_sn_cameras','hq_sn_servers','rtsp'],
  ['north_sn_mgmt','south_sn_mgmt','icmp']
];
for(const [src,dst,service] of allowed){
  const r=Reach.analyze(p,src,dst,service);
  assert.strictEqual(r.reachable,true,src+' → '+dst+' '+service+': '+r.reason);
  assert.strictEqual(r.forward.strategy,'ospf');
  assert.strictEqual(r.forward.confidence,'observed');
  assert.strictEqual(r.policy.explicit,true,'El flujo permitido debe tener política explícita');
}

const blocked=[
  ['south_sn_guest','hq_sn_servers','https'],
  ['north_sn_users','east_sn_users','https'],
  ['east_sn_cameras','north_sn_users','icmp']
];
for(const [src,dst,service] of blocked){
  const r=Reach.analyze(p,src,dst,service);
  assert.strictEqual(r.reachable,false,src+' → '+dst+' '+service+' debe estar bloqueado');
  assert.strictEqual(r.policy.allowed,false);
  assert.strictEqual(r.policy.explicit,true,'El bloqueo debe proceder de una regla explícita');
}

const vtp=Vtp.evaluateProject(p);
assert.strictEqual(vtp.ok,true,(vtp.issues||[]).map(x=>x.message).join('\n'));
assert.strictEqual((vtp.issues||[]).length,0,'VTP observado no debe producir warnings');

const wifi=Wifi.validateProject(p);
assert.strictEqual(wifi.ok,true,wifi.issues.map(x=>x.code+': '+x.message).join('\n'));
assert.strictEqual(wifi.issues.length,0,'Wi-Fi no debe producir warnings');
assert.strictEqual(wifi.summary.controllers,2);
assert.strictEqual(wifi.summary.accessPoints,4);
assert.strictEqual(wifi.summary.ssids,8);

const services=Services.validateProject(p);
assert.strictEqual(services.ok,true,services.issues.map(x=>x.code+': '+x.message).join('\n'));
assert.strictEqual(services.issues.length,0,'Servicios internos no deben producir warnings');

const capacity=Capacity.validateProject(p);
assert.strictEqual(capacity.ok,true,capacity.issues.map(x=>x.code+': '+x.message).join('\n'));
assert.strictEqual(capacity.issues.length,0,'Capacidad no debe producir warnings');

const access=Access.build(p);
assert.strictEqual(access.ok,true,access.warnings.join('\n'));
assert.deepStrictEqual(access.warnings,[],'Hardening de acceso sin warnings');

for(const id of ['core_r1','core_r2','hq_site_rtr','north_rtr','east_rtr','south_rtr','hq_sw','north_sw','east_sw','south_sw']){
  const mgmt=Management.build(p,id);
  assert.ok(mgmt,id+' debe tener plan de gestión');
  assert.deepStrictEqual(mgmt.warnings,[],id+' management sin warnings');
}

const budgetValidation=Budget.validateProject(p);
assert.strictEqual(budgetValidation.ok,true,budgetValidation.issues.map(x=>x.code+': '+x.message).join('\n'));
assert.strictEqual(budgetValidation.issues.length,0,'Presupuesto sin warnings');
const budget=Budget.build(p);
assert.strictEqual(budget.counts.unpriced,0,'Toda la BOM incluida debe tener precio');
assert.ok(budget.totals.year1Price>budget.totals.year1Cost);
assert.ok(budget.totals.grossMarginPct>0);

const privateResult=PrivateWorker.handle({project:p,generatedAt:'2026-10-02T06:50:00.000Z'});
assert.strictEqual(privateResult.ok,true,'Private Engine debe completar la generación: '+JSON.stringify(privateResult.issues,null,2));
assert.strictEqual(privateResult.productionStatus,'ready',privateResult.productionGateSummaryMarkdown);
assert.strictEqual(privateResult.productionReady,true,privateResult.productionGateSummaryMarkdown);
assert.strictEqual(privateResult.productionGate.canExport,true,privateResult.productionGateSummaryMarkdown);
assert.strictEqual(privateResult.productionGate.counts.blocking,0,privateResult.productionGateSummaryMarkdown);
for(const id of ['core_r1','core_r2','hq_site_rtr','north_rtr','east_rtr','south_rtr','hq_sw','north_sw','east_sw','south_sw']){
  assert.strictEqual(privateResult.configReadiness[id].status,'apply-ready',id+' debe quedar apply-ready');
}

console.log('✓ Golden Path Secure Multisite: 4 sedes, 6 routers, OSPF redundante, segmentación explícita y Production Gate READY');
