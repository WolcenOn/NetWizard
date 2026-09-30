const { test, expect } = require('@playwright/test');

async function reset(page){
  await page.goto('/index.html');
  await page.evaluate(()=>{localStorage.clear();sessionStorage.clear();});
  await page.reload();
}

test('circuitos WAN se editan en Enlaces y se validan sin duplicar autoridad', async ({page})=>{
  const errors=[];page.on('pageerror',err=>errors.push(err.message));
  await reset(page);

  await page.evaluate(()=>{
    const p=window.NetWizardState.getSnapshot();
    Object.assign(p,{
      workflow:{mode:'design'},
      devices:[
        {id:'r1',name:'RTR-WAN',type:'router',kind:'router',vendorOs:'cisco_ios'},
        {id:'fw1',name:'FW-EDGE',type:'firewall',kind:'firewall',vendorOs:'fortinet'}
      ],
      ports:[
        {id:'r1-wan',deviceId:'r1',name:'Gi0/0',mode:'routed'},
        {id:'r1-lan',deviceId:'r1',name:'Gi0/1',mode:'trunk'},
        {id:'fw1-wan',deviceId:'fw1',name:'wan1',mode:'routed'}
      ],
      wanCircuits:[],trafficProfiles:[]
    });
    window.NetWizardState.replaceProject(p,{source:'e2e-wan-editor'});
    window.navTo('links');
  });

  await expect(page.locator('#nwWanCircuitsEditor')).toBeVisible();
  await page.locator('#nwWanName').fill('DIA principal');
  await page.locator('#nwWanProvider').fill('ISP-A');
  await page.locator('#nwWanRole').selectOption('primary');
  await page.locator('#nwWanDevice').selectOption('r1');
  await expect(page.locator('#nwWanPort option')).toHaveCount(3);
  await page.locator('#nwWanPort').selectOption('r1-wan');
  await page.locator('#nwWanDown').fill('500');
  await page.locator('#nwWanUp').fill('200');
  await page.locator('#nwWanPeak').fill('120');
  await page.locator('#nwWanGroup').fill('sede-madrid');
  await page.locator('#nwWanLatency').fill('20');
  await page.locator('#nwWanLoss').fill('1');
  await page.locator('#nwWanSla').fill('99.9');
  await page.locator('#nwWanPath').fill('duct-a');
  await page.locator('#nwWanSave').click();

  const created=await page.evaluate(()=>window.NetWizardState.getSnapshot().wanCircuits[0]);
  expect(created).toMatchObject({
    name:'DIA principal',provider:'ISP-A',role:'primary',enabled:true,
    deviceId:'r1',portId:'r1-wan',bandwidthDownMbps:500,bandwidthUpMbps:200,
    expectedPeakMbps:120,siteRef:'sede-madrid',latencyTargetMs:20,
    lossTargetPercent:1,slaAvailability:99.9,physicalPath:'duct-a'
  });
  expect(created.id).toBeTruthy();

  await page.locator('[data-wan-edit]').click();
  await expect(page.locator('#nwWanSave')).toContainText('Guardar');
  await page.locator('#nwWanProvider').fill('ISP-A Enterprise');
  await page.locator('#nwWanUp').fill('250');
  await page.locator('#nwWanSave').click();

  const edited=await page.evaluate(()=>window.NetWizardState.getSnapshot().wanCircuits[0]);
  expect(edited.id).toBe(created.id);
  expect(edited.provider).toBe('ISP-A Enterprise');
  expect(edited.bandwidthUpMbps).toBe(250);

  await page.locator('.sb-it[data-step="validate"]').click();
  await expect(page.locator('#nwWanCircuitsPanel')).toBeVisible();
  await expect(page.locator('#nwWanCircuitsPanel')).toContainText('DIA principal');
  await expect(page.locator('#nwWanCircuitsPanel')).toContainText('500/250 Mbps');

  await page.locator('.sb-it[data-step="links"]').click();
  page.once('dialog',dialog=>dialog.accept());
  await page.locator('[data-wan-delete]').click();
  await expect.poll(()=>page.evaluate(()=>window.NetWizardState.getSnapshot().wanCircuits.length)).toBe(0);

  expect(errors).toEqual([]);
});

test('editor WAN impide usar un puerto de otro dispositivo', async ({page})=>{
  await reset(page);
  await page.evaluate(()=>{
    const p=window.NetWizardState.getSnapshot();
    Object.assign(p,{
      devices:[
        {id:'r1',name:'R1',type:'router',kind:'router'},
        {id:'r2',name:'R2',type:'router',kind:'router'}
      ],
      ports:[
        {id:'p1',deviceId:'r1',name:'wan0',mode:'routed'},
        {id:'p2',deviceId:'r2',name:'wan0',mode:'routed'}
      ],
      wanCircuits:[]
    });
    window.NetWizardState.replaceProject(p,{source:'e2e-wan-port-authority'});
    window.navTo('links');
  });
  await page.locator('#nwWanDevice').selectOption('r1');
  const values=await page.locator('#nwWanPort option').evaluateAll(options=>options.map(o=>o.value));
  expect(values).toContain('p1');
  expect(values).not.toContain('p2');
});
