package config

import "testing"

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
