ALTER TABLE auth_sessions
    ADD COLUMN IF NOT EXISTS csrf_token TEXT;

-- Sessions created before E4 do not have a CSRF binding. Invalidate them
-- instead of silently accepting mutations without the stronger E4 contract.
DELETE FROM auth_sessions
WHERE csrf_token IS NULL OR csrf_token = '';

ALTER TABLE auth_sessions
    ALTER COLUMN csrf_token SET NOT NULL;
