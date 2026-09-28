const { test, expect } = require('@playwright/test');

test('runtime final expone racks, cableado e informe desde el entrypoint publicado', async ({page})=>{
  await page.goto('/index.html');
  await page.waitForLoadState('load');

  const status=await page.evaluate(()=>window.NetWizardRuntime.verify());
  expect(status.ok).toBe(true);
  expect(status.rackIntegrationReady).toBe(true);
  expect(status.missingModules).toEqual([]);
  expect(status.missingGlobals).toEqual([]);
  expect(status.duplicateScripts).toEqual([]);
  expect(status.invalidOrder).toEqual([]);

  const globals=await page.evaluate(()=>({
    rackModel:window.NetWizardRackModel?.version||null,
    rackUi:window.NetWizardRackUi?.version||null,
    cabling:window.NetWizardStructuredCabling?.version||null,
    cablingUi:window.NetWizardStructuredCablingUi?.version||null,
    rackIntegration:window.NetWizardRackProductionIntegration?.version||null,
    reportModel:window.NetWizardReportModel?.version||null,
    installationReport:window.NetWizardInstallationReport?.version||null,
    rackGate:!!window.NetWizardProductionGate?.__rackExtensionInstalled
  }));
  expect(globals.rackModel).toBeTruthy();
  expect(globals.rackUi).toBeTruthy();
  expect(globals.cabling).toBeTruthy();
  expect(globals.cablingUi).toBeTruthy();
  expect(globals.rackIntegration).toBeTruthy();
  expect(globals.reportModel).toBeTruthy();
  expect(globals.installationReport).toBe('netwizard-installation-report-v7');
  expect(globals.rackGate).toBe(true);

  await page.evaluate(()=>window.navTo('physical'));
  await expect(page.locator('#rackUiMount')).toBeAttached();
  await expect(page.locator('#structuredCablingMount')).toBeAttached();
});
