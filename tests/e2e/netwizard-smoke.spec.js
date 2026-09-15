const { test, expect } = require('@playwright/test');

async function resetStorage(page){
  await page.goto('/index.html');
  await page.evaluate(() => {
    localStorage.clear();
    sessionStorage.clear();
  });
  await page.reload();
}

test('carga la aplicación sin errores JavaScript críticos', async ({ page }) => {
  const errors = [];
  page.on('pageerror', err => errors.push(err.message));
  await resetStorage(page);
  await expect(page.locator('body')).toContainText('NetWizard');
  await expect.poll(() => errors, { timeout: 1000 }).toEqual([]);
  await expect.poll(() => page.evaluate(() => window.NetWizardRuntime && window.NetWizardRuntime.status)).not.toBeNull();
  const apiStatus = await page.evaluate(() => ({
    state: !!window.NetWizardState,
    planner: !!window.NetWizardPlanner,
    schema: !!window.NetWizardProjectSchema,
    bridge: !!window.NetWizardBridge,
    runtime: window.NetWizardRuntime.verify()
  }));
  expect(apiStatus.state).toBe(true);
  expect(apiStatus.planner).toBe(true);
  expect(apiStatus.schema).toBe(true);
  expect(apiStatus.bridge).toBe(true);
  expect(apiStatus.runtime).toMatchObject({ ok:true, missing:[], duplicateScripts:[], missingPipelineStages:[], missingRegistryEntries:[], generatorReady:true, architectureReady:true });
  expect(apiStatus.runtime.configPipeline.renderers.map(item => item.id)).toEqual(['edge.firewall','device.switching','vendor.base']);
  expect(apiStatus.runtime.configPipeline.stages.map(item => item.id)).toEqual(['routing.cisco','routing.multivendor','security.access','management.baseline','ha.services']);
});

test('genera configuración útil para todos los vendors ofrecidos por la UI', async ({ page }) => {
  await resetStorage(page);
  const matrix = await page.evaluate(() => {
    const vendorKinds = {
      generic_network:'appliance',cisco_ios:'router',cisco_asa:'firewall',fortinet:'firewall',pfsense:'firewall',
      mikrotik_routeros:'router',huawei_vrp:'router',juniper_junos:'router',aruba_aoss:'switch',
      ubiquiti_unifi:'access_point',tplink_omada:'wlan_controller',galgus_cloud:'wlan_controller',windows:'server',linux:'server'
    };
    const vendors = window.ALL_VENDORS.map(vendor => [vendor.id,vendorKinds[vendor.id]||'appliance',vendor.l]);
    const project = window.defS();
    project.projName = 'E2E Vendor Matrix';
    project.vlans = [{id:'v10', vlanId:10, name:'Usuarios'}];
    project.subnets = [{id:'s10', vlanRef:'v10', cidr:'10.10.10.0/24', gateway:'10.10.10.1'}];
    project.devices = vendors.map(([vendorOs,type,label], index) => ({
      id:`dev-${index}`,
      name:`${label}-01`,
      type,
      vendorOs,
      internetEdge:type === 'router' || type === 'firewall' ? 'yes' : 'no',
      wanIf:type === 'router' || type === 'firewall' ? 'wan0' : null
    }));
    project.ports = project.devices.flatMap((device, index) => [
      {id:`p-${index}-lan`, deviceId:device.id, name:'lan0', mode:device.type === 'switch' ? 'trunk' : 'routed', allowedVlans:[10], role:'lan'},
      {id:`p-${index}-wan`, deviceId:device.id, name:'wan0', mode:'routed', role:'wan'}
    ]);
    project.roas = {gwId:null, lanIf:'lan0', natVRef:'v10', wanCidr:'198.51.100.2/30', wanNh:'198.51.100.1'};
    window.NetWizardState.replaceProject(project, {source:'e2e-vendor-matrix'});
    return vendors.map(([vendorOs,,label], index) => {
      const output = window.genConfig(`dev-${index}`, vendorOs);
      return {vendorOs,label,output};
    });
  });

  for(const row of matrix){
    expect(row.output, `${row.vendorOs} debe generar salida`).toBeTruthy();
    expect(row.output, `${row.vendorOs} no debe caer en el fallback roto`).not.toMatch(/Sin vendor asignado|todavía no implementado/i);
    expect(row.output, `${row.vendorOs} debe generar una salida sustancial`).toMatch(/\S[\s\S]{30}/);
  }

  const formVendorIds=await page.locator('#devVendor option').evaluateAll(options=>options.map(option=>option.value).filter(Boolean));
  expect(formVendorIds.slice().sort()).toEqual(matrix.map(row=>row.vendorOs).sort());

  await page.evaluate(() => { const d=window.NetWizardState.getSnapshot().devices.find(item=>item.vendorOs==='mikrotik_routeros'); window.navTo('cfg'); window.selectDevCfg(d.id); });
  await expect(page.locator('#cfgOut')).toHaveValue(/MikroTik|RouterOS|system identity/i);
});

test('el asistente separa infraestructura gestionada y endpoints sin switches ficticios', async ({ page }) => {
  await resetStorage(page);
  page.on('dialog', dialog => dialog.accept());
  await page.click('[data-step="wiz"]');
  await page.click('[data-sc="office"]');
  for(const id of ['server','ap','pc','iot','nvr']) await page.click(`[data-dp="${id}"]`);
  await page.click('#wNext2');
  await page.click('#wApply');

  const result=await page.evaluate(() => {
    const project=window.NetWizardState.getSnapshot();
    const ap=project.devices.find(device=>device.kind==='access_point');
    return {
      devices:project.devices.map(({name,kind,type,vendorOs})=>({name,kind,type,vendorOs})),
      hosts:project.hosts.map(({name,type,deviceRef})=>({name,type,deviceRef})),
      apPort:ap&&project.ports.find(port=>port.deviceId===ap.id),
      apConfig:ap&&window.genConfig(ap.id,ap.vendorOs)
    };
  });

  const ap=result.devices.find(device=>device.name==='AP-01');
  expect(ap).toMatchObject({kind:'access_point',type:'access_point',vendorOs:'generic_network'});
  expect(result.devices.some(device=>device.name==='SRV-Web')).toBe(false);
  expect(result.devices.every(device=>device.kind===device.type)).toBe(true);
  expect(result.apPort).toMatchObject({name:'eth0',mode:'trunk'});
  expect(result.apConfig).toMatch(/Configuración genérica|Vendor\/OS no implementado directamente/i);
  for(const name of ['SRV-Web','AP-01','PC-01','IOT-01','NVR-01']) expect(result.hosts.some(host=>host.name===name), `${name} debe existir`).toBe(true);
  const apHost=result.hosts.find(host=>host.name==='AP-01');
  expect(apHost.deviceRef).toBeTruthy();
});

test('previsualiza VLSM desde la UI sin modificar el proyecto', async ({ page }) => {
  await resetStorage(page);
  await page.evaluate(() => {
    const project = window.NetWizardState.getSnapshot();
    project.projName = 'E2E VLSM';
    project.vlans = [{ id:'v10', vlanId:10, name:'Usuarios', color:'#14b8a6' }];
    project.subnets = [];
    project.hosts = [
      { id:'h1', name:'PC-01', type:'pc', vlanRef:'v10', ipMode:'static', staticIp:'' },
      { id:'h2', name:'PC-02', type:'pc', vlanRef:'v10', ipMode:'dhcp', staticIp:'' }
    ];
    window.NetWizardState.replaceProject(project, {source:'e2e'});
    window.navTo && window.navTo('vlan');
  });
  await page.waitForSelector('#vlsmBase');
  await page.fill('#vlsmBase', '10.44.0.0/24');
  await page.fill('#vlsmMargin', '0');
  await page.click('#btnVlsmPreview');
  await expect(page.locator('#vlsmOut')).toContainText('10.44.0.0');
  const subnets = await page.evaluate(() => window.NetWizardState.getSnapshot().subnets.length);
  expect(subnets).toBe(0);
});

test('aplica VLSM, exporta payload versionado y reimporta datos equivalentes', async ({ page }) => {
  await resetStorage(page);
  await page.evaluate(() => {
    const project = window.NetWizardState.getSnapshot();
    project.projName = 'E2E Export Import';
    project.vlans = [{ id:'v10', vlanId:10, name:'Usuarios', color:'#14b8a6' }];
    project.subnets = [];
    project.hosts = [{ id:'h1', name:'PC-01', type:'pc', vlanRef:'v10', ipMode:'static', staticIp:'' }];
    window.NetWizardState.replaceProject(project, {source:'e2e'});
    const plan = window.NetWizardPlanner.buildVlsmPlan('10.50.0.0/24', [{vlanRef:'v10', vlanId:10, name:'Usuarios', hostsRequired:10}], {margin:0});
    const next = window.NetWizardPlanner.applyVlsmPlan(project, plan, {assignMode:'static_only'});
    window.NetWizardState.replaceProject(next, {source:'e2e'});
  });
  const payload = await page.evaluate(() => window.NetWizardProjectSchema.prepareExport(window.NetWizardState.getSnapshot()));
  expect(payload.format).toBe('netwizard-project');
  expect(payload.project.subnets[0].cidr).toBe('10.50.0.0/28');
  expect(payload.project.hosts[0].staticIp).toBe('10.50.0.2');

  await page.evaluate((payload) => {
    const prepared = window.NetWizardProjectSchema.prepareImport(payload, { defaults: window.defS });
    if(!prepared.ok) throw new Error(prepared.errors.join('\n'));
    window.NetWizardState.replaceProject(prepared.project, {source:'e2e-import'});
  }, payload);
  const restored = await page.evaluate(() => window.NetWizardState.getSnapshot());
  expect(restored.projName).toBe('E2E Export Import');
  expect(restored.subnets[0].cidr).toBe('10.50.0.0/28');
});

test('auditoría de preparación detecta condiciones que bloquean producción', async ({ page }) => {
  await resetStorage(page);
  const audit = await page.evaluate(() => window.NetWizardPlanner.readinessAudit({
    devices:[{id:'sw1', name:'SW1', type:'switch'}],
    ports:[],
    vlans:[{id:'v10', vlanId:10, name:'Usuarios'}, {id:'v20', vlanId:20, name:'Servidores'}],
    subnets:[],
    hosts:[{id:'h1', name:'PC-01', vlanRef:'v10', ipMode:'static', staticIp:''}],
    links:[],
    dhcp:{}
  }, {productionMode:true}));
  expect(audit.ok).toBe(false);
  expect(audit.errors.join('\n')).toContain('Producción');
});


test('flujo UI crea VLAN, dispositivo, puerto, host, snapshot y restaura', async ({ page }) => {
  await resetStorage(page);
  await page.click('[data-step="vlan"]');
  await page.fill('#vId', '10');
  await page.fill('#vName', 'Usuarios');
  await page.click('#btnAddVlan');
  await expect.poll(() => page.evaluate(() => window.NetWizardState.getSnapshot().vlans.length)).toBe(1);

  await page.click('[data-step="dev"]');
  await page.fill('#devName', 'SW-E2E-01');
  await page.selectOption('#devType', 'switch');
  await page.selectOption('#devVendor', 'cisco_ios');
  await page.click('#btnAddDev');
  await expect.poll(() => page.evaluate(() => window.NetWizardState.getSnapshot().devices.length)).toBe(1);
  const deviceId = await page.evaluate(() => window.NetWizardState.getSnapshot().devices[0].id);

  await page.click('[data-step="ports"]');
  await expect(page.locator(`#pDev option[value="${deviceId}"]`)).toHaveCount(1);
  await page.selectOption('#pDev', deviceId);
  await page.fill('#pName', 'GigabitEthernet0/1');
  await page.selectOption('#pMedia', 'GE');
  await page.selectOption('#pRole', 'access');
  await page.selectOption('#pVlan', { index: 1 });
  await page.click('#btnAddPort');
  await expect.poll(() => page.evaluate(() => window.NetWizardState.getSnapshot().ports.length)).toBe(1);

  await page.click('[data-step="hosts"]');
  await page.fill('#hName', 'PC-E2E-01');
  await page.selectOption('#hVlan', { index: 1 });
  await page.selectOption('#hConnDev', deviceId);
  await page.selectOption('#hPortMode', 'auto');
  await page.click('#btnAddHost');
  await expect.poll(() => page.evaluate(() => window.NetWizardState.getSnapshot().hosts.length)).toBe(1);

  const before = await page.evaluate(() => window.NetWizardState.getSnapshot());
  expect(before.vlans).toHaveLength(1);
  expect(before.devices).toHaveLength(1);
  expect(before.ports).toHaveLength(1);
  expect(before.hosts).toHaveLength(1);

  await page.click('[data-step="dash"]');
  await page.fill('#historyLabel', 'E2E estado base');
  await page.click('#btnHistoryCreate');
  const snapshots = await page.evaluate(() => window.NetWizardHistory.listSnapshots());
  expect(snapshots.length).toBeGreaterThanOrEqual(1);

  await page.evaluate(() => {
    const p = window.NetWizardState.getSnapshot();
    p.hosts = [];
    window.NetWizardState.replaceProject(p, {source:'e2e-delete-host'});
  });
  expect(await page.evaluate(() => window.NetWizardState.getSnapshot().hosts.length)).toBe(0);
  await page.evaluate((snapshotId) => {
    const res = window.NetWizardHistory.restoreSnapshot(snapshotId, {skipBackup:true});
    if(!res.ok) throw new Error(res.error || 'restore failed');
  }, snapshots[0].id);
  expect(await page.evaluate(() => window.NetWizardState.getSnapshot().hosts.length)).toBe(1);
});
