const { test, expect } = require('@playwright/test');

async function resetStorage(page){
  await page.goto('/index.html');
  await page.evaluate(()=>{localStorage.clear();sessionStorage.clear();});
  await page.reload();
}

test('HA tiene editor canónico por dispositivo y persiste en el proyecto', async ({page})=>{
  const errors=[];page.on('pageerror',err=>errors.push(err.message));
  await resetStorage(page);

  await page.evaluate(()=>{
    const p=window.NetWizardState.getSnapshot();
    Object.assign(p,{
      workflow:{mode:'design'},
      devices:[{id:'r1',name:'RTR-EDGE',type:'router',kind:'router',vendorOs:'cisco_ios'}],
      ports:[{id:'p-wan',deviceId:'r1',name:'GigabitEthernet0/0',mode:'routed',role:'wan'}],
      vlans:[],subnets:[],hosts:[],links:[],fwRules:[],
      highAvailability:{},management:{},accessSecurity:{},linkAggregations:[]
    });
    window.NetWizardState.replaceProject(p,{source:'e2e-ha-editor'});
  });

  await page.evaluate(()=>window.navTo('dev'));
  await expect(page.locator('#nwHaServicesEditorCard')).toBeVisible();
  await page.locator('#haDevice').selectOption('r1');

  await page.locator('#haRelayServers').fill('10.0.0.10,10.0.0.11');
  await page.locator('#haSaveRelays').click();

  await page.locator('#haRouteNextHop').fill('203.0.113.1');
  await page.locator('#haRouteDistance').fill('10');
  await page.locator('#haRouteTrack').fill('1');
  await page.locator('#haRouteDesc').fill('ISP principal');
  await page.locator('#haAddRoute').click();

  await page.locator('#haProbeTarget').fill('1.1.1.1');
  await page.locator('#haProbeSource').fill('GigabitEthernet0/0');
  await page.locator('#haProbeFrequency').fill('5');
  await page.locator('#haProbeTimeout').fill('1000');
  await page.locator('#haAddProbe').click();

  await page.locator('#haFhrpProtocol').selectOption('hsrp');
  await page.locator('#haFhrpGroup').fill('10');
  await page.locator('#haFhrpInterface').fill('GigabitEthernet0/1.10');
  await page.locator('#haFhrpVip').fill('10.10.10.254');
  await page.locator('#haFhrpPriority').fill('110');
  await page.locator('#haFhrpTrackIf').fill('GigabitEthernet0/0');
  await page.locator('#haFhrpDecrement').fill('20');
  await page.locator('#haAddFhrp').click();

  const ha=await page.evaluate(()=>window.NetWizardState.getSnapshot().highAvailability.devices.r1);
  expect(ha.dhcpRelayServers).toEqual(['10.0.0.10','10.0.0.11']);
  expect(ha.defaultRoutes).toHaveLength(1);
  expect(ha.defaultRoutes[0]).toMatchObject({nextHop:'203.0.113.1',distance:10,trackId:'1'});
  expect(ha.tracking).toHaveLength(1);
  expect(ha.tracking[0]).toMatchObject({id:'1',target:'1.1.1.1',sourceInterface:'GigabitEthernet0/0',frequency:5,timeout:1000});
  expect(ha.firstHopGroups).toHaveLength(1);
  expect(ha.firstHopGroups[0]).toMatchObject({
    protocol:'hsrp',group:10,interfaceName:'GigabitEthernet0/1.10',
    virtualIp:'10.10.10.254',priority:110,preempt:true,
    trackInterface:'GigabitEthernet0/0',decrement:20
  });


  expect(errors).toEqual([]);
});
