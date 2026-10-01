const { test, expect } = require('@playwright/test');

async function resetStorage(page){
  await page.goto('/index.html');
  await page.evaluate(()=>{localStorage.clear();sessionStorage.clear();});
  await page.reload();
}

test('VPN site-to-site persiste To-Be con alias y evidencia Observed separada', async ({page})=>{
  const errors=[];page.on('pageerror',err=>errors.push(err.message));
  await resetStorage(page);
  await page.evaluate(()=>{
    const p=window.NetWizardState.getSnapshot();
    Object.assign(p,{
      devices:[
        {id:'r1',name:'RTR-HQ',type:'router',kind:'router',vendorOs:'cisco_ios'},
        {id:'r2',name:'RTR-NORTE',type:'router',kind:'router',vendorOs:'cisco_ios'}
      ],
      ports:[
        {id:'r1-wan',deviceId:'r1',name:'GigabitEthernet0/0',mode:'routed',role:'wan',l3Ip:'203.0.113.2',l3Cidr:'203.0.113.2/30'},
        {id:'r2-wan',deviceId:'r2',name:'GigabitEthernet0/0',mode:'routed',role:'wan',l3Ip:'198.51.100.2',l3Cidr:'198.51.100.2/30'}
      ],
      wanCircuits:[
        {id:'c1',name:'HQ Internet',deviceId:'r1',portId:'r1-wan',provider:'ISP-A',role:'primary',enabled:true,bandwidthDownMbps:500,bandwidthUpMbps:200},
        {id:'c2',name:'Norte Internet',deviceId:'r2',portId:'r2-wan',provider:'ISP-B',role:'primary',enabled:true,bandwidthDownMbps:300,bandwidthUpMbps:100}
      ],
      vlans:[{id:'v10',vlanId:10,name:'HQ'},{id:'v20',vlanId:20,name:'Norte'}],
      subnets:[
        {id:'s1',vlanRef:'v10',cidr:'10.10.0.0/24',gateway:'10.10.0.1',gatewayDeviceRef:'r1'},
        {id:'s2',vlanRef:'v20',cidr:'10.20.0.0/24',gateway:'10.20.0.1',gatewayDeviceRef:'r2'}
      ],
      links:[],hosts:[],fwRules:[],routing:{strategy:'static'},observedState:null
    });
    window.NetWizardState.replaceProject(p,{source:'e2e-site-to-site-vpn'});
  });

  await page.evaluate(()=>window.navTo('links'));
  await expect(page.locator('#nwSiteToSiteVpnEditor')).toBeVisible();

  await page.locator('#nwVpnName').fill('HQ ↔ NORTE');
  await page.locator('#nwVpnLocalDevice').selectOption('r1');
  await page.locator('#nwVpnLocalCircuit').selectOption('c1');
  await page.locator('#nwVpnRemoteDevice').selectOption('r2');
  await page.locator('#nwVpnRemoteCircuit').selectOption('c2');
  await page.locator('#nwVpnLocalPrefixes').fill('10.10.0.0/24');
  await page.locator('#nwVpnRemotePrefixes').fill('10.20.0.0/24');
  await page.locator('#nwVpnSecretAlias').fill('VPN_HQ_NORTE_PSK');
  await page.locator('#nwVpnSave').click();

  const saved=await page.evaluate(()=>{
    const p=window.NetWizardState.getSnapshot();
    return p.routing.siteToSiteVpns[0];
  });
  expect(saved).toMatchObject({
    name:'HQ ↔ NORTE',localDeviceId:'r1',remoteDeviceId:'r2',
    localCircuitRef:'c1',remoteCircuitRef:'c2',
    localPrefixes:['10.10.0.0/24'],remotePrefixes:['10.20.0.0/24'],
    secretAlias:'VPN_HQ_NORTE_PSK',ikeVersion:'2',encryption:'aes256',integrity:'sha256'
  });
  expect(saved.psk).toBeUndefined();
  expect(saved.preSharedKey).toBeUndefined();

  await expect(page.locator('#nwSiteToSiteVpnList')).toContainText('To-Be: válido');
  await expect(page.locator('#nwSiteToSiteVpnList')).toContainText('Observed: UNKNOWN');
  await page.getByRole('button',{name:'Observed UP'}).click();

  const observed=await page.evaluate(()=>{
    const p=window.NetWizardState.getSnapshot();
    const id=p.routing.siteToSiteVpns[0].id;
    return p.observedState.siteToSiteVpns[id];
  });
  expect(observed).toMatchObject({
    status:'up',localEndpoint:'203.0.113.2',remoteEndpoint:'198.51.100.2',
    phase1:'up',phase2:'up'
  });
  expect(errors).toEqual([]);
});
