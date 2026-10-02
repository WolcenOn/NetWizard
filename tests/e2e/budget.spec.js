const { test, expect } = require('@playwright/test');

async function resetStorage(page){
  await page.goto('/index.html');
  await page.evaluate(()=>{localStorage.clear();sessionStorage.clear();});
  await page.reload();
}

test('BOM y presupuesto persiste pricing por modelo/recurso y servicios', async ({page})=>{
  const errors=[];page.on('pageerror',err=>errors.push(err.message));
  await resetStorage(page);

  await page.evaluate(()=>{
    const p=window.NetWizardState.getSnapshot();
    Object.assign(p,{
      projName:'E2E presupuesto',
      workflow:{mode:'design'},
      devices:[
        {id:'sw1',name:'SW-01',type:'switch',kind:'switch',manufacturer:'Cisco',model:'C9200L',modelSource:'manual'},
        {id:'fw1',name:'FW-01',type:'firewall',kind:'firewall',manufacturer:'Fortinet',model:'FG-80F',modelSource:'manual'}
      ],
      ports:[
        {id:'sw1-p1',deviceId:'sw1',name:'Gi1/0/1',transceiver:'SFP-10G-SR'},
        {id:'fw1-p1',deviceId:'fw1',name:'wan1'}
      ],
      links:[],
      racks:[{id:'rack1',name:'RACK-01',rackUnits:24}],
      rackItems:[],pdus:[],powerConnections:[],
      patchPanels:[],telecomOutlets:[],
      cableRuns:[{id:'cab1',label:'C-001',cableType:'Cat6A',lengthM:50}],
      patchConnections:[],hostOutletConnections:[],
      wanCircuits:[{id:'wan1',name:'Fibra 1G',provider:'ISP-A',deviceId:'fw1',portId:'fw1-p1',enabled:true}],
      vlans:[],subnets:[],hosts:[],fwRules:[],dhcp:{},customDeviceModels:[]
    });
    delete p.budget;
    window.NetWizardState.replaceProject(p,{source:'e2e-budget'});
    window.navTo('physical');
  });

  await page.locator('#budgetSection').evaluate(el=>{el.open=true;el.dispatchEvent(new Event('toggle'));});
  const mount=page.locator('#budgetMount');
  await expect(mount).toBeVisible();
  await expect(mount).toContainText('BOM & Presupuesto');
  await expect(mount).toContainText('Sin precio');

  await page.locator('#budgetTax').fill('21');
  await page.locator('#budgetMargin').fill('20');
  await page.locator('#budgetScope').selectOption('full');
  await page.locator('#budgetSaveSettings').click();

  await page.locator('#budgetLineSelect').selectOption('device:sw1');
  await page.locator('#budgetPriceScope').selectOption('model');
  await page.locator('#budgetUnitCost').fill('1000');
  await page.locator('#budgetUnitPrice').fill('1500');
  await page.locator('#budgetSavePrice').click();

  await page.locator('#budgetLineSelect').selectOption('cableRun:cab1');
  await page.locator('#budgetUnitCost').fill('0.5');
  await page.locator('#budgetUnitPrice').fill('1');
  await page.locator('#budgetSavePrice').click();

  await page.locator('#budgetServiceCategory').selectOption('Mano de obra');
  await page.locator('#budgetServiceDescription').fill('Instalación y puesta en marcha');
  await page.locator('#budgetServiceQuantity').fill('4');
  await page.locator('#budgetServiceUnit').fill('h');
  await page.locator('#budgetServiceCost').fill('30');
  await page.locator('#budgetServicePrice').fill('60');
  await page.locator('#budgetServiceCapexOpex').selectOption('capex');
  await page.locator('#budgetServiceResourceRef').selectOption('device:sw1');
  await page.locator('#budgetAddService').click();

  const state=await page.evaluate(()=>{
    const p=window.NetWizardState.getSnapshot(),r=window.NetWizardBudget.build(p);
    return{
      budget:p.budget,
      report:{
        priced:r.counts.priced,unpriced:r.counts.unpriced,
        oneTimeCost:r.totals.oneTimeCost,oneTimePrice:r.totals.oneTimePrice,
        year1Price:r.totals.year1Price,tax:r.totals.taxAmountYear1,total:r.totals.year1CustomerTotal
      }
    };
  });

  expect(state.budget.version).toBe('netwizard-budget-v1');
  expect(state.budget.currency).toBe('EUR');
  expect(state.budget.taxRatePct).toBe(21);
  expect(state.budget.defaultMarginPct).toBe(20);
  expect(Object.keys(state.budget.modelPricing)).toHaveLength(1);
  expect(state.budget.resourcePricing['cableRun:cab1']).toMatchObject({unitCost:0.5,unitPrice:1});
  expect(state.budget.serviceLines).toHaveLength(1);
  expect(state.budget.serviceLines[0]).toMatchObject({
    category:'Mano de obra',description:'Instalación y puesta en marcha',quantity:4,unit:'h',
    unitCost:30,unitPrice:60,resourceRef:'device:sw1'
  });
  expect(state.report.priced).toBe(3);
  expect(state.report.oneTimeCost).toBe(1145);
  expect(state.report.oneTimePrice).toBe(1790);
  expect(state.report.year1Price).toBe(1790);
  expect(state.report.tax).toBe(375.9);
  expect(state.report.total).toBe(2165.9);

  await expect(mount).toContainText('Instalación y puesta en marcha');
  await expect(mount.getByRole('button',{name:'Presupuesto CSV'})).toBeVisible();
  await expect(mount.getByRole('button',{name:'Presupuesto XLSX'})).toBeVisible();
  expect(errors).toEqual([]);
});
