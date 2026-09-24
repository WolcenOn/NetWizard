# NetWizard SaaS architecture

## Objetivo

Evolucionar NetWizard desde una aplicación client-first a un SaaS multiusuario sin perder el modo local ni duplicar silenciosamente lógica de dominio.

El criterio a partir de esta fase es simple:

- no refactorizar `netwizard.js` por estética;
- mover una responsabilidad solo cuando necesite autoridad de servidor, persistencia compartida, privacidad o colaboración;
- mantener contratos versionados entre frontend y backend;
- no exponer escritura remota hasta que autenticación, autorización y auditoría estén activas.

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

### E5 — Sincronización y colaboración

- versión base/ETag;
- historial de revisiones;
- operation store;
- WebSocket autenticado por proyecto;
- presencia;
- conflictos;
- reconexión;
- idempotencia por `opId`.

### E6 — Servicios privados/premium

Mover selectivamente al backend lógica que deba protegerse o monetizarse. Nunca mediante copia paralela permanente: contrato, paridad, migración y retirada/encapsulado de la versión cliente.

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
