const { test, expect } = require('@playwright/test');

async function reset(page){
  await page.goto('/index.html');
  await page.evaluate(()=>{localStorage.clear();sessionStorage.clear();});
  await page.reload();
}

function largeProject(){
  const devices=[];
  const ports=[];
  const vlans=[];
  const subnets=[];
  const hosts=[];
  const links=[];
  for(let v=1;v<=40;v++){
    vlans.push({id:`v${v}`,vlanId:v,name:`VLAN-${v}`,color:'#3b82f6'});
    subnets.push({id:`s${v}`,vlanRef:`v${v}`,cidr:`10.${v}.0.0/24`,gateway:`10.${v}.0.1`});
  }
  for(let d=1;d<=20;d++){
    const deviceId=`sw${d}`;
    devices.push({id:deviceId,name:`SW-${d}`,type:'switch',kind:'switch',vendorOs:'cisco_ios'});
    for(let p=1;p<=48;p++){
      ports.push({
        id:`${deviceId}-p${p}`,deviceId,name:`Gi0/${p}`,mode:'access',
        accessVlanRef:`v${((d+p)%40)+1}`,position:p,media:'GE'
      });
    }
  }
  for(let h=1;h<=800;h++){
    const d=((h-1)%20)+1,p=((h-1)%48)+1,v=((h-1)%40)+1;
    hosts.push({
      id:`h${h}`,name:`HOST-${String(h).padStart(4,'0')}`,type:'pc',
      vlanRef:`v${v}`,ipMode:'dhcp',portRef:`sw${d}-p${p}`,physicalLocation:`Zona ${d}`
    });
  }
  for(let i=1;i<=300;i++){
    const da=((i-1)%20)+1,db=(i%20)+1;
    const pa=((i-1)%48)+1,pb=(i%48)+1;
    links.push({
      id:`l${i}`,aPortId:`sw${da}-p${pa}`,bPortId:`sw${db}-p${pb}`,
      notes:`Link ${i}`
    });
  }
  return {
    format:'netwizard-project',schemaVersion:'3.50.0',
    project:{
      projName:'Large Rendering E2E',
      step:'dash',workflow:{mode:'design'},
      devices,ports,vlans,subnets,hosts,links,
      fwRules:[],vlanMatrix:{},dhcp:{},
      physicalLocations:[],racks:[],pdus:[],powerConnections:[],
      patchPanels:[],telecomOutlets:[],cableRuns:[],patchConnections:[],hostOutletConnections:[],
      wanCircuits:[],trafficProfiles:[],
      iot:{accessNodes:[],devices:[],map:{show:{}}},
      visual:{locs:[],assign:{devices:{},hosts:{}},pos:{},view:{px:60,py:50,zoom:1},sel:null}
    }
  };
}

test('proyecto grande mantiene DOM acotado en puertos, hosts y enlaces', async ({page})=>{
  await reset(page);
  const payload=largeProject();
  await page.evaluate(payload=>{
    const prepared=window.NetWizardProjectSchema.prepareImport(payload,{defaults:window.defS});
    if(!prepared.ok)throw new Error(prepared.errors.join('\n'));
    window.NetWizardState.replaceProject(prepared.project,{source:'e2e-large-rendering'});
  },payload);

  await page.evaluate(()=>window.navTo('dash'));
  await expect(page.locator('#pg-dash')).toBeVisible();
  const initialHiddenState=await page.evaluate(()=>({
    capability:document.querySelectorAll('#nwCapabilityPanel').length,
    inventoryBridge:document.querySelectorAll('#inventoryToDesignMount').length,
    rack:document.querySelectorAll('#rackPlannerMount').length,
    cabling:document.querySelectorAll('#structuredCablingSection').length
  }));
  await page.waitForTimeout(500);
  const delayedHiddenState=await page.evaluate(()=>({
    capability:document.querySelectorAll('#nwCapabilityPanel').length,
    inventoryBridge:document.querySelectorAll('#inventoryToDesignMount').length,
    rack:document.querySelectorAll('#rackPlannerMount').length,
    cabling:document.querySelectorAll('#structuredCablingSection').length
  }));
  expect(delayedHiddenState).toEqual(initialHiddenState);
  expect(delayedHiddenState.capability).toBe(0);
  expect(delayedHiddenState.inventoryBridge).toBe(0);
  expect(delayedHiddenState.rack).toBe(0);
  expect(delayedHiddenState.cabling).toBe(0);

  await page.evaluate(()=>window.navTo('ports'));
  await expect(page.locator('#pg-ports')).toBeVisible();
  await expect(page.locator('#portsList tbody tr')).toHaveCount(80);
  await expect(page.locator('#portsPageInfo')).toContainText('960 puertos');

  await page.evaluate(()=>window.navTo('hosts'));
  await expect(page.locator('#pg-hosts')).toBeVisible();
  await expect(page.locator('#hostsList tbody tr')).toHaveCount(80);
  await expect(page.locator('#hostsPageInfo')).toContainText('800 resultados');

  await page.evaluate(()=>window.navTo('links'));
  await expect(page.locator('#pg-links')).toBeVisible();
  await expect(page.locator('#linksList tbody tr')).toHaveCount(100);
  await expect(page.locator('#linksPageInfo')).toContainText('300 enlaces');

  await page.locator('#linksNext').click();
  await expect(page.locator('#linksList tbody tr')).toHaveCount(100);

  await page.evaluate(()=>window.navTo('dash'));
  await expect(page.locator('#pg-dash')).toBeVisible();
  await expect(page.locator('#dDevs tbody tr')).toHaveCount(20);
  await expect(page.locator('#dVlans .hrow')).toHaveCount(24);
  expect(await page.locator('#dHosts tbody tr').count()).toBeLessThanOrEqual(60);

  const metrics=await page.evaluate(()=>window.NetWizardRenderMetrics.snapshot());
  expect(metrics.byStep.ports.count).toBeGreaterThan(0);
  expect(metrics.byStep.hosts.count).toBeGreaterThan(0);
  expect(metrics.byStep.links.count).toBeGreaterThan(0);
  expect(metrics.byStep.dash.count).toBeGreaterThan(0);
});
