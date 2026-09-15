# NetWizard 3.50 · escenarios y criterio de producción

## Objetivo

Los proyectos de referencia dejan de ser simples archivos que “se pueden importar”. Cada uno declara un resultado comprobable de extremo a extremo en `samples/production-scenarios.json`.

| Escenario | Resultado estricto | Avisos aceptados | Cobertura |
|---|---|---|---|
| Oficina pequeña | `ready` | Ninguno | FortiGate, switch Cisco, AP UniFi, PoE y DHCP |
| Centro educativo | `review` | Dimensionamiento broadcast | FortiGate, core/acceso Cisco, fibra y políticas |
| IoT y cámaras | `review` | Densidad/segmentación broadcast | FortiGate, switch PoE, cámaras, NVR y gateway MQTT |
| Tránsito L3 | `ready` | Ninguno | Routers Cisco, switch LAN y red /30 |

## Criterio de salida

La prueba ejecuta la puerta con `productionMode:true` y `strict:true`. Un escenario solo pasa cuando:

1. no contiene errores ni incidencias bloqueantes;
2. el estado coincide con el contrato (`ready` o `review`);
3. todos los avisos están enumerados expresamente y no aparece ninguno nuevo;
4. cada dispositivo declarado produce una configuración sustancial y con firmas propias de su fabricante;
5. la documentación y el inventario se generan desde el mismo proyecto importado.

`NetWizardProductionGate.evaluateReleaseCriteria()` implementa esta política de forma reutilizable. Playwright repite el contrato usando el runtime real de `index.html`, por lo que también detecta módulos ausentes u orden de carga incorrecto.

## Correcciones de coherencia incluidas

- Los aliases legacy de fabricante se normalizan al vocabulario canónico (`fortigate`/`fortios` → `fortinet`, `junos` → `juniper_junos`, etc.).
- El registro de capacidades contiene una entrada para todos los fabricantes del modelo 3.50.
- Un trunk switch-router/firewall ya no se interpreta automáticamente como enlace de tránsito L3.
- Enumerar explícitamente todas las VLANs actuales en un trunk es información de mantenimiento, no un bloqueo de producción.
- La identidad IP/PoE de un dispositivo gestionado puede referenciar su puerto trunk sin duplicarlo como endpoint access.
