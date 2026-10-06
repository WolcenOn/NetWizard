const { test, expect } = require('@playwright/test');

async function resetStorage(page){
  await page.goto('/index.html');
  await page.evaluate(()=>{
    localStorage.clear();
    sessionStorage.clear();
    localStorage.setItem('nw_locale_v1','en');
  });
  await page.reload();
}

test('Deployment / Export cambia ES/EN en caliente sin alterar la configuración técnica', async ({page})=>{
  await resetStorage(page);

  await page.evaluate(()=>{
    const p=window.NetWizardState.getSnapshot();
    p.projName='Deploy Locale';
    p.devices=[{id:'sw1',name:'SW-01',kind:'switch',type:'switch',vendorOs:'cisco_ios'}];
    p.vlans=[{id:'v10',vlanId:10,name:'Users',color:'#3b82f6'}];
    p.subnets=[{id:'s10',vlanRef:'v10',cidr:'10.10.10.0/24',gateway:'10.10.10.1'}];
    window.NetWizardState.replaceProject(p,{source:'i18n-deploy-e2e'});
  });

  await page.locator('[data-step="cfg"]').first().click();
  const root=page.locator('#pg-cfg');
  await expect(root).toBeVisible();
  await expect(root).toContainText('Deployment & Export');
  await expect(root).toContainText('Per-device config');
  await expect(root).toContainText('Export');
  await expect(page.locator('#impJsonFile')).toHaveText('📂 Load JSON file');
  await expect(page.locator('#jsonImportStatus')).toContainText('paste JSON');

  const rawBefore=await page.locator('#cfgOut').inputValue();
  const commentedBefore=await page.locator('#cfgOutComment').inputValue();
  if(commentedBefore.includes('configure terminal')){
    expect(commentedBefore).toContain('Enters global configuration mode.');
  }

  await page.evaluate(()=>window.NetWizardI18n.setLocale('es'));

  await expect(root).toContainText('Despliegue & Exportación');
  await expect(root).toContainText('Config por dispositivo');
  await expect(root).toContainText('Exportar');
  await expect(page.locator('#impJsonFile')).toHaveText('📂 Cargar archivo JSON');
  await expect(page.locator('#jsonImportStatus')).toContainText('Puedes pegar un JSON');

  const rawEs=await page.locator('#cfgOut').inputValue();
  const commentedEs=await page.locator('#cfgOutComment').inputValue();
  expect(rawEs).toBe(rawBefore);
  if(commentedEs.includes('configure terminal')){
    expect(commentedEs).toContain('Entra al modo de configuración global.');
  }

  await page.evaluate(()=>window.NetWizardI18n.setLocale('en'));
  await expect(root).toContainText('Deployment & Export');
  expect(await page.locator('#cfgOut').inputValue()).toBe(rawBefore);
});

test('As-Built export controls cambian de locale sin modificar el inventario', async ({page})=>{
  await resetStorage(page);

  await page.evaluate(()=>{
    const p=window.NetWizardState.getSnapshot();
    p.projName='AsBuilt Locale';
    p.devices=[{id:'d1',name:'SW-01',kind:'switch',type:'switch',vendorOs:'cisco_ios'}];
    window.NetWizardState.replaceProject(p,{source:'i18n-asbuilt-e2e'});
  });

  await page.locator('[data-step="physical"]').first().click();
  const pack=page.locator('#asBuiltExportPackMount');
  await expect(pack).toContainText('Inventory / As-Built');
  await expect(pack).toContainText('Devices CSV');

  await page.evaluate(()=>window.NetWizardI18n.setLocale('es'));
  await expect(pack).toContainText('Inventario / As-Built');
  await expect(pack).toContainText('Equipos CSV');

  await page.evaluate(()=>window.NetWizardI18n.setLocale('en'));
  await expect(pack).toContainText('Devices CSV');
});
