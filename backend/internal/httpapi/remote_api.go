package httpapi

import (
	"crypto/rand"
	"crypto/subtle"
	"encoding/base64"
	"encoding/json"
	"errors"
	"io"
	"net/http"
	"strings"
	"time"

	"github.com/WolcenOn/NetWizard/backend/internal/auth"
	"github.com/WolcenOn/NetWizard/backend/internal/projects"
	"github.com/WolcenOn/NetWizard/backend/internal/workspaces"
)

const (
	maxWorkspaceNameBytes = 120
	maxProjectNameBytes   = 200
)

func (s *Server) remoteWritesReady() bool {
	return s != nil && s.auth != nil && s.auth.Sessions != nil &&
		s.projects != nil && s.workspaces != nil && s.authorizer.Store != nil && s.writeLimit != nil
}

func (s *Server) remoteRoutes() {
	require := s.auth.Sessions.Require

	s.mux.Handle("GET /api/workspaces", require(http.HandlerFunc(s.handleListWorkspaces)))
	s.mux.Handle("POST /api/workspaces", require(s.requireMutation(http.HandlerFunc(s.handleCreateWorkspace))))

	s.mux.Handle("GET /api/workspaces/{workspaceID}/projects", require(http.HandlerFunc(s.handleListWorkspaceProjects)))
	s.mux.Handle("POST /api/workspaces/{workspaceID}/projects", require(s.requireMutation(http.HandlerFunc(s.handleCreateProject))))

	s.mux.Handle("GET /api/projects/{projectID}", require(http.HandlerFunc(s.handleGetProject)))
	s.mux.Handle("PUT /api/projects/{projectID}", require(s.requireMutation(http.HandlerFunc(s.handleSaveProject))))
	s.mux.Handle("DELETE /api/projects/{projectID}", require(s.requireMutation(http.HandlerFunc(s.handleDeleteProject))))
	if s.collaborationReady() {
		s.collaborationRoutes()
	}
}

func (s *Server) requireCSRF(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		principal, ok := auth.PrincipalFromContext(r.Context())
		if !ok || strings.TrimSpace(principal.UserID) == "" {
			http.Error(w, "unauthorized", http.StatusUnauthorized)
			return
		}
		provided := strings.TrimSpace(r.Header.Get("X-NetWizard-CSRF"))
		expected := principal.CSRFToken
		if provided == "" || expected == "" || len(provided) != len(expected) ||
			subtle.ConstantTimeCompare([]byte(provided), []byte(expected)) != 1 {
			http.Error(w, "csrf check failed", http.StatusForbidden)
			return
		}
		next.ServeHTTP(w, r)
	})
}

func (s *Server) requireMutation(next http.Handler) http.Handler {
	return s.requireCSRF(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		principal, _ := auth.PrincipalFromContext(r.Context())
		if s.writeLimit == nil {
			s.internalError(w, "write rate limit", errors.New("write limiter unavailable"))
			return
		}
		allowed, err := s.writeLimit.AllowWrite(r.Context(), principal.UserID, time.Now().UTC(), 60, time.Minute)
		if err != nil {
			s.internalError(w, "write rate limit", err)
			return
		}
		if !allowed {
			w.Header().Set("Retry-After", "60")
			http.Error(w, "rate limit exceeded", http.StatusTooManyRequests)
			return
		}
		next.ServeHTTP(w, r)
	}))
}

func (s *Server) handleListWorkspaces(w http.ResponseWriter, r *http.Request) {
	principal, ok := auth.PrincipalFromContext(r.Context())
	if !ok {
		http.Error(w, "unauthorized", http.StatusUnauthorized)
		return
	}
	items, err := s.workspaces.ListUserWorkspaces(r.Context(), principal.UserID)
	if err != nil {
		s.internalError(w, "list workspaces", err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"workspaces": items})
}

func (s *Server) handleCreateWorkspace(w http.ResponseWriter, r *http.Request) {
	principal, ok := auth.PrincipalFromContext(r.Context())
	if !ok {
		http.Error(w, "unauthorized", http.StatusUnauthorized)
		return
	}
	var body struct {
		Name string `json:"name"`
	}
	if err := decodeJSON(w, r, &body, 16*1024); err != nil {
		writeDecodeError(w, err)
		return
	}
	body.Name = workspaces.NormalizeName(body.Name)
	if body.Name == "" || len(body.Name) > maxWorkspaceNameBytes {
		http.Error(w, "invalid workspace name", http.StatusBadRequest)
		return
	}
	id, err := newResourceID("ws")
	if err != nil {
		s.internalError(w, "workspace id", err)
		return
	}
	ws, err := s.workspaces.CreateWorkspace(r.Context(), workspaces.CreateInput{
		ID: id, Name: body.Name, UserID: principal.UserID, CreatedBy: principal.Subject,
	})
	if err != nil {
		s.internalError(w, "create workspace", err)
		return
	}
	writeJSON(w, http.StatusCreated, ws)
}

func (s *Server) handleListWorkspaceProjects(w http.ResponseWriter, r *http.Request) {
	principal, ok := auth.PrincipalFromContext(r.Context())
	if !ok {
		http.Error(w, "unauthorized", http.StatusUnauthorized)
		return
	}
	workspaceID := strings.TrimSpace(r.PathValue("workspaceID"))
	if err := s.authorizer.RequireWorkspaceRole(r.Context(), principal, workspaceID, auth.RoleViewer); err != nil {
		writeAuthzError(w, err)
		return
	}
	items, err := s.projects.ListWorkspaceProjects(r.Context(), workspaceID)
	if err != nil {
		s.internalError(w, "list workspace projects", err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"projects": items})
}

func (s *Server) handleCreateProject(w http.ResponseWriter, r *http.Request) {
	principal, ok := auth.PrincipalFromContext(r.Context())
	if !ok {
		http.Error(w, "unauthorized", http.StatusUnauthorized)
		return
	}
	workspaceID := strings.TrimSpace(r.PathValue("workspaceID"))
	if err := s.authorizer.RequireWorkspaceRole(r.Context(), principal, workspaceID, auth.RoleEditor); err != nil {
		writeAuthzError(w, err)
		return
	}
	var body struct {
		Name     string          `json:"name"`
		Snapshot json.RawMessage `json:"snapshot"`
	}
	if err := decodeJSON(w, r, &body, s.cfg.MaxProjectBytes+128*1024); err != nil {
		writeDecodeError(w, err)
		return
	}
	body.Name = strings.TrimSpace(body.Name)
	if body.Name == "" || len(body.Name) > maxProjectNameBytes {
		http.Error(w, "invalid project name", http.StatusBadRequest)
		return
	}
	if _, err := projects.ValidateSnapshot(body.Snapshot, s.cfg.MaxProjectBytes); err != nil {
		writeSnapshotValidationError(w, err)
		return
	}
	id, err := newResourceID("prj")
	if err != nil {
		s.internalError(w, "project id", err)
		return
	}
	project, revision, err := s.projects.CreateProject(r.Context(), projects.CreateInput{
		ID: id, WorkspaceID: workspaceID, Name: body.Name,
		Snapshot: body.Snapshot, CreatedBy: principal.Subject,
	})
	if err != nil {
		s.writeProjectError(w, "create project", err)
		return
	}
	w.Header().Set("ETag", projectETag(project, revision))
	writeJSON(w, http.StatusCreated, map[string]any{"project": project, "revision": revision})
}

func (s *Server) handleGetProject(w http.ResponseWriter, r *http.Request) {
	principal, ok := auth.PrincipalFromContext(r.Context())
	if !ok {
		http.Error(w, "unauthorized", http.StatusUnauthorized)
		return
	}
	projectID := strings.TrimSpace(r.PathValue("projectID"))
	if err := s.authorizer.RequireProjectRole(r.Context(), principal, projectID, auth.RoleViewer); err != nil {
		writeAuthzError(w, err)
		return
	}
	project, revision, err := s.projects.GetProject(r.Context(), projectID)
	if err != nil {
		s.writeProjectError(w, "get project", err)
		return
	}
	etag := projectETag(project, revision)
	w.Header().Set("ETag", etag)
	if strings.TrimSpace(r.Header.Get("If-None-Match")) == etag {
		w.WriteHeader(http.StatusNotModified)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"project": project, "revision": revision})
}

func (s *Server) handleSaveProject(w http.ResponseWriter, r *http.Request) {
	principal, ok := auth.PrincipalFromContext(r.Context())
	if !ok {
		http.Error(w, "unauthorized", http.StatusUnauthorized)
		return
	}
	projectID := strings.TrimSpace(r.PathValue("projectID"))
	if err := s.authorizer.RequireProjectRole(r.Context(), principal, projectID, auth.RoleEditor); err != nil {
		writeAuthzError(w, err)
		return
	}
	var body struct {
		ExpectedVersion int64           `json:"expectedVersion"`
		Snapshot        json.RawMessage `json:"snapshot"`
	}
	if err := decodeJSON(w, r, &body, s.cfg.MaxProjectBytes+128*1024); err != nil {
		writeDecodeError(w, err)
		return
	}
	if body.ExpectedVersion < 1 {
		http.Error(w, "expectedVersion must be positive", http.StatusBadRequest)
		return
	}
	ifMatch := strings.TrimSpace(r.Header.Get("If-Match"))
	if ifMatch != "" {
		current, currentRevision, err := s.projects.GetProject(r.Context(), projectID)
		if err != nil {
			s.writeProjectError(w, "get project for If-Match", err)
			return
		}
		if ifMatch != projectETag(current, currentRevision) {
			http.Error(w, "project etag conflict", http.StatusPreconditionFailed)
			return
		}
	}
	if _, err := projects.ValidateSnapshot(body.Snapshot, s.cfg.MaxProjectBytes); err != nil {
		writeSnapshotValidationError(w, err)
		return
	}
	project, revision, err := s.projects.SaveRevision(r.Context(), projects.SaveRevisionInput{
		ProjectID: projectID, ExpectedVersion: body.ExpectedVersion,
		Snapshot: body.Snapshot, CreatedBy: principal.Subject,
	})
	if err != nil {
		s.writeProjectError(w, "save project", err)
		return
	}
	w.Header().Set("ETag", projectETag(project, revision))
	writeJSON(w, http.StatusOK, map[string]any{"project": project, "revision": revision})
}

func (s *Server) handleDeleteProject(w http.ResponseWriter, r *http.Request) {
	principal, ok := auth.PrincipalFromContext(r.Context())
	if !ok {
		http.Error(w, "unauthorized", http.StatusUnauthorized)
		return
	}
	projectID := strings.TrimSpace(r.PathValue("projectID"))
	if err := s.authorizer.RequireProjectRole(r.Context(), principal, projectID, auth.RoleOwner); err != nil {
		writeAuthzError(w, err)
		return
	}
	if err := s.projects.DeleteProject(r.Context(), projectID, principal.Subject); err != nil {
		s.writeProjectError(w, "delete project", err)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

func newResourceID(prefix string) (string, error) {
	raw := make([]byte, 18)
	if _, err := rand.Read(raw); err != nil {
		return "", err
	}
	return prefix + "_" + base64.RawURLEncoding.EncodeToString(raw), nil
}

func decodeJSON(w http.ResponseWriter, r *http.Request, dst any, maxBytes int64) error {
	if maxBytes <= 0 {
		maxBytes = 1024 * 1024
	}
	r.Body = http.MaxBytesReader(w, r.Body, maxBytes)
	dec := json.NewDecoder(r.Body)
	dec.DisallowUnknownFields()
	if err := dec.Decode(dst); err != nil {
		return err
	}
	var extra any
	if err := dec.Decode(&extra); !errors.Is(err, io.EOF) {
		if err == nil {
			return errors.New("request body must contain one JSON value")
		}
		return err
	}
	return nil
}

func writeDecodeError(w http.ResponseWriter, err error) {
	var tooLarge *http.MaxBytesError
	if errors.As(err, &tooLarge) {
		http.Error(w, "request body too large", http.StatusRequestEntityTooLarge)
		return
	}
	http.Error(w, "invalid JSON request", http.StatusBadRequest)
}

func writeAuthzError(w http.ResponseWriter, err error) {
	if errors.Is(err, auth.ErrUnauthenticated) {
		http.Error(w, "unauthorized", http.StatusUnauthorized)
		return
	}
	http.Error(w, "forbidden", http.StatusForbidden)
}

func writeSnapshotValidationError(w http.ResponseWriter, err error) {
	if strings.Contains(err.Error(), "maximum size") {
		http.Error(w, "project snapshot too large", http.StatusRequestEntityTooLarge)
		return
	}
	http.Error(w, "invalid project snapshot", http.StatusBadRequest)
}

func (s *Server) writeProjectError(w http.ResponseWriter, operation string, err error) {
	switch {
	case errors.Is(err, projects.ErrNotFound):
		http.Error(w, "project not found", http.StatusNotFound)
	case errors.Is(err, projects.ErrVersionConflict):
		http.Error(w, "project version conflict", http.StatusConflict)
	default:
		s.internalError(w, operation, err)
	}
}

func (s *Server) internalError(w http.ResponseWriter, operation string, err error) {
	s.log.Error("request failed", "operation", operation, "error", err)
	http.Error(w, "internal server error", http.StatusInternalServerError)
}
