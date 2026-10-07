const { test, expect } = require('@playwright/test');

async function resetStorage(page){
  await page.goto('/index.html');
  await page.evaluate(()=>{ localStorage.clear(); sessionStorage.clear(); });
  await page.reload();
}

test('import y nuevo proyecto crean recuperación automática restaurable', async ({page})=>{
  const errors=[];
  page.on('pageerror',err=>errors.push(err.message));
  await resetStorage(page);

  await page.evaluate(()=>{
    const p=window.defS();
    p.projName='Proyecto activo antes del cambio';
    p.devices=[{id:'sw1',name:'SW-RECOVERY',type:'switch',kind:'switch',vendorOs:'cisco_ios'}];
    p.vlans=[{id:'v10',vlanId:10,name:'Usuarios'}];
    window.NetWizardState.replaceProject(p,{source:'e2e-transition-seed'});
  });

  await page.evaluate(()=>{
    const imported=window.defS();
    imported.projName='Proyecto importado';
    imported.devices=[{id:'r1',name:'RTR-IMPORTED',type:'router',kind:'router',vendorOs:'cisco_ios'}];
    window.NetWizardJsonImport.applyJsonImportText(JSON.stringify(imported),'e2e-import');
  });

  expect(await page.evaluate(()=>window.NetWizardState.getSnapshot().projName)).toBe('Proyecto importado');
  let snapshots=await page.evaluate(()=>window.NetWizardHistory.listSnapshots());
  expect(snapshots[0]).toMatchObject({
    label:'project-import-backup',
    source:'pre-import',
    summary:{devices:1,vlans:1}
  });

  await page.evaluate(id=>{
    const res=window.NetWizardHistory.restoreSnapshot(id,{skipBackup:true});
    if(!res.ok)throw new Error(res.error||'restore failed');
  },snapshots[0].id);
  expect(await page.evaluate(()=>window.NetWizardState.getSnapshot().projName)).toBe('Proyecto activo antes del cambio');

  page.once('dialog',dialog=>dialog.accept());
  await page.locator('#btnReset').click();
  await expect.poll(()=>page.evaluate(()=>window.NetWizardState.getSnapshot().projName)).toBe('');

  snapshots=await page.evaluate(()=>window.NetWizardHistory.listSnapshots());
  expect(snapshots[0]).toMatchObject({
    label:'project-reset-backup',
    source:'pre-reset',
    summary:{devices:1,vlans:1}
  });

  await page.evaluate(id=>{
    const res=window.NetWizardHistory.restoreSnapshot(id,{skipBackup:true});
    if(!res.ok)throw new Error(res.error||'restore failed');
  },snapshots[0].id);
  expect(await page.evaluate(()=>window.NetWizardState.getSnapshot().projName)).toBe('Proyecto activo antes del cambio');
  expect(errors).toEqual([]);
});

test('vacío e IoT bootstrap no crean backup, pero cualquier sección avanzada sí', async ({page})=>{
  await resetStorage(page);
  const empty=await page.evaluate(()=>{
    const api=window.NetWizardProjectTransitions;
    const current=window.NetWizardState.getSnapshot();
    const before=window.NetWizardHistory.listSnapshots().length;
    const snap=api.createRecoverySnapshot('project-import-backup','pre-import');
    const editedSeed=JSON.parse(JSON.stringify(current));
    editedSeed.iot.devices[0].notes='sensor personalizado';
    return {
      recoverable:api.projectHasRecoverableContent(current),
      editedSeedRecoverable:api.projectHasRecoverableContent(editedSeed),
      seededIot:{accessNodes:current.iot.accessNodes.length,devices:current.iot.devices.length},
      before,
      after:window.NetWizardHistory.listSnapshots().length,
      snap
    };
  });
  expect(empty.recoverable).toBe(false);
  expect(empty.editedSeedRecoverable).toBe(true);
  expect(empty.seededIot).toEqual({accessNodes:1,devices:1});
  expect(empty).toMatchObject({before:0,after:0,snap:null});

  const advanced=await page.evaluate(()=>{
    const p=window.defS();
    p.vrfs=[{id:'vrf1',name:'CLIENT-A'}];
    window.NetWizardState.replaceProject(p,{source:'e2e-advanced-only'});
    const api=window.NetWizardProjectTransitions;
    const recoverable=api.projectHasRecoverableContent(window.NetWizardState.getSnapshot());
    const snap=api.createRecoverySnapshot('project-reset-backup','pre-reset');
    return {recoverable,snapshots:window.NetWizardHistory.listSnapshots(),snap};
  });
  expect(advanced.recoverable).toBe(true);
  expect(advanced.snap).not.toBeNull();
  expect(advanced.snapshots[0]).toMatchObject({label:'project-reset-backup',source:'pre-reset'});
});
