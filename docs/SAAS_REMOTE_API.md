# NetWizard SaaS remote API — E4/E5

## Preconditions

Remote project writes are enabled only when all of these are ready: PostgreSQL, OIDC sessions, workspace/project stores, authorization, and the PostgreSQL-backed write limiter.

`GET /api/capabilities` reports `remoteProjectWrites=true` only in that state. E5 additionally reports `collaboration=true` when the durable operation store and realtime hub are wired.

## Authentication

All E4 endpoints require the opaque session cookie created by OIDC login.

`GET /api/auth/me` returns the authenticated identity plus `csrfToken`. The opaque session id is never returned in JSON.

Every mutating request must send `X-NetWizard-CSRF: <csrfToken>`. The server compares it in constant time with the token bound to the current server-side session.

Sessions created before migration `0003_authorized_remote_crud.sql` are invalidated because they have no E4 CSRF binding.

## Roles

| Operation | viewer | editor | owner |
| --- | --- | --- | --- |
| List own workspaces | yes | yes | yes |
| List workspace projects | yes | yes | yes |
| Open project | yes | yes | yes |
| Create project | no | yes | yes |
| Save revision | no | yes | yes |
| Delete project | no | no | yes |

Authorization uses the internal `users.id`, not the external OIDC `sub`, so multiple issuers can safely contain the same subject value.

## Endpoints

### `GET /api/workspaces`

Lists only workspaces where the authenticated user has a membership.

### `POST /api/workspaces`

Body: `{ "name": "Network Team" }`. Creates the workspace and an `owner` membership for the current user.

### `GET /api/workspaces/{workspaceID}/projects`

Requires at least `viewer` and returns active projects only.

### `POST /api/workspaces/{workspaceID}/projects`

Requires at least `editor`. The body contains `name` and a NetWizard 3.50.0 `snapshot`. The server generates the project id and creates immutable revision 1.

### `GET /api/projects/{projectID}`

Requires at least `viewer`. Returns project metadata and the current revision snapshot. E5 also returns an `ETag`; `If-None-Match` may return 304.

### `PUT /api/projects/{projectID}`

Requires at least `editor`. The body contains `expectedVersion` and `snapshot`. If another client already advanced the version, the server returns HTTP 409 and does not overwrite the current snapshot. E5 accepts `If-Match`; a stale ETag returns 412 and a successful save broadcasts `resync_required` to active project sockets.

### `DELETE /api/projects/{projectID}`

Requires `owner`. Deletion is logical: the project disappears from active reads while revisions and audit history remain stored.

## Response semantics

- `401` — missing or invalid session;
- `403` — authenticated but missing required role, or CSRF failure;
- `404` — project no longer exists for an already authorized operation;
- `409` — optimistic version conflict;
- `413` — body/snapshot exceeds configured limits;
- `429` — per-user write rate limit exceeded;
- `500` — storage or limiter failure.

## Limits

Project snapshots remain constrained by `NETWIZARD_MAX_PROJECT_BYTES`.

Mutations are limited to 60 requests per minute per authenticated user. The bucket is persisted with an atomic PostgreSQL upsert, so multiple backend instances share the same limit.

## Audit

E4 records `workspace.create`, `project.create`, `project.revision.save`, and `project.delete`.

Audit events keep the external actor subject for traceability while authorization itself uses the internal user id.

## E5 additions

E5 adds authenticated revision metadata, durable operation replay and WebSocket collaboration:

- `GET /api/projects/{projectID}/revisions?limit=N`;
- `GET /api/projects/{projectID}/operations?baseVersion=N&since=S`;
- `GET /api/projects/{projectID}/ws?clientId=...&baseVersion=N&sinceSeq=S`.

See [`SAAS_COLLABORATION.md`](./SAAS_COLLABORATION.md) for the realtime protocol, replay/resync rules, idempotency and scaling constraints.

## Deliberately not included yet

Membership invitation/administration UI and shared cross-instance realtime pub/sub remain future work.
