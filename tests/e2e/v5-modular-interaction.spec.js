const { test, expect } = require('@playwright/test');

async function resetStorage(page){
  await page.goto('/index.html');
  await page.evaluate(()=>{ localStorage.clear(); sessionStorage.clear(); });
  await page.reload();
}

test('V5 modular mantiene selección, drag y zoom sobre canvas', async ({page})=>{
  await resetStorage(page);
  await page.evaluate(()=>{
    const p=window.NetWizardState.getSnapshot();
    Object.assign(p,{
      physicalLocations:[{id:'room1',name:'CPD',type:'room'}],
      racks:[],
      devices:[
        {id:'sw1',name:'SW-01',type:'switch',kind:'switch'},
        {id:'r1',name:'RTR-01',type:'router',kind:'router'}
      ],
      ports:[
        {id:'p1',deviceId:'sw1',name:'Te1/1',mode:'trunk'},
        {id:'p2',deviceId:'r1',name:'Te0/0',mode:'trunk'}
      ],
      links:[{id:'l1',fromPortId:'p1',toPortId:'p2'}],
      hosts:[],vlans:[],subnets:[],fwRules:[],
      visual:{
        locs:[{id:'loc1',name:'CPD',physicalLocationId:'room1',x:40,y:40,w:850,h:500,color:'#10233c'}],
        assign:{devices:{sw1:'loc1',r1:'loc1'},hosts:{}},
        pos:{sw1:{x:120,y:140},r1:{x:430,y:140}},
        view:{px:50,py:40,zoom:1},sel:null,proMode:false,proBounds:{}
      }
    });
    window.NetWizardState.replaceProject(p,{source:'e2e-v5-modular-interaction'});
    window.navTo('graphs');
  });

  await expect.poll(()=>page.evaluate(()=>window.NetWizardV5RenderState||null)).not.toBeNull();
  const modules=await page.evaluate(()=>({
    renderer:window.NetWizardV5Renderer?.version,
    interaction:window.NetWizardV5Interaction?.version,
    scene:window.NetWizardV5Scene?.version,
    drag:window.NetWizardV5DragController?.version,
    bridgeScene:window.NetWizardV5?.scene?.version,
    bridgeDrag:window.NetWizardV5?.dragController?.version,
    commands:window.NetWizardV5Commands?.version,
    panel:window.NetWizardV5Panel?.version,
    bridgeCommands:window.NetWizardV5?.commands?.version,
    bridgePanel:window.NetWizardV5?.panel?.version,
    locationTransactions:window.NetWizardV5LocationTransactions?.version,
    controls:window.NetWizardV5Controls?.version,
    bridgeLocationTransactions:window.NetWizardV5?.locationTransactions?.version,
    bridgeControls:window.NetWizardV5?.controls?.version
  }));
  expect(modules).toEqual({renderer:'netwizard-v5-renderer-v1',interaction:'netwizard-v5-interaction-v1',scene:'netwizard-v5-scene-v1',drag:'netwizard-v5-drag-controller-factory-v1',bridgeScene:'netwizard-v5-scene-v1',bridgeDrag:'netwizard-v5-drag-controller-factory-v1',commands:'netwizard-v5-commands-factory-v1',panel:'netwizard-v5-panel-factory-v1',bridgeCommands:'netwizard-v5-commands-factory-v1',bridgePanel:'netwizard-v5-panel-factory-v1',locationTransactions:'netwizard-v5-location-transactions-v1',controls:'netwizard-v5-controls-factory-v1',bridgeLocationTransactions:'netwizard-v5-location-transactions-v1',bridgeControls:'netwizard-v5-controls-factory-v1'});

  const canvas=page.locator('#v5view');
  await expect(canvas).toBeVisible();

  const start=await page.evaluate(()=>{
    const p=window.NetWizardV5.nodeCenter('dev','sw1');
    const s=window.NetWizardV5.worldToScreen(p.x,p.y);
    return{screen:s,pos:{...window.NetWizardState.getSnapshot().visual.pos.sw1},zoom:window.NetWizardState.getSnapshot().visual.view.zoom};
  });
  const box=await canvas.boundingBox();
  expect(box).toBeTruthy();

  await page.mouse.click(box.x+start.screen.x,box.y+start.screen.y);
  await expect.poll(()=>page.evaluate(()=>window.NetWizardState.getSnapshot().visual.sel)).toEqual({t:'device',id:'sw1'});
  await expect.poll(()=>page.evaluate(()=>window.NetWizardV5RenderState?.sceneOrder||[])).toEqual(['background','locations','base-links','nodes','selected-links']);

  await expect(page.locator('#v5Panel')).toHaveAttribute('data-v5-panel-module','netwizard-v5-panel-v1');
  await page.locator('#v5Panel input').first().evaluate(el=>{
    el.value='SW-EDIT';
    el.dispatchEvent(new Event('input',{bubbles:true}));
  });
  await expect.poll(()=>page.evaluate(()=>window.NetWizardState.getSnapshot().devices.find(d=>d.id==='sw1')?.name)).toBe('SW-EDIT');
  await expect.poll(()=>page.evaluate(()=>window.NetWizardV5CommandState?.name)).toBe('updateDevice');
  await expect.poll(()=>page.evaluate(()=>window.NetWizardV5CommandState?.payload?.key)).toBe('name');

  await page.evaluate(()=>{window.__v5ProjectChanged=0;document.addEventListener('nw:project:changed',()=>window.__v5ProjectChanged++);});
  await page.mouse.move(box.x+start.screen.x,box.y+start.screen.y);
  await page.mouse.down();
  await page.mouse.move(box.x+start.screen.x+70,box.y+start.screen.y+45,{steps:5});
  await page.mouse.up();

  const moved=await page.evaluate(()=>window.NetWizardState.getSnapshot().visual.pos.sw1);
  expect(Math.abs(moved.x-start.pos.x)).toBeGreaterThan(20);
  expect(Math.abs(moved.y-start.pos.y)).toBeGreaterThan(10);
  expect(await page.evaluate(()=>window.__v5ProjectChanged)).toBe(0);

  await page.mouse.move(box.x+300,box.y+220);
  await page.mouse.wheel(0,-250);
  await expect.poll(()=>page.evaluate(()=>window.NetWizardState.getSnapshot().visual.view.zoom)).toBeGreaterThan(start.zoom);
});
