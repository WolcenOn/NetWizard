const { test, expect } = require('@playwright/test');

async function resetStorage(page){
  await page.goto('/index.html');
  await page.evaluate(()=>{localStorage.clear();sessionStorage.clear();});
  await page.reload();
}

test('Oficina pequeña ofrece Nuevo o Golden Path y el ejemplo queda READY', async ({page})=>{
  await resetStorage(page);
  page.on('dialog',dialog=>dialog.accept());

  await page.click('[data-step="wiz"]');
  await expect(page.locator('[data-sc="production-office"]')).toHaveCount(0);
  await page.click('[data-sc="office"]');

  await expect(page.locator('#wModeCard')).toBeVisible();
  await expect(page.locator('#wNewScenario')).toBeVisible();
  await expect(page.locator('#wLoadExample')).toBeVisible();
  await expect(page.locator('#wLoadExample')).toContainText('Golden Path · Oficina pequeña segura');
  await expect(page.locator('#wStep2Card')).toBeHidden();

  await page.click('#wLoadExample');
  await expect(page.locator('#pg-dash')).toBeVisible();

  const result=await page.evaluate(()=>{
    const p=window.NetWizardState.getSnapshot();
    const gate=window.NetWizardProductionGate.runProductionGate(p,{productionMode:true,strict:true});
    return{
      name:p.projName,
      devices:p.devices.length,
      vlans:p.vlans.length,
      links:p.links.length,
      status:gate.status,
      warnings:gate.counts.warnings,
      blocking:gate.counts.blocking,
      wan:p.wanCircuits.length,
      wifi:p.wifiSsids.map(x=>({id:x.id,security:x.security,clientIsolation:x.clientIsolation})),
      ipv6:p.ipv6Networks.length
    };
  });

  expect(result.name).toBe('Golden Path · Oficina pequeña segura');
  expect(result.devices).toBe(3);
  expect(result.vlans).toBe(8);
  expect(result.links).toBe(3);
  expect(result.status).toBe('ready');
  expect(result.warnings).toBe(0);
  expect(result.blocking).toBe(0);
  expect(result.wan).toBe(2);
  expect(result.ipv6).toBe(3);
  expect(result.wifi).toEqual(expect.arrayContaining([
    expect.objectContaining({id:'ssid_office_corp',security:'wpa3-enterprise'}),
    expect.objectContaining({id:'ssid_office_guest',security:'wpa3-personal',clientIsolation:true})
  ]));
});

test('Oficina pequeña mantiene el flujo Nuevo del asistente', async ({page})=>{
  await resetStorage(page);

  await page.click('[data-step="wiz"]');
  await page.click('[data-sc="office"]');
  await page.click('#wNewScenario');

  await expect(page.locator('#wModeCard')).toBeHidden();
  await expect(page.locator('#wStep2Card')).toBeVisible();
  await expect(page.locator('[data-dp="fw"]')).toBeVisible();
  await expect(page.locator('[data-dp="pc"]')).toBeVisible();

  await page.click('#wBack1');
  await expect(page.locator('#wModeCard')).toBeVisible();
  await expect(page.locator('#wStep2Card')).toBeHidden();
});

test('Home Lab carga una Golden moderna, segmentada y READY', async ({page})=>{
  await resetStorage(page);
  page.on('dialog',dialog=>dialog.accept());

  await page.click('[data-step="wiz"]');
  await page.click('[data-sc="home"]');

  await expect(page.locator('#wModeCard')).toBeVisible();
  await expect(page.locator('#wLoadExample')).toBeVisible();
  await expect(page.locator('#wLoadExample')).toContainText('Golden Path · Home Lab moderno y segmentado');

  await page.click('#wLoadExample');
  await expect(page.locator('#pg-dash')).toBeVisible();

  const result=await page.evaluate(()=>{
    const p=window.NetWizardState.getSnapshot();
    const gate=window.NetWizardProductionGate.runProductionGate(p,{productionMode:true,strict:true});
    return{
      name:p.projName,
      devices:p.devices.length,
      vlans:p.vlans.length,
      hosts:p.hosts.length,
      wan:p.wanCircuits.length,
      wifi:p.wifiSsids.map(x=>({id:x.id,security:x.security,clientIsolation:x.clientIsolation})),
      ipv6:p.ipv6Networks.length,
      cableRuns:p.cableRuns.length,
      status:gate.status,
      warnings:gate.counts.warnings,
      blocking:gate.counts.blocking
    };
  });

  expect(result.name).toBe('Golden Path · Home Lab moderno y segmentado');
  expect(result.devices).toBe(3);
  expect(result.vlans).toBe(8);
  expect(result.hosts).toBe(7);
  expect(result.wan).toBe(2);
  expect(result.ipv6).toBe(7);
  expect(result.cableRuns).toBe(9);
  expect(result.status).toBe('ready');
  expect(result.warnings).toBe(0);
  expect(result.blocking).toBe(0);
  expect(result.wifi).toEqual(expect.arrayContaining([
    expect.objectContaining({id:'ssid_lab_trusted',security:'wpa3-personal'}),
    expect.objectContaining({id:'ssid_lab_iot',security:'wpa3-personal',clientIsolation:true}),
    expect.objectContaining({id:'ssid_lab_guest',security:'wpa3-personal',clientIsolation:true})
  ]));
});


test('Retail / Comercio carga una Golden segmentada y READY', async ({page})=>{
  await resetStorage(page);
  page.on('dialog',dialog=>dialog.accept());

  await page.click('[data-step="wiz"]');
  await page.click('[data-sc="retail"]');

  await expect(page.locator('#wModeCard')).toBeVisible();
  await expect(page.locator('#wLoadExample')).toBeVisible();
  await expect(page.locator('#wLoadExample')).toContainText('Golden Path · Retail / Comercio segmentado');

  await page.click('#wLoadExample');
  await expect(page.locator('#pg-dash')).toBeVisible();

  const result=await page.evaluate(()=>{
    const p=window.NetWizardState.getSnapshot();
    const gate=window.NetWizardProductionGate.runProductionGate(p,{productionMode:true,strict:true});
    return{
      name:p.projName,
      devices:p.devices.length,
      vlans:p.vlans.map(v=>({id:v.id,name:v.name})),
      hosts:p.hosts.length,
      wan:p.wanCircuits.length,
      wifi:p.wifiSsids.map(x=>({id:x.id,security:x.security,clientIsolation:x.clientIsolation})),
      ipv6:p.ipv6Networks.length,
      cableRuns:p.cableRuns.length,
      status:gate.status,
      warnings:gate.counts.warnings,
      blocking:gate.counts.blocking
    };
  });

  expect(result.name).toBe('Golden Path · Retail / Comercio segmentado');
  expect(result.devices).toBe(3);
  expect(result.hosts).toBe(7);
  expect(result.wan).toBe(2);
  expect(result.ipv6).toBe(7);
  expect(result.cableRuns).toBe(9);
  expect(result.status).toBe('ready');
  expect(result.warnings).toBe(0);
  expect(result.blocking).toBe(0);
  expect(result.vlans).toEqual(expect.arrayContaining([
    expect.objectContaining({id:'retail_v110',name:'RETAIL-POS'}),
    expect.objectContaining({id:'retail_v140',name:'RETAIL-Camaras-NVR'}),
    expect.objectContaining({id:'retail_v170',name:'RETAIL-IoT'})
  ]));
  expect(result.wifi).toEqual(expect.arrayContaining([
    expect.objectContaining({id:'ssid_retail_staff',security:'wpa3-enterprise'}),
    expect.objectContaining({id:'ssid_retail_iot',security:'wpa3-personal',clientIsolation:true}),
    expect.objectContaining({id:'ssid_retail_guest',security:'wpa3-personal',clientIsolation:true})
  ]));
});
