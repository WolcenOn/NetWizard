package postgres

import (
	"context"
	"encoding/json"
	"errors"
	"os"
	"strconv"
	"testing"
	"time"

	"github.com/WolcenOn/NetWizard/backend/internal/auth"
	"github.com/WolcenOn/NetWizard/backend/internal/projects"
)

func TestStoreRoundTripAndOptimisticConcurrency(t *testing.T) {
	databaseURL := os.Getenv("NETWIZARD_TEST_DATABASE_URL")
	if databaseURL == "" {
		t.Skip("NETWIZARD_TEST_DATABASE_URL is not configured")
	}

	ctx, cancel := context.WithTimeout(context.Background(), 20*time.Second)
	defer cancel()

	store, err := Open(ctx, databaseURL, 1024*1024)
	if err != nil {
		t.Fatal(err)
	}
	defer store.Close()

	if err := Migrate(ctx, store.db); err != nil {
		t.Fatalf("migrations should be idempotent: %v", err)
	}

	suffix := strconv.FormatInt(time.Now().UnixNano(), 36)
	subject := "oidc|owner-" + suffix
	userID := "usr-" + suffix
	workspaceID := "ws-" + suffix
	projectID := "prj-" + suffix

	if _, err := store.db.ExecContext(ctx,
		"INSERT INTO users(id, external_subject, email) VALUES ($1, $2, $3)",
		userID, subject, "owner@example.test",
	); err != nil {
		t.Fatal(err)
	}
	if _, err := store.db.ExecContext(ctx,
		"INSERT INTO workspaces(id, name, created_by_subject) VALUES ($1, $2, $3)",
		workspaceID, "Workspace E2", subject,
	); err != nil {
		t.Fatal(err)
	}
	if _, err := store.db.ExecContext(ctx,
		"INSERT INTO workspace_memberships(workspace_id, user_id, role) VALUES ($1, $2, 'owner')",
		workspaceID, userID,
	); err != nil {
		t.Fatal(err)
	}

	snapshotV1 := json.RawMessage(`{"_schemaVersion":"3.50.0","projName":"Proyecto E2","devices":[],"hosts":[]}`)
	project, revision, err := store.CreateProject(ctx, projects.CreateInput{
		ID:            projectID,
		WorkspaceID:   workspaceID,
		Name:          "Proyecto E2",
		SchemaVersion: projects.SupportedSchemaVersion,
		Snapshot:      snapshotV1,
		CreatedBy:     subject,
	})
	if err != nil {
		t.Fatal(err)
	}
	if project.CurrentVersion != 1 || revision.Version != 1 {
		t.Fatalf("expected initial version 1, got project=%d revision=%d", project.CurrentVersion, revision.Version)
	}
	if revision.Checksum != projects.SnapshotChecksum(snapshotV1) {
		t.Fatalf("unexpected checksum %s", revision.Checksum)
	}

	loaded, loadedRevision, err := store.GetProject(ctx, projectID)
	if err != nil {
		t.Fatal(err)
	}
	if loaded.ID != projectID || loadedRevision.Version != 1 {
		t.Fatalf("unexpected loaded project/revision: %#v %#v", loaded, loadedRevision)
	}

	list, err := store.ListWorkspaceProjects(ctx, workspaceID)
	if err != nil {
		t.Fatal(err)
	}
	if len(list) != 1 || list[0].ID != projectID {
		t.Fatalf("unexpected workspace list: %#v", list)
	}

	snapshotV2 := json.RawMessage(`{"_schemaVersion":"3.50.0","projName":"Proyecto E2","devices":[{"id":"sw1","name":"SW-01"}],"hosts":[]}`)
	projectV2, revisionV2, err := store.SaveRevision(ctx, projects.SaveRevisionInput{
		ProjectID:       projectID,
		ExpectedVersion: 1,
		SchemaVersion:   projects.SupportedSchemaVersion,
		Snapshot:        snapshotV2,
		CreatedBy:       subject,
	})
	if err != nil {
		t.Fatal(err)
	}
	if projectV2.CurrentVersion != 2 || revisionV2.Version != 2 {
		t.Fatalf("expected version 2, got project=%d revision=%d", projectV2.CurrentVersion, revisionV2.Version)
	}

	history, err := store.ListRevisions(ctx, projectID, 10)
	if err != nil {
		t.Fatal(err)
	}
	if len(history) != 2 || history[0].Version != 2 || history[1].Version != 1 {
		t.Fatalf("unexpected revision history: %#v", history)
	}

	_, _, err = store.SaveRevision(ctx, projects.SaveRevisionInput{
		ProjectID:       projectID,
		ExpectedVersion: 1,
		SchemaVersion:   projects.SupportedSchemaVersion,
		Snapshot:        snapshotV2,
		CreatedBy:       subject,
	})
	if !errors.Is(err, projects.ErrVersionConflict) {
		t.Fatalf("expected version conflict, got %v", err)
	}

	role, err := store.RoleForProject(ctx, projectID, subject)
	if err != nil {
		t.Fatal(err)
	}
	if role != auth.RoleOwner {
		t.Fatalf("expected owner role, got %q", role)
	}

	var auditCount int
	if err := store.db.QueryRowContext(ctx,
		"SELECT COUNT(*) FROM audit_events WHERE project_id = $1",
		projectID,
	).Scan(&auditCount); err != nil {
		t.Fatal(err)
	}
	if auditCount != 2 {
		t.Fatalf("expected 2 audit events, got %d", auditCount)
	}
}
