CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    external_subject TEXT NOT NULL UNIQUE,
    email TEXT,
    display_name TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS workspaces (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    created_by_subject TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS workspace_memberships (
    workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role TEXT NOT NULL CHECK (role IN ('owner','editor','viewer')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (workspace_id, user_id)
);

CREATE TABLE IF NOT EXISTS projects (
    id TEXT PRIMARY KEY,
    workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    schema_version TEXT NOT NULL,
    current_version BIGINT NOT NULL DEFAULT 0 CHECK (current_version >= 0),
    created_by_subject TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_projects_workspace_active
    ON projects(workspace_id, updated_at DESC)
    WHERE deleted_at IS NULL;

CREATE TABLE IF NOT EXISTS project_revisions (
    project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    version BIGINT NOT NULL CHECK (version > 0),
    schema_version TEXT NOT NULL,
    snapshot JSONB NOT NULL,
    checksum TEXT NOT NULL,
    created_by_subject TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (project_id, version)
);

CREATE TABLE IF NOT EXISTS project_operations (
    project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    seq BIGINT NOT NULL CHECK (seq > 0),
    op_id TEXT NOT NULL,
    client_id TEXT NOT NULL,
    base_version BIGINT NOT NULL CHECK (base_version >= 0),
    kind TEXT NOT NULL,
    entity_id TEXT,
    payload JSONB NOT NULL,
    created_by_subject TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (project_id, seq),
    UNIQUE (project_id, op_id)
);

CREATE TABLE IF NOT EXISTS audit_events (
    id BIGSERIAL PRIMARY KEY,
    workspace_id TEXT REFERENCES workspaces(id) ON DELETE SET NULL,
    project_id TEXT REFERENCES projects(id) ON DELETE SET NULL,
    actor_subject TEXT NOT NULL,
    action TEXT NOT NULL,
    resource_type TEXT NOT NULL,
    resource_id TEXT,
    request_id TEXT,
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_audit_workspace_created
    ON audit_events(workspace_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_audit_project_created
    ON audit_events(project_id, created_at DESC);
