# NetWizard Backend Go · colaboración en tiempo real

Este documento define la dirección técnica para pasar de NetWizard como aplicación estática/local a una aplicación con backend en Go, proyectos compartidos y edición colaborativa en tiempo real.

## Objetivo

Mantener la app actual funcionando en modo local/offline mientras se añade progresivamente un backend que permita:

- Usuarios y espacios de trabajo.
- Proyectos persistentes en servidor.
- Colaboración multiusuario en tiempo real.
- Historial/versionado de cambios.
- Bloqueos suaves o resolución de conflictos.
- Auditoría de acciones.
- Exportación de configuración reproducible.
- Preparación futura para IA/blueprints.

## Principios

1. **No romper el modo local actual.**
   NetWizard debe seguir pudiendo funcionar con `localStorage` y archivos JSON.

2. **El proyecto JSON sigue siendo el contrato principal.**
   El backend no debe obligar a reescribir toda la app. Debe almacenar snapshots y operaciones compatibles con el schema actual.

3. **Cambios por operaciones, no solo snapshots.**
   Para colaboración en tiempo real se necesitan operaciones pequeñas:
   `add_device`, `update_port`, `move_v5_node`, `assign_host_to_port`, etc.

4. **Seguridad antes de multiusuario real.**
   Autenticación, permisos por proyecto y auditoría deben estar antes de publicar como producción colaborativa.

5. **Backend Go sencillo y explícito.**
   Evitar complejidad inicial. Primero REST + WebSocket + SQLite/PostgreSQL. Después colas, CRDT o escalado horizontal si hace falta.

## Arquitectura propuesta

```text
frontend static NetWizard
  ├─ modo local: localStorage / JSON import-export
  └─ modo colaborativo: REST + WebSocket

backend Go
  ├─ auth
  ├─ workspaces
  ├─ projects
  ├─ project snapshots
  ├─ project operations
  ├─ websocket rooms
  ├─ audit log
  └─ config generation service / validation service

database
  ├─ users
  ├─ workspaces
  ├─ project_members
  ├─ projects
  ├─ project_snapshots
  ├─ project_operations
  └─ audit_events
```

## Módulos Go iniciales

```text
backend/
  cmd/netwizard-server/main.go
  internal/config/
  internal/httpapi/
  internal/auth/
  internal/projects/
  internal/realtime/
  internal/storage/
  internal/audit/
  internal/validation/
  internal/export/
  migrations/
```

## API REST inicial

### Health

```http
GET /api/health
```

Respuesta:

```json
{
  "ok": true,
  "version": "netwizard-backend-v0.1"
}
```

### Proyectos

```http
GET /api/projects
POST /api/projects
GET /api/projects/{projectId}
PUT /api/projects/{projectId}/snapshot
POST /api/projects/{projectId}/operations
GET /api/projects/{projectId}/operations?since=<seq>
```

### Exportación y validación

```http
POST /api/projects/{projectId}/validate
POST /api/projects/{projectId}/generate-config
POST /api/projects/{projectId}/connectivity-check
```

Al principio estas rutas pueden reutilizar lógica JS en frontend, pero a medio plazo conviene portar las partes críticas a Go o ejecutarlas como motor compartido bien versionado.

## WebSocket

```http
GET /api/projects/{projectId}/ws
```

Mensajes mínimos:

```json
{
  "type": "project.join",
  "projectId": "prj_123"
}
```

```json
{
  "type": "project.operation",
  "projectId": "prj_123",
  "baseVersion": 42,
  "operation": {
    "opId": "op_abc",
    "kind": "update_device",
    "path": ["devices", "dev1"],
    "patch": {
      "name": "SW-ACC-01",
      "locationId": "loc_planta_1"
    }
  }
}
```

```json
{
  "type": "project.presence",
  "projectId": "prj_123",
  "cursor": {
    "view": "v5",
    "x": 120,
    "y": 300,
    "selected": "host:h1"
  }
}
```

## Modelo de datos mínimo

### projects

```sql
CREATE TABLE projects (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL,
  name TEXT NOT NULL,
  current_version INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
```

### project_snapshots

```sql
CREATE TABLE project_snapshots (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  version INTEGER NOT NULL,
  schema_version TEXT NOT NULL,
  snapshot_json TEXT NOT NULL,
  created_by TEXT NOT NULL,
  created_at TEXT NOT NULL
);
```

### project_operations

```sql
CREATE TABLE project_operations (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  seq INTEGER NOT NULL,
  base_version INTEGER NOT NULL,
  kind TEXT NOT NULL,
  operation_json TEXT NOT NULL,
  created_by TEXT NOT NULL,
  created_at TEXT NOT NULL,
  UNIQUE(project_id, seq)
);
```

## Estrategia de sincronización

### Fase 1 · snapshots bloqueantes

- Un usuario guarda el proyecto completo.
- El backend valida `baseVersion`.
- Si coincide, acepta y sube versión.
- Si no coincide, devuelve conflicto.

Es simple y suficiente para arrancar.

### Fase 2 · operaciones incrementales

- Cada acción importante genera una operación.
- El backend asigna `seq`.
- Los clientes conectados reciben la operación por WebSocket.
- El frontend aplica la operación si es compatible.

### Fase 3 · resolución avanzada

- Rebase de operaciones.
- Conflictos por campo.
- Bloqueos suaves por entidad.
- Presencia de usuario y selección activa.

No conviene empezar con CRDT completo hasta que el modelo de operaciones esté estable.

## Seguridad mínima antes de producción colaborativa

- HTTPS obligatorio.
- Autenticación con sesión segura o JWT de corta duración.
- Refresh token protegido.
- Roles por workspace/proyecto:
  - owner
  - admin
  - editor
  - viewer
- Validación de tamaño máximo de proyecto.
- Validación de schema en servidor.
- Rate limiting para REST y WebSocket.
- Auditoría de operaciones.
- No almacenar contraseñas reales de equipos; usar `secretAlias`.
- Backups de base de datos.

## Relación con la generación de configuración

La generación de código debe quedar estable antes del backend. Orden recomendado:

1. Completar matriz de vendors soportados.
2. Tests por vendor.
3. Exportación determinista: mismo proyecto → misma salida.
4. Backend almacena snapshots y operaciones.
5. Backend puede pedir generación bajo demanda.
6. Más adelante, worker de generación con cola.

## Roadmap recomendado

### Milestone A · generación sólida

- Cisco IOS router/switch.
- MikroTik RouterOS.
- Huawei VRP.
- Fortinet FortiGate.
- pfSense plan/API/export.
- UniFi/Omada/Galgus como plan de controlador.
- Tests unitarios por vendor.

### Milestone B · backend Go mínimo

- `backend/cmd/netwizard-server/main.go`.
- Health endpoint.
- CRUD de proyectos.
- SQLite inicial.
- Guardar/cargar snapshot JSON.
- CORS configurable para desarrollo.

### Milestone C · colaboración básica

- WebSocket por proyecto.
- Broadcast de operaciones.
- Presencia de usuarios.
- Versionado incremental.
- Detección de conflicto por `baseVersion`.

### Milestone D · producción controlada

- Auth.
- Roles.
- Audit log.
- Backups.
- Dockerfile.
- Migraciones.
- Release checklist.

## Decisión importante

El backend no debe sustituir de golpe `localStorage`. Debe añadirse un modo:

```text
Modo local
Modo colaborativo
```

Así se reduce el riesgo y se mantiene la utilidad actual de NetWizard mientras evoluciona hacia plataforma colaborativa.
