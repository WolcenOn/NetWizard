const { test, expect } = require('@playwright/test');

test('imagen productiva genera config en servidor sin publicar generadores vendor', async ({page,request})=>{
  const health=await request.get('/api/health');
  expect(health.ok()).toBeTruthy();
  expect((await health.json()).ok).toBe(true);

  const caps=await request.get('/api/capabilities');
  expect(caps.ok()).toBeTruthy();
  expect((await caps.json()).selfHostedPrivateGeneration).toBe(true);

  const errors=[];
  page.on('pageerror',err=>errors.push(err.message));
  await page.goto('/index.html');

  await expect.poll(()=>page.evaluate(()=>({
    state:typeof window.NetWizardState?.getSnapshot==='function',
    privateUi:typeof window.NetWizardPrivateDeploymentUi?.deviceConfig==='function',
    selfHosted:typeof window.NetWizardSelfHostedPrivate?.generateDeploymentPlan==='function',
    legacy:typeof window.NetWizardLegacyConfigGenerator,
    vendorGenerators:typeof window.NetWizardVendorConfigGenerators
  }))).toEqual({
    state:true,
    privateUi:true,
    selfHosted:true,
    legacy:'undefined',
    vendorGenerators:'undefined'
  });

  await page.evaluate(()=>{
    const p=window.NetWizardState.getSnapshot();
    Object.assign(p,{
      projName:'Production server-side generation',
      workflow:{mode:'design'},
      devices:[{id:'r1',name:'RTR-PROD',type:'router',kind:'router',vendorOs:'cisco_ios',internetEdge:'no'}],
      ports:[],vlans:[],subnets:[],hosts:[],links:[],fwRules:[],
      management:{},highAvailability:{},accessSecurity:{},linkAggregations:[]
    });
    window.NetWizardState.replaceProject(p,{source:'e2e-production-boundary'});
    window.navTo('cfg');
  });

  await expect(page.locator('[data-dcfg="r1"]')).toHaveClass(/on/);
  await expect(page.locator('#cfgOut')).toHaveValue(/Configuración privada pendiente para cisco_ios/);
  await expect(page.locator('#cfgOut')).not.toHaveValue(/configure terminal|hostname RTR-PROD/);
  await expect(page.locator('#cfgReadiness')).toContainText('PRIVATE ENGINE PENDIENTE');

  const token=process.env.NETWIZARD_TEST_SELF_HOSTED_TOKEN||'';
  expect(token.length).toBeGreaterThanOrEqual(32);
  await expect(page.locator('#nwPrivateDeploymentCard')).toBeVisible();
  await expect(page.locator('#cfgGenerateServer')).toHaveText(/Autorizar y generar/);
  await page.locator('#cfgGenerateServer').click();
  await expect(page.locator('#nwSelfHostedPrivateToken')).toBeFocused();
  await page.locator('#nwSelfHostedPrivateToken').fill(token);
  await page.locator('#nwSelfHostedPrivateLogin').click();

  await expect(page.locator('#nwPrivateDeploymentContext')).toContainText('Snapshot actual');
  await expect(page.locator('#cfgOut')).toHaveValue(/configure terminal/);
  await expect(page.locator('#cfgOut')).toHaveValue(/hostname RTR-PROD/);
  await expect(page.locator('#cfgReadiness')).toContainText('CLI PRIVADA');
  await expect.poll(
    ()=>page.evaluate(()=>window.NetWizardSelfHostedPrivate?.state?.().authenticated===true)
  ).toBe(true);

  const privateArtifact=await page.evaluate(()=>window.NetWizardPrivateDeploymentUi?.deviceConfig?.('r1')||null);
  expect(privateArtifact).toBeTruthy();
  expect(privateArtifact.content).toContain('hostname RTR-PROD');
  expect(privateArtifact.capability.mode).toBe('cli');

  const bundleDownloadPromise=page.waitForEvent('download');
  await page.locator('#expBundle').click();
  const bundleDownload=await bundleDownloadPromise;
  expect(bundleDownload.suggestedFilename()).toBe('configs_bundle.txt');
  const bundleStream=await bundleDownload.createReadStream();
  let bundleText='';
  for await (const chunk of bundleStream)bundleText+=chunk.toString('utf8');
  expect(bundleText).toContain('hostname RTR-PROD');
  expect(bundleText).toContain('cisco_ios');

  const deviceDownloadPromise=page.waitForEvent('download');
  await page.locator('#expAll').click();
  const deviceDownload=await deviceDownloadPromise;
  const deviceStream=await deviceDownload.createReadStream();
  let deviceText='';
  for await (const chunk of deviceStream)deviceText+=chunk.toString('utf8');
  expect(deviceText).toContain('configure terminal');
  expect(deviceText).toContain('hostname RTR-PROD');

  const exportState=await page.evaluate(()=>window.NetWizardPrivateDeploymentUi?.exportState?.());
  expect(exportState.available).toBe(true);
  expect(exportState.stale).toBe(false);
  expect(exportState.result?.contractVersion).toBe('netwizard-private-deployment-plan-v2');

  await page.evaluate(()=>{
    const p=window.NetWizardState.getSnapshot();
    p.devices[0].name='RTR-PROD-EDITED';
    window.NetWizardState.replaceProject(p,{source:'e2e-production-stale'});
  });
  await expect(page.locator('#cfgReadiness')).toContainText('CONFIG OBSOLETA');
  await expect(page.locator('#cfgOut')).toHaveValue(/STALE|OBSOLETA|obsoleto/i);
  expect(await page.evaluate(()=>window.NetWizardPrivateDeploymentUi?.deviceConfig?.('r1')||null)).toBeNull();
  expect(await page.evaluate(()=>window.NetWizardPrivateDeploymentUi?.exportState?.().available)).toBe(false);

  await page.locator('#cfgGenerateServer').click();
  await expect(page.locator('#cfgOut')).toHaveValue(/hostname RTR-PROD-EDITED/);
  await expect(page.locator('#cfgReadiness')).not.toContainText('CONFIG OBSOLETA');

  const scripts=await page.locator('script[src]').evaluateAll(nodes=>nodes.map(n=>n.getAttribute('src')||''));
  expect(scripts.some(src=>src.includes('netwizard-legacy-config-generator.js'))).toBe(false);
  expect(scripts.some(src=>src.includes('netwizard-vendor-config-generators.js'))).toBe(false);
  expect(errors).toEqual([]);
});
