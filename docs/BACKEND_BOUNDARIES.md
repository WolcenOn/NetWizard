# Contrato de responsabilidades frontend/backend

Este documento fija la frontera arquitectónica de NetWizard mientras evoluciona desde una aplicación local hacia una plataforma colaborativa. El objetivo es evitar duplicar lógica, introducir inconsistencias o convertir el backend en una segunda implementación del mismo modelo sin un contrato explícito.

## Estado actual

NetWizard sigue siendo **client-first**:

- el frontend mantiene el modelo de proyecto 3.50;
- el modo local sigue funcionando con estado del navegador e importación/exportación JSON;
- la lógica de diseño, validación, diagnóstico y generación continúa ejecutándose principalmente en JavaScript;
- el servidor Go sirve frontend y API base;
- el backend expone actualmente `GET /api/health` y `GET /api/version`;
- `backend/internal/realtime` contiene contratos y lógica en memoria para salas, presencia, operaciones y snapshots;
- realtime expone WebSocket autenticado, presencia y replay durable; el fan-out sigue siendo por proceso y requiere sticky routing con varias réplicas;
- PostgreSQL persiste proyectos/revisiones, operation log, sesiones y límites; OIDC, autorización y CRUD remoto están implementados cuando la configuración SaaS está completa.

## Responsabilidad del frontend

Mientras una capacidad no migre explícitamente, el frontend es la fuente de verdad para:

- edición del proyecto;
- schema/importación/exportación 3.50;
- validadores de diseño;
- planificación VLAN/VLSM/routing/firewall;
- modelo físico de rack, PDU y cableado;
- diagnóstico de conectividad;
- generación vendor y deployment bundle;
- V5 y demás representación visual;
- modo local/offline.

Una refactorización del backend no debe cambiar silenciosamente estos resultados.

## Responsabilidad del backend

El backend debe concentrar las responsabilidades que requieren autoridad de servidor o datos compartidos:

- persistencia remota de proyectos y snapshots;
- secuenciación de operaciones colaborativas;
- autenticación y sesiones;
- autorización por workspace/proyecto;
- auditoría de acciones;
- presencia y colaboración en tiempo real;
- backups y recuperación;
- rate limiting y límites de tamaño;
- tareas que deban mantenerse privadas;
- servicios remotos que se hayan migrado de forma explícita y versionada.

Servir el frontend estático forma parte del despliegue, no convierte automáticamente la lógica cliente en lógica privada.

## Regla de no duplicación

No se debe portar un validador o generador JavaScript a Go únicamente para disponer de un endpoint equivalente.

Una migración de lógica de dominio requiere:

1. contrato de entrada/salida versionado;
2. tests de paridad contra casos representativos;
3. decisión explícita de cuál implementación queda como fuente de verdad;
4. estrategia de compatibilidad para modo local;
5. eliminación o encapsulado de la implementación duplicada cuando la migración termine.

Si no se cumplen estos puntos, la lógica permanece en frontend.

## Contrato del proyecto

El JSON 3.50 sigue siendo el contrato principal entre cliente y servidor.

El backend debe:

- preservar IDs y referencias;
- validar tamaño y estructura antes de persistir;
- conservar `schemaVersion`;
- rechazar versiones futuras no soportadas;
- no reinterpretar silenciosamente campos del proyecto;
- mantener snapshots recuperables;
- separar los metadatos del servidor del snapshot portable siempre que sea posible.

## Colaboración y concurrencia

Las operaciones colaborativas deben ser deterministas.

Toda mutación remota debe poder identificar:

- `opId`;
- cliente/actor;
- proyecto;
- `baseVersion`;
- tipo de operación;
- entidad afectada;
- secuencia aceptada por el servidor.

El servidor debe poder rechazar conflictos de versión en vez de aplicar cambios ciegamente. Las operaciones aceptadas deben ser idempotentes o detectables por `opId`.

No se habilitará edición multiusuario real hasta disponer de autenticación, autorización por proyecto y auditoría.

## Seguridad mínima antes de escritura remota

Antes de aceptar creación/modificación remota de proyectos se exige:

- HTTPS en producción;
- autenticación;
- autorización por recurso;
- validación estricta del payload;
- límite de tamaño;
- límites de frecuencia;
- protección de origen/CORS;
- timeouts;
- logging/auditoría;
- manejo explícito de conflictos;
- tests de autorización negativa;
- política de backup.

No deben almacenarse credenciales reales de dispositivos dentro del snapshot portable. Se usarán referencias/aliases a secretos cuando esa capacidad exista.

## Política de CI

Una PR no se considera completamente validada si una superficie modificada no participa en CI.

Baseline del repositorio:

- **Quality checks**: `npm run release:check`;
- **Go backend tests**: `go test ./...`;
- **Playwright E2E**: `npm run test:e2e`;
- **Docker build**: construcción del contenedor de producción.

Los artefactos/deploy de `main` deben depender de esas comprobaciones.

Si se añaden migraciones, almacenamiento o WebSocket, sus tests deben incorporarse al job Go antes de considerar la capacidad lista.

## Criterio para nuevas capacidades backend

Orden preferido:

1. contrato e interfaces;
2. tests;
3. implementación aislada;
4. persistencia/transporte;
5. seguridad/autorización;
6. integración frontend;
7. E2E;
8. despliegue.

No se debe conectar una capacidad experimental a la UI productiva antes de que tenga control de errores, compatibilidad y pruebas suficientes.

## Modo local y modo colaborativo

Hasta una decisión de producto posterior:

- el modo local debe seguir funcionando sin backend;
- la indisponibilidad del backend no debe corromper un proyecto local;
- entrar en modo colaborativo debe ser una acción explícita;
- la sincronización remota nunca debe sobrescribir silenciosamente cambios locales incompatibles.

Esta separación permite evolucionar el backend sin bloquear la utilidad actual de NetWizard.


## Dirección Client Engine / Private Engine

La frontera operativa concreta se define en [CLIENT_PRIVATE_ENGINE_STRATEGY.md](./CLIENT_PRIVATE_ENGINE_STRATEGY.md).

A partir de ahora, una nueva capacidad no se clasifica simplemente como "frontend" o "backend", sino como:

- **Client Engine**: interacción, visualización, estado temporal y capacidades que aceptamos como inspeccionables;
- **SaaS API**: identidad, permisos, persistencia, colaboración, auditoría y coordinación;
- **Private Engine**: algoritmos propietarios, generación avanzada y capacidades que no deben publicarse en el navegador.

Servir el frontend desde Railway no implica ejecutar esa lógica en Railway: el código estático se descarga y corre en el navegador. Solo lo que permanezca fuera del artefacto público y se invoque mediante API se considera privado.

Las migraciones de capacidades sensibles deben pasar explícitamente de pública -> transición con paridad -> cloud autoritativa -> privada, y CI debe impedir que una capacidad ya privada vuelva a aparecer en el artefacto público.

## Dirección SaaS desde E1

A partir de la fundación SaaS, reducir `netwizard.js` deja de ser un objetivo por sí mismo. Una extracción solo se prioriza cuando habilita persistencia, colaboración, privacidad de lógica o una frontera de dominio reutilizable.

La arquitectura objetivo y la secuencia E1–E6 se documentan en [SAAS_ARCHITECTURE.md](./SAAS_ARCHITECTURE.md).

La primera migración PostgreSQL existe como contrato de datos, pero en E1:

- PostgreSQL ya puede conectarse y migrarse al arrancar cuando `DATABASE_URL` está definida;
- no hay login activo;
- no se aceptan escrituras remotas;
- no hay WebSocket público.

El endpoint `GET /api/capabilities` debe reflejar estas capacidades de forma explícita para evitar que el frontend asuma servicios que todavía no están disponibles.


## Excepción controlada: Private Engine self-hosted

La regla de autoridad remota sigue siendo estricta en SaaS: routing/deployment privados cargan la revisión PostgreSQL autorizada y no aceptan configuraciones objetivo enviadas por el cliente.

El modo `NETWIZARD_SELF_HOSTED_PRIVATE=true` es una frontera de despliegue diferente para una instancia controlada por un único operador o perímetro local. En ese modo:

- no se habilitan workspaces, OIDC ni escrituras remotas;
- el navegador puede enviar **solo** el snapshot portable 3.50 actual a `/api/private/self-hosted/deployment-plan`;
- el backend valida schema/tamaño y ejecuta el mismo worker privado empaquetado fuera del directorio público;
- la llamada exige autenticación por token de operador convertido en sesión HttpOnly, CSRF, same-origin y rate limit;
- `desiredConfigs`, `configPaths` y cualquier intento de sustituir artefactos derivados se rechazan como campos desconocidos;
- el código de generación vendor continúa fuera del bundle público.

Esta excepción no debe reutilizarse para SaaS multiusuario ni para operaciones que requieran autoridad compartida/auditoría durable.
