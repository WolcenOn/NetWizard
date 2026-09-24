# NetWizard SaaS collaboration — E5

## Consistency model

E5 combines immutable snapshots with a durable per-project operation log.

- A snapshot has a monotonically increasing project `currentVersion`.
- Every realtime operation carries `baseVersion` and is accepted only when it matches the current snapshot version.
- Accepted operations receive a durable project sequence `seq` and are stored in PostgreSQL.
- `opId` is idempotent per project: retrying the same operation returns the original accepted envelope instead of appending a duplicate.
- When a new snapshot revision is saved, active sockets receive `resync_required`; clients must reload the current snapshot and reconnect using the new `baseVersion`.

## HTTP synchronization

`GET /api/projects/{projectID}` returns an `ETag` derived from project version and snapshot checksum. `If-None-Match` can return 304.

`PUT /api/projects/{projectID}` still requires `expectedVersion`; when `If-Match` is supplied it must match the current ETag or the server returns 412.

`GET /api/projects/{projectID}/revisions?limit=N` returns revision metadata without embedding historical snapshots.

`GET /api/projects/{projectID}/operations?baseVersion=N&since=S` returns durable accepted operations after sequence `S` for the current snapshot base. A stale `baseVersion` returns 409 with `resyncRequired=true`.

## WebSocket

Endpoint: `GET /api/projects/{projectID}/ws?clientId=<id>&baseVersion=<version>&sinceSeq=<seq>`.

The handshake requires the normal authenticated session cookie and at least `viewer` access to the project. Browser origins must be same-origin or present in `NETWIZARD_ALLOWED_ORIGINS`.

After upgrade the server sends `hello` containing the current snapshot version, ETag, latest sequence for that base version, and current room presence.

Clients up to 1000 operations behind receive durable replay before live events. Older cursors receive `resync_required` and must reload the snapshot.

Application `ping` messages receive `pong`; idle sockets expire after 90 seconds so abandoned presence is removed.

## Roles

- `viewer`: connect, receive replay, receive/send presence.
- `editor` and `owner`: all viewer behavior plus submit `project.operation` messages.

Realtime operations consume the same PostgreSQL-backed per-user write limit as REST mutations.

## Presence

Presence is ephemeral and stays in the in-process project room. It is not stored in PostgreSQL. User id/name are taken from the authenticated session rather than trusted from client payloads.

## Operation validation

Only declared NetWizard operation kinds are accepted. `opId` and `clientId` are bounded, payload must be valid JSON, and operation payload size is capped at 64 KiB. WebSocket frames are capped at 256 KiB.

## Snapshot changes and deletion

A successful snapshot save broadcasts `resync_required` with the new version and ETag.

Project deletion broadcasts `resync_required` with reason `project_deleted`, closes every connection in the project room, and removes the room.

## Horizontal scaling

The durable operation log, sequence allocation, idempotency, authorization, sessions and rate limits are PostgreSQL-backed. Live room fan-out/presence is currently in-process. A multi-instance deployment therefore needs sticky WebSocket routing for a project/session until a shared pub/sub layer is introduced. Durable replay preserves recovery after reconnects, but cross-instance live fan-out is not yet provided.

## Client recovery

A client that receives `resync_required`, 409, or 412 should:

1. reload `GET /api/projects/{projectID}`;
2. record the returned project version and ETag;
3. reconnect WebSocket with that `baseVersion` and an appropriate sequence cursor;
4. apply subsequent `project.operation.applied` messages in sequence order.
