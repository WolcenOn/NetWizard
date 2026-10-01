const { test, expect } = require('@playwright/test');

async function resetStorage(page){
  await page.goto('/index.html');
  await page.evaluate(()=>{localStorage.clear();sessionStorage.clear();});
  await page.reload();
}

test('routing estático inter-sede persiste por dispositivo en la autoridad routing', async ({page})=>{
  const errors=[];page.on('pageerror',err=>errors.push(err.message));
  await resetStorage(page);
  await page.evaluate(()=>{
    const p=window.NetWizardState.getSnapshot();
    Object.assign(p,{
      workflow:{mode:'design'},
      devices:[
        {id:'r1',name:'RTR-CENTRAL',type:'router',kind:'router',vendorOs:'cisco_ios'},
        {id:'r2',name:'RTR-NORTE',type:'router',kind:'router',vendorOs:'cisco_ios'}
      ],
      ports:[
        {id:'r1-wan',deviceId:'r1',name:'GigabitEthernet0/1',mode:'routed',role:'transit',l3Ip:'10.255.0.1',l3Cidr:'10.255.0.0/30'},
        {id:'r2-wan',deviceId:'r2',name:'GigabitEthernet0/1',mode:'routed',role:'transit',l3Ip:'10.255.0.2',l3Cidr:'10.255.0.0/30'}
      ],
      links:[{id:'l1',aPortId:'r1-wan',bPortId:'r2-wan'}],
      vlans:[],subnets:[],hosts:[],fwRules:[],routing:{}
    });
    window.NetWizardState.replaceProject(p,{source:'e2e-static-routing'});
  });

  await page.evaluate(()=>window.navTo('dev'));
  await expect(page.locator('#nwStaticRoutingCard')).toBeVisible();
  await page.locator('#nwStaticRouteDevice').selectOption('r2');
  await page.locator('#nwStaticRouteDestination').fill('10.64.0.0/25');
  await page.locator('#nwStaticRouteNextHop').fill('10.255.0.1');
  await page.locator('#nwStaticRouteDistance').fill('5');
  await page.locator('#nwStaticRouteDescription').fill('Central vía tránsito corporativo');
  await page.locator('#nwStaticRouteAdd').click();

  const routing=await page.evaluate(()=>window.NetWizardState.getSnapshot().routing);
  expect(routing.strategy).toBe('static');
  expect(routing.staticRoutesByDevice.r2).toHaveLength(1);
  expect(routing.staticRoutesByDevice.r2[0]).toMatchObject({
    destination:'10.64.0.0/25',nextHop:'10.255.0.1',distance:5,description:'Central vía tránsito corporativo'
  });
  await expect(page.locator('#nwStaticRouteStatus')).toContainText('Rutas explícitas válidas');
  expect(errors).toEqual([]);
});
