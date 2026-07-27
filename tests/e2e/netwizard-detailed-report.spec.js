const { test, expect } = require('@playwright/test');

test('expone informes profesional y educativo sin IDs internos', async ({ page }) => {
  await page.goto('/index.html');
  await expect(page.locator('#btnDetailedReport')).toBeVisible();
  await expect(page.locator('#btnEducationalReport')).toBeVisible();

  const result = await page.evaluate(() => {
    const project = window.NetWizardState.getSnapshot();
    const vlanId = 'vlanive38pz1cfmrux1zaz';
    project.projName = 'E2E Informe';
    project.devices = [{ id:'dev_internal_1', name:'SW-CORE', type:'switch' }];
    project.ports = [{ id:'port_internal_1', deviceId:'dev_internal_1', name:'Gi1/0/1', mode:'access', accessVlanRef:vlanId }];
    project.vlans = [{ id:vlanId, vlanId:10, name:'Dirección' }];
    project.subnets = [{ id:'sn_internal_1', vlanRef:vlanId, cidr:'10.10.10.0/24', gateway:'10.10.10.1' }];
    project.hosts = [{ id:'host_internal_1', name:'PC-01', deviceId:'dev_internal_1', portId:'port_internal_1', vlanRef:vlanId, subnetRef:'sn_internal_1' }];
    const gate = { status:'blocked', counts:{blocking:1,errors:1,warnings:0}, issues:[{code:'NW-DHCP-001',severity:'error',category:'DHCP',blocking:true,message:'Scope DHCP ausente'}] };
    return {
      professional: window.NetWizardDetailedReport.build(project,{gateReport:gate,reportMode:'professional'}),
      educational: window.NetWizardDetailedReport.build(project,{gateReport:gate,reportMode:'educational'})
    };
  });

  expect(result.professional).toContain('VLAN 10 · Dirección');
  expect(result.professional).not.toContain('vlanive38pz1cfmrux1zaz');
  expect(result.professional).toContain('Acciones recomendadas');
  expect(result.professional).toContain('Checklist de corrección');
  expect(result.professional).toContain('BLOQUEADO');
  expect(result.educational).toContain('Concepto afectado');
  expect(result.educational).toContain('Cómo corregirlo');
});
