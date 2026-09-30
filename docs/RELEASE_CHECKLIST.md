# Checklist de release

## Antes de empaquetar

- [ ] Confirmar la versión de aplicación en `package.json` y `VERSION`.
- [ ] **Solo si cambia el formato persistido**, actualizar `SCHEMA_VERSION`, `schemas/netwizard-project.schema.json` y las migraciones/compatibilidad necesarias. No subir `_schemaVersion` por cambios de UI, backend o lógica que no alteren el snapshot.
- [ ] Añadir o actualizar la documentación de release cuando exista un cambio relevante.
- [ ] Actualizar README solo si cambian instalación, uso o capacidades públicas.
- [ ] Añadir/actualizar tests para cada cambio funcional.

## CI obligatorio

Antes de considerar una PR lista para merge deben estar en verde los cuatro jobs de `NetWizard CI`:

- [ ] `Quality checks` — incluye `npm run release:check` y `npm run build:pages`.
- [ ] `Go backend tests` — incluye integración PostgreSQL cuando `NETWIZARD_TEST_DATABASE_URL` está disponible.
- [ ] `Playwright E2E`.
- [ ] `Docker build` — además de construir la imagen, arranca el contenedor y ejecuta `playwright.production.config.js` contra el navegador productivo.

No se considera cerrado un bloque si falla Playwright source, el smoke Playwright productivo o Docker.

## Frontera Client Engine / Private Engine

- [ ] `tests/production-private-boundary.test.js` confirma que los módulos marcados `production:false` no aparecen en el entrypoint SaaS.
- [ ] El Docker de producción no publica `/private`, source maps ni fuentes TypeScript.
- [ ] Los workers privados se empaquetan en `/app/private` y no como assets públicos.
- [ ] La generación vendor y la Production Gate privada no forman parte del entrypoint browser.
- [ ] Source/Pages/offline mantienen los módulos source-only necesarios para compatibilidad local.
- [ ] `tests/e2e-production/production-browser.spec.js` confirma en la imagen real que los generadores source-only no existen en `window`, abre una sesión self-hosted y recibe la configuración del dispositivo desde el Private Engine server-side.

## Seguridad y autoridad de servidor

- [ ] `backend/internal/auth/*_test.go` valida sesiones/OIDC.
- [ ] `backend/internal/httpapi/remote_api_test.go` valida autenticación, CSRF, matriz de roles, control optimista de versión, rate limiting y auditoría de escrituras.
- [ ] `backend/internal/httpapi/private_services_api_test.go` valida autorización, revisión almacenada, control de versión y auditoría de endpoints privados.
- [ ] `backend/internal/storage/postgres/e4_integration_test.go` valida persistencia de sesiones/workspaces, auditoría y rate limiting en PostgreSQL.
- [ ] En SaaS, los endpoints privados consumen la revisión autorizada almacenada; no aceptan snapshots arbitrarios del navegador.
- [ ] En self-hosted, el único endpoint que acepta snapshot exige modo explícito, autorización inicial con token distinto de la service key, cookie HttpOnly/SameSite=Strict firmada y persistente entre restarts, CSRF, same-origin, rate limit, tamaño máximo y schema 3.50.
- [ ] El runner privado no hereda variables de entorno del proceso servidor (`cmd.Env=[]`), evitando exponer service key/token al worker.
- [ ] `productionReady=true` solo se acepta con `productionStatus=ready` y contrato `netwizard-private-production-gate-v1`.
- [ ] La UI distingue `apply-ready`, `review-required`, `procedure-only`, preview local y pending; `apply-ready` por dispositivo no se presenta como sustituto de la Production Gate global.

## Arquitectura de información

- [ ] Vistas gráficas expone únicamente V5 principal y Topología física.
- [ ] Los prototipos Bridge/grafo unificado no aparecen en navegación ni Export.
- [ ] Compatibilidad, capacidad, resiliencia, WAN/servicios, Wi-Fi, IPv6/VRF, fallos y observed/drift se muestran en **Validación & análisis**, no en Despliegue.
- [ ] **Despliegue & Exportación** mantiene generación server-side, readiness y exportaciones como responsabilidad principal.
- [ ] Los módulos derivados no crean nuevas colecciones persistidas ni otra autoridad del proyecto.

## Validación funcional manual

- [ ] Importar samples.
- [ ] Validar `samples/production-scenarios.json` sin avisos inesperados.
- [ ] Ejecutar Private Deployment Plan en cloud y revisar `productionStatus` por separado de `ok`.
- [ ] Si se publica modo self-hosted, autorizar el navegador con el token de operador, generar una config, comprobar que la sesión sobrevive a un restart y revocar el navegador verificando que la vista deja de usar el artefacto privado.
- [ ] Confirmar que un escenario de failure simulation contractualmente obligatorio que no sobrevive deja la puerta bloqueada.
- [ ] Revisar drift observado → deseado y no tratar el diff como comandos directos.
- [ ] Confirmar ticket, ventana, aprobador, acceso OOB y backups reales antes del cambio.
- [ ] Ensayar criterios de parada y rollback.
- [ ] Capturar evidencias posteriores al cambio.
- [ ] Exportar inventario/documentación y verificar reimportación de un snapshot 3.50 existente.
- [ ] Revisar `docs/MODEL_AUTHORITY.md`: rack placement, host cabling, subnetting y configuración deben conservar una sola autoridad por concepto.

## Criterio RC

Una versión puede marcarse como candidata cuando no hay errores bloqueantes conocidos, los cuatro jobs de CI están en verde y la frontera pública/privada y las garantías de autoridad anteriores siguen verificadas.
