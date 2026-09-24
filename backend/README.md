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

Todavía **no existen endpoints públicos de escritura de proyectos**, login OIDC activo ni WebSocket público. La persistencia está conectada internamente, pero `remoteProjectWrites=false` hasta completar autenticación/autorización.

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
NETWIZARD_MAX_PROJECT_BYTES=10485760
```

`DATABASE_URL` es opcional mientras se use únicamente el modo local. `NETWIZARD_ALLOWED_ORIGINS` debe definirse explícitamente cuando frontend y backend usen orígenes distintos; en producción no debe usarse `*`.

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

## Próximo paso técnico

E3 será autenticación OIDC y sesiones seguras. Después, E4 expondrá workspaces y CRUD remoto únicamente con autorización owner/editor/viewer, límites, rate limiting y auditoría.

No se deben duplicar validadores/generadores JavaScript en Go sin contrato versionado y pruebas de paridad.

## Railway

El repositorio incluye un `Dockerfile` en la raíz. El servidor utiliza `PORT` cuando Railway lo inyecta, salvo que `NETWIZARD_ADDR` esté definido explícitamente.

Para habilitar persistencia SaaS debe conectarse un PostgreSQL administrado y exponer su URL como `DATABASE_URL`. Las migraciones se ejecutan al arrancar.

La política operativa de backup/restore está en [`docs/SAAS_OPERATIONS.md`](../docs/SAAS_OPERATIONS.md).

> El frontend sigue ejecutándose en el navegador. Alojar el repositorio de forma privada no oculta el JavaScript que el navegador descarga. La lógica que deba mantenerse privada debe ejecutarse en el backend.
