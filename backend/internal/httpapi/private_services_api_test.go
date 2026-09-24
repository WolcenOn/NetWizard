package httpapi

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/WolcenOn/NetWizard/backend/internal/auth"
	"github.com/WolcenOn/NetWizard/backend/internal/privateservices"
	"github.com/WolcenOn/NetWizard/backend/internal/projects"
	"github.com/WolcenOn/NetWizard/backend/internal/workspaces"
)

func TestPrivateDeploymentAttestationAuthorizationAndVersioning(t *testing.T) {
	server, rawSession, store := newRemoteServer(t)
	privateService, err := privateservices.New([]byte(strings.Repeat("p", 32)))
	if err != nil {
		t.Fatal(err)
	}
	server.privateServices = privateService

	ws, err := store.CreateWorkspace(context.Background(), workspaces.CreateInput{
		ID: "ws-private", Name: "Private", UserID: "usr-remote", CreatedBy: "sub-remote",
	})
	if err != nil {
		t.Fatal(err)
	}
	snapshot := json.RawMessage(`{"_schemaVersion":"3.50.0","projName":"Private","devices":[],"hosts":[]}`)
	project, _, err := store.CreateProject(context.Background(), projects.CreateInput{
		ID: "prj-private", WorkspaceID: ws.ID, Name: "Private project", Snapshot: snapshot, CreatedBy: "sub-remote",
	})
	if err != nil {
		t.Fatal(err)
	}

	// Routes are registered during server construction, so rebuild with the private service dependency.
	server = rebuildPrivateTestServer(t, server, store, privateService)

	body := `{"expectedVersion":1,"artifactSha256":"` + strings.Repeat("a", 64) + `","artifactBytes":4096}`

	store.mu.Lock()
	store.roles[roleKey(ws.ID, "usr-remote")] = auth.RoleViewer
	store.mu.Unlock()
	req := authenticatedRequest(http.MethodPost, "/api/projects/"+project.ID+"/private/deployment-attestations", body, rawSession, true)
	rec := httptest.NewRecorder()
	server.Handler().ServeHTTP(rec, req)
	if rec.Code != http.StatusForbidden {
		t.Fatalf("viewer expected 403, got %d: %s", rec.Code, rec.Body.String())
	}

	store.mu.Lock()
	store.roles[roleKey(ws.ID, "usr-remote")] = auth.RoleEditor
	store.mu.Unlock()
	stale := strings.Replace(body, `"expectedVersion":1`, `"expectedVersion":2`, 1)
	req = authenticatedRequest(http.MethodPost, "/api/projects/"+project.ID+"/private/deployment-attestations", stale, rawSession, true)
	rec = httptest.NewRecorder()
	server.Handler().ServeHTTP(rec, req)
	if rec.Code != http.StatusConflict || !strings.Contains(rec.Body.String(), `"currentVersion":1`) {
		t.Fatalf("stale version expected 409, got %d: %s", rec.Code, rec.Body.String())
	}

	req = authenticatedRequest(http.MethodPost, "/api/projects/"+project.ID+"/private/deployment-attestations", body, rawSession, true)
	rec = httptest.NewRecorder()
	server.Handler().ServeHTTP(rec, req)
	if rec.Code != http.StatusCreated {
		t.Fatalf("editor attestation expected 201, got %d: %s", rec.Code, rec.Body.String())
	}
	var att privateservices.Attestation
	if err := json.Unmarshal(rec.Body.Bytes(), &att); err != nil {
		t.Fatal(err)
	}
	if att.ContractVersion != privateservices.ContractVersion || att.ProjectVersion != 1 ||
		att.ProjectID != project.ID || att.ProjectChecksum == "" || att.Signature == "" {
		t.Fatalf("unexpected attestation: %#v", att)
	}
	if !privateService.Verify(att) {
		t.Fatal("returned attestation must verify")
	}

	store.mu.Lock()
	defer store.mu.Unlock()
	if len(store.auditActions) != 1 || store.auditActions[0] != "private.deployment_attestation.create" {
		t.Fatalf("expected private service audit event, got %#v", store.auditActions)
	}
}

func TestPrivateDeploymentAttestationRejectsInvalidDigest(t *testing.T) {
	server, rawSession, store := newRemoteServer(t)
	privateService, err := privateservices.New([]byte(strings.Repeat("q", 32)))
	if err != nil {
		t.Fatal(err)
	}
	ws, err := store.CreateWorkspace(context.Background(), workspaces.CreateInput{
		ID: "ws-private-invalid", Name: "Private", UserID: "usr-remote", CreatedBy: "sub-remote",
	})
	if err != nil {
		t.Fatal(err)
	}
	project, _, err := store.CreateProject(context.Background(), projects.CreateInput{
		ID: "prj-private-invalid", WorkspaceID: ws.ID, Name: "Private project",
		Snapshot: json.RawMessage(`{"_schemaVersion":"3.50.0","projName":"Private","devices":[],"hosts":[]}`),
		CreatedBy: "sub-remote",
	})
	if err != nil {
		t.Fatal(err)
	}
	server = rebuildPrivateTestServer(t, server, store, privateService)
	req := authenticatedRequest(http.MethodPost, "/api/projects/"+project.ID+"/private/deployment-attestations",
		`{"expectedVersion":1,"artifactSha256":"bad","artifactBytes":10}`, rawSession, true)
	rec := httptest.NewRecorder()
	server.Handler().ServeHTTP(rec, req)
	if rec.Code != http.StatusBadRequest {
		t.Fatalf("invalid digest expected 400, got %d: %s", rec.Code, rec.Body.String())
	}
}

func rebuildPrivateTestServer(t *testing.T, existing *Server, store *remoteStore, privateService *privateservices.Service) *Server {
	t.Helper()
	return NewServerWithDependencies(existing.cfg, existing.log, Dependencies{
		Projects: store,
		Workspaces: store,
		Access: store,
		Limits: store,
		Auth: existing.auth,
		PrivateServices: privateService,
	})
}
