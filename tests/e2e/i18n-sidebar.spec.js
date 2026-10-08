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


test('wizard y ubicaciones cambian completamente entre ES y EN', async ({ page }) => {
  await page.goto('/index.html');
  await page.evaluate(() => { localStorage.clear(); sessionStorage.clear(); });
  await page.reload();

  await page.evaluate(() => window.NetWizardI18n.setLocale('en'));
  await expect(page.locator('#pg-wiz h1')).toHaveText('⚡ Design wizard');
  await expect(page.locator('#wStep1Card .card-t')).toHaveText('Step 1 — What type of network are you designing?');
  await expect(page.locator('#wSec option[value="low"]')).toHaveText('Basic (Lab)');
  await expect(page.locator('#wApply')).toHaveText('⚡ Apply and start');
  await expect(page.locator('#pg-loc h1')).toHaveText('📍 Step 0 · Locations');
  await expect(page.locator('#plType option[value="building"]')).toHaveText('Building');
  await expect(page.locator('#plName')).toHaveAttribute('placeholder','Building A / Floor 1 / Rack R1 / Room 203');
  await expect(page.locator('[data-i18n="locations.usage.title"]')).toHaveText('🧭 Location usage');

  await page.evaluate(() => window.NetWizardI18n.setLocale('es'));
  await expect(page.locator('#pg-wiz h1')).toHaveText('⚡ Asistente de diseño');
  await expect(page.locator('#wStep1Card .card-t')).toHaveText('Paso 1 — ¿Qué tipo de red vas a diseñar?');
  await expect(page.locator('#wSec option[value="low"]')).toHaveText('Básica (Lab)');
  await expect(page.locator('#wApply')).toHaveText('⚡ Aplicar y empezar');
  await expect(page.locator('#pg-loc h1')).toHaveText('📍 Paso 0 · Ubicaciones');
  await expect(page.locator('#plType option[value="building"]')).toHaveText('Edificio');
  await expect(page.locator('#plName')).toHaveAttribute('placeholder','Edificio A / Planta 1 / Rack R1 / Sala 203');
  await expect(page.locator('[data-i18n="locations.usage.title"]')).toHaveText('🧭 Uso de ubicaciones');
});
