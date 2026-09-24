# NetWizard Backend

Backend inicial en Go para preparar NetWizard colaborativo.

## Estado actual

La base actual incluye:

- servidor HTTP mínimo;
- serving del frontend estático y fallback SPA;
- `GET /api/health`;
- `GET /api/version`;
- cabeceras de seguridad básicas;
- CORS desactivado por defecto salvo orígenes configurados;
- logging HTTP;
- parada limpia con `SIGINT`/`SIGTERM`;
- paquete `internal/realtime` con salas en memoria, presencia, mensajes, operaciones versionadas e interfaces de snapshot/operation store;
- tests Go para configuración, HTTP y realtime.

El paquete realtime sigue siendo **infraestructura interna**: no hay endpoint WebSocket registrado ni persistencia conectada. La fundación SaaS ya define contratos de identidad/autorización, proyectos versionados y el esquema PostgreSQL, pero todavía no existen login OIDC activo, store PostgreSQL conectado ni CRUD remoto de proyectos.

La frontera entre cliente y servidor está definida en [`docs/BACKEND_BOUNDARIES.md`](../docs/BACKEND_BOUNDARIES.md).

## Ejecutar

Desde la raíz del repo:

```bash
go run ./backend/cmd/netwizard-server
```

Por defecto escucha en:

```text
:8080
```

Probar:

```bash
curl http://localhost:8080/api/health
```

## Variables de entorno

```bash
NETWIZARD_ADDR=:8080
NETWIZARD_BACKEND_VERSION=netwizard-backend-v0.1
NETWIZARD_ALLOWED_ORIGINS=http://localhost:4173,http://localhost:8080\nDATABASE_URL=postgres://...\nNETWIZARD_OIDC_ISSUER_URL=https://issuer.example\nNETWIZARD_OIDC_CLIENT_ID=netwizard-web\nNETWIZARD_MAX_PROJECT_BYTES=10485760
```

`NETWIZARD_ALLOWED_ORIGINS` debe definirse explícitamente en desarrollo si el frontend se sirve desde otro origen. En producción no debe usarse `*`.

## Verificación

Desde la raíz:

```bash
go test ./...
docker build .
```

El workflow principal debe ejecutar ambas superficies antes de permitir artefactos/deploy de `main`.

## Próximo paso técnico

1. Mantener contratos realtime aislados y cubiertos por tests.
2. Añadir almacenamiento SQLite inicial detrás de interfaces.
3. Añadir CRUD de proyectos y snapshots con versionado.
4. Añadir autenticación/autorización antes de habilitar escritura colaborativa pública.
5. Exponer WebSocket por proyecto solo cuando persistencia, control de versión y seguridad estén listos.

No se deben duplicar validadores/generadores JavaScript en Go sin contrato versionado y pruebas de paridad.


## Railway

El repositorio incluye un `Dockerfile` en la raíz. Railway lo detecta automáticamente y compila el binario correcto:

```text
./backend/cmd/netwizard-server
```

El servidor usa `PORT` cuando Railway lo inyecta, salvo que `NETWIZARD_ADDR` esté definido explícitamente.

El contenedor sirve también el frontend estático desde `/app/public`, por lo que API y aplicación web quedan en el mismo servicio y origen.

Configuración recomendada en Railway:

1. Conectar el repositorio y la rama deseada.
2. Dejar vacío cualquier **Build Command** personalizado anterior (por ejemplo `go build -ldflags=-w -s -o out`).
3. Dejar vacío el **Start Command** para usar el `CMD` del Dockerfile.
4. Opcionalmente configurar health check en `/api/health`.

No hace falta definir `PORT`: Railway lo proporciona.

> El frontend sigue ejecutándose en el navegador. Alojarlo en Railway o en un repositorio privado evita exponer el repositorio, pero no puede ocultar el JavaScript que el navegador necesita descargar. La lógica que deba mantenerse privada debe ejecutarse en el backend.
