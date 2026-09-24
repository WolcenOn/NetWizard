package httpapi

import (
	"context"
	"crypto/sha256"
	"encoding/json"
	"io"
	"log/slog"
	"net/http"
	"net/http/httptest"
	"strings"
	"sync"
	"testing"
	"time"

	"github.com/WolcenOn/NetWizard/backend/internal/auth"
	"github.com/WolcenOn/NetWizard/backend/internal/config"
	"github.com/WolcenOn/NetWizard/backend/internal/projects"
	"github.com/WolcenOn/NetWizard/backend/internal/realtime"
	"github.com/WolcenOn/NetWizard/backend/internal/workspaces"
)

type memoryOperationStore struct {
	mu    sync.Mutex
	items []realtime.OperationEnvelope
}

func (m *memoryOperationStore) AppendOperation(_ context.Context, projectID string, op realtime.Operation, actor string) (realtime.OperationEnvelope, error) {
	m.mu.Lock()
	defer m.mu.Unlock()
	for _, item := range m.items {
		if item.ProjectID == projectID && item.Operation.OpID == op.OpID {
			return item, nil
		}
	}
	env := realtime.OperationEnvelope{
		ProjectID: projectID, Seq: int64(len(m.items) + 1), Operation: op,
		CreatedBy: actor, CreatedAt: time.Now().UTC(),
	}
	m.items = append(m.items, env)
	return env, nil
}

func (m *memoryOperationStore) OperationsSince(_ context.Context, projectID string, baseVersion, sinceSeq int64, limit int) ([]realtime.OperationEnvelope, error) {
	m.mu.Lock()
	defer m.mu.Unlock()
	out := []realtime.OperationEnvelope{}
	for _, item := range m.items {
		if item.ProjectID == projectID && item.Operation.BaseVersion == baseVersion && item.Seq > sinceSeq {
			out = append(out, item)
			if limit > 0 && len(out) >= limit {
				break
			}
		}
	}
	return out, nil
}

func (m *memoryOperationStore) LatestOperationSeq(_ context.Context, projectID string, baseVersion int64) (int64, error) {
	m.mu.Lock()
	defer m.mu.Unlock()
	var latest int64
	for _, item := range m.items {
		if item.ProjectID == projectID && item.Operation.BaseVersion == baseVersion && item.Seq > latest {
			latest = item.Seq
		}
	}
	return latest, nil
}

func newCollaborationServer(t *testing.T) (*Server, string, *remoteStore, *memoryOperationStore) {
	t.Helper()
	rawSession := "collaboration-session"
	hash := sha256.Sum256([]byte(rawSession))
	sessionStore := &httpAuthStore{session: auth.Session{
		IDHash: hash[:], UserID: "usr-collab", Issuer: "https://issuer.example",
		Subject: "sub-collab", Email: "collab@example.test", DisplayName: "Collab User",
		CSRFToken: "csrf-collab", CreatedAt: time.Now().Add(-time.Minute), ExpiresAt: time.Now().Add(time.Hour),
	}}
	manager := &auth.SessionManager{Store: sessionStore, Cookie: auth.CookieConfig{Name: "netwizard_session"}}
	service := &auth.Service{Sessions: manager}
	store := newRemoteStore()
	ops := &memoryOperationStore{}
	logger := slog.New(slog.NewTextHandler(io.Discard, nil))
	server := NewServerWithDependencies(config.Config{
		Version: "test", MaxProjectBytes: 1024,
		AllowedOrigins: []string{"https://app.example"},
	}, logger, Dependencies{
		Projects: store, Workspaces: store, Access: store, Limits: store, Auth: service,
		Operations: ops, Realtime: realtime.NewHub(),
	})
	return server, rawSession, store, ops
}

func seedCollaborationProject(t *testing.T, store *remoteStore) (workspaces.Workspace, projects.Project) {
	t.Helper()
	ws, err := store.CreateWorkspace(context.Background(), workspaces.CreateInput{
		ID: "ws-collab", Name: "Collab", UserID: "usr-collab", CreatedBy: "sub-collab",
	})
	if err != nil {
		t.Fatal(err)
	}
	snapshot := json.RawMessage(`{"_schemaVersion":"3.50.0","projName":"Collab","devices":[],"hosts":[]}`)
	project, _, err := store.CreateProject(context.Background(), projects.CreateInput{
		ID: "prj-collab", WorkspaceID: ws.ID, Name: "Collab", Snapshot: snapshot, CreatedBy: "sub-collab",
	})
	if err != nil {
		t.Fatal(err)
	}
	return ws, project
}

func TestCollaborationCapabilitiesETagHistoryAndReplay(t *testing.T) {
	server, rawSession, store, ops := newCollaborationServer(t)
	_, project := seedCollaborationProject(t, store)

	req := authenticatedRequest(http.MethodGet, "/api/capabilities", "", rawSession, false)
	rec := httptest.NewRecorder()
	server.Handler().ServeHTTP(rec, req)
	if rec.Code != http.StatusOK || !strings.Contains(rec.Body.String(), `"collaboration":true`) {
		t.Fatalf("collaboration capability not enabled: %d %s", rec.Code, rec.Body.String())
	}

	req = authenticatedRequest(http.MethodGet, "/api/projects/"+project.ID, "", rawSession, false)
	rec = httptest.NewRecorder()
	server.Handler().ServeHTTP(rec, req)
	if rec.Code != http.StatusOK {
		t.Fatalf("project GET expected 200, got %d: %s", rec.Code, rec.Body.String())
	}
	etag := rec.Header().Get("ETag")
	if etag == "" {
		t.Fatal("project GET should return ETag")
	}

	req = authenticatedRequest(http.MethodGet, "/api/projects/"+project.ID, "", rawSession, false)
	req.Header.Set("If-None-Match", etag)
	rec = httptest.NewRecorder()
	server.Handler().ServeHTTP(rec, req)
	if rec.Code != http.StatusNotModified {
		t.Fatalf("If-None-Match expected 304, got %d", rec.Code)
	}

	req = authenticatedRequest(http.MethodGet, "/api/projects/"+project.ID+"/revisions", "", rawSession, false)
	rec = httptest.NewRecorder()
	server.Handler().ServeHTTP(rec, req)
	if rec.Code != http.StatusOK || !strings.Contains(rec.Body.String(), `"version":1`) {
		t.Fatalf("revision history expected version 1, got %d: %s", rec.Code, rec.Body.String())
	}

	_, _ = ops.AppendOperation(context.Background(), project.ID, realtime.Operation{
		OpID: "op-1", ClientID: "client-1", BaseVersion: 1,
		Kind: realtime.OperationDeviceUpdate, Payload: json.RawMessage(`{"name":"SW1"}`),
	}, "sub-collab")
	_, _ = ops.AppendOperation(context.Background(), project.ID, realtime.Operation{
		OpID: "op-2", ClientID: "client-1", BaseVersion: 1,
		Kind: realtime.OperationHostUpdate, Payload: json.RawMessage(`{"name":"Host1"}`),
	}, "sub-collab")

	req = authenticatedRequest(http.MethodGet, "/api/projects/"+project.ID+"/operations?baseVersion=1&since=1", "", rawSession, false)
	rec = httptest.NewRecorder()
	server.Handler().ServeHTTP(rec, req)
	if rec.Code != http.StatusOK || !strings.Contains(rec.Body.String(), `"latestSeq":2`) ||
		!strings.Contains(rec.Body.String(), `"opId":"op-2"`) ||
		strings.Contains(rec.Body.String(), `"opId":"op-1"`) {
		t.Fatalf("unexpected operation replay: %d %s", rec.Code, rec.Body.String())
	}
}

func TestETagPreconditionAndWebSocketGuards(t *testing.T) {
	server, rawSession, store, _ := newCollaborationServer(t)
	_, project := seedCollaborationProject(t, store)
	snapshot := `{"_schemaVersion":"3.50.0","projName":"Collab","devices":[],"hosts":[]}`

	req := authenticatedRequest(http.MethodPut, "/api/projects/"+project.ID,
		`{"expectedVersion":1,"snapshot":`+snapshot+`}`, rawSession, true)
	req.Header.Set("If-Match", `"stale"`)
	rec := httptest.NewRecorder()
	server.Handler().ServeHTTP(rec, req)
	if rec.Code != http.StatusPreconditionFailed {
		t.Fatalf("stale If-Match expected 412, got %d: %s", rec.Code, rec.Body.String())
	}

	req = httptest.NewRequest(http.MethodGet, "/api/projects/"+project.ID+"/ws?clientId=c1", nil)
	req.Header.Set("Upgrade", "websocket")
	req.Header.Set("Connection", "Upgrade")
	req.Header.Set("Sec-WebSocket-Version", "13")
	req.Header.Set("Sec-WebSocket-Key", "dGhlIHNhbXBsZSBub25jZQ==")
	rec = httptest.NewRecorder()
	server.Handler().ServeHTTP(rec, req)
	if rec.Code != http.StatusUnauthorized {
		t.Fatalf("anonymous websocket expected 401, got %d", rec.Code)
	}

	req = authenticatedRequest(http.MethodGet, "/api/projects/"+project.ID+"/ws?clientId=c1", "", rawSession, false)
	req.Header.Set("Origin", "https://evil.example")
	req.Header.Set("Upgrade", "websocket")
	req.Header.Set("Connection", "Upgrade")
	req.Header.Set("Sec-WebSocket-Version", "13")
	req.Header.Set("Sec-WebSocket-Key", "dGhlIHNhbXBsZSBub25jZQ==")
	rec = httptest.NewRecorder()
	server.Handler().ServeHTTP(rec, req)
	if rec.Code != http.StatusForbidden {
		t.Fatalf("cross-origin websocket expected 403, got %d", rec.Code)
	}
}
