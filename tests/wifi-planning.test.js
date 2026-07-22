'use strict';
const assert=require('assert');
const Wifi=require('../js/netwizard-wifi-planning.js');
function test(name,fn){try{fn();console.log(`✓ ${name}`);}catch(err){console.error(`✗ ${name}`);throw err;}}
const base={devices:[{id:'apdev1'},{id:'wlc1'}],ports:[{id:'uplink1',poeWattsMax:30}],vlans:[{id:'v30'}],wifiControllers:[{id:'ctrl1',name:'WLC',deviceId:'wlc1',critical:true,peerControllerRefs:['ctrl2']},{id:'ctrl2',name:'WLC backup'}],wifiSsids:[{id:'ssid1',name:'Corp',vlanRef:'v30',security:'wpa2-enterprise',radiusServiceRef:'radius'}],wifiAccessPoints:[{id:'ap1',name:'AP-01',deviceId:'apdev1',uplinkPortRef:'uplink1',controllerRef:'ctrl1',poeWatts:20,locationRef:'floor1',ssidRefs:['ssid1'],radios:[{id:'r5',band:'5GHz',channel:36,channelWidthMHz:40,txPowerDbm:17,expectedClients:25,maxClients:100}]}]};
test('Wi-Fi coherente pasa validación',()=>{const r=Wifi.validateProject(base);assert.strictEqual(r.ok,true);assert.strictEqual(r.counts.blocking,0);});
test('SSID empresarial sin RADIUS bloquea',()=>{const p=JSON.parse(JSON.stringify(base));delete p.wifiSsids[0].radiusServiceRef;const r=Wifi.validateProject(p);assert(r.issues.some(i=>i.code==='NW-WIFI-004'&&i.blocking));});
test('Capacidad de clientes excedida bloquea',()=>{const p=JSON.parse(JSON.stringify(base));p.wifiAccessPoints[0].radios[0].expectedClients=120;const r=Wifi.validateProject(p);assert(r.issues.some(i=>i.code==='NW-WIFI-013'&&i.blocking));});
test('Canal reutilizado en misma ubicación avisa',()=>{const p=JSON.parse(JSON.stringify(base));p.wifiAccessPoints.push({...JSON.parse(JSON.stringify(p.wifiAccessPoints[0])),id:'ap2',name:'AP-02'});const r=Wifi.validateProject(p);assert(r.issues.some(i=>i.code==='NW-WIFI-040'&&!i.blocking));});
test('PoE insuficiente bloquea',()=>{const p=JSON.parse(JSON.stringify(base));p.wifiAccessPoints[0].poeWatts=40;const r=Wifi.validateProject(p);assert(r.issues.some(i=>i.code==='NW-WIFI-023'&&i.blocking));});
console.log('\nTests Wi-Fi planning completados.');