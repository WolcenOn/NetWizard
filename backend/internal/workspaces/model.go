package workspaces

import (
	"context"
	"errors"
	"strings"
	"time"

	"github.com/WolcenOn/NetWizard/backend/internal/auth"
)

var ErrNotFound = errors.New("workspace not found")

type Workspace struct {
	ID        string    `json:"id"`
	Name      string    `json:"name"`
	Role      auth.Role `json:"role,omitempty"`
	CreatedBy string    `json:"createdBy"`
	CreatedAt time.Time `json:"createdAt"`
	UpdatedAt time.Time `json:"updatedAt"`
}

type CreateInput struct {
	ID        string
	Name      string
	UserID    string
	CreatedBy string
}

type Store interface {
	CreateWorkspace(context.Context, CreateInput) (Workspace, error)
	ListUserWorkspaces(context.Context, string) ([]Workspace, error)
	RoleForWorkspace(context.Context, string, string) (auth.Role, error)
}

func NormalizeName(name string) string {
	return strings.TrimSpace(name)
}
