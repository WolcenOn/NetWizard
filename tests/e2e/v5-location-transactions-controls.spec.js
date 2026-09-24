const { test, expect } = require('@playwright/test');

async function resetStorage(page){
  await page.goto('/index.html');
  await page.evaluate(()=>{ localStorage.clear(); sessionStorage.clear(); });
  await page.reload();
}

test('V5 crea y elimina ubicaciones de forma transaccional desde toolbar', async ({page})=>{
  await resetStorage(page);
  await page.evaluate(()=>{
    const p=window.NetWizardState.getSnapshot();
    Object.assign(p,{
      physicalLocations:[{id:'room1',name:'CPD',type:'room',parentId:'',distance:'',notes:''}],
      racks:[],telecomOutlets:[],
      devices:[{id:'sw1',name:'SW-01',type:'switch',kind:'switch',physicalLocation:'CPD'}],
      ports:[],links:[],hosts:[],vlans:[],subnets:[],fwRules:[],
      visual:{
        locs:[{id:'loc1',name:'CPD',physicalLocationId:'room1',x:40,y:40,w:700,h:420,color:'#10233c'}],
        assign:{devices:{sw1:'loc1'},hosts:{}},pos:{sw1:{x:120,y:140}},
        view:{px:50,py:40,zoom:1},sel:null,proMode:false,proBounds:{},filters:{hosts:true}
      }
    });
    window.NetWizardState.replaceProject(p,{source:'e2e-v5-location-transaction'});
    window.navTo('graphs');
  });

  const versions=await page.evaluate(()=>({
    tx:window.NetWizardV5LocationTransactions?.version,
    controls:window.NetWizardV5Controls?.version,
    bridgeTx:window.NetWizardV5?.locationTransactions?.version,
    bridgeControls:window.NetWizardV5?.controls?.version
  }));
  expect(versions).toEqual({
    tx:'netwizard-v5-location-transactions-v1',
    controls:'netwizard-v5-controls-factory-v1',
    bridgeTx:'netwizard-v5-location-transactions-v1',
    bridgeControls:'netwizard-v5-controls-factory-v1'
  });

  const before=await page.evaluate(()=>({
    physical:window.NetWizardState.getSnapshot().physicalLocations.length,
    visual:window.NetWizardState.getSnapshot().visual.locs.length
  }));
  await page.locator('#v5AddLoc').click();

  const created=await expect.poll(()=>page.evaluate(()=>{
    const p=window.NetWizardState.getSnapshot();
    const v=p.visual.locs.find(l=>l.name==='Ubicación 2');
    const physical=p.physicalLocations.find(l=>l.name==='Ubicación 2');
    return{
      physicalCount:p.physicalLocations.length,
      visualCount:p.visual.locs.length,
      physicalId:physical?.id||null,
      visualId:v?.id||null,
      linked:v?.physicalLocationId===physical?.id,
      command:window.NetWizardV5CommandState?.name||null
    };
  })).toEqual({
    physicalCount:before.physical+1,
    visualCount:before.visual+1,
    physicalId:expect.any(String),
    visualId:expect.any(String),
    linked:true,
    command:'upsertPhysicalLocation'
  });

  const newVisualId=await page.evaluate(()=>window.NetWizardState.getSnapshot().visual.locs.find(l=>l.name==='Ubicación 2')?.id);
  await page.evaluate(id=>window.NetWizardV5.select('loc',id),newVisualId);
  page.once('dialog',dialog=>dialog.accept());
  await page.getByRole('button',{name:'🗑 Eliminar ubicación'}).click();

  await expect.poll(()=>page.evaluate(()=>{
    const p=window.NetWizardState.getSnapshot();
    return{
      physical:p.physicalLocations.some(l=>l.name==='Ubicación 2'),
      visual:p.visual.locs.some(l=>l.name==='Ubicación 2'),
      command:window.NetWizardV5CommandState?.name||null
    };
  })).toEqual({physical:false,visual:false,command:'deletePhysicalLocation'});

  const hostsFilter=page.locator('[data-v5-filter="hosts"]');
  await hostsFilter.uncheck();
  await expect.poll(()=>page.evaluate(()=>window.NetWizardState.getSnapshot().visual.filters.hosts)).toBe(false);
  await expect.poll(()=>page.evaluate(()=>window.NetWizardV5CommandState?.name)).toBe('setFilter');
});