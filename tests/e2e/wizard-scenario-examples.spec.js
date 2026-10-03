const { test, expect } = require('@playwright/test');

async function resetStorage(page){
  await page.goto('/index.html');
  await page.evaluate(()=>{localStorage.clear();sessionStorage.clear();});
  await page.reload();
}

test('Oficina pequeña ofrece Nuevo o Golden Path y el ejemplo queda READY', async ({page})=>{
  await resetStorage(page);
  page.on('dialog',dialog=>dialog.accept());

  await page.click('[data-step="wiz"]');
  await expect(page.locator('[data-sc="production-office"]')).toHaveCount(0);
  await page.click('[data-sc="office"]');

  await expect(page.locator('#wModeCard')).toBeVisible();
  await expect(page.locator('#wNewScenario')).toBeVisible();
  await expect(page.locator('#wLoadExample')).toBeVisible();
  await expect(page.locator('#wLoadExample')).toContainText('Golden Path · Oficina pequeña');
  await expect(page.locator('#wStep2Card')).toBeHidden();

  await page.click('#wLoadExample');
  await expect(page.locator('#pg-dash')).toBeVisible();

  const result=await page.evaluate(()=>{
    const p=window.NetWizardState.getSnapshot();
    const gate=window.NetWizardProductionGate.runProductionGate(p,{productionMode:true,strict:true});
    return{
      name:p.projName,
      devices:p.devices.length,
      vlans:p.vlans.length,
      links:p.links.length,
      status:gate.status,
      warnings:gate.counts.warnings,
      blocking:gate.counts.blocking
    };
  });

  expect(result.name).toBe('Sample · Small Office');
  expect(result.devices).toBeGreaterThanOrEqual(3);
  expect(result.vlans).toBeGreaterThanOrEqual(3);
  expect(result.links).toBeGreaterThanOrEqual(2);
  expect(result.status).toBe('ready');
  expect(result.warnings).toBe(0);
  expect(result.blocking).toBe(0);
});

test('Oficina pequeña mantiene el flujo Nuevo del asistente', async ({page})=>{
  await resetStorage(page);

  await page.click('[data-step="wiz"]');
  await page.click('[data-sc="office"]');
  await page.click('#wNewScenario');

  await expect(page.locator('#wModeCard')).toBeHidden();
  await expect(page.locator('#wStep2Card')).toBeVisible();
  await expect(page.locator('[data-dp="fw"]')).toBeVisible();
  await expect(page.locator('[data-dp="pc"]')).toBeVisible();

  await page.click('#wBack1');
  await expect(page.locator('#wModeCard')).toBeVisible();
  await expect(page.locator('#wStep2Card')).toBeHidden();
});
