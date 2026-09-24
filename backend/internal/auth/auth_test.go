package auth

import (
	"context"
	"errors"
	"net/http/httptest"
	"testing"
)

type verifierFunc func(context.Context, string) (Principal, error)

func (f verifierFunc) Verify(ctx context.Context, token string) (Principal, error) {
	return f(ctx, token)
}

type accessStore map[string]Role

func (s accessStore) RoleForProject(ctx context.Context, projectID, userID string) (Role, error) {
	role, ok := s[projectID+":"+userID]
	if !ok {
		return "", errors.New("not found")
	}
	return role, nil
}

func (s accessStore) RoleForWorkspace(ctx context.Context, workspaceID, userID string) (Role, error) {
	role, ok := s[workspaceID+":"+userID]
	if !ok {
		return "", errors.New("not found")
	}
	return role, nil
}

func TestBearerAuthenticatorFailsClosed(t *testing.T) {
	a := BearerAuthenticator{Verifier: verifierFunc(func(context.Context, string) (Principal, error) {
		return Principal{Subject: "user-1"}, nil
	})}
	req := httptest.NewRequest("GET", "/", nil)
	if _, err := a.Authenticate(req); !errors.Is(err, ErrUnauthenticated) {
		t.Fatalf("expected unauthenticated without bearer token, got %v", err)
	}
	req.Header.Set("Authorization", "Bearer token-123")
	p, err := a.Authenticate(req)
	if err != nil || p.Subject != "user-1" {
		t.Fatalf("expected verified principal, got %#v, %v", p, err)
	}
}

func TestAuthorizerUsesRoleHierarchy(t *testing.T) {
	a := Authorizer{Store: accessStore{
		"p1:owner":  RoleOwner,
		"p1:editor": RoleEditor,
		"p1:viewer": RoleViewer,
	}}
	for _, tc := range []struct {
		subject  string
		required Role
		allowed  bool
	}{
		{"owner", RoleOwner, true},
		{"owner", RoleEditor, true},
		{"editor", RoleEditor, true},
		{"editor", RoleOwner, false},
		{"viewer", RoleViewer, true},
		{"viewer", RoleEditor, false},
	} {
		err := a.RequireProjectRole(context.Background(), Principal{Subject: tc.subject, UserID: tc.subject}, "p1", tc.required)
		if tc.allowed && err != nil {
			t.Fatalf("%s should allow %s: %v", tc.subject, tc.required, err)
		}
		if !tc.allowed && !errors.Is(err, ErrForbidden) {
			t.Fatalf("%s should deny %s, got %v", tc.subject, tc.required, err)
		}
	}
}
