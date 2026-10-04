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

test('VLAN Subnets RoaS y DHCP cambian ES/EN sin recargar', async ({page})=>{
  await resetStorage(page);

  await page.evaluate(()=>{
    const p=window.NetWizardState.getSnapshot();
    p.vlans=[{id:'v10',vlanId:10,name:'Users',color:'#3b82f6'}];
    p.subnets=[{id:'s10',vlanRef:'v10',cidr:'10.10.10.0/24',gateway:'10.10.10.1'}];
    p.devices=[{id:'r1',name:'RTR-01',kind:'router',type:'router'}];
    p.ports=[{id:'r1-lan',deviceId:'r1',name:'Gi0/1',media:'GE',mode:'routed',role:'lan'}];
    p.hosts=[];
    p.dhcp={'10':{enabled:true,start:'10.10.10.20',end:'10.10.10.100',dns:'8.8.8.8',lease:1}};
    p.roas={gwId:'r1',lanIf:'Gi0/1',natVRef:'v10',wanCidr:'203.0.113.2/30',wanNh:'203.0.113.1'};
    window.NetWizardState.replaceProject(p,{source:'i18n-vlan-e2e'});
  });

  await page.click('[data-step="vlan"]');
  const pageRoot=page.locator('#pg-vlan');
  await expect(pageRoot).toBeVisible();

  await expect(pageRoot).toContainText('New VLAN');
  await expect(pageRoot).toContainText('Canonical subnet per VLAN');
  await expect(pageRoot).toContainText('Conservative quick assignment');
  await expect(pageRoot).toContainText('VLAN and gateway services');
  await expect(pageRoot).toContainText('Apply RoaS');

  const authority=page.locator('#aSnAuthority');
  await expect(authority).toHaveValue('S.subnets · missing only');

  const dhcp=page.locator('#dhcpView');
  await expect(dhcp).toContainText('View DHCP diff');
  await expect(dhcp).toContainText('Propose DHCP pools');
  await expect(dhcp).toContainText('Validate DHCP');
  await expect(dhcp).toContainText('static IPs');
  await expect(dhcp.locator('[data-dh-domain="10"]')).toHaveAttribute('placeholder','example.local');

  await page.evaluate(()=>window.NetWizardI18n.setLocale('es'));

  await expect(pageRoot).toContainText('Nueva VLAN');
  await expect(pageRoot).toContainText('Subnet canónica por VLAN');
  await expect(pageRoot).toContainText('Asignación rápida conservadora');
  await expect(pageRoot).toContainText('Servicios VLAN y gateway');
  await expect(pageRoot).toContainText('Aplicar RoaS');
  await expect(authority).toHaveValue('S.subnets · solo faltantes');
  await expect(dhcp).toContainText('Ver diff DHCP');
  await expect(dhcp).toContainText('Proponer pools DHCP');
  await expect(dhcp).toContainText('Validar DHCP');
  await expect(dhcp).toContainText('IPs estáticas');
  await expect(dhcp.locator('[data-dh-domain="10"]')).toHaveAttribute('placeholder','empresa.local');

  await page.evaluate(()=>window.NetWizardI18n.setLocale('en'));
  await expect(pageRoot).not.toContainText('Asignación rápida conservadora');
  await expect(dhcp).not.toContainText('IPs estáticas');
});
