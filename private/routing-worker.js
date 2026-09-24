'use strict';

require('../js/netwizard-network-utils.js');
require('../js/netwizard-l3-config-utils.js');
require('../js/netwizard-routing-utils.js');
const RoutingPlan = require('../js/netwizard-routing-plan.js');
const Cisco = require('../js/netwizard-cisco-routing-generator.js');
const Multi = require('../js/netwizard-multivendor-routing-generator.js');

const CONTRACT_VERSION = 'netwizard-private-routing-v1';
const ALLOWED_VENDORS = new Set(['cisco_ios','juniper_junos','huawei_vrp','mikrotik_routeros']);

function clean(value){ return String(value == null ? '' : value).trim(); }

function handle(input){
  const project = input && input.project;
  const deviceId = clean(input && input.deviceId);
  if(!project || typeof project !== 'object' || Array.isArray(project) || !deviceId){
    throw new Error('invalid routing request');
  }
  const device = Array.isArray(project.devices) ? project.devices.find(item => item && item.id === deviceId) : null;
  if(!device) throw new Error('device not found');
  const vendor = clean(device.vendorOs).toLowerCase();
  if(!ALLOWED_VENDORS.has(vendor)) throw new Error('unsupported routing vendor');

  const plan = RoutingPlan.build(project);
  let output = '';
  let generatorVersion = '';
  if(vendor === 'cisco_ios'){
    output = Cisco.render(project, deviceId, plan);
    generatorVersion = Cisco.version;
  }else{
    output = Multi.render(project, deviceId, vendor, plan);
    generatorVersion = Multi.version;
  }
  return {
    contractVersion: CONTRACT_VERSION,
    planVersion: plan.version,
    generatorVersion,
    deviceId,
    vendor,
    output: String(output || ''),
    warnings: Array.isArray(plan.warnings) ? plan.warnings : []
  };
}

async function cli(){
  let raw = '';
  for await (const chunk of process.stdin){
    raw += chunk;
    if(Buffer.byteLength(raw, 'utf8') > 12 * 1024 * 1024) throw new Error('routing request too large');
  }
  const result = handle(JSON.parse(raw));
  process.stdout.write(JSON.stringify(result));
}

if(require.main === module){
  cli().catch(error => {
    process.stderr.write(String(error && error.message || error));
    process.exitCode = 1;
  });
}

module.exports = { CONTRACT_VERSION, handle };
