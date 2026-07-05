# NetWizard v3.35 · Revisión XSS detallada

Esta versión continúa el hardening iniciado en v3.33/v3.34. El objetivo no es añadir funcionalidades nuevas, sino reducir superficie XSS en renders legacy y dejar una herramienta de auditoría para futuras revisiones.

## Cambios principales

- `NetWizardSecurityUtils` sube a `v3.35`.
- Se añaden helpers para literales JavaScript embebidos en atributos inline legacy:
  - `escapeJsString(value)`
  - `inlineJsString(value)`
- Se añade alias `jsq(...)` en `netwizard.js` para handlers inline históricos de la vista V5.
- Se refuerzan `option value`, `data-*` y callbacks inline sensibles con `attr(...)`/`jsq(...)`.
- Se añade `scripts/audit-xss.js` para localizar sinks HTML y patrones que requieren revisión manual.
- Se añade `docs/XSS_AUDIT_REPORT_V3_35.txt` con el resultado de auditoría estática heurística.

## Importante

`audit:xss` es deliberadamente conservador: marca muchos falsos positivos porque `innerHTML` se usa mucho para plantillas estáticas y tablas que ya escapan datos con `esc(...)`. El informe sirve para guiar revisión manual, no para declarar automáticamente una vulnerabilidad.

## Reglas de mantenimiento

1. Usar `textContent` cuando no haga falta HTML.
2. Usar `esc(...)`/`escapeHtml(...)` para texto interpolado en HTML.
3. Usar `attr(...)`/`escapeAttr(...)` para valores de atributos.
4. Usar `jsq(...)`/`inlineJsString(...)` para IDs o texto dentro de handlers inline legacy.
5. Evitar nuevos `onclick="...${datoProyecto}..."`; preferir `data-*` + `addEventListener`.
6. Cualquier import JSON debe considerarse no confiable.

## Verificaciones

- `npm test`
- `npm run check:syntax`
- `npm run audit:xss`
- `npm run build:zip`
