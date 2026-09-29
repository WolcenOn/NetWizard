package config

import (
	"testing"
	"time"
)

func TestFromEnvUsesRailwayPort(t *testing.T) {
	t.Setenv("NETWIZARD_ADDR", "")
	t.Setenv("PORT", "4321")
	t.Setenv("NETWIZARD_STATIC_DIR", "/srv/netwizard")

	cfg := FromEnv()
	if cfg.Addr != ":4321" {
		t.Fatalf("expected Railway PORT to produce :4321, got %q", cfg.Addr)
	}
	if cfg.StaticDir != "/srv/netwizard" {
		t.Fatalf("expected static dir to be preserved, got %q", cfg.StaticDir)
	}
}

func TestFromEnvPrefersExplicitAddr(t *testing.T) {
	t.Setenv("NETWIZARD_ADDR", "127.0.0.1:9090")
	t.Setenv("PORT", "4321")

	cfg := FromEnv()
	if cfg.Addr != "127.0.0.1:9090" {
		t.Fatalf("expected NETWIZARD_ADDR override, got %q", cfg.Addr)
	}
}

func TestFromEnvReadsSaaSSettings(t *testing.T) {
	t.Setenv("DATABASE_URL", "postgres://user:pass@db/netwizard")
	t.Setenv("NETWIZARD_OIDC_ISSUER_URL", "https://issuer.example")
	t.Setenv("NETWIZARD_OIDC_CLIENT_ID", "netwizard-web")
	t.Setenv("NETWIZARD_OIDC_REDIRECT_URL", "https://app.example/api/auth/callback")
	t.Setenv("NETWIZARD_MAX_PROJECT_BYTES", "123456")
	t.Setenv("NETWIZARD_PRIVATE_ROUTING_WORKER", "/app/private/routing-worker.cjs")

	cfg := FromEnv()
	if !cfg.DatabaseConfigured() {
		t.Fatal("expected database configuration to be detected")
	}
	if !cfg.AuthConfigPresent() {
		t.Fatal("expected OIDC configuration to be detected")
	}
	if cfg.MaxProjectBytes != 123456 {
		t.Fatalf("expected project limit 123456, got %d", cfg.MaxProjectBytes)
	}
	if cfg.PrivateRoutingWorker != "/app/private/routing-worker.cjs" {
		t.Fatalf("expected private routing worker path, got %q", cfg.PrivateRoutingWorker)
	}
}

func TestValidateRejectsIncompleteAndInsecureAuthConfiguration(t *testing.T) {
	cfg := Config{OIDCIssuerURL: "https://issuer.example", DatabaseURL: "postgres://db", SessionTTL: 12 * time.Hour}
	if err := cfg.Validate(); err == nil {
		t.Fatal("expected incomplete auth configuration to fail")
	}

	cfg = Config{
		DatabaseURL: "postgres://db",
		OIDCIssuerURL: "https://issuer.example",
		OIDCClientID: "client",
		OIDCRedirectURL: "https://app.example/api/auth/callback",
		SessionTTL: time.Hour,
		CookieSecure: false,
	}
	if err := cfg.Validate(); err == nil {
		t.Fatal("expected https auth with insecure cookie to fail")
	}

	cfg.CookieSecure = true
	if err := cfg.Validate(); err != nil {
		t.Fatalf("expected complete secure auth configuration, got %v", err)
	}
}

func TestValidateRequiresDatabaseForServerSideSessions(t *testing.T) {
	cfg := Config{
		OIDCIssuerURL: "https://issuer.example",
		OIDCClientID: "client",
		OIDCRedirectURL: "https://app.example/api/auth/callback",
		SessionTTL: time.Hour,
		CookieSecure: true,
	}
	if err := cfg.Validate(); err == nil {
		t.Fatal("expected auth without DATABASE_URL to fail")
	}
}

func TestValidatePrivateServicesRequireStrongKeyAndOIDC(t *testing.T) {
	cfg := Config{PrivateServiceKey: "short"}
	if err := cfg.Validate(); err == nil {
		t.Fatal("expected short private service key to fail")
	}

	cfg = Config{PrivateServiceKey: "12345678901234567890123456789012"}
	if err := cfg.Validate(); err == nil {
		t.Fatal("expected private services without OIDC to fail")
	}

	cfg = Config{
		DatabaseURL: "postgres://db",
		OIDCIssuerURL: "https://issuer.example",
		OIDCClientID: "client",
		OIDCRedirectURL: "https://app.example/api/auth/callback",
		SessionTTL: time.Hour,
		CookieSecure: true,
		PrivateServiceKey: "12345678901234567890123456789012",
	}
	if err := cfg.Validate(); err != nil {
		t.Fatalf("expected private services with secure OIDC config, got %v", err)
	}
}


func TestValidateAllowsExplicitSelfHostedPrivateMode(t *testing.T) {
	cfg := Config{
		SessionTTL: time.Hour,
		PrivateServiceKey: "12345678901234567890123456789012",
		PrivateDeploymentWorker: "/app/private/deployment-worker.cjs",
		SelfHostedPrivate: true,
		SelfHostedPrivateToken: "abcdefghijklmnopqrstuvwxyz123456",
	}
	if err := cfg.Validate(); err != nil {
		t.Fatalf("expected explicit self-hosted private mode to validate, got %v", err)
	}
	if !cfg.SelfHostedPrivateConfigured() {
		t.Fatal("expected self-hosted private mode to be detected")
	}
}

func TestValidateRejectsWeakOrAmbiguousSelfHostedPrivateMode(t *testing.T) {
	base := Config{
		SessionTTL: time.Hour,
		PrivateServiceKey: "12345678901234567890123456789012",
		PrivateDeploymentWorker: "/app/private/deployment-worker.cjs",
		SelfHostedPrivate: true,
		SelfHostedPrivateToken: "short",
	}
	if err := base.Validate(); err == nil {
		t.Fatal("expected weak self-hosted token to fail")
	}

	base.SelfHostedPrivateToken = base.PrivateServiceKey
	if err := base.Validate(); err == nil {
		t.Fatal("expected self-hosted access token equal to service key to fail")
	}

	base.SelfHostedPrivateToken = "abcdefghijklmnopqrstuvwxyz123456"
	base.OIDCIssuerURL = "https://issuer.example"
	if err := base.Validate(); err == nil {
		t.Fatal("expected self-hosted private mode combined with OIDC to fail")
	}

	base.OIDCIssuerURL = ""
	base.PrivateDeploymentWorker = ""
	if err := base.Validate(); err == nil {
		t.Fatal("expected self-hosted mode without deployment worker to fail")
	}
}

func TestFromEnvReadsSelfHostedPrivateSettings(t *testing.T) {
	t.Setenv("NETWIZARD_SELF_HOSTED_PRIVATE", "true")
	t.Setenv("NETWIZARD_SELF_HOSTED_PRIVATE_TOKEN", "abcdefghijklmnopqrstuvwxyz123456")
	cfg := FromEnv()
	if !cfg.SelfHostedPrivate {
		t.Fatal("expected self-hosted private env flag")
	}
	if cfg.SelfHostedPrivateToken != "abcdefghijklmnopqrstuvwxyz123456" {
		t.Fatalf("unexpected self-hosted token: %q", cfg.SelfHostedPrivateToken)
	}
}
