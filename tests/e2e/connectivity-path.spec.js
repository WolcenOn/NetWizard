const { test, expect } = require('@playwright/test');

async function resetStorage(page){
  await page.goto('/index.html');
  await page.evaluate(()=>{ localStorage.clear(); sessionStorage.clear(); });
  await page.reload();
}

test('V5 diagnostica una ruta física y diferencia servicios firewall', async ({page})=>{
  await resetStorage(page);

  await page.evaluate(()=>{
    const p=window.NetWizardState.getSnapshot();
    Object.assign(p,{
      projName:'Diagnóstico E2E',
      vlans:[
        {id:'v10',vlanId:10,name:'Usuarios'},
        {id:'v20',vlanId:20,name:'Servidores'}
      ],
      subnets:[
        {id:'sn10',vlanRef:'v10',cidr:'10.0.10.0/24',gateway:'10.0.10.1'},
        {id:'sn20',vlanRef:'v20',cidr:'10.0.20.0/24',gateway:'10.0.20.1'}
      ],
      devices:[
        {id:'sw1',name:'ACCESS-A',type:'switch',kind:'switch'},
        {id:'r1',name:'CORE-RTR',type:'router',kind:'router'},
        {id:'sw2',name:'ACCESS-B',type:'switch',kind:'switch'}
      ],
      ports:[
        {id:'h1p',deviceId:'sw1',name:'Gi1/0/1',mode:'access',accessVlanRef:'v10'},
        {id:'s1u',deviceId:'sw1',name:'Te1/1',mode:'trunk'},
        {id:'r1a',deviceId:'r1',name:'Te0/0',mode:'routed'},
        {id:'r1b',deviceId:'r1',name:'Te0/1',mode:'routed'},
        {id:'s2u',deviceId:'sw2',name:'Te1/1',mode:'trunk'},
        {id:'h2p',deviceId:'sw2',name:'Gi1/0/20',mode:'access',accessVlanRef:'v20'}
      ],
      links:[
        {id:'l1',fromPortId:'s1u',toPortId:'r1a',medium:'fiber'},
        {id:'l2',aPortId:'r1b',bPortId:'s2u',media:'fiber'}
      ],
      hosts:[
        {id:'h1',name:'PC-01',type:'pc',vlanRef:'v10',portRef:'h1p',ipMode:'static',staticIp:'10.0.10.10'},
        {id:'h2',name:'SRV-DNS',type:'server',vlanRef:'v20',portRef:'h2p',ipMode:'static',staticIp:'10.0.20.53'}
      ],
      vlanMatrix:{v10_v20:true},
      fwRules:[
        {id:'fw-dns',name:'Permitir DNS',src:'VLAN 10',dst:'VLAN 20',proto:'udp',port:'53',action:'allow',prio:10,enabled:true},
        {id:'fw-https',name:'Bloquear HTTPS',src:'VLAN 10',dst:'VLAN 20',proto:'tcp',port:'443',action:'deny',prio:20,enabled:true}
      ],
      iot:{accessNodes:[],devices:[],map:{show:{network:true}}},
      physicalLocations:[],
      hostPhysicalLocations:[],
      visual:{locs:[],assign:{devices:{},hosts:{}},pos:{},view:{px:60,py:50,zoom:1},sel:null}
    });
    window.NetWizardState.replaceProject(p,{source:'e2e-connectivity-path'});
    window.navTo('graphs');
  });

  await expect(page.locator('#v5Connectivity')).toBeVisible();
  await page.locator('#v5Connectivity').click();
  await expect(page.locator('#nwV5ConnectivityDrawer')).toBeVisible();
  await expect(page.locator('#nwConnectivityChecker')).toBeVisible();

  await page.locator('#nwConnSrc').selectOption('host:h1');
  await page.locator('#nwConnDst').selectOption('host:h2');
  await page.locator('#nwConnService').selectOption('dns');
  await page.locator('#nwConnRun').click();

  await expect(page.locator('#nwConnResult')).toContainText('CONECTIVIDAD POSIBLE');
  await expect(page.locator('#nwConnResult')).toContainText('CORE-RTR');
  await expect(page.locator('#nwConnResult')).toContainText('Permitir DNS');
  await expect(page.locator('.nw-conn-path')).toBeVisible();

  await page.locator('#nwConnService').selectOption('https');
  await page.locator('#nwConnRun').click();

  await expect(page.locator('#nwConnResult')).toContainText('CONECTIVIDAD NO GARANTIZADA / BLOQUEADA');
  await expect(page.locator('#nwConnResult')).toContainText('Bloquear HTTPS');

  await page.getByRole('button',{name:'✕ Cerrar'}).click();
  await expect(page.locator('#nwV5ConnectivityDrawer')).toBeHidden();
});
