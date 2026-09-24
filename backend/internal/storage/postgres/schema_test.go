package postgres

import (
	"os"
	"strings"
	"testing"
)

func TestFoundationMigrationContainsSaaSOwnershipAndVersioning(t *testing.T) {
	raw, err := os.ReadFile("migrations/0001_saas_foundation.sql")
	if err != nil {
		t.Fatal(err)
	}
	sql := string(raw)
	for _, needle := range []string{
		"CREATE TABLE IF NOT EXISTS users",
		"CREATE TABLE IF NOT EXISTS workspaces",
		"CREATE TABLE IF NOT EXISTS workspace_memberships",
		"CREATE TABLE IF NOT EXISTS projects",
		"CREATE TABLE IF NOT EXISTS project_revisions",
		"CREATE TABLE IF NOT EXISTS project_operations",
		"CREATE TABLE IF NOT EXISTS audit_events",
		"UNIQUE (project_id, op_id)",
		"role IN ('owner','editor','viewer')",
	} {
		if !strings.Contains(sql, needle) {
			t.Fatalf("migration missing %q", needle)
		}
	}
}


func TestOIDCSessionMigrationScopesIdentityAndPersistsSessions(t *testing.T) {
	raw, err := os.ReadFile("migrations/0002_oidc_sessions.sql")
	if err != nil {
		t.Fatal(err)
	}
	sql := string(raw)
	for _, needle := range []string{
		"external_issuer",
		"idx_users_external_identity",
		"CREATE TABLE IF NOT EXISTS oidc_login_states",
		"CREATE TABLE IF NOT EXISTS auth_sessions",
		"revoked_at",
	} {
		if !strings.Contains(sql, needle) {
			t.Fatalf("OIDC migration missing %q", needle)
		}
	}
}


func TestAuthorizedRemoteCRUDMigrationBindsCSRFToSessions(t *testing.T) {
	raw, err := os.ReadFile("migrations/0003_authorized_remote_crud.sql")
	if err != nil {
		t.Fatal(err)
	}
	sql := string(raw)
	for _, needle := range []string{
		"ADD COLUMN IF NOT EXISTS csrf_token",
		"DELETE FROM auth_sessions",
		"ALTER COLUMN csrf_token SET NOT NULL",
		"CREATE TABLE IF NOT EXISTS api_write_limits",
	} {
		if !strings.Contains(sql, needle) {
			t.Fatalf("E4 migration missing %q", needle)
		}
	}
}
