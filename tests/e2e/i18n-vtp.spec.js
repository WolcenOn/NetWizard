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

test('VTP y su verificación observada cambian ES/EN en caliente', async ({page})=>{
  await resetStorage(page);

  await page.evaluate(()=>{
    const p=window.NetWizardState.getSnapshot();
    p.devices=[{id:'sw1',name:'SW-01',kind:'switch',type:'switch',vendorOs:'cisco_ios'}];
    p.vtp={domain:'CORP',password:'',version:'3',pruning:'yes',roles:{sw1:'server'}};
    p.observedState={vtpDevices:{}};
    window.NetWizardState.replaceProject(p,{source:'i18n-vtp-e2e'});
  });

  await page.locator('[data-step="vlan"]').first().click();
  await expect(page.locator('#vtpDomain')).toHaveValue('CORP');
  await expect(page.locator('#btnSaveVtp')).toHaveText('✔ Save VTP');
  await expect(page.locator('#vtpSwitchRoles')).toContainText('VTP role');
  await expect(page.locator('#nwVtpVerificationCard')).toBeVisible();
  await expect(page.locator('#nwVtpVerificationCard')).toContainText('VTP production verification');
  await expect(page.locator('#vtpObsStatus')).toContainText('Review pending');
  await expect(page.locator('#vtpObsStatus')).toContainText('observed VTP state verification is missing');

  await page.fill('#vtpDomain','DRAFT-DOMAIN');
  await page.fill('#vtpPassword','draft-secret');
  await page.selectOption('#vtpVersion','2');
  await page.selectOption('#vtpPruning','no');
  await page.locator('[data-vtprole="sw1"]').selectOption('client');
  await page.fill('#vtpObsDomain','DRAFT-OBS');
  await page.selectOption('#vtpObsVersion','2');
  await page.selectOption('#vtpObsMode','client');
  await page.fill('#vtpObsRevision','7');
  await page.selectOption('#vtpObsPrimary','no');
  await page.fill('#vtpObsPrimaryId','draft-primary');
  await page.selectOption('#vtpObsConflict','yes');
  await page.fill('#vtpObsDigestErrors','2');
  await page.fill('#vtpObsRevisionErrors','3');

  await page.evaluate(()=>window.NetWizardI18n.setLocale('es'));

  await expect(page.locator('#vtpDomain')).toHaveValue('DRAFT-DOMAIN');
  await expect(page.locator('#vtpPassword')).toHaveValue('draft-secret');
  await expect(page.locator('#vtpVersion')).toHaveValue('2');
  await expect(page.locator('#vtpPruning')).toHaveValue('no');
  await expect(page.locator('[data-vtprole="sw1"]')).toHaveValue('client');
  await expect(page.locator('#vtpObsDomain')).toHaveValue('DRAFT-OBS');
  await expect(page.locator('#vtpObsVersion')).toHaveValue('2');
  await expect(page.locator('#vtpObsMode')).toHaveValue('client');
  await expect(page.locator('#vtpObsRevision')).toHaveValue('7');
  await expect(page.locator('#vtpObsPrimaryId')).toHaveValue('draft-primary');
  await expect(page.locator('#vtpObsConflict')).toHaveValue('yes');
  await expect(page.locator('#vtpObsDigestErrors')).toHaveValue('2');
  await expect(page.locator('#vtpObsRevisionErrors')).toHaveValue('3');

  await expect(page.locator('#btnSaveVtp')).toHaveText('✔ Guardar VTP');
  await expect(page.locator('#vtpSwitchRoles')).toContainText('Rol VTP');
  await expect(page.locator('#nwVtpVerificationCard')).toContainText('Verificación VTP para producción');
  await expect(page.locator('#vtpObsStatus')).toContainText('Revisión pendiente');
  await expect(page.locator('#vtpObsStatus')).toContainText('falta verificación observada');

  await page.fill('#vtpObsDomain','CORP');
  await page.selectOption('#vtpObsVersion','3');
  await page.selectOption('#vtpObsMode','server');
  await page.fill('#vtpObsRevision','1');
  await page.selectOption('#vtpObsPrimary','yes');
  await page.fill('#vtpObsPrimaryId','SW-01');
  await page.selectOption('#vtpObsConflict','no');
  await page.fill('#vtpObsDigestErrors','0');
  await page.fill('#vtpObsRevisionErrors','0');
  await page.click('#vtpObsSave');
  await expect(page.locator('#vtpObsStatus')).toContainText('Evidencia VTP coherente');

  await page.evaluate(()=>window.NetWizardI18n.setLocale('en'));
  await expect(page.locator('#nwVtpVerificationCard')).toContainText('VTP production verification');
  await expect(page.locator('#vtpObsStatus')).toContainText('VTP evidence is coherent');

  const persisted=await page.evaluate(()=>{
    const p=window.NetWizardState.getSnapshot();
    return p.observedState.vtpDevices.sw1;
  });
  expect(persisted.domain).toBe('CORP');
  expect(persisted.version).toBe('3');
  expect(persisted.mode).toBe('server');
  expect(persisted.primary).toBe(true);
});
