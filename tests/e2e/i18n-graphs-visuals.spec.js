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

test('Graphs y V5 cambian ES/EN en caliente sin recargar', async ({page})=>{
  await resetStorage(page);
  await page.locator('[data-step="graphs"]').first().click();

  const root=page.locator('#pg-graphs');
  await expect(root).toBeVisible();
  await expect(root).toContainText('Graph Views');
  await expect(root).toContainText('Main V5');
  await expect(root).toContainText('Physical topology');
  await expect(page.locator('#v5AutoLoc')).toHaveText('🪄 Auto-place');
  await expect(page.locator('#v5Panel')).toContainText('V5 Panel');
  await expect(page.locator('#v5ApplyLayout')).toHaveText('🧠 Arrange V5');
  await expect(page.locator('#v5LayoutMode')).toHaveAttribute('title','V5 layout algorithm');

  await page.evaluate(()=>window.NetWizardI18n.setLocale('es'));

  await expect(root).toContainText('Vistas gráficas');
  await expect(root).toContainText('V5 principal');
  await expect(root).toContainText('Topología física');
  await expect(page.locator('#v5AutoLoc')).toHaveText('🪄 Auto-ubicar');
  await expect(page.locator('#v5Panel')).toContainText('Panel V5');
  await expect(page.locator('#v5ApplyLayout')).toHaveText('🧠 Ordenar V5');
  await expect(page.locator('#v5LayoutMode')).toHaveAttribute('title','Algoritmo de ordenación V5');

  await page.evaluate(()=>window.NetWizardI18n.setLocale('en'));
  await expect(page.locator('#v5Panel')).toContainText('V5 Panel');
  await expect(page.locator('#v5AutoLoc')).toHaveText('🪄 Auto-place');
});
