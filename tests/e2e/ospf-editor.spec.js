const { test, expect } = require('@playwright/test');

async function resetStorage(page){
  await page.goto('/index.html');
  await page.evaluate(()=>{localStorage.clear();sessionStorage.clear();});
  await page.reload();
}

test('editor OSPF persiste intención por interfaz y evidencia de vecino', async ({page})=>{
  const errors=[];page.on('pageerror',err=>errors.push(err.message));
  await resetStorage(page);
  await page.evaluate(()=>{
    const p=window.NetWizardState.getSnapshot();
    Object.assign(p,{
      devices:[
        {id:'r1',name:'RTR-HQ',type:'router',kind:'router',vendorOs:'cisco_ios'},
        {id:'r2',name:'RTR-BRANCH',type:'router',kind:'router',vendorOs:'cisco_ios'}
      ],
      ports:[
        {id:'r1r2',deviceId:'r1',name:'GigabitEthernet0/0',mode:'routed',role:'transit',l3Ip:'10.255.0.1',l3Cidr:'10.255.0.0/30'},
        {id:'r2r1',deviceId:'r2',name:'GigabitEthernet0/0',mode:'routed',role:'transit',l3Ip:'10.255.0.2',l3Cidr:'10.255.0.0/30'}
      ],
      links:[{id:'l1',aPortId:'r1r2',bPortId:'r2r1'}],
      vlans:[],subnets:[],hosts:[],fwRules:[],routing:{},observedState:null
    });
    window.NetWizardState.replaceProject(p,{source:'e2e-ospf'});
  });

  await page.evaluate(()=>window.navTo('dev'));
  await expect(page.locator('#nwOspfCard')).toBeVisible();

  await page.locator('#nwOspfDevice').selectOption('r1');
  await page.locator('#nwOspfProcessId').fill('10');
  await page.locator('#nwOspfRouterId').fill('1.1.1.1');
  await page.locator('#nwOspfDefaultArea').fill('0');
  await page.locator('[data-ospf-enabled="r1r2"]').check();
  await page.locator('[data-ospf-area="r1r2"]').fill('0');
  await page.locator('[data-ospf-cost="r1r2"]').fill('10');
  await page.locator('#nwOspfSave').click();

  await page.locator('#nwOspfDevice').selectOption('r2');
  await page.locator('#nwOspfProcessId').fill('10');
  await page.locator('#nwOspfRouterId').fill('2.2.2.2');
  await page.locator('#nwOspfDefaultArea').fill('0');
  await page.locator('[data-ospf-enabled="r2r1"]').check();
  await page.locator('[data-ospf-area="r2r1"]').fill('0');
  await page.locator('[data-ospf-cost="r2r1"]').fill('10');
  await page.locator('#nwOspfSave').click();

  await expect(page.locator('#nwOspfNeighbors')).toContainText('RTR-HQ');
  await expect(page.locator('#nwOspfNeighbors')).toContainText('peer router-id 1.1.1.1');
  await page.locator('#nwOspfNeighbors').getByRole('button',{name:'FULL'}).click();

  const snap=await page.evaluate(()=>window.NetWizardState.getSnapshot());
  expect(snap.routing.strategy).toBe('ospf');
  expect(snap.routing.ospf.devices.r1).toMatchObject({processId:10,routerId:'1.1.1.1',defaultArea:'0'});
  expect(snap.routing.ospf.devices.r1.interfaces.r1r2).toMatchObject({enabled:true,area:'0',cost:10});
  expect(snap.routing.ospf.devices.r2.interfaces.r2r1).toMatchObject({enabled:true,area:'0',cost:10});
  expect(snap.observedState.ospfNeighbors.r2[0]).toMatchObject({
    localPortId:'r2r1',peerDeviceId:'r1',peerRouterId:'1.1.1.1',area:'0',state:'full'
  });
  expect(errors).toEqual([]);
});
