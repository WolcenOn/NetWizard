# NetWizard v3.15 · DHCP avanzado por VLAN

Esta versión añade una capa conservadora de DHCP avanzado sin cambiar el modelo general del proyecto.

## Nuevo módulo

`js/netwizard-dhcp-utils.js` expone funciones puras para:

- Normalizar scopes DHCP.
- Proponer rangos de pool desde la subnet.
- Añadir exclusiones automáticas para gateway e IPs estáticas.
- Validar pools, rangos, reservas y exclusiones.
- Generar exclusiones Cisco IOS cuando el pool DHCP no cubre toda la subnet.

## UI

La sección DHCP permite editar por VLAN:

- DHCP activo/inactivo.
- Inicio y fin del pool.
- DNS.
- Dominio.
- Lease en días.

El botón **Proponer pools DHCP** rellena rangos de forma prudente usando la subnet de cada VLAN.

## Validaciones

Se añaden códigos como:

- `NW-DHCP-010` scope para VLAN inexistente.
- `NW-DHCP-011` DHCP activo sin subnet válida.
- `NW-DHCP-012` rango inválido o incompleto.
- `NW-DHCP-014` pool fuera de subnet.
- `NW-DHCP-015` pool incluye gateway.
- `NW-DHCP-016` pool incluye una IP estática.

## Exportación vendor

- Cisco IOS: exclusiones, pool, DNS, dominio y lease.
- FortiGate: bloques `config system dhcp server` básicos por VLAN.
- pfSense: documentación de rango para configurar desde GUI.

## Limitaciones

Aún no se generan reservas DHCP específicas por vendor ni opciones avanzadas como Option 43/66/150. Esto queda preparado para un paso posterior.
