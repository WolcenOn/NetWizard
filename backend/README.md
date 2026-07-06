# NetWizard Backend

Backend inicial en Go para preparar NetWizard colaborativo.

## Estado actual

Esta primera base solo incluye:

- servidor HTTP mínimo;
- `GET /api/health`;
- `GET /api/version`;
- cabeceras de seguridad básicas;
- CORS desactivado por defecto salvo orígenes configurados;
- parada limpia con `SIGINT`/`SIGTERM`.

Todavía no incluye autenticación, base de datos, proyectos ni WebSocket. Es una base segura para empezar a iterar.

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
NETWIZARD_ALLOWED_ORIGINS=http://localhost:4173,http://localhost:8080
```

`NETWIZARD_ALLOWED_ORIGINS` debe definirse explícitamente en desarrollo si el frontend se sirve desde otro origen. En producción no debe usarse `*`.

## Próximo paso técnico

1. Añadir almacenamiento SQLite inicial.
2. Añadir CRUD de proyectos.
3. Guardar/cargar snapshot JSON compatible con el schema actual.
4. Añadir endpoint de validación de proyecto.
5. Añadir WebSocket por proyecto.
