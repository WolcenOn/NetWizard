package httpapi

import (
	"context"
	"crypto/hmac"
	"encoding/base64"
	"encoding/json"
	"io"
	"log/slog"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/WolcenOn/NetWizard/backend/internal/config"
	"github.com/WolcenOn/NetWizard/backend/internal/privateservices"
)

type selfHostedDeploymentRunner struct {
	project json.RawMessage
}

func (f *selfHostedDeploymentRunner) Run(_ context.Context, request privateservices.DeploymentPlanRequest) (privateservices.DeploymentPlanResult, error) {
	f.project = append(json.RawMessage(nil), request.Project...)
	return privateservices.DeploymentPlanResult{
		ContractVersion: privateservices.PrivateDeploymentContractVersion,
		GeneratedAt: request.GeneratedAt.UTC().Format(time.RFC3339),
		OK: true,
		ProjectName: "Self-hosted",
		Artifacts: []privateservices.DeploymentArtifact{
			{Path: "configs/01-r1.cfg", Content: "configure terminal\nhostname R1\nend\nwrite memory\n", MIME: "text/plain;charset=utf-8"},
		},
		Issues: json.RawMessage(`[]`),
		ConfigSources: map[string]string{"r1": "private"},
		ConfigPaths: map[string]string{"r1": "configs/01-r1.cfg"},
		ConfigReadiness: map[string]privateservices.ConfigReadiness{"r1": {Status: "apply-ready"}},
		ConfigCapabilities: map[string]privateservices.ConfigCapability{"r1": {Vendor: "cisco_ios", Kind: "router", Mode: "cli", Supported: true}},
		PrivateConfigContract: "netwizard-private-vendor-config-v1",
		ProductionReady: false,
		ProductionStatus: "review",
		ProductionGateContract: privateservices.PrivateProductionGateContractVersion,
		ProductionGate: json.RawMessage(`{"contractVersion":"netwizard-private-production-gate-v1","status":"review","ready":false,"canExport":false,"issues":[]}`),
		ProductionGateSummary: "Private Production Gate: REVISIÓN",
	}, nil
}

func newSelfHostedPrivateTestServer(t *testing.T) (*Server, *selfHostedDeploymentRunner) {
	t.Helper()
	privateService, err := privateservices.New([]byte("12345678901234567890123456789012"))
	if err != nil {
		t.Fatal(err)
	}
	runner := &selfHostedDeploymentRunner{}
	privateService.SetDeploymentRunner(runner)
	cfg := config.Config{
		Version: "test",
		MaxProjectBytes: 1024 * 1024,
		SessionTTL: time.Hour,
		PrivateServiceKey: "12345678901234567890123456789012",
		PrivateDeploymentWorker: "/app/private/deployment-worker.cjs",
		SelfHostedPrivate: true,
		SelfHostedPrivateToken: "abcdefghijklmnopqrstuvwxyz123456",
	}
	logger := slog.New(slog.NewTextHandler(io.Discard, nil))
	return NewServerWithDependencies(cfg, logger, Dependencies{PrivateServices: privateService}), runner
}

func selfHostedBrowserRequest(method, path, body string) *http.Request {
	req := httptest.NewRequest(method, path, strings.NewReader(body))
	req.Host = "netwizard.local"
	req.RemoteAddr = "192.0.2.10:4444"
	req.Header.Set("Origin", "http://netwizard.local")
	req.Header.Set("Sec-Fetch-Site", "same-origin")
	req.Header.Set("X-NetWizard-Private-Request", "1")
	if body != "" {
		req.Header.Set("Content-Type", "application/json")
	}
	return req
}

func loginSelfHostedPrivate(t *testing.T, server *Server) (*http.Cookie, string) {
	t.Helper()
	req := selfHostedBrowserRequest(http.MethodPost, "/api/private/self-hosted/session",
		`{"token":"abcdefghijklmnopqrstuvwxyz123456"}`)
	rec := httptest.NewRecorder()
	server.Handler().ServeHTTP(rec, req)
	if rec.Code != http.StatusOK {
		t.Fatalf("login expected 200, got %d: %s", rec.Code, rec.Body.String())
	}
	var body struct {
		Authenticated bool `json:"authenticated"`
		CSRFToken string `json:"csrfToken"`
	}
	if err := json.Unmarshal(rec.Body.Bytes(), &body); err != nil {
		t.Fatal(err)
	}
	if !body.Authenticated || body.CSRFToken == "" {
		t.Fatalf("unexpected login response: %s", rec.Body.String())
	}
	result := rec.Result()
	defer result.Body.Close()
	var cookie *http.Cookie
	for _, candidate := range result.Cookies() {
		if candidate.Name == selfHostedPrivateCookieName {
			cookie = candidate
			break
		}
	}
	if cookie == nil || !cookie.HttpOnly || cookie.SameSite != http.SameSiteStrictMode {
		t.Fatalf("expected HttpOnly Strict private session cookie, got %#v", cookie)
	}
	return cookie, body.CSRFToken
}

func TestSelfHostedPrivateGenerationRequiresExplicitSessionAndCSRF(t *testing.T) {
	server, runner := newSelfHostedPrivateTestServer(t)

	capReq := httptest.NewRequest(http.MethodGet, "/api/capabilities", nil)
	capRec := httptest.NewRecorder()
	server.Handler().ServeHTTP(capRec, capReq)
	if capRec.Code != http.StatusOK || !strings.Contains(capRec.Body.String(), `"selfHostedPrivateGeneration":true`) {
		t.Fatalf("self-hosted capability missing: %d %s", capRec.Code, capRec.Body.String())
	}
	if strings.Contains(capRec.Body.String(), "abcdefghijklmnopqrstuvwxyz123456") {
		t.Fatal("capabilities must never expose the self-hosted token")
	}

	missingHeader := selfHostedBrowserRequest(http.MethodPost, "/api/private/self-hosted/session",
		`{"token":"abcdefghijklmnopqrstuvwxyz123456"}`)
	missingHeader.Header.Del("X-NetWizard-Private-Request")
	missingHeaderRec := httptest.NewRecorder()
	server.Handler().ServeHTTP(missingHeaderRec, missingHeader)
	if missingHeaderRec.Code != http.StatusForbidden {
		t.Fatalf("same-origin login without private request header expected 403, got %d", missingHeaderRec.Code)
	}

	crossSite := selfHostedBrowserRequest(http.MethodPost, "/api/private/self-hosted/session",
		`{"token":"abcdefghijklmnopqrstuvwxyz123456"}`)
	crossSite.Header.Set("Origin", "https://evil.example")
	crossSite.Header.Set("Sec-Fetch-Site", "cross-site")
	crossRec := httptest.NewRecorder()
	server.Handler().ServeHTTP(crossRec, crossSite)
	if crossRec.Code != http.StatusForbidden {
		t.Fatalf("cross-site login expected 403, got %d", crossRec.Code)
	}

	wrong := selfHostedBrowserRequest(http.MethodPost, "/api/private/self-hosted/session", `{"token":"wrong-token"}`)
	wrongRec := httptest.NewRecorder()
	server.Handler().ServeHTTP(wrongRec, wrong)
	if wrongRec.Code != http.StatusUnauthorized {
		t.Fatalf("wrong token expected 401, got %d", wrongRec.Code)
	}

	cookie, csrf := loginSelfHostedPrivate(t, server)
	snapshot := `{"_schemaVersion":"3.50.0","projName":"Local","devices":[{"id":"r1","name":"R1","type":"router","kind":"router","vendorOs":"cisco_ios"}],"ports":[],"vlans":[],"subnets":[],"hosts":[],"links":[],"fwRules":[]}`

	noCSRF := selfHostedBrowserRequest(http.MethodPost, "/api/private/self-hosted/deployment-plan", `{"snapshot":`+snapshot+`}`)
	noCSRF.AddCookie(cookie)
	noCSRFRec := httptest.NewRecorder()
	server.Handler().ServeHTTP(noCSRFRec, noCSRF)
	if noCSRFRec.Code != http.StatusForbidden {
		t.Fatalf("generation without CSRF expected 403, got %d", noCSRFRec.Code)
	}

	req := selfHostedBrowserRequest(http.MethodPost, "/api/private/self-hosted/deployment-plan", `{"snapshot":`+snapshot+`}`)
	req.AddCookie(cookie)
	req.Header.Set("X-NetWizard-CSRF", csrf)
	rec := httptest.NewRecorder()
	server.Handler().ServeHTTP(rec, req)
	if rec.Code != http.StatusOK {
		t.Fatalf("generation expected 200, got %d: %s", rec.Code, rec.Body.String())
	}
	if rec.Header().Get("Cache-Control") != "no-store" {
		t.Fatalf("private generation must be no-store, got %q", rec.Header().Get("Cache-Control"))
	}
	if string(runner.project) != snapshot {
		t.Fatalf("worker must receive only validated snapshot, got %s", string(runner.project))
	}
	if !strings.Contains(rec.Body.String(), "configs/01-r1.cfg") || !strings.Contains(rec.Body.String(), "configure terminal") {
		t.Fatalf("expected private config artifact, got %s", rec.Body.String())
	}
}

func TestSelfHostedPrivateSessionSurvivesServerRestart(t *testing.T) {
	server1, _ := newSelfHostedPrivateTestServer(t)
	cookie, csrf := loginSelfHostedPrivate(t, server1)

	server2, runner2 := newSelfHostedPrivateTestServer(t)
	status := httptest.NewRequest(http.MethodGet, "/api/private/self-hosted/session", nil)
	status.AddCookie(cookie)
	statusRec := httptest.NewRecorder()
	server2.Handler().ServeHTTP(statusRec, status)
	if statusRec.Code != http.StatusOK {
		t.Fatalf("signed private session should survive restart, got %d: %s", statusRec.Code, statusRec.Body.String())
	}
	if !strings.Contains(statusRec.Body.String(), csrf) {
		t.Fatalf("restored session must preserve CSRF contract, got %s", statusRec.Body.String())
	}

	snapshot := `{"_schemaVersion":"3.50.0","projName":"Restart","devices":[{"id":"r1","name":"R1","type":"router","kind":"router","vendorOs":"cisco_ios"}],"ports":[],"vlans":[],"subnets":[],"hosts":[],"links":[],"fwRules":[]}`
	req := selfHostedBrowserRequest(http.MethodPost, "/api/private/self-hosted/deployment-plan", `{"snapshot":`+snapshot+`}`)
	req.AddCookie(cookie)
	req.Header.Set("X-NetWizard-CSRF", csrf)
	rec := httptest.NewRecorder()
	server2.Handler().ServeHTTP(rec, req)
	if rec.Code != http.StatusOK {
		t.Fatalf("generation with restored signed session expected 200, got %d: %s", rec.Code, rec.Body.String())
	}
	if string(runner2.project) != snapshot {
		t.Fatalf("restarted worker must receive snapshot, got %s", string(runner2.project))
	}
}

func TestSelfHostedPrivateSessionRejectsTamperingAndSecretRotation(t *testing.T) {
	server, _ := newSelfHostedPrivateTestServer(t)
	cookie, _ := loginSelfHostedPrivate(t, server)

	tampered := *cookie
	parts := strings.Split(tampered.Value, ".")
	if len(parts) != 2 || len(parts[1]) < 2 {
		t.Fatalf("unexpected signed cookie format: %q", tampered.Value)
	}
	first := parts[1][0]
	if first == 'A' {
		parts[1] = "B" + parts[1][1:]
	} else {
		parts[1] = "A" + parts[1][1:]
	}
	tampered.Value = strings.Join(parts, ".")
	status := httptest.NewRequest(http.MethodGet, "/api/private/self-hosted/session", nil)
	status.AddCookie(&tampered)
	statusRec := httptest.NewRecorder()
	server.Handler().ServeHTTP(statusRec, status)
	if statusRec.Code != http.StatusUnauthorized {
		t.Fatalf("tampered signed cookie expected 401, got %d", statusRec.Code)
	}

	rotated, _ := newSelfHostedPrivateTestServer(t)
	rotated.cfg.SelfHostedPrivateToken = "rotated-operator-token-1234567890"
	rotatedStatus := httptest.NewRequest(http.MethodGet, "/api/private/self-hosted/session", nil)
	rotatedStatus.AddCookie(cookie)
	rotatedRec := httptest.NewRecorder()
	rotated.Handler().ServeHTTP(rotatedRec, rotatedStatus)
	if rotatedRec.Code != http.StatusUnauthorized {
		t.Fatalf("secret rotation must invalidate old private cookie, got %d", rotatedRec.Code)
	}
}

func TestSelfHostedPrivateSessionRejectsNonCanonicalSignatureEncoding(t *testing.T) {
	server, _ := newSelfHostedPrivateTestServer(t)
	cookie, _ := loginSelfHostedPrivate(t, server)

	parts := strings.Split(cookie.Value, ".")
	if len(parts) != 2 {
		t.Fatalf("unexpected signed cookie format: %q", cookie.Value)
	}
	sig, err := base64.RawURLEncoding.DecodeString(parts[1])
	if err != nil {
		t.Fatalf("decode canonical signature: %v", err)
	}
	canonical := base64.RawURLEncoding.EncodeToString(sig)
	const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_"
	idx := strings.IndexByte(alphabet, canonical[len(canonical)-1])
	if idx < 0 || idx+1 >= len(alphabet) {
		t.Fatalf("unexpected final base64url symbol: %q", canonical[len(canonical)-1])
	}
	nonCanonical := canonical[:len(canonical)-1] + string(alphabet[idx+1])
	decoded, err := base64.RawURLEncoding.DecodeString(nonCanonical)
	if err != nil {
		t.Fatalf("decode non-canonical signature: %v", err)
	}
	if !hmac.Equal(decoded, sig) {
		t.Fatalf("test fixture must preserve decoded HMAC bytes")
	}

	tampered := *cookie
	tampered.Value = parts[0] + "." + nonCanonical
	status := httptest.NewRequest(http.MethodGet, "/api/private/self-hosted/session", nil)
	status.AddCookie(&tampered)
	statusRec := httptest.NewRecorder()
	server.Handler().ServeHTTP(statusRec, status)
	if statusRec.Code != http.StatusUnauthorized {
		t.Fatalf("non-canonical signed cookie expected 401, got %d", statusRec.Code)
	}
}

func TestSelfHostedPrivateGenerationRejectsInjectedOrInvalidSnapshot(t *testing.T) {
	server, _ := newSelfHostedPrivateTestServer(t)
	cookie, csrf := loginSelfHostedPrivate(t, server)

	injected := selfHostedBrowserRequest(http.MethodPost, "/api/private/self-hosted/deployment-plan",
		`{"snapshot":{"_schemaVersion":"3.50.0","devices":[]},"desiredConfigs":{"r1":"client override"}}`)
	injected.AddCookie(cookie)
	injected.Header.Set("X-NetWizard-CSRF", csrf)
	injectedRec := httptest.NewRecorder()
	server.Handler().ServeHTTP(injectedRec, injected)
	if injectedRec.Code != http.StatusBadRequest {
		t.Fatalf("unknown client config inputs expected 400, got %d: %s", injectedRec.Code, injectedRec.Body.String())
	}

	invalid := selfHostedBrowserRequest(http.MethodPost, "/api/private/self-hosted/deployment-plan",
		`{"snapshot":{"_schemaVersion":"3.49.0","devices":[]}}`)
	invalid.AddCookie(cookie)
	invalid.Header.Set("X-NetWizard-CSRF", csrf)
	invalidRec := httptest.NewRecorder()
	server.Handler().ServeHTTP(invalidRec, invalid)
	if invalidRec.Code != http.StatusBadRequest {
		t.Fatalf("invalid schema expected 400, got %d: %s", invalidRec.Code, invalidRec.Body.String())
	}
}

func TestSelfHostedPrivateLogoutInvalidatesCurrentBrowserSession(t *testing.T) {
	server, _ := newSelfHostedPrivateTestServer(t)
	cookie, csrf := loginSelfHostedPrivate(t, server)

	logout := selfHostedBrowserRequest(http.MethodPost, "/api/private/self-hosted/logout", "")
	logout.AddCookie(cookie)
	logout.Header.Set("X-NetWizard-CSRF", csrf)
	logoutRec := httptest.NewRecorder()
	server.Handler().ServeHTTP(logoutRec, logout)
	if logoutRec.Code != http.StatusNoContent {
		t.Fatalf("logout expected 204, got %d: %s", logoutRec.Code, logoutRec.Body.String())
	}

	status := httptest.NewRequest(http.MethodGet, "/api/private/self-hosted/session", nil)
	status.AddCookie(cookie)
	statusRec := httptest.NewRecorder()
	server.Handler().ServeHTTP(statusRec, status)
	if statusRec.Code != http.StatusUnauthorized {
		t.Fatalf("expired private session expected 401, got %d", statusRec.Code)
	}
}


func TestSelfHostedPrivateLoginRateLimit(t *testing.T) {
	server, _ := newSelfHostedPrivateTestServer(t)
	for attempt := 0; attempt < selfHostedPrivateLoginLimit; attempt++ {
		req := selfHostedBrowserRequest(http.MethodPost, "/api/private/self-hosted/session", `{"token":"wrong-token"}`)
		rec := httptest.NewRecorder()
		server.Handler().ServeHTTP(rec, req)
		if rec.Code != http.StatusUnauthorized {
			t.Fatalf("attempt %d expected 401, got %d", attempt+1, rec.Code)
		}
	}
	req := selfHostedBrowserRequest(http.MethodPost, "/api/private/self-hosted/session",
		`{"token":"abcdefghijklmnopqrstuvwxyz123456"}`)
	rec := httptest.NewRecorder()
	server.Handler().ServeHTTP(rec, req)
	if rec.Code != http.StatusTooManyRequests {
		t.Fatalf("rate-limited login expected 429, got %d: %s", rec.Code, rec.Body.String())
	}
	if rec.Header().Get("Retry-After") != "60" {
		t.Fatalf("expected Retry-After 60, got %q", rec.Header().Get("Retry-After"))
	}
}
