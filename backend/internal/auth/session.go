package auth

import (
	"context"
	"crypto/rand"
	"crypto/sha256"
	"encoding/base64"
	"errors"
	"net/http"
	"strings"
	"time"
)

var (
	ErrInvalidSession = errors.New("invalid session")
	ErrInvalidState   = errors.New("invalid oidc state")
)

type ExternalIdentity struct {
	Issuer      string
	Subject     string
	Email       string
	DisplayName string
}

type User struct {
	ID          string
	Issuer      string
	Subject     string
	Email       string
	DisplayName string
}

type LoginState struct {
	StateHash    []byte
	Nonce        string
	PKCEVerifier string
	ReturnTo     string
	ExpiresAt    time.Time
}

type Session struct {
	IDHash    []byte
	UserID    string
	Subject   string
	Email     string
	DisplayName string
	CreatedAt time.Time
	ExpiresAt time.Time
}

type SessionStore interface {
	SaveLoginState(context.Context, LoginState) error
	ConsumeLoginState(context.Context, []byte, time.Time) (LoginState, error)
	UpsertUser(context.Context, ExternalIdentity, string) (User, error)
	CreateSession(context.Context, Session) error
	GetSession(context.Context, []byte, time.Time) (Session, error)
	DeleteSession(context.Context, []byte) error
}

type CookieConfig struct {
	Name   string
	Secure bool
	MaxAge time.Duration
}

type SessionManager struct {
	Store  SessionStore
	Cookie CookieConfig
}

func randomToken(bytes int) (string, error) {
	raw := make([]byte, bytes)
	if _, err := rand.Read(raw); err != nil {
		return "", err
	}
	return base64.RawURLEncoding.EncodeToString(raw), nil
}

func hashToken(token string) []byte {
	sum := sha256.Sum256([]byte(token))
	return sum[:]
}

func (m *SessionManager) Create(ctx context.Context, user User, ttl time.Duration) (string, Session, error) {
	if m == nil || m.Store == nil || ttl <= 0 {
		return "", Session{}, ErrInvalidSession
	}
	raw, err := randomToken(32)
	if err != nil {
		return "", Session{}, err
	}
	now := time.Now().UTC()
	session := Session{
		IDHash: hashToken(raw), UserID: user.ID, Subject: user.Subject,
		Email: user.Email, DisplayName: user.DisplayName,
		CreatedAt: now, ExpiresAt: now.Add(ttl),
	}
	if err := m.Store.CreateSession(ctx, session); err != nil {
		return "", Session{}, err
	}
	return raw, session, nil
}

func (m *SessionManager) Authenticate(r *http.Request) (Principal, error) {
	if m == nil || m.Store == nil || r == nil {
		return Principal{}, ErrUnauthenticated
	}
	cookie, err := r.Cookie(m.Cookie.Name)
	if err != nil || strings.TrimSpace(cookie.Value) == "" {
		return Principal{}, ErrUnauthenticated
	}
	session, err := m.Store.GetSession(r.Context(), hashToken(cookie.Value), time.Now().UTC())
	if err != nil {
		return Principal{}, ErrUnauthenticated
	}
	return Principal{
		Subject: session.Subject, Email: session.Email,
		DisplayName: session.DisplayName, SessionID: cookie.Value,
	}, nil
}

func (m *SessionManager) Invalidate(ctx context.Context, rawID string) error {
	if m == nil || m.Store == nil || strings.TrimSpace(rawID) == "" {
		return nil
	}
	return m.Store.DeleteSession(ctx, hashToken(rawID))
}

func (m *SessionManager) SetCookie(w http.ResponseWriter, rawID string, expires time.Time) {
	http.SetCookie(w, &http.Cookie{
		Name: m.Cookie.Name, Value: rawID, Path: "/", HttpOnly: true,
		Secure: m.Cookie.Secure, SameSite: http.SameSiteLaxMode,
		Expires: expires.UTC(), MaxAge: int(time.Until(expires).Seconds()),
	})
}

func (m *SessionManager) ClearCookie(w http.ResponseWriter) {
	http.SetCookie(w, &http.Cookie{
		Name: m.Cookie.Name, Value: "", Path: "/", HttpOnly: true,
		Secure: m.Cookie.Secure, SameSite: http.SameSiteLaxMode,
		MaxAge: -1, Expires: time.Unix(1, 0).UTC(),
	})
}

func (m *SessionManager) Require(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		principal, err := m.Authenticate(r)
		if err != nil {
			http.Error(w, "unauthorized", http.StatusUnauthorized)
			return
		}
		next.ServeHTTP(w, r.WithContext(WithPrincipal(r.Context(), principal)))
	})
}

func newUserID() (string, error) {
	token, err := randomToken(18)
	if err != nil {
		return "", err
	}
	return "usr_" + token, nil
}
