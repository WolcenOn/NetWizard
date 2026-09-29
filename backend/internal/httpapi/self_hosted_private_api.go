package httpapi

import (
	"crypto/rand"
	"crypto/sha256"
	"crypto/subtle"
	"encoding/base64"
	"encoding/hex"
	"encoding/json"
	"errors"
	"net"
	"net/http"
	"net/url"
	"strings"
	"sync"
	"time"

	"github.com/WolcenOn/NetWizard/backend/internal/privateservices"
	"github.com/WolcenOn/NetWizard/backend/internal/projects"
)

const (
	selfHostedPrivateCookieName = "netwizard_private_session"
	selfHostedPrivateLoginLimit = 5
	selfHostedPrivateGenerateLimit = 20
	selfHostedPrivateRateWindow = time.Minute
	selfHostedPrivateRequestOverhead = int64(64 * 1024)
)

type selfHostedPrivateSession struct {
	CSRF      string
	ExpiresAt time.Time
}

type selfHostedPrivateRate struct {
	Start time.Time
	Count int
}

type selfHostedPrivateAuthState struct {
	mu        sync.Mutex
	sessions  map[string]selfHostedPrivateSession
	loginRate map[string]selfHostedPrivateRate
	runRate   map[string]selfHostedPrivateRate
}

func newSelfHostedPrivateAuthState() *selfHostedPrivateAuthState {
	return &selfHostedPrivateAuthState{
		sessions:  map[string]selfHostedPrivateSession{},
		loginRate: map[string]selfHostedPrivateRate{},
		runRate:   map[string]selfHostedPrivateRate{},
	}
}

func randomPrivateToken() (string, error) {
	raw := make([]byte, 32)
	if _, err := rand.Read(raw); err != nil {
		return "", err
	}
	return base64.RawURLEncoding.EncodeToString(raw), nil
}

func privateSessionKey(raw string) string {
	sum := sha256.Sum256([]byte(raw))
	return hex.EncodeToString(sum[:])
}

func privateSecretEqual(left, right string) bool {
	leftHash := sha256.Sum256([]byte(strings.TrimSpace(left)))
	rightHash := sha256.Sum256([]byte(strings.TrimSpace(right)))
	return subtle.ConstantTimeCompare(leftHash[:], rightHash[:]) == 1
}

func (a *selfHostedPrivateAuthState) create(ttl time.Duration, now time.Time) (string, selfHostedPrivateSession, error) {
	if ttl <= 0 {
		ttl = 12 * time.Hour
	}
	raw, err := randomPrivateToken()
	if err != nil {
		return "", selfHostedPrivateSession{}, err
	}
	csrf, err := randomPrivateToken()
	if err != nil {
		return "", selfHostedPrivateSession{}, err
	}
	session := selfHostedPrivateSession{CSRF: csrf, ExpiresAt: now.Add(ttl).UTC()}
	a.mu.Lock()
	defer a.mu.Unlock()
	a.pruneLocked(now)
	a.sessions[privateSessionKey(raw)] = session
	return raw, session, nil
}

func (a *selfHostedPrivateAuthState) get(raw string, now time.Time) (selfHostedPrivateSession, bool) {
	if a == nil || strings.TrimSpace(raw) == "" {
		return selfHostedPrivateSession{}, false
	}
	a.mu.Lock()
	defer a.mu.Unlock()
	a.pruneLocked(now)
	session, ok := a.sessions[privateSessionKey(raw)]
	if !ok || !session.ExpiresAt.After(now) {
		return selfHostedPrivateSession{}, false
	}
	return session, true
}

func (a *selfHostedPrivateAuthState) remove(raw string) {
	if a == nil || strings.TrimSpace(raw) == "" {
		return
	}
	a.mu.Lock()
	delete(a.sessions, privateSessionKey(raw))
	a.mu.Unlock()
}

func (a *selfHostedPrivateAuthState) pruneLocked(now time.Time) {
	for key, session := range a.sessions {
		if !session.ExpiresAt.After(now) {
			delete(a.sessions, key)
		}
	}
	for key, rate := range a.loginRate {
		if now.Sub(rate.Start) >= selfHostedPrivateRateWindow {
			delete(a.loginRate, key)
		}
	}
	for key, rate := range a.runRate {
		if now.Sub(rate.Start) >= selfHostedPrivateRateWindow {
			delete(a.runRate, key)
		}
	}
}

func (a *selfHostedPrivateAuthState) allowLogin(key string, now time.Time) bool {
	return a.allow(a.loginRate, key, now, selfHostedPrivateLoginLimit)
}

func (a *selfHostedPrivateAuthState) allowRun(key string, now time.Time) bool {
	return a.allow(a.runRate, key, now, selfHostedPrivateGenerateLimit)
}

func (a *selfHostedPrivateAuthState) allow(bucket map[string]selfHostedPrivateRate, key string, now time.Time, limit int) bool {
	if a == nil {
		return false
	}
	if key == "" {
		key = "unknown"
	}
	a.mu.Lock()
	defer a.mu.Unlock()
	a.pruneLocked(now)
	rate := bucket[key]
	if rate.Start.IsZero() || now.Sub(rate.Start) >= selfHostedPrivateRateWindow {
		bucket[key] = selfHostedPrivateRate{Start: now, Count: 1}
		return true
	}
	if rate.Count >= limit {
		return false
	}
	rate.Count++
	bucket[key] = rate
	return true
}

func (s *Server) selfHostedPrivateDeploymentReady() bool {
	return s != nil && s.cfg.SelfHostedPrivateConfigured() &&
		s.privateServices != nil && s.privateServices.DeploymentConfigured() &&
		s.selfHostedPrivateAuth != nil
}

func (s *Server) selfHostedPrivateRoutes() {
	s.mux.HandleFunc("GET /api/private/self-hosted/session", s.handleSelfHostedPrivateSession)
	s.mux.HandleFunc("POST /api/private/self-hosted/session", s.handleSelfHostedPrivateLogin)
	s.mux.HandleFunc("POST /api/private/self-hosted/logout", s.handleSelfHostedPrivateLogout)
	s.mux.HandleFunc("POST /api/private/self-hosted/deployment-plan", s.handleSelfHostedPrivateDeploymentPlan)
}

func selfHostedPrivateClientKey(r *http.Request) string {
	host, _, err := net.SplitHostPort(strings.TrimSpace(r.RemoteAddr))
	if err == nil && host != "" {
		return host
	}
	return strings.TrimSpace(r.RemoteAddr)
}

func selfHostedPrivateSameOrigin(r *http.Request) bool {
	if r == nil {
		return false
	}
	if site := strings.TrimSpace(r.Header.Get("Sec-Fetch-Site")); site != "" && !strings.EqualFold(site, "same-origin") {
		return false
	}
	source := strings.TrimSpace(r.Header.Get("Origin"))
	if source == "" {
		source = strings.TrimSpace(r.Header.Get("Referer"))
	}
	if source == "" {
		return false
	}
	u, err := url.Parse(source)
	if err != nil || u.Host == "" {
		return false
	}
	requestHost := strings.ToLower(strings.TrimSuffix(strings.TrimSpace(r.Host), "."))
	sourceHost := strings.ToLower(strings.TrimSuffix(strings.TrimSpace(u.Host), "."))
	return requestHost != "" && subtle.ConstantTimeCompare([]byte(requestHost), []byte(sourceHost)) == 1
}

func selfHostedPrivateJSONRequest(r *http.Request) bool {
	media := strings.ToLower(strings.TrimSpace(strings.Split(r.Header.Get("Content-Type"), ";")[0]))
	return media == "application/json"
}

func selfHostedPrivateCustomHeader(r *http.Request) bool {
	return subtle.ConstantTimeCompare([]byte(strings.TrimSpace(r.Header.Get("X-NetWizard-Private-Request"))), []byte("1")) == 1
}

func (s *Server) requireSelfHostedPrivateBrowserRequest(w http.ResponseWriter, r *http.Request) bool {
	if !selfHostedPrivateSameOrigin(r) || !selfHostedPrivateCustomHeader(r) {
		http.Error(w, "forbidden", http.StatusForbidden)
		return false
	}
	return true
}

func (s *Server) selfHostedPrivateSessionFromRequest(r *http.Request) (string, selfHostedPrivateSession, bool) {
	if s == nil || s.selfHostedPrivateAuth == nil {
		return "", selfHostedPrivateSession{}, false
	}
	cookie, err := r.Cookie(selfHostedPrivateCookieName)
	if err != nil {
		return "", selfHostedPrivateSession{}, false
	}
	raw := strings.TrimSpace(cookie.Value)
	session, ok := s.selfHostedPrivateAuth.get(raw, time.Now().UTC())
	return raw, session, ok
}

func (s *Server) requireSelfHostedPrivateSession(w http.ResponseWriter, r *http.Request, csrf bool) (string, selfHostedPrivateSession, bool) {
	raw, session, ok := s.selfHostedPrivateSessionFromRequest(r)
	if !ok {
		noStore(w)
		http.Error(w, "unauthorized", http.StatusUnauthorized)
		return "", selfHostedPrivateSession{}, false
	}
	if csrf {
		provided := strings.TrimSpace(r.Header.Get("X-NetWizard-CSRF"))
		if provided == "" || !privateSecretEqual(provided, session.CSRF) {
			noStore(w)
			http.Error(w, "csrf check failed", http.StatusForbidden)
			return "", selfHostedPrivateSession{}, false
		}
	}
	return raw, session, true
}

func (s *Server) setSelfHostedPrivateCookie(w http.ResponseWriter, raw string, expires time.Time) {
	ttl := time.Until(expires)
	maxAge := int(ttl.Seconds())
	if maxAge < 1 {
		maxAge = 1
	}
	http.SetCookie(w, &http.Cookie{
		Name:     selfHostedPrivateCookieName,
		Value:    raw,
		Path:     "/api/private/self-hosted",
		HttpOnly: true,
		Secure:   s.cfg.CookieSecure,
		SameSite: http.SameSiteStrictMode,
		MaxAge:   maxAge,
		Expires:  expires.UTC(),
	})
}

func (s *Server) clearSelfHostedPrivateCookie(w http.ResponseWriter) {
	http.SetCookie(w, &http.Cookie{
		Name:     selfHostedPrivateCookieName,
		Value:    "",
		Path:     "/api/private/self-hosted",
		HttpOnly: true,
		Secure:   s.cfg.CookieSecure,
		SameSite: http.SameSiteStrictMode,
		MaxAge:   -1,
		Expires:  time.Unix(1, 0).UTC(),
	})
}

func (s *Server) handleSelfHostedPrivateSession(w http.ResponseWriter, r *http.Request) {
	if !s.selfHostedPrivateDeploymentReady() {
		http.NotFound(w, r)
		return
	}
	_, session, ok := s.selfHostedPrivateSessionFromRequest(r)
	noStore(w)
	if !ok {
		http.Error(w, "unauthorized", http.StatusUnauthorized)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{
		"authenticated": true,
		"csrfToken":    session.CSRF,
		"expiresAt":    session.ExpiresAt.UTC().Format(time.RFC3339),
	})
}

func (s *Server) handleSelfHostedPrivateLogin(w http.ResponseWriter, r *http.Request) {
	if !s.selfHostedPrivateDeploymentReady() {
		http.NotFound(w, r)
		return
	}
	if !s.requireSelfHostedPrivateBrowserRequest(w, r) {
		return
	}
	if !selfHostedPrivateJSONRequest(r) {
		http.Error(w, "application/json required", http.StatusUnsupportedMediaType)
		return
	}
	now := time.Now().UTC()
	if !s.selfHostedPrivateAuth.allowLogin(selfHostedPrivateClientKey(r), now) {
		w.Header().Set("Retry-After", "60")
		http.Error(w, "rate limit exceeded", http.StatusTooManyRequests)
		return
	}
	var body struct {
		Token string `json:"token"`
	}
	if err := decodeJSON(w, r, &body, 4*1024); err != nil {
		writeDecodeError(w, err)
		return
	}
	provided := strings.TrimSpace(body.Token)
	expected := strings.TrimSpace(s.cfg.SelfHostedPrivateToken)
	if provided == "" || !privateSecretEqual(provided, expected) {
		noStore(w)
		http.Error(w, "unauthorized", http.StatusUnauthorized)
		return
	}
	raw, session, err := s.selfHostedPrivateAuth.create(s.cfg.SessionTTL, now)
	if err != nil {
		s.internalError(w, "create self-hosted private session", err)
		return
	}
	s.setSelfHostedPrivateCookie(w, raw, session.ExpiresAt)
	noStore(w)
	writeJSON(w, http.StatusOK, map[string]any{
		"authenticated": true,
		"csrfToken":    session.CSRF,
		"expiresAt":    session.ExpiresAt.UTC().Format(time.RFC3339),
	})
}

func (s *Server) handleSelfHostedPrivateLogout(w http.ResponseWriter, r *http.Request) {
	if !s.selfHostedPrivateDeploymentReady() {
		http.NotFound(w, r)
		return
	}
	if !s.requireSelfHostedPrivateBrowserRequest(w, r) {
		return
	}
	raw, _, ok := s.requireSelfHostedPrivateSession(w, r, true)
	if !ok {
		return
	}
	s.selfHostedPrivateAuth.remove(raw)
	s.clearSelfHostedPrivateCookie(w)
	noStore(w)
	w.WriteHeader(http.StatusNoContent)
}

func (s *Server) handleSelfHostedPrivateDeploymentPlan(w http.ResponseWriter, r *http.Request) {
	if !s.selfHostedPrivateDeploymentReady() {
		http.NotFound(w, r)
		return
	}
	if !s.requireSelfHostedPrivateBrowserRequest(w, r) {
		return
	}
	if !selfHostedPrivateJSONRequest(r) {
		http.Error(w, "application/json required", http.StatusUnsupportedMediaType)
		return
	}
	if _, _, ok := s.requireSelfHostedPrivateSession(w, r, true); !ok {
		return
	}
	now := time.Now().UTC()
	if !s.selfHostedPrivateAuth.allowRun(selfHostedPrivateClientKey(r), now) {
		w.Header().Set("Retry-After", "60")
		http.Error(w, "rate limit exceeded", http.StatusTooManyRequests)
		return
	}

	var body struct {
		Snapshot json.RawMessage `json:"snapshot"`
	}
	maxBody := s.cfg.MaxProjectBytes + selfHostedPrivateRequestOverhead
	if err := decodeJSON(w, r, &body, maxBody); err != nil {
		writeDecodeError(w, err)
		return
	}
	if _, err := projects.ValidateSnapshot(body.Snapshot, s.cfg.MaxProjectBytes); err != nil {
		writeSnapshotValidationError(w, err)
		return
	}
	checksum := projects.SnapshotChecksum(body.Snapshot)
	result, err := s.privateServices.GenerateDeploymentPlan(r.Context(), body.Snapshot, now)
	if err != nil {
		if errors.Is(err, privateservices.ErrPrivateDeploymentInvalid) {
			http.Error(w, "private deployment request rejected", http.StatusBadRequest)
			return
		}
		if errors.Is(err, privateservices.ErrPrivateDeploymentUnavailable) {
			http.Error(w, "private deployment unavailable", http.StatusServiceUnavailable)
			return
		}
		s.internalError(w, "generate self-hosted private deployment plan", err)
		return
	}

	s.log.Info("self-hosted private deployment generated",
		"projectChecksum", checksum,
		"productionStatus", result.ProductionStatus,
		"artifactCount", len(result.Artifacts),
	)
	noStore(w)
	writeJSON(w, http.StatusOK, result)
}
