const { test, expect } = require('@playwright/test');

async function resetStorage(page){
  await page.goto('/index.html');
  await page.evaluate(()=>{localStorage.clear();sessionStorage.clear();});
  await page.reload();
}

test('Rack e inventario físico cambian ES/EN sin mezclar textos dinámicos', async ({page})=>{
  await resetStorage(page);

  await page.evaluate(()=>{
    const p=window.NetWizardState.getSnapshot();
    p.physicalLocations=[{id:'room-i18n',name:'Room / Sala',type:'room'}];
    p.racks=[{id:'rack-i18n',name:'RACK-I18N',locationId:'room-i18n',rackUnits:12,numberingDirection:'bottom-up'}];
    p.devices=[{
      id:'sw-i18n',name:'SW-I18N',kind:'switch',type:'switch',
      rackId:'rack-i18n',rack:'rack-i18n',rackUnit:6,rackUnits:1,rackFace:'front'
    }];
    p.ports=[{id:'p-i18n',deviceId:'sw-i18n',name:'Gi1/0/1',mode:'access',media:'GE'}];
    p.rackItems=[];p.patchPanels=[];p.patchConnections=[];p.pdus=[];p.powerConnections=[];
    window.NetWizardState.replaceProject(p,{source:'i18n-rack-e2e'});
    window.NetWizardI18n.setLocale('en');
  });

  await page.click('[data-step="physical"]');
  const rack=page.locator('#rackPlannerMount');
  await expect(rack).toBeVisible();
  await expect(rack).toContainText('Racks, power and passive material');
  await expect(rack).toContainText('Rack and power editor');
  await expect(rack).toContainText('Organize');
  await expect(rack).toContainText('Power connections');
  await expect(rack).not.toContainText('alimentación');
  await expect(rack).not.toContainText('Organizar');

  await page.click('[data-action="edit-rack"][data-id="rack-i18n"]');
  await page.click('[data-action="update-selected-rack"][data-id="rack-i18n"]');
  await expect(rack).toContainText('Rack updated. Devices, passive material, PDUs and cabling were preserved.');

  await page.evaluate(()=>window.NetWizardI18n.setLocale('es'));
  await expect(rack).toContainText('Rack actualizado. Se han conservado sus equipos, material pasivo, PDUs y cableado.');
  await expect(rack).toContainText('Racks, alimentación y material pasivo');
  await expect(rack).toContainText('Editor de racks y alimentación');
  await expect(rack).toContainText('Organizar');

  await page.evaluate(()=>window.NetWizardI18n.setLocale('en'));
  await page.click('[data-step="dev"]');
  const deviceFields=page.locator('#nwPhysicalDeviceFields');
  await expect(deviceFields).toBeVisible();
  await expect(deviceFields).toContainText('Device inventory');
  await expect(deviceFields).toContainText('Serial number');
  await expect(deviceFields).toContainText('Power budget (W)');

  await page.click('[data-step="ports"]');
  const portFields=page.locator('#nwAdvancedPortFields');
  await expect(portFields).toBeVisible();
  await expect(portFields).toContainText('Advanced interface properties');
  await expect(portFields).toContainText('Capacity and configuration');
  await expect(portFields).toContainText('Observed / As-Built');

  await page.evaluate(()=>window.NetWizardI18n.setLocale('es'));
  await expect(portFields).toContainText('Propiedades avanzadas de interfaz');
  await expect(portFields).toContainText('Capacidad y configuración');
  await expect(portFields).toContainText('Observado / As-Built');
});
