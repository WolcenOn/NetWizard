const { test, expect } = require('@playwright/test');

test('imagen productiva mantiene la frontera browser/private y no genera Cisco localmente', async ({page,request})=>{
  const health=await request.get('/api/health');
  expect(health.ok()).toBeTruthy();
  expect((await health.json()).ok).toBe(true);

  const errors=[];
  page.on('pageerror',err=>errors.push(err.message));
  await page.goto('/index.html');

  await expect.poll(()=>page.evaluate(()=>({
    state:typeof window.NetWizardState?.getSnapshot==='function',
    privateUi:typeof window.NetWizardPrivateDeploymentUi?.deviceConfig==='function',
    legacy:typeof window.NetWizardLegacyConfigGenerator,
    vendorGenerators:typeof window.NetWizardVendorConfigGenerators
  }))).toEqual({
    state:true,
    privateUi:true,
    legacy:'undefined',
    vendorGenerators:'undefined'
  });

  await page.evaluate(()=>{
    const p=window.NetWizardState.getSnapshot();
    Object.assign(p,{
      projName:'Production browser boundary',
      workflow:{mode:'design'},
      devices:[{id:'r1',name:'RTR-PROD',type:'router',kind:'router',vendorOs:'cisco_ios'}],
      ports:[],vlans:[],subnets:[],hosts:[],links:[],fwRules:[]
    });
    window.NetWizardState.replaceProject(p,{source:'e2e-production-boundary'});
    window.navTo('cfg');
  });

  await expect(page.locator('[data-dcfg="r1"]')).toHaveClass(/on/);
  await expect(page.locator('#cfgOut')).toHaveValue(/Configuración privada pendiente para cisco_ios/);
  await expect(page.locator('#cfgOut')).not.toHaveValue(/configure terminal|hostname RTR-PROD/);
  await expect(page.locator('#cfgReadiness')).toContainText('PRIVATE ENGINE PENDIENTE');
  await expect.poll(
    ()=>page.evaluate(()=>window.NetWizardConfigView?.readinessForDevice?.('r1','cisco_ios')?.status||'')
  ).toBe('pending');

  const scripts=await page.locator('script[src]').evaluateAll(nodes=>nodes.map(n=>n.getAttribute('src')||''));
  expect(scripts.some(src=>src.includes('netwizard-legacy-config-generator.js'))).toBe(false);
  expect(scripts.some(src=>src.includes('netwizard-vendor-config-generators.js'))).toBe(false);
  expect(errors).toEqual([]);
});
