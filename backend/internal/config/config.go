package config

import (
	"os"
	"strconv"
	"strings"
)

// Config contiene los parámetros mínimos del backend NetWizard.
// En producción, AllowedOrigins debe configurarse explícitamente.
type Config struct {
	Addr            string
	AllowedOrigins  []string
	Version         string
	StaticDir       string
	DatabaseURL     string
	OIDCIssuerURL   string
	OIDCClientID    string
	MaxProjectBytes int64
}

func (c Config) DatabaseConfigured() bool {
	return strings.TrimSpace(c.DatabaseURL) != ""
}

func (c Config) AuthConfigPresent() bool {
	return strings.TrimSpace(c.OIDCIssuerURL) != "" && strings.TrimSpace(c.OIDCClientID) != ""
}

func FromEnv() Config {
	addr := strings.TrimSpace(os.Getenv("NETWIZARD_ADDR"))
	if addr == "" {
		port := strings.TrimSpace(os.Getenv("PORT"))
		if port != "" {
			addr = ":" + strings.TrimPrefix(port, ":")
		} else {
			addr = ":8080"
		}
	}

	originsRaw := strings.TrimSpace(os.Getenv("NETWIZARD_ALLOWED_ORIGINS"))
	var origins []string
	if originsRaw != "" {
		for _, part := range strings.Split(originsRaw, ",") {
			item := strings.TrimSpace(part)
			if item != "" {
				origins = append(origins, item)
			}
		}
	}

	version := strings.TrimSpace(os.Getenv("NETWIZARD_BACKEND_VERSION"))
	if version == "" {
		version = "netwizard-backend-v0.1"
	}

	staticDir := strings.TrimSpace(os.Getenv("NETWIZARD_STATIC_DIR"))
	databaseURL := strings.TrimSpace(os.Getenv("DATABASE_URL"))
	oidcIssuerURL := strings.TrimSpace(os.Getenv("NETWIZARD_OIDC_ISSUER_URL"))
	oidcClientID := strings.TrimSpace(os.Getenv("NETWIZARD_OIDC_CLIENT_ID"))
	maxProjectBytes := int64(10 * 1024 * 1024)
	if raw := strings.TrimSpace(os.Getenv("NETWIZARD_MAX_PROJECT_BYTES")); raw != "" {
		if parsed, err := strconv.ParseInt(raw, 10, 64); err == nil && parsed > 0 {
			maxProjectBytes = parsed
		}
	}

	return Config{
		Addr: addr, AllowedOrigins: origins, Version: version, StaticDir: staticDir,
		DatabaseURL: databaseURL, OIDCIssuerURL: oidcIssuerURL, OIDCClientID: oidcClientID,
		MaxProjectBytes: maxProjectBytes,
	}
}
