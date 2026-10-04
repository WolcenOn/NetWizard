const { test, expect } = require('@playwright/test');

async function resetStorage(page){
  await page.goto('/index.html');
  await page.evaluate(()=>{localStorage.clear();sessionStorage.clear();localStorage.setItem('nw_locale_v1','es');});
  await page.reload();
}

test('subnetting rápido previsualiza y solo completa VLANs sin subnet', async ({page})=>{
  const errors=[];page.on('pageerror',err=>errors.push(err.message));
  await resetStorage(page);
  await expect.poll(()=>page.evaluate(()=>typeof window.NetWizardPlanner?.buildFixedSubnetPlan==='function')).toBe(true);

  await page.evaluate(()=>{
    const p=window.NetWizardState.getSnapshot();
    Object.assign(p,{
      projName:'E2E Subnetting',
      vlans:[
        {id:'v10',vlanId:10,name:'Usuarios',color:'#3b82f6'},
        {id:'v20',vlanId:20,name:'Servidores',color:'#10b981'}
      ],
      subnets:[{id:'sn10',vlanRef:'v10',cidr:'10.10.0.0/24',gateway:'10.10.0.1'}],
      hosts:[],ports:[],links:[]
    });
    window.NetWizardState.replaceProject(p,{source:'e2e-subnetting'});
    window.navTo('vlan');
  });

  await expect(page.getByText('Subnet canónica por VLAN')).toBeVisible();
  await expect(page.getByText('Asignación rápida conservadora')).toBeVisible();
  await page.locator('#aBase').fill('10.10.0.0/16');
  await page.locator('#aSize').selectOption('24');
  await page.locator('#aGw').selectOption('first');
  await page.locator('#btnAutoSnPreview').click();

  await expect(page.locator('#aSnOut')).toContainText('VLAN 20');
  await expect(page.locator('#aSnOut')).toContainText('10.10.1.0/24');
  await expect(page.locator('#aSnOut')).not.toContainText('Cambiar · Subnet · VLAN 10');

  page.once('dialog',dialog=>dialog.accept());
  await page.locator('#btnAutoSn').click();

  await expect.poll(()=>page.evaluate(()=>{
    const p=window.NetWizardState.getSnapshot();
    return p.subnets.map(x=>({id:x.id,vlanRef:x.vlanRef,cidr:x.cidr,gateway:x.gateway})).sort((a,b)=>a.vlanRef.localeCompare(b.vlanRef));
  })).toEqual([
    {id:'sn10',vlanRef:'v10',cidr:'10.10.0.0/24',gateway:'10.10.0.1'},
    {id:expect.any(String),vlanRef:'v20',cidr:'10.10.1.0/24',gateway:'10.10.1.1'}
  ]);

  await expect(page.getByText('Planificador VLSM · replanificación revisable')).toBeVisible();
  await expect(page.locator('#pg-vlan')).toContainText('S.subnets sigue siendo la única fuente canónica');
  expect(errors).toEqual([]);
});


test('asistente reutiliza el planificador común para las subnets del escenario', async ({page})=>{
  const errors=[];page.on('pageerror',err=>errors.push(err.message));
  await resetStorage(page);
  await expect.poll(()=>page.evaluate(()=>typeof window.NetWizardPlanner?.applySubnetPlan==='function')).toBe(true);

  await page.evaluate(()=>window.navTo('wiz'));
  await page.locator('[data-sc="home"]').click();
  await expect(page.locator('#wModeCard')).toBeVisible();
  await page.locator('#wNewScenario').click();
  await expect(page.locator('#wStep2Card')).toBeVisible();
  await page.locator('#wNext2').click();
  await expect(page.locator('#wStep3Card')).toBeVisible();
  await page.locator('#wBase').fill('10.77.0.0/16');
  await page.locator('#wSize').selectOption('24');

  page.once('dialog',dialog=>dialog.accept());
  await page.locator('#wApply').click();

  await expect.poll(()=>page.evaluate(()=>{
    const p=window.NetWizardState.getSnapshot();
    return p.vlans.map(v=>({
      vlanId:v.vlanId,
      cidr:p.subnets.find(s=>s.vlanRef===v.id)?.cidr||''
    })).sort((a,b)=>a.vlanId-b.vlanId);
  })).toEqual([
    {vlanId:10,cidr:'10.77.0.0/24'},
    {vlanId:20,cidr:'10.77.1.0/24'},
    {vlanId:99,cidr:'10.77.2.0/24'}
  ]);
  expect(errors).toEqual([]);
});
