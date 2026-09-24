ALTER TABLE auth_sessions
    ADD COLUMN IF NOT EXISTS csrf_token TEXT;

-- Sessions created before E4 do not have a CSRF binding. Invalidate them
-- instead of silently accepting mutations without the stronger E4 contract.
DELETE FROM auth_sessions
WHERE csrf_token IS NULL OR csrf_token = '';

ALTER TABLE auth_sessions
    ALTER COLUMN csrf_token SET NOT NULL;


CREATE TABLE IF NOT EXISTS api_write_limits (
    user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    window_start TIMESTAMPTZ NOT NULL,
    request_count INTEGER NOT NULL CHECK (request_count > 0)
);
