const { test, expect } = require('@playwright/test');

test('selector de Informes controla botones e informes en English', async ({page})=>{
  await page.goto('/index.html');
  await page.evaluate(()=>{ localStorage.clear(); sessionStorage.clear(); });
  await page.reload();

  await expect(page.locator('#nwReportLocaleSel')).toBeVisible();
  await page.locator('#nwReportLocaleSel').selectOption('en');

  await expect.poll(()=>page.evaluate(()=>window.NetWizardI18n.getReportLocale())).toBe('en');
  await expect(page.locator('#btnDetailedReport')).toHaveText('📄 Detailed report');
  await expect(page.locator('#btnEducationalReport')).toHaveText('🎓 Educational report');
  await expect(page.locator('#btnCompactReport')).toHaveText('🧰 Installation report');

  const detailedPopup=page.waitForEvent('popup');
  await page.locator('#btnDetailedReport').click();
  const detailed=await detailedPopup;
  await detailed.waitForLoadState('domcontentloaded');
  await expect(detailed.locator('html')).toHaveAttribute('lang','en');
  await expect(detailed.locator('body')).toContainText('Detailed report');
  await expect(detailed.locator('body')).toContainText('Executive summary');
  await expect(detailed.locator('body')).toContainText('Print / Save PDF');
  await expect(detailed.locator('body')).not.toContainText('Informe detallado');
  await detailed.close();

  const educationalPopup=page.waitForEvent('popup');
  await page.locator('#btnEducationalReport').click();
  const educational=await educationalPopup;
  await educational.waitForLoadState('domcontentloaded');
  await expect(educational.locator('html')).toHaveAttribute('lang','en');
  await expect(educational.locator('body')).toContainText('Educational mode');
  await expect(educational.locator('body')).toContainText('Affected concept');
  await educational.close();

  await page.locator('#btnCompactReport').click();
  const cfg=page.locator('#nwInstallReportConfigurator');
  await expect(cfg).toBeVisible();
  await expect(cfg).toContainText('Configure installation report');
  await expect(cfg).toContainText('Generate report');

  const installPopup=page.waitForEvent('popup');
  await cfg.getByRole('button',{name:'🧰 Generate report'}).click();
  const install=await installPopup;
  await install.waitForLoadState('domcontentloaded');
  await expect(install.locator('html')).toHaveAttribute('lang','en');
  await expect(install.locator('body')).toContainText('Technical installation manual');
  await expect(install.locator('body')).toContainText('Print / Save PDF');
  await expect(install.locator('body')).not.toContainText('Manual técnico de instalación');
});
