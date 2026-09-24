package postgres

import (
	"context"
	"crypto/sha256"
	"os"
	"strconv"
	"testing"
	"time"

	"github.com/WolcenOn/NetWizard/backend/internal/auth"
	"github.com/WolcenOn/NetWizard/backend/internal/workspaces"
)

func TestWorkspaceAndSessionPersistenceE4(t *testing.T) {
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
		Issuer: "https://issuer.example",
		Subject: "workspace-owner-" + suffix,
		Email: "owner-" + suffix + "@example.test",
		DisplayName: "Workspace Owner",
	}, "usr-e4-"+suffix)
	if err != nil {
		t.Fatal(err)
	}

	ws, err := store.CreateWorkspace(ctx, workspaces.CreateInput{
		ID: "ws-e4-" + suffix,
		Name: "Workspace E4",
		UserID: user.ID,
		CreatedBy: user.Subject,
	})
	if err != nil {
		t.Fatal(err)
	}
	if ws.Role != auth.RoleOwner {
		t.Fatalf("new workspace should return owner role, got %q", ws.Role)
	}

	list, err := store.ListUserWorkspaces(ctx, user.ID)
	if err != nil {
		t.Fatal(err)
	}
	found := false
	for _, item := range list {
		if item.ID == ws.ID {
			found = item.Role == auth.RoleOwner
		}
	}
	if !found {
		t.Fatalf("workspace %s missing from owner list: %#v", ws.ID, list)
	}

	var workspaceAudits int
	if err := store.db.QueryRowContext(ctx,
		"SELECT COUNT(*) FROM audit_events WHERE workspace_id = $1 AND action = 'workspace.create'",
		ws.ID,
	).Scan(&workspaceAudits); err != nil {
		t.Fatal(err)
	}
	if workspaceAudits != 1 {
		t.Fatalf("expected one workspace.create audit event, got %d", workspaceAudits)
	}

	rawSession := "session-" + suffix
	hash := sha256.Sum256([]byte(rawSession))
	session := auth.Session{
		IDHash: hash[:],
		UserID: user.ID,
		Issuer: user.Issuer,
		Subject: user.Subject,
		Email: user.Email,
		DisplayName: user.DisplayName,
		CSRFToken: "csrf-" + suffix,
		CreatedAt: time.Now().UTC(),
		ExpiresAt: time.Now().UTC().Add(time.Hour),
	}
	if err := store.CreateSession(ctx, session); err != nil {
		t.Fatal(err)
	}
	loaded, err := store.GetSession(ctx, hash[:], time.Now().UTC())
	if err != nil {
		t.Fatal(err)
	}
	if loaded.UserID != user.ID || loaded.CSRFToken != session.CSRFToken {
		t.Fatalf("session lost E4 identity/CSRF binding: %#v", loaded)
	}

	now := time.Now().UTC()
	for i, expected := range []bool{true, true, false} {
		allowed, err := store.AllowWrite(ctx, user.ID, now.Add(time.Duration(i)*time.Second), 2, time.Minute)
		if err != nil {
			t.Fatal(err)
		}
		if allowed != expected {
			t.Fatalf("rate limit call %d expected allowed=%v, got %v", i+1, expected, allowed)
		}
	}
	allowed, err := store.AllowWrite(ctx, user.ID, now.Add(2*time.Minute), 2, time.Minute)
	if err != nil {
		t.Fatal(err)
	}
	if !allowed {
		t.Fatal("rate limit window should reset after one minute")
	}
}
