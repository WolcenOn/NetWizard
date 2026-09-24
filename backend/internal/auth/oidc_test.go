package auth

import (
	"context"
	"crypto"
	"crypto/rand"
	"crypto/rsa"
	"crypto/sha256"
	"encoding/base64"
	"encoding/binary"
	"encoding/json"
	"errors"
	"math/big"
	"net/http"
	"net/http/httptest"
	"net/url"
	"strings"
	"sync"
	"testing"
	"time"
)

type memorySessionStore struct {
	mu       sync.Mutex
	logins   map[string]LoginState
	users    map[string]User
	sessions map[string]Session
}

func newMemorySessionStore() *memorySessionStore {
	return &memorySessionStore{
		logins: map[string]LoginState{},
		users: map[string]User{},
		sessions: map[string]Session{},
	}
}

func keyBytes(b []byte) string { return base64.RawURLEncoding.EncodeToString(b) }

func (m *memorySessionStore) SaveLoginState(_ context.Context, state LoginState) error {
	m.mu.Lock()
	defer m.mu.Unlock()
	m.logins[keyBytes(state.StateHash)] = state
	return nil
}
func (m *memorySessionStore) ConsumeLoginState(_ context.Context, hash []byte, now time.Time) (LoginState, error) {
	m.mu.Lock()
	defer m.mu.Unlock()
	key := keyBytes(hash)
	state, ok := m.logins[key]
	delete(m.logins, key)
	if !ok || !state.ExpiresAt.After(now) {
		return LoginState{}, ErrInvalidState
	}
	return state, nil
}
func (m *memorySessionStore) UpsertUser(_ context.Context, identity ExternalIdentity, candidateID string) (User, error) {
	m.mu.Lock()
	defer m.mu.Unlock()
	key := identity.Issuer + "\x00" + identity.Subject
	if user, ok := m.users[key]; ok {
		user.Email, user.DisplayName = identity.Email, identity.DisplayName
		m.users[key] = user
		return user, nil
	}
	user := User{ID: candidateID, Issuer: identity.Issuer, Subject: identity.Subject, Email: identity.Email, DisplayName: identity.DisplayName}
	m.users[key] = user
	return user, nil
}
func (m *memorySessionStore) CreateSession(_ context.Context, s Session) error {
	m.mu.Lock()
	defer m.mu.Unlock()
	m.sessions[keyBytes(s.IDHash)] = s
	return nil
}
func (m *memorySessionStore) GetSession(_ context.Context, hash []byte, now time.Time) (Session, error) {
	m.mu.Lock()
	defer m.mu.Unlock()
	s, ok := m.sessions[keyBytes(hash)]
	if !ok || !s.ExpiresAt.After(now) {
		return Session{}, ErrInvalidSession
	}
	return s, nil
}
func (m *memorySessionStore) DeleteSession(_ context.Context, hash []byte) error {
	m.mu.Lock()
	defer m.mu.Unlock()
	delete(m.sessions, keyBytes(hash))
	return nil
}

func TestLoginURLGeneratesStateNonceAndPKCE(t *testing.T) {
	store := newMemorySessionStore()
	service := &Service{
		cfg: OIDCConfig{ClientID: "client", RedirectURL: "https://app.example/api/auth/callback"},
		discovery: discoveryDocument{Authorization_endpoint: "https://issuer.example/authorize"},
		Sessions: &SessionManager{Store: store},
	}
	loginURL, err := service.LoginURL(context.Background(), "/projects/1")
	if err != nil {
		t.Fatal(err)
	}
	u, err := url.Parse(loginURL)
	if err != nil {
		t.Fatal(err)
	}
	q := u.Query()
	for _, name := range []string{"state", "nonce", "code_challenge"} {
		if q.Get(name) == "" {
			t.Fatalf("missing %s", name)
		}
	}
	if q.Get("code_challenge_method") != "S256" {
		t.Fatalf("unexpected PKCE method: %q", q.Get("code_challenge_method"))
	}
	if len(store.logins) != 1 {
		t.Fatalf("expected one persisted login state, got %d", len(store.logins))
	}
	for _, state := range store.logins {
		if state.Nonce != q.Get("nonce") || state.PKCEVerifier == "" || state.ReturnTo != "/projects/1" {
			t.Fatalf("unexpected persisted login state: %#v", state)
		}
	}
}

func TestLoginRejectsExternalRedirect(t *testing.T) {
	store := newMemorySessionStore()
	service := &Service{
		cfg: OIDCConfig{ClientID: "client", RedirectURL: "https://app.example/api/auth/callback"},
		discovery: discoveryDocument{Authorization_endpoint: "https://issuer.example/authorize"},
		Sessions: &SessionManager{Store: store},
	}
	if _, err := service.LoginURL(context.Background(), "https://evil.example/steal"); err == nil {
		t.Fatal("expected external returnTo to be rejected")
	}
}

func TestSessionManagerMissingExpiredValidAndLogout(t *testing.T) {
	store := newMemorySessionStore()
	manager := &SessionManager{Store: store, Cookie: CookieConfig{Name: "nw", Secure: true}}
	req := httptest.NewRequest(http.MethodGet, "/", nil)
	if _, err := manager.Authenticate(req); !errors.Is(err, ErrUnauthenticated) {
		t.Fatalf("missing session should be unauthenticated, got %v", err)
	}

	raw, session, err := manager.Create(context.Background(), User{
		ID: "usr-1", Issuer: "https://issuer.example", Subject: "sub-1", Email: "u@example.test",
	}, time.Hour)
	if err != nil {
		t.Fatal(err)
	}
	req.AddCookie(&http.Cookie{Name: "nw", Value: raw})
	principal, err := manager.Authenticate(req)
	if err != nil || principal.UserID != "usr-1" || principal.Subject != "sub-1" {
		t.Fatalf("unexpected principal: %#v err=%v", principal, err)
	}

	rec := httptest.NewRecorder()
	manager.SetCookie(rec, raw, session.ExpiresAt)
	cookies := rec.Result().Cookies()
	if len(cookies) != 1 || !cookies[0].HttpOnly || !cookies[0].Secure || cookies[0].SameSite != http.SameSiteLaxMode {
		t.Fatalf("session cookie security flags missing: %#v", cookies)
	}

	if err := manager.Invalidate(context.Background(), raw); err != nil {
		t.Fatal(err)
	}
	if _, err := manager.Authenticate(req); !errors.Is(err, ErrUnauthenticated) {
		t.Fatalf("revoked session should be unauthenticated, got %v", err)
	}

	expiredRaw := "expired-session"
	store.sessions[keyBytes(hashToken(expiredRaw))] = Session{
		IDHash: hashToken(expiredRaw), UserID: "usr-2", Subject: "sub-2",
		ExpiresAt: time.Now().Add(-time.Minute),
	}
	expiredReq := httptest.NewRequest(http.MethodGet, "/", nil)
	expiredReq.AddCookie(&http.Cookie{Name: "nw", Value: expiredRaw})
	if _, err := manager.Authenticate(expiredReq); !errors.Is(err, ErrUnauthenticated) {
		t.Fatalf("expired session should be unauthenticated, got %v", err)
	}
}

func TestVerifyIDTokenRejectsNonceExpiryIssuerAndAudience(t *testing.T) {
	key, err := rsa.GenerateKey(rand.Reader, 2048)
	if err != nil {
		t.Fatal(err)
	}
	const kid = "test-key"
	jwks := func() []byte {
		n := base64.RawURLEncoding.EncodeToString(key.PublicKey.N.Bytes())
		eBytes := make([]byte, 4)
		binary.BigEndian.PutUint32(eBytes, uint32(key.PublicKey.E))
		eBytes = bytesTrimLeftZero(eBytes)
		raw, _ := json.Marshal(map[string]any{"keys": []map[string]any{{
			"kty": "RSA", "kid": kid, "alg": "RS256", "n": n,
			"e": base64.RawURLEncoding.EncodeToString(eBytes),
		}}})
		return raw
	}
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write(jwks())
	}))
	defer server.Close()

	service := &Service{
		cfg: OIDCConfig{IssuerURL: "https://issuer.example", ClientID: "netwizard"},
		http: server.Client(),
		discovery: discoveryDocument{Jwks_uri: server.URL},
	}
	now := time.Now().Unix()
	base := map[string]any{
		"iss": "https://issuer.example", "sub": "subject-1", "aud": "netwizard",
		"exp": now + 600, "nonce": "nonce-1", "email": "u@example.test", "name": "User",
	}
	tests := []struct {
		name   string
		change func(map[string]any)
	}{
		{"nonce", func(c map[string]any) { c["nonce"] = "wrong" }},
		{"expired", func(c map[string]any) { c["exp"] = now - 1 }},
		{"issuer", func(c map[string]any) { c["iss"] = "https://other.example" }},
		{"audience", func(c map[string]any) { c["aud"] = "other-client" }},
	}
	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			claims := cloneClaims(base)
			tc.change(claims)
			raw := signTestToken(t, key, kid, claims)
			if _, err := service.verifyIDToken(context.Background(), raw, "nonce-1"); err == nil {
				t.Fatalf("expected %s validation failure", tc.name)
			}
		})
	}
	raw := signTestToken(t, key, kid, cloneClaims(base))
	identity, err := service.verifyIDToken(context.Background(), raw, "nonce-1")
	if err != nil || identity.Subject != "subject-1" {
		t.Fatalf("expected valid identity, got %#v err=%v", identity, err)
	}
}

func signTestToken(t *testing.T, key *rsa.PrivateKey, kid string, claims map[string]any) string {
	t.Helper()
	header, _ := json.Marshal(map[string]any{"alg": "RS256", "kid": kid, "typ": "JWT"})
	payload, _ := json.Marshal(claims)
	left := base64.RawURLEncoding.EncodeToString(header) + "." + base64.RawURLEncoding.EncodeToString(payload)
	sum := sha256.Sum256([]byte(left))
	sig, err := rsa.SignPKCS1v15(rand.Reader, key, crypto.SHA256, sum[:])
	if err != nil {
		t.Fatal(err)
	}
	return left + "." + base64.RawURLEncoding.EncodeToString(sig)
}

func cloneClaims(in map[string]any) map[string]any {
	out := make(map[string]any, len(in))
	for k, v := range in {
		out[k] = v
	}
	return out
}

func bytesTrimLeftZero(in []byte) []byte {
	for len(in) > 1 && in[0] == 0 {
		in = in[1:]
	}
	return in
}

func TestAudienceContainsStringAndArray(t *testing.T) {
	for _, raw := range []string{`"client"`, `["other","client"]`} {
		if !audienceContains(json.RawMessage(raw), "client") {
			t.Fatalf("expected client in %s", raw)
		}
	}
	if audienceContains(json.RawMessage(`["other"]`), "client") {
		t.Fatal("unexpected audience match")
	}
}

func TestValidReturnTo(t *testing.T) {
	for _, value := range []string{"", "/", "/project?id=1"} {
		if !validReturnTo(value) {
			t.Fatalf("expected %q valid", value)
		}
	}
	for _, value := range []string{"https://evil.example", "//evil.example", "/ok\r\nLocation: https://evil.example"} {
		if validReturnTo(value) {
			t.Fatalf("expected %q invalid", value)
		}
	}
}

var _ = strings.TrimSpace
var _ = big.NewInt
