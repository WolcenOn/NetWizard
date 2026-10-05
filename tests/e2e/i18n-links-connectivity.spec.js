const { test, expect } = require('@playwright/test');

async function resetStorage(page){
  await page.goto('/index.html');
  await page.evaluate(()=>{
    localStorage.clear();
    sessionStorage.clear();
    localStorage.setItem('nw_locale_v1','en');
  });
  await page.reload();
}

test('Links y tránsito inter-site cambian ES/EN en caliente', async ({page})=>{
  await resetStorage(page);

  await page.evaluate(()=>{
    const p=window.NetWizardState.getSnapshot();
    p.devices=[
      {id:'r1',name:'R1',type:'router',kind:'router',vendorOs:'cisco_ios'},
      {id:'r2',name:'R2',type:'router',kind:'router',vendorOs:'cisco_ios'}
    ];
    p.ports=[
      {id:'p1',deviceId:'r1',name:'Gi0/0',media:'GE',mode:'routed',role:'transit',l3Ip:'10.0.0.1',l3Cidr:'10.0.0.0/30'},
      {id:'p2',deviceId:'r2',name:'Gi0/0',media:'GE',mode:'routed',role:'transit',l3Ip:'10.0.0.2',l3Cidr:'10.0.0.0/30'}
    ];
    p.links=[{id:'l1',aPortId:'p1',bPortId:'p2',notes:'WAN A',medium:'fiber',cableType:'om4',lengthM:25,speed:'10G'}];
    window.NetWizardState.replaceProject(p,{source:'i18n-links-e2e'});
  });

  await page.locator('[data-step="links"]').click();
  const root=page.locator('#pg-links');
  await expect(root).toBeVisible();
  await expect(root).toContainText('Create link');
  await expect(root).toContainText('Physical medium');
  await expect(page.locator('#linksPageInfo')).toContainText('1 links');
  await expect(page.locator('#linksList')).toContainText('Cabling');
  await expect(page.locator('#nwInterSiteTransitCard')).toContainText('Inter-site L3 transit');
  await expect(page.locator('#nwInterSiteTransitCard')).toContainText('Create L3 transit');
  await page.locator('#nwTransitPortA').fill('Gi0/9');

  await page.evaluate(()=>window.NetWizardI18n.setLocale('es'));

  await expect(root).toContainText('Crear enlace');
  await expect(root).toContainText('Medio físico');
  await expect(page.locator('#linksPageInfo')).toContainText('1 enlaces');
  await expect(page.locator('#linksList')).toContainText('Cableado');
  await expect(page.locator('#nwInterSiteTransitCard')).toContainText('Tránsito L3 inter-sede');
  await expect(page.locator('#nwInterSiteTransitCard')).toContainText('Crear tránsito L3');
  await expect(page.locator('#nwTransitPortA')).toHaveValue('Gi0/9');
  await expect(page.locator('#lnkNotes')).toHaveAttribute('placeholder','Uplink / WAN…');

  await page.evaluate(()=>window.NetWizardI18n.setLocale('en'));
  await expect(page.locator('#nwTransitDeviceA option').first()).toHaveText('— L3 device —');
});
