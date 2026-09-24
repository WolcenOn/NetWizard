package postgres

import (
	"context"
	"database/sql"
	"encoding/json"
	"errors"
	"fmt"
	"strings"
	"time"

	"github.com/WolcenOn/NetWizard/backend/internal/auth"
	"github.com/WolcenOn/NetWizard/backend/internal/projects"
	_ "github.com/jackc/pgx/v5/stdlib"
)

type Store struct {
	db              *sql.DB
	maxProjectBytes int64
}

func Open(ctx context.Context, databaseURL string, maxProjectBytes int64) (*Store, error) {
	if strings.TrimSpace(databaseURL) == "" {
		return nil, errors.New("postgres: DATABASE_URL is required")
	}
	db, err := sql.Open("pgx", databaseURL)
	if err != nil {
		return nil, fmt.Errorf("postgres: open: %w", err)
	}
	db.SetMaxOpenConns(12)
	db.SetMaxIdleConns(4)
	db.SetConnMaxIdleTime(5 * time.Minute)
	db.SetConnMaxLifetime(30 * time.Minute)

	if err := db.PingContext(ctx); err != nil {
		_ = db.Close()
		return nil, fmt.Errorf("postgres: ping: %w", err)
	}
	if err := Migrate(ctx, db); err != nil {
		_ = db.Close()
		return nil, err
	}
	return NewStore(db, maxProjectBytes), nil
}

func NewStore(db *sql.DB, maxProjectBytes int64) *Store {
	if maxProjectBytes <= 0 {
		maxProjectBytes = 10 * 1024 * 1024
	}
	return &Store{db: db, maxProjectBytes: maxProjectBytes}
}

func (s *Store) Close() error {
	if s == nil || s.db == nil {
		return nil
	}
	return s.db.Close()
}

func (s *Store) Ping(ctx context.Context) error {
	if s == nil || s.db == nil {
		return errors.New("postgres: store is not initialized")
	}
	return s.db.PingContext(ctx)
}

func (s *Store) CreateProject(ctx context.Context, input projects.CreateInput) (projects.Project, projects.Revision, error) {
	if s == nil || s.db == nil {
		return projects.Project{}, projects.Revision{}, errors.New("postgres: store is not initialized")
	}
	input.ID = strings.TrimSpace(input.ID)
	input.WorkspaceID = strings.TrimSpace(input.WorkspaceID)
	input.Name = strings.TrimSpace(input.Name)
	input.CreatedBy = strings.TrimSpace(input.CreatedBy)
	if input.ID == "" || input.WorkspaceID == "" || input.Name == "" || input.CreatedBy == "" {
		return projects.Project{}, projects.Revision{}, errors.New("postgres: project id, workspace, name and actor are required")
	}
	schemaVersion, err := projects.ValidateSnapshot(input.Snapshot, s.maxProjectBytes)
	if err != nil {
		return projects.Project{}, projects.Revision{}, err
	}
	if input.SchemaVersion != "" && input.SchemaVersion != schemaVersion {
		return projects.Project{}, projects.Revision{}, fmt.Errorf("postgres: input schema %q does not match snapshot schema %q", input.SchemaVersion, schemaVersion)
	}
	checksum := projects.SnapshotChecksum(input.Snapshot)

	tx, err := s.db.BeginTx(ctx, &sql.TxOptions{Isolation: sql.LevelSerializable})
	if err != nil {
		return projects.Project{}, projects.Revision{}, fmt.Errorf("postgres: begin create project: %w", err)
	}
	defer tx.Rollback()

	project := projects.Project{
		ID:             input.ID,
		WorkspaceID:    input.WorkspaceID,
		Name:           input.Name,
		SchemaVersion:  schemaVersion,
		CurrentVersion: 1,
		CreatedBy:      input.CreatedBy,
	}
	if err := tx.QueryRowContext(ctx, `
INSERT INTO projects(id, workspace_id, name, schema_version, current_version, created_by_subject)
VALUES ($1, $2, $3, $4, 1, $5)
RETURNING created_at, updated_at
`, project.ID, project.WorkspaceID, project.Name, project.SchemaVersion, project.CreatedBy).
		Scan(&project.CreatedAt, &project.UpdatedAt); err != nil {
		return projects.Project{}, projects.Revision{}, fmt.Errorf("postgres: insert project: %w", err)
	}

	revision := projects.Revision{
		ProjectID:     project.ID,
		Version:       1,
		SchemaVersion: schemaVersion,
		Snapshot:      append(json.RawMessage(nil), input.Snapshot...),
		Checksum:      checksum,
		CreatedBy:     input.CreatedBy,
	}
	if err := tx.QueryRowContext(ctx, `
INSERT INTO project_revisions(project_id, version, schema_version, snapshot, checksum, created_by_subject)
VALUES ($1, 1, $2, $3::jsonb, $4, $5)
RETURNING created_at
`, revision.ProjectID, revision.SchemaVersion, string(revision.Snapshot), revision.Checksum, revision.CreatedBy).
		Scan(&revision.CreatedAt); err != nil {
		return projects.Project{}, projects.Revision{}, fmt.Errorf("postgres: insert first revision: %w", err)
	}
	if err := writeAudit(ctx, tx, project.WorkspaceID, project.ID, input.CreatedBy, "project.create", project.ID, map[string]any{"version": 1}); err != nil {
		return projects.Project{}, projects.Revision{}, err
	}
	if err := tx.Commit(); err != nil {
		return projects.Project{}, projects.Revision{}, fmt.Errorf("postgres: commit create project: %w", err)
	}
	return project, revision, nil
}

func (s *Store) GetProject(ctx context.Context, projectID string) (projects.Project, projects.Revision, error) {
	var p projects.Project
	var r projects.Revision
	var snapshot []byte
	err := s.db.QueryRowContext(ctx, `
SELECT p.id, p.workspace_id, p.name, p.schema_version, p.current_version,
       p.created_by_subject, p.created_at, p.updated_at,
       r.project_id, r.version, r.schema_version, r.snapshot, r.checksum,
       r.created_by_subject, r.created_at
FROM projects p
JOIN project_revisions r ON r.project_id = p.id AND r.version = p.current_version
WHERE p.id = $1 AND p.deleted_at IS NULL
`, strings.TrimSpace(projectID)).Scan(
		&p.ID, &p.WorkspaceID, &p.Name, &p.SchemaVersion, &p.CurrentVersion,
		&p.CreatedBy, &p.CreatedAt, &p.UpdatedAt,
		&r.ProjectID, &r.Version, &r.SchemaVersion, &snapshot, &r.Checksum,
		&r.CreatedBy, &r.CreatedAt,
	)
	if errors.Is(err, sql.ErrNoRows) {
		return projects.Project{}, projects.Revision{}, projects.ErrNotFound
	}
	if err != nil {
		return projects.Project{}, projects.Revision{}, fmt.Errorf("postgres: get project: %w", err)
	}
	r.Snapshot = append(json.RawMessage(nil), snapshot...)
	return p, r, nil
}

func (s *Store) ListWorkspaceProjects(ctx context.Context, workspaceID string) ([]projects.Project, error) {
	rows, err := s.db.QueryContext(ctx, `
SELECT id, workspace_id, name, schema_version, current_version,
       created_by_subject, created_at, updated_at
FROM projects
WHERE workspace_id = $1 AND deleted_at IS NULL
ORDER BY updated_at DESC, id
`, strings.TrimSpace(workspaceID))
	if err != nil {
		return nil, fmt.Errorf("postgres: list projects: %w", err)
	}
	defer rows.Close()

	out := make([]projects.Project, 0)
	for rows.Next() {
		var p projects.Project
		if err := rows.Scan(&p.ID, &p.WorkspaceID, &p.Name, &p.SchemaVersion, &p.CurrentVersion, &p.CreatedBy, &p.CreatedAt, &p.UpdatedAt); err != nil {
			return nil, fmt.Errorf("postgres: scan project list: %w", err)
		}
		out = append(out, p)
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("postgres: iterate project list: %w", err)
	}
	return out, nil
}

func (s *Store) ListRevisions(ctx context.Context, projectID string, limit int) ([]projects.Revision, error) {
	if limit <= 0 || limit > 200 {
		limit = 50
	}
	rows, err := s.db.QueryContext(ctx, `
SELECT project_id, version, schema_version, snapshot, checksum, created_by_subject, created_at
FROM project_revisions
WHERE project_id = $1
ORDER BY version DESC
LIMIT $2
`, strings.TrimSpace(projectID), limit)
	if err != nil {
		return nil, fmt.Errorf("postgres: list revisions: %w", err)
	}
	defer rows.Close()

	out := make([]projects.Revision, 0)
	for rows.Next() {
		var r projects.Revision
		var snapshot []byte
		if err := rows.Scan(&r.ProjectID, &r.Version, &r.SchemaVersion, &snapshot, &r.Checksum, &r.CreatedBy, &r.CreatedAt); err != nil {
			return nil, fmt.Errorf("postgres: scan revision list: %w", err)
		}
		r.Snapshot = append(json.RawMessage(nil), snapshot...)
		out = append(out, r)
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("postgres: iterate revision list: %w", err)
	}
	if len(out) == 0 {
		var exists bool
		if err := s.db.QueryRowContext(ctx, "SELECT EXISTS (SELECT 1 FROM projects WHERE id = $1 AND deleted_at IS NULL)", strings.TrimSpace(projectID)).Scan(&exists); err != nil {
			return nil, fmt.Errorf("postgres: check project for revisions: %w", err)
		}
		if !exists {
			return nil, projects.ErrNotFound
		}
	}
	return out, nil
}

func (s *Store) SaveRevision(ctx context.Context, input projects.SaveRevisionInput) (projects.Project, projects.Revision, error) {
	input.ProjectID = strings.TrimSpace(input.ProjectID)
	input.CreatedBy = strings.TrimSpace(input.CreatedBy)
	if input.ProjectID == "" || input.CreatedBy == "" || input.ExpectedVersion < 1 {
		return projects.Project{}, projects.Revision{}, errors.New("postgres: project id, actor and expected version are required")
	}
	schemaVersion, err := projects.ValidateSnapshot(input.Snapshot, s.maxProjectBytes)
	if err != nil {
		return projects.Project{}, projects.Revision{}, err
	}
	if input.SchemaVersion != "" && input.SchemaVersion != schemaVersion {
		return projects.Project{}, projects.Revision{}, fmt.Errorf("postgres: input schema %q does not match snapshot schema %q", input.SchemaVersion, schemaVersion)
	}

	tx, err := s.db.BeginTx(ctx, &sql.TxOptions{Isolation: sql.LevelReadCommitted})
	if err != nil {
		return projects.Project{}, projects.Revision{}, fmt.Errorf("postgres: begin save revision: %w", err)
	}
	defer tx.Rollback()

	var p projects.Project
	err = tx.QueryRowContext(ctx, `
UPDATE projects
SET current_version = current_version + 1,
    schema_version = $3,
    updated_at = NOW()
WHERE id = $1 AND current_version = $2 AND deleted_at IS NULL
RETURNING id, workspace_id, name, schema_version, current_version,
          created_by_subject, created_at, updated_at
`, input.ProjectID, input.ExpectedVersion, schemaVersion).Scan(
		&p.ID, &p.WorkspaceID, &p.Name, &p.SchemaVersion, &p.CurrentVersion,
		&p.CreatedBy, &p.CreatedAt, &p.UpdatedAt,
	)
	if errors.Is(err, sql.ErrNoRows) {
		var current int64
		checkErr := tx.QueryRowContext(ctx, "SELECT current_version FROM projects WHERE id = $1 AND deleted_at IS NULL", input.ProjectID).Scan(&current)
		if errors.Is(checkErr, sql.ErrNoRows) {
			return projects.Project{}, projects.Revision{}, projects.ErrNotFound
		}
		if checkErr != nil {
			return projects.Project{}, projects.Revision{}, fmt.Errorf("postgres: check project version: %w", checkErr)
		}
		return projects.Project{}, projects.Revision{}, fmt.Errorf("%w: expected %d, current %d", projects.ErrVersionConflict, input.ExpectedVersion, current)
	}
	if err != nil {
		return projects.Project{}, projects.Revision{}, fmt.Errorf("postgres: update project version: %w", err)
	}

	revision := projects.Revision{
		ProjectID:     p.ID,
		Version:       p.CurrentVersion,
		SchemaVersion: schemaVersion,
		Snapshot:      append(json.RawMessage(nil), input.Snapshot...),
		Checksum:      projects.SnapshotChecksum(input.Snapshot),
		CreatedBy:     input.CreatedBy,
	}
	if err := tx.QueryRowContext(ctx, `
INSERT INTO project_revisions(project_id, version, schema_version, snapshot, checksum, created_by_subject)
VALUES ($1, $2, $3, $4::jsonb, $5, $6)
RETURNING created_at
`, revision.ProjectID, revision.Version, revision.SchemaVersion, string(revision.Snapshot), revision.Checksum, revision.CreatedBy).
		Scan(&revision.CreatedAt); err != nil {
		return projects.Project{}, projects.Revision{}, fmt.Errorf("postgres: insert revision: %w", err)
	}
	if err := writeAudit(ctx, tx, p.WorkspaceID, p.ID, input.CreatedBy, "project.revision.save", p.ID, map[string]any{"version": p.CurrentVersion, "baseVersion": input.ExpectedVersion}); err != nil {
		return projects.Project{}, projects.Revision{}, err
	}
	if err := tx.Commit(); err != nil {
		return projects.Project{}, projects.Revision{}, fmt.Errorf("postgres: commit save revision: %w", err)
	}
	return p, revision, nil
}

func (s *Store) DeleteProject(ctx context.Context, projectID, actor string) error {
	projectID = strings.TrimSpace(projectID)
	actor = strings.TrimSpace(actor)
	if projectID == "" || actor == "" {
		return errors.New("postgres: project id and actor are required")
	}
	tx, err := s.db.BeginTx(ctx, &sql.TxOptions{Isolation: sql.LevelReadCommitted})
	if err != nil {
		return fmt.Errorf("postgres: begin delete project: %w", err)
	}
	defer tx.Rollback()

	var workspaceID string
	err = tx.QueryRowContext(ctx, `
UPDATE projects
SET deleted_at = NOW(), updated_at = NOW()
WHERE id = $1 AND deleted_at IS NULL
RETURNING workspace_id
`, projectID).Scan(&workspaceID)
	if errors.Is(err, sql.ErrNoRows) {
		return projects.ErrNotFound
	}
	if err != nil {
		return fmt.Errorf("postgres: soft delete project: %w", err)
	}
	if err := writeAudit(ctx, tx, workspaceID, projectID, actor, "project.delete", projectID, map[string]any{}); err != nil {
		return err
	}
	if err := tx.Commit(); err != nil {
		return fmt.Errorf("postgres: commit delete project: %w", err)
	}
	return nil
}

func (s *Store) RoleForProject(ctx context.Context, projectID, userID string) (auth.Role, error) {
	var role string
	err := s.db.QueryRowContext(ctx, `
SELECT wm.role
FROM projects p
JOIN workspace_memberships wm ON wm.workspace_id = p.workspace_id
WHERE p.id = $1
  AND p.deleted_at IS NULL
  AND wm.user_id = $2
`, strings.TrimSpace(projectID), strings.TrimSpace(userID)).Scan(&role)
	if errors.Is(err, sql.ErrNoRows) {
		return "", auth.ErrForbidden
	}
	if err != nil {
		return "", fmt.Errorf("postgres: project role: %w", err)
	}
	switch auth.Role(role) {
	case auth.RoleOwner, auth.RoleEditor, auth.RoleViewer:
		return auth.Role(role), nil
	default:
		return "", auth.ErrForbidden
	}
}

func writeAudit(ctx context.Context, tx *sql.Tx, workspaceID, projectID, actor, action, resourceID string, metadata map[string]any) error {
	raw, err := json.Marshal(metadata)
	if err != nil {
		return fmt.Errorf("postgres: encode audit metadata: %w", err)
	}
	if _, err := tx.ExecContext(ctx, `
INSERT INTO audit_events(workspace_id, project_id, actor_subject, action, resource_type, resource_id, metadata)
VALUES ($1, $2, $3, $4, 'project', $5, $6::jsonb)
`, workspaceID, projectID, actor, action, resourceID, string(raw)); err != nil {
		return fmt.Errorf("postgres: write audit event: %w", err)
	}
	return nil
}
