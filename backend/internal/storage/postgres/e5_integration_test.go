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
	"github.com/WolcenOn/NetWizard/backend/internal/realtime"
	"github.com/WolcenOn/NetWizard/backend/internal/workspaces"
)

func TestRealtimeOperationStoreIdempotencyReplayAndConflicts(t *testing.T) {
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

	suffix := strconv.FormatInt(time.Now().UnixNano(), 36)
	user, err := store.UpsertUser(ctx, auth.ExternalIdentity{
		Issuer: "https://issuer.example", Subject: "collab-" + suffix,
		Email: "collab-" + suffix + "@example.test",
	}, "usr-e5-"+suffix)
	if err != nil {
		t.Fatal(err)
	}
	ws, err := store.CreateWorkspace(ctx, workspaces.CreateInput{
		ID: "ws-e5-" + suffix, Name: "Realtime", UserID: user.ID, CreatedBy: user.Subject,
	})
	if err != nil {
		t.Fatal(err)
	}
	snapshotV1 := json.RawMessage(`{"_schemaVersion":"3.50.0","projName":"Realtime","devices":[],"hosts":[]}`)
	project, _, err := store.CreateProject(ctx, projects.CreateInput{
		ID: "prj-e5-" + suffix, WorkspaceID: ws.ID, Name: "Realtime",
		Snapshot: snapshotV1, CreatedBy: user.Subject,
	})
	if err != nil {
		t.Fatal(err)
	}

	op1 := realtime.Operation{
		OpID: "op-1-" + suffix, ClientID: "client-1", BaseVersion: 1,
		Kind: realtime.OperationDeviceUpdate, EntityID: "sw1",
		Payload: json.RawMessage(`{"name":"SW-1"}`),
	}
	env1, err := store.AppendOperation(ctx, project.ID, op1, user.Subject)
	if err != nil {
		t.Fatal(err)
	}
	if env1.Seq != 1 {
		t.Fatalf("expected seq 1, got %d", env1.Seq)
	}
	dup, err := store.AppendOperation(ctx, project.ID, op1, user.Subject)
	if err != nil {
		t.Fatal(err)
	}
	if dup.Seq != env1.Seq || dup.Operation.OpID != op1.OpID {
		t.Fatalf("duplicate operation should return original envelope: %#v", dup)
	}

	snapshotV2 := json.RawMessage(`{"_schemaVersion":"3.50.0","projName":"Realtime","devices":[{"id":"sw1"}],"hosts":[]}`)
	if _, _, err := store.SaveRevision(ctx, projects.SaveRevisionInput{
		ProjectID: project.ID, ExpectedVersion: 1, Snapshot: snapshotV2, CreatedBy: user.Subject,
	}); err != nil {
		t.Fatal(err)
	}

	dupAfterSnapshot, err := store.AppendOperation(ctx, project.ID, op1, user.Subject)
	if err != nil {
		t.Fatalf("idempotent retry after snapshot advance should succeed: %v", err)
	}
	if dupAfterSnapshot.Seq != 1 {
		t.Fatalf("retry should keep seq 1, got %d", dupAfterSnapshot.Seq)
	}

	stale := realtime.Operation{
		OpID: "op-stale-" + suffix, ClientID: "client-1", BaseVersion: 1,
		Kind: realtime.OperationHostUpdate, Payload: json.RawMessage(`{"id":"h1"}`),
	}
	if _, err := store.AppendOperation(ctx, project.ID, stale, user.Subject); !errors.Is(err, realtime.ErrOperationConflict) {
		t.Fatalf("expected base version conflict, got %v", err)
	}

	op2 := realtime.Operation{
		OpID: "op-2-" + suffix, ClientID: "client-1", BaseVersion: 2,
		Kind: realtime.OperationHostUpdate, Payload: json.RawMessage(`{"id":"h1"}`),
	}
	env2, err := store.AppendOperation(ctx, project.ID, op2, user.Subject)
	if err != nil {
		t.Fatal(err)
	}
	if env2.Seq != 2 {
		t.Fatalf("expected seq 2, got %d", env2.Seq)
	}

	replay, err := store.OperationsSince(ctx, project.ID, 1, 100)
	if err != nil {
		t.Fatal(err)
	}
	if len(replay) != 1 || replay[0].Seq != 2 || replay[0].Operation.OpID != op2.OpID {
		t.Fatalf("unexpected replay: %#v", replay)
	}
	latest, err := store.LatestOperationSeq(ctx, project.ID)
	if err != nil {
		t.Fatal(err)
	}
	if latest != 2 {
		t.Fatalf("expected latest seq 2, got %d", latest)
	}

	var audits int
	if err := store.db.QueryRowContext(ctx,
		"SELECT COUNT(*) FROM audit_events WHERE project_id = $1 AND action = 'project.operation.append'",
		project.ID,
	).Scan(&audits); err != nil {
		t.Fatal(err)
	}
	if audits != 2 {
		t.Fatalf("expected one audit per accepted unique operation, got %d", audits)
	}
}
