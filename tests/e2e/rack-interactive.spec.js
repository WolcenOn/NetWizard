const { test, expect } = require('@playwright/test');

async function resetStorage(page){
  await page.goto('/index.html');
  await page.evaluate(()=>{localStorage.clear();sessionStorage.clear();});
  await page.reload();
}

test('rack interactivo permite seleccionar editar arrastrar y eliminar un elemento', async ({page})=>{
  const errors=[];page.on('pageerror',err=>errors.push(err.message));
  await resetStorage(page);
  await expect.poll(()=>page.evaluate(()=>!!window.NetWizardRackUi)).toBe(true);

  await page.evaluate(()=>{
    const p=window.NetWizardState.getSnapshot();
    Object.assign(p,{
      projName:'E2E Rack interactivo',
      physicalLocations:[{id:'cpd1',name:'CPD',type:'room'}],
      racks:[{id:'rack1',name:'Rack 1',locationId:'cpd1',rackUnits:24}],
      rackItems:[
        {id:'ri-sw1',rackId:'rack1',type:'device',deviceId:'sw1',label:'SW-01',startUnit:10,heightUnits:1,face:'front'},
        {id:'ri-srv1',rackId:'rack1',type:'device',deviceId:'srv1',label:'SRV-01',startUnit:7,heightUnits:2,face:'front'}
      ],
      devices:[
        {id:'sw1',name:'SW-01',type:'switch',kind:'switch',rackId:'rack1',rackUnit:10,rackUnits:1},
        {id:'srv1',name:'SRV-01',type:'server',kind:'server',rackId:'rack1',rackUnit:7,rackUnits:2}
      ],
      ports:[],links:[],hosts:[],vlans:[],subnets:[],fwRules:[],
      pdus:[],powerConnections:[],patchPanels:[],telecomOutlets:[],cableRuns:[],patchConnections:[],hostOutletConnections:[]
    });
    window.NetWizardState.replaceProject(p,{source:'e2e-interactive-rack'});
    if(window.navTo)window.navTo('dev');
  });

  await page.waitForSelector('#rackPlannerMount [data-item-id="ri-sw1"]');
  await page.locator('#rackPlannerMount [data-item-id="ri-sw1"]').first().click();

  const selected=page.locator('#rackPlannerMount [data-form="selected-item"]');
  await expect(selected).toBeVisible();
  await expect(selected).toContainText('Guardar cambios');

  await selected.locator('input').nth(0).fill('SW-01 editado');
  await selected.locator('input').nth(1).fill('12');
  await selected.locator('[data-action="update-selected-item"]').click();

  await expect.poll(()=>page.evaluate(()=>{
    const p=window.NetWizardState.getSnapshot();
    const item=p.rackItems.find(x=>x.id==='ri-sw1'),dev=p.devices.find(x=>x.id==='sw1');
    return{label:item&&item.label,itemU:item&&item.startUnit,deviceU:dev&&dev.rackUnit};
  })).toEqual({label:'SW-01 editado',itemU:12,deviceU:12});

  const source=page.locator('#rackPlannerMount [data-item-id="ri-sw1"]').first();
  const target=page.locator('#rackPlannerMount .rack-u[data-rack-id="rack1"][data-unit="15"]');
  await source.dragTo(target);

  await expect.poll(()=>page.evaluate(()=>{
    const p=window.NetWizardState.getSnapshot();
    return{
      itemU:p.rackItems.find(x=>x.id==='ri-sw1')?.startUnit,
      deviceU:p.devices.find(x=>x.id==='sw1')?.rackUnit
    };
  })).toEqual({itemU:15,deviceU:15});

  const moved=page.locator('#rackPlannerMount [data-item-id="ri-sw1"]').first();
  const occupied=page.locator('#rackPlannerMount .rack-u[data-rack-id="rack1"][data-unit="7"]');
  await moved.dragTo(occupied);
  await expect.poll(()=>page.evaluate(()=>window.NetWizardState.getSnapshot().rackItems.find(x=>x.id==='ri-sw1')?.startUnit)).toBe(15);
  await expect(page.locator('#rackPlannerMount .rack-selected-editor')).toContainText('colisionaría');

  await page.locator('#rackPlannerMount [data-action="remove-rack-item"]').click();
  await expect.poll(()=>page.evaluate(()=>{
    const p=window.NetWizardState.getSnapshot();
    return{
      item:!!p.rackItems.find(x=>x.id==='ri-sw1'),
      rackId:p.devices.find(x=>x.id==='sw1')?.rackId
    };
  })).toEqual({item:false,rackId:null});

  expect(errors).toEqual([]);
});
