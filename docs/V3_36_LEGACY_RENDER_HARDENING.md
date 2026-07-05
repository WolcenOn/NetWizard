# NetWizard v3.37 · Legacy Render Hardening

Esta versión continúa la revisión XSS iniciada en v3.34/v3.35, reduciendo `innerHTML` en zonas críticas de la vista V5 y sustituyendo parte del render legacy por construcción DOM segura.

## Cambios principales

- `netwizard-v5-layout-manager.js` ya no usa `innerHTML` para los controles de layout V5/unificado.
- `renderUnifiedDetails(...)` ahora construye el panel de detalle con `createElement` y `textContent`, evitando interpolar datos importados como HTML.
- Se mantiene `innerHTML` solo para fragmentos estáticos o zonas legacy ya auditadas, pero el objetivo de mantenimiento es seguir reduciéndolo gradualmente.
- El schema externo acepta exportaciones `3.37.0`.

## Regla de mantenimiento

Cuando se rendericen datos procedentes del proyecto, preferir siempre:

```js
node.textContent = userValue;
```

en vez de:

```js
node.innerHTML = userValue;
```

Si una plantilla necesita HTML, usar helpers de `NetWizardSecurityUtils` y escapar datos dinámicos.
