package auth

import (
	"context"
	"errors"
	"net/http"
	"strings"
)

var (
	ErrUnauthenticated = errors.New("unauthenticated")
	ErrForbidden       = errors.New("forbidden")
)

type Role string

const (
	RoleViewer Role = "viewer"
	RoleEditor Role = "editor"
	RoleOwner  Role = "owner"
)

func (r Role) Allows(required Role) bool {
	rank := map[Role]int{RoleViewer: 1, RoleEditor: 2, RoleOwner: 3}
	return rank[r] >= rank[required] && rank[required] > 0
}

type Principal struct {
	Subject     string `json:"subject"`
	Email       string `json:"email,omitempty"`
	DisplayName string `json:"displayName,omitempty"`
	SessionID   string `json:"sessionId,omitempty"`
}

func (p Principal) Valid() bool { return strings.TrimSpace(p.Subject) != "" }

type TokenVerifier interface {
	Verify(ctx context.Context, rawToken string) (Principal, error)
}

type BearerAuthenticator struct {
	Verifier TokenVerifier
}

func (a BearerAuthenticator) Authenticate(r *http.Request) (Principal, error) {
	if r == nil || a.Verifier == nil {
		return Principal{}, ErrUnauthenticated
	}
	header := strings.TrimSpace(r.Header.Get("Authorization"))
	if !strings.HasPrefix(strings.ToLower(header), "bearer ") {
		return Principal{}, ErrUnauthenticated
	}
	token := strings.TrimSpace(header[len("Bearer "):])
	if token == "" {
		return Principal{}, ErrUnauthenticated
	}
	principal, err := a.Verifier.Verify(r.Context(), token)
	if err != nil || !principal.Valid() {
		return Principal{}, ErrUnauthenticated
	}
	return principal, nil
}

type ProjectAccessStore interface {
	RoleForProject(ctx context.Context, projectID, subject string) (Role, error)
}

type Authorizer struct {
	Store ProjectAccessStore
}

func (a Authorizer) RequireProjectRole(ctx context.Context, principal Principal, projectID string, required Role) error {
	if !principal.Valid() {
		return ErrUnauthenticated
	}
	if a.Store == nil {
		return ErrForbidden
	}
	role, err := a.Store.RoleForProject(ctx, projectID, principal.Subject)
	if err != nil || !role.Allows(required) {
		return ErrForbidden
	}
	return nil
}

type contextKey struct{}

func WithPrincipal(ctx context.Context, principal Principal) context.Context {
	return context.WithValue(ctx, contextKey{}, principal)
}

func PrincipalFromContext(ctx context.Context) (Principal, bool) {
	principal, ok := ctx.Value(contextKey{}).(Principal)
	return principal, ok && principal.Valid()
}
