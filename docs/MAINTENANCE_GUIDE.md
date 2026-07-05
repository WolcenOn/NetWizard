# Guía de mantenimiento

## Estructura mental del proyecto

NetWizard sigue siendo una aplicación web estática. Los módulos nuevos están separados para reducir el riesgo sobre `js/netwizard.js`.

Capas principales:

1. Estado y schema: `netwizard-project-schema.js`, `NetWizardState` en `netwizard.js`.
2. Utilidades base: `netwizard-core-utils.js`, `netwizard-network-utils.js`.
3. Planificación: VLSM, DHCP, tránsito L3, rutas, políticas.
4. Auditorías: L1/L2/IP/DHCP/PoE/Broadcast/Vendor/Producción.
5. Exportación: configuraciones vendor, inventario, documentación.
6. UI: tarjetas inyectadas por módulos y vistas existentes en `netwizard.js`.

## Reglas para cambios futuros

- Añadir funciones nuevas como módulos testeables antes de tocar UI.
- Mantener funciones de cálculo puras cuando sea posible.
- No modificar `localStorage` desde módulos de preview/diff.
- Antes de aplicar automatismos, generar diff y snapshot.
- Añadir códigos de auditoría estables `NW-*` para nuevas reglas.
- Actualizar `schemas/netwizard-project.schema.json` cuando cambie el formato exportado.
- Añadir tests unitarios y, si afecta a UI, tests Playwright.

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
