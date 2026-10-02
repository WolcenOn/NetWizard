const { test, expect } = require('@playwright/test');

async function resetStorage(page){
  await page.goto('/index.html');
  await page.evaluate(()=>{localStorage.clear();sessionStorage.clear();});
  await page.reload();
}

test('Golden Path seguro multisede carga limpio y demuestra conectividad segmentada', async ({page})=>{
  const errors=[];page.on('pageerror',err=>errors.push(err.message));
  page.on('dialog',dialog=>dialog.accept());
  await resetStorage(page);

  await page.evaluate(()=>window.navTo('cfg'));
  await expect(page.locator('#pg-cfg')).toBeVisible();
  await expect(page.locator('#btnGoldenPathEnterprise')).toBeVisible();
  await page.locator('#btnGoldenPathEnterprise').click();

  await expect.poll(()=>page.evaluate(()=>window.NetWizardState.getSnapshot().projName)).toBe('Golden Path Secure Multisite · 4 sedes');

  const state=await page.evaluate(()=>{
    const p=window.NetWizardState.getSnapshot();
    const reach=(src,dst,svc)=>window.NetWizardInterSiteReachability.analyze(p,src,dst,svc);
    return{
      devices:p.devices.length,
      routers:p.devices.filter(d=>d.kind==='router').length,
      switches:p.devices.filter(d=>d.kind==='switch').length,
      ports:p.ports.length,vlans:p.vlans.length,hosts:p.hosts.length,links:p.links.length,
      architecture:window.NetWizardArchitectureValidator.validate(p),
      ospf:window.NetWizardOspf.validateProject(p),
      wifi:window.NetWizardWifiPlanning.validateProject(p),
      services:window.NetWizardInternalServices.validateProject(p),
      capacity:window.NetWizardTrafficCapacity.validateProject(p),
      budget:window.NetWizardBudget.build(p),
      allowedHttps:reach('north_sn_users','hq_sn_servers','https'),
      allowedDns:reach('east_sn_wifi','hq_sn_servers','dns'),
      allowedRtsp:reach('south_sn_cameras','hq_sn_servers','rtsp'),
      allowedMgmt:reach('north_sn_mgmt','south_sn_mgmt','icmp'),
      blockedGuest:reach('south_sn_guest','hq_sn_servers','https'),
      blockedLateral:reach('north_sn_users','east_sn_users','https')
    };
  });

  expect(state.devices).toBe(12);
  expect(state.routers).toBe(6);
  expect(state.switches).toBe(4);
  expect(state.ports).toBe(85);
  expect(state.vlans).toBe(28);
  expect(state.hosts).toBe(25);
  expect(state.links).toBe(13);
  expect(state.architecture.ok).toBe(true);
  expect(state.architecture.issues).toHaveLength(0);
  expect(state.ospf.ok).toBe(true);
  expect(state.ospf.issues).toHaveLength(0);
  expect(state.wifi.ok).toBe(true);
  expect(state.wifi.issues).toHaveLength(0);
  expect(state.services.ok).toBe(true);
  expect(state.services.issues).toHaveLength(0);
  expect(state.capacity.ok).toBe(true);
  expect(state.capacity.issues).toHaveLength(0);
  expect(state.budget.counts.unpriced).toBe(0);
  expect(state.budget.totals.year1Price).toBeGreaterThan(state.budget.totals.year1Cost);

  for(const result of [state.allowedHttps,state.allowedDns,state.allowedRtsp,state.allowedMgmt]){
    expect(result.reachable).toBe(true);
    expect(result.forward.strategy).toBe('ospf');
    expect(result.forward.confidence).toBe('observed');
    expect(result.policy.explicit).toBe(true);
  }
  for(const result of [state.blockedGuest,state.blockedLateral]){
    expect(result.reachable).toBe(false);
    expect(result.policy.allowed).toBe(false);
    expect(result.policy.explicit).toBe(true);
  }

  await page.evaluate(()=>window.navTo('physical'));
  await expect(page.locator('#budgetMount')).toBeVisible();
  await expect(page.locator('#budgetMount')).toContainText('BOM & Presupuesto');
  await expect(page.locator('#budgetMount')).toContainText('Toda la BOM incluida tiene precio.');

  await page.evaluate(()=>window.navTo('validate'));
  await expect(page.locator('#nwInterSiteReachabilityPanel')).toBeVisible();

  await page.evaluate(()=>window.navTo('cfg'));
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
    href:'./samples/golden-path-secure-multisite.json',
    download:'netwizard-golden-path-secure-multisite.json'
  });

  expect(errors).toEqual([]);
});
