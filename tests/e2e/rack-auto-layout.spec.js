const { test, expect } = require('@playwright/test');

async function resetStorage(page){
  await page.goto('/index.html');
  await page.evaluate(()=>{localStorage.clear();sessionStorage.clear();});
  await page.reload();
}

test('Inventario físico previsualiza y aplica organización automática de rack sin duplicados', async ({page})=>{
  await resetStorage(page);

  await page.evaluate(()=>{
    const p=window.NetWizardState.getSnapshot();
    p.designRequirements=p.designRequirements||{};
    p.designRequirements.rackPolicy={patchPanelPorts:24,organizerPerSwitch:true,layoutPattern:'patch-manager-switch'};
    p.racks=[{id:'rack-auto',name:'Rack Auto',rackUnits:18,numberingDirection:'bottom-up'}];
    p.devices=[
      {id:'router-auto',name:'RTR-AUTO',kind:'router',type:'router',rackId:'rack-auto',rack:'rack-auto',rackUnit:1,rackUnits:1,rackFace:'front'},
      {id:'sw-auto-2',name:'SW-AUTO-02',kind:'switch',type:'switch',rackId:'rack-auto',rack:'rack-auto',rackUnit:9,rackUnits:1,rackFace:'front'},
      {id:'sw-auto-1',name:'SW-AUTO-01',kind:'switch',type:'switch',rackId:'rack-auto',rack:'rack-auto',rackUnit:12,rackUnits:1,rackFace:'front'}
    ];
    p.ports=[
      {id:'sw-auto-1-p1',deviceId:'sw-auto-1',name:'Gi1/0/1',mode:'access',media:'GE'},
      {id:'sw-auto-2-p1',deviceId:'sw-auto-2',name:'Gi1/0/1',mode:'access',media:'GE'}
    ];
    p.patchPanels=[{id:'pp-auto-existing',rackId:'rack-auto',name:'PP-AUTO-01',portCount:24,category:'Cat6A',rackUnit:14}];
    p.patchConnections=[{id:'patch-auto-existing',patchPanelId:'pp-auto-existing',patchPort:1,switchPortId:'sw-auto-1-p1',patchCordLengthM:1}];
    p.rackItems=[
      {id:'pp-auto-item',rackId:'rack-auto',type:'patch-panel',patchPanelId:'pp-auto-existing',label:'PP-AUTO-01',startUnit:14,heightUnits:1,face:'front'},
      {id:'cm-auto-existing',rackId:'rack-auto',type:'cable-manager',label:'Organizador existente',startUnit:13,heightUnits:1,face:'front'}
    ];
    p.pdus=[];p.powerConnections=[];
    window.NetWizardState.replaceProject(p,{source:'rack-auto-layout-e2e-seed'});
  });

  await page.click('[data-step="physical"]');
  await expect(page.locator('#rackPlannerMount')).toBeVisible();

  await page.click('[data-action="preview-rack-layout"][data-id="rack-auto"]');
  const preview=page.locator('[data-rack-layout-preview="rack-auto"]');
  await expect(preview).toBeVisible();
  await expect(preview).toContainText('patch panel → organizador → switch');
  await expect(preview).toContainText('SW-AUTO-01');
  await expect(preview).toContainText('SW-AUTO-02');
  await expect(preview).toContainText('PP-AUTO-01');

  await page.click('[data-action="apply-rack-layout"][data-id="rack-auto"]');

  let result=await page.evaluate(()=>{
    const p=window.NetWizardState.getSnapshot();
    return{
      router:p.devices.find(x=>x.id==='router-auto'),
      sw1:p.devices.find(x=>x.id==='sw-auto-1'),
      sw2:p.devices.find(x=>x.id==='sw-auto-2'),
      panels:p.patchPanels.filter(x=>x.rackId==='rack-auto').map(x=>({id:x.id,rackUnit:x.rackUnit})),
      managers:p.rackItems.filter(x=>x.rackId==='rack-auto'&&x.type==='cable-manager').map(x=>({id:x.id,startUnit:x.startUnit})),
      patchConnections:p.patchConnections
    };
  });

  expect(result.router.rackUnit).toBe(1);
  expect(result.sw2.rackUnit).toBe(4);
  expect(result.sw1.rackUnit).toBe(7);
  expect(result.panels).toEqual(expect.arrayContaining([
    expect.objectContaining({id:'pp-auto-existing',rackUnit:5}),
    expect.objectContaining({id:expect.stringMatching(/^rackauto-pp-/),rackUnit:2})
  ]));
  expect(result.managers).toEqual(expect.arrayContaining([
    expect.objectContaining({id:'cm-auto-existing',startUnit:6}),
    expect.objectContaining({id:expect.stringMatching(/^rackauto-manager-/),startUnit:3})
  ]));
  expect(result.patchConnections).toEqual([
    expect.objectContaining({id:'patch-auto-existing',patchPanelId:'pp-auto-existing',switchPortId:'sw-auto-1-p1'})
  ]);

  const firstCounts={panels:result.panels.length,managers:result.managers.length};

  await page.click('[data-action="preview-rack-layout"][data-id="rack-auto"]');
  await expect(page.locator('[data-rack-layout-preview="rack-auto"]')).toContainText('Se crearán 0 patch panel(es)');
  await page.click('[data-action="apply-rack-layout"][data-id="rack-auto"]');

  result=await page.evaluate(()=>{
    const p=window.NetWizardState.getSnapshot();
    return{
      panels:p.patchPanels.filter(x=>x.rackId==='rack-auto').length,
      managers:p.rackItems.filter(x=>x.rackId==='rack-auto'&&x.type==='cable-manager').length,
      sw1:p.devices.find(x=>x.id==='sw-auto-1').rackUnit,
      sw2:p.devices.find(x=>x.id==='sw-auto-2').rackUnit
    };
  });
  expect(result.panels).toBe(firstCounts.panels);
  expect(result.managers).toBe(firstCounts.managers);
  expect(result.sw1).toBe(7);
  expect(result.sw2).toBe(4);
});
