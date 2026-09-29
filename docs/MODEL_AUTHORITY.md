# Autoridad del modelo y flujo UX — NetWizard 3.50

Este documento fija la autoridad de datos tras la limpieza de interfaz/modelo. No cambia el formato persistido: `_schemaVersion` sigue siendo **3.50.0**.

## Leyenda

- **C — Canonical:** estado persistido que actúa como fuente de verdad para ese concepto.
- **R — Reference:** referencia o espejo de compatibilidad hacia una autoridad canónica.
- **D — Derived:** valor calculado; no debe convertirse en una segunda fuente editable.
- **O — Observed:** evidencia del estado real/As-Built.
- **T — To-Be:** intención o configuración deseada.
- **X — Duplicate/conflicting:** representación que no debe actuar como autoridad paralela.
- **A — Action:** motor/acción que propone o materializa cambios sobre estado canónico.

## Matriz de autoridad

| Área | Representación | Clase | Regla de autoridad |
| --- | --- | --- | --- |
| Equipo | `devices[]` identidad, tipo, vendor/modelo, serial/asset, potencia intrínseca | C | Autoridad de identidad del equipo. |
| Colocación física | `rackItems[]` de tipo `device` | C | Autoridad para rack, U, altura y cara. |
| Colocación legacy | `device.rackId/rackUnit/rackUnits/rackFace` | R | Espejo de compatibilidad; no se edita desde la ficha general del dispositivo. |
| Ocupación de rack | cálculo desde `rackItems[]` | D | No se almacena como segunda colección de ocupación. |
| Puerto | `ports[]` | C | Autoridad del puerto físico/lógico existente. |
| Puerto deseado | modo, VLAN, L3, `adminState`, MTU, transceptor/configuración declarada | T | Intención de configuración sobre el puerto canónico. |
| Puerto observado | `operState`, `negotiatedSpeedMbps`, `utilizationPercent` | O | Evidencia As-Built; no genera órdenes por sí sola. |
| Enlace directo | `links[]` entre puertos existentes | C | Autoridad para enlaces directos puerto↔puerto y su medio/longitud documentados. |
| Cableado estructurado | `hostOutletConnections[] → cableRuns[] → patchConnections[]` | C | Autoridad física cuando existe una ruta estructurada. |
| Host | `hosts[]` identidad, VLAN/IP, atributos del endpoint | C | Autoridad del endpoint. |
| Host → puerto directo | `host.portRef` | C/R | Canónico solo cuando no existe ruta estructurada; si existe, es espejo legacy. |
| Host → equipo | `host.connectedDeviceId` | R | Espejo de compatibilidad; el equipo se deriva del puerto/ruta física. |
| Puerto resuelto del host | `hostResolvedPortId()` / `StructuredCabling.hostAccess()` | D | Usa cableado estructurado primero y conexión directa como fallback. |
| VLAN | `vlans[]` | C | Identidad y metadatos de VLAN. |
| Subnet | `subnets[]` | C | Única autoridad persistida de CIDR/gateway por VLAN. |
| Edición manual subnet | formulario manual | A | Único camino explícito que puede insertar directamente una subnet. |
| Asignación rápida | `buildFixedSubnetPlan/applySubnetPlan` | A | Solo completa VLANs sin subnet y no reemplaza asignaciones existentes. |
| VLSM | `buildVlsmPlan/applySubnetPlan` | A | Replanificación revisable; materializa sobre `subnets[]`. |
| Wizard / Change Plan | reutilizan el planificador de subnetting | A | No implementan un motor paralelo de direccionamiento. |
| Observación de config | `observedState` y capturas por dispositivo | O | Evidencia real para drift/preflight; no sustituye el To-Be. |
| Config local/source | salida de generadores browser source-only | D | Preview de diseño/compatibilidad; **no certifica apply-ready**. |
| Config privada | artefactos del Private Engine | D | Derivados server-side; no se persisten dentro del snapshot del proyecto. |
| Readiness de config | `configReadiness[deviceId]` | D | `apply-ready`, `review-required` o `procedure-only`; no equivale a Production Gate. |
| Readiness global | `productionStatus/productionReady` | D | Autoridad final para presentar un deployment como listo para producción. |
| Generación privada | Private Deployment Plan | A | Deriva configs, change set, incremental plan, runbook, rollback y gate desde la revisión autorizada. |

## Representaciones que no deben reaparecer como autoridad paralela

No deben introducirse colecciones alternativas como `inventoryDevices`, `designDevices`, `inventoryPorts` o `plannedSubnets` para duplicar entidades ya canónicas. Las diferencias Inventory/Design se expresan mediante workflow, atributos To-Be/As-Built, referencias y valores derivados.

Los espejos legacy se conservan solo por compatibilidad 3.50. Cuando existe una autoridad más fuerte —por ejemplo `rackItems` para colocación o cableado estructurado para un host— la UI debe impedir editar en paralelo el espejo.

## Navegación canónica

### Diseño To-Be

`Panel → Asistente de diseño → Ubicaciones → Dispositivos → Inventario físico → Puertos → VLANs/Subnets → Hosts → IoT → Vistas → Enlaces → Firewall → Validación → Despliegue`

El Asistente es una **acción de bootstrap To-Be**, no una segunda autoridad del proyecto.

### Inventario As-Built

`Panel → Ubicaciones → Dispositivos → Inventario físico → Puertos → Enlaces → VLANs/Subnets → Hosts → IoT → Vistas → Firewall → Validación → Despliegue`

Golden Path físico:

`Ubicación → rack contenedor → equipo → colocación/alimentación → puertos → cableado → lógica observada`

El Wizard de diseño no forma parte del recorrido de Inventario.

## Configuración programable

La existencia de texto de configuración no implica que sea directamente aplicable.

- **apply-ready:** el artefacto ha superado las comprobaciones de aplicabilidad específicas implementadas para ese vendor.
- **review-required:** existe CLI/artefacto, pero quedan inferencias, placeholders, secretos o decisiones que requieren revisión.
- **procedure-only:** el destino se opera mediante controlador/GUI/API/procedimiento y no mediante una CLI universal pegable.
- **source-preview:** salida local/source útil para diseño, pero no certificada por el Private Engine.
- **pending:** todavía no existe artefacto privado para esa revisión.

Incluso un artefacto `apply-ready` necesita que la **Production Gate global** esté en `ready` antes de presentar el deployment completo como listo.

## Persistencia y compatibilidad

- El snapshot sigue usando `_schemaVersion: 3.50.0`.
- Ninguno de estos cambios crea una colección persistida nueva.
- Offline/Source conserva las capacidades locales aceptadas.
- SaaS/Docker mantiene la lógica vendor propietaria y la certificación de aplicabilidad en el Private Engine.


## Separación de superficies de UX

- **Vistas**: V5 es la vista operativa principal y Topología física la vista de cableado/enlaces. Los grafos unificados experimentales no son una tercera autoridad visual.
- **Validación**: contiene análisis derivados (compatibilidad, capacidad, resiliencia, servicios, fallos y estado observado). No escribe una segunda fuente de verdad.
- **Despliegue**: consume el proyecto vigente para generar artefactos privados, readiness, incremental/rollback y exportaciones.
