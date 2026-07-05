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
  const apiStatus = await page.evaluate(() => ({
    state: !!window.NetWizardState,
    planner: !!window.NetWizardPlanner,
    schema: !!window.NetWizardProjectSchema,
    bridge: !!window.NetWizardBridge
  }));
  expect(apiStatus).toEqual({ state:true, planner:true, schema:true, bridge:true });
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
  const payload = await page.evaluate(() => window.NetWizardProjectSchema.exportProject(window.NetWizardState.getSnapshot()));
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

  await page.click('[data-step="dev"]');
  await page.fill('#devName', 'SW-E2E-01');
  await page.selectOption('#devType', 'switch');
  await page.click('#btnAddDev');

  await page.click('[data-step="ports"]');
  await page.selectOption('#pDev', { index: 1 });
  await page.fill('#pName', 'GigabitEthernet0/1');
  await page.selectOption('#pMedia', 'GE');
  await page.selectOption('#pRole', 'access');
  await page.selectOption('#pVlan', { index: 1 });
  await page.click('#btnAddPort');

  await page.click('[data-step="hosts"]');
  await page.fill('#hName', 'PC-E2E-01');
  await page.selectOption('#hVlan', { index: 1 });
  await page.selectOption('#hConnDev', { index: 1 });
  await page.selectOption('#hPortMode', 'auto');
  await page.click('#btnAddHost');

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
