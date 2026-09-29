'use strict';

const assert=require('assert');
const fs=require('fs');
const path=require('path');

const root=path.resolve(__dirname,'..');
const read=p=>fs.readFileSync(path.join(root,p),'utf8');

const main=read('js/netwizard.js');
const cabling=read('js/netwizard-structured-cabling.js');
const rack=read('js/netwizard-rack-model.js');
const planner=read('js/netwizard-vlsm-physical-planner.js');
const privateUi=read('js/netwizard-private-deployment-ui.js');
const privateEngine=read('private/vendor-config-engine.js');
const workflow=read('.github/workflows/ci.yml');
const authority=read('docs/MODEL_AUTHORITY.md');

const defaults=main.slice(main.indexOf('function defS()'),main.indexOf('function normalizeProject('));
assert.match(defaults,/_schemaVersion:'3\.50\.0'/);
for(const duplicate of ['inventoryDevices:','designDevices:','inventoryPorts:','plannedSubnets:']){
  assert.ok(!defaults.includes(duplicate),duplicate+' no debe convertirse en colección persistida paralela');
}

assert.ok(rack.includes('deviceRackItem'),'RackModel debe conservar la compatibilidad de mirrors legacy');
assert.ok(cabling.includes('function hostAccess(project,hostId)'),'Cableado estructurado debe resolver acceso físico de host');
assert.ok(main.includes('function hostResolvedPortId(h)'),'La UI debe usar un puerto resuelto para hosts');
assert.ok(main.includes("structuredHostAccess(h)?.structured"),'La edición directa de host debe bloquearse cuando cableado estructurado es autoritativo');

assert.strictEqual(
  (main.match(/S\.subnets\.push/g)||[]).length,
  1,
  'Solo la edición manual explícita puede insertar directamente en S.subnets'
);
assert.ok(planner.includes('function applySubnetPlan('),'Los automatismos de subnetting deben compartir applySubnetPlan');
assert.ok(main.includes('wizardSubnetPlan=subnetPlanner.buildFixedSubnetPlan'),'El Wizard debe reutilizar el planificador común');

assert.ok(privateEngine.includes("status:'apply-ready'"),'Private Engine debe clasificar aplicabilidad');
assert.ok(privateEngine.includes("status:'review-required'"),'Private Engine debe poder exigir revisión');
assert.ok(privateEngine.includes("status:'procedure-only'"),'Private Engine debe distinguir procedimientos no CLI');
assert.ok(privateUi.includes('configReadiness'),'La UI privada debe transportar configReadiness');
assert.ok(main.includes('function configReadinessForView('),'Config por dispositivo debe exponer la clasificación');
assert.ok(main.includes('La Production Gate global debe seguir en READY'),'La UI no debe equiparar apply-ready con productionReady');

assert.ok(main.includes("const DESIGN_STEP_ORDER=['dash','wiz','loc','dev','physical'"));
assert.ok(main.includes("const INVENTORY_STEP_ORDER=['dash','loc','dev','physical'"));

assert.ok(workflow.includes('Playwright production smoke'),'Docker build debe probar el navegador productivo');
assert.ok(workflow.includes('playwright.production.config.js'),'CI debe usar la configuración Playwright de producción');
assert.ok(authority.includes('## Matriz de autoridad'));
assert.ok(authority.includes('Golden Path físico'));
assert.ok(authority.includes('apply-ready'));

console.log('✓ Autoridad C/R/D/O/T/X/A y regresiones de flujo quedan fijadas para 3.50');
