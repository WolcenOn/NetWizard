'use strict';

const assert=require('assert');
const model=require('../js/netwizard-connectivity-model.js');

const project={
  vlans:[
    {id:'v10',vlanId:10,name:'Usuarios'},
    {id:'v20',vlanId:20,name:'Servidores'}
  ],
  subnets:[
    {id:'sn10',vlanRef:'v10',cidr:'10.0.10.0/24',gateway:'10.0.10.1'},
    {id:'sn20',vlanRef:'v20',cidr:'10.0.20.0/24',gateway:'10.0.20.1'}
  ],
  devices:[
    {id:'sw1',name:'ACCESS-A',type:'switch'},
    {id:'r1',name:'CORE-RTR',type:'router'},
    {id:'sw2',name:'ACCESS-B',type:'switch'}
  ],
  ports:[
    {id:'h1p',deviceId:'sw1',name:'Gi1/0/1',mode:'access',accessVlanRef:'v10'},
    {id:'s1u',deviceId:'sw1',name:'Te1/1',mode:'trunk'},
    {id:'r1a',deviceId:'r1',name:'Te0/0',mode:'routed'},
    {id:'r1b',deviceId:'r1',name:'Te0/1',mode:'routed'},
    {id:'s2u',deviceId:'sw2',name:'Te1/1',mode:'trunk'},
    {id:'h2p',deviceId:'sw2',name:'Gi1/0/20',mode:'access',accessVlanRef:'v20'},
    {id:'iotp',deviceId:'sw2',name:'Gi1/0/21',mode:'access',accessVlanRef:'v20'}
  ],
  links:[
    {id:'l1',fromPortId:'s1u',toPortId:'r1a',medium:'fiber'},
    {id:'l2',aPortId:'r1b',bPortId:'s2u',media:'fiber'}
  ],
  hosts:[
    {id:'h1',name:'PC-01',type:'pc',vlanRef:'v10',portRef:'h1p',staticIp:'10.0.10.10'},
    {id:'h2',name:'SRV-DNS',type:'server',vlanRef:'v20',portRef:'h2p',staticIp:'10.0.20.53'}
  ],
  vlanMatrix:{v10_v20:true},
  fwRules:[
    {id:'fw-dns',name:'Permitir DNS',src:'VLAN 10',dst:'VLAN 20',proto:'udp',port:'53',action:'allow',prio:10,enabled:true},
    {id:'fw-https',name:'Bloquear HTTPS',src:'VLAN 10',dst:'VLAN 20',proto:'tcp',port:'443',action:'deny',prio:20,enabled:true},
    {id:'fw-rest',name:'Bloquear resto',src:'VLAN 10',dst:'VLAN 20',proto:'any',port:'any',action:'deny',prio:999,enabled:true}
  ],
  iot:{
    accessNodes:[{id:'gw1',name:'GW MQTT',type:'mqtt_broker',parentDeviceId:'sw2',parentPortId:'iotp'}],
    devices:[{id:'iot1',name:'Sensor-01',type:'sensor',tech:'mqtt',vlanRef:'v20',accessNodeId:'gw1',identifier:'10.0.20.80'}]
  }
};

const endpoints=model.endpointList(project);
assert.ok(endpoints.some(x=>x.id==='host:h1'&&x.ip==='10.0.10.10'));
assert.ok(endpoints.some(x=>x.id==='iot:iot1'&&x.vlanRef==='v20'));

const route=model.shortestDevicePath(project,'sw1','sw2');
assert.ok(route);
assert.deepStrictEqual(route.devices,['sw1','r1','sw2']);
assert.strictEqual(route.edges.length,2);
assert.strictEqual(route.edges[0].link.id,'l1');
assert.strictEqual(route.edges[1].link.id,'l2');

const dns=model.simulate(project,'host:h1','host:h2','dns');
assert.strictEqual(dns.ok,true);
assert.strictEqual(dns.partial,false);
assert.strictEqual(dns.service.port,53);
assert.ok(dns.steps.some(x=>x.msg.includes('ACCESS-A → CORE-RTR → ACCESS-B')));
assert.ok(dns.steps.some(x=>x.msg.includes('Permitir DNS')));
assert.ok(dns.path.some(x=>x.kind==='gateway'&&x.label.includes('10.0.10.1')));
assert.ok(dns.path.some(x=>x.kind==='link'&&x.label.includes('Te1/1')));
assert.ok(dns.path.some(x=>x.kind==='device'&&x.label==='CORE-RTR'));

const https=model.simulate(project,'host:h1','host:h2','https');
assert.strictEqual(https.ok,false);
assert.ok(https.steps.some(x=>x.ok===false&&x.msg.includes('Bloquear HTTPS')));

const mqtt=model.simulate(project,'host:h1','iot:iot1','mqtt');
assert.strictEqual(mqtt.ok,false,'La regla final deny debe bloquear MQTT');
assert.ok(mqtt.path.some(x=>x.kind==='iot-access'&&x.label==='GW MQTT'));
assert.ok(mqtt.path.some(x=>x.kind==='endpoint'&&x.label==='Sensor-01'));

const broken=JSON.parse(JSON.stringify(project));
broken.links=[];
const noPhysical=model.simulate(broken,'host:h1','host:h2','dns');
assert.strictEqual(noPhysical.ok,false);
assert.ok(noPhysical.steps.some(x=>x.msg.includes('No hay ruta física documentada')));

assert.strictEqual(model.cidrContains('10.0.20.0/24','10.0.20.53'),true);
assert.strictEqual(model.cidrContains('10.0.20.0/24','10.0.21.53'),false);
console.log('✓ Connectivity model reconstruye ruta física y diferencia servicios/firewall');
