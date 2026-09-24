package postgres

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"time"

	"github.com/WolcenOn/NetWizard/backend/internal/auth"
)

func (s *Store) SaveLoginState(ctx context.Context, state auth.LoginState) error {
	if s == nil || s.db == nil {
		return errors.New("postgres: store is not initialized")
	}
	_, err := s.db.ExecContext(ctx, `
INSERT INTO oidc_login_states(state_hash, nonce, pkce_verifier, return_to, expires_at)
VALUES ($1, $2, $3, $4, $5)
`, state.StateHash, state.Nonce, state.PKCEVerifier, state.ReturnTo, state.ExpiresAt)
	if err != nil {
		return fmt.Errorf("postgres: save oidc login state: %w", err)
	}
	return nil
}

func (s *Store) ConsumeLoginState(ctx context.Context, stateHash []byte, now time.Time) (auth.LoginState, error) {
	var state auth.LoginState
	err := s.db.QueryRowContext(ctx, `
DELETE FROM oidc_login_states
WHERE state_hash = $1 AND expires_at > $2
RETURNING state_hash, nonce, pkce_verifier, return_to, expires_at
`, stateHash, now).Scan(&state.StateHash, &state.Nonce, &state.PKCEVerifier, &state.ReturnTo, &state.ExpiresAt)
	if errors.Is(err, sql.ErrNoRows) {
		return auth.LoginState{}, auth.ErrInvalidState
	}
	if err != nil {
		return auth.LoginState{}, fmt.Errorf("postgres: consume oidc login state: %w", err)
	}
	return state, nil
}

func (s *Store) UpsertUser(ctx context.Context, identity auth.ExternalIdentity, candidateID string) (auth.User, error) {
	var user auth.User
	err := s.db.QueryRowContext(ctx, `
INSERT INTO users(id, external_issuer, external_subject, email, display_name)
VALUES ($1, $2, $3, NULLIF($4,''), NULLIF($5,''))
ON CONFLICT (external_issuer, external_subject)
DO UPDATE SET
    email = EXCLUDED.email,
    display_name = EXCLUDED.display_name,
    updated_at = NOW()
RETURNING id, external_issuer, external_subject, COALESCE(email,''), COALESCE(display_name,'')
`, candidateID, identity.Issuer, identity.Subject, identity.Email, identity.DisplayName).
		Scan(&user.ID, &user.Issuer, &user.Subject, &user.Email, &user.DisplayName)
	if err != nil {
		return auth.User{}, fmt.Errorf("postgres: upsert oidc user: %w", err)
	}
	return user, nil
}

func (s *Store) CreateSession(ctx context.Context, session auth.Session) error {
	_, err := s.db.ExecContext(ctx, `
INSERT INTO auth_sessions(id_hash, user_id, created_at, expires_at)
VALUES ($1, $2, $3, $4)
`, session.IDHash, session.UserID, session.CreatedAt, session.ExpiresAt)
	if err != nil {
		return fmt.Errorf("postgres: create auth session: %w", err)
	}
	return nil
}

func (s *Store) GetSession(ctx context.Context, idHash []byte, now time.Time) (auth.Session, error) {
	var session auth.Session
	err := s.db.QueryRowContext(ctx, `
SELECT s.id_hash, s.user_id, u.external_issuer, u.external_subject,
       COALESCE(u.email,''), COALESCE(u.display_name,''),
       s.created_at, s.expires_at
FROM auth_sessions s
JOIN users u ON u.id = s.user_id
WHERE s.id_hash = $1
  AND s.revoked_at IS NULL
  AND s.expires_at > $2
`, idHash, now).Scan(
		&session.IDHash, &session.UserID, &session.Issuer, &session.Subject,
		&session.Email, &session.DisplayName,
		&session.CreatedAt, &session.ExpiresAt,
	)
	if errors.Is(err, sql.ErrNoRows) {
		return auth.Session{}, auth.ErrInvalidSession
	}
	if err != nil {
		return auth.Session{}, fmt.Errorf("postgres: get auth session: %w", err)
	}
	_, _ = s.db.ExecContext(ctx, `
UPDATE auth_sessions SET last_seen_at = $2
WHERE id_hash = $1 AND (last_seen_at IS NULL OR last_seen_at < $2 - INTERVAL '5 minutes')
`, idHash, now)
	return session, nil
}

func (s *Store) DeleteSession(ctx context.Context, idHash []byte) error {
	_, err := s.db.ExecContext(ctx, `
UPDATE auth_sessions
SET revoked_at = COALESCE(revoked_at, NOW())
WHERE id_hash = $1
`, idHash)
	if err != nil {
		return fmt.Errorf("postgres: revoke auth session: %w", err)
	}
	return nil
}
