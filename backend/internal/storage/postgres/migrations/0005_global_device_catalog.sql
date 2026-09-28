CREATE TABLE IF NOT EXISTS global_device_models (
    id TEXT PRIMARY KEY,
    manufacturer TEXT NOT NULL,
    model TEXT NOT NULL,
    sku TEXT NOT NULL DEFAULT '',
    revision TEXT NOT NULL DEFAULT '',
    kind TEXT NOT NULL,
    definition JSONB NOT NULL,
    validated BOOLEAN NOT NULL DEFAULT TRUE,
    created_by_subject TEXT NOT NULL,
    updated_by_subject TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_global_device_models_identity
ON global_device_models (LOWER(manufacturer), LOWER(model), LOWER(COALESCE(sku,'')), LOWER(COALESCE(revision,'')));
