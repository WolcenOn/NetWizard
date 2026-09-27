const { test, expect } = require('@playwright/test');

async function resetStorage(page){
  await page.goto('/index.html');
  await page.evaluate(()=>{localStorage.clear();sessionStorage.clear();});
  await page.reload();
}

test('cierre de intervención convierte To-Be en As-Built trazable y guarda snapshot', async ({page})=>{
  await resetStorage(page);
  page.on('dialog', dialog => dialog.accept());

  await page.evaluate(()=>{
    const p=window.NetWizardState.getSnapshot();
    Object.assign(p,{
      projName:'E2E cierre intervención',
      workflow:{mode:'inventory'},
      physicalLocations:[{id:'loc1',name:'CPD',type:'room'}],
      racks:[{id:'rack1',name:'RACK-01',locationId:'loc1',rackUnits:24}],
      rackItems:[{id:'ri1',rackId:'rack1',type:'device',deviceId:'sw1',label:'SW-01',startUnit:18,heightUnits:1,face:'front'}],
      devices:[{id:'sw1',name:'SW-01',type:'switch',kind:'switch',manufacturer:'ACME',model:'X48',modelSource:'manual',rackId:'rack1',rackUnit:18,rackUnits:1}],
      ports:[{id:'p1',deviceId:'sw1',name:'Gi1/0/1',media:'copper',speedMaxMbps:1000,negotiatedSpeedMbps:1000}],
      pdus:[{id:'pdu1',name:'PDU-A',rackId:'rack1',feed:'A',outletCount:8,maxPowerWatts:3680}],
      powerConnections:[{id:'pw1',deviceId:'sw1',pduId:'pdu1',outlet:1,powerSupplyIndex:0,feed:'A'}],
      patchPanels:[],telecomOutlets:[],cableRuns:[],patchConnections:[],hostOutletConnections:[],
      hosts:[],links:[],vlans:[],subnets:[],fwRules:[],dhcp:{}
    });
    window.NetWizardState.replaceProject(p,{source:'e2e-closeout-source'});
    window.navTo('physical');
  });

  await page.locator('#inventoryToDesignMount button',{hasText:'Crear Diseño To-Be'}).click();
  await expect.poll(()=>page.evaluate(()=>window.NetWizardState.getSnapshot().workflow.mode)).toBe('design');

  await page.evaluate(()=>{
    const p=window.NetWizardState.getSnapshot();
    p.devices[0].rackUnit=20;
    p.rackItems[0].startUnit=20;
    window.NetWizardState.replaceProject(p,{source:'e2e-closeout-change'});
    window.navTo('physical');
  });

  const closeout=page.locator('#interventionCloseoutMount');
  await expect(closeout).toBeVisible();
  await expect(closeout).toContainText('Cierre de intervención');
  await expect(closeout).toContainText('Listo');
  await expect(closeout.locator('button',{hasText:'Cerrar intervención'})).toBeEnabled();

  const beforeHistory=await page.evaluate(()=>window.NetWizardHistory.listSnapshots().length);
  await closeout.locator('button',{hasText:'Cerrar intervención'}).click();

  await expect.poll(()=>page.evaluate(()=>window.NetWizardState.getSnapshot().workflow.mode)).toBe('inventory');
  const result=await page.evaluate(()=>{
    const p=window.NetWizardState.getSnapshot();
    return{
      name:p.projName,
      updatedFrom:p.workflow&&p.workflow.updatedFrom,
      derivedFrom:p.workflow&&p.workflow.derivedFrom,
      baseline:p.workflow&&p.workflow.interventionBaseline,
      originRef:p.devices[0]&&p.devices[0].originRef,
      disposition:p.devices[0]&&p.devices[0].designDisposition,
      rackUnit:p.devices[0]&&p.devices[0].rackUnit,
      history:window.NetWizardHistory.listSnapshots().length
    };
  });

  expect(result.name).toContain('As-Built actualizado');
  expect(result.updatedFrom.type).toBe('intervention-closeout');
  expect(result.updatedFrom.sourceInventorySnapshotId).toMatch(/^snap_/);
  expect(result.updatedFrom.designSnapshotId).toMatch(/^snap_/);
  expect(result.updatedFrom.interventionActionCount).toBeGreaterThanOrEqual(1);
  expect(result.derivedFrom).toBeUndefined();
  expect(result.baseline).toBeUndefined();
  expect(result.originRef).toBeUndefined();
  expect(result.disposition).toBeUndefined();
  expect(result.rackUnit).toBe(20);
  expect(result.history).toBeGreaterThanOrEqual(beforeHistory+1);

  await expect(page.locator('#inventoryToDesignMount')).toContainText('As-Built actualizado desde intervención cerrada');
});


test('la UI permite seleccionar el equipo sustituto para un replace', async ({page})=>{
  await resetStorage(page);
  page.on('dialog', dialog => dialog.accept());

  await page.evaluate(()=>{
    const p=window.NetWizardState.getSnapshot();
    Object.assign(p,{
      projName:'E2E selector reemplazo',
      workflow:{mode:'inventory'},
      physicalLocations:[{id:'loc1',name:'CPD',type:'room'}],
      racks:[{id:'rack1',name:'RACK-01',locationId:'loc1',rackUnits:24}],
      rackItems:[{id:'ri1',rackId:'rack1',type:'device',deviceId:'sw-old',label:'SW-OLD',startUnit:18,heightUnits:1,face:'front'}],
      devices:[{id:'sw-old',name:'SW-OLD',type:'switch',kind:'switch',manufacturer:'ACME',model:'X24',modelSource:'manual',rackId:'rack1',rackUnit:18,rackUnits:1}],
      ports:[{id:'p-old',deviceId:'sw-old',name:'Gi1/0/1',media:'copper',speedMaxMbps:1000}],
      pdus:[],powerConnections:[],patchPanels:[],telecomOutlets:[],cableRuns:[],patchConnections:[],hostOutletConnections:[],
      hosts:[],links:[],vlans:[],subnets:[],fwRules:[],dhcp:{}
    });
    window.NetWizardState.replaceProject(p,{source:'e2e-replacement-source'});
    window.navTo('physical');
  });

  await page.locator('#inventoryToDesignMount button',{hasText:'Crear Diseño To-Be'}).click();
  await expect.poll(()=>page.evaluate(()=>window.NetWizardState.getSnapshot().workflow.mode)).toBe('design');

  await page.evaluate(()=>{
    const p=window.NetWizardState.getSnapshot();
    p.devices.push({
      id:'sw-new',name:'SW-NEW',type:'switch',kind:'switch',manufacturer:'ACME',model:'X48',
      modelSource:'manual',designDisposition:'add',rackId:'rack1',rackUnit:20,rackUnits:1
    });
    p.ports.push({id:'p-new',deviceId:'sw-new',name:'Gi1/0/1',media:'copper',speedMaxMbps:1000});
    p.rackItems.push({id:'ri-new',rackId:'rack1',type:'device',deviceId:'sw-new',label:'SW-NEW',startUnit:20,heightUnits:1,face:'front'});
    window.NetWizardState.replaceProject(p,{source:'e2e-replacement-device'});
    window.navTo('dev');
  });

  const disposition=page.locator('select[data-design-disposition="sw-old"]');
  await expect(disposition).toBeVisible();
  await disposition.selectOption('replace');

  const replacement=page.locator('select[data-replacement-for="sw-old"]');
  await expect(replacement).toBeEnabled();
  await expect(replacement.locator('option[value="sw-new"]')).toHaveText('SW-NEW');
  await replacement.selectOption('sw-new');

  const state=await page.evaluate(()=>{
    const p=window.NetWizardState.getSnapshot();
    const old=p.devices.find(d=>d.id==='sw-old');
    return{disposition:old.designDisposition,replacementDeviceRef:old.replacementDeviceRef};
  });
  expect(state.disposition).toBe('replace');
  expect(state.replacementDeviceRef).toBe('sw-new');

  await page.evaluate(()=>window.navTo('physical'));
  const closeout=page.locator('#interventionCloseoutMount');
  await expect(closeout).toBeVisible();
  await expect(closeout).not.toContainText('replacementDeviceRef');
  await expect(closeout.locator('button',{hasText:'Cerrar intervención'})).toBeEnabled();
});
