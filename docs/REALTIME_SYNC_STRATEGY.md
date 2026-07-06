# NetWizard · estrategia de actualizaciones asíncronas y tiempo real

Este documento define el sistema recomendado para conseguir una interacción fluida en proyectos colaborativos de NetWizard.

## Decisión recomendada

Usar una arquitectura híbrida:

```text
REST
  Para carga inicial, guardado de snapshots, validación, exportación y operaciones no interactivas.

WebSocket
  Para edición colaborativa bidireccional, presencia, selección, cursores, operaciones de proyecto y actualizaciones de mapa.

Canal de eventos secuenciados
  Todas las operaciones mutables del proyecto reciben un número `seq` por proyecto.

Snapshots periódicos
  Cada cierto número de operaciones se guarda un snapshot completo para acelerar carga y recuperación.
```

No recomiendo empezar directamente con CRDT completo para todo el modelo de red. El modelo de NetWizard no es un editor de texto; es un grafo estructurado con entidades claras: dispositivos, puertos, VLANs, hosts, enlaces, ubicaciones, reglas y posiciones visuales. Para este tipo de datos, un sistema de **operaciones tipadas + versión + resolución controlada de conflictos** es más fácil de auditar, validar y convertir luego en configuración de red.

## Por qué WebSocket como canal principal

NetWizard necesita que el cliente envíe cambios y reciba cambios de otros usuarios en la misma sesión: mover nodos, seleccionar elementos, editar puertos, asignar hosts, aplicar layouts, etc. Eso requiere bidireccionalidad real.

SSE/EventSource es útil para notificaciones unidireccionales servidor → cliente, pero para colaboración con edición desde el navegador acabaríamos necesitando REST adicional para cada cambio. Puede servir en el futuro para notificaciones ligeras, pero no como canal principal.

## Capas de sincronización

### 1. Snapshot inicial

Al abrir un proyecto colaborativo:

```http
GET /api/projects/{projectId}/snapshot
```

Respuesta:

```json
{
  "projectId": "prj_123",
  "version": 120,
  "schemaVersion": "netwizard-project-v3",
  "snapshot": {}
}
```

### 2. Conexión WebSocket

Después de cargar el snapshot:

```text
GET /api/projects/{projectId}/ws?since=120
```

El servidor devuelve por WebSocket las operaciones faltantes desde `since` y luego mantiene el stream vivo.

### 3. Operaciones tipadas

Cada acción de usuario se convierte en una operación pequeña, validable y reversible si es posible.

Ejemplo:

```json
{
  "type": "project.operation",
  "projectId": "prj_123",
  "clientId": "cli_a1",
  "opId": "op_01J...",
  "baseVersion": 120,
  "kind": "host.assign_port",
  "payload": {
    "hostId": "h1",
    "deviceId": "sw1",
    "portId": "p12",
    "vlanRef": "v10"
  }
}
```

El servidor responde:

```json
{
  "type": "project.operation.ack",
  "opId": "op_01J...",
  "projectId": "prj_123",
  "seq": 121,
  "accepted": true
}
```

Y emite al resto:

```json
{
  "type": "project.operation.applied",
  "projectId": "prj_123",
  "seq": 121,
  "kind": "host.assign_port",
  "payload": {}
}
```

## Tipos de mensajes

### Sistema

```text
hello
ping
pong
error
resync_required
```

### Proyecto

```text
project.join
project.leave
project.snapshot_required
project.operation
project.operation.ack
project.operation.applied
project.operation.rejected
```

### Presencia

```text
presence.update
presence.cursor
presence.selection
presence.editing
```

### Vista gráfica

```text
view.pan_zoom
view.node_move
view.layout_apply
view.filter_change
```

Las operaciones de vista deben separarse de las operaciones de red. Mover un nodo en V5 no debe bloquear una edición de VLAN.

## Modelo de consistencia

### Entidades críticas

Estas requieren validación fuerte y versionado:

- VLANs.
- Subnets.
- Puertos.
- Enlaces físicos.
- Gateways.
- Reglas firewall.
- Generación de configuración.

### Entidades visuales

Estas pueden ser más permisivas y con last-write-wins:

- Posiciones de nodos.
- Pan/zoom.
- Filtros de vista.
- Selección actual.
- Cursores.

## Resolución de conflictos

### Reglas iniciales

| Caso | Estrategia |
|---|---|
| Dos usuarios mueven el mismo nodo | gana último `seq`; guardar ambos eventos en auditoría. |
| Dos usuarios editan campos distintos del mismo dispositivo | merge por campo. |
| Dos usuarios editan el mismo campo | rechazar el segundo o crear conflicto visible. |
| Dos usuarios asignan el mismo puerto libre | gana primera operación aceptada; segunda se rechaza con motivo. |
| Un usuario borra una VLAN usada por hosts | rechazar salvo operación explícita con migración. |
| Autoasignación masiva vs edición manual | bloquear entidad durante ejecución o dividir en previsualización + aplicar. |

### Bloqueos suaves

Para mejorar UX:

```json
{
  "type": "presence.editing",
  "entity": "device:sw1",
  "field": "name",
  "userId": "u2"
}
```

No impide técnicamente editar, pero avisa visualmente. Para operaciones peligrosas se puede usar bloqueo fuerte temporal en servidor.

## Colas y rendimiento

### En cliente

- Agrupar movimientos visuales: enviar máximo 10-20 eventos/segundo por usuario.
- Debounce para campos de texto: 300-600 ms.
- Enviar edición final al perder foco.
- Aplicar cambios optimistas en UI.
- Revertir si el servidor rechaza.

### En servidor

- Una cola por proyecto.
- Un goroutine/hub por proyecto activo.
- Persistir operación antes de emitir como aceptada.
- Broadcast no bloqueante a clientes.
- Si un cliente no consume, cerrar conexión o pedir resync.

## Backpressure

WebSocket clásico no ofrece backpressure automática en el cliente, así que hay que controlarlo a nivel de aplicación:

- límite de mensajes pendientes por cliente;
- coalescing de eventos visuales;
- snapshots cuando el cliente queda demasiado atrás;
- `resync_required` si no puede ponerse al día;
- heartbeat para detectar conexiones muertas.

## Estado offline/local-first

No bloquearía la primera versión colaborativa por CRDT. Pero sí conviene diseñar las operaciones para que en el futuro puedan funcionar offline.

Fases:

1. **Online obligatorio**: servidor secuencia operaciones.
2. **Reconexión simple**: cliente reenvía operaciones pendientes si no tuvo ACK.
3. **Offline corto**: cola local con rebase al reconectar.
4. **CRDT selectivo**: usar CRDT solo en partes donde aporte valor, por ejemplo notas, documentación o layout visual.

## Estructura Go propuesta

```text
backend/internal/realtime/
  hub.go
  room.go
  client.go
  message.go
  operation.go
  presence.go
```

### Interfaces clave

```go
type OperationStore interface {
    AppendOperation(ctx context.Context, projectID string, op Operation) (seq int64, err error)
    OperationsSince(ctx context.Context, projectID string, seq int64) ([]OperationEnvelope, error)
}

type SnapshotStore interface {
    LoadSnapshot(ctx context.Context, projectID string) (ProjectSnapshot, error)
    SaveSnapshot(ctx context.Context, snapshot ProjectSnapshot) error
}
```

## Flujo recomendado para NetWizard

```text
1. Usuario abre proyecto.
2. REST carga snapshot.
3. WebSocket conecta con since=version.
4. Servidor reenvía operaciones desde esa versión.
5. Cliente aplica operaciones.
6. Usuario cambia algo.
7. Cliente aplica optimista y envía operación.
8. Servidor valida, persiste y asigna seq.
9. Servidor emite a todos.
10. Cliente confirma o revierte.
```

## Prioridad de implementación

### Fase A · esqueleto real-time

- Tipos de mensaje.
- Hub por proyecto.
- Registro/desregistro de clientes.
- Broadcast en memoria.
- Endpoint WebSocket.
- Ping/pong.

### Fase B · persistencia

- SQLite/PostgreSQL.
- `project_operations`.
- `project_snapshots`.
- Replay de operaciones.

### Fase C · cliente NetWizard

- Adaptador `NetWizardCollabClient`.
- Modo local vs colaborativo.
- Envío de operaciones para cambios pequeños.
- Presencia y selección.

### Fase D · conflictos

- Validación por entidad.
- Rechazo de operaciones incompatibles.
- Avisos visuales.
- Resync.

## Decisión final

Para NetWizard, la mejor base es:

```text
REST + WebSocket + operaciones tipadas + secuencia por proyecto + snapshots periódicos
```

CRDT puede entrar más adelante, de forma selectiva, pero no debe ser el núcleo inicial de toda la red porque la configuración de red necesita validación fuerte, orden claro y auditoría determinista.
