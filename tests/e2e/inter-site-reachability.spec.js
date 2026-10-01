const { test, expect } = require('@playwright/test');

async function resetStorage(page){
  await page.goto('/index.html');
  await page.evaluate(()=>{localStorage.clear();sessionStorage.clear();});
  await page.reload();
}

test('reachability inter-sede muestra REACHABLE y camino de ida/retorno', async ({page})=>{
  const errors=[];page.on('pageerror',err=>errors.push(err.message));
  await resetStorage(page);
  await page.evaluate(()=>{
    const p=window.NetWizardState.getSnapshot();
    Object.assign(p,{
      routing:{strategy:'static',staticRoutesByDevice:{
        r2:[{id:'rt23',destination:'10.30.0.0/24',nextHop:'10.255.0.1',distance:1}],
        r3:[{id:'rt32',destination:'10.20.0.0/24',nextHop:'10.255.0.5',distance:1}]
      }},
      devices:[
        {id:'r1',name:'RTR-CENTRAL',type:'router',vendorOs:'cisco_ios'},
        {id:'r2',name:'RTR-NORTE',type:'router',vendorOs:'cisco_ios'},
        {id:'r3',name:'RTR-SUR',type:'router',vendorOs:'cisco_ios'}
      ],
      ports:[
        {id:'r1n',deviceId:'r1',name:'Gi0/1',mode:'routed',l3Ip:'10.255.0.1',l3Cidr:'10.255.0.0/30'},
        {id:'r2w',deviceId:'r2',name:'Gi0/1',mode:'routed',l3Ip:'10.255.0.2',l3Cidr:'10.255.0.0/30'},
        {id:'r1s',deviceId:'r1',name:'Gi0/2',mode:'routed',l3Ip:'10.255.0.5',l3Cidr:'10.255.0.4/30'},
        {id:'r3w',deviceId:'r3',name:'Gi0/1',mode:'routed',l3Ip:'10.255.0.6',l3Cidr:'10.255.0.4/30'},
        {id:'r2l',deviceId:'r2',name:'Gi0/0',mode:'routed',l3Ip:'10.20.0.1',l3Cidr:'10.20.0.0/24'},
        {id:'r3l',deviceId:'r3',name:'Gi0/0',mode:'routed',l3Ip:'10.30.0.1',l3Cidr:'10.30.0.0/24'}
      ],
      links:[{id:'ln',aPortId:'r1n',bPortId:'r2w'},{id:'ls',aPortId:'r1s',bPortId:'r3w'}],
      vlans:[{id:'v20',vlanId:20,name:'Norte'},{id:'v30',vlanId:30,name:'Sur'}],
      subnets:[
        {id:'s20',vlanRef:'v20',cidr:'10.20.0.0/24',gateway:'10.20.0.1',gatewayDeviceRef:'r2'},
        {id:'s30',vlanRef:'v30',cidr:'10.30.0.0/24',gateway:'10.30.0.1',gatewayDeviceRef:'r3'}
      ],
      fwRules:[]
    });
    window.NetWizardState.replaceProject(p,{source:'e2e-reachability'});
  });

  await page.evaluate(()=>window.navTo('validate'));
  await expect(page.locator('#nwInterSiteReachabilityPanel')).toBeVisible();
  await page.locator('#nwReachSrc').selectOption('s20');
  await page.locator('#nwReachDst').selectOption('s30');
  await page.locator('#nwReachRun').click();

  await expect(page.locator('#nwReachResult')).toContainText('REACHABLE');
  await expect(page.locator('#nwReachResult')).toContainText('RTR-CENTRAL');
  await expect(page.locator('#nwReachResult')).toContainText('Camino de retorno');
  const result=await page.evaluate(()=>window.NetWizardLastInterSiteReachability);
  expect(result.reachable).toBe(true);
  expect(result.forward.ok).toBe(true);
  expect(result.reverse.ok).toBe(true);
  expect(errors).toEqual([]);
});
