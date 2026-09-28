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

type fakePrivateRoutingRunner struct {
	result privateservices.RoutingResult
	err    error
}

func (f fakePrivateRoutingRunner) Run(_ context.Context, request privateservices.RoutingRequest) (privateservices.RoutingResult, error) {
	if f.err != nil {
		return privateservices.RoutingResult{}, f.err
	}
	out := f.result
	out.DeviceID = request.DeviceID
	return out, nil
}

func TestPrivateRoutingUsesStoredRevisionAndAudits(t *testing.T) {
	server, rawSession, store := newRemoteServer(t)
	privateService, err := privateservices.New([]byte(strings.Repeat("r", 32)))
	if err != nil {
		t.Fatal(err)
	}
	privateService.SetRoutingRunner(fakePrivateRoutingRunner{result: privateservices.RoutingResult{
		ContractVersion: privateservices.PrivateRoutingContractVersion,
		PlanVersion: "netwizard-routing-plan-v1",
		GeneratorVersion: "netwizard-cisco-routing-generator-v1",
		Vendor: "cisco_ios",
		Output: "!\n! Routing generado desde plan neutral\nip route 10.20.20.0 255.255.255.0 172.16.0.2",
	}})
	ws, err := store.CreateWorkspace(context.Background(), workspaces.CreateInput{
		ID: "ws-routing", Name: "Routing", UserID: "usr-remote", CreatedBy: "sub-remote",
	})
	if err != nil {
		t.Fatal(err)
	}
	snapshot := json.RawMessage(`{"_schemaVersion":"3.50.0","projName":"Routing","devices":[{"id":"r1","type":"router","vendorOs":"cisco_ios"}],"hosts":[]}`)
	project, _, err := store.CreateProject(context.Background(), projects.CreateInput{
		ID: "prj-routing", WorkspaceID: ws.ID, Name: "Routing project", Snapshot: snapshot, CreatedBy: "sub-remote",
	})
	if err != nil {
		t.Fatal(err)
	}
	server = rebuildPrivateTestServer(t, server, store, privateService)

	req := authenticatedRequest(http.MethodPost, "/api/projects/"+project.ID+"/private/routing",
		`{"expectedVersion":1,"deviceId":"r1"}`, rawSession, true)
	rec := httptest.NewRecorder()
	server.Handler().ServeHTTP(rec, req)
	if rec.Code != http.StatusOK {
		t.Fatalf("private routing expected 200, got %d: %s", rec.Code, rec.Body.String())
	}
	var result privateservices.RoutingResult
	if err := json.Unmarshal(rec.Body.Bytes(), &result); err != nil {
		t.Fatal(err)
	}
	if result.ContractVersion != privateservices.PrivateRoutingContractVersion ||
		result.DeviceID != "r1" || result.Vendor != "cisco_ios" || result.Output == "" {
		t.Fatalf("unexpected private routing result: %#v", result)
	}
	store.mu.Lock()
	defer store.mu.Unlock()
	found := false
	for _, action := range store.auditActions {
		if action == "private.routing.generate" {
			found = true
			break
		}
	}
	if !found {
		t.Fatalf("expected private.routing.generate audit, got %#v", store.auditActions)
	}
}

func TestPrivateRoutingRejectsViewerAndStaleVersion(t *testing.T) {
	server, rawSession, store := newRemoteServer(t)
	privateService, err := privateservices.New([]byte(strings.Repeat("s", 32)))
	if err != nil {
		t.Fatal(err)
	}
	privateService.SetRoutingRunner(fakePrivateRoutingRunner{result: privateservices.RoutingResult{
		ContractVersion: privateservices.PrivateRoutingContractVersion,
		PlanVersion: "netwizard-routing-plan-v1",
		GeneratorVersion: "netwizard-cisco-routing-generator-v1",
		Vendor: "cisco_ios",
	}})
	ws, err := store.CreateWorkspace(context.Background(), workspaces.CreateInput{
		ID: "ws-routing-guards", Name: "Routing", UserID: "usr-remote", CreatedBy: "sub-remote",
	})
	if err != nil {
		t.Fatal(err)
	}
	project, _, err := store.CreateProject(context.Background(), projects.CreateInput{
		ID: "prj-routing-guards", WorkspaceID: ws.ID, Name: "Routing project",
		Snapshot: json.RawMessage(`{"_schemaVersion":"3.50.0","projName":"Routing","devices":[{"id":"r1","type":"router","vendorOs":"cisco_ios"}],"hosts":[]}`),
		CreatedBy: "sub-remote",
	})
	if err != nil {
		t.Fatal(err)
	}
	server = rebuildPrivateTestServer(t, server, store, privateService)

	store.mu.Lock()
	store.roles[roleKey(ws.ID, "usr-remote")] = auth.RoleViewer
	store.mu.Unlock()
	req := authenticatedRequest(http.MethodPost, "/api/projects/"+project.ID+"/private/routing",
		`{"expectedVersion":1,"deviceId":"r1"}`, rawSession, true)
	rec := httptest.NewRecorder()
	server.Handler().ServeHTTP(rec, req)
	if rec.Code != http.StatusForbidden {
		t.Fatalf("viewer private routing expected 403, got %d", rec.Code)
	}

	store.mu.Lock()
	store.roles[roleKey(ws.ID, "usr-remote")] = auth.RoleEditor
	store.mu.Unlock()
	req = authenticatedRequest(http.MethodPost, "/api/projects/"+project.ID+"/private/routing",
		`{"expectedVersion":2,"deviceId":"r1"}`, rawSession, true)
	rec = httptest.NewRecorder()
	server.Handler().ServeHTTP(rec, req)
	if rec.Code != http.StatusConflict {
		t.Fatalf("stale private routing expected 409, got %d: %s", rec.Code, rec.Body.String())
	}
}


type fakePrivateDeploymentRunner struct {
	result  privateservices.DeploymentPlanResult
	err     error
	project json.RawMessage
}

func (f *fakePrivateDeploymentRunner) Run(_ context.Context, request privateservices.DeploymentPlanRequest) (privateservices.DeploymentPlanResult, error) {
	f.project = append(json.RawMessage(nil), request.Project...)
	if f.err != nil {
		return privateservices.DeploymentPlanResult{}, f.err
	}
	return f.result, nil
}

func TestPrivateDeploymentPlanUsesStoredRevisionAndAudits(t *testing.T) {
	server, rawSession, store := newRemoteServer(t)
	privateService, err := privateservices.New([]byte(strings.Repeat("d", 32)))
	if err != nil {
		t.Fatal(err)
	}
	runner := &fakePrivateDeploymentRunner{result: privateservices.DeploymentPlanResult{
		ContractVersion: privateservices.PrivateDeploymentContractVersion,
		GeneratedAt: "2026-09-28T11:00:00Z",
		OK: true,
		ProjectName: "Deployment",
		ChangeSet: json.RawMessage(`{"format":"netwizard-change-set"}`),
		IncrementalPlan: json.RawMessage(`{"format":"netwizard-incremental-plan"}`),
		DeploymentPlan: json.RawMessage(`{"format":"netwizard-deployment-plan"}`),
		Issues: json.RawMessage(`[]`),
	}}
	privateService.SetDeploymentRunner(runner)

	ws, err := store.CreateWorkspace(context.Background(), workspaces.CreateInput{
		ID: "ws-deployment", Name: "Deployment", UserID: "usr-remote", CreatedBy: "sub-remote",
	})
	if err != nil {
		t.Fatal(err)
	}
	snapshot := json.RawMessage(`{"_schemaVersion":"3.50.0","projName":"Deployment","devices":[{"id":"r1","type":"router","vendorOs":"juniper_junos"}],"hosts":[]}`)
	project, _, err := store.CreateProject(context.Background(), projects.CreateInput{
		ID: "prj-deployment", WorkspaceID: ws.ID, Name: "Deployment project", Snapshot: snapshot, CreatedBy: "sub-remote",
	})
	if err != nil {
		t.Fatal(err)
	}
	server = rebuildPrivateTestServer(t, server, store, privateService)

	body := `{"expectedVersion":1,"desiredConfigs":{"r1":"set system host-name EDGE"},"configPaths":{"r1":"configs/r1.set"}}`
	req := authenticatedRequest(http.MethodPost, "/api/projects/"+project.ID+"/private/deployment-plan", body, rawSession, true)
	rec := httptest.NewRecorder()
	server.Handler().ServeHTTP(rec, req)
	if rec.Code != http.StatusOK {
		t.Fatalf("private deployment expected 200, got %d: %s", rec.Code, rec.Body.String())
	}
	var result privateservices.DeploymentPlanResult
	if err := json.Unmarshal(rec.Body.Bytes(), &result); err != nil {
		t.Fatal(err)
	}
	if result.ContractVersion != privateservices.PrivateDeploymentContractVersion || !result.OK {
		t.Fatalf("unexpected private deployment result: %#v", result)
	}
	if string(runner.project) != string(snapshot) {
		t.Fatalf("worker must receive stored revision, got %s", string(runner.project))
	}

	store.mu.Lock()
	defer store.mu.Unlock()
	found := false
	for _, action := range store.auditActions {
		if action == "private.deployment_plan.generate" {
			found = true
			break
		}
	}
	if !found {
		t.Fatalf("expected private.deployment_plan.generate audit, got %#v", store.auditActions)
	}
}

func TestPrivateDeploymentPlanRejectsViewerAndStaleVersion(t *testing.T) {
	server, rawSession, store := newRemoteServer(t)
	privateService, err := privateservices.New([]byte(strings.Repeat("e", 32)))
	if err != nil {
		t.Fatal(err)
	}
	privateService.SetDeploymentRunner(&fakePrivateDeploymentRunner{result: privateservices.DeploymentPlanResult{
		ContractVersion: privateservices.PrivateDeploymentContractVersion,
		GeneratedAt: "2026-09-28T11:00:00Z",
		OK: true,
		ChangeSet: json.RawMessage(`{}`), IncrementalPlan: json.RawMessage(`{}`),
		DeploymentPlan: json.RawMessage(`{}`), Issues: json.RawMessage(`[]`),
	}})
	ws, err := store.CreateWorkspace(context.Background(), workspaces.CreateInput{
		ID: "ws-deployment-guards", Name: "Deployment", UserID: "usr-remote", CreatedBy: "sub-remote",
	})
	if err != nil {
		t.Fatal(err)
	}
	project, _, err := store.CreateProject(context.Background(), projects.CreateInput{
		ID: "prj-deployment-guards", WorkspaceID: ws.ID, Name: "Deployment project",
		Snapshot: json.RawMessage(`{"_schemaVersion":"3.50.0","projName":"Deployment","devices":[{"id":"r1","type":"router","vendorOs":"juniper_junos"}],"hosts":[]}`),
		CreatedBy: "sub-remote",
	})
	if err != nil {
		t.Fatal(err)
	}
	server = rebuildPrivateTestServer(t, server, store, privateService)

	store.mu.Lock()
	store.roles[roleKey(ws.ID, "usr-remote")] = auth.RoleViewer
	store.mu.Unlock()
	body := `{"expectedVersion":1,"desiredConfigs":{"r1":"set system host-name EDGE"},"configPaths":{}}`
	req := authenticatedRequest(http.MethodPost, "/api/projects/"+project.ID+"/private/deployment-plan", body, rawSession, true)
	rec := httptest.NewRecorder()
	server.Handler().ServeHTTP(rec, req)
	if rec.Code != http.StatusForbidden {
		t.Fatalf("viewer private deployment expected 403, got %d", rec.Code)
	}

	store.mu.Lock()
	store.roles[roleKey(ws.ID, "usr-remote")] = auth.RoleEditor
	store.mu.Unlock()
	stale := strings.Replace(body, `"expectedVersion":1`, `"expectedVersion":2`, 1)
	req = authenticatedRequest(http.MethodPost, "/api/projects/"+project.ID+"/private/deployment-plan", stale, rawSession, true)
	rec = httptest.NewRecorder()
	server.Handler().ServeHTTP(rec, req)
	if rec.Code != http.StatusConflict {
		t.Fatalf("stale private deployment expected 409, got %d: %s", rec.Code, rec.Body.String())
	}
}
