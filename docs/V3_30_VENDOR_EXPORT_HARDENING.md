# NetWizard v3.30 · Hardening de exportaciones vendor

Esta versión añade una capa preventiva para revisar las configuraciones por fabricante antes de exportarlas.

## Nuevo módulo

```text
js/netwizard-vendor-hardening.js
```

API principal:

```js
NetWizardVendorHardening.validateDeviceExport(project, device, options)
NetWizardVendorHardening.validateAllExports(project, options)
NetWizardVendorHardening.summarizeExportHardening(report)
```

## Qué valida

- Dispositivos sin vendor/OS o sin puertos.
- Puertos sin nombre de interfaz.
- Interfaces routed sin IP/CIDR completo.
- Cisco IOS access sin VLAN válida.
- Cisco IOS trunks sin allowed VLANs explícitas.
- Cisco IOS RoaS sin LAN interface.
- Borde WAN sin CIDR o next-hop.
- Firewalls con VLANs sin subnet/gateway.
- Firewalls sin políticas cuando hay varias VLANs.
- Juniper trunks sin VLAN members.
- Servidores Windows/Linux sin scopes DHCP activos.

## Integración

La Puerta de Producción incluye ahora el hardening vendor. En modo producción, los errores de exportación bloquean la generación de configuraciones.

También se añade una tarjeta en el dashboard:

```text
🧱 Hardening exportación vendor
```

## Tests

```bash
npm test
npm run check:syntax
```
