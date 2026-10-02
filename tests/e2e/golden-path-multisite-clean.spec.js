const { test, expect } = require('@playwright/test');

async function resetStorage(page){
  await page.goto('/index.html');
  await page.evaluate(()=>{localStorage.clear();sessionStorage.clear();});
  await page.reload();
}

test('Golden Multisede limpio carga READY y mantiene segmentación segura', async ({page})=>{
  const errors=[];page.on('pageerror',err=>errors.push(err.message));
  page.on('dialog',dialog=>dialog.accept());
  await resetStorage(page);

  await page.evaluate(()=>window.navTo('cfg'));
  await expect(page.locator('#pg-cfg')).toBeVisible();
  await expect(page.locator('#btnGoldenPathClean')).toBeVisible();
  await page.locator('#btnGoldenPathClean').click();

  await page.waitForFunction(
    ()=>Boolean(window.NetWizardGoldenPathClean&&window.NetWizardGoldenPathClean.lastLoadPromise),
    null,{timeout:5000}
  );
  await page.evaluate(()=>window.NetWizardGoldenPathClean.lastLoadPromise);
  expect(await page.evaluate(()=>window.NetWizardState.getSnapshot().projName))
    .toBe('Golden Path Multisede Seguro · 4 sedes');

  const result=await page.evaluate(()=>{
    const p=window.NetWizardState.getSnapshot();
    const gate=window.NetWizardProductionGate.runProductionGate(p,{productionMode:true,strict:true});
    const ospf=window.NetWizardOspf.validateProject(p);
    const reach=window.NetWizardInterSiteReachability.analyze(p,'hq_sn_users','east_sn_users','icmp');
    const allowed=window.NetWizardConnectivityModel.simulate(p,'host:hq_user','host:south_server','https');
    const blockedGuest=window.NetWizardConnectivityModel.simulate(p,'host:hq_guest','host:east_admin','https');
    return{
      counts:{devices:p.devices.length,routers:p.devices.filter(x=>x.type==='router').length,vlans:p.vlans.length,hosts:p.hosts.length},
      gate:{status:gate.status,ready:gate.ready,warnings:gate.counts.warnings,errors:gate.counts.errors,blocking:gate.counts.blocking},
      ospf:{ok:ospf.ok,neighbors:ospf.neighbors.length,warnings:ospf.counts.warnings},
      reach:{reachable:reach.reachable,confidence:reach.forward&&reach.forward.confidence},
      allowed:{ok:allowed.ok,partial:allowed.partial},
      blockedGuest:{ok:blockedGuest.ok,kind:blockedGuest.blockage&&blockedGuest.blockage.kind}
    };
  });

  expect(result.counts).toEqual({devices:12,routers:4,vlans:32,hosts:24});
  expect(result.gate).toEqual({status:'ready',ready:true,warnings:0,errors:0,blocking:0});
  expect(result.ospf).toEqual({ok:true,neighbors:8,warnings:0});
  expect(result.reach).toEqual({reachable:true,confidence:'observed'});
  expect(result.allowed).toEqual({ok:true,partial:false});
  expect(result.blockedGuest).toEqual({ok:false,kind:'policy'});

  await expect.poll(()=>page.evaluate(()=>window.NetWizardLastProductionGateReport&&window.NetWizardLastProductionGateReport.status))
    .toBe('ready');
  await expect(page.locator('#productionGateOut')).toContainText('LISTO');
  await expect(page.locator('#productionGateOut')).not.toContainText('BLOQUEADO');
  await expect(page.locator('#productionGateOut')).not.toContainText('REQUIERE REVISIÓN');

  const downloadTarget=await page.evaluate(async()=>{
    const original=HTMLAnchorElement.prototype.click;
    let captured=null;
    HTMLAnchorElement.prototype.click=function(){
      captured={href:this.getAttribute('href'),download:this.getAttribute('download')};
    };
    try{
      await window.NetWizardGoldenPathClean.download();
      return captured;
    }finally{
      HTMLAnchorElement.prototype.click=original;
    }
  });
  expect(downloadTarget).toEqual({
    href:'./samples/golden-path-multisite-clean.json',
    download:'netwizard-golden-path-multisite-clean.json'
  });

  expect(errors).toEqual([]);
});
