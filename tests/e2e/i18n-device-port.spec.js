const { test, expect } = require('@playwright/test');

async function resetStorage(page,locale='en'){
  await page.goto('/index.html');
  await page.evaluate(loc=>{localStorage.clear();sessionStorage.clear();localStorage.setItem('nw_locale_v1',loc);},locale);
  await page.reload();
}

test('Dispositivos y Puertos cambian ES/EN sin mezclar sus superficies dinámicas', async ({page})=>{
  await resetStorage(page,'en');

  await page.evaluate(()=>{
    const p=window.NetWizardState.getSnapshot();
    p.devices=[
      {id:'ap-i18n',name:'AP-I18N',kind:'access_point',type:'access_point',
       vendorOs:'ubiquiti_unifi',model:'UniFi U6 Pro',wifiRole:'ap',hasWifi:true},
      {id:'sw-z-i18n',name:'ZZ-SW-I18N',kind:'switch',type:'switch',vendorOs:'cisco_ios'}
    ];
    p.ports=[
      {id:'port-i18n',deviceId:'ap-i18n',name:'eth0',media:'GE',mode:'access',
       accessVlanRef:null,nativeVlanRef:null,allowedVlans:[],desc:'uplink'},
      {id:'trunk-i18n',deviceId:'sw-z-i18n',name:'Gi1/0/48',media:'GE',mode:'trunk',
       accessVlanRef:null,nativeVlanRef:null,allowedVlans:[10,20],desc:'uplink trunk'}
    ];
    p.vlans=[];p.links=[];p.hosts=[];
    window.NetWizardState.replaceProject(p,{source:'i18n-device-port-e2e'});
  });

  await page.click('[data-step="dev"]');
  const devPage=page.locator('#pg-dev');
  await expect(devPage).toBeVisible();
  await expect(devPage).toContainText('Devices');
  await expect(devPage).toContainText('Add device');
  await expect(devPage).toContainText('Registered devices');
  await expect(devPage).toContainText('Access Point');

  const custom=page.locator('#nwCustomModelBlock');
  await expect(custom).toBeVisible();
  await expect(custom).toContainText('Project custom model');
  await page.click('#nwCustomNew');
  await expect(custom).toContainText('Manufacturer');
  await expect(custom).toContainText('Revision');
  await expect(custom).toContainText('Save model');

  const model=page.locator('#devModel');
  await model.fill('UniFi U6 Pro');
  await model.dispatchEvent('input');
  await expect(page.locator('#devModelHint')).toContainText('Suggested type: Access Point');
  await expect(page.locator('#devModelHint')).toContainText('Wi‑Fi 6 AP. The uplink is typically a trunk');

  await page.evaluate(()=>window.NetWizardI18n.setLocale('es'));
  await expect(devPage).toContainText('Dispositivos');
  await expect(devPage).toContainText('Añadir dispositivo');
  await expect(devPage).toContainText('Punto de acceso');
  await expect(custom).toContainText('Modelo personalizado del proyecto');
  await expect(custom).toContainText('Fabricante');
  await expect(custom).toContainText('Guardar modelo');
  await expect(page.locator('#devModelHint')).toContainText('Tipo sugerido: Punto de acceso');
  await expect(page.locator('#devModelHint')).toContainText('AP Wi‑Fi 6. Uplink normalmente trunk');

  await page.evaluate(()=>window.NetWizardI18n.setLocale('en'));
  await page.click('[data-step="ports"]');
  const portPage=page.locator('#pg-ports');
  await expect(portPage).toBeVisible();
  await expect(portPage).toContainText('Ports & Interfaces');
  await expect(portPage).toContainText('Add port / interface');
  await expect(portPage).toContainText('Registered ports');
  await expect(page.locator('#nwBulkPortEditor')).toContainText('Bulk port creation and editing');
  await expect(page.locator('#nwBulkPortEditor')).toContainText('Name root');
  await expect(page.locator('#portsPageInfo')).toContainText('1 ports · page 1/1');

  await page.locator('[data-ep="trunk-i18n"]').click();
  await expect(page.locator('#btnAddPort')).toContainText('Save changes');
  await expect(page.locator('#pDev')).toHaveValue('sw-z-i18n');
  await expect(page.locator('#pRole')).toHaveValue('trunk');

  await page.evaluate(()=>window.NetWizardI18n.setLocale('es'));
  await expect(page.locator('#pDev')).toHaveValue('sw-z-i18n');
  await expect(page.locator('#pRole')).toHaveValue('trunk');
  await expect(portPage).toContainText('Puertos & Interfaces');
  await expect(portPage).toContainText('Añadir puerto / interfaz');
  await expect(page.locator('#nwBulkPortEditor')).toContainText('Creación y edición masiva de puertos');
  await expect(page.locator('#portsPageInfo')).toContainText('1 puertos · página 1/1');
  await expect(page.locator('#btnAddPort')).toContainText('Guardar cambios');
});
