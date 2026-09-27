const { test, expect } = require('@playwright/test');

async function resetStorage(page){
  await page.goto('/index.html');
  await page.evaluate(()=>{localStorage.clear();sessionStorage.clear();});
  await page.reload();
}

test('plan físico detecta movimiento, reconexión eléctrica y recableado en To-Be', async ({page})=>{
  await resetStorage(page);
  page.on('dialog', dialog => dialog.accept());

  await page.evaluate(()=>{
    const p=window.NetWizardState.getSnapshot();
    Object.assign(p,{
      projName:'E2E mantenimiento físico',
      workflow:{mode:'inventory'},
      physicalLocations:[{id:'loc1',name:'CPD',type:'room'}],
      racks:[{id:'rack1',name:'RACK-01',locationId:'loc1',rackUnits:24}],
      rackItems:[{id:'ri1',rackId:'rack1',type:'device',deviceId:'sw1',label:'SW-01',startUnit:18,heightUnits:1,face:'front'}],
      devices:[{id:'sw1',name:'SW-01',type:'switch',kind:'switch',manufacturer:'ACME',model:'X48',modelSource:'manual',rackId:'rack1',rackUnit:18,rackUnits:1}],
      ports:[{id:'p1',deviceId:'sw1',name:'Gi1/0/1',media:'copper',speedMaxMbps:1000,negotiatedSpeedMbps:1000}],
      pdus:[{id:'pdu1',name:'PDU-A',rackId:'rack1',feed:'A',outletCount:8,maxPowerWatts:3680}],
      powerConnections:[{id:'pw1',deviceId:'sw1',pduId:'pdu1',outlet:1,powerSupplyIndex:0,feed:'A'}],
      patchPanels:[{id:'pp1',rackId:'rack1',name:'PP-01',portCount:24,category:'Cat6A'}],
      telecomOutlets:[{id:'to1',locationId:'loc1',name:'TO-01',portCount:1,category:'Cat6A'}],
      cableRuns:[{id:'c1',label:'C-001',patchPanelId:'pp1',patchPort:1,outletId:'to1',outletPort:1,cableType:'Cat6A',lengthM:35,route:'Canal A'}],
      patchConnections:[{id:'pc1',patchPanelId:'pp1',patchPort:1,switchPortId:'p1',patchCordLengthM:1}],
      hostOutletConnections:[],
      hosts:[],links:[],vlans:[],subnets:[],fwRules:[],dhcp:{}
    });
    window.NetWizardState.replaceProject(p,{source:'e2e-physical-intervention-source'});
    window.navTo('physical');
  });

  await page.locator('#inventoryToDesignMount button',{hasText:'Crear Diseño To-Be'}).click();
  await expect.poll(()=>page.evaluate(()=>window.NetWizardState.getSnapshot().workflow.mode)).toBe('design');

  await page.evaluate(()=>{
    const p=window.NetWizardState.getSnapshot();
    p.devices[0].rackUnit=20;
    p.rackItems[0].startUnit=20;
    p.powerConnections[0].outlet=5;
    p.powerConnections[0].feed='B';
    p.cableRuns[0].cableType='Cat6A F/UTP';
    p.cableRuns[0].route='Canal B';
    window.NetWizardState.replaceProject(p,{source:'e2e-physical-intervention-changes'});
    window.navTo('physical');
  });

  const plan=page.locator('#physicalInterventionPlanMount');
  await expect(plan).toBeVisible();
  await expect(plan).toContainText('Plan de intervención física');
  await expect(plan).toContainText('Mover SW-01');
  await expect(plan).toContainText('U18');
  await expect(plan).toContainText('U20');
  await expect(plan).toContainText('Reconectar alimentación');
  await expect(plan).toContainText('toma 1');
  await expect(plan).toContainText('toma 5');
  await expect(plan).toContainText('Sustituir/reencaminar cable');
  await expect(plan).toContainText('Canal B');

  const result=await page.evaluate(()=>window.NetWizardPhysicalInterventionPlan.buildChecklist(window.NetWizardState.getSnapshot()));
  expect(result.ok).toBe(true);
  expect(result.actions.some(x=>x.type==='move-device')).toBe(true);
  expect(result.actions.some(x=>x.type==='reconnect-power')).toBe(true);
  expect(result.actions.some(x=>x.type==='replace-or-reroute-cable')).toBe(true);
});
