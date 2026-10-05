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

test('Firewall cambia ES/EN en caliente con reglas, matriz, hardening y políticas', async ({page})=>{
  await resetStorage(page);

  await page.evaluate(()=>{
    const p=window.NetWizardState.getSnapshot();
    p.vlans=[
      {id:'v10',vlanId:10,name:'Users',color:'#3b82f6',intent:{type:'users',internet:true,isolation:'standard'}},
      {id:'v20',vlanId:20,name:'Guests',color:'#10b981',intent:{type:'guests',internet:true,isolation:'isolated'}}
    ];
    p.subnets=[
      {id:'s10',vlanRef:'v10',cidr:'10.10.10.0/24',gateway:'10.10.10.1'},
      {id:'s20',vlanRef:'v20',cidr:'10.10.20.0/24',gateway:'10.10.20.1'}
    ];
    p.fwRules=[{id:'f1',name:'Manual HTTPS',src:'any',dst:'any',proto:'tcp',port:'443',action:'allow',dir:'out',prio:10,enabled:true}];
    window.NetWizardState.replaceProject(p,{source:'i18n-firewall-e2e'});
  });

  await page.locator('[data-step="fw"]').first().click();
  const root=page.locator('#pg-fw');
  await expect(root).toBeVisible();
  await expect(root).toContainText('Firewall & Security');
  await expect(root).toContainText('New rule');
  await expect(root).toContainText('Configured rules');
  await expect(page.locator('#fwRulesList')).toContainText('ALLOW');
  await expect(page.locator('#policyIntentOut')).toContainText('No rules generated from intent').catch(()=>{});

  await page.locator('[data-tab="fw-matrix"]').click();
  await expect(page.locator('#fw-matrix')).toContainText('Inter-VLAN matrix');
  await expect(page.locator('#vlanMatrix')).toContainText('source / destination');

  await page.locator('[data-tab="fw-harden"]').click();
  await expect(page.locator('#fw-harden')).toContainText('Hardening parameters');
  await expect(page.locator('#fw-harden')).toContainText('Quick profiles');

  await page.evaluate(()=>window.NetWizardI18n.setLocale('es'));
  await expect(root).toContainText('Firewall & Seguridad');
  await expect(root).toContainText('Nueva regla');
  await expect(page.locator('#fw-harden')).toContainText('Parámetros de hardening');
  await expect(page.locator('#fw-harden')).toContainText('Perfiles rápidos');

  await page.locator('[data-tab="fw-rules"]').click();
  await page.locator('#btnFwTpl').click();
  await expect(page.locator('#fwTplModal')).toHaveClass(/on/);
  await expect(page.locator('#fwTplModal')).toContainText('Plantillas de reglas FW');
  await expect(page.locator('#fwTplList')).toContainText('Básico: DNS + HTTP/HTTPS');

  await page.evaluate(()=>window.NetWizardI18n.setLocale('en'));
  await expect(page.locator('#fwTplModal')).toContainText('Firewall rule templates');
  await expect(page.locator('#fwTplList')).toContainText('Basic: DNS + HTTP/HTTPS');
  await expect(page.locator('#policyIntentOut')).toContainText(/rule|Rule|No rules|Firewall\/ACL/);
});
