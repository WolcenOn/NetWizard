package httpapi

import (
	"context"
	"crypto/sha256"
	"io"
	"log/slog"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/WolcenOn/NetWizard/backend/internal/auth"
	"github.com/WolcenOn/NetWizard/backend/internal/config"
)

type httpAuthStore struct {
	session auth.Session
	deleted bool
}

func (s *httpAuthStore) SaveLoginState(context.Context, auth.LoginState) error { return nil }
func (s *httpAuthStore) ConsumeLoginState(context.Context, []byte, time.Time) (auth.LoginState, error) {
	return auth.LoginState{}, auth.ErrInvalidState
}
func (s *httpAuthStore) UpsertUser(context.Context, auth.ExternalIdentity, string) (auth.User, error) {
	return auth.User{}, nil
}
func (s *httpAuthStore) CreateSession(context.Context, auth.Session) error { return nil }
func (s *httpAuthStore) GetSession(_ context.Context, hash []byte, now time.Time) (auth.Session, error) {
	if s.deleted || !s.session.ExpiresAt.After(now) || string(hash) != string(s.session.IDHash) {
		return auth.Session{}, auth.ErrInvalidSession
	}
	return s.session, nil
}
func (s *httpAuthStore) DeleteSession(_ context.Context, hash []byte) error {
	if string(hash) == string(s.session.IDHash) {
		s.deleted = true
	}
	return nil
}

func TestAuthMeLogoutAndCapabilities(t *testing.T) {
	raw := "opaque-session"
	sum := sha256.Sum256([]byte(raw))
	store := &httpAuthStore{session: auth.Session{
		IDHash: sum[:], UserID: "usr-1", Issuer: "https://issuer.example",
		Subject: "sub-1", Email: "user@example.test", DisplayName: "Test User",
		CreatedAt: time.Now().Add(-time.Minute), ExpiresAt: time.Now().Add(time.Hour),
	}}
	manager := &auth.SessionManager{
		Store: store,
		Cookie: auth.CookieConfig{Name: "netwizard_session", Secure: true},
	}
	service := &auth.Service{Sessions: manager}
	logger := slog.New(slog.NewTextHandler(io.Discard, nil))
	server := NewServerWithDependencies(config.Config{Version: "test"}, logger, Dependencies{Auth: service})

	req := httptest.NewRequest(http.MethodGet, "/api/auth/me", nil)
	rec := httptest.NewRecorder()
	server.Handler().ServeHTTP(rec, req)
	if rec.Code != http.StatusUnauthorized {
		t.Fatalf("missing session expected 401, got %d", rec.Code)
	}

	req = httptest.NewRequest(http.MethodGet, "/api/auth/me", nil)
	req.AddCookie(&http.Cookie{Name: "netwizard_session", Value: raw})
	rec = httptest.NewRecorder()
	server.Handler().ServeHTTP(rec, req)
	if rec.Code != http.StatusOK || !strings.Contains(rec.Body.String(), "user@example.test") {
		t.Fatalf("valid session /me failed: %d %s", rec.Code, rec.Body.String())
	}
	if strings.Contains(rec.Body.String(), raw) {
		t.Fatal("/me must not expose opaque session id")
	}
	if rec.Header().Get("Cache-Control") != "no-store" {
		t.Fatalf("expected no-store, got %q", rec.Header().Get("Cache-Control"))
	}

	req = httptest.NewRequest(http.MethodPost, "/api/auth/logout", nil)
	req.AddCookie(&http.Cookie{Name: "netwizard_session", Value: raw})
	rec = httptest.NewRecorder()
	server.Handler().ServeHTTP(rec, req)
	if rec.Code != http.StatusForbidden {
		t.Fatalf("logout without CSRF header expected 403, got %d", rec.Code)
	}

	req = httptest.NewRequest(http.MethodPost, "/api/auth/logout", nil)
	req.Header.Set("X-NetWizard-CSRF", "1")
	req.AddCookie(&http.Cookie{Name: "netwizard_session", Value: raw})
	rec = httptest.NewRecorder()
	server.Handler().ServeHTTP(rec, req)
	if rec.Code != http.StatusNoContent || !store.deleted {
		t.Fatalf("logout did not revoke session: code=%d deleted=%v", rec.Code, store.deleted)
	}

	req = httptest.NewRequest(http.MethodGet, "/api/capabilities", nil)
	rec = httptest.NewRecorder()
	server.Handler().ServeHTTP(rec, req)
	body := rec.Body.String()
	for _, needle := range []string{
		"\"authEnforced\":true",
		"\"remoteProjectWrites\":false",
		"\"collaboration\":false",
	} {
		if !strings.Contains(body, needle) {
			t.Fatalf("capabilities missing %s: %s", needle, body)
		}
	}
}
