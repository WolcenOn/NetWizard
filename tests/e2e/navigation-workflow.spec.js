const { test, expect } = require('@playwright/test');

async function resetStorage(page){
  await page.goto('/index.html');
  await page.evaluate(()=>{localStorage.clear();sessionStorage.clear();});
  await page.reload();
}

test('navegación de inventario omite wizard y respeta dependencias físicas', async ({page})=>{
  const errors=[];page.on('pageerror',err=>errors.push(err.message));
  await resetStorage(page);

  await page.evaluate(()=>{
    const p=window.NetWizardState.getSnapshot();
    Object.assign(p,{
      workflow:{mode:'inventory'},
      step:'loc',
      physicalLocations:[{id:'loc1',name:'CPD',type:'room'}],
      racks:[{id:'rack1',name:'RACK-01',locationId:'loc1',rackUnits:24}],
      rackItems:[],
      devices:[{id:'sw1',name:'SW-01',type:'switch',kind:'switch',vendorOs:'cisco_ios'}],
      ports:[],pdus:[],powerConnections:[],patchPanels:[],telecomOutlets:[],cableRuns:[],patchConnections:[],hostOutletConnections:[],
      vlans:[],subnets:[],hosts:[],links:[],fwRules:[]
    });
    window.NetWizardState.replaceProject(p,{source:'e2e-navigation-inventory'});
  });

  await expect(page.locator('.sb-it[data-step="wiz"]')).toBeHidden();
  await expect(page.locator('#pg-loc')).toHaveClass(/on/);

  await page.locator('#nextBtn').click();
  await expect(page.locator('#pg-dev')).toHaveClass(/on/);

  await page.locator('#nextBtn').click();
  await expect(page.locator('#pg-physical')).toHaveClass(/on/);

  const steps=page.locator('[data-inventory-step]');
  await expect(steps.nth(1)).toContainText('Racks contenedores');
  await expect(steps.nth(2)).toContainText('Equipos');
  await expect(steps.nth(3)).toContainText('Colocación y alimentación');
  await expect(steps.nth(3)).not.toContainText('✓');

  expect(errors).toEqual([]);
});

test('panel y sidebar usan los mismos contadores canónicos', async ({page})=>{
  const errors=[];page.on('pageerror',err=>errors.push(err.message));
  await resetStorage(page);

  await page.evaluate(()=>{
    const p=window.NetWizardState.getSnapshot();
    Object.assign(p,{
      workflow:{mode:'design'},
      step:'dash',
      devices:[
        {id:'d1',name:'R1',type:'router',kind:'router',vendorOs:'cisco_ios'},
        {id:'d2',name:'SW1',type:'switch',kind:'switch',vendorOs:'cisco_ios'}
      ],
      vlans:[{id:'v10',vlanId:10,name:'Users'}],
      hosts:[
        {id:'h1',name:'PC1',type:'pc',vlanRef:'v10',ipMode:'dhcp'},
        {id:'h2',name:'PC2',type:'pc',vlanRef:'v10',ipMode:'dhcp'},
        {id:'h3',name:'PC3',type:'pc',vlanRef:'v10',ipMode:'dhcp'}
      ],
      fwRules:[{id:'f1',name:'Allow DNS',enabled:true}],
      iot:{
        accessNodes:[{id:'a1',name:'GW1',type:'gateway'}],
        devices:[{id:'i1',name:'Sensor1',type:'sensor'}],
        map:{show:{}}
      }
    });
    window.NetWizardState.replaceProject(p,{source:'e2e-navigation-counts'});
  });

  await expect(page.locator('#sbD')).toContainText('2 dispositivos');
  await expect(page.locator('#sbV')).toContainText('1 VLANs');
  await expect(page.locator('#sbH')).toContainText('3 hosts');
  await expect(page.locator('#sbIOT')).toContainText('2 IoT');
  await expect(page.locator('#sbFW')).toContainText('1 reglas FW');

  const stats=page.locator('#dStats .stat');
  await expect(stats.nth(0)).toContainText('2');
  await expect(stats.nth(0)).toContainText('Dispositivos');
  await expect(stats.nth(1)).toContainText('1');
  await expect(stats.nth(1)).toContainText('VLANs');
  await expect(stats.nth(2)).toContainText('3');
  await expect(stats.nth(2)).toContainText('Hosts');
  await expect(stats.nth(3)).toContainText('1');
  await expect(stats.nth(3)).toContainText('Reglas FW');

  expect(errors).toEqual([]);
});
