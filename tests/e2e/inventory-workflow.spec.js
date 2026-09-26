const { test, expect } = require('@playwright/test');

async function resetStorage(page){
  await page.goto('/index.html');
  await page.evaluate(()=>{ localStorage.clear(); sessionStorage.clear(); });
  await page.reload();
}

test('workflow inventory expone Golden Path físico y no exige diseño lógico', async ({page})=>{
  await resetStorage(page);
  await expect(page.locator('#nwWorkflowModeCard')).toBeVisible();

  await page.locator('#nwModeInventory').click();
  await expect(page.locator('.sb-it[data-step="physical"]')).toBeVisible();
  await expect(page.locator('.sb-it[data-step="wiz"]')).toBeHidden();
  await expect(page.locator('.sb-it[data-step="vlan"]')).toBeHidden();
  await expect(page.locator('.sb-it[data-step="fw"]')).toBeHidden();

  await page.evaluate(()=>{
    const p=window.NetWizardState.getSnapshot();
    Object.assign(p,{
      workflow:{mode:'inventory'},
      step:'physical',
      physicalLocations:[{id:'loc1',name:'Sala técnica',type:'room',inventoryRackMode:'none'}],
      racks:[],rackItems:[],pdus:[],powerConnections:[],
      devices:[{
        id:'sw1',name:'SW-01',type:'switch',kind:'switch',
        manufacturer:'ACME',model:'X24',serialNumber:'SER-E2E-01',
        locationId:'loc1',physicalLocation:'Sala técnica'
      }],
      ports:[{id:'p1',deviceId:'sw1',name:'Gi1/0/1',media:'copper',speedMaxMbps:1000,negotiatedSpeedMbps:1000}],
      links:[],hosts:[],vlans:[],subnets:[],fwRules:[],
      patchPanels:[],telecomOutlets:[],cableRuns:[],patchConnections:[],hostOutletConnections:[]
    });
    window.NetWizardState.replaceProject(p,{source:'e2e-inventory'});
  });

  await expect(page.locator('#pg-physical')).toHaveClass(/on/);
  await expect(page.locator('#inventoryWorkflowMount')).toContainText('Golden Path · Inventario As-Built');
  await expect(page.locator('#inventoryWorkflowMount')).toContainText('Inventory Gate');
  await expect(page.locator('#inventoryWorkflowMount')).toContainText('LISTO');
  await expect(page.locator('#inventoryWorkflowMount')).not.toContainText(/VLAN.*oblig/i);

  await expect.poll(()=>page.evaluate(()=>({
    rack:!!window.NetWizardRackUi,
    cabling:!!window.NetWizardStructuredCablingUi
  })),{timeout:10000}).toEqual({rack:true,cabling:true});
  await expect(page.locator('#rackPlannerMount')).toBeVisible();
  await expect(page.locator('#structuredCablingMount')).toBeVisible();

  await page.locator('#nwModeDesign').click();
  await expect(page.locator('.sb-it[data-step="physical"]')).toBeHidden();
  await expect(page.locator('.sb-it[data-step="wiz"]')).toBeVisible();
});

test('inventario con rack declarado exige documentar el rack y sus U', async ({page})=>{
  await resetStorage(page);
  await page.evaluate(()=>{
    const p=window.NetWizardState.getSnapshot();
    Object.assign(p,{
      workflow:{mode:'inventory'},step:'physical',
      physicalLocations:[{id:'loc1',name:'CPD',type:'room',inventoryRackMode:'rack'}],
      racks:[],rackItems:[],devices:[],ports:[],links:[],hosts:[],
      patchPanels:[],telecomOutlets:[],cableRuns:[],patchConnections:[],hostOutletConnections:[],pdus:[],powerConnections:[]
    });
    window.NetWizardState.replaceProject(p,{source:'e2e-inventory-rack-required'});
  });
  await expect(page.locator('#inventoryWorkflowMount')).toContainText('BLOQUEADO');
  await expect(page.locator('#inventoryWorkflowMount')).toContainText('todavía no está documentado');
});
