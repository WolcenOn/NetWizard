const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');

async function resetStorage(page){
  await page.goto('/index.html');
  await page.evaluate(() => { localStorage.clear(); sessionStorage.clear(); });
  await page.reload();
  await expect(page.locator('body')).toContainText('NetWizard');
}

async function setProject(page, project){
  await page.evaluate((payload) => {
    const prepared = window.NetWizardProjectSchema.prepareImport(payload, { defaults: window.defS });
    if(!prepared.ok) throw new Error(prepared.errors.join('\n'));
    window.NetWizardState.replaceProject(prepared.project, { source:'e2e-set-project' });
  }, { format:'netwizard-project', schemaVersion:'3.50.0', project });
}

function samplePayload(name){
  return JSON.parse(fs.readFileSync(path.join(__dirname, '..', '..', 'samples', name), 'utf8'));
}

const productionScenarios = samplePayload('production-scenarios.json').scenarios;

test('escenarios 3.50 cumplen puerta de producción, configuración y documentación en navegador', async ({ page }) => {
  await resetStorage(page);
  for(const scenario of productionScenarios){
    await test.step(scenario.id, async () => {
      const payload = samplePayload(scenario.file);
      await page.evaluate((payload) => {
        const prepared = window.NetWizardProjectSchema.prepareImport(payload, { defaults: window.defS });
        if(!prepared.ok) throw new Error(prepared.errors.join('\n'));
        window.NetWizardState.replaceProject(prepared.project, { source:'e2e-sample' });
        window.navTo && window.navTo('dash');
      }, payload);
      await expect(page.locator('#productionGateCard')).toBeVisible();
      await page.click('#btnProductionGate');
      await expect(page.locator('#productionGateOut')).toContainText(/Puerta de producción|Production gate|Estado:|Status:/i);

      const result = await page.evaluate((scenario) => {
        const project = window.NetWizardState.getSnapshot();
        const exported = window.NetWizardProjectSchema.prepareExport(project);
        const report = window.NetWizardProductionGate.runProductionGate(project, { productionMode:true, strict:true });
        const release = window.NetWizardProductionGate.evaluateReleaseCriteria(report, {
          allowReview:scenario.expectedStatus === 'review',
          allowedWarningCodes:scenario.allowedWarningCodes,
          maxWarnings:scenario.allowedWarningCodes.length
        });
        const rows = window.NetWizardDocumentationUtils.buildInventoryRows(project);
        const matrix = window.NetWizardDocumentationUtils.buildConnectivityMatrix(project);
        const md = window.NetWizardDocumentationUtils.buildMarkdownDocument(project);
        return {
          schemaVersion: exported.schemaVersion,
          devices: project.devices.length,
          vlans: project.vlans.length,
          gateStatus: report.status,
          canExport: report.canExport,
          releasePassed: release.passed,
          warningCodes: report.issues.filter(issue => issue.severity === 'warning').map(issue => issue.code).sort(),
          configs: scenario.configs.map(expected => ({
            deviceId:expected.deviceId,
            output:window.genConfig(expected.deviceId, expected.vendor)
          })),
          rows: rows.length,
          matrix: matrix.length,
          markdownHasTitle: md.includes('# NetWizard') || md.includes('# Documentación')
        };
      }, scenario);
      expect(result.schemaVersion).toBe('3.50.0');
      expect(result.devices).toBeGreaterThan(0);
      expect(result.vlans).toBeGreaterThan(0);
      expect(result.gateStatus).toBe(scenario.expectedStatus);
      expect(result.canExport).toBeTruthy();
      expect(result.releasePassed).toBeTruthy();
      expect(result.warningCodes).toEqual(scenario.allowedWarningCodes.slice().sort());
      expect(result.rows).toBeGreaterThan(0);
      expect(result.markdownHasTitle).toBeTruthy();
      for(const expected of scenario.configs){
        const generated=result.configs.find(item => item.deviceId === expected.deviceId);
        expect(generated, `${scenario.id}/${expected.deviceId}: salida ausente`).toBeTruthy();
        expect(generated.output.length, `${scenario.id}/${expected.deviceId}: salida demasiado corta`).toBeGreaterThan(80);
        expect(generated.output).not.toMatch(/Sin vendor asignado|todavía no implementado/i);
        for(const signature of expected.signatures) expect(generated.output).toContain(signature);
      }
    });
  }
});

test('plan común aplica VLSM y DHCP desde la UI con confirmación y snapshot previo', async ({ page }) => {
  await resetStorage(page);
  await setProject(page, {
    projName:'E2E Plan Común',
    devices:[], ports:[], links:[], fwRules:[], vlanMatrix:{}, dhcp:{},
    vlans:[{ id:'v10', vlanId:10, name:'Usuarios', intent:{type:'users', expectedHosts:20, growth:5, dhcp:true, internet:true} }],
    subnets:[],
    hosts:[{ id:'h1', name:'PC-01', type:'pc', vlanRef:'v10', ipMode:'static', staticIp:'' }],
    iot:{accessNodes:[],devices:[],map:{show:{}}}
  });
  await page.evaluate(() => window.navTo && window.navTo('dash'));
  await expect(page.locator('#changePlanCard')).toBeVisible();
  await page.fill('#planBaseCidr', '10.77.0.0/24');
  await page.fill('#planMargin', '0');
  await page.uncheck('#planUseTransit');
  await page.uncheck('#planUsePolicies');
  await page.click('#btnPlanPreview2');
  await expect(page.locator('#changePlanOut')).toContainText('VLSM');
  await expect(page.locator('#changePlanOut')).toContainText('DHCP');

  page.on('dialog', dialog => dialog.accept());
  await page.click('#btnPlanApply');
  await expect(page.locator('#changePlanOut')).toContainText('Plan aplicado');

  const state = await page.evaluate(() => {
    const p = window.NetWizardState.getSnapshot();
    return {
      subnets: p.subnets,
      hostIp: p.hosts[0] && p.hosts[0].staticIp,
      dhcp10: p.dhcp && p.dhcp['10'],
      snapshots: window.NetWizardHistory.listSnapshots().map(s => s.label)
    };
  });
  expect(state.subnets).toHaveLength(1);
  expect(state.subnets[0].cidr).toBe('10.77.0.0/27');
  expect(state.hostIp).toBe('10.77.0.2');
  expect(state.dhcp10.enabled).toBe(true);
  expect(state.snapshots).toContain('Antes de aplicar plan común');
});

test('documentación y matriz funcionan desde la UI y producen descargas', async ({ page }) => {
  await resetStorage(page);
  const payload = samplePayload('small-office.json');
  await page.evaluate((payload) => {
    const prepared = window.NetWizardProjectSchema.prepareImport(payload, { defaults: window.defS });
    if(!prepared.ok) throw new Error(prepared.errors.join('\n'));
    window.NetWizardState.replaceProject(prepared.project, { source:'e2e-docs' });
    window.navTo && window.navTo('dash');
  }, payload);
  await expect(page.locator('#nwDocCard')).toBeVisible();
  await page.click('#btnDocMatrix');
  await expect(page.locator('#nwDocOut')).toContainText(/Matriz de conectividad|VLAN connectivity matrix/i);

  const mdDownload = page.waitForEvent('download');
  await page.click('#btnDocMd');
  const dl = await mdDownload;
  expect(dl.suggestedFilename()).toMatch(/documentacion\.md$/);

  const csvDownload = page.waitForEvent('download');
  await page.click('#btnDocCsv');
  const csv = await csvDownload;
  expect(csv.suggestedFilename()).toMatch(/inventario\.csv$/);
});

test('puerta de producción bloquea un diseño incompleto antes de exportar', async ({ page }) => {
  await resetStorage(page);
  await setProject(page, {
    projName:'E2E Bloqueo Producción',
    devices:[{id:'sw1', name:'SW1', type:'switch'}],
    ports:[{id:'p1', deviceId:'sw1', name:'Gi0/1', mode:'access', accessVlanRef:'v10'}],
    links:[], fwRules:[], vlanMatrix:{}, dhcp:{},
    vlans:[{id:'v10', vlanId:10, name:'Usuarios', intent:{type:'users', expectedHosts:20, dhcp:true, internet:true}}],
    subnets:[{id:'s10', vlanRef:'v10', cidr:'10.10.10.0/24', gateway:''}],
    hosts:[{id:'h1', name:'PC-01', type:'pc', vlanRef:'v10', portId:'p1', ipMode:'static', staticIp:''}],
    iot:{accessNodes:[],devices:[],map:{show:{}}}
  });
  await page.evaluate(() => { window.NetWizardAudit.setMode('production'); window.navTo && window.navTo('dash'); });
  await expect(page.locator('#productionGateCard')).toBeVisible();
  await page.click('#btnProductionGate');
  await expect(page.locator('#productionGateOut')).toContainText(/BLOQUEADO|blocked|bloqueantes/i);

  const gate = await page.evaluate(() => window.NetWizardProductionGate.runProductionGate(window.NetWizardState.getSnapshot(), { productionMode:true, strict:true }));
  expect(gate.status).toBe('blocked');
  expect(gate.counts.blocking).toBeGreaterThan(0);
});
