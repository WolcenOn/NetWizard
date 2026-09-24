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
