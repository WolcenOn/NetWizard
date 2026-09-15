const { test, expect } = require('@playwright/test');

const DEVICE_ID = 'vendor-under-test';

const VENDORS = [
  {
    id: 'cisco_ios',
    label: 'Cisco IOS',
    type: 'router',
    signatures: [
      /configure terminal/,
      /interface lan0\.10/,
      /ip dhcp pool VLAN10/,
      /ip nat inside source list 100 interface wan0 overload/
    ]
  },
  {
    id: 'cisco_asa',
    label: 'Cisco ASA',
    type: 'firewall',
    signatures: [
      /Cisco ASA/,
      /interface GigabitEthernet0\/0\.10/,
      /nameif vlan10/,
      /access-group OUTSIDE_IN in interface outside/
    ]
  },
  {
    id: 'juniper_junos',
    label: 'Juniper Junos',
    type: 'router',
    signatures: [
      /set system host-name/,
      /set vlans Usuarios vlan-id 10/,
      /set interfaces irb unit 10 family inet address 10\.10\.10\.1\/24/
    ]
  },
  {
    id: 'aruba_aoss',
    label: 'Aruba AOS-Switch',
    type: 'switch',
    signatures: [
      /Aruba AOS-Switch/,
      /vlan 10/,
      /tagged lan0/,
      /write memory/
    ]
  },
  {
    id: 'pfsense',
    label: 'pfSense',
    type: 'firewall',
    signatures: [
      /pfSense CE\/Plus configuration artifact/,
      /<vlan>/,
      /<tag>10<\/tag>/,
      /Interface IP: 10\.10\.10\.1\/24/
    ]
  },
  {
    id: 'fortinet',
    label: 'Fortinet FortiGate',
    type: 'firewall',
    signatures: [
      /Fortinet FortiGate CLI/,
      /config system interface/,
      /set vlanid 10/,
      /config firewall policy/
    ]
  },
  {
    id: 'mikrotik_routeros',
    label: 'MikroTik RouterOS',
    type: 'router',
    signatures: [
      /MikroTik RouterOS/,
      /\/system identity set name=/,
      /\/interface vlan add name=vlan10 vlan-id=10/,
      /\/ip firewall nat add chain=srcnat/
    ]
  },
  {
    id: 'huawei_vrp',
    label: 'Huawei VRP',
    type: 'router',
    signatures: [
      /system-view/,
      /vlan batch 10/,
      /interface Vlanif10/,
      /port link-type trunk/
    ]
  },
  {
    id: 'ubiquiti_unifi',
    label: 'Ubiquiti UniFi',
    type: 'access_point',
    signatures: [
      /Ubiquiti UniFi/,
      /Configuración de controlador\/cloud/,
      /VLANs a transportar: 10/,
      /Crear\/usar red VLAN 10 "Usuarios"/
    ]
  },
  {
    id: 'tplink_omada',
    label: 'TP-Link Omada',
    type: 'wlan_controller',
    signatures: [
      /TP-Link Omada/,
      /Configuración de controlador\/cloud/,
      /VLANs a transportar: 10/,
      /Crear\/usar red VLAN 10 "Usuarios"/
    ]
  },
  {
    id: 'galgus_cloud',
    label: 'Galgus Cloud',
    type: 'wlan_controller',
    signatures: [
      /Galgus Cloud/,
      /Configuración de controlador\/cloud/,
      /VLANs a transportar: 10/,
      /Crear\/usar red VLAN 10 "Usuarios"/
    ]
  },
  {
    id: 'windows',
    label: 'Windows',
    type: 'server',
    signatures: [
      /PowerShell commands/,
      /New-NetIPAddress/,
      /-IPAddress "10\.10\.10\.10"/,
      /Set-DnsClientServerAddress/
    ]
  },
  {
    id: 'linux',
    label: 'Linux',
    type: 'server',
    signatures: [
      /Linux \(Ubuntu\/Debian\/RHEL\)/,
      /ip addr add 10\.10\.10\.10\/24 dev eth0/,
      /ip route add default via 10\.10\.10\.1/,
      /systemd-networkd/
    ]
  }
];

async function loadVendorProject(page, vendor){
  await page.goto('/index.html');
  await page.evaluate(() => {
    localStorage.clear();
    sessionStorage.clear();
  });
  await page.reload();

  await page.evaluate(({ vendor, deviceId }) => {
    const project = window.defS();
    project.projName = `E2E ${vendor.label}`;
    project.vlans = [{ id:'v10', vlanId:10, name:'Usuarios', color:'#14b8a6' }];
    project.subnets = [{ id:'s10', vlanRef:'v10', cidr:'10.10.10.0/24', gateway:'10.10.10.1' }];
    project.devices = [{
      id: deviceId,
      name: `${vendor.label}-01`,
      type: vendor.type,
      vendorOs: vendor.id,
      model: `${vendor.label} E2E`,
      internetEdge: ['router','firewall'].includes(vendor.type) ? 'yes' : 'no',
      wanIf: 'wan0'
    }];
    project.ports = [
      { id:'p-lan', deviceId, name:'lan0', mode:'trunk', allowedVlans:[10], role:'lan', desc:'LAN trunk' },
      { id:'p-wan', deviceId, name:'wan0', mode:'routed', role:'wan', desc:'Internet uplink' }
    ];
    project.hosts = [{
      id:'server-01',
      name:'SRV-01',
      type:'server',
      vlanRef:'v10',
      ipMode:'static',
      staticIp:'10.10.10.10'
    }];
    project.dhcp = {
      '10': {
        enabled:true,
        start:'10.10.10.20',
        end:'10.10.10.200',
        dns:'1.1.1.1,8.8.8.8',
        lease:1
      }
    };
    project.roas = {
      gwId:deviceId,
      lanIf:'lan0',
      natVRef:'v10',
      wanCidr:'198.51.100.2/30',
      wanNh:'198.51.100.1'
    };
    window.NetWizardState.replaceProject(project, { source:'e2e-vendor-config' });
  }, { vendor, deviceId:DEVICE_ID });

  await page.locator('[data-step="cfg"]').first().click();
  await page.locator(`#devPickCfg [data-dcfg="${DEVICE_ID}"]`).click();
}

test.describe('generación de configuración multivendor', () => {
  for(const vendor of VENDORS){
    test(`${vendor.label} genera la respuesta esperada desde la UI`, async ({ page }) => {
      await loadVendorProject(page, vendor);

      await expect(page.locator(`#cfgVendorPills [data-vp="${vendor.id}"]`)).toHaveClass(/\bon\b/);
      await expect(page.locator('#cfgOut')).not.toHaveValue('');

      const output = await page.locator('#cfgOut').inputValue();
      expect(output, `${vendor.id} no debe caer en un fallback sin soporte`)
        .not.toMatch(/Sin vendor asignado|todavía no implementado/i);
      expect(output.length, `${vendor.id} debe generar una respuesta sustancial`).toBeGreaterThan(80);

      for(const signature of vendor.signatures){
        expect(output, `${vendor.id} debe incluir ${signature}`).toMatch(signature);
      }

      const commented = await page.locator('#cfgOutComment').inputValue();
      expect(commented.length, `${vendor.id} debe generar también la versión comentada`)
        .toBeGreaterThan(output.length);
      expect(commented).toContain('Línea de configuración generada automáticamente.');
    });
  }

  test('cambiar el fabricante en los pills regenera la salida visible', async ({ page }) => {
    await loadVendorProject(page, VENDORS[0]);
    await expect(page.locator('#cfgOut')).toHaveValue(/Cisco IOS/);

    await page.locator('#cfgVendorPills [data-vp="mikrotik_routeros"]').click();

    await expect(page.locator('#cfgVendorPills [data-vp="mikrotik_routeros"]')).toHaveClass(/\bon\b/);
    await expect(page.locator('#cfgOut')).toHaveValue(/MikroTik RouterOS/);
    await expect(page.locator('#cfgOut')).not.toHaveValue(/Cisco IOS Router\/Firewall/);
  });
});
