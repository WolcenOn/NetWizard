package httpapi

import (
	"context"
	"encoding/hex"
	"errors"
	"net/http"
	"strings"
	"time"

	"github.com/WolcenOn/NetWizard/backend/internal/auth"
	"github.com/WolcenOn/NetWizard/backend/internal/privateservices"
)

const maxPrivateArtifactBytes = 128 * 1024 * 1024

type privateAuditStore interface {
	RecordProjectAudit(ctx context.Context, workspaceID, projectID, actor, action string, metadata map[string]any) error
}

func (s *Server) privateServicesReady() bool {
	if s == nil || s.privateServices == nil || !s.remoteWritesReady() {
		return false
	}
	_, ok := s.projects.(privateAuditStore)
	return ok
}

func (s *Server) privateRoutingReady() bool {
	return s.privateServicesReady() && s.privateServices.RoutingConfigured()
}

func (s *Server) privateServiceRoutes() {
	require := s.auth.Sessions.Require
	s.mux.Handle("POST /api/projects/{projectID}/private/deployment-attestations",
		require(s.requireMutation(http.HandlerFunc(s.handleCreateDeploymentAttestation))))
	if s.privateRoutingReady() {
		s.mux.Handle("POST /api/projects/{projectID}/private/routing",
			require(s.requireMutation(http.HandlerFunc(s.handlePrivateRouting))))
	}
}

func (s *Server) handleCreateDeploymentAttestation(w http.ResponseWriter, r *http.Request) {
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
		ExpectedVersion int64  `json:"expectedVersion"`
		ArtifactSHA256  string `json:"artifactSha256"`
		ArtifactBytes   int64  `json:"artifactBytes"`
	}
	if err := decodeJSON(w, r, &body, 8*1024); err != nil {
		writeDecodeError(w, err)
		return
	}
	body.ArtifactSHA256 = strings.ToLower(strings.TrimSpace(body.ArtifactSHA256))
	if body.ExpectedVersion < 1 || body.ArtifactBytes < 1 || body.ArtifactBytes > maxPrivateArtifactBytes || !isSHA256Hex(body.ArtifactSHA256) {
		http.Error(w, "invalid attestation request", http.StatusBadRequest)
		return
	}

	project, revision, err := s.projects.GetProject(r.Context(), projectID)
	if err != nil {
		s.writeProjectError(w, "load project for private attestation", err)
		return
	}
	if project.CurrentVersion != body.ExpectedVersion {
		writeJSON(w, http.StatusConflict, map[string]any{
			"error": "project_version_conflict",
			"currentVersion": project.CurrentVersion,
		})
		return
	}

	attestation, err := s.privateServices.Attest(privateservices.AttestationInput{
		ProjectID:       project.ID,
		ProjectVersion:  project.CurrentVersion,
		ProjectChecksum: revision.Checksum,
		ArtifactSHA256:  body.ArtifactSHA256,
		ArtifactBytes:   body.ArtifactBytes,
		Subject:         principal.Subject,
		IssuedAt:        time.Now().UTC(),
	})
	if err != nil {
		s.internalError(w, "create private deployment attestation", err)
		return
	}

	audit, ok := s.projects.(privateAuditStore)
	if !ok {
		s.internalError(w, "audit private deployment attestation", privateservices.ErrInvalidInput)
		return
	}
	if err := audit.RecordProjectAudit(r.Context(), project.WorkspaceID, project.ID, principal.Subject,
		"private.deployment_attestation.create", map[string]any{
			"contractVersion": attestation.ContractVersion,
			"projectVersion":  project.CurrentVersion,
			"artifactSha256":  body.ArtifactSHA256,
			"artifactBytes":   body.ArtifactBytes,
		}); err != nil {
		s.internalError(w, "audit private deployment attestation", err)
		return
	}

	noStore(w)
	writeJSON(w, http.StatusCreated, attestation)
}

func isSHA256Hex(value string) bool {
	if len(value) != 64 {
		return false
	}
	decoded, err := hex.DecodeString(value)
	return err == nil && len(decoded) == 32
}


func (s *Server) handlePrivateRouting(w http.ResponseWriter, r *http.Request) {
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
		ExpectedVersion int64  `json:"expectedVersion"`
		DeviceID        string `json:"deviceId"`
	}
	if err := decodeJSON(w, r, &body, 8*1024); err != nil {
		writeDecodeError(w, err)
		return
	}
	body.DeviceID = strings.TrimSpace(body.DeviceID)
	if body.ExpectedVersion < 1 || body.DeviceID == "" || len(body.DeviceID) > 256 {
		http.Error(w, "invalid private routing request", http.StatusBadRequest)
		return
	}

	project, revision, err := s.projects.GetProject(r.Context(), projectID)
	if err != nil {
		s.writeProjectError(w, "load project for private routing", err)
		return
	}
	if project.CurrentVersion != body.ExpectedVersion {
		writeJSON(w, http.StatusConflict, map[string]any{
			"error": "project_version_conflict",
			"currentVersion": project.CurrentVersion,
		})
		return
	}

	result, err := s.privateServices.GenerateRouting(r.Context(), revision.Snapshot, body.DeviceID)
	if err != nil {
		if errors.Is(err, privateservices.ErrPrivateRoutingInvalid) {
			http.Error(w, "private routing request rejected", http.StatusBadRequest)
			return
		}
		s.internalError(w, "generate private routing", err)
		return
	}

	audit, ok := s.projects.(privateAuditStore)
	if !ok {
		s.internalError(w, "audit private routing", privateservices.ErrPrivateRoutingUnavailable)
		return
	}
	if err := audit.RecordProjectAudit(r.Context(), project.WorkspaceID, project.ID, principal.Subject,
		"private.routing.generate", map[string]any{
			"contractVersion": result.ContractVersion,
			"projectVersion": project.CurrentVersion,
			"deviceId": result.DeviceID,
			"vendor": result.Vendor,
			"generatorVersion": result.GeneratorVersion,
		}); err != nil {
		s.internalError(w, "audit private routing", err)
		return
	}

	noStore(w)
	writeJSON(w, http.StatusOK, result)
}
