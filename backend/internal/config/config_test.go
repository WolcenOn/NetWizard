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
