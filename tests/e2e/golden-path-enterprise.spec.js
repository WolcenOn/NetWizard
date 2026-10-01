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

  await expect.poll(()=>page.evaluate(()=>window.NetWizardState.getSnapshot().projName)).toBe('Golden Path Multisite Secure · 4 sedes');

  const state=await page.evaluate(()=>{
    const p=window.NetWizardState.getSnapshot();
    return{
      devices:p.devices.length,ports:p.ports.length,vlans:p.vlans.length,hosts:p.hosts.length,wan:p.wanCircuits.length,
      ospf:window.NetWizardOspf.validateProject(p),
      wifi:window.NetWizardWifiPlanning.validateProject(p),
      ipv6:window.NetWizardIpv6Vrf.validateProject(p),
      services:window.NetWizardInternalServices.validateProject(p),
      capacity:window.NetWizardTrafficCapacity.validateProject(p),
      budget:window.NetWizardBudget.build(p)
    };
  });

  expect(state.devices).toBe(12);
  expect(state.ports).toBeGreaterThan(60);
  expect(state.vlans).toBe(24);
  expect(state.hosts).toBe(20);
  expect(state.wan).toBe(0);
  expect(state.ospf.ok).toBe(true);
  expect(state.wifi.ok).toBe(true);
  expect(state.ipv6.ok).toBe(true);
  expect(state.services.ok).toBe(true);
  expect(state.capacity.ok).toBe(true);
  expect(state.budget.counts.unpriced).toBe(0);
  expect(state.budget.totals.year1Price).toBeGreaterThan(state.budget.totals.year1Cost);

  await page.evaluate(()=>window.navTo('physical'));
  await expect(page.locator('#budgetMount')).toBeVisible();
  await expect(page.locator('#budgetMount')).toContainText('BOM & Presupuesto');

  await page.evaluate(()=>window.navTo('validate'));

  await page.evaluate(()=>window.navTo('cfg'));
  await expect(page.locator('#pg-cfg')).toBeVisible();
  const downloadTarget=await page.evaluate(async()=>{
    const original=HTMLAnchorElement.prototype.click;
    let captured=null;
    HTMLAnchorElement.prototype.click=function(){
      captured={href:this.getAttribute('href'),download:this.getAttribute('download')};
    };
    try{
      await window.NetWizardGoldenPathEnterprise.download();
      return captured;
    }finally{
      HTMLAnchorElement.prototype.click=original;
    }
  });
  expect(downloadTarget).toEqual({
    href:'./samples/golden-path-enterprise-complete.json',
    download:'netwizard-golden-path-enterprise-complete.json'
  });

  expect(errors).toEqual([]);
});
