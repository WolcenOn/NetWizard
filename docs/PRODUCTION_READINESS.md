# Preparación para producción local/controlada y SaaS

NetWizard considera separadas la preparación del proyecto y la preparación de la plataforma. Ninguna de las dos sustituye a la otra.

## Validaciones técnicas obligatorias

El workflow `NetWizard CI` es la referencia de release y debe completar:

1. `Quality checks`: `npm run release:check` y `npm run build:pages`.
2. `Go backend tests`: `go test ./...` con PostgreSQL de integración.
3. `Playwright E2E`.
4. `Docker build`: construye la imagen y, dentro del mismo job, arranca el contenedor y ejecuta un smoke Playwright contra el navegador productivo.

Localmente pueden reproducirse con:

```bash
npm ci
npm run release:check
go test ./...
npm run test:e2e:install
npm run test:e2e
docker build -t netwizard-local .
docker run --rm -p 8080:8080 --name netwizard-local \
  -e NETWIZARD_SELF_HOSTED_PRIVATE=true \
  -e NETWIZARD_PRIVATE_SERVICE_KEY="<clave-servidor-32+-bytes>" \
  -e NETWIZARD_SELF_HOSTED_PRIVATE_TOKEN="<token-operador-distinto-32+-bytes>" \
  netwizard-local
# En otra terminal:
NETWIZARD_PRODUCTION_BASE_URL=http://127.0.0.1:8080 \
NETWIZARD_TEST_SELF_HOSTED_TOKEN="<token-operador-distinto-32+-bytes>" \
npx playwright test --config=playwright.production.config.js
```

No se considera listo un bloque si Playwright, el smoke del navegador productivo o Docker fallan.

## Criterio de salida del proyecto

La decisión final debe proceder de la Production Gate actual, no de una lectura aislada de `ok`.

- `ok` en Private Deployment Plan significa que el plan pudo construirse.
- `productionReady` solo puede ser `true` cuando `productionStatus === "ready"`.
- `review` requiere revisión humana.
- `blocked` impide presentar el deployment como listo para producción.

La puerta estricta agrega validaciones de arquitectura, L1/L2/L3, DHCP, políticas, cableado, PoE, inventario físico, resiliencia, WAN, capacidad, servicios internos, Wi-Fi, IPv6/VRF, failure simulation y drift observado. Los fallos bloqueantes de cualquiera de esos módulos impiden `productionReady=true`.

Además, la puerta privada verifica integridad de los artefactos derivados: configuración privada por dispositivo, origen `private`, rutas seguras/no duplicadas, ausencia de fallbacks y presencia de change set, incremental plan, deployment plan, runbook, rollback y checklist post-change.

La aplicabilidad de un artefacto se informa por dispositivo mediante `configReadiness`: `apply-ready`, `review-required` o `procedure-only`. Esta clasificación **no sustituye** a la Production Gate global. Un artefacto puede ser `apply-ready` y, aun así, el deployment permanecer bloqueado por arquitectura, cableado, capacidad, seguridad u otra validación global.

## Frontera de publicación

La frontera declarativa vive en `js/netwizard-browser-modules.js`.

- Los módulos `production:false` permanecen disponibles en Source/Pages/offline, pero no se cargan en el browser SaaS.
- `tests/production-private-boundary.test.js` comprueba estáticamente que el entrypoint productivo excluye generadores especializados y el generador histórico.
- `tests/e2e-production/production-browser.spec.js` comprueba en Chromium contra el contenedor real que esos generadores no están disponibles, abre una sesión self-hosted y verifica que Cisco se genera en servidor y aparece en la vista existente de Config.
- El Docker ejecuta `scripts/prepare-production-index.js`, no publica `/private` y rechaza source maps/TypeScript en `/out/public`.
- Los workers `routing-worker.cjs` y `deployment-worker.cjs` se empaquetan en el área privada del contenedor.
- La Production Gate privada y la generación vendor server-side no deben entrar en el entrypoint browser.

## Autoridad y seguridad backend

La plataforma SaaS ya dispone de autenticación/sesiones, workspaces, roles, persistencia PostgreSQL, control optimista de versiones, auditoría y rate limiting.

Las verificaciones principales son:

- `backend/internal/auth/*_test.go`: identidad, sesión y OIDC.
- `backend/internal/httpapi/remote_api_test.go`: 401/403, CSRF, owner/editor/viewer, conflictos de versión, rate limiting y auditoría.
- `backend/internal/httpapi/private_services_api_test.go`: autorización y revisión almacenada para routing/deployment privados, además de auditoría.
- `backend/internal/storage/postgres/e4_integration_test.go`: persistencia de identidad/sesión/workspace, auditoría y rate limiting PostgreSQL.

En SaaS, los endpoints privados no deben aceptar un snapshot cliente como autoridad; deben cargar la revisión almacenada correspondiente a `expectedVersion`.

El modo self-hosted es una frontera diferente y explícita: no usa PostgreSQL/OIDC, acepta únicamente el snapshot 3.50 actual y exige token de operador, sesión HttpOnly, CSRF, same-origin, límite de tamaño y rate limit. La service key nunca se entrega al navegador.

## Publicación

Antes de publicar:

- proteger `main` con los cuatro checks de CI;
- revisar que la imagen pública no contiene fuentes/bundles privados ni source maps;
- verificar que las capacidades que permanecen en navegador están aceptadas como inspeccionables;
- confirmar que autenticación, autorización, auditoría y límites están activos en el entorno;
- verificar backup/restauración de PostgreSQL como responsabilidad operativa del despliegue.

## Alcance

El modo local/offline sigue siendo compatible y no requiere backend. En SaaS, las operaciones con autoridad, datos remotos o lógica privada pasan por el backend/Private Engine. La compatibilidad de snapshots 3.50 no debe romperse por reorganizaciones de UX ni por cambios de publicación que no modifiquen el formato persistido.


## Autoridad del modelo

La matriz C/R/D/O/T/X/A, el orden canónico de navegación y las reglas de compatibilidad están documentados en `docs/MODEL_AUTHORITY.md`. Las reorganizaciones de UX no deben crear una segunda autoridad persistida para equipos, puertos, colocación, cableado o subnets.


## Modo Private Engine self-hosted

Para recuperar generación server-side en una instalación Docker local/controlada sin desplegar el stack SaaS completo:

- activa `NETWIZARD_SELF_HOSTED_PRIVATE=true`;
- genera una `NETWIZARD_PRIVATE_SERVICE_KEY` aleatoria de 32 bytes o más;
- genera un `NETWIZARD_SELF_HOSTED_PRIVATE_TOKEN` distinto, también de 32 bytes o más;
- usa HTTPS y `NETWIZARD_COOKIE_SECURE=true` cuando la instancia sea accesible fuera de localhost/LAN controlada;
- no publiques el token de operador en imágenes, repositorios ni variables del frontend.

El operador introduce el token en la tarjeta **Private Engine self-hosted**. Tras autenticarse, el token se descarta del formulario y se trabaja con una sesión HttpOnly efímera. Reiniciar el servidor invalida esas sesiones.

Este modo protege la lógica propietaria y autentica la generación, pero no sustituye un control de acceso perimetral para una instancia expuesta a Internet. Si se publica externamente, debe usarse HTTPS y una capa de acceso controlada; para multiusuario/autoridad compartida se recomienda el modo SaaS OIDC/PostgreSQL.
