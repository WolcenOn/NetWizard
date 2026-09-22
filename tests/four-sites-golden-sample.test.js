'use strict';
const assert=require('assert');
const path=require('path');
const root=path.resolve(__dirname,'..');

require(path.join(root,'js','netwizard-audit.js'));
const Schema=require(path.join(root,'js','netwizard-project-schema.js'));
const Gate=require(path.join(root,'js','netwizard-production-gate.js'));
const Cabling=require(path.join(root,'js','netwizard-structured-cabling.js'));
const Rack=require(path.join(root,'js','netwizard-rack-model.js'));
const Poe=require(path.join(root,'js','netwizard-poe-model.js'));
const Sample=require(path.join(root,'js','netwizard-sample-four-sites.js'));

global.NetWizardProductionGate=Gate;
global.NetWizardRackModel=Rack;
global.NetWizardStructuredCabling=Cabling;
const Integration=require(path.join(root,'js','netwizard-rack-production-integration.js'));
Integration.install();

const defaults=()=>({
  _schemaVersion:'3.50.0',step:'dash',projName:'',
  devices:[],ports:[],vlans:[],subnets:[],hosts:[],links:[],fwRules:[],
  vlanMatrix:{},dhcp:{},security:{},roas:{},vtp:{roles:{}},topo:{pos:{}},
  visual:{locs:[],assign:{devices:{},hosts:{}},pos:{},view:{}},
  iot:{accessNodes:[],devices:[],map:{show:{}}},
  physicalLocations:[],hostPhysicalLocations:[],uiSort:{},
  racks:[],rackItems:[],pdus:[],powerConnections:[],
  patchPanels:[],telecomOutlets:[],cableRuns:[],patchConnections:[],hostOutletConnections:[]
});

const payload=JSON.parse(Sample.json(false));
assert.strictEqual(payload.format,'netwizard-project');
assert.strictEqual(payload.schemaVersion,'3.50.0');

const prepared=Schema.prepareImport(payload,{defaults});
assert.strictEqual(prepared.ok,true,(prepared.errors||[]).join('\n'));
const p=prepared.project;

assert.strictEqual(p.racks.length,4);
assert.strictEqual(p.devices.length,20);
assert.strictEqual(p.ports.length,60);
assert.strictEqual(p.vlans.length,20);
assert.strictEqual(p.subnets.length,20);
assert.strictEqual(p.hosts.length,40);
assert.strictEqual(p.patchPanels.length,4);
assert.strictEqual(p.telecomOutlets.length,32);
assert.strictEqual(p.cableRuns.length,32);
assert.strictEqual(p.pdus.length,8);

assert.strictEqual(p.visual.locs.length,8,'Debe haber exactamente CPD + oficina para cada una de las cuatro sedes');
assert.ok(!p.visual.locs.some(x=>['Core / Perímetro','Acceso / Usuarios','Servicios'].includes(x.name)),'El ejemplo no debe caer en ubicaciones visuales genéricas');

for(const site of ['s1','s2','s3','s4']){
  const cpdVisual=site+'_vloc_cpd',officeVisual=site+'_vloc_office';
  assert.ok(p.visual.locs.some(x=>x.id===cpdVisual));
  assert.ok(p.visual.locs.some(x=>x.id===officeVisual));
  assert.strictEqual(Object.entries(p.visual.assign.devices).filter(([id,lid])=>id.startsWith(site+'_')&&lid===cpdVisual).length,5,site+' debe colocar sus 5 equipos en su CPD');
  assert.strictEqual(Object.entries(p.visual.assign.hosts).filter(([id,lid])=>id.startsWith(site+'_')&&lid===officeVisual).length,8,site+' debe colocar 8 endpoints en su oficina');
  assert.strictEqual(Object.entries(p.visual.assign.hosts).filter(([id,lid])=>id.startsWith(site+'_')&&lid===cpdVisual).length,2,site+' debe colocar los 2 hosts-servidor en su CPD');
  assert.strictEqual(p.devices.filter(x=>x.id.startsWith(site+'_')).length,5,site+' debe tener 5 equipos de rack');
  assert.strictEqual(p.vlans.filter(x=>x.id.startsWith(site+'_')).length,5,site+' debe tener 5 VLANs');
  assert.strictEqual(p.subnets.filter(x=>x.id.startsWith(site+'_')).length,5,site+' debe tener 5 subredes VLSM');
  assert.strictEqual(p.hosts.filter(x=>x.id.startsWith(site+'_')).length,10,site+' debe tener 10 hosts');
  assert.strictEqual(p.cableRuns.filter(x=>x.id.startsWith(site+'_')).length,8,site+' debe tener 8 rutas estructuradas');
  assert.strictEqual(p.powerConnections.filter(x=>x.id.startsWith(site+'_')).length,7,site+' debe tener 7 conexiones de alimentación');

  const access=p.devices.find(x=>x.id===site+'_access');
  const poe=Poe.collect({devices:p.devices,ports:p.ports,hosts:p.hosts});
  assert.strictEqual(poe.loadsByDevice[access.id],50,site+' debe consumir 50 W PoE');
  assert.ok(Number(access.poeBudgetW)>=370);

  const rack=p.racks.find(x=>x.id===site+'_rack01');
  const rackDeviceIds=new Set(p.devices.filter(x=>x.rackId===rack.id).map(x=>x.id));
  const devMap=new Map(p.devices.map(x=>[x.id,x]));
  const ownPower=p.powerConnections.filter(x=>rackDeviceIds.has(x.deviceId));
  const perDeviceCount=new Map();
  ownPower.forEach(x=>perDeviceCount.set(x.deviceId,(perDeviceCount.get(x.deviceId)||0)+1));
  const feed={A:0,B:0};
  ownPower.forEach(x=>{const draw=Number(devMap.get(x.deviceId)?.powerDrawWatts||0);feed[x.feed]=(feed[x.feed]||0)+draw/(perDeviceCount.get(x.deviceId)||1);});
  const total=feed.A+feed.B;
  assert.ok(Math.abs(feed.A-feed.B)/total<=0.10,site+' debe mantener A/B dentro del 10% del consumo total');
  assert.ok(total<rack.powerCapacityWatts*0.25,site+' debe conservar margen eléctrico holgado');
}

const prefixes=p.subnets.map(x=>Number(String(x.cidr).split('/')[1]));
assert.strictEqual(prefixes.filter(x=>x===27).length,8);
assert.strictEqual(prefixes.filter(x=>x===28).length,4);
assert.strictEqual(prefixes.filter(x=>x===29).length,8);
const allocated=prefixes.reduce((sum,prefix)=>sum+Math.pow(2,32-prefix),0);
const naive=p.subnets.length*256;
assert.strictEqual(allocated,384);
assert.ok(allocated/naive<0.10,'VLSM debe usar menos del 10% de direcciones frente a 20 redes /24');

const cabling=Cabling.validate(p);
assert.strictEqual(cabling.ok,true,cabling.issues.map(x=>x.code+': '+x.message).join('\n'));
assert.strictEqual(cabling.paths.length,32);
assert.ok(cabling.paths.every(x=>x.complete));

const rackAudit=Rack.validate(p);
assert.strictEqual(rackAudit.ok,true,rackAudit.issues.map(x=>x.code+': '+x.message).join('\n'));

const gate=Gate.runProductionGate(p,{productionMode:true,strict:true});
assert.strictEqual(gate.canExport,true,gate.issues.map(x=>`[${x.severity}] [${x.code}] ${x.message}`).join('\n'));
assert.strictEqual(gate.counts.blocking,0,Gate.summarizeGate(gate));

console.log('✓ Golden JSON 4 sedes: VLSM, trunks, cableado, PoE, racks y alimentación equilibrada listos para producción');
