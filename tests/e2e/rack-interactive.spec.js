const { test, expect } = require('@playwright/test');

async function resetStorage(page){
  await page.goto('/index.html');
  await page.evaluate(()=>{localStorage.clear();sessionStorage.clear();});
  await page.reload();
}

async function pointerDrag(page,source,target){
  await target.scrollIntoViewIfNeeded();
  const sourceBox=await source.boundingBox(),targetBox=await target.boundingBox();
  if(!sourceBox||!targetBox)throw new Error('No se pudo calcular la geometría del drag de rack.');
  const from={x:sourceBox.x+sourceBox.width/2,y:sourceBox.y+sourceBox.height/2};
  const to={x:targetBox.x+targetBox.width/2,y:targetBox.y+targetBox.height/2};
  await page.mouse.move(from.x,from.y);
  await page.mouse.down();
  await page.mouse.move((from.x+to.x)/2,(from.y+to.y)/2,{steps:4});
  await page.mouse.move(to.x,to.y,{steps:8});
  await page.mouse.up();
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
    if(window.navTo)window.navTo('physical');
  });

  const initialRow=page.locator('#rackPlannerMount .rack-u[data-rack-id="rack1"][data-unit="10"][data-drag-rack-item="1"][data-item-id="ri-sw1"]');
  await expect(initialRow).toBeVisible();
  await initialRow.click();

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

  const source=page.locator('#rackPlannerMount .rack-u[data-rack-id="rack1"][data-unit="12"][data-drag-rack-item="1"][data-item-id="ri-sw1"]');
  const target=page.locator('#rackPlannerMount .rack-u[data-rack-id="rack1"][data-unit="15"]');
  await expect(source).toBeVisible();
  await pointerDrag(page,source,target);

  await expect.poll(()=>page.evaluate(()=>{
    const p=window.NetWizardState.getSnapshot();
    return{
      itemU:p.rackItems.find(x=>x.id==='ri-sw1')?.startUnit,
      deviceU:p.devices.find(x=>x.id==='sw1')?.rackUnit
    };
  })).toEqual({itemU:15,deviceU:15});

  const moved=page.locator('#rackPlannerMount .rack-u[data-rack-id="rack1"][data-unit="15"][data-drag-rack-item="1"][data-item-id="ri-sw1"]');
  const occupied=page.locator('#rackPlannerMount .rack-u[data-rack-id="rack1"][data-unit="7"]');
  await expect(moved).toBeVisible();
  await pointerDrag(page,moved,occupied);
  await expect.poll(()=>page.evaluate(()=>window.NetWizardState.getSnapshot().rackItems.find(x=>x.id==='ri-sw1')?.startUnit)).toBe(15);
  await expect(page.locator('#rackPlannerMount .rack-selected-editor')).toContainText('colisionaría');

  await page.locator('#rackPlannerMount [data-action="remove-rack-item"]').click();
  await expect.poll(()=>page.evaluate(()=>{
    const p=window.NetWizardState.getSnapshot();
    return{
      item:!!p.rackItems.find(x=>x.id==='ri-sw1'),
      rackId:p.devices.find(x=>x.id==='sw1')?.rackId
    };
  })).toEqual({item:false,rackId:''});

  expect(errors).toEqual([]);
});
