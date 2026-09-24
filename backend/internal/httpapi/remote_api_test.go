package httpapi

import (
	"context"
	"crypto/sha256"
	"encoding/json"
	"errors"
	"fmt"
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
	"github.com/WolcenOn/NetWizard/backend/internal/workspaces"
)

type remoteStore struct {
	mu         sync.Mutex
	workspaces map[string]workspaces.Workspace
	roles      map[string]auth.Role
	projects   map[string]projects.Project
	revisions  map[string]projects.Revision
}

func newRemoteStore() *remoteStore {
	return &remoteStore{
		workspaces: map[string]workspaces.Workspace{},
		roles:      map[string]auth.Role{},
		projects:   map[string]projects.Project{},
		revisions:  map[string]projects.Revision{},
	}
}

func roleKey(resourceID, userID string) string { return resourceID + ":" + userID }

func (s *remoteStore) CreateWorkspace(_ context.Context, input workspaces.CreateInput) (workspaces.Workspace, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	now := time.Now().UTC()
	ws := workspaces.Workspace{
		ID: input.ID, Name: input.Name, Role: auth.RoleOwner, CreatedBy: input.CreatedBy,
		CreatedAt: now, UpdatedAt: now,
	}
	s.workspaces[ws.ID] = ws
	s.roles[roleKey(ws.ID, input.UserID)] = auth.RoleOwner
	return ws, nil
}

func (s *remoteStore) ListUserWorkspaces(_ context.Context, userID string) ([]workspaces.Workspace, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	out := []workspaces.Workspace{}
	for id, ws := range s.workspaces {
		if role, ok := s.roles[roleKey(id, userID)]; ok {
			ws.Role = role
			out = append(out, ws)
		}
	}
	return out, nil
}

func (s *remoteStore) RoleForWorkspace(_ context.Context, workspaceID, userID string) (auth.Role, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	role, ok := s.roles[roleKey(workspaceID, userID)]
	if !ok {
		return "", auth.ErrForbidden
	}
	return role, nil
}

func (s *remoteStore) CreateProject(_ context.Context, input projects.CreateInput) (projects.Project, projects.Revision, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	if _, ok := s.workspaces[input.WorkspaceID]; !ok {
		return projects.Project{}, projects.Revision{}, errors.New("workspace missing")
	}
	schema, err := projects.ValidateSnapshot(input.Snapshot, 1024)
	if err != nil {
		return projects.Project{}, projects.Revision{}, err
	}
	now := time.Now().UTC()
	p := projects.Project{
		ID: input.ID, WorkspaceID: input.WorkspaceID, Name: input.Name,
		SchemaVersion: schema, CurrentVersion: 1, CreatedBy: input.CreatedBy,
		CreatedAt: now, UpdatedAt: now,
	}
	rev := projects.Revision{
		ProjectID: p.ID, Version: 1, SchemaVersion: schema,
		Snapshot: append(json.RawMessage(nil), input.Snapshot...),
		Checksum: projects.SnapshotChecksum(input.Snapshot), CreatedBy: input.CreatedBy, CreatedAt: now,
	}
	s.projects[p.ID], s.revisions[p.ID] = p, rev
	return p, rev, nil
}

func (s *remoteStore) GetProject(_ context.Context, projectID string) (projects.Project, projects.Revision, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	p, ok := s.projects[projectID]
	if !ok {
		return projects.Project{}, projects.Revision{}, projects.ErrNotFound
	}
	return p, s.revisions[projectID], nil
}

func (s *remoteStore) ListWorkspaceProjects(_ context.Context, workspaceID string) ([]projects.Project, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	out := []projects.Project{}
	for _, p := range s.projects {
		if p.WorkspaceID == workspaceID {
			out = append(out, p)
		}
	}
	return out, nil
}

func (s *remoteStore) ListRevisions(context.Context, string, int) ([]projects.Revision, error) {
	return nil, nil
}

func (s *remoteStore) SaveRevision(_ context.Context, input projects.SaveRevisionInput) (projects.Project, projects.Revision, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	p, ok := s.projects[input.ProjectID]
	if !ok {
		return projects.Project{}, projects.Revision{}, projects.ErrNotFound
	}
	if p.CurrentVersion != input.ExpectedVersion {
		return projects.Project{}, projects.Revision{}, projects.ErrVersionConflict
	}
	schema, err := projects.ValidateSnapshot(input.Snapshot, 1024)
	if err != nil {
		return projects.Project{}, projects.Revision{}, err
	}
	p.CurrentVersion++
	p.SchemaVersion = schema
	p.UpdatedAt = time.Now().UTC()
	rev := projects.Revision{
		ProjectID: p.ID, Version: p.CurrentVersion, SchemaVersion: schema,
		Snapshot: append(json.RawMessage(nil), input.Snapshot...),
		Checksum: projects.SnapshotChecksum(input.Snapshot),
		CreatedBy: input.CreatedBy, CreatedAt: p.UpdatedAt,
	}
	s.projects[p.ID], s.revisions[p.ID] = p, rev
	return p, rev, nil
}

func (s *remoteStore) DeleteProject(_ context.Context, projectID, _ string) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	if _, ok := s.projects[projectID]; !ok {
		return projects.ErrNotFound
	}
	delete(s.projects, projectID)
	delete(s.revisions, projectID)
	return nil
}

func (s *remoteStore) AllowWrite(context.Context, string, time.Time, int, time.Duration) (bool, error) {
	return true, nil
}

func (s *remoteStore) RoleForProject(_ context.Context, projectID, userID string) (auth.Role, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	p, ok := s.projects[projectID]
	if !ok {
		return "", auth.ErrForbidden
	}
	role, ok := s.roles[roleKey(p.WorkspaceID, userID)]
	if !ok {
		return "", auth.ErrForbidden
	}
	return role, nil
}

func newRemoteServer(t *testing.T) (*Server, string, *remoteStore) {
	t.Helper()
	rawSession := "remote-session"
	hash := sha256.Sum256([]byte(rawSession))
	sessionStore := &httpAuthStore{session: auth.Session{
		IDHash: hash[:], UserID: "usr-remote", Issuer: "https://issuer.example",
		Subject: "sub-remote", Email: "remote@example.test", DisplayName: "Remote User",
		CSRFToken: "csrf-remote", CreatedAt: time.Now().Add(-time.Minute), ExpiresAt: time.Now().Add(time.Hour),
	}}
	manager := &auth.SessionManager{Store: sessionStore, Cookie: auth.CookieConfig{Name: "netwizard_session"}}
	service := &auth.Service{Sessions: manager}
	store := newRemoteStore()
	logger := slog.New(slog.NewTextHandler(io.Discard, nil))
	server := NewServerWithDependencies(config.Config{Version: "test", MaxProjectBytes: 1024}, logger, Dependencies{
		Projects: store, Workspaces: store, Access: store, Limits: store, Auth: service,
	})
	return server, rawSession, store
}

func authenticatedRequest(method, target, body, session string, csrf bool) *http.Request {
	req := httptest.NewRequest(method, target, strings.NewReader(body))
	if body != "" {
		req.Header.Set("Content-Type", "application/json")
	}
	req.AddCookie(&http.Cookie{Name: "netwizard_session", Value: session})
	if csrf {
		req.Header.Set("X-NetWizard-CSRF", "csrf-remote")
	}
	return req
}

func TestRemoteCRUDRoleMatrixAndCSRF(t *testing.T) {
	server, rawSession, store := newRemoteServer(t)

	req := httptest.NewRequest(http.MethodGet, "/api/workspaces", nil)
	rec := httptest.NewRecorder()
	server.Handler().ServeHTTP(rec, req)
	if rec.Code != http.StatusUnauthorized {
		t.Fatalf("anonymous workspace list expected 401, got %d", rec.Code)
	}

	req = authenticatedRequest(http.MethodPost, "/api/workspaces", `{"name":"Team"}`, rawSession, false)
	rec = httptest.NewRecorder()
	server.Handler().ServeHTTP(rec, req)
	if rec.Code != http.StatusForbidden {
		t.Fatalf("workspace create without CSRF expected 403, got %d", rec.Code)
	}

	req = authenticatedRequest(http.MethodPost, "/api/workspaces", `{"name":"Team"}`, rawSession, true)
	rec = httptest.NewRecorder()
	server.Handler().ServeHTTP(rec, req)
	if rec.Code != http.StatusCreated {
		t.Fatalf("workspace create expected 201, got %d: %s", rec.Code, rec.Body.String())
	}
	var ws workspaces.Workspace
	if err := json.Unmarshal(rec.Body.Bytes(), &ws); err != nil {
		t.Fatal(err)
	}
	if ws.ID == "" || ws.Role != auth.RoleOwner {
		t.Fatalf("unexpected workspace: %#v", ws)
	}

	snapshot1 := `{"_schemaVersion":"3.50.0","projName":"Remote","devices":[],"hosts":[]}`
	req = authenticatedRequest(http.MethodPost, "/api/workspaces/"+ws.ID+"/projects",
		fmt.Sprintf(`{"name":"Remote project","snapshot":%s}`, snapshot1), rawSession, true)
	rec = httptest.NewRecorder()
	server.Handler().ServeHTTP(rec, req)
	if rec.Code != http.StatusCreated {
		t.Fatalf("project create expected 201, got %d: %s", rec.Code, rec.Body.String())
	}
	var created struct {
		Project projects.Project `json:"project"`
	}
	if err := json.Unmarshal(rec.Body.Bytes(), &created); err != nil {
		t.Fatal(err)
	}
	projectID := created.Project.ID
	if projectID == "" {
		t.Fatal("expected generated project id")
	}

	req = authenticatedRequest(http.MethodGet, "/api/projects/"+projectID, "", rawSession, false)
	rec = httptest.NewRecorder()
	server.Handler().ServeHTTP(rec, req)
	if rec.Code != http.StatusOK {
		t.Fatalf("owner read expected 200, got %d", rec.Code)
	}

	store.mu.Lock()
	store.roles[roleKey(ws.ID, "usr-remote")] = auth.RoleViewer
	store.mu.Unlock()

	req = authenticatedRequest(http.MethodGet, "/api/projects/"+projectID, "", rawSession, false)
	rec = httptest.NewRecorder()
	server.Handler().ServeHTTP(rec, req)
	if rec.Code != http.StatusOK {
		t.Fatalf("viewer read expected 200, got %d", rec.Code)
	}

	req = authenticatedRequest(http.MethodPut, "/api/projects/"+projectID,
		fmt.Sprintf(`{"expectedVersion":1,"snapshot":%s}`, snapshot1), rawSession, true)
	rec = httptest.NewRecorder()
	server.Handler().ServeHTTP(rec, req)
	if rec.Code != http.StatusForbidden {
		t.Fatalf("viewer save expected 403, got %d", rec.Code)
	}

	store.mu.Lock()
	store.roles[roleKey(ws.ID, "usr-remote")] = auth.RoleEditor
	store.mu.Unlock()

	snapshot2 := `{"_schemaVersion":"3.50.0","projName":"Remote","devices":[{"id":"sw1"}],"hosts":[]}`
	req = authenticatedRequest(http.MethodPut, "/api/projects/"+projectID,
		fmt.Sprintf(`{"expectedVersion":1,"snapshot":%s}`, snapshot2), rawSession, true)
	rec = httptest.NewRecorder()
	server.Handler().ServeHTTP(rec, req)
	if rec.Code != http.StatusOK || !strings.Contains(rec.Body.String(), `"currentVersion":2`) {
		t.Fatalf("editor save expected version 2, got %d: %s", rec.Code, rec.Body.String())
	}

	req = authenticatedRequest(http.MethodDelete, "/api/projects/"+projectID, "", rawSession, true)
	rec = httptest.NewRecorder()
	server.Handler().ServeHTTP(rec, req)
	if rec.Code != http.StatusForbidden {
		t.Fatalf("editor delete expected 403, got %d", rec.Code)
	}

	store.mu.Lock()
	store.roles[roleKey(ws.ID, "usr-remote")] = auth.RoleOwner
	store.mu.Unlock()

	req = authenticatedRequest(http.MethodDelete, "/api/projects/"+projectID, "", rawSession, true)
	rec = httptest.NewRecorder()
	server.Handler().ServeHTTP(rec, req)
	if rec.Code != http.StatusNoContent {
		t.Fatalf("owner delete expected 204, got %d: %s", rec.Code, rec.Body.String())
	}

	req = authenticatedRequest(http.MethodGet, "/api/capabilities", "", rawSession, false)
	rec = httptest.NewRecorder()
	server.Handler().ServeHTTP(rec, req)
	if !strings.Contains(rec.Body.String(), `"remoteProjectWrites":true`) ||
		!strings.Contains(rec.Body.String(), `"collaboration":false`) {
		t.Fatalf("unexpected capabilities: %s", rec.Body.String())
	}
}

type sequenceLimiter struct {
	mu        sync.Mutex
	remaining int
}

func (l *sequenceLimiter) AllowWrite(context.Context, string, time.Time, int, time.Duration) (bool, error) {
	l.mu.Lock()
	defer l.mu.Unlock()
	if l.remaining <= 0 {
		return false, nil
	}
	l.remaining--
	return true, nil
}

func TestRemoteWritesRateLimitAndVersionConflict(t *testing.T) {
	server, rawSession, store := newRemoteServer(t)

	ws, err := store.CreateWorkspace(context.Background(), workspaces.CreateInput{
		ID: "ws-test", Name: "Test", UserID: "usr-remote", CreatedBy: "sub-remote",
	})
	if err != nil {
		t.Fatal(err)
	}
	snapshot := `{"_schemaVersion":"3.50.0","projName":"Remote","devices":[],"hosts":[]}`
	p, _, err := store.CreateProject(context.Background(), projects.CreateInput{
		ID: "prj-test", WorkspaceID: ws.ID, Name: "Project", Snapshot: json.RawMessage(snapshot), CreatedBy: "sub-remote",
	})
	if err != nil {
		t.Fatal(err)
	}

	req := authenticatedRequest(http.MethodPut, "/api/projects/"+p.ID,
		fmt.Sprintf(`{"expectedVersion":99,"snapshot":%s}`, snapshot), rawSession, true)
	rec := httptest.NewRecorder()
	server.Handler().ServeHTTP(rec, req)
	if rec.Code != http.StatusConflict {
		t.Fatalf("version conflict expected 409, got %d: %s", rec.Code, rec.Body.String())
	}

	server.writeLimit = &sequenceLimiter{remaining: 1}
	req = authenticatedRequest(http.MethodPost, "/api/workspaces", `{"name":"First"}`, rawSession, true)
	rec = httptest.NewRecorder()
	server.Handler().ServeHTTP(rec, req)
	if rec.Code != http.StatusCreated {
		t.Fatalf("first write expected 201, got %d", rec.Code)
	}
	req = authenticatedRequest(http.MethodPost, "/api/workspaces", `{"name":"Second"}`, rawSession, true)
	rec = httptest.NewRecorder()
	server.Handler().ServeHTTP(rec, req)
	if rec.Code != http.StatusTooManyRequests || rec.Header().Get("Retry-After") == "" {
		t.Fatalf("second write expected 429 with Retry-After, got %d headers=%v", rec.Code, rec.Header())
	}
}
