package projects

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"strings"
	"time"
)

const SupportedSchemaVersion = "3.50.0"

var (
	ErrNotFound        = errors.New("project not found")
	ErrVersionConflict = errors.New("project version conflict")
)

type Project struct {
	ID             string    `json:"id"`
	WorkspaceID    string    `json:"workspaceId"`
	Name           string    `json:"name"`
	SchemaVersion  string    `json:"schemaVersion"`
	CurrentVersion int64     `json:"currentVersion"`
	CreatedBy      string    `json:"createdBy"`
	CreatedAt      time.Time `json:"createdAt"`
	UpdatedAt      time.Time `json:"updatedAt"`
}

type Revision struct {
	ProjectID     string          `json:"projectId"`
	Version       int64           `json:"version"`
	SchemaVersion string          `json:"schemaVersion"`
	Snapshot      json.RawMessage `json:"snapshot"`
	Checksum      string          `json:"checksum"`
	CreatedBy     string          `json:"createdBy"`
	CreatedAt     time.Time       `json:"createdAt"`
}

type CreateInput struct {
	ID            string
	WorkspaceID   string
	Name          string
	SchemaVersion string
	Snapshot      json.RawMessage
	CreatedBy     string
}

type SaveRevisionInput struct {
	ProjectID       string
	ExpectedVersion int64
	SchemaVersion   string
	Snapshot        json.RawMessage
	CreatedBy       string
}

type Store interface {
	CreateProject(ctx context.Context, input CreateInput) (Project, Revision, error)
	GetProject(ctx context.Context, projectID string) (Project, Revision, error)
	ListWorkspaceProjects(ctx context.Context, workspaceID string) ([]Project, error)
	ListRevisions(ctx context.Context, projectID string, limit int) ([]Revision, error)
	SaveRevision(ctx context.Context, input SaveRevisionInput) (Project, Revision, error)
}

func ValidateSnapshot(raw json.RawMessage, maxBytes int64) (string, error) {
	if len(raw) == 0 {
		return "", errors.New("snapshot is empty")
	}
	if maxBytes > 0 && int64(len(raw)) > maxBytes {
		return "", fmt.Errorf("snapshot exceeds maximum size of %d bytes", maxBytes)
	}
	var top map[string]json.RawMessage
	if err := json.Unmarshal(raw, &top); err != nil {
		return "", fmt.Errorf("snapshot must be valid JSON object: %w", err)
	}
	var version string
	for _, key := range []string{"_schemaVersion", "schemaVersion"} {
		if value, ok := top[key]; ok {
			_ = json.Unmarshal(value, &version)
			if strings.TrimSpace(version) != "" {
				break
			}
		}
	}
	if version == "" {
		return "", errors.New("snapshot schema version is required")
	}
	if version != SupportedSchemaVersion {
		return "", fmt.Errorf("unsupported schema version %q", version)
	}
	return version, nil
}

func SnapshotChecksum(raw json.RawMessage) string {
	sum := sha256.Sum256(raw)
	return hex.EncodeToString(sum[:])
}
