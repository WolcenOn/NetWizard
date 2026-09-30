const { test, expect } = require('@playwright/test');

async function resetStorage(page){
  await page.goto('/index.html');
  await page.evaluate(()=>{localStorage.clear();sessionStorage.clear();});
  await page.reload();
}

test('RoaS DHCP y VTP son diseño VLAN y persisten en el modelo canónico', async ({page})=>{
  const errors=[];page.on('pageerror',err=>errors.push(err.message));
  await resetStorage(page);

  await page.evaluate(()=>{
    const p=window.NetWizardState.getSnapshot();
    Object.assign(p,{
      workflow:{mode:'design'},
      devices:[
        {id:'r1',name:'RTR-EDGE',type:'router',kind:'router',vendorOs:'cisco_ios'},
        {id:'sw1',name:'SW-CISCO',type:'switch',kind:'switch',vendorOs:'cisco_ios'},
        {id:'sw2',name:'SW-JUNOS',type:'switch',kind:'switch',vendorOs:'juniper_junos'}
      ],
      ports:[
        {id:'p-r1-lan',deviceId:'r1',name:'GigabitEthernet0/1',media:'GE',mode:'routed',allowedVlans:[]},
        {id:'p-sw1',deviceId:'sw1',name:'GigabitEthernet0/1',media:'GE',mode:'trunk',allowedVlans:[10,20]}
      ],
      vlans:[
        {id:'v10',vlanId:10,name:'Usuarios',color:'#3b82f6'},
        {id:'v20',vlanId:20,name:'Servidores',color:'#10b981'}
      ],
      subnets:[
        {id:'sn10',vlanRef:'v10',cidr:'10.10.10.0/24',gateway:'10.10.10.1'},
        {id:'sn20',vlanRef:'v20',cidr:'10.10.20.0/24',gateway:'10.10.20.1'}
      ],
      hosts:[],links:[],fwRules:[],
      roas:{gwId:null,lanIf:'',natVRef:null,wanCidr:'',wanNh:''},
      dhcp:{},
      vtp:{domain:'',password:'',version:'2',pruning:'no',roles:{}}
    });
    window.NetWizardState.replaceProject(p,{source:'e2e-network-services'});
    window.navTo('vlan');
  });

  await expect(page.locator('#pg-vlan')).toHaveClass(/on/);
  await expect(page.locator('#pg-vlan #btnRoas')).toBeVisible();
  await expect(page.locator('#pg-vlan #dhcpView')).toBeVisible();
  await expect(page.locator('#pg-vlan #btnSaveVtp')).toBeVisible();
  await expect(page.locator('#pg-cfg #btnRoas')).toHaveCount(0);
  await expect(page.locator('#pg-cfg #dhcpView')).toHaveCount(0);
  await expect(page.locator('#pg-cfg #btnSaveVtp')).toHaveCount(0);

  await page.locator('#roasDev').selectOption('r1');
  await page.locator('#roasLanIf').selectOption('GigabitEthernet0/1');
  await page.locator('#roasNatV').selectOption('v10');
  await page.locator('#wanCidr').fill('203.0.113.2/30');
  await page.locator('#wanCidr').blur();
  await page.locator('#wanNh').fill('203.0.113.1');
  await page.locator('#wanNh').blur();
  page.once('dialog',dialog=>dialog.accept());
  await page.locator('#btnRoas').click();

  const roas=await page.evaluate(()=>{
    const p=window.NetWizardState.getSnapshot();
    const port=p.ports.find(x=>x.id==='p-r1-lan');
    return{roas:p.roas,mode:port.mode,allowed:port.allowedVlans};
  });
  expect(roas.roas).toMatchObject({
    gwId:'r1',lanIf:'GigabitEthernet0/1',natVRef:'v10',
    wanCidr:'203.0.113.2/30',wanNh:'203.0.113.1'
  });
  expect(roas.mode).toBe('trunk');
  expect(roas.allowed).toEqual([10,20]);

  await page.locator('[data-en="10"]').selectOption('1');
  await page.locator('[data-dh-start="10"]').fill('10.10.10.50');
  await page.locator('[data-dh-start="10"]').blur();
  await page.locator('[data-dh-end="10"]').fill('10.10.10.199');
  await page.locator('[data-dh-end="10"]').blur();
  await page.locator('[data-dns="10"]').fill('10.10.20.53,1.1.1.1');
  await page.locator('[data-dns="10"]').blur();
  await page.locator('[data-dh-domain="10"]').fill('empresa.test');
  await page.locator('[data-dh-domain="10"]').blur();
  await page.locator('[data-ls="10"]').fill('7');
  await page.locator('[data-ls="10"]').blur();

  const dhcp=await page.evaluate(()=>window.NetWizardState.getSnapshot().dhcp['10']);
  expect(dhcp.enabled).toBe(true);
  expect(dhcp.start).toBe('10.10.10.50');
  expect(dhcp.end).toBe('10.10.10.199');
  expect(dhcp.dns).toBe('10.10.20.53,1.1.1.1');
  expect(dhcp.domain).toBe('empresa.test');
  expect(dhcp.lease).toBe(7);

  await expect(page.locator('[data-vtprole="sw1"]')).toHaveCount(1);
  await expect(page.locator('[data-vtprole="sw2"]')).toHaveCount(0);
  await page.locator('#vtpDomain').fill('EMPRESA');
  await page.locator('#vtpPassword').fill('vtp-secret');
  await page.locator('#vtpVersion').selectOption('3');
  await page.locator('#vtpPruning').selectOption('yes');
  await page.locator('[data-vtprole="sw1"]').selectOption('server');
  page.once('dialog',dialog=>dialog.accept());
  await page.locator('#btnSaveVtp').click();

  const vtp=await page.evaluate(()=>window.NetWizardState.getSnapshot().vtp);
  expect(vtp).toMatchObject({
    domain:'EMPRESA',
    password:'vtp-secret',
    version:'3',
    pruning:'yes',
    roles:{sw1:'server'}
  });
  expect(vtp.roles.sw2).toBeUndefined();

  await page.locator('.sb-it[data-step="cfg"]').click();
  await expect(page.locator('#pg-cfg')).toHaveClass(/on/);
  await expect(page.locator('#cfgGenerateServer')).toBeVisible();
  await expect(page.locator('#expDeploymentPackage')).toBeVisible();
  await expect(page.locator('#pg-cfg')).not.toContainText('Router-on-a-Stick');
  await expect(page.locator('#pg-cfg')).not.toContainText('DHCP por VLAN');
  await expect(page.locator('#pg-cfg')).not.toContainText('VTP (Cisco IOS)');

  expect(errors).toEqual([]);
});
