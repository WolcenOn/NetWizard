'use strict';
const assert=require('assert');
const Bulk=require('../js/netwizard-bulk-port-editor.js');

const project={
  devices:[{id:'sw1',name:'SW1'}],
  vlans:[{id:'v10',vlanId:10,name:'Usuarios'},{id:'v20',vlanId:20,name:'Voz'}],
  ports:[
    {id:'p1',deviceId:'sw1',name:'GigabitEthernet0/1',media:'GE',mode:'access',accessVlanRef:'v10',allowedVlans:[],desc:'Existente',position:1}
  ]
};
const parsed=Bulk.parseStartToken('GigabitEthernet0/12');
assert.deepStrictEqual(parsed,{root:'GigabitEthernet0/',start:12});

const rows=Bulk.buildRows(project,{deviceId:'sw1',root:'GigabitEthernet0/',start:1,count:3,media:'GE',mode:'access',accessVlanRef:'v20',desc:'Puesto'});
assert.strictEqual(rows.length,3);
assert.strictEqual(rows[0].existing,true);
assert.strictEqual(rows[0].accessVlanRef,'v10','Un puerto existente conserva sus valores para edición');
assert.strictEqual(rows[1].name,'GigabitEthernet0/2');
rows[0].desc='Actualizado';
rows[1].mode='trunk';
rows[1].allowedVlans=[10,20];
rows[2].enabled=false;

const next=Bulk.applyRows(project,rows);
assert.strictEqual(next.ports.length,2,'Solo se crea el puerto nuevo habilitado');
assert.strictEqual(next.ports.find(p=>p.id==='p1').desc,'Actualizado');
const created=next.ports.find(p=>p.name==='GigabitEthernet0/2');
assert.ok(created);
assert.strictEqual(created.mode,'trunk');
assert.deepStrictEqual(created.allowedVlans,[10,20]);
assert.strictEqual(created.accessVlanRef,null);
assert.strictEqual(project.ports.length,1,'El proyecto original no debe mutarse');

console.log('✓ Editor masivo de puertos previsualiza, actualiza y crea puertos sin duplicar ni mutar el origen');
