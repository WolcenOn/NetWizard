const { test, expect } = require('@playwright/test');

test('sidebar físico y validación traducen y mantienen numeración secuencial', async ({ page }) => {
  await page.goto('/index.html');
  await page.evaluate(() => { localStorage.clear(); sessionStorage.clear(); });
  await page.reload();

  const number = step => page.locator(`.sb-it[data-step="${step}"] .sb-num`);

  await expect(number('physical')).toHaveText('2');
  await expect(number('ports')).toHaveText('3');
  await expect(number('vlan')).toHaveText('4');
  await expect(number('hosts')).toHaveText('5');
  await expect(number('iot')).toHaveText('6');
  await expect(number('links')).toHaveText('7');
  await expect(number('fw')).toHaveText('8');
  await expect(number('validate')).toHaveText('9');
  await expect(number('cfg')).toHaveText('10');

  await page.evaluate(() => window.NetWizardI18n.setLocale('en'));
  await expect(page.locator('.sb-it[data-step="physical"]')).toContainText('Physical inventory');
  await expect(page.locator('.sb-it[data-step="validate"]')).toContainText('Validation & analysis');
  await expect(page.locator('#pg-physical h1')).toHaveText('🗄 Physical inventory / As-Built');
  await expect(page.locator('.sb-sec[data-i18n="sidebar.sec.check"]')).toHaveText('Check');
  await expect(page.locator('.sb-sec[data-i18n="sidebar.sec.deploy"]')).toHaveText('Deploy');
  await expect(page.locator('.sb-sec[data-i18n="sidebar.sec.summary"]')).toHaveText('Summary');

  await page.evaluate(() => window.NetWizardI18n.setLocale('es'));
  await expect(page.locator('.sb-it[data-step="physical"]')).toContainText('Inventario físico');
  await expect(page.locator('.sb-it[data-step="validate"]')).toContainText('Validación & análisis');
  await expect(page.locator('#pg-physical h1')).toHaveText('🗄 Inventario físico / As-Built');
  await expect(page.locator('.sb-sec[data-i18n="sidebar.sec.check"]')).toHaveText('Comprobar');
  await expect(page.locator('.sb-sec[data-i18n="sidebar.sec.deploy"]')).toHaveText('Desplegar');
  await expect(page.locator('.sb-sec[data-i18n="sidebar.sec.summary"]')).toHaveText('Resumen');
});
