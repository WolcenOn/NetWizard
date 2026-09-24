CREATE TABLE IF NOT EXISTS project_operation_counters (
    project_id TEXT PRIMARY KEY REFERENCES projects(id) ON DELETE CASCADE,
    last_seq BIGINT NOT NULL DEFAULT 0 CHECK (last_seq >= 0)
);

INSERT INTO project_operation_counters(project_id, last_seq)
SELECT project_id, MAX(seq)
FROM project_operations
GROUP BY project_id
ON CONFLICT (project_id)
DO UPDATE SET last_seq = GREATEST(project_operation_counters.last_seq, EXCLUDED.last_seq);

CREATE INDEX IF NOT EXISTS idx_project_operations_project_seq
    ON project_operations(project_id, seq);

CREATE INDEX IF NOT EXISTS idx_project_operations_created
    ON project_operations(project_id, created_at);
