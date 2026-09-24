# NetWizard Backend

Backend Go de NetWizard para servir la aplicación y evolucionar hacia persistencia, autenticación y colaboración SaaS.

## Estado actual

La base incluye:

- servidor HTTP y serving del frontend estático;
- `GET /api/health`, `GET /api/version` y `GET /api/capabilities`;
- CORS explícito, cabeceras de seguridad, logging y parada limpia;
- contratos realtime internos para presencia y operaciones;
- identidad/roles server-side preparados para OIDC;
- contrato de proyectos y revisiones versionadas;
- PostgreSQL real detrás de `projects.Store`;
- migraciones embebidas y serializadas mediante advisory lock;
- control optimista de versión;
- revisiones inmutables y checksum SHA-256;
- auditoría de creación/guardado de revisiones;
- tests de integración contra PostgreSQL 16 en CI.

E3 añadió OIDC genérico y sesiones opacas server-side en PostgreSQL. E4 añade workspaces y CRUD remoto autorizado de proyectos. Cuando PostgreSQL + OIDC + stores E4 están listos, `remoteProjectWrites=true`; `collaboration=false` sigue reservado para E5.

La frontera entre cliente y servidor está definida en [`docs/BACKEND_BOUNDARIES.md`](../docs/BACKEND_BOUNDARIES.md) y la hoja de ruta SaaS en [`docs/SAAS_ARCHITECTURE.md`](../docs/SAAS_ARCHITECTURE.md).

## Ejecutar

Sin base de datos, NetWizard continúa en modo local:

```bash
go run ./backend/cmd/netwizard-server
```

Con PostgreSQL:

```bash
DATABASE_URL='postgres://user:password@localhost:5432/netwizard?sslmode=disable' go run ./backend/cmd/netwizard-server
```

Si `DATABASE_URL` está definida y PostgreSQL no responde o una migración falla, el backend termina durante el arranque en vez de continuar en un estado parcial.

## Variables de entorno

```bash
NETWIZARD_ADDR=:8080
NETWIZARD_BACKEND_VERSION=netwizard-backend-v0.2
NETWIZARD_ALLOWED_ORIGINS=http://localhost:4173,http://localhost:8080
DATABASE_URL=postgres://user:password@localhost:5432/netwizard
NETWIZARD_OIDC_ISSUER_URL=https://issuer.example
NETWIZARD_OIDC_CLIENT_ID=netwizard-web
NETWIZARD_OIDC_CLIENT_SECRET=optional-confidential-client-secret
NETWIZARD_OIDC_REDIRECT_URL=https://app.example/api/auth/callback
NETWIZARD_SESSION_COOKIE_NAME=netwizard_session
NETWIZARD_SESSION_TTL=12h
NETWIZARD_COOKIE_SECURE=true
NETWIZARD_AUTH_HTTP_TIMEOUT=10s
NETWIZARD_MAX_PROJECT_BYTES=10485760
```

`DATABASE_URL` es opcional mientras se use únicamente el modo local, pero es obligatorio cuando se configura OIDC porque los estados de login y las sesiones se almacenan server-side. `NETWIZARD_OIDC_CLIENT_SECRET` es opcional para clientes públicos que usan PKCE. Una configuración OIDC parcial hace fallar el arranque. Fuera de localhost el redirect debe usar HTTPS; un redirect HTTPS exige cookie `Secure`. `NETWIZARD_ALLOWED_ORIGINS` debe definirse explícitamente cuando frontend y backend usen orígenes distintos; en producción no debe usarse `*`.

## Migraciones

Las migraciones SQL viven en:

```text
backend/internal/storage/postgres/migrations/
```

Al arrancar con `DATABASE_URL`, el backend:

1. abre PostgreSQL;
2. comprueba conectividad;
3. adquiere un advisory lock;
4. crea `schema_migrations` si es necesario;
5. aplica en orden las migraciones pendientes dentro de transacciones;
6. registra cada migración aplicada;
7. libera el lock.

El proceso es idempotente y seguro ante dos instancias que arranquen simultáneamente.

## Verificación

Desde la raíz:

```bash
go test ./...
docker build .
```

El job Go de CI levanta PostgreSQL 16 y ejecuta también el test de integración del store.

## API remota E4

Con autenticación configurada, el backend expone:

- `GET/POST /api/workspaces`;
- `GET/POST /api/workspaces/{workspaceID}/projects`;
- `GET/PUT/DELETE /api/projects/{projectID}`.

Roles:

- `viewer`: lectura;
- `editor`: lectura, creación y guardado de revisiones;
- `owner`: lo anterior y borrado lógico.

Las mutaciones requieren `X-NetWizard-CSRF` con el token devuelto por `GET /api/auth/me`. El token CSRF está ligado a la sesión server-side; las sesiones E3 anteriores a la migración E4 se invalidan deliberadamente.

Los snapshots continúan validados contra 3.50.0 y `NETWIZARD_MAX_PROJECT_BYTES`. El guardado exige `expectedVersion` y devuelve HTTP 409 ante conflicto optimista. El límite de escritura es 60 mutaciones/minuto por usuario y se aplica atómicamente en PostgreSQL, por lo que también funciona con varias instancias.

La creación de workspaces, creación/guardado y borrado de proyectos quedan auditados. `DELETE` es lógico: el historial permanece en PostgreSQL pero el proyecto deja de aparecer en lecturas activas.

El contrato completo está en [`docs/SAAS_REMOTE_API.md`](../docs/SAAS_REMOTE_API.md).

## Próximo paso técnico

E5 añade versionado HTTP/ETag, operation store público, WebSocket autenticado por proyecto, presencia, reconexión e idempotencia por `opId`.

No se deben duplicar validadores/generadores JavaScript en Go sin contrato versionado y pruebas de paridad.

## Railway

El repositorio incluye un `Dockerfile` en la raíz. El servidor utiliza `PORT` cuando Railway lo inyecta, salvo que `NETWIZARD_ADDR` esté definido explícitamente.

Para habilitar persistencia SaaS debe conectarse un PostgreSQL administrado y exponer su URL como `DATABASE_URL`. Las migraciones se ejecutan al arrancar.

La política operativa de backup/restore está en [`docs/SAAS_OPERATIONS.md`](../docs/SAAS_OPERATIONS.md).

> El frontend sigue ejecutándose en el navegador. Alojar el repositorio de forma privada no oculta el JavaScript que el navegador descarga. La lógica que deba mantenerse privada debe ejecutarse en el backend.
