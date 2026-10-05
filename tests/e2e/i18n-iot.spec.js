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

test('IoT workspace cambia ES/EN en caliente sin recargar', async ({page})=>{
  await resetStorage(page);

  await page.evaluate(()=>{
    const p=window.NetWizardState.getSnapshot();
    p.vlans=[{id:'v20',vlanId:20,name:'IoT',color:'#10b981'}];
    p.subnets=[{id:'s20',vlanRef:'v20',cidr:'10.20.0.0/24',gateway:'10.20.0.1'}];
    p.iot={
      accessNodes:[{
        id:'acc1',name:'GW-01',type:'zigbee_coordinator',vendor:'generic',model:'ZB-1',
        mgmtIp:'10.20.0.10',mgmtVlanRef:'v20',parentDeviceId:'',parentPortId:'',
        locationId:'',physicalLocation:'',locationRole:'',serviceName:'Zigbee-Core',
        serviceVlanRef:'v20',notes:''
      }],
      devices:[{
        id:'iot1',name:'CAM-01',type:'camera',tech:'camera',accessNodeId:'acc1',
        identifier:'10.20.0.50',vlanRef:'v20',locationId:'',physicalLocation:'',
        locationRole:'',credentialAlias:'cam-main',notes:''
      }],
      map:{show:{network:true,port:false,access:true,iot:true,wifi:true,lora:true,zigbee:true,thread:true,mqtt:true,camera:true},scale:1,panX:0,panY:0},
      selected:null
    };
    window.NetWizardState.replaceProject(p,{source:'i18n-iot-e2e'});
  });

  await page.locator('[data-step="iot"]').first().click();
  const root=page.locator('#pg-iot');
  await expect(root).toBeVisible();
  await expect(root).toContainText('IoT access infrastructure');
  await expect(root).toContainText('End IoT devices');
  await expect(root).toContainText('Unified IoT + Network Map');
  await expect(page.locator('#iotAccessList')).toContainText('Zigbee Coordinator');
  await expect(page.locator('#iotAccessList')).toContainText('Edit');
  await expect(page.locator('#iotDeviceList')).toContainText('Camera/NVR');
  await expect(page.locator('#iotPlanOut')).toHaveValue(/Integrated NetWizard \+ IoT Plan/);

  await page.evaluate(()=>window.NetWizardI18n.setLocale('es'));

  await expect(root).toContainText('Infraestructura de acceso IoT');
  await expect(root).toContainText('Dispositivos IoT finales');
  await expect(root).toContainText('Mapa unificado IoT + Red');
  await expect(page.locator('#iotAccessList')).toContainText('Coordinador Zigbee');
  await expect(page.locator('#iotAccessList')).toContainText('Editar');
  await expect(page.locator('#iotDeviceList')).toContainText('Cámara/NVR');
  await expect(page.locator('#iotPlanOut')).toHaveValue(/Plan integrado NetWizard \+ IoT/);

  await page.locator('#iotAddDevice').click();
  await expect(page.locator('#iotDeviceTitle')).toHaveText('Añadir dispositivo IoT');
  await expect(page.locator('#iotDeviceLocationRole')).toHaveAttribute('placeholder','estantería, aula 2, zona cámara...');

  await page.evaluate(()=>window.NetWizardI18n.setLocale('en'));
  await expect(page.locator('#iotDeviceTitle')).toHaveText('Add IoT device');
  await expect(page.locator('#iotDeviceLocationRole')).toHaveAttribute('placeholder','shelf, room 2, camera zone...');
});
