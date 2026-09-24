package postgres

import (
	"context"
	"database/sql"
	"encoding/json"
	"errors"
	"fmt"
	"strings"

	"github.com/WolcenOn/NetWizard/backend/internal/auth"
	"github.com/WolcenOn/NetWizard/backend/internal/workspaces"
)

func (s *Store) CreateWorkspace(ctx context.Context, input workspaces.CreateInput) (workspaces.Workspace, error) {
	if s == nil || s.db == nil {
		return workspaces.Workspace{}, errors.New("postgres: store is not initialized")
	}
	input.ID = strings.TrimSpace(input.ID)
	input.Name = workspaces.NormalizeName(input.Name)
	input.UserID = strings.TrimSpace(input.UserID)
	input.CreatedBy = strings.TrimSpace(input.CreatedBy)
	if input.ID == "" || input.Name == "" || input.UserID == "" || input.CreatedBy == "" {
		return workspaces.Workspace{}, errors.New("postgres: workspace id, name, user and actor are required")
	}

	tx, err := s.db.BeginTx(ctx, &sql.TxOptions{Isolation: sql.LevelSerializable})
	if err != nil {
		return workspaces.Workspace{}, fmt.Errorf("postgres: begin create workspace: %w", err)
	}
	defer tx.Rollback()

	var ws workspaces.Workspace
	ws.ID, ws.Name, ws.CreatedBy, ws.Role = input.ID, input.Name, input.CreatedBy, auth.RoleOwner
	if err := tx.QueryRowContext(ctx, `
INSERT INTO workspaces(id, name, created_by_subject)
VALUES ($1, $2, $3)
RETURNING created_at, updated_at
`, ws.ID, ws.Name, ws.CreatedBy).Scan(&ws.CreatedAt, &ws.UpdatedAt); err != nil {
		return workspaces.Workspace{}, fmt.Errorf("postgres: insert workspace: %w", err)
	}

	if _, err := tx.ExecContext(ctx, `
INSERT INTO workspace_memberships(workspace_id, user_id, role)
VALUES ($1, $2, 'owner')
`, ws.ID, input.UserID); err != nil {
		return workspaces.Workspace{}, fmt.Errorf("postgres: insert owner membership: %w", err)
	}

	metadata, _ := json.Marshal(map[string]any{"role": "owner"})
	if _, err := tx.ExecContext(ctx, `
INSERT INTO audit_events(workspace_id, actor_subject, action, resource_type, resource_id, metadata)
VALUES ($1, $2, 'workspace.create', 'workspace', $1, $3::jsonb)
`, ws.ID, input.CreatedBy, string(metadata)); err != nil {
		return workspaces.Workspace{}, fmt.Errorf("postgres: audit workspace create: %w", err)
	}

	if err := tx.Commit(); err != nil {
		return workspaces.Workspace{}, fmt.Errorf("postgres: commit create workspace: %w", err)
	}
	return ws, nil
}

func (s *Store) ListUserWorkspaces(ctx context.Context, userID string) ([]workspaces.Workspace, error) {
	rows, err := s.db.QueryContext(ctx, `
SELECT w.id, w.name, wm.role, w.created_by_subject, w.created_at, w.updated_at
FROM workspace_memberships wm
JOIN workspaces w ON w.id = wm.workspace_id
WHERE wm.user_id = $1
ORDER BY w.updated_at DESC, w.id
`, strings.TrimSpace(userID))
	if err != nil {
		return nil, fmt.Errorf("postgres: list user workspaces: %w", err)
	}
	defer rows.Close()

	out := make([]workspaces.Workspace, 0)
	for rows.Next() {
		var ws workspaces.Workspace
		var role string
		if err := rows.Scan(&ws.ID, &ws.Name, &role, &ws.CreatedBy, &ws.CreatedAt, &ws.UpdatedAt); err != nil {
			return nil, fmt.Errorf("postgres: scan workspace list: %w", err)
		}
		ws.Role = auth.Role(role)
		out = append(out, ws)
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("postgres: iterate workspace list: %w", err)
	}
	return out, nil
}

func (s *Store) RoleForWorkspace(ctx context.Context, workspaceID, userID string) (auth.Role, error) {
	var role string
	err := s.db.QueryRowContext(ctx, `
SELECT role
FROM workspace_memberships
WHERE workspace_id = $1 AND user_id = $2
`, strings.TrimSpace(workspaceID), strings.TrimSpace(userID)).Scan(&role)
	if errors.Is(err, sql.ErrNoRows) {
		return "", auth.ErrForbidden
	}
	if err != nil {
		return "", fmt.Errorf("postgres: workspace role: %w", err)
	}
	switch auth.Role(role) {
	case auth.RoleOwner, auth.RoleEditor, auth.RoleViewer:
		return auth.Role(role), nil
	default:
		return "", auth.ErrForbidden
	}
}
