# NetWizard v3.38 · Legacy Render Migration

Esta versión continúa el hardening XSS iniciado en v3.34-v3.37 y reduce más superficie legacy basada en `innerHTML`.

## Cambios principales

- Migrado `renderDevs()` a construcción DOM segura con `createElement`, `textContent` y listeners normales.
- Migrado `renderPortsList()` a construcción DOM segura.
- Migrado `renderFwRules()` a construcción DOM segura.
- Migrado `renderDhcp()` a construcción DOM segura para controles de scopes DHCP.
- Actualizada la versión visible y los tests de schema a `3.38.0`.
- Actualizado el auditor XSS con reporte `docs/XSS_AUDIT_REPORT_V3_38.txt`.

## Regla de mantenimiento

Cuando un valor procede del proyecto, un JSON importado o un campo editable por el usuario, debe renderizarse con `textContent`/`createTextNode` siempre que sea posible. Usar `innerHTML` solo para plantillas estáticas o con escape explícito revisado.
