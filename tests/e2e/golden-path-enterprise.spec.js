const { test, expect } = require('@playwright/test');

async function resetStorage(page){
  await page.goto('/index.html');
  await page.evaluate(()=>{localStorage.clear();sessionStorage.clear();});
  await page.reload();
}

test('Golden Path Enterprise carga el mismo JSON y activa sus capacidades en navegador', async ({page})=>{
  const errors=[];page.on('pageerror',err=>errors.push(err.message));
  page.on('dialog',dialog=>dialog.accept());
  await resetStorage(page);

  await page.evaluate(()=>window.navTo('cfg'));
  await expect(page.locator('#pg-cfg')).toBeVisible();
  await expect(page.locator('#btnGoldenPathEnterprise')).toBeVisible();
  await page.locator('#btnGoldenPathEnterprise').click();

  await expect.poll(()=>page.evaluate(()=>window.NetWizardState.getSnapshot().projName)).toBe('Golden Path Enterprise · HQ + Sucursal');

  const state=await page.evaluate(()=>{
    const p=window.NetWizardState.getSnapshot();
    return{
      devices:p.devices.length,ports:p.ports.length,vlans:p.vlans.length,hosts:p.hosts.length,wan:p.wanCircuits.length,
      ospf:window.NetWizardOspf.validateProject(p),
      vpn:window.NetWizardSiteToSiteVpn.validateProject(p),
      resilience:window.NetWizardWanResilience.validateProject(p),
      wifi:window.NetWizardWifiPlanning.validateProject(p),
      ipv6:window.NetWizardIpv6Vrf.validateProject(p),
      services:window.NetWizardInternalServices.validateProject(p),
      capacity:window.NetWizardTrafficCapacity.validateProject(p),
      acceptance:window.NetWizardInterventionExecution.acceptanceChecks(p),
      budget:window.NetWizardBudget.build(p)
    };
  });

  expect(state.devices).toBe(11);
  expect(state.ports).toBe(58);
  expect(state.vlans).toBe(12);
  expect(state.hosts).toBe(22);
  expect(state.wan).toBe(4);
  expect(state.ospf.ok).toBe(true);
  expect(state.vpn.ok).toBe(true);
  expect(state.resilience.ok).toBe(true);
  expect(state.wifi.ok).toBe(true);
  expect(state.ipv6.ok).toBe(true);
  expect(state.services.ok).toBe(true);
  expect(state.capacity.ok).toBe(true);
  expect(state.acceptance.ready).toBe(true);
  expect(state.budget.counts.unpriced).toBe(0);
  expect(state.budget.totals.year1Price).toBeGreaterThan(state.budget.totals.year1Cost);

  await page.evaluate(()=>window.navTo('physical'));
  await expect(page.locator('#budgetMount')).toBeVisible();
  await expect(page.locator('#budgetMount')).toContainText('BOM & Presupuesto');
  await expect(page.locator('#fieldExecutionMount')).toContainText('100%');

  await page.evaluate(()=>window.navTo('validate'));
  await expect(page.locator('#nwWanResiliencePanel')).toBeVisible();

  await page.evaluate(()=>window.navTo('cfg'));
  await expect(page.locator('#pg-cfg')).toBeVisible();
  const downloadPromise=page.waitForEvent('download');
  await page.locator('#btnGoldenPathEnterpriseDownload').click();
  const download=await downloadPromise;
  expect(download.suggestedFilename()).toBe('netwizard-golden-path-enterprise-complete.json');

  expect(errors).toEqual([]);
});
