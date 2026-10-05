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

test('Hosts e IP Map cambian ES/EN en caliente sin recargar', async ({page})=>{
  await resetStorage(page);

  await page.evaluate(()=>{
    const p=window.NetWizardState.getSnapshot();
    p.vlans=[{id:'v10',vlanId:10,name:'Users',color:'#3b82f6'}];
    p.subnets=[{id:'s10',vlanRef:'v10',cidr:'10.10.10.0/24',gateway:'10.10.10.1'}];
    p.devices=[];
    p.ports=[];
    p.hosts=[
      {id:'h1',name:'PC-01',type:'pc',vlanRef:'v10',ipMode:'static',staticIp:'10.10.10.20',mac:null,portRef:null,notes:null,physicalLocation:'Desk 1',connectedDeviceId:null,portAssignMode:'auto'},
      {id:'h2',name:'SRV-01',type:'server',vlanRef:'v10',ipMode:'dhcp',staticIp:null,mac:null,portRef:null,notes:null,physicalLocation:'Rack A',connectedDeviceId:null,portAssignMode:'auto'}
    ];
    window.NetWizardState.replaceProject(p,{source:'i18n-hosts-e2e'});
  });

  await page.click('[data-step="hosts"]');
  const root=page.locator('#pg-hosts');
  await expect(root).toBeVisible();
  await expect(root).toContainText('New host');
  await expect(root).toContainText('IP Map by VLAN');
  await expect(page.locator('#hUseHint')).toHaveValue('Server/AP/appliance · vendor generation');
  await expect(page.locator('#hostsList')).toContainText('Location');
  await expect(page.locator('#hostsList')).toContainText('Connection');
  await expect(page.locator('#hostsList')).toContainText('Server');

  await page.locator('#ipMapPanel').evaluate(el=>{el.open=true;});
  await page.evaluate(()=>window.NetWizardI18n.setLocale('es'));

  await expect(root).toContainText('Nuevo host');
  await expect(root).toContainText('Mapa IP por VLAN');
  await expect(page.locator('#hUseHint')).toHaveValue('Servidor/AP/appliance · generación vendor');
  await expect(page.locator('#hostsList')).toContainText('Ubicación');
  await expect(page.locator('#hostsList')).toContainText('Conexión');
  await expect(page.locator('#ipMap')).toContainText('disponibles');
  await expect(page.locator('#hNotes')).toHaveAttribute('placeholder','Observaciones, servicio, toma, usuario…');

  await page.evaluate(()=>window.NetWizardI18n.setLocale('en'));
  await expect(root).toContainText('New host');
  await expect(page.locator('#ipMap')).toContainText('available');
  await expect(page.locator('#hNotes')).toHaveAttribute('placeholder','Notes, service, outlet, user…');
});
