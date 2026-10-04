const { test, expect } = require('@playwright/test');

async function resetStorage(page){
  await page.goto('/index.html');
  await page.evaluate(()=>{localStorage.clear();sessionStorage.clear();localStorage.setItem('nw_locale_v1','es');});
  await page.reload();
}

test('Inventario físico permite editar y redimensionar un rack sin perder referencias', async ({page})=>{
  await resetStorage(page);

  await page.evaluate(()=>{
    const p=window.NetWizardState.getSnapshot();
    p.physicalLocations=[
      {id:'room-a',name:'Sala A',type:'room'},
      {id:'room-b',name:'Sala B',type:'room'}
    ];
    p.racks=[{
      id:'rack-test',name:'Rack 18U',locationId:'room-a',rackUnits:18,
      widthMm:600,depthMm:800,maxLoadKg:300,powerCapacityWatts:2500,
      coolingCapacityWatts:1800,numberingDirection:'bottom-up'
    }];
    p.devices=[{
      id:'sw-test',name:'SW-TEST',kind:'switch',type:'switch',vendorOs:'cisco_ios',
      rackId:'rack-test',rack:'rack-test',rackUnit:8,rackUnits:1,rackFace:'front'
    }];
    p.rackItems=[
      {id:'cm-test',rackId:'rack-test',type:'cable-manager',label:'Pasacables',startUnit:7,heightUnits:1,face:'front'},
      {id:'pp-item-test',rackId:'rack-test',type:'patch-panel',patchPanelId:'pp-test',label:'PP-TEST',startUnit:10,heightUnits:1,face:'front'}
    ];
    p.patchPanels=[{id:'pp-test',rackId:'rack-test',rackUnit:10,name:'PP-TEST',portCount:24}];
    p.pdus=[{id:'pdu-test',rackId:'rack-test',name:'PDU-A',feed:'A',mounting:'vertical-rear',outletCount:12}];
    p.powerConnections=[{id:'power-test',deviceId:'sw-test',pduId:'pdu-test',outlet:1,feed:'A'}];
    window.NetWizardState.replaceProject(p,{source:'rack-e2e-seed'});
  });

  await page.click('[data-step="physical"]');
  await expect(page.locator('#rackPlannerMount')).toBeVisible();
  await expect(page.locator('[data-action="edit-rack"][data-id="rack-test"]')).toBeVisible();

  await page.click('[data-action="edit-rack"][data-id="rack-test"]');
  const form=page.locator('[data-form="selected-rack"]');
  await expect(form).toBeVisible();
  await expect(form).toContainText('Guardar rack');

  const inputs=form.locator('input');
  await inputs.nth(0).fill('Rack compacto');
  await inputs.nth(1).fill('12');

  const selects=form.locator('select');
  await selects.nth(0).selectOption('room-b');
  await selects.nth(1).selectOption('top-down');

  await page.click('[data-action="update-selected-rack"]');

  let state=await page.evaluate(()=>{
    const p=window.NetWizardState.getSnapshot(),r=p.racks.find(x=>x.id==='rack-test');
    return{
      rack:r,
      device:p.devices.find(x=>x.id==='sw-test'),
      panel:p.patchPanels.find(x=>x.id==='pp-test'),
      pdu:p.pdus.find(x=>x.id==='pdu-test'),
      power:p.powerConnections.find(x=>x.id==='power-test')
    };
  });
  expect(state.rack.name).toBe('Rack compacto');
  expect(state.rack.rackUnits).toBe(12);
  expect(state.rack.locationId).toBe('room-b');
  expect(state.rack.numberingDirection).toBe('top-down');
  expect(state.device.rackId).toBe('rack-test');
  expect(state.device.rackUnit).toBe(8);
  expect(state.panel.rackId).toBe('rack-test');
  expect(state.pdu.rackId).toBe('rack-test');
  expect(state.power.pduId).toBe('pdu-test');

  const formAfter=page.locator('[data-form="selected-rack"]');
  await formAfter.locator('input').nth(1).fill('9');
  await page.click('[data-action="update-selected-rack"]');

  const rackEditor=page.locator('[data-form="selected-rack"]').locator('xpath=..');
  await expect(rackEditor).toContainText('No se puede reducir a 9U');
  await expect(rackEditor).toContainText('PP-TEST');

  state=await page.evaluate(()=>{
    const p=window.NetWizardState.getSnapshot();
    return{rack:p.racks.find(x=>x.id==='rack-test')};
  });
  expect(state.rack.rackUnits).toBe(12);
});
