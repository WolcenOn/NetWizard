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
