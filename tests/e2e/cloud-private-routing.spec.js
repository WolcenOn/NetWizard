const { test, expect } = require('@playwright/test');

test('proyecto cloud sincroniza una revisión y genera routing en Private Engine', async ({page})=>{
  let putBody=null,privateBody=null;
  await page.route('**/api/capabilities',async route=>route.fulfill({
    status:200,contentType:'application/json',
    body:JSON.stringify({authEnforced:true,remoteProjectWrites:true,privateRouting:true})
  }));
  await page.route('**/api/auth/me',async route=>route.fulfill({
    status:200,contentType:'application/json',
    body:JSON.stringify({displayName:'Cloud Editor',csrfToken:'csrf-e2e'})
  }));
  await page.route('**/api/projects/prj_e2e',async route=>{
    const method=route.request().method();
    if(method==='GET'){
      return route.fulfill({
        status:200,
        headers:{ETag:'"prj_e2e:2"'},
        contentType:'application/json',
        body:JSON.stringify({
          project:{id:'prj_e2e',workspaceId:'ws1',name:'Cloud E2E',schemaVersion:'3.50.0',currentVersion:2},
          revision:{projectId:'prj_e2e',version:2,schemaVersion:'3.50.0',snapshot:{
            _schemaVersion:'3.50.0',projName:'Cloud E2E',
            devices:[{id:'r1',name:'RTR-CLOUD',type:'router',kind:'router',vendorOs:'cisco_ios'}],
            ports:[],vlans:[],subnets:[],hosts:[],links:[]
          }}
        })
      });
    }
    putBody=route.request().postDataJSON();
    expect(route.request().headers()['x-netwizard-csrf']).toBe('csrf-e2e');
    expect(putBody.expectedVersion).toBe(2);
    return route.fulfill({
      status:200,
      headers:{ETag:'"prj_e2e:3"'},
      contentType:'application/json',
      body:JSON.stringify({
        project:{id:'prj_e2e',workspaceId:'ws1',name:'Cloud E2E',schemaVersion:'3.50.0',currentVersion:3},
        revision:{projectId:'prj_e2e',version:3,schemaVersion:'3.50.0',snapshot:putBody.snapshot}
      })
    });
  });
  await page.route('**/api/projects/prj_e2e/private/routing',async route=>{
    privateBody=route.request().postDataJSON();
    expect(route.request().headers()['x-netwizard-csrf']).toBe('csrf-e2e');
    return route.fulfill({
      status:200,contentType:'application/json',
      body:JSON.stringify({
        contractVersion:'netwizard-private-routing-v1',
        planVersion:'netwizard-routing-plan-v1',
        generatorVersion:'private-e2e',
        deviceId:'r1',vendor:'cisco_ios',
        output:'router ospf 10\n network 10.10.10.0 0.0.0.255 area 0\n',
        warnings:[]
      })
    });
  });

  await page.goto('/index.html?projectId=prj_e2e');
  await expect.poll(()=>page.evaluate(()=>window.NetWizardRemoteProject?.context()?.currentVersion||0),{timeout:10000}).toBe(2);
  await page.evaluate(()=>window.navTo('cfg'));

  const card=page.locator('#nwPrivateRoutingCard');
  await expect(card).toBeVisible();
  await expect(card.locator('#nwPrivateRoutingStatus')).toContainText('versión remota 2');
  await expect(card.locator('#nwPrivateRoutingDevice')).toHaveValue('r1');

  await page.evaluate(()=>{
    const p=window.NetWizardState.getSnapshot();
    p.devices[0].name='RTR-CLOUD-EDITED';
    window.NetWizardState.replaceProject(p,{source:'e2e-cloud-edit'});
  });

  await card.locator('#nwPrivateRoutingGenerate').click();
  await expect(card.locator('#nwPrivateRoutingOutput')).toContainText('router ospf 10');
  await expect(card.locator('#nwPrivateRoutingStatus')).toContainText('versión remota 3');

  expect(putBody.snapshot.devices[0].name).toBe('RTR-CLOUD-EDITED');
  expect(privateBody).toEqual({expectedVersion:3,deviceId:'r1'});

  const isolation=await page.evaluate(()=>({
    project:window.NetWizardState.getSnapshot(),
    context:window.NetWizardRemoteProject.context()
  }));
  expect(isolation.project.projectId).toBeUndefined();
  expect(isolation.project.currentVersion).toBeUndefined();
  expect(isolation.context.projectId).toBe('prj_e2e');
  expect(isolation.context.currentVersion).toBe(3);
});
