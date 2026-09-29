const { test, expect } = require('@playwright/test');

test('proyecto cloud sincroniza revisión y consume deployment plan v2 del Private Engine', async ({page})=>{
  let putBody=null,deploymentBody=null;

  await page.route('**/api/capabilities',async route=>route.fulfill({
    status:200,contentType:'application/json',
    body:JSON.stringify({
      authEnforced:true,
      remoteProjectWrites:true,
      privateRouting:false,
      privateDeploymentPlan:true
    })
  }));
  await page.route('**/api/auth/me',async route=>route.fulfill({
    status:200,contentType:'application/json',
    body:JSON.stringify({displayName:'Cloud Editor',csrfToken:'csrf-deploy-e2e'})
  }));
  await page.route('**/api/projects/prj_deploy',async route=>{
    const method=route.request().method();
    if(method==='GET'){
      return route.fulfill({
        status:200,
        headers:{ETag:'"prj_deploy:4"'},
        contentType:'application/json',
        body:JSON.stringify({
          project:{id:'prj_deploy',workspaceId:'ws1',name:'Cloud Deploy',schemaVersion:'3.50.0',currentVersion:4},
          revision:{projectId:'prj_deploy',version:4,schemaVersion:'3.50.0',snapshot:{
            _schemaVersion:'3.50.0',
            projName:'Cloud Deploy',
            devices:[{id:'r1',name:'RTR-CLOUD',type:'router',kind:'router',vendorOs:'cisco_ios'}],
            ports:[],vlans:[],subnets:[],hosts:[],links:[],
            fwRules:[],dhcp:{},routing:{strategy:'static'},
            management:{},highAvailability:{},accessSecurity:{},linkAggregations:[]
          }}
        })
      });
    }

    putBody=route.request().postDataJSON();
    expect(route.request().headers()['x-netwizard-csrf']).toBe('csrf-deploy-e2e');
    expect(putBody.expectedVersion).toBe(4);
    return route.fulfill({
      status:200,
      headers:{ETag:'"prj_deploy:5"'},
      contentType:'application/json',
      body:JSON.stringify({
        project:{id:'prj_deploy',workspaceId:'ws1',name:'Cloud Deploy',schemaVersion:'3.50.0',currentVersion:5},
        revision:{projectId:'prj_deploy',version:5,schemaVersion:'3.50.0',snapshot:putBody.snapshot}
      })
    });
  });
  await page.route('**/api/projects/prj_deploy/private/deployment-plan',async route=>{
    deploymentBody=route.request().postDataJSON();
    expect(route.request().headers()['x-netwizard-csrf']).toBe('csrf-deploy-e2e');
    return route.fulfill({
      status:200,contentType:'application/json',
      body:JSON.stringify({
        contractVersion:'netwizard-private-deployment-plan-v2',
        generatedAt:'2026-09-28T18:30:00Z',
        ok:true,
        projectName:'Cloud Deploy',
        changeSet:{format:'netwizard-change-set'},
        incrementalPlan:{format:'netwizard-incremental-plan'},
        deploymentPlan:{format:'netwizard-deployment-plan'},
        runbookMarkdown:'# SERVER RUNBOOK\n\n1. Aplicar configuración privada.\n',
        rollbackMarkdown:'# SERVER ROLLBACK\n\n1. Restaurar configuración.\n',
        changeSummaryMarkdown:'# SERVER CHANGE SUMMARY\n',
        incrementalSummaryMarkdown:'# SERVER INCREMENTAL SUMMARY\n',
        postChangeChecklistMarkdown:'# SERVER POST CHANGE\n',
        artifacts:[{
          path:'configs/01-RTR-CLOUD-DEPLOY-EDITED-r1-cisco_ios.cfg',
          content:'! SERVER-ONLY-CONFIG\nhostname RTR-CLOUD-DEPLOY-EDITED\n',
          mime:'text/plain;charset=utf-8'
        },{
          path:'incremental/commands/r1.cfg',
          content:'! SERVER INCREMENTAL COMMANDS\n',
          mime:'text/plain;charset=utf-8'
        }],
        issues:[],
        configSources:{r1:'private'},
        configPaths:{r1:'configs/01-RTR-CLOUD-DEPLOY-EDITED-r1-cisco_ios.cfg'},
        privateConfigContract:'netwizard-private-vendor-config-v1',
        productionReady:true,
        productionStatus:'ready',
        productionGateContract:'netwizard-private-production-gate-v1',
        productionGate:{
          contractVersion:'netwizard-private-production-gate-v1',
          status:'ready',
          ready:true,
          canExport:true,
          counts:{errors:0,warnings:0,info:0,blocking:0,byCategory:{}},
          issues:[]
        },
        productionGateSummaryMarkdown:'✅ Private Production Gate: LISTO\nErrores: 0 · Avisos: 0 · Info: 0\n'
      })
    });
  });

  await page.goto('/index.html?projectId=prj_deploy');
  await expect.poll(
    ()=>page.evaluate(()=>window.NetWizardRemoteProject?.context()?.currentVersion||0),
    {timeout:10000}
  ).toBe(4);

  await page.evaluate(()=>window.navTo('cfg'));

  const card=page.locator('#nwPrivateDeploymentCard');
  await expect(card).toBeVisible();
  await expect(card.locator('#nwPrivateDeploymentContext')).toContainText('versión 4');
  await expect(page.locator('[data-dcfg="r1"]')).toHaveClass(/on/);
  await expect(page.locator('#cfgOut')).toHaveValue(/hostname RTR-CLOUD/);
  await expect(page.locator('#cfgOut')).not.toHaveValue(/SERVER-ONLY-CONFIG/);

  await page.evaluate(()=>{
    const p=window.NetWizardState.getSnapshot();
    p.devices[0].name='RTR-CLOUD-DEPLOY-EDITED';
    window.NetWizardState.replaceProject(p,{source:'e2e-private-deployment-edit'});
  });

  await card.locator('#nwPrivateDeploymentGenerate').click();

  await expect(card.locator('#nwPrivateDeploymentStatus')).toContainText('Deployment plan privado generado');
  await expect(card.locator('#nwPrivateDeploymentStatus')).toContainText('Production Gate: LISTO');
  await expect(card.locator('#nwPrivateDeploymentView')).toContainText('Production Gate');
  await expect(card.locator('#nwPrivateDeploymentOutput')).toHaveValue(/SERVER RUNBOOK/);
  await expect(card.locator('#nwPrivateDeploymentView')).toContainText('configs/01-RTR-CLOUD-DEPLOY-EDITED-r1-cisco_ios.cfg');
  await expect.poll(
    ()=>page.evaluate(()=>window.NetWizardPrivateDeploymentUi?.deviceConfig('r1')?.content||'')
  ).toMatch(/SERVER-ONLY-CONFIG/);
  await expect.poll(
    ()=>page.evaluate(()=>window.NetWizardConfigView?.selectedDeviceId?.()||'')
  ).toBe('r1');
  await expect(page.locator('#cfgOut')).toHaveValue(/SERVER-ONLY-CONFIG/);

  await card.locator('#nwPrivateDeploymentView').selectOption('artifact:0');
  await expect(card.locator('#nwPrivateDeploymentOutput')).toHaveValue(/SERVER-ONLY-CONFIG/);

  expect(putBody.snapshot.devices[0].name).toBe('RTR-CLOUD-DEPLOY-EDITED');
  expect(deploymentBody).toEqual({expectedVersion:5});
  expect(deploymentBody.desiredConfigs).toBeUndefined();
  expect(deploymentBody.configPaths).toBeUndefined();

  const isolation=await page.evaluate(()=>({
    project:window.NetWizardState.getSnapshot(),
    context:window.NetWizardRemoteProject.context()
  }));
  expect(isolation.project.projectId).toBeUndefined();
  expect(isolation.project.currentVersion).toBeUndefined();
  expect(isolation.project.runbookMarkdown).toBeUndefined();
  expect(isolation.project.artifacts).toBeUndefined();
  expect(isolation.context.projectId).toBe('prj_deploy');
  expect(isolation.context.currentVersion).toBe(5);
});
