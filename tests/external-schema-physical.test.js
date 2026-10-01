'use strict';
const assert=require('assert');
const fs=require('fs');
const path=require('path');
const root=path.resolve(__dirname,'..');
const external=JSON.parse(fs.readFileSync(path.join(root,'schemas','netwizard-project.schema.json'),'utf8'));
const Sample=require('../js/netwizard-sample-four-sites.js');

function resolve(schema){
  if(schema&&schema.$ref){
    const key=String(schema.$ref).replace('#/$defs/','');
    return external.$defs[key];
  }
  return schema;
}
function matchesType(value,type){
  if(type==='null')return value===null;
  if(type==='array')return Array.isArray(value);
  if(type==='object')return !!value&&typeof value==='object'&&!Array.isArray(value);
  if(type==='integer')return Number.isInteger(value);
  if(type==='number')return typeof value==='number'&&Number.isFinite(value);
  return typeof value===type;
}
function check(value,rawSchema,where){
  const schema=resolve(rawSchema);
  assert.ok(schema,where+': definición inexistente');
  if(schema.anyOf){
    const errors=[];
    for(const candidate of schema.anyOf){
      try{check(value,candidate,where);return;}catch(e){errors.push(e.message);}
    }
    assert.fail(where+': no satisface anyOf ('+errors.join(' | ')+')');
  }
  if(schema.const!==undefined)assert.deepStrictEqual(value,schema.const,where+': const inválido');
  if(schema.enum)assert.ok(schema.enum.includes(value),where+': valor fuera de enum');
  if(schema.type){
    const types=Array.isArray(schema.type)?schema.type:[schema.type];
    assert.ok(types.some(t=>matchesType(value,t)),where+': tipo inválido, esperado '+types.join('|'));
    if(value===null)return;
  }
  if(typeof value==='string'){
    if(schema.minLength!=null)assert.ok(value.length>=schema.minLength,where+': string demasiado corto');
    if(schema.maxLength!=null)assert.ok(value.length<=schema.maxLength,where+': string demasiado largo');
    if(schema.pattern)assert.ok(new RegExp(schema.pattern).test(value),where+': patrón inválido');
  }
  if(typeof value==='number'){
    if(schema.minimum!=null)assert.ok(value>=schema.minimum,where+': menor que minimum');
    if(schema.maximum!=null)assert.ok(value<=schema.maximum,where+': mayor que maximum');
  }
  if(Array.isArray(value)&&schema.items)value.forEach((item,i)=>check(item,schema.items,where+'['+i+']'));
  if(value&&typeof value==='object'&&!Array.isArray(value)){
    for(const key of schema.required||[])assert.ok(Object.prototype.hasOwnProperty.call(value,key),where+': falta '+key);
    for(const [key,child] of Object.entries(schema.properties||{})){
      if(Object.prototype.hasOwnProperty.call(value,key))check(value[key],child,where+'.'+key);
    }
  }
}

const projectProps=external.$defs.project.properties;
const expected={
  physicalLocations:'physicalLocation',
  racks:'rack',
  rackItems:'rackItem',
  pdus:'pdu',
  powerConnections:'powerConnection',
  patchPanels:'patchPanel',
  telecomOutlets:'telecomOutlet',
  cableRuns:'cableRun',
  patchConnections:'patchConnection',
  hostOutletConnections:'hostOutletConnection'
};
for(const [key,def] of Object.entries(expected)){
  assert.ok(projectProps[key],key+' debe estar publicado en $defs.project.properties');
  assert.strictEqual(projectProps[key].type,'array');
  assert.strictEqual(projectProps[key].items.$ref,'#/$defs/'+def);
  assert.ok(external.$defs[def],def+' debe existir en $defs');
}
assert.strictEqual(external.$defs.subnet.properties.gatewayDeviceRef.$ref,'#/$defs/idNullable');
assert.strictEqual(projectProps.budget.$ref,'#/$defs/budget');
assert.strictEqual(external.$defs.budget.properties.version.const,'netwizard-budget-v1');
check({
  version:'netwizard-budget-v1',
  currency:'EUR',
  taxRatePct:21,
  defaultMarginPct:20,
  scope:'full',
  resourcePricing:{'device:sw1':{unitCost:1000,unitPrice:1500,chargeType:'one-time',capexOpex:'capex',billingPeriodMonths:1}},
  modelPricing:{},
  serviceLines:[{
    id:'labor1',category:'Mano de obra',description:'Instalación',quantity:4,unit:'h',
    unitCost:25,unitPrice:50,chargeType:'one-time',billingPeriodMonths:1,capexOpex:'capex',
    resourceRef:'device:sw1'
  }]
},external.$defs.budget,'budget');


const payload=Sample.buildPayload();
assert.strictEqual(payload.schemaVersion,'3.50.0');
for(const [key,def] of Object.entries(expected)){
  const list=payload.project[key];
  assert.ok(Array.isArray(list),key+' debe ser array en el golden sample');
  list.forEach((item,i)=>check(item,external.$defs[def],key+'['+i+']'));
}
payload.project.subnets.forEach((item,i)=>check(item,external.$defs.subnet,'subnets['+i+']'));
payload.project.devices.forEach((item,i)=>check(item,external.$defs.device,'devices['+i+']'));
payload.project.hosts.forEach((item,i)=>check(item,external.$defs.host,'hosts['+i+']'));
payload.project.links.forEach((item,i)=>check(item,external.$defs.link,'links['+i+']'));

console.log('✓ Schema externo 3.50 documenta y acepta el modelo físico/racks/cableado del golden sample');
