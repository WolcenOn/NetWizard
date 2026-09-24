ALTER TABLE users
    ADD COLUMN IF NOT EXISTS external_issuer TEXT;

UPDATE users
SET external_issuer = 'legacy'
WHERE external_issuer IS NULL;

ALTER TABLE users
    ALTER COLUMN external_issuer SET NOT NULL;

ALTER TABLE users
    DROP CONSTRAINT IF EXISTS users_external_subject_key;

CREATE UNIQUE INDEX IF NOT EXISTS idx_users_external_identity
    ON users(external_issuer, external_subject);

CREATE TABLE IF NOT EXISTS oidc_login_states (
    state_hash BYTEA PRIMARY KEY,
    nonce TEXT NOT NULL,
    pkce_verifier TEXT NOT NULL,
    return_to TEXT NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_oidc_login_states_expires
    ON oidc_login_states(expires_at);

CREATE TABLE IF NOT EXISTS auth_sessions (
    id_hash BYTEA PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    last_seen_at TIMESTAMPTZ,
    revoked_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_auth_sessions_user
    ON auth_sessions(user_id, expires_at DESC);

CREATE INDEX IF NOT EXISTS idx_auth_sessions_expires
    ON auth_sessions(expires_at)
    WHERE revoked_at IS NULL;
