# NetWizard v3.50.0 RC · generadores y modelo consolidados

> v3.50 incorpora un registro determinista de generadores y formaliza el modelo avanzado del proyecto sin perder compatibilidad de importación con 3.28–3.48.

NetWizard `3.50.0` es la **línea candidata de consolidación funcional** para uso local/controlado. Mantiene el hardening XSS, migra automáticamente los proyectos anteriores y genera exportaciones con schema `3.50.0`.

La versión canónica se declara en `VERSION`. La línea 3.48 continúa documentada como baseline histórica en `docs/STABLE_BASELINE_3_48.md`.

## Qué incluye esta rama

- Diseño físico y lógico de red.
- VLANs, VLSM, DHCP avanzado, tránsito L3 e IPs de interfaces routed.
- Rutas estáticas básicas.
- Políticas firewall/ACL desde intención por VLAN.
- Cableado, longitudes, PoE y riesgo broadcast.
- Auditoría L1/L2/L3/IP/DHCP/PoE/políticas/vendor.
- Puerta de producción con guía de corrección y checklist Markdown.
- Paquete de despliegue ZIP con puerta estricta, configuraciones por dispositivo, snapshot 3.50, inventario, matriz, documentación, checklist, manifiesto CRC32 y runbook reversible.
- Secuenciación operativa por dependencias: borde, core, acceso, servicios/controladores y APs; incluye protección HA/MLAG, criterios de parada y rollback inverso.
- Exportaciones individuales de configuración, inventario CSV, matriz de conectividad y documentación Markdown.
- Schema externo, samples y tests unitarios/E2E preparados.
- Matriz de escenarios de producción 3.50: oficina, campus, IoT/cámaras y tránsito L3 con estado esperado, avisos aceptados y firmas de configuración por dispositivo.
- Registro inspeccionable de renderers y etapas de configuración, sin wrappers globales dependientes del orden de carga.
- Registro canónico de dispositivos y fabricantes: `kind` distingue switch, router, firewall, AP, controlador WLAN, servidor gestionado y appliance; `type` se conserva como espejo compatible durante 3.50.
- Modelo 3.50 para routing, HA, seguridad, gestión, WAN, Wi-Fi, IPv6/VRF, resiliencia, capacidad, servicios y drift.
- `package-lock.json`, licencia, changelog y script de empaquetado reproducible.

## Uso rápido

```bash
npm install
npm test
npm run check:syntax
python3 -m http.server 8000
```

Después abre `http://localhost:8000`.

## Pruebas E2E

```bash
npm run test:e2e:install
npm run test:e2e
```

Para considerar una entrega lista en tu entorno, ejecuta también los E2E con Chromium instalado.

## Estado de producción

Esta versión queda como **candidata de producción local/controlada** cuando pasan:

1. `npm run release:check`
2. `npm run test:e2e`
3. Puerta de producción sin errores bloqueantes en el proyecto real
4. Revisión manual de las exportaciones vendor utilizadas

No es todavía una plataforma SaaS multiusuario: no incluye backend, autenticación, roles, logs centralizados ni backups remotos.

## Empaquetado

```bash
npm run build:zip
```

El ZIP se genera en `dist/`.

## Documentación clave

- `docs/STABLE_BASELINE_3_48.md`
- `docs/PRODUCTION_READINESS.md`
- `docs/MAINTENANCE_GUIDE.md`
- `docs/RELEASE_CHECKLIST.md`
- `docs/V3_50_PRODUCTION_SCENARIOS.md`
- `docs/V3_50_DEPLOYMENT_BUNDLE.md`
- `docs/V3_50_DEPLOYMENT_RUNBOOK.md`
- `docs/LIMITATIONS_KNOWN.md`
- `docs/V3_42_LEGACY_RENDER_MIGRATION_V.md`
- `docs/V3_38_LEGACY_RENDER_MIGRATION.md`
- `docs/V3_33_RC_HARDENING_FIXES.md`
- `CHANGELOG.md`
- `LICENSE`
- `schemas/netwizard-project.schema.json`
- `samples/*.json`

## Auditoría XSS estática

```bash
npm run audit:xss
```

El auditor es heurístico y marca puntos que requieren revisión manual, especialmente usos legacy de `innerHTML`.

## v3.50 · Registro de configuración y schema

El runtime expone `NetWizardConfigPipeline.inspect()` para comprobar los renderers y etapas activos. `NetWizardDeviceModel` centraliza tipos, capacidades básicas, iconos y fabricantes. `NetWizardProjectSchema.prepareImport()` migra proyectos compatibles a 3.50 —incluidos AP antiguos representados como switches— y devuelve `sourceSchemaVersion` y la lista `migrations`; `prepareExport()` produce siempre el contrato canónico 3.50.

Los proyectos de `samples/` ya están exportados nativamente como 3.50. `samples/production-scenarios.json` define su contrato automático de aceptación. La puerta expone `NetWizardProductionGate.evaluateReleaseCriteria(report, policy)` para distinguir entre un aviso expresamente aceptado y una regresión nueva. Los samples también forman parte del artefacto publicado en Pages.

La acción principal **Exportar** genera ahora el paquete de despliegue ZIP. Esta ruta siempre usa la puerta estricta de producción aunque la interfaz esté en modo demo: los errores bloquean la descarga y los avisos se conservan dentro del informe y del checklist.

El paquete incorpora `deployment/plan.json`, `deployment/runbook.md` y `deployment/rollback-checklist.md`. El snapshot de NetWizard documenta el diseño deseado, pero no reemplaza el backup real de cada equipo.

## v3.48 · Sistema i18n ampliable

Esta versión añade una base preparada para traducir NetWizard completamente y para incorporar nuevos idiomas sin tocar el modelo interno.

Comandos principales:

```bash
npm run i18n:check
npm run i18n:sync
npm run i18n:new -- pt-BR "Português (Brasil)" en
npm run i18n:audit
```

Documentación:

- `docs/V3_48_I18N_EXTENSION_SYSTEM.md`
- `docs/I18N_MAINTENANCE.md`
- `docs/I18N_HARDCODED_AUDIT.txt`

## v3.48

Más detalles en `docs/V3_48_I18N_FULL_UI_PASS.md`.
