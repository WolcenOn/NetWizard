const { test, expect } = require('@playwright/test');

async function resetStorage(page){
  await page.goto('/index.html');
  await page.evaluate(()=>{ localStorage.clear(); sessionStorage.clear(); });
  await page.reload();
}

test('configurador de informe selecciona secciones y genera hojas de etiquetas', async ({page})=>{
  await resetStorage(page);
  await page.evaluate(()=>{
    const p=window.NetWizardState.getSnapshot();
    Object.assign(p,{
      _schemaVersion:'3.50.0',
      projName:'Proyecto instalación E2E',
      physicalLocations:[{id:'loc1',name:'CPD'}],
      racks:[{id:'rack1',name:'RACK-01',locationId:'loc1',rackUnits:42}],
      rackItems:[
        {id:'ri1',rackId:'rack1',type:'device',deviceId:'sw1',startUnit:20,heightUnits:1,label:'SW-01',face:'front'},
        {id:'ri2',rackId:'rack1',type:'device',deviceId:'srv1',startUnit:16,heightUnits:2,label:'SRV-01',face:'front'}
      ],
      devices:[
        {id:'sw1',name:'SW-01',type:'switch',rackId:'rack1',rackUnit:20},
        {id:'srv1',name:'SRV-01',type:'server',rackId:'rack1',rackUnit:16}
      ],
      ports:[
        {id:'p1',deviceId:'sw1',name:'Te1/1',mode:'trunk',media:'fiber'},
        {id:'p2',deviceId:'srv1',name:'Eth0',mode:'access',media:'fiber'}
      ],
      links:[{id:'l1',name:'UPLINK-01',cableId:'CAB-E2E-01',fromPortId:'p1',toPortId:'p2',medium:'OM4 multimode'}],
      hosts:[],vlans:[],wanCircuits:[],patchPanels:[],telecomOutlets:[],cableRuns:[],patchConnections:[],hostOutletConnections:[],pdus:[],powerConnections:[]
    });
    window.NetWizardState.replaceProject(p,{source:'e2e-install-report-options'});
  });

  await expect.poll(()=>page.evaluate(()=>window.NetWizardInstallationReport?.version||null),{timeout:10000}).toBe('netwizard-installation-report-v7');
  await expect(page.locator('#btnCompactReport')).toBeVisible();
  await page.locator('#btnCompactReport').click();
  const cfg=page.locator('#nwInstallReportConfigurator');
  await expect(cfg).toBeVisible();
  await expect(cfg.locator('input[data-report-section="connection-diagram"]')).toBeChecked();
  await expect(cfg.locator('input[data-report-section="labels"]')).not.toBeChecked();

  await cfg.getByRole('button',{name:'Solo conexiones'}).click();
  await expect(cfg.locator('input[data-report-section="connection-diagram"]')).toBeChecked();
  await expect(cfg.locator('input[data-report-section="readiness"]')).not.toBeChecked();

  const popupPromise=page.waitForEvent('popup');
  await cfg.getByRole('button',{name:'🧰 Generar informe'}).click();
  const report=await popupPromise;
  await report.waitForLoadState('domcontentloaded');
  await expect(report.getByText(/Esquema general de conexión de equipos/)).toBeVisible();
  await expect(report.locator('.connection-diagram-card')).toBeVisible();
  await expect(report.getByText('SW-01',{exact:true}).first()).toBeVisible();
  await expect(report.getByText('SRV-01',{exact:true}).first()).toBeVisible();
  await expect(report.getByText(/Estado de preparación para instalación/)).toHaveCount(0);
  await report.close();

  await page.locator('#btnCompactReport').click();
  const cfg2=page.locator('#nwInstallReportConfigurator');
  await expect(cfg2).toBeVisible();
  await cfg2.locator('select').selectOption('cable-3x12');
  const labelsPromise=page.waitForEvent('popup');
  await cfg2.getByRole('button',{name:'🏷 Abrir solo etiquetas'}).click();
  const labels=await labelsPromise;
  await labels.waitForLoadState('domcontentloaded');
  await expect(labels.getByText(/Hojas de etiquetas imprimibles/)).toBeVisible();
  await expect(labels.locator('.install-label')).toHaveCount(5);
  await expect(labels.getByText('CAB-E2E-01',{exact:true})).toHaveCount(2);
  await expect(labels.getByText('Extremo A',{exact:true})).toBeVisible();
  await expect(labels.getByText('Extremo B',{exact:true})).toBeVisible();
  const css=await labels.locator('style').textContent();
  expect(css).toContain('@page labels{size:A4 portrait');
  expect(await labels.locator('.label-sheet-page').first().getAttribute('style')).toContain('--label-cols:3');
});