const { test, expect } = require('@playwright/test');

async function resetStorage(page){
  await page.goto('/index.html');
  await page.evaluate(()=>{localStorage.clear();sessionStorage.clear();});
  await page.reload();
}

test('tránsito L3 inter-sede crea puertos routed y link canónicos', async ({page})=>{
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
      ports:[],links:[],vlans:[],subnets:[],hosts:[],fwRules:[]
    });
    window.NetWizardState.replaceProject(p,{source:'e2e-inter-site-transit'});
  });

  await page.evaluate(()=>window.navTo('link'));
  await expect(page.locator('#nwInterSiteTransitCard')).toBeVisible();
  await page.locator('#nwTransitDeviceA').selectOption('r1');
  await page.locator('#nwTransitDeviceB').selectOption('r2');
  await page.locator('#nwTransitPortA').fill('GigabitEthernet0/1');
  await page.locator('#nwTransitPortB').fill('GigabitEthernet0/1');
  await page.locator('#nwTransitCidr').fill('10.255.0.0/30');
  await page.locator('#nwTransitIpA').fill('10.255.0.1');
  await page.locator('#nwTransitIpB').fill('10.255.0.2');
  await page.locator('#nwTransitName').fill('CENTRAL ↔ NORTE');
  await page.locator('#nwTransitNotes').fill('MPLS corporativa');
  await page.locator('#nwTransitCreate').click();

  const result=await page.evaluate(()=>{
    const p=window.NetWizardState.getSnapshot();
    return{ports:p.ports,links:p.links};
  });
  expect(result.ports).toHaveLength(2);
  expect(result.ports[0]).toMatchObject({deviceId:'r1',name:'GigabitEthernet0/1',mode:'routed',role:'transit',l3Ip:'10.255.0.1',l3Cidr:'10.255.0.0/30'});
  expect(result.ports[1]).toMatchObject({deviceId:'r2',name:'GigabitEthernet0/1',mode:'routed',role:'transit',l3Ip:'10.255.0.2',l3Cidr:'10.255.0.0/30'});
  expect(result.links).toHaveLength(1);
  expect(result.links[0]).toMatchObject({name:'CENTRAL ↔ NORTE',notes:'MPLS corporativa',medium:'logical',cableType:'provider'});
  expect(result.links[0].aPortId).toBe(result.ports[0].id);
  expect(result.links[0].bPortId).toBe(result.ports[1].id);
  expect(errors).toEqual([]);
});
