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

test('Validation y análisis cambian ES/EN en caliente sin perder estado observado', async ({page})=>{
  await resetStorage(page);

  await page.evaluate(()=>{
    const p=window.NetWizardState.getSnapshot();
    p.devices=[{id:'r1',name:'EDGE-1',kind:'router',type:'router',vendorOs:'cisco_ios'}];
    p.vlans=[{id:'v10',vlanId:10,name:'Users'},{id:'v20',vlanId:20,name:'Guests'}];
    p.subnets=[
      {id:'s10',vlanRef:'v10',cidr:'10.10.10.0/24',gateway:'10.10.10.1',gatewayDeviceRef:'r1'},
      {id:'s20',vlanRef:'v20',cidr:'10.10.20.0/24',gateway:'10.10.20.1',gatewayDeviceRef:'r1'}
    ];
    p.routing={strategy:'static',staticRoutesByDevice:{}};
    p.wanCircuits=[{id:'wan1',name:'ISP-A',deviceId:'r1',enabled:true,bandwidthUpMbps:100,bandwidthDownMbps:100,role:'primary'}];
    p.trafficProfiles=[{id:'tp1',name:'WAN load',circuitRef:'wan1',averageMbps:20,peakMbps:70,criticalMbps:10}];
    window.NetWizardState.replaceProject(p,{source:'i18n-validation-e2e'});
  });

  await page.locator('[data-step="validate"]').first().click();
  const root=page.locator('#pg-validate');
  await expect(root).toBeVisible();
  await expect(root).toContainText('Validation & analysis');
  await expect(root).toContainText('Observed state and incremental change');
  await expect(page.locator('#nwInterSiteReachabilityPanel')).toContainText('Inter-site reachability');
  await expect(page.locator('#nwTrafficCapacityPanel')).toContainText('Traffic profiles and capacity analysis');
  await expect(page.locator('#nwWanResiliencePanel')).toContainText('WAN resilience');
  await expect(page.locator('#nwWanResilienceStatus')).toHaveText('Analysis pending');

  await page.locator('#observedConfig').fill('hostname EDGE-1\ninterface GigabitEthernet0/0');
  await page.locator('#observedSource').fill('show running-config');
  const before=await page.locator('#observedConfig').inputValue();

  await page.evaluate(()=>window.NetWizardI18n.setLocale('es'));
  await expect(root).toContainText('Validación & análisis');
  await expect(root).toContainText('Estado observado y cambio incremental');
  await expect(page.locator('#nwInterSiteReachabilityPanel')).toContainText('Reachability inter-sede');
  await expect(page.locator('#nwTrafficCapacityPanel')).toContainText('Perfiles de tráfico y análisis de capacidad');
  await expect(page.locator('#nwWanResiliencePanel')).toContainText('Resiliencia WAN');
  await expect(page.locator('#nwWanResilienceStatus')).toHaveText('Pendiente de análisis');
  await expect(page.locator('#observedConfig')).toHaveValue(before);

  await page.evaluate(()=>window.NetWizardI18n.setLocale('en'));
  await expect(root).toContainText('Validation & analysis');
  await expect(page.locator('#nwWanResilienceStatus')).toHaveText('Analysis pending');
  await expect(page.locator('#observedConfig')).toHaveValue(before);
});

test('Audit summary respeta locale explícito sin cambiar el issue canónico', async ({page})=>{
  await resetStorage(page);
  const result=await page.evaluate(()=>{
    const issue={code:'NW-CAPACITY-001',severity:'error',blocking:true,message:'legacy',messageKey:'validation.issue.capacity.NW-CAPACITY-001',messageParams:{label:'WAN-A'}};
    return {
      en:window.NetWizardAudit.summarizeIssues([issue],{locale:'en'}),
      es:window.NetWizardAudit.summarizeIssues([issue],{locale:'es'}),
      message:issue.message,
      key:issue.messageKey
    };
  });
  expect(result.en).toContain('WAN-A: invalid peak traffic');
  expect(result.es).toContain('WAN-A: pico de tráfico inválido');
  expect(result.message).toBe('legacy');
  expect(result.key).toBe('validation.issue.capacity.NW-CAPACITY-001');
});
