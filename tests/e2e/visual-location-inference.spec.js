const { test, expect } = require('@playwright/test');

async function resetStorage(page){
  await page.goto('/index.html');
  await page.evaluate(()=>{ localStorage.clear(); sessionStorage.clear(); });
  await page.reload();
}

test('un proyecto importado sin visual.assign infiere CPD por rack y oficina por toma', async ({page})=>{
  await resetStorage(page);
  await page.evaluate(()=>{
    const p=window.NetWizardState.getSnapshot();
    Object.assign(p,{
      projName:'Legacy visual inference',
      physicalLocations:[
        {id:'legacy-core',name:'Core / Perímetro',type:'zone',notes:'Sincronizada desde Vista V5'},
        {id:'legacy-access',name:'Acceso / Usuarios',type:'zone',notes:'Sincronizada desde Vista V5'},
        {id:'legacy-services',name:'Servicios',type:'zone',notes:'Sincronizada desde Vista V5'},
        {id:'site1',name:'Sede 1',type:'site'},
        {id:'cpd1',name:'Sede 1 · CPD',type:'room',parentId:'site1'},
        {id:'office1',name:'Sede 1 · Oficina',type:'room',parentId:'site1'}
      ],
      hostPhysicalLocations:['Core / Perímetro','Acceso / Usuarios','Servicios'],
      racks:[{id:'rack1',name:'Rack 1',locationId:'cpd1',rackUnits:24}],
      devices:[{id:'sw1',name:'SW-01',type:'switch',kind:'switch',rackId:'rack1'}],
      ports:[{id:'p1',deviceId:'sw1',name:'Gi1/0/1',mode:'access'}],
      hosts:[{id:'h1',name:'PC-01',type:'pc',portRef:'p1'}],
      telecomOutlets:[{id:'to1',locationId:'office1',name:'TO-01',portCount:1}],
      hostOutletConnections:[{id:'hc1',hostId:'h1',outletId:'to1',outletPort:1}],
      patchPanels:[],cableRuns:[],patchConnections:[],links:[],vlans:[],subnets:[],fwRules:[],
      visual:{
        locs:[
          {id:'v-core',name:'Core / Perímetro',type:'zone',physicalLocationId:'legacy-core',x:20,y:20},
          {id:'v-access',name:'Acceso / Usuarios',type:'zone',physicalLocationId:'legacy-access',x:400,y:20},
          {id:'v-services',name:'Servicios',type:'zone',physicalLocationId:'legacy-services',x:780,y:20}
        ],
        assign:{devices:{sw1:'v-access'},hosts:{h1:'v-access'}},pos:{},view:{px:60,py:50,zoom:1},sel:null
      }
    });
    window.NetWizardState.replaceProject(p,{source:'e2e-legacy-visual'});
    if(window.navTo)window.navTo('dev');
  });

  await expect.poll(()=>page.evaluate(()=>{
    const p=window.NetWizardState.getSnapshot();
    return {
      locs:(p.visual?.locs||[]).map(x=>({id:x.id,name:x.name,physicalLocationId:x.physicalLocationId})),
      device:p.visual?.assign?.devices?.sw1||'',
      host:p.visual?.assign?.hosts?.h1||''
    };
  })).toMatchObject({
    locs:expect.arrayContaining([
      expect.objectContaining({name:'Sede 1 · CPD',physicalLocationId:'cpd1'}),
      expect.objectContaining({name:'Sede 1 · Oficina',physicalLocationId:'office1'})
    ])
  });

  const state=await page.evaluate(()=>window.NetWizardState.getSnapshot());
  expect(state.visual.locs.some(x=>['Core / Perímetro','Acceso / Usuarios','Servicios'].includes(x.name))).toBe(false);
  expect(state.visual.locs.some(x=>x.physicalLocationId==='site1'||x.name==='Sede 1')).toBe(false);
  expect(state.physicalLocations.some(x=>['Core / Perímetro','Acceso / Usuarios','Servicios'].includes(x.name))).toBe(false);
  const cpd=state.visual.locs.find(x=>x.physicalLocationId==='cpd1');
  const office=state.visual.locs.find(x=>x.physicalLocationId==='office1');
  expect(cpd).toBeTruthy();
  expect(office).toBeTruthy();
  expect(state.visual.assign.devices.sw1).toBe(cpd.id);
  expect(state.visual.assign.hosts.h1).toBe(office.id);
});
