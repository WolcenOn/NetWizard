# NetWizard v3.19 · Diff/preview para automatismos

Esta versión extiende la filosofía de revisión previa que ya existía para políticas firewall/ACL a otros cambios automáticos del proyecto.

## Cambios principales

- Nuevo módulo `js/netwizard-change-preview.js`.
- Diff previo para aplicar VLSM.
- Diff previo para proponer DHCP avanzado.
- Diff previo para asignar IPs a interfaces de tránsito L3.
- Confirmación antes de aplicar propuesta DHCP cuando existen cambios.
- Tests unitarios para los tres tipos de diff.

## Objetivo

Reducir el riesgo operativo antes de modificar el proyecto automáticamente. El usuario puede ver qué subredes, gateways, hosts, scopes DHCP o interfaces L3 se modificarán antes de aceptar.

## Limitaciones

El diff es conservador y compara campos funcionales principales. No pretende todavía ser un sistema completo de cambios transaccionales. La siguiente evolución debería ser una pantalla común de “plan de cambios” con aplicar/deshacer para cualquier automatismo.
