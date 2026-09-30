'use strict';

const assert=require('assert');
const fs=require('fs');
const path=require('path');

const root=path.resolve(__dirname,'..');
const read=p=>fs.readFileSync(path.join(root,p),'utf8');

const html=read('index.html');
const main=read('js/netwizard.js');
const manifest=read('js/netwizard-browser-modules.js');

assert.ok(html.includes('id="pg-validate"'),'Debe existir una sección canónica de Validación & análisis');
assert.ok(html.includes('data-step="validate"'),'Validación debe formar parte de la navegación principal');
assert.ok(main.includes("'fw','validate','cfg'"),'Validación debe preceder a Despliegue en el flujo');
assert.ok(html.includes('🚀 Despliegue & Exportación'),'Config debe presentarse como fase de despliegue, no como cajón genérico');
const linksIndex=html.indexOf('id="pg-links"');
const wanEditorIndex=html.indexOf('id="nwWanCircuitsEditorMount"');
const firewallIndex=html.indexOf('id="pg-fw"');
assert.ok(linksIndex>=0&&wanEditorIndex>linksIndex&&wanEditorIndex<firewallIndex,'El editor WAN debe vivir dentro de Enlaces');

assert.ok(!html.includes('graphs-unified'),'La auditoría unificada experimental no debe seguir como vista gráfica');
assert.ok(!html.includes('nwuGraphSlot'),'El slot del mapa unificado experimental debe retirarse de la UX');
assert.ok(!html.includes('nwBridgePreview'),'El preview Bridge/IoT no debe aparecer en Export');
assert.ok(!html.includes('nwBridgeDownload'),'La descarga de grafo experimental no debe aparecer en Export');

for(const retired of [
  'js/netwizard-bridge-ui.js',
  'js/netwizard-graph-viewer.js',
  'js/netwizard-unified-config-map.js'
]){
  assert.ok(!fs.existsSync(path.join(root,retired)),'El experimento retirado debe eliminarse físicamente: '+retired);
  assert.ok(!html.includes('./'+retired),'El entrypoint no debe cargar el experimento retirado '+retired);
  assert.ok(!manifest.includes('"path":"'+retired+'"'),'El manifiesto no debe cargar el experimento retirado '+retired);
}
const v5Layout=read('js/netwizard-v5-layout-manager.js');
const v5Iot=read('js/netwizard-v5-iot-extension.js');
for(const forbidden of ['NetWizardUnifiedConfigMap','renderUnifiedManaged','graphs-unified','nwuConfigCanvas']){
  assert.ok(!v5Layout.includes(forbidden),'V5 layout no debe conservar código del grafo retirado: '+forbidden);
  assert.ok(!v5Iot.includes(forbidden),'V5 IoT no debe conservar hooks del grafo retirado: '+forbidden);
}
assert.ok(html.includes('./js/netwizard-bridge.js'),'El contrato Bridge interno puede mantenerse para IoT/compatibilidad');

const observedIndex=html.indexOf('id="observedConfigCard"');
const validateIndex=html.indexOf('id="pg-validate"');
const deployIndex=html.indexOf('id="pg-cfg"');
assert.ok(validateIndex>=0&&observedIndex>validateIndex&&observedIndex<deployIndex,
  'Estado observado debe vivir en Validación antes de Despliegue');

for(const modulePath of [
  'js/netwizard-capability-ui.js',
  'js/netwizard-resilience-ui.js',
  'js/netwizard-wan-circuits-ui.js',
  'js/netwizard-traffic-capacity-ui.js',
  'js/netwizard-internal-services-ui.js',
  'js/netwizard-wifi-planning-ui.js',
  'js/netwizard-ipv6-vrf-ui.js',
  'js/netwizard-failure-simulation-ui.js'
]){
  const source=read(modulePath);
  assert.ok(source.includes("getElementById('pg-validate')"),modulePath+' debe renderizar en Validación');
  assert.ok(!source.includes("getElementById('pg-cfg')"),modulePath+' no debe volver a inyectarse en Despliegue');
}

console.log('✓ Arquitectura de información separa Vistas, Validación y Despliegue sin experimentos duplicados');
