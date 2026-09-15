'use strict';

const assert=require('assert');
const Runbook=require('../js/netwizard-deployment-runbook.js');

const project={
  projName:'Campus Norte',
  devices:[
    {id:'ap1',name:'AP Planta 1',kind:'access_point',type:'access_point',vendorOs:'ubiquiti_unifi'},
    {id:'sw1',name:'SW Acceso',kind:'switch',type:'switch',vendorOs:'cisco_ios'},
    {id:'core1',name:'Core L3',kind:'switch',type:'switch',vendorOs:'cisco_ios',l3:true,criticality:'high'},
    {id:'fw1',name:'Firewall',kind:'firewall',type:'firewall',vendorOs:'fortinet',internetEdge:'yes'},
    {id:'wlc1',name:'WLAN Controller',kind:'wlan_controller',type:'wlan_controller',vendorOs:'ubiquiti_unifi'},
    {id:'srv1',name:'DNS Server',kind:'server',type:'server',vendorOs:'linux'}
  ],
  ports:[
    {id:'fw-core',deviceId:'fw1'},{id:'core-fw',deviceId:'core1'},
    {id:'core-sw',deviceId:'core1'},{id:'sw-core',deviceId:'sw1'},
    {id:'sw-ap',deviceId:'sw1'},{id:'ap-sw',deviceId:'ap1'},
    {id:'sw-srv',deviceId:'sw1'},{id:'srv-sw',deviceId:'srv1'}
  ],
  links:[
    {id:'l1',aPortId:'fw-core',bPortId:'core-fw'},
    {id:'l2',aPortId:'core-sw',bPortId:'sw-core'},
    {id:'l3',aPortId:'sw-ap',bPortId:'ap-sw'},
    {id:'l4',aPortId:'sw-srv',bPortId:'srv-sw'}
  ],
  wifiControllers:[{id:'wc-plan',deviceId:'wlc1'}],
  wifiAccessPoints:[{id:'ap-plan',deviceId:'ap1',controllerRef:'wc-plan'}],
  deployment:{strategy:'staged',changeTicket:'CHG-42',maintenanceWindow:'2026-09-20 22:00Z',approvalOwner:'Network Lead',observationMinutes:30,validationTargets:['HTTPS portal'],devices:{srv1:{dependsOnDeviceRefs:['sw1']}}},
  internalServices:[{id:'dns',name:'DNS interno',critical:true}],
  failureScenarios:[{id:'wan-down',name:'Caída WAN principal',requireWan:true,mustSurvive:[{type:'service',ref:'dns'}]}],
  haGroups:[],mlagDomains:[]
};
const configPaths=Object.fromEntries(project.devices.map((device,index)=>[device.id,`configs/${String(index+1).padStart(2,'0')}-${device.id}.cfg`]));
const plan=Runbook.buildDeploymentPlan(project,{generatedAt:'2026-09-15T00:00:00.000Z',configPaths});
assert.strictEqual(plan.ok,true);
assert.strictEqual(plan.maxParallel,1);
assert.strictEqual(plan.changeTicket,'CHG-42');
assert.strictEqual(plan.observationMinutes,30);
assert.ok(plan.estimatedTotalMinutes>30);
assert.deepStrictEqual(plan.validationTargets,['HTTPS portal']);
assert.strictEqual(plan.criticalServices[0].id,'dns');
assert.strictEqual(plan.resilienceChecks[0].id,'wan-down');
assert.strictEqual(plan.steps.length,project.devices.length);
assert.strictEqual(new Set(plan.steps.map(step=>step.deviceId)).size,project.devices.length);

const position=Object.fromEntries(plan.steps.map((step,index)=>[step.deviceId,index]));
assert.ok(position.fw1<position.core1,'el borde debe preceder al core');
assert.ok(position.core1<position.sw1,'el core debe preceder al acceso');
assert.ok(position.sw1<position.ap1,'el uplink debe preceder al AP');
assert.ok(position.wlc1<position.ap1,'el controlador debe preceder al AP');
assert.ok(position.sw1<position.srv1,'la dependencia explícita debe respetarse');
for(const step of plan.steps)for(const dependency of step.dependsOn)assert.ok(position[dependency]<position[step.deviceId],`${dependency} debe preceder a ${step.deviceId}`);
assert.strictEqual(plan.steps.find(step=>step.deviceId==='fw1').risk,'critical');
assert.ok(plan.steps.find(step=>step.deviceId==='fw1').backup.some(line=>/backup/i.test(line)));
assert.strictEqual(plan.steps.find(step=>step.deviceId==='ap1').configPath,configPaths.ap1);

const markdown=Runbook.buildMarkdown(plan);
assert.match(markdown,/Runbook de despliegue/);
assert.match(markdown,/NO es un backup/);
assert.match(markdown,/Criterios de parada/);
assert.match(markdown,/Escenarios de resiliencia declarados/);
assert.match(markdown,/Firewall/);
const rollback=Runbook.buildRollbackMarkdown(plan);
assert.match(rollback,/Checklist de rollback/);
assert.ok(rollback.indexOf('AP Planta 1')<rollback.indexOf('Firewall'),'rollback debe listar los equipos en orden inverso');

const haPlan=Runbook.buildDeploymentPlan({devices:[
  {id:'fw-a',name:'FW A',kind:'firewall',vendorOs:'fortinet'},
  {id:'fw-b',name:'FW B',kind:'firewall',vendorOs:'fortinet'}
],ports:[],links:[],wifiControllers:[],wifiAccessPoints:[],haGroups:[{id:'ha1',name:'Edge HA',memberDeviceIds:['fw-a','fw-b']}],mlagDomains:[]});
assert.strictEqual(haPlan.warnings.filter(warning=>warning.includes('miembro de HA')).length,2);
assert.ok(haPlan.steps.every(step=>step.serialGroups[0].id==='ha1'));

const cycle=Runbook.buildDeploymentPlan({devices:[
  {id:'a',name:'A',kind:'switch',vendorOs:'cisco_ios'},
  {id:'b',name:'B',kind:'switch',vendorOs:'cisco_ios'}
],ports:[],links:[],wifiControllers:[],wifiAccessPoints:[],haGroups:[],mlagDomains:[],deployment:{devices:{a:{dependsOnDeviceRefs:['b']},b:{dependsOnDeviceRefs:['a']}}}});
assert.strictEqual(cycle.ok,false);
assert.strictEqual(cycle.issues[0].code,'NW-RUNBOOK-001');

const missingDependency=Runbook.buildDeploymentPlan({devices:[{id:'a',name:'A',kind:'switch',vendorOs:'cisco_ios',dependsOnDeviceRefs:['missing']}],ports:[],links:[],wifiControllers:[],wifiAccessPoints:[],haGroups:[],mlagDomains:[]});
assert.strictEqual(missingDependency.ok,false);
assert.ok(missingDependency.issues.some(issue=>issue.code==='NW-RUNBOOK-002'));

const selfDependency=Runbook.buildDeploymentPlan({devices:[{id:'a',name:'A',kind:'switch',vendorOs:'cisco_ios',dependsOnDeviceRefs:['a']}],ports:[],links:[],wifiControllers:[],wifiAccessPoints:[],haGroups:[],mlagDomains:[]});
assert.strictEqual(selfDependency.ok,false);
assert.ok(selfDependency.issues.some(issue=>issue.code==='NW-RUNBOOK-003'));

console.log('✓ Deployment Runbook ordena dependencias y genera rollback conservador');
