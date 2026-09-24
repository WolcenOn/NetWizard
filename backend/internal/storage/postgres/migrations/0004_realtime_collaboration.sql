CREATE TABLE IF NOT EXISTS project_operation_counters (
    project_id TEXT PRIMARY KEY REFERENCES projects(id) ON DELETE CASCADE,
    last_seq BIGINT NOT NULL DEFAULT 0 CHECK (last_seq >= 0)
);

CREATE INDEX IF NOT EXISTS idx_project_operations_project_seq
    ON project_operations(project_id, seq);

CREATE INDEX IF NOT EXISTS idx_project_operations_created
    ON project_operations(project_id, created_at);
