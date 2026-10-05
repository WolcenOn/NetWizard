const { test, expect } = require('@playwright/test');

async function resetStorage(page){
  await page.goto('/index.html');
  await page.evaluate(()=>{localStorage.clear();sessionStorage.clear();localStorage.setItem('nw_locale_v1','es');});
  await page.reload();
}

test('editor físico crea una ruta completa switch → patch panel → toma → host', async ({page})=>{
  const errors=[];page.on('pageerror',err=>errors.push(err.message));
  await resetStorage(page);
  await expect.poll(()=>page.evaluate(()=>!!window.NetWizardStructuredCablingUi)).toBe(true);
  await page.evaluate(()=>{
    const p=window.NetWizardState.getSnapshot();
    Object.assign(p,{
      projName:'E2E Cableado',
      physicalLocations:[{id:'loc1',name:'Oficina',type:'room'}],
      racks:[{id:'rack1',name:'Rack 1',rackUnits:24}],
      rackItems:[],pdus:[],powerConnections:[],
      devices:[{id:'sw1',name:'SW-01',type:'switch',kind:'switch',vendorOs:'cisco_ios',rackId:'rack1',rackUnit:10,rackUnits:1}],
      ports:[
        {id:'p1',deviceId:'sw1',name:'Gi1/0/1',mode:'access',media:'GE'},
        {id:'p2',deviceId:'sw1',name:'Gi1/0/2',mode:'access',media:'GE'}
      ],
      hosts:[{id:'h1',name:'PC-01',type:'pc',portRef:'p2',connectedDeviceId:'sw1'}],
      patchPanels:[],telecomOutlets:[],cableRuns:[],patchConnections:[],hostOutletConnections:[]
    });
    window.NetWizardState.replaceProject(p,{source:'e2e-cabling'});
    if(window.navTo)window.navTo('physical');
  });
  await expect(page.locator('#structuredCablingMount')).toBeAttached();
  await page.locator('#structuredCablingSection').evaluate(el=>{el.open=true;el.dispatchEvent(new Event('toggle'));});
  await expect(page.locator('#structuredCablingMount')).toBeVisible();
  await expect(page.locator('[data-form="cable-panel"]')).toBeVisible();

  const panel=page.locator('[data-form="cable-panel"]');
  await panel.locator('select').selectOption('rack1');
  await panel.locator('input').nth(0).fill('PP-01');
  await panel.locator('input').nth(1).fill('24');
  await panel.locator('input').nth(2).fill('Cat6A');
  await panel.locator('input').nth(3).fill('20');
  await panel.locator('[data-action="add-cable-panel"]').click();
  await expect.poll(()=>page.evaluate(()=>window.NetWizardState.getSnapshot().patchPanels?.length||0)).toBe(1);

  const outlet=page.locator('[data-form="cable-outlet"]');
  await outlet.locator('select').selectOption('loc1');
  await outlet.locator('input').nth(0).fill('TO-01');
  await outlet.locator('input').nth(1).fill('1');
  await outlet.locator('input').nth(2).fill('Cat6A');
  await outlet.locator('[data-action="add-cable-outlet"]').click();
  await expect.poll(()=>page.evaluate(()=>window.NetWizardState.getSnapshot().telecomOutlets?.length||0)).toBe(1);

  const run=page.locator('[data-form="cable-run"]');
  await run.locator('select').nth(0).selectOption({index:1});
  await run.locator('input').nth(0).fill('1');
  await run.locator('select').nth(1).selectOption({index:1});
  await run.locator('input').nth(1).fill('1');
  await run.locator('input').nth(2).fill('Cat6A');
  await run.locator('input').nth(3).fill('35');
  await run.locator('input').nth(4).fill('CPD → Oficina');
  await run.locator('[data-action="add-cable-run"]').click();
  await expect.poll(()=>page.evaluate(()=>window.NetWizardState.getSnapshot().cableRuns?.length||0)).toBe(1);

  const patch=page.locator('[data-form="cable-patch"]');
  await patch.locator('select').nth(0).selectOption({index:1});
  await patch.locator('input').nth(0).fill('1');
  await patch.locator('select').nth(1).selectOption('p1');
  await patch.locator('input').nth(1).fill('1');
  await patch.locator('[data-action="add-cable-patch"]').click();
  await expect.poll(()=>page.evaluate(()=>window.NetWizardState.getSnapshot().patchConnections?.length||0)).toBe(1);

  const host=page.locator('[data-form="cable-host"]');
  await host.locator('select').nth(0).selectOption({index:1});
  await host.locator('input').nth(0).fill('1');
  await host.locator('select').nth(1).selectOption('h1');
  await host.locator('input').nth(1).fill('2');
  await host.locator('[data-action="add-cable-host"]').click();

  const result=await expect.poll(()=>page.evaluate(()=>{
    const p=window.NetWizardState.getSnapshot(),audit=window.NetWizardStructuredCabling.validate(p);
    return{hostLinks:p.hostOutletConnections?.length||0,ok:audit.ok,paths:audit.paths.map(x=>({complete:x.complete,switch:x.switchPortLabel,host:x.hostLabel}))};
  })).toMatchObject({hostLinks:1,ok:true,paths:[{complete:true}]});

  await expect(page.locator('#structuredCablingMount')).toContainText('CPD → Oficina');
  await expect(page.locator('#structuredCablingMount')).toContainText('SW-01 · Gi1/0/1');
  await expect(page.locator('#structuredCablingMount')).toContainText('PC-01');

  await expect.poll(()=>page.evaluate(()=>{
    const h=window.NetWizardState.getSnapshot().hosts.find(x=>x.id==='h1');
    return {portRef:h?.portRef,deviceId:h?.connectedDeviceId};
  })).toEqual({portRef:'p1',deviceId:'sw1'});

  await page.evaluate(()=>window.navTo('hosts'));
  await page.locator('[data-eh="h1"]').click();
  await expect(page.locator('#hConnDev')).toBeDisabled();
  await expect(page.locator('#hPortMode')).toBeDisabled();
  await expect(page.locator('#hPort')).toBeDisabled();
  await expect(page.locator('#hPort')).toHaveValue('p1');
  await expect(page.locator('#hDevHint')).toHaveValue(/Físico.*SW-01.*Gi1\/0\/1/);
  await expect(page.locator('#hConnAuthority')).toContainText('Inventario físico');
  expect(errors).toEqual([]);
});
