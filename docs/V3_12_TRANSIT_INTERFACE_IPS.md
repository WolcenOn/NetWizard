# NetWizard v3.12 · IPs en interfaces de tránsito L3

Esta versión añade una capa incremental sobre v3.11 para completar el flujo básico de enlaces L3:

- El formulario de enlaces permite seleccionar una VLAN/red de tránsito L3 opcional.
- La tabla de enlaces muestra la VLAN de tránsito asociada y las IPs L3 de los puertos cuando existen.
- `NetWizardPlanner.assignTransitInterfaceIps(project, options)` asigna IPs a puertos routed en enlaces L3 que tengan una VLAN de tránsito con subnet válida.
- La asignación evita network/broadcast, respeta IPs ya existentes salvo que se indique `overwrite:true`, y guarda snapshot desde la UI antes de aplicar.
- La auditoría de direccionamiento detecta IPs L3 duplicadas, inválidas o fuera de la subnet.
- `NetWizardProjectSchema` conserva `aPortId`, `bPortId`, `transitVlanRef`, `l3Ip` y `l3Cidr` en import/export.

## Limitaciones conocidas

- Por prudencia, la asignación automática no usa `/31` todavía. Se mantiene `/30` como opción segura y ampliamente compatible.
- La generación vendor todavía no configura automáticamente todas las interfaces routed con las IPs asignadas. Ese será el siguiente paso.
- La UI permite asociar la red de tránsito al crear el enlace, pero aún no incluye edición inline del `transitVlanRef` en enlaces ya creados.

## Validación

Ejecutado:

```bash
npm test
npm run check:syntax
unzip -t netwizard_v3_12_transit_interface_ips.zip
```
