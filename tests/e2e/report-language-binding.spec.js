const { test, expect } = require('@playwright/test');

test('idioma de interfaz controla botones e idioma de Informes controla el documento', async ({page})=>{
  await page.goto('/index.html');
  await page.evaluate(()=>{ localStorage.clear(); sessionStorage.clear(); });
  await page.reload();

  await expect(page.locator('#nwLocaleSel')).toBeVisible();
  await expect(page.locator('#nwReportLocaleSel')).toBeVisible();

  // Interface English, reports Spanish: buttons follow UI, document follows Reports.
  await page.locator('#nwLocaleSel').selectOption('en');
  await page.locator('#nwReportLocaleSel').selectOption('es');

  await expect.poll(()=>page.evaluate(()=>window.NetWizardI18n.getLocale())).toBe('en');
  await expect.poll(()=>page.evaluate(()=>window.NetWizardI18n.getReportLocale())).toBe('es');
  await expect(page.locator('#btnDetailedReport')).toHaveText('📄 Detailed report');
  await expect(page.locator('#btnEducationalReport')).toHaveText('🎓 Educational report');
  await expect(page.locator('#btnCompactReport')).toHaveText('🧰 Installation report');

  let popupPromise=page.waitForEvent('popup');
  await page.locator('#btnDetailedReport').click();
  let report=await popupPromise;
  await report.waitForLoadState('domcontentloaded');
  await expect(report.locator('html')).toHaveAttribute('lang','es');
  await expect(report.locator('body')).toContainText('Informe detallado');
  await report.close();

  // Reports English: generated report and print/PDF source must be English.
  await page.locator('#nwReportLocaleSel').selectOption('en');
  await expect.poll(()=>page.evaluate(()=>window.NetWizardI18n.getReportLocale())).toBe('en');

  popupPromise=page.waitForEvent('popup');
  await page.locator('#btnDetailedReport').click();
  report=await popupPromise;
  await report.waitForLoadState('domcontentloaded');
  await expect(report.locator('html')).toHaveAttribute('lang','en');
  await expect(report.locator('body')).toContainText('Detailed report');
  await expect(report.locator('body')).toContainText('Executive summary');
  await expect(report.locator('body')).toContainText('Print / Save PDF');
  await expect(report.locator('body')).not.toContainText('Informe detallado');
  await report.close();

  popupPromise=page.waitForEvent('popup');
  await page.locator('#btnEducationalReport').click();
  report=await popupPromise;
  await report.waitForLoadState('domcontentloaded');
  await expect(report.locator('html')).toHaveAttribute('lang','en');
  await expect(report.locator('body')).toContainText('Educational mode');
  await expect(report.locator('body')).toContainText('Affected concept');
  await report.close();

  await page.locator('#btnCompactReport').click();
  const cfg=page.locator('#nwInstallReportConfigurator');
  await expect(cfg).toBeVisible();
  await expect(cfg).toContainText('Configure installation report');
  await expect(cfg).toContainText('Generate report');

  popupPromise=page.waitForEvent('popup');
  await cfg.getByRole('button',{name:'🧰 Generate report'}).click();
  report=await popupPromise;
  await report.waitForLoadState('domcontentloaded');
  await expect(report.locator('html')).toHaveAttribute('lang','en');
  await expect(report.locator('body')).toContainText('Technical installation manual');
  await expect(report.locator('body')).toContainText('Print / Save PDF');
  await expect(report.locator('body')).not.toContainText('Manual técnico de instalación');
});
