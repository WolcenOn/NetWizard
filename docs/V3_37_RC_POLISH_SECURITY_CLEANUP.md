# NetWizard v3.37 · RC Polish & Security Cleanup

Esta versión corrige detalles detectados en la revisión externa de la v3.36 y continúa reduciendo superficie XSS legacy sin introducir funciones nuevas.

## Correcciones de RC

- El E2E de producción ahora espera explícitamente `schemaVersion: 3.37.0`.
- El README referencia correctamente `docs/V3_33_RC_HARDENING_FIXES.md`.
- El schema externo acepta exportaciones `3.37.0`.
- `package-lock.json` queda actualizado a la versión 3.37.

## Hardening XSS adicional

Se migraron a construcción DOM segura estas zonas de alto uso:

- `renderHosts()`
- `renderLinks()`
- panel de hosts conectados en el modal de puerto

Estas zonas ya no interpolan directamente nombres de hosts, ubicaciones, puertos, notas o enlaces con `innerHTML`; usan `createElement`, `textContent`, `createTextNode` y `addEventListener`.

## Lectura correcta de `npm run audit:xss`

El auditor XSS es heurístico y conservador. Cuando marca patrones para revisión manual, no significa necesariamente que existan vulnerabilidades confirmadas. Significa que hay renders legacy o sinks HTML que conviene revisar antes de una distribución amplia.

La política de mantenimiento recomendada es:

1. Preferir `textContent` para datos de proyecto.
2. Usar `createElement` y listeners normales en listados/tablas nuevos.
3. Usar `NetWizardSecurityUtils.escapeHtml/escapeAttr/inlineJsString` solo cuando sea imprescindible conservar HTML legacy.
4. No introducir nuevos `onclick="..."` con datos de proyecto.

## Validación recomendada

```bash
npm ci
npm test
npm run check:syntax
npm run audit:xss
npm run test:e2e:install
npm run test:e2e
npm run build:zip
```

Si los E2E pasan en un entorno con Chromium instalado y la Puerta de Producción no muestra bloqueos en el proyecto real, esta rama puede considerarse RC local/controlada para demo, validación comercial y uso interno supervisado.
