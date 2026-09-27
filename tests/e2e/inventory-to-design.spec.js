const { test, expect } = require('@playwright/test');

async function resetStorage(page){
  await page.goto('/index.html');
  await page.evaluate(()=>{localStorage.clear();sessionStorage.clear();});
  await page.reload();
}

test('Inventario crea Diseño To-Be con snapshot restaurable y decisiones de equipo', async ({page})=>{
  await resetStorage(page);
  page.on('dialog', dialog => dialog.accept());

  await page.evaluate(()=>{
    const p=window.NetWizardState.getSnapshot();
    Object.assign(p,{
      projName:'E2E As-Built',
      workflow:{mode:'inventory'},
      physicalLocations:[{id:'loc1',name:'CPD',type:'room'}],
      racks:[],rackItems:[],pdus:[],powerConnections:[],patchPanels:[],telecomOutlets:[],cableRuns:[],patchConnections:[],hostOutletConnections:[],
      devices:[{id:'sw1',name:'SW-01',type:'switch',kind:'switch',manufacturer:'ACME',model:'X48',modelSource:'manual'}],
      ports:[],links:[],hosts:[],vlans:[],subnets:[],fwRules:[],dhcp:{}
    });
    window.NetWizardState.replaceProject(p,{source:'e2e-inventory-to-design'});
    window.navTo('physical');
  });

  const create=page.locator('#inventoryToDesignMount button',{hasText:'Crear Diseño To-Be'});
  await expect(create).toBeVisible();
  await create.click();

  await expect.poll(()=>page.evaluate(()=>{
    const p=window.NetWizardState.getSnapshot();
    return{
      mode:p.workflow&&p.workflow.mode,
      snapshotId:p.workflow&&p.workflow.derivedFrom&&p.workflow.derivedFrom.snapshotId,
      disposition:p.devices[0]&&p.devices[0].designDisposition,
      originRef:p.devices[0]&&p.devices[0].originRef,
      history:window.NetWizardHistory.listSnapshots().length
    };
  })).toMatchObject({mode:'design',disposition:'keep',originRef:'sw1',history:1});

  const provenance=await page.evaluate(()=>window.NetWizardState.getSnapshot().workflow.derivedFrom);
  expect(provenance.type).toBe('inventory');
  expect(provenance.snapshotId).toMatch(/^snap_/);

  const disposition=page.locator('#inventoryDerivedDesignMount select[data-design-disposition="sw1"]');
  await expect(disposition).toBeVisible();
  await disposition.selectOption('retire');
  await expect.poll(()=>page.evaluate(()=>window.NetWizardState.getSnapshot().devices[0].designDisposition)).toBe('retire');

  const back=page.locator('#inventoryDerivedDesignMount button',{hasText:'Volver al As-Built'});
  await back.click();
  await expect.poll(()=>page.evaluate(()=>window.NetWizardState.getSnapshot().workflow.mode)).toBe('inventory');
  await expect.poll(()=>page.evaluate(()=>window.NetWizardHistory.listSnapshots().length)).toBeGreaterThanOrEqual(2);
});
