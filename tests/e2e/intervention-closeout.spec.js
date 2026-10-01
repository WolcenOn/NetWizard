const { test, expect } = require('@playwright/test');

async function resetStorage(page){
  await page.goto('/index.html');
  await page.evaluate(()=>{localStorage.clear();sessionStorage.clear();});
  await page.reload();
}

async function completeInterventionEvidence(page){
  await page.evaluate(()=>{
    const M=window.NetWizardInterventionExecution;
    let p=window.NetWizardState.getSnapshot();
    p=M.patchRecord(p,{technician:'E2E Técnico',startedAt:'2026-10-01T10:00:00Z'});
    for(const item of M.build(p).items){
      p=M.setAction(p,item.actionId,{
        status:'done',
        completedAt:'2026-10-01T10:10:00Z',
        completedBy:'E2E Técnico',
        note:'Ejecutado según plan',
        evidenceRefs:['foto-'+item.order,'test-'+item.order]
      });
    }
    p=M.acceptedRecord(p,{
      connectivityVerified:true,
      labelsVerified:true,
      asBuiltReviewed:true,
      acceptedBy:'E2E Supervisor',
      acceptedAt:'2026-10-01T10:20:00Z',
      note:'Aceptación E2E'
    });
    p.observedState=Object.assign({},p.observedState||{},{observedAt:'2026-10-01T10:15:00Z'});
    window.NetWizardState.replaceProject(p,{source:'e2e-complete-intervention-evidence'});
    window.navTo('physical');
  });
  await expect(page.locator('#interventionCloseoutMount button',{hasText:'Cerrar intervención'})).toBeEnabled();
}

test('cierre de intervención convierte To-Be en As-Built trazable y guarda snapshot', async ({page})=>{
  await resetStorage(page);
  page.on('dialog', dialog => dialog.accept());

  await page.evaluate(()=>{
    const p=window.NetWizardState.getSnapshot();
    Object.assign(p,{
      projName:'E2E cierre intervención',
      workflow:{mode:'inventory'},
      physicalLocations:[{id:'loc1',name:'CPD',type:'room'}],
      racks:[{id:'rack1',name:'RACK-01',locationId:'loc1',rackUnits:24}],
      rackItems:[{id:'ri1',rackId:'rack1',type:'device',deviceId:'sw1',label:'SW-01',startUnit:18,heightUnits:1,face:'front'}],
      devices:[{id:'sw1',name:'SW-01',type:'switch',kind:'switch',manufacturer:'ACME',model:'X48',modelSource:'manual',rackId:'rack1',rackUnit:18,rackUnits:1}],
      ports:[{id:'p1',deviceId:'sw1',name:'Gi1/0/1',media:'copper',speedMaxMbps:1000,negotiatedSpeedMbps:1000}],
      pdus:[{id:'pdu1',name:'PDU-A',rackId:'rack1',feed:'A',outletCount:8,maxPowerWatts:3680}],
      powerConnections:[{id:'pw1',deviceId:'sw1',pduId:'pdu1',outlet:1,powerSupplyIndex:0,feed:'A'}],
      patchPanels:[],telecomOutlets:[],cableRuns:[],patchConnections:[],hostOutletConnections:[],
      hosts:[],links:[],vlans:[],subnets:[],fwRules:[],dhcp:{}
    });
    window.NetWizardState.replaceProject(p,{source:'e2e-closeout-source'});
    window.navTo('physical');
  });

  await page.locator('#inventoryToDesignMount button',{hasText:'Crear Diseño To-Be'}).click();
  await expect.poll(()=>page.evaluate(()=>window.NetWizardState.getSnapshot().workflow.mode)).toBe('design');

  await page.evaluate(()=>{
    const p=window.NetWizardState.getSnapshot();
    p.devices[0].rackUnit=20;
    p.rackItems[0].startUnit=20;
    window.NetWizardState.replaceProject(p,{source:'e2e-closeout-change'});
    window.navTo('physical');
  });

  await completeInterventionEvidence(page);
  const closeout=page.locator('#interventionCloseoutMount');
  await expect(closeout).toBeVisible();
  await expect(closeout).toContainText('Cierre de intervención');
  await expect(closeout).toContainText('Listo');
  await expect(closeout.locator('button',{hasText:'Cerrar intervención'})).toBeEnabled();

  const beforeHistory=await page.evaluate(()=>window.NetWizardHistory.listSnapshots().length);
  await closeout.locator('button',{hasText:'Cerrar intervención'}).click();

  await expect.poll(()=>page.evaluate(()=>window.NetWizardState.getSnapshot().workflow.mode)).toBe('inventory');
  const result=await page.evaluate(()=>{
    const p=window.NetWizardState.getSnapshot();
    return{
      name:p.projName,
      updatedFrom:p.workflow&&p.workflow.updatedFrom,
      derivedFrom:p.workflow&&p.workflow.derivedFrom,
      baseline:p.workflow&&p.workflow.interventionBaseline,
      originRef:p.devices[0]&&p.devices[0].originRef,
      disposition:p.devices[0]&&p.devices[0].designDisposition,
      rackUnit:p.devices[0]&&p.devices[0].rackUnit,
      history:window.NetWizardHistory.listSnapshots().length
    };
  });

  expect(result.name).toContain('As-Built actualizado');
  expect(result.updatedFrom.type).toBe('intervention-closeout');
  expect(result.updatedFrom.sourceInventorySnapshotId).toMatch(/^snap_/);
  expect(result.updatedFrom.designSnapshotId).toMatch(/^snap_/);
  expect(result.updatedFrom.interventionActionCount).toBeGreaterThanOrEqual(1);
  expect(result.derivedFrom).toBeUndefined();
  expect(result.baseline).toBeUndefined();
  expect(result.originRef).toBeUndefined();
  expect(result.disposition).toBeUndefined();
  expect(result.rackUnit).toBe(20);
  expect(result.history).toBeGreaterThanOrEqual(beforeHistory+1);

  await expect(page.locator('#inventoryToDesignMount')).toContainText('As-Built actualizado desde intervención cerrada');
});


test('la UI permite seleccionar el equipo sustituto para un replace', async ({page})=>{
  await resetStorage(page);
  page.on('dialog', dialog => dialog.accept());

  await page.evaluate(()=>{
    const p=window.NetWizardState.getSnapshot();
    Object.assign(p,{
      projName:'E2E selector reemplazo',
      workflow:{mode:'inventory'},
      physicalLocations:[{id:'loc1',name:'CPD',type:'room'}],
      racks:[{id:'rack1',name:'RACK-01',locationId:'loc1',rackUnits:24}],
      rackItems:[{id:'ri1',rackId:'rack1',type:'device',deviceId:'sw-old',label:'SW-OLD',startUnit:18,heightUnits:1,face:'front'}],
      devices:[{id:'sw-old',name:'SW-OLD',type:'switch',kind:'switch',manufacturer:'ACME',model:'X24',modelSource:'manual',rackId:'rack1',rackUnit:18,rackUnits:1}],
      ports:[{id:'p-old',deviceId:'sw-old',name:'Gi1/0/1',media:'copper',speedMaxMbps:1000}],
      pdus:[],powerConnections:[],patchPanels:[],telecomOutlets:[],cableRuns:[],patchConnections:[],hostOutletConnections:[],
      hosts:[],links:[],vlans:[],subnets:[],fwRules:[],dhcp:{}
    });
    window.NetWizardState.replaceProject(p,{source:'e2e-replacement-source'});
    window.navTo('physical');
  });

  await page.locator('#inventoryToDesignMount button',{hasText:'Crear Diseño To-Be'}).click();
  await expect.poll(()=>page.evaluate(()=>window.NetWizardState.getSnapshot().workflow.mode)).toBe('design');

  await page.evaluate(()=>{
    const p=window.NetWizardState.getSnapshot();
    p.devices.push({
      id:'sw-new',name:'SW-NEW',type:'switch',kind:'switch',manufacturer:'ACME',model:'X48',
      modelSource:'manual',designDisposition:'add',rackId:'rack1',rackUnit:20,rackUnits:1
    });
    p.ports.push({id:'p-new',deviceId:'sw-new',name:'Gi1/0/1',media:'copper',speedMaxMbps:1000});
    p.rackItems.push({id:'ri-new',rackId:'rack1',type:'device',deviceId:'sw-new',label:'SW-NEW',startUnit:20,heightUnits:1,face:'front'});
    window.NetWizardState.replaceProject(p,{source:'e2e-replacement-device'});
    window.navTo('dev');
  });

  const disposition=page.locator('select[data-design-disposition="sw-old"]');
  await expect(disposition).toBeVisible();
  await disposition.selectOption('replace');

  const replacement=page.locator('select[data-replacement-for="sw-old"]');
  await expect(replacement).toBeEnabled();
  await expect(replacement.locator('option[value="sw-new"]')).toHaveText('SW-NEW');
  await replacement.selectOption('sw-new');

  const state=await page.evaluate(()=>{
    const p=window.NetWizardState.getSnapshot();
    const old=p.devices.find(d=>d.id==='sw-old');
    return{disposition:old.designDisposition,replacementDeviceRef:old.replacementDeviceRef};
  });
  expect(state.disposition).toBe('replace');
  expect(state.replacementDeviceRef).toBe('sw-new');

  await page.evaluate(()=>window.navTo('physical'));
  await completeInterventionEvidence(page);
  const closeout=page.locator('#interventionCloseoutMount');
  await expect(closeout).toBeVisible();
  await expect(closeout).not.toContainText('replacementDeviceRef');
  await expect(closeout.locator('button',{hasText:'Cerrar intervención'})).toBeEnabled();
});


test('dos ciclos consecutivos de intervención mantienen un As-Built limpio y trazable', async ({page})=>{
  await resetStorage(page);
  page.on('dialog', dialog => dialog.accept());

  await page.evaluate(()=>{
    const p=window.NetWizardState.getSnapshot();
    Object.assign(p,{
      projName:'E2E ciclo repetido · As-Built',
      workflow:{mode:'inventory'},
      physicalLocations:[{id:'loc1',name:'CPD',type:'room'}],
      racks:[{id:'rack1',name:'RACK-01',locationId:'loc1',rackUnits:24}],
      rackItems:[{id:'ri1',rackId:'rack1',type:'device',deviceId:'sw1',label:'SW-01',startUnit:18,heightUnits:1,face:'front'}],
      devices:[{id:'sw1',name:'SW-01',type:'switch',kind:'switch',manufacturer:'ACME',model:'X48',modelSource:'manual',rackId:'rack1',rackUnit:18,rackUnits:1}],
      ports:[{id:'p1',deviceId:'sw1',name:'Gi1/0/1',media:'copper',speedMaxMbps:1000}],
      pdus:[],powerConnections:[],patchPanels:[],telecomOutlets:[],cableRuns:[],patchConnections:[],hostOutletConnections:[],
      hosts:[],links:[],vlans:[],subnets:[],fwRules:[],dhcp:{}
    });
    window.NetWizardState.replaceProject(p,{source:'e2e-repeated-cycle-source'});
    window.navTo('physical');
  });

  const historyBefore=await page.evaluate(()=>window.NetWizardHistory.listSnapshots().length);

  await page.locator('#inventoryToDesignMount button',{hasText:'Crear Diseño To-Be'}).click();
  await expect.poll(()=>page.evaluate(()=>window.NetWizardState.getSnapshot().workflow.mode)).toBe('design');
  await page.evaluate(()=>{
    const p=window.NetWizardState.getSnapshot();
    p.devices[0].rackUnit=19;
    p.rackItems[0].startUnit=19;
    window.NetWizardState.replaceProject(p,{source:'e2e-cycle-1-change'});
    window.navTo('physical');
  });
  await completeInterventionEvidence(page);
  await page.locator('#interventionCloseoutMount button',{hasText:'Cerrar intervención'}).click();
  await expect.poll(()=>page.evaluate(()=>window.NetWizardState.getSnapshot().workflow.mode)).toBe('inventory');

  const first=await page.evaluate(()=>{
    const p=window.NetWizardState.getSnapshot();
    return{name:p.projName,updatedFrom:p.workflow.updatedFrom,rackUnit:p.devices[0].rackUnit};
  });
  expect(first.name).toBe('E2E ciclo repetido · As-Built actualizado');
  expect(first.updatedFrom.sourceInventorySnapshotId).toMatch(/^snap_/);
  expect(first.updatedFrom.designSnapshotId).toMatch(/^snap_/);
  expect(first.rackUnit).toBe(19);

  await page.locator('#inventoryToDesignMount button',{hasText:'Crear Diseño To-Be'}).click();
  await expect.poll(()=>page.evaluate(()=>window.NetWizardState.getSnapshot().workflow.mode)).toBe('design');

  const secondDesign=await page.evaluate(()=>{
    const p=window.NetWizardState.getSnapshot();
    return{
      previousCloseout:p.workflow.updatedFrom,
      derivedFrom:p.workflow.derivedFrom,
      originRef:p.devices[0].originRef,
      disposition:p.devices[0].designDisposition
    };
  });
  expect(secondDesign.previousCloseout.designSnapshotId).toBe(first.updatedFrom.designSnapshotId);
  expect(secondDesign.derivedFrom.sourceProjectName).toBe(first.name);
  expect(secondDesign.originRef).toBe('sw1');
  expect(secondDesign.disposition).toBe('keep');

  await page.evaluate(()=>{
    const p=window.NetWizardState.getSnapshot();
    p.devices[0].rackUnit=20;
    p.rackItems[0].startUnit=20;
    window.NetWizardState.replaceProject(p,{source:'e2e-cycle-2-change'});
    window.navTo('physical');
  });
  await completeInterventionEvidence(page);
  await page.locator('#interventionCloseoutMount button',{hasText:'Cerrar intervención'}).click();
  await expect.poll(()=>page.evaluate(()=>window.NetWizardState.getSnapshot().workflow.mode)).toBe('inventory');

  const final=await page.evaluate(()=>{
    const p=window.NetWizardState.getSnapshot();
    return{
      name:p.projName,
      workflow:p.workflow,
      device:p.devices[0],
      rackItem:p.rackItems[0],
      history:window.NetWizardHistory.listSnapshots().length
    };
  });
  expect(final.name).toBe('E2E ciclo repetido · As-Built actualizado');
  expect((final.name.match(/As-Built actualizado/g)||[]).length).toBe(1);
  expect(final.workflow.updatedFrom.sourceProjectName).toBe(first.name);
  expect(final.workflow.updatedFrom.sourceInventorySnapshotId).toMatch(/^snap_/);
  expect(final.workflow.updatedFrom.designSnapshotId).toMatch(/^snap_/);
  expect(final.workflow.derivedFrom).toBeUndefined();
  expect(final.workflow.interventionBaseline).toBeUndefined();
  expect(final.device.rackUnit).toBe(20);
  expect(final.rackItem.startUnit).toBe(20);
  expect(final.device.originRef).toBeUndefined();
  expect(final.device.designDisposition).toBeUndefined();
  expect(final.device.replacementDeviceRef).toBeUndefined();
  expect(final.history).toBeGreaterThanOrEqual(historyBefore+4);

  const journal=page.locator('#interventionHistoryMount');
  await expect(journal).toBeVisible();
  await expect(journal).toContainText('Historial de intervenciones');
  await expect(journal.locator('tbody tr')).toHaveCount(2);
  await expect(journal).toContainText('Estado actual');
  await expect(journal).toContainText(first.name);
});


test('modo ejecución de campo persiste evidencia canónica sin mutar el To-Be físico', async ({page})=>{
  await resetStorage(page);
  page.on('dialog', dialog => dialog.accept());

  await page.evaluate(()=>{
    const p=window.NetWizardState.getSnapshot();
    Object.assign(p,{
      projName:'E2E ejecución campo',
      workflow:{mode:'inventory'},
      physicalLocations:[{id:'loc1',name:'CPD',type:'room'}],
      racks:[{id:'rack1',name:'RACK-01',locationId:'loc1',rackUnits:24}],
      rackItems:[{id:'ri1',rackId:'rack1',type:'device',deviceId:'sw1',label:'SW-01',startUnit:18,heightUnits:1,face:'front'}],
      devices:[{id:'sw1',name:'SW-01',type:'switch',kind:'switch',manufacturer:'ACME',model:'X48',modelSource:'manual',rackId:'rack1',rackUnit:18,rackUnits:1}],
      ports:[{id:'p1',deviceId:'sw1',name:'Gi1/0/1',media:'copper',speedMaxMbps:1000}],
      pdus:[],powerConnections:[],patchPanels:[],telecomOutlets:[],cableRuns:[],patchConnections:[],hostOutletConnections:[],
      hosts:[],links:[],vlans:[],subnets:[],fwRules:[],dhcp:{}
    });
    window.NetWizardState.replaceProject(p,{source:'e2e-field-source'});
    window.navTo('physical');
  });

  await page.locator('#inventoryToDesignMount button',{hasText:'Crear Diseño To-Be'}).click();
  await expect.poll(()=>page.evaluate(()=>window.NetWizardState.getSnapshot().workflow.mode)).toBe('design');

  await page.evaluate(()=>{
    const p=window.NetWizardState.getSnapshot();
    p.devices[0].rackUnit=20;
    p.rackItems[0].startUnit=20;
    window.NetWizardState.replaceProject(p,{source:'e2e-field-change'});
    window.navTo('physical');
  });

  const field=page.locator('#fieldExecutionMount');
  await expect(field).toBeVisible();
  await expect(field).toContainText('Ejecución de campo & aceptación');
  await page.locator('#fieldExecutionTechnician').fill('Técnico E2E');
  await page.locator('#fieldExecutionTechnician').press('Tab');
  const row=field.locator('[data-execution-action-id]').first();
  await expect(row).toBeVisible();
  await row.locator('select').selectOption('done');
  await expect(page.locator('#fieldExecutionMount')).toContainText('100%');

  const afterMark=await page.evaluate(()=>{
    const p=window.NetWizardState.getSnapshot();
    const execution=p.workflow.interventionExecution;
    return {
      mode:p.workflow.mode,rackUnit:p.devices[0].rackUnit,startUnit:p.rackItems[0].startUnit,
      technician:execution&&execution.technician,
      statuses:Object.values(execution&&execution.actions||{}).map(x=>x.status)
    };
  });
  expect(afterMark.mode).toBe('design');
  expect(afterMark.rackUnit).toBe(20);
  expect(afterMark.startUnit).toBe(20);
  expect(afterMark.technician).toBe('Técnico E2E');
  expect(afterMark.statuses).toEqual(['done']);

  await completeInterventionEvidence(page);
  await expect(page.locator('#fieldExecutionMount')).toContainText('Cierre preparado');
  await expect(page.locator('#interventionCloseoutMount button',{hasText:'Cerrar intervención'})).toBeEnabled();
});
