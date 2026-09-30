'use strict';

const assert=require('assert');
const fs=require('fs');
const path=require('path');

const html=fs.readFileSync(path.join(__dirname,'..','index.html'),'utf8');
const vlanStart=html.indexOf('id="pg-vlan"');
const hostsStart=html.indexOf('id="pg-hosts"');
const deployStart=html.indexOf('id="pg-cfg"');
const footerStart=html.indexOf('<!-- NAV FOOTER -->');

assert.ok(vlanStart>=0&&hostsStart>vlanStart&&deployStart>hostsStart,'Secciones principales esperadas');
const vlan=html.slice(vlanStart,hostsStart);
const deploy=html.slice(deployStart,footerStart);

for(const id of ['roasDev','roasLanIf','btnRoas','dhcpView','vtpDomain','vtpSwitchRoles','btnSaveVtp']){
  assert.ok(vlan.includes(`id="${id}"`),id+' debe vivir en VLANs & Subnets');
  assert.ok(!deploy.includes(`id="${id}"`),id+' no debe volver a Despliegue');
}
for(const id of ['cfgGenerateServer','devPickCfg','cfgOut','expDeploymentPackage','expAll','expBundle']){
  assert.ok(deploy.includes(`id="${id}"`),id+' debe permanecer en Despliegue');
}

assert.ok(vlan.includes('Servicios VLAN y gateway'),'VLAN debe explicar la intención de los servicios L2/L3');
assert.ok(deploy.includes('Despliegue & Exportación'),'Despliegue debe conservar su propósito');

console.log('✓ RoaS, DHCP y VTP viven en diseño VLAN; Despliegue queda reservado a artefactos y exportación');
