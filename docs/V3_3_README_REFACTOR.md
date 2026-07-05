# NetWizard v3.3 · README actualizado y refactor inicial

## Objetivo

Esta versión aborda dos mejoras de mantenimiento:

1. Actualizar README/versionado para que la documentación principal ya no apunte a versiones antiguas.
2. Iniciar un refactor gradual de `js/netwizard.js` extrayendo helpers puros sin cambiar el comportamiento funcional.

## Archivos añadidos

- `js/netwizard-core-utils.js`

Este archivo funciona tanto en navegador clásico como en Node.js. Expone `window.NetWizardCoreUtils` y `module.exports` cuando se ejecuta en tests.

Helpers incluidos:

- `escapeHtml(value)`
- `cleanStr(value)`
- `uid(prefix)`
- `cmpMixed(a, b, locale)`
- `parseAllowed(value)`
- `maskToString(mask, ip4s)`
- `buildPortName(vendorOs, media, pos, base)`
- `normalizeProjectShape(project, defaults)`

## Cambios en `netwizard.js`

`netwizard.js` ahora consume `window.NetWizardCoreUtils` cuando existe y conserva fallbacks locales mínimos. Esto mantiene el enfoque de refactor seguro: si el helper externo no carga, la aplicación conserva el comportamiento esencial.

También se centralizó la normalización de ramas obligatorias del proyecto mediante `normalizeProjectShape`, reduciendo lógica repetida para `vtp`, `visual`, `iot`, ubicaciones físicas y preferencias UI.

## Cambios en `index.html`

Se carga `js/netwizard-core-utils.js` antes de `js/netwizard.js`.

## Cambios en tests

`tests/run-tests.js` ahora cubre:

- Limpieza y escape HTML.
- Parseo de VLANs permitidas.
- Construcción de nombres de puertos.
- Normalización de forma del proyecto.

## Comandos de verificación

```bash
npm test
npm run check:syntax
```

## Riesgo y compatibilidad

El cambio es deliberadamente pequeño. No convierte la app a módulos ES ni mueve generadores, renderizadores o handlers de UI. Solo extrae helpers puros que ya eran candidatos claros a modularización.
