# NetWizard SaaS architecture

## Objetivo

Evolucionar NetWizard desde una aplicación client-first a un SaaS multiusuario sin perder el modo local ni duplicar silenciosamente lógica de dominio.

El criterio a partir de esta fase es simple:

- no refactorizar `netwizard.js` por estética;
- mover una responsabilidad solo cuando necesite autoridad de servidor, persistencia compartida, privacidad o colaboración;
- mantener contratos versionados entre frontend y backend;
- no exponer escritura remota hasta que autenticación, autorización y auditoría estén activas.

## Arquitectura de ejecución objetivo

La estrategia detallada de ejecución vive en [CLIENT_PRIVATE_ENGINE_STRATEGY.md](./CLIENT_PRIVATE_ENGINE_STRATEGY.md).

NetWizard seguirá siendo **client-first en interacción** y **server-authoritative en identidad/datos**, con un **Private Engine** para la lógica que aporte valor diferencial o requiera confidencialidad.

La intención no es mover la mayor cantidad posible de código al servidor. La intención es que:

- UI, canvas, topología e interacción sigan ejecutándose en el navegador;
- Railway mantenga autenticación, persistencia, colaboración y permisos;
- los algoritmos propietarios seleccionados se ejecuten exclusivamente en el Private Engine;
- Auth0 sea un proveedor OIDC reemplazable, no la base de datos de negocio;
- el mismo origen frontend/API se mantenga mientras simplifique seguridad y despliegue.

El primer caso de referencia será routing avanzado: actualmente está en estado de transición con worker privado y paridad; tras activar OIDC, la UI cloud pasará a usar el endpoint privado y se retirará el código completo de routing del artefacto público.

## Protección del código

El JavaScript que necesita el navegador no puede considerarse secreto. Minificación u ofuscación pueden elevar el coste de inspección, pero no ofrecen una frontera de seguridad.

La lógica que deba permanecer privada debe ejecutarse en el backend.

Candidatos futuros para ejecución privada:

- capacidades premium;
- validadores o optimizadores propietarios que no necesiten funcionar offline;
- generación avanzada que se quiera licenciar/medir;
- secretos y credenciales;
- automatizaciones contra infraestructura externa;
- analítica agregada o procesos server-side.

Una migración de lógica desde JavaScript requiere contrato versionado, tests de paridad y una decisión explícita sobre el modo local.

## Identidad

La arquitectura de autenticación prevista es OpenID Connect.

El backend será la autoridad de sesión y autorización. No se implementará un sistema propio de contraseñas.

Configuración preparada:

- `NETWIZARD_OIDC_ISSUER_URL`
- `NETWIZARD_OIDC_CLIENT_ID`

El proveedor concreto puede decidirse posteriormente sin cambiar el modelo de autorización.

La identidad externa se traduce a un `Principal` interno con `subject`, email y nombre visible.

## Autorización

Roles iniciales por workspace:

- `owner`: administración y escritura completa;
- `editor`: lectura y edición;
- `viewer`: solo lectura.

Toda operación sobre un proyecto debe validar identidad y rol en servidor. La UI nunca es una frontera de autorización.

## Persistencia

PostgreSQL es la base de datos objetivo para SaaS.

La primera migración define:

- usuarios;
- workspaces;
- membresías;
- proyectos;
- revisiones inmutables del snapshot;
- log de operaciones colaborativas;
- eventos de auditoría.

Los snapshots siguen usando el contrato NetWizard 3.50 y se validan antes de persistir.

Cada guardado remoto debe usar control optimista de versión. El cliente envía la versión base; el servidor rechaza escrituras sobre una versión distinta en vez de sobrescribir cambios silenciosamente.

## Colaboración

La colaboración se construirá sobre dos niveles:

1. snapshot versionado para carga/guardado fiable;
2. operaciones secuenciadas por proyecto para edición simultánea.

Cada operación conserva:

- `opId`;
- `clientId`;
- `baseVersion`;
- tipo;
- entidad;
- payload;
- actor;
- secuencia aceptada.

WebSocket no se expondrá hasta que persistencia, autenticación, autorización y auditoría estén activas.

## Fases

### E1 — Fundación SaaS

- contratos de identidad y roles;
- contrato de almacenamiento de proyectos/revisiones;
- validación de snapshots 3.50;
- esquema PostgreSQL;
- auditoría y operation log en el esquema;
- endpoint público de capacidades;
- escritura remota deshabilitada.

### E2 — Persistencia PostgreSQL real — implementada

- driver PostgreSQL conectado en el arranque;
- migraciones embebidas, transaccionales y serializadas;
- implementación de `projects.Store`;
- revisiones inmutables y checksum;
- optimistic concurrency mediante `expectedVersion`;
- auditoría de persistencia;
- tests de integración contra PostgreSQL 16 en CI;
- backup/restore documentado en `SAAS_OPERATIONS.md`.

Todavía sin endpoints públicos de escritura.

### E3 — Autenticación OIDC y sesiones — implementada

- login OIDC Authorization Code + PKCE;
- discovery/JWKS;
- state + nonce;
- sesión opaca server-side en PostgreSQL;
- cookie HttpOnly + Secure + SameSite;
- logout y expiración;
- middleware de principal;
- tests negativos y proveedor OIDC falso.

### E4 — Workspaces y CRUD autorizado — implementada

- crear/listar workspaces;
- crear/listar/abrir/guardar/borrar proyectos;
- owner/editor/viewer;
- autorización por recurso mediante user id interno;
- CSRF por sesión;
- límites de tamaño;
- rate limiting distribuido en PostgreSQL;
- auditoría;
- tests HTTP permitido/denegado y PostgreSQL real.

En este punto `remoteProjectWrites=true` cuando PostgreSQL, OIDC y todos los stores E4 están listos. `collaboration=false` continúa hasta E5.

### E5 — Sincronización y colaboración — implementada

- versión base + ETag/If-Match/If-None-Match;
- historial de revisiones;
- operation store durable en PostgreSQL;
- secuencia por proyecto e idempotencia por `opId`;
- WebSocket autenticado y autorizado por proyecto;
- presencia efímera;
- replay por `baseVersion` + `sinceSeq`;
- `resync_required` ante cambio de snapshot, cursor inválido o ventana de replay excesiva;
- heartbeat/expiración de sockets;
- límites de payload y rate limiting reutilizado.

El fan-out/presencia WebSocket es por proceso. Despliegues con varias instancias deben usar sticky routing hasta incorporar pub/sub compartido; el log durable y el replay sí son PostgreSQL-backed.

### E6 — Servicios privados/premium — primera vertical implementada

Mover selectivamente al backend lógica que deba protegerse o monetizarse. Nunca mediante copia paralela permanente: contrato, paridad, migración y retirada/encapsulado de la versión cliente.

La primera vertical E6 introduce un servicio privado de atestación de artefactos de despliegue:

- contrato versionado `netwizard-private-deployment-attestation-v1`;
- firma HMAC-SHA256 con clave disponible únicamente en backend;
- artefacto ligado a `projectId`, versión y checksum de la revisión remota almacenada;
- autorización mínima `editor`;
- CSRF, rate limit y sesión existentes;
- rechazo de versiones obsoletas;
- auditoría `private.deployment_attestation.create`;
- servicio desactivado si no existe `NETWIZARD_PRIVATE_SERVICE_KEY`.

Esta capacidad no sustituye los generadores locales ni duplica su implementación. El modo offline sigue pudiendo generar/exportar sin atestación remota.

La segunda vertical E6 prepara la migración de routing avanzado al servidor sin reescribirlo en Go:

- worker privado Node empaquetado fuera del directorio estático;
- contrato `netwizard-private-routing-v1`;
- reutiliza exactamente `routing-plan` y los generadores Cisco/Junos/Huawei/MikroTik existentes;
- tests de paridad comparan el worker con los generadores del navegador;
- endpoint ligado al snapshot remoto almacenado, `expectedVersion`, sesión y rol `editor`;
- auditoría `private.routing.generate`;
- el código del worker no se sirve por HTTP.

Durante esta etapa de transición los generadores siguen presentes en el bundle público para conservar funcionalidad local mientras OIDC aún no está desplegado. La retirada del bundle público se hará después de conectar la UI productiva al endpoint autenticado.

La imagen de producción también deja de copiar el JavaScript fuente directamente: una etapa Node minifica los módulos con esbuild y la imagen final sirve únicamente el resultado procesado, sin source maps. Esto reduce exposición accidental, pero no se considera una frontera de secreto: la lógica verdaderamente privada sigue perteneciendo al backend.

## Modo local

El modo local se mantiene como capacidad de producto:

- importar/exportar JSON;
- trabajar sin conexión;
- abrir proyectos locales aunque el backend no esté disponible.

El usuario deberá elegir explícitamente convertir/subir un proyecto local a un workspace remoto.

## Regla para nuevas funcionalidades

Antes de implementar una función nueva se decide dónde vive:

- UI/interacción local → frontend;
- cálculo portable necesario offline → módulo frontend puro;
- identidad, permisos, persistencia, auditoría, colaboración o secreto → backend;
- lógica propietaria que se quiera proteger → backend, con API versionada.

Así evitamos volver a convertir `netwizard.js` en el lugar por defecto para todo.
