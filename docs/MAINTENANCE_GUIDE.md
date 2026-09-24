# Guía de mantenimiento

## Estructura mental del proyecto

NetWizard sigue siendo **client-first** y conserva su modo local, pero ya dispone de un backend Go para serving/API base y fundamentos de colaboración. Los módulos nuevos deben mantenerse separados para reducir el riesgo sobre `js/netwizard.js` y evitar duplicar lógica de dominio entre JavaScript y Go.

Capas principales:

1. Estado y schema: `netwizard-project-schema.js`, `NetWizardState` en `netwizard.js`.
2. Utilidades base: `netwizard-core-utils.js`, `netwizard-network-utils.js`.
3. Planificación: VLSM, DHCP, tránsito L3, rutas, políticas.
4. Auditorías: L1/L2/IP/DHCP/PoE/Broadcast/Vendor/Producción.
5. Modelo físico: racks, rack items, PDU/alimentación y cableado estructurado (`netwizard-rack-model.js`, `netwizard-structured-cabling.js`).
6. Exportación: configuraciones vendor, inventario, documentación y paquete de despliegue.
7. UI: tarjetas inyectadas por módulos y vistas existentes en `netwizard.js`. V5 está separada en core, renderer, interaction, scene, drag controller, panel, commands, location transactions, controls y bridge; `netwizard.js` actúa como adaptador hacia el estado/persistencia legacy.
8. Backend: `backend/internal/config`, `httpapi` y `realtime`; su frontera con el cliente se define en `docs/BACKEND_BOUNDARIES.md`.

## Reglas para cambios futuros

- Añadir funciones nuevas como módulos testeables antes de tocar UI.
- Mantener funciones de cálculo puras cuando sea posible.
- No modificar `localStorage` desde módulos de preview/diff.
- Antes de aplicar automatismos, generar diff y snapshot.
- Añadir códigos de auditoría estables `NW-*` para nuevas reglas.
- Actualizar `schemas/netwizard-project.schema.json` cuando cambie el formato exportado.
- Mantener sincronizados schema externo y `NetWizardProjectSchema`; cualquier nueva rama física debe tener test de contrato externo.
- No introducir campos opcionales ausentes como `null` si un validador legacy diferencia entre ausencia y valor; preservar semántica de importación existente.
- Añadir tests unitarios y, si afecta a UI, tests Playwright.
- Todo cambio Go debe quedar cubierto por `go test ./...`; si afecta al despliegue, validar también `docker build .`.
- No duplicar validadores, generadores o reglas de negocio frontend en Go sin un contrato versionado y tests de paridad.
- Mantener el modo local funcional mientras el modo colaborativo no se declare como requisito obligatorio.
- Las extensiones V5 nuevas deben consumir `window.NetWizardV5` y no globals internos de `netwizard.js` cuando exista equivalente en el bridge.
- Las reglas V5 puras de estado, filtros, aliases, jerarquía, inferencia o geometría deben añadirse a `netwizard-v5-core.js` con tests unitarios.
- La composición del frame pertenece a `netwizard-v5-scene.js` y la sesión pointer/drag a `netwizard-v5-drag-controller.js`.
- Las mutaciones iniciadas desde V5 deben entrar por `netwizard-v5-commands.js`; el panel `netwizard-v5-panel.js` queda limitado a presentación DOM y delegación de acciones.
- No usar `innerHTML` en el panel V5 para datos de proyecto.
- Las altas, renombres y bajas de ubicaciones que afecten a referencias físicas/visuales deben planificarse con `netwizard-v5-location-transactions.js` antes de aplicar el commit.
- Toolbar, filtros, fullscreen, Escape y resize V5 pertenecen a `netwizard-v5-controls.js`; no añadir listeners globales equivalentes a `netwizard.js`.
- Al eliminar una ubicación deben quedar resueltas también referencias de equipos, hosts, racks, tomas y asignaciones V5.
- El dibujo V5 debe añadirse a `netwizard-v5-renderer.js`; hit-testing y matemáticas de interacción a `netwizard-v5-interaction.js`. Evitar reintroducir esos cálculos en `netwizard.js`.

## Comentarios de código

Los módulos críticos incluyen bloques `Mantenimiento:` que indican invariantes importantes. Si se cambia una función marcada como crítica, actualizar también:

- tests unitarios,
- documentación de la versión,
- Puerta de producción si cambia la severidad,
- schema externo si cambia el modelo.

## Convención de severidades

- `error`: debe bloquear producción/exportación.
- `warning`: requiere revisión humana.
- `info`: recomendación o contexto.

En modo demo se debe permitir más flexibilidad; en modo producción se puede elevar severidad solo si el dato es suficientemente concluyente.

- La orquestación del frame V5 pertenece a `netwizard-v5-scene.js`; no volver a expandir `drawV5()` dentro de `netwizard.js`.
- El ciclo pointer/drag pertenece a `netwizard-v5-drag-controller.js`; las mutaciones de dominio se inyectan como callbacks.
