# NetWizard v3.43 · Legacy Render Migration VI

Esta versión continúa el cierre de superficie XSS legacy. El objetivo principal ha sido eliminar los últimos `innerHTML` detectados por el auditor ligero en módulos de UI y moverlos a construcción DOM segura o a fragmentos HTML estáticos controlados.

## Cambios principales

- Migrado el panel de detalle IoT embebido a `replaceChildren`, `createElement`, `textContent` y `dataset`.
- Migrado el panel V5 IoT extension a render DOM seguro y listeners normales.
- Migrado el mapa unificado de configuración, filtros y leyenda a DOM seguro.
- Migradas tarjetas auxiliares restantes: modo ejecución, plan común, puerta producción, vendor hardening, intención VLAN, VLSM/readiness/física, documentación, broadcast y L2.
- El auditor XSS ahora excluye `tests/` para no contabilizar casos de prueba diseñados precisamente para validar escapes.
- Actualizado schema externo, tests y versión visible a `3.43.0`.

## Resultado de auditoría XSS

```text
XSS audit: 0 HTML sinks reviewed, 0 patterns require manual review.
```

Esto no significa que exista una garantía absoluta de ausencia de XSS, pero sí que el auditor ligero ya no detecta los patrones legacy que veníamos reduciendo. La regla de mantenimiento sigue siendo: no introducir `innerHTML` con datos de proyecto. Para datos importados, usar `textContent`, `setSafeText`, `escapeHtml`, `escapeAttr` o builders DOM.
