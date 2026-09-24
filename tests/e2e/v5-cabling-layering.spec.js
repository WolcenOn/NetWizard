const { test, expect } = require('@playwright/test');

async function resetStorage(page){
  await page.goto('/index.html');
  await page.evaluate(()=>{ localStorage.clear(); sessionStorage.clear(); });
  await page.reload();
}

test('V5 pinta cableado base detrás de etiquetas y eleva solo la ruta seleccionada', async ({page})=>{
  await resetStorage(page);
  await page.evaluate(()=>{
    const p=window.NetWizardState.getSnapshot();
    Object.assign(p,{
      physicalLocations:[{id:'room1',name:'CPD',type:'room'}],
      racks:[{id:'rack1',name:'Rack 1',locationId:'room1',rackUnits:24}],
      devices:[
        {id:'core',name:'CORE-01',type:'switch',kind:'switch',rackId:'rack1'},
        {id:'access',name:'ACCESS-01',type:'switch',kind:'switch',rackId:'rack1'}
      ],
      ports:[
        {id:'core-uplink',deviceId:'core',name:'Te1/1',mode:'trunk'},
        {id:'access-uplink',deviceId:'access',name:'Te1/1',mode:'trunk'},
        {id:'access-user',deviceId:'access',name:'Gi1/0/1',mode:'access'}
      ],
      links:[{id:'uplink',fromPortId:'core-uplink',toPortId:'access-uplink'}],
      hosts:[{id:'pc1',name:'PC-01',type:'pc',portRef:'access-user'}],
      telecomOutlets:[],hostOutletConnections:[],patchPanels:[],cableRuns:[],patchConnections:[],
      vlans:[],subnets:[],fwRules:[],visual:{locs:[],assign:{devices:{},hosts:{}},pos:{},view:{px:60,py:50,zoom:1},sel:null}
    });
    window.NetWizardState.replaceProject(p,{source:'e2e-v5-layering'});
    window.navTo('graphs');
  });

  await expect.poll(()=>page.evaluate(()=>window.NetWizardV5RenderState||null)).not.toBeNull();
  const api=await page.evaluate(()=>({
    bridge:window.NetWizardV5?.version,
    core:window.NetWizardV5?.core?.version,
    linked:window.NetWizardV5?.linkedDeviceIds?.('core')||[],
    a:window.NetWizardV5?.linkPortA?.(window.NetWizardState.getSnapshot().links[0]),
    b:window.NetWizardV5?.linkPortB?.(window.NetWizardState.getSnapshot().links[0])
  }));
  expect(api).toEqual({
    bridge:'netwizard-v5-bridge-v1',
    core:'netwizard-v5-core-v1',
    linked:['access'],
    a:'core-uplink',
    b:'access-uplink'
  });
  let state=await page.evaluate(()=>window.NetWizardV5RenderState);
  expect(state.layerOrder).toEqual(['background','base-links','nodes','selected-links']);
  expect(state.baseNetwork).toBe(1);
  expect(state.baseHost).toBe(1);
  expect(state.selectedNetwork).toBe(0);
  expect(state.selectedHost).toBe(0);

  await page.evaluate(()=>window.selectV5('host','pc1'));
  await expect.poll(()=>page.evaluate(()=>window.NetWizardV5RenderState)).toMatchObject({
    selected:{t:'host',id:'pc1'},
    selectedNetwork:1,
    selectedHost:1
  });

  await page.evaluate(()=>window.selectV5('device','access'));
  await expect.poll(()=>page.evaluate(()=>window.NetWizardV5RenderState)).toMatchObject({
    selected:{t:'device',id:'access'},
    selectedNetwork:1,
    selectedHost:1
  });

  await page.evaluate(()=>window.selectV5('device','core'));
  await expect.poll(()=>page.evaluate(()=>window.NetWizardV5RenderState)).toMatchObject({
    selected:{t:'device',id:'core'},
    selectedNetwork:1,
    selectedHost:0
  });
});
