const { test, expect } = require('@playwright/test');

async function resetStorage(page){
  await page.goto('/index.html');
  await page.evaluate(()=>{localStorage.clear();sessionStorage.clear();});
  await page.reload();
}

test('resiliencia WAN mantiene tráfico con circuito backup y detecta SPOF de edge', async ({page})=>{
  const errors=[];page.on('pageerror',err=>errors.push(err.message));
  await resetStorage(page);
  await page.evaluate(()=>{
    const p=window.NetWizardState.getSnapshot();
    Object.assign(p,{
      devices:[
        {id:'hq',name:'RTR-HQ',type:'router',kind:'router',vendorOs:'cisco_ios'},
        {id:'br',name:'RTR-BR',type:'router',kind:'router',vendorOs:'cisco_ios'}
      ],
      ports:[
        {id:'hq-w1',deviceId:'hq',name:'GigabitEthernet0/0',mode:'routed',role:'wan',l3Ip:'203.0.113.2',l3Cidr:'203.0.113.2/30'},
        {id:'hq-w2',deviceId:'hq',name:'GigabitEthernet0/1',mode:'routed',role:'wan',l3Ip:'203.0.114.2',l3Cidr:'203.0.114.2/30'},
        {id:'br-w1',deviceId:'br',name:'GigabitEthernet0/0',mode:'routed',role:'wan',l3Ip:'198.51.100.2',l3Cidr:'198.51.100.2/30'},
        {id:'br-w2',deviceId:'br',name:'GigabitEthernet0/1',mode:'routed',role:'wan',l3Ip:'198.51.101.2',l3Cidr:'198.51.101.2/30'}
      ],
      links:[],
      wanCircuits:[
        {id:'hq1',name:'HQ ISP-A',deviceId:'hq',portId:'hq-w1',provider:'ISP-A',role:'primary',siteRef:'HQ',enabled:true,bandwidthDownMbps:500,bandwidthUpMbps:200},
        {id:'hq2',name:'HQ ISP-B',deviceId:'hq',portId:'hq-w2',provider:'ISP-B',role:'backup',siteRef:'HQ',enabled:true,bandwidthDownMbps:300,bandwidthUpMbps:100},
        {id:'br1',name:'BR ISP-A',deviceId:'br',portId:'br-w1',provider:'ISP-A',role:'primary',siteRef:'BR',enabled:true,bandwidthDownMbps:500,bandwidthUpMbps:200},
        {id:'br2',name:'BR ISP-C',deviceId:'br',portId:'br-w2',provider:'ISP-C',role:'backup',siteRef:'BR',enabled:true,bandwidthDownMbps:300,bandwidthUpMbps:100}
      ],
      vlans:[{id:'vhq',vlanId:10,name:'HQ Users'},{id:'vbr',vlanId:20,name:'BR Users'}],
      subnets:[
        {id:'shq',vlanRef:'vhq',cidr:'10.10.0.0/24',gateway:'10.10.0.1',gatewayDeviceRef:'hq'},
        {id:'sbr',vlanRef:'vbr',cidr:'10.20.0.0/24',gateway:'10.20.0.1',gatewayDeviceRef:'br'}
      ],
      fwRules:[],
      routing:{strategy:'static',siteToSiteVpns:[
        {
          id:'vpn1',name:'VPN PRIMARY',enabled:true,role:'primary',priority:10,
          localDeviceId:'hq',remoteDeviceId:'br',localCircuitRef:'hq1',remoteCircuitRef:'br1',
          localPrefixes:['10.10.0.0/24'],remotePrefixes:['10.20.0.0/24'],
          secretAlias:'VPN_PRIMARY',ikeVersion:'2',encryption:'aes256',integrity:'sha256',dhGroup:14,pfsGroup:14,
          ikeLifetimeSeconds:28800,ipsecLifetimeSeconds:3600
        },
        {
          id:'vpn2',name:'VPN BACKUP',enabled:true,role:'backup',priority:20,
          localDeviceId:'hq',remoteDeviceId:'br',localCircuitRef:'hq2',remoteCircuitRef:'br2',
          localPrefixes:['10.10.0.0/24'],remotePrefixes:['10.20.0.0/24'],
          secretAlias:'VPN_BACKUP',ikeVersion:'2',encryption:'aes256',integrity:'sha256',dhGroup:14,pfsGroup:14,
          ikeLifetimeSeconds:28800,ipsecLifetimeSeconds:3600
        }
      ]},
      highAvailability:{devices:{
        hq:{
          defaultRoutes:[
            {nextHop:'203.0.113.1',distance:1,trackId:'1',circuitRef:'hq1'},
            {nextHop:'203.0.114.1',distance:20,circuitRef:'hq2'}
          ],
          tracking:[{id:'1',target:'1.1.1.1',sourceInterface:'GigabitEthernet0/0',circuitRef:'hq1',frequency:5,timeout:1000}]
        },
        br:{
          defaultRoutes:[
            {nextHop:'198.51.100.1',distance:1,trackId:'1',circuitRef:'br1'},
            {nextHop:'198.51.101.1',distance:20,circuitRef:'br2'}
          ],
          tracking:[{id:'1',target:'1.0.0.1',sourceInterface:'GigabitEthernet0/0',circuitRef:'br1',frequency:5,timeout:1000}]
        }
      }},
      observedState:null
    });
    window.NetWizardState.replaceProject(p,{source:'e2e-wan-resilience'});
  });

  await page.evaluate(()=>window.navTo('validate'));
  await expect(page.locator('#nwWanResiliencePanel')).toBeVisible();
  await expect(page.locator('#nwWanResiliencePanel')).toContainText('Diseño: válido');
  await expect(page.locator('#nwWanResiliencePanel')).toContainText('Caída circuito HQ ISP-A');

  const report=await page.evaluate(()=>window.NetWizardLastWanResilienceReport);
  const primaryFailure=report.scenarios.find(s=>s.id==='auto-circuit-hq1');
  const edgeFailure=report.scenarios.find(s=>s.id==='auto-device-hq');
  expect(primaryFailure.lostReachability).toHaveLength(0);
  expect(primaryFailure.survivingReachablePairs).toBe(1);
  expect(edgeFailure.lostReachability).toHaveLength(1);
  expect(report.singlePoints.some(x=>x.scenarioId==='auto-device-hq')).toBe(true);

  await page.evaluate(()=>window.navTo('dev'));
  await expect(page.locator('#haRouteCircuit option[value="hq1"]')).toHaveCount(1);
  await expect(page.locator('#haProbeCircuit option[value="hq1"]')).toHaveCount(1);
  expect(errors).toEqual([]);
});
