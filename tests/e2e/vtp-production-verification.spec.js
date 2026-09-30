const { test, expect } = require('@playwright/test');

async function resetStorage(page){
  await page.goto('/index.html');
  await page.evaluate(()=>{localStorage.clear();sessionStorage.clear();});
  await page.reload();
}

test('VTP production verification guarda evidencia observada y resuelve readiness', async ({page})=>{
  const errors=[];page.on('pageerror',err=>errors.push(err.message));
  await resetStorage(page);

  await page.evaluate(()=>{
    const p=window.NetWizardState.getSnapshot();
    Object.assign(p,{
      devices:[
        {id:'sw-core',name:'SW-CORE',type:'switch',kind:'switch',vendorOs:'cisco_ios'},
        {id:'sw-access',name:'SW-ACCESS',type:'switch',kind:'switch',vendorOs:'cisco_ios'}
      ],
      ports:[],vlans:[],subnets:[],hosts:[],links:[],fwRules:[],
      vtp:{domain:'EMPRESA',password:'',version:'3',pruning:'yes',roles:{'sw-core':'server','sw-access':'client'}},
      observedState:null
    });
    window.NetWizardState.replaceProject(p,{source:'e2e-vtp-verification'});
  });

  await page.evaluate(()=>window.navTo('vlan'));
  await expect(page.locator('#nwVtpVerificationCard')).toBeVisible();

  await page.locator('#vtpObsDevice').selectOption('sw-core');
  await page.locator('#vtpObsDomain').fill('EMPRESA');
  await page.locator('#vtpObsVersion').selectOption('3');
  await page.locator('#vtpObsMode').selectOption('server');
  await page.locator('#vtpObsRevision').fill('42');
  await page.locator('#vtpObsPrimary').selectOption('yes');
  await page.locator('#vtpObsPrimaryId').fill('0011.2233.4455');
  await page.locator('#vtpObsConflict').selectOption('no');
  await page.locator('#vtpObsDigestErrors').fill('0');
  await page.locator('#vtpObsRevisionErrors').fill('0');
  await page.locator('#vtpObsSave').click();

  await page.locator('#vtpObsDevice').selectOption('sw-access');
  await page.locator('#vtpObsDomain').fill('EMPRESA');
  await page.locator('#vtpObsVersion').selectOption('3');
  await page.locator('#vtpObsMode').selectOption('client');
  await page.locator('#vtpObsRevision').fill('42');
  await page.locator('#vtpObsPrimary').selectOption('no');
  await page.locator('#vtpObsConflict').selectOption('no');
  await page.locator('#vtpObsDigestErrors').fill('0');
  await page.locator('#vtpObsRevisionErrors').fill('0');
  await page.locator('#vtpObsSave').click();

  const result=await page.evaluate(()=>{
    const p=window.NetWizardState.getSnapshot();
    return {
      observed:p.observedState,
      core:window.NetWizardVtpProductionVerification.evaluateDevice(p,'sw-core'),
      access:window.NetWizardVtpProductionVerification.evaluateDevice(p,'sw-access')
    };
  });
  expect(result.observed.vtpDevices['sw-core']).toMatchObject({domain:'EMPRESA',version:'3',mode:'server',revision:42,primary:true,primaryConflict:false,digestErrors:0,revisionErrors:0});
  expect(result.observed.vtpDevices['sw-access']).toMatchObject({domain:'EMPRESA',version:'3',mode:'client',revision:42,primary:false,primaryConflict:false,digestErrors:0,revisionErrors:0});
  expect(result.core.ok).toBe(true);
  expect(result.access.ok).toBe(true);
  expect(errors).toEqual([]);
});
