package httpapi

import (
	"context"
	"io"
	"log/slog"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"strings"
	"testing"

	"github.com/WolcenOn/NetWizard/backend/internal/config"
	"github.com/WolcenOn/NetWizard/backend/internal/projects"
)

type projectStoreStub struct{}

func (projectStoreStub) CreateProject(context.Context, projects.CreateInput) (projects.Project, projects.Revision, error) {
	return projects.Project{}, projects.Revision{}, nil
}
func (projectStoreStub) GetProject(context.Context, string) (projects.Project, projects.Revision, error) {
	return projects.Project{}, projects.Revision{}, nil
}
func (projectStoreStub) ListWorkspaceProjects(context.Context, string) ([]projects.Project, error) {
	return nil, nil
}
func (projectStoreStub) ListRevisions(context.Context, string, int) ([]projects.Revision, error) {
	return nil, nil
}
func (projectStoreStub) SaveRevision(context.Context, projects.SaveRevisionInput) (projects.Project, projects.Revision, error) {
	return projects.Project{}, projects.Revision{}, nil
}
func (projectStoreStub) DeleteProject(context.Context, string, string) error { return nil }

func TestServerServesAPIAndStaticFrontend(t *testing.T) {
	dir := t.TempDir()
	if err := os.WriteFile(filepath.Join(dir, "index.html"), []byte("<!doctype html><title>NetWizard</title>"), 0o644); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(filepath.Join(dir, "app.js"), []byte("window.netwizard=true;"), 0o644); err != nil {
		t.Fatal(err)
	}

	logger := slog.New(slog.NewTextHandler(io.Discard, nil))
	server := NewServer(config.Config{Version: "test-version", StaticDir: dir}, logger)
	ts := httptest.NewServer(server.Handler())
	defer ts.Close()

	for _, path := range []string{"/", "/app.js", "/ruta-del-frontend"} {
		resp, err := http.Get(ts.URL + path)
		if err != nil {
			t.Fatal(err)
		}
		body, err := io.ReadAll(resp.Body)
		_ = resp.Body.Close()
		if err != nil {
			t.Fatal(err)
		}
		if resp.StatusCode != http.StatusOK {
			t.Fatalf("%s returned %d", path, resp.StatusCode)
		}
		if path == "/app.js" && !strings.Contains(string(body), "netwizard") {
			t.Fatalf("%s did not serve the requested asset", path)
		}
		if path != "/app.js" && !strings.Contains(string(body), "NetWizard") {
			t.Fatalf("%s did not fall back to index.html", path)
		}
	}

	resp, err := http.Get(ts.URL + "/api/health")
	if err != nil {
		t.Fatal(err)
	}
	body, err := io.ReadAll(resp.Body)
	_ = resp.Body.Close()
	if err != nil {
		t.Fatal(err)
	}
	if resp.StatusCode != http.StatusOK || !strings.Contains(string(body), "test-version") {
		t.Fatalf("health endpoint returned %d: %s", resp.StatusCode, string(body))
	}

	resp, err = http.Get(ts.URL + "/api/capabilities")
	if err != nil {
		t.Fatal(err)
	}
	body, err = io.ReadAll(resp.Body)
	_ = resp.Body.Close()
	if err != nil {
		t.Fatal(err)
	}
	if resp.StatusCode != http.StatusOK {
		t.Fatalf("capabilities endpoint returned %d: %s", resp.StatusCode, string(body))
	}
	for _, needle := range []string{
		"\"schemaVersion\":\"3.50.0\"",
		"\"remoteProjectWrites\":false",
		"\"collaboration\":false",
		"\"authEnforced\":false",
	} {
		if !strings.Contains(string(body), needle) {
			t.Fatalf("capabilities missing %s: %s", needle, string(body))
		}
	}

	resp, err = http.Get(ts.URL + "/api/missing")
	if err != nil {
		t.Fatal(err)
	}
	_ = resp.Body.Close()
	if resp.StatusCode != http.StatusNotFound {
		t.Fatalf("unknown API path should be 404, got %d", resp.StatusCode)
	}
}


func TestCapabilitiesReportReadyDatabaseOnlyWhenStoreInjected(t *testing.T) {
	logger := slog.New(slog.NewTextHandler(io.Discard, nil))
	server := NewServerWithDependencies(
		config.Config{Version: "test-version", DatabaseURL: "postgres://configured"},
		logger,
		Dependencies{Projects: projectStoreStub{}},
	)
	req := httptest.NewRequest(http.MethodGet, "/api/capabilities", nil)
	rec := httptest.NewRecorder()
	server.Handler().ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", rec.Code)
	}
	body := rec.Body.String()
	for _, needle := range []string{
		"\"databaseConfigured\":true",
		"\"databaseReady\":true",
		"\"remoteProjectWrites\":false",
	} {
		if !strings.Contains(body, needle) {
			t.Fatalf("capabilities missing %s: %s", needle, body)
		}
	}
}
