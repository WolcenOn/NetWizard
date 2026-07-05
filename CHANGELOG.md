# Changelog


## 3.48.0 · Sistema i18n ampliable

- Añadido `i18n/locales.json` como manifiesto de idiomas.
- Añadidos scripts `i18n:check`, `i18n:sync`, `i18n:new` e `i18n:audit`.
- `netwizard-i18n.js` se genera desde los JSON de idioma y soporta registro/carga de idiomas.
- Añadida guía de mantenimiento i18n y auditoría de textos hardcoded.
- Tests ampliados para verificar idiomas dinámicos y manifiesto.

## 3.48.0 · i18n full UI pass

- Ampliada la traducción ES/EN a más formularios, botones, secciones y textos dinámicos de UI.
- Añadida traducción exacta segura de textos visibles generados por renders legacy.
- `refresh()` aplica i18n al final del render central.
- Mantiene schema interno y JSON sin traducir.


## 3.48.0 · i18n reports & audit messages

- Ampliada traducción ES/EN a Puerta de producción.
- Checklist Markdown de producción localizado según idioma de informes.
- Guía de corrección con cabeceras y severidades localizadas.
- Matriz de conectividad con motivos básicos traducibles.
- Tests i18n adicionales para informes y checklist.

## 3.48.0 · i18n ES/EN inicial

- Añadido `js/netwizard-i18n.js`.
- Añadidos diccionarios `i18n/es.json` e `i18n/en.json`.
- Selector de idioma de interfaz e informes.
- Traducción inicial de navegación, dashboard y tarjeta de documentación.
- Documentación Markdown básica localizada ES/EN.
- Tests i18n para paridad de claves, fallback y traducciones sin HTML.

## 3.48.0 · Legacy Render Migration V

- Migrado el panel clásico V5 (`renderV5Panel`) a construcción DOM segura y listeners normales.
- Migrado el editor de puertos V5 a DOM seguro (`renderPortEditorDom`).
- El tooltip de enlaces V5 deja de usar `innerHTML` y renderiza con nodos de texto.
- Migrados selectores RoaS a opciones DOM seguras.
- Migrado el panel IoT embebido: estadísticas, listas, selectores, panel de detalle y acciones con `dataset`.
- Migrado el panel PoE a tablas e inputs construidos con DOM APIs.
- Auditor XSS reducido a 21 sinks revisados / 12 patrones para revisión manual.
- Añadido `docs/V3_42_LEGACY_RENDER_MIGRATION_V.md`.

## 3.40.0 · Legacy Render Migration III

- Migrado `netwizard-connectivity-checker.js` a construcción DOM segura.
- Migrado `netwizard-graph-viewer.js` para evitar `innerHTML` en el visor, resumen y detalles.
- Migrado `netwizard-history.js` para renderizar snapshots sin plantillas HTML interpoladas.
- Migrado el panel de detalles de `netwizard-unified-config-map.js` a DOM seguro.
- Actualizado el informe `docs/XSS_AUDIT_REPORT_V3_40.txt`.

## 3.39.0 · Legacy Render Migration II

- Migrado `renderVlans()` y `renderSubnets()` a construcción DOM segura.
- Migrado `renderVlanMatrix()` a DOM seguro, eliminando HTML interpolado con nombres de VLAN.
- Migrado `renderFwTplModal()`, `renderDevPickCfg()` y `renderVtp()` a DOM seguro.
- Endurecidos los pills de vendor y metadatos del modal de configuración.
- Añadidos helpers internos `safeColor`, `addOption` y `renderVendorPills`.
- Actualizado el informe `docs/XSS_AUDIT_REPORT_V3_39.txt`.

## 3.38.0 · Legacy Render Migration

- Migrado `renderDevs()` a construcción DOM segura.
- Migrado `renderPortsList()` a construcción DOM segura.
- Migrado `renderFwRules()` a construcción DOM segura.
- Migrado `renderDhcp()` a construcción DOM segura.
- Actualizados tests de schema y E2E a `3.38.0`.
- Añadido `docs/V3_38_LEGACY_RENDER_MIGRATION.md`.

## 3.37.0 · RC Polish & Security Cleanup

- Corregido el E2E de producción para esperar explícitamente `schemaVersion: 3.37.0`.
- Corregida la referencia del README a `docs/V3_33_RC_HARDENING_FIXES.md`.
- Migrado `renderHosts()` a construcción DOM segura con `createElement`, `textContent` y listeners normales.
- Migrado `renderLinks()` a construcción DOM segura con `createElement`, `textContent` y listeners normales.
- Endurecido el panel de hosts conectados del modal de puerto, evitando interpolar nombres de hosts con `innerHTML`.
- Añadida documentación de pulido RC y lectura correcta del resultado de `npm run audit:xss`.

## 3.36.0 · Legacy Render Hardening

- Reducido el uso de `innerHTML` en `netwizard-v5-layout-manager.js`.
- Los controles de layout V5/unificado se crean ahora con DOM APIs y listeners normales.
- `renderUnifiedDetails(...)` construye el panel con `createElement`/`textContent`, evitando interpolar datos del proyecto como HTML.
- Añadido `docs/V3_36_LEGACY_RENDER_HARDENING.md`.

## 3.35.0 · Detailed XSS Review

- Añadidos `escapeJsString` e `inlineJsString` a `NetWizardSecurityUtils`.
- Añadido helper `jsq` para handlers inline legacy de V5.
- Endurecidos atributos y callbacks inline sensibles en `netwizard.js`.
- Añadido `scripts/audit-xss.js` y reporte `docs/XSS_AUDIT_REPORT_V3_35.txt`.
- Añadidos tests de regresión XSS para literales JS inline y V5.

## 3.34.0 · XSS hardening ampliado

- Añadido `netwizard-security-utils.js` con helpers centralizados de escape.
- Endurecidos renders V5/IoT/unified map para datos procedentes del proyecto.
- Añadidos tests de regresión XSS y revisión estática de interpolaciones sensibles.

## 3.33.0 · RC Hardening Fixes

- Añadido `package-lock.json` para instalaciones reproducibles.
- Ajustados scripts E2E para usar `npx playwright`.
- Corregido E2E que esperaba `schemaVersion: 3.29.0`.
- Añadida licencia privada/evaluación controlada.
- Añadido script `npm run build:zip` para empaquetado reproducible.
- Añadida versión visible en la barra superior de la app.

## 3.32.0 · Release Candidate + mantenimiento

- Documentación final de RC local/controlada.
- Guías de mantenimiento, limitaciones conocidas y checklist de release.
- Comentarios de mantenimiento en módulos críticos.

## Historial anterior

Las versiones v3.1 a v3.31 están documentadas en `docs/V3_*`.
