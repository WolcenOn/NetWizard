#!/usr/bin/env node
'use strict';

const assert = require('assert');
const { createPipeline } = require('../js/netwizard-config-pipeline.js');

const project={devices:[{id:'r1',type:'router',vendorOs:'cisco_ios'}]};
const pipeline=createPipeline({baseGenerator(){return 'legacy';},getProject(){return project;}});

pipeline.registerRenderer({id:'vendor.base',priority:100,render(){return 'vendor';}});
pipeline.registerRenderer({id:'edge.firewall',priority:300,supports(ctx){return ctx.vendor==='fortinet';},render(){return 'edge';}});
pipeline.registerStage({id:'z.last',order:300,apply(output){return `${output}|last`;}});
pipeline.registerStage({id:'a.first',order:100,apply(output){return `${output}|first`;}});

assert.strictEqual(pipeline.generate('r1','cisco_ios'),'vendor|first|last');
assert.strictEqual(pipeline.generate('r1','fortinet'),'edge|first|last');
assert.deepStrictEqual(pipeline.inspect().renderers.map(item=>item.id),['edge.firewall','vendor.base']);
assert.deepStrictEqual(pipeline.inspect().stages.map(item=>item.id),['a.first','z.last']);

pipeline.registerStage({id:'a.first',order:100,apply(output){return `${output}|replaced`;}});
assert.strictEqual(pipeline.generate('r1','cisco_ios'),'vendor|replaced|last');
assert.strictEqual(pipeline.inspect().stages.filter(item=>item.id==='a.first').length,1);

console.log('✓ Config Pipeline registra renderers y etapas con prioridad determinista');

global.document={readyState:'complete',querySelector(){return null;},head:{appendChild(){}}};
global.NetWizardState={getSnapshot(){return browserProject;}};
global.genFwAcl=()=>'';
const browserProject={
  devices:[{id:'r1',name:'Router',type:'router',kind:'router',vendorOs:'mikrotik_routeros'}],
  ports:[],vlans:[],subnets:[],hosts:[],links:[],fwRules:[],dhcp:{},routing:{strategy:'static'},
  management:{},highAvailability:{},accessSecurity:{},linkAggregations:[]
};
const browserPipeline=createPipeline({baseGenerator(){return '! legacy';},getProject(){return browserProject;}});
global.NetWizardConfigPipeline=browserPipeline;
global.genConfig=browserPipeline.generate;

require('../js/netwizard-core-utils.js');
require('../js/netwizard-network-utils.js');
require('../js/netwizard-l3-config-utils.js');
require('../js/netwizard-routing-utils.js');
require('../js/netwizard-routing-plan.js');
require('../js/netwizard-vendor-config-generators.js');
require('../js/netwizard-cisco-routing-generator.js');
require('../js/netwizard-multivendor-routing-generator.js');
require('../js/netwizard-firewall-edge-generator.js');
require('../js/netwizard-switching-generator.js');
require('../js/netwizard-access-security-plan.js');
require('../js/netwizard-access-security-generator.js');
require('../js/netwizard-management-plan.js');
require('../js/netwizard-management-generator.js');
require('../js/netwizard-ha-services-plan.js');
require('../js/netwizard-ha-services-generator.js');

const stableGlobal=global.genConfig;
require('../js/netwizard-cisco-routing-integration.js');
require('../js/netwizard-multivendor-routing-integration.js');
require('../js/netwizard-firewall-edge-integration.js');
require('../js/netwizard-switching-integration.js');
require('../js/netwizard-access-security-integration.js');
require('../js/netwizard-management-integration.js');
require('../js/netwizard-ha-services-integration.js');

assert.strictEqual(global.genConfig,stableGlobal,'las integraciones no deben volver a sobrescribir genConfig');
assert.deepStrictEqual(browserPipeline.inspect().renderers.map(item=>item.id),['edge.firewall','device.switching','vendor.base']);
assert.deepStrictEqual(browserPipeline.inspect().stages.map(item=>item.id),['routing.cisco','routing.multivendor','security.access','management.baseline','ha.services']);
assert.match(global.genConfig('r1','mikrotik_routeros'),/MikroTik RouterOS/);

console.log('✓ Las integraciones del navegador se registran sin encadenar wrappers globales');
