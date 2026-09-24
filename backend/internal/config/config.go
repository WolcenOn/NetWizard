package config

import (
	"fmt"
	"net/url"
	"os"
	"strconv"
	"strings"
	"time"
)

// Config contiene la configuración del backend NetWizard.
type Config struct {
	Addr            string
	AllowedOrigins  []string
	Version         string
	StaticDir       string
	DatabaseURL     string
	OIDCIssuerURL   string
	OIDCClientID    string
	OIDCClientSecret string
	OIDCRedirectURL string
	SessionCookieName string
	SessionTTL      time.Duration
	CookieSecure    bool
	AuthHTTPTimeout time.Duration
	MaxProjectBytes int64
	PrivateServiceKey string
}

func (c Config) DatabaseConfigured() bool {
	return strings.TrimSpace(c.DatabaseURL) != ""
}

// AuthRequested distingue una configuración OIDC intencionada de un backend puramente local.
func (c Config) AuthRequested() bool {
	return strings.TrimSpace(c.OIDCIssuerURL) != "" ||
		strings.TrimSpace(c.OIDCClientID) != "" ||
		strings.TrimSpace(c.OIDCClientSecret) != "" ||
		strings.TrimSpace(c.OIDCRedirectURL) != ""
}

// AuthConfigPresent solo es true cuando existe la configuración esencial completa.
func (c Config) AuthConfigPresent() bool {
	return strings.TrimSpace(c.OIDCIssuerURL) != "" &&
		strings.TrimSpace(c.OIDCClientID) != "" &&
		strings.TrimSpace(c.OIDCRedirectURL) != ""
}

func (c Config) PrivateServicesConfigured() bool {
	return strings.TrimSpace(c.PrivateServiceKey) != ""
}

func (c Config) Validate() error {
	if c.PrivateServicesConfigured() && len([]byte(c.PrivateServiceKey)) < 32 {
		return fmt.Errorf("NETWIZARD_PRIVATE_SERVICE_KEY must be at least 32 bytes")
	}
	if c.PrivateServicesConfigured() && !c.AuthRequested() {
		return fmt.Errorf("private services require OIDC authentication configuration")
	}
	if !c.AuthRequested() {
		return nil
	}
	if !c.AuthConfigPresent() {
		return fmt.Errorf("auth configuration is incomplete: issuer, client id and redirect URL are required")
	}
	if !c.DatabaseConfigured() {
		return fmt.Errorf("auth requires DATABASE_URL for server-side login state and sessions")
	}
	redirect, err := url.Parse(c.OIDCRedirectURL)
	if err != nil || redirect.Scheme == "" || redirect.Host == "" {
		return fmt.Errorf("NETWIZARD_OIDC_REDIRECT_URL must be an absolute URL")
	}
	host := strings.ToLower(redirect.Hostname())
	if redirect.Scheme != "https" && host != "localhost" && host != "127.0.0.1" && host != "::1" {
		return fmt.Errorf("OIDC redirect URL must use https outside localhost")
	}
	if redirect.Scheme == "https" && !c.CookieSecure {
		return fmt.Errorf("secure OIDC redirect requires secure session cookies")
	}
	if c.SessionTTL <= 0 {
		return fmt.Errorf("session TTL must be positive")
	}
	return nil
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
		version = "netwizard-backend-v0.3"
	}

	staticDir := strings.TrimSpace(os.Getenv("NETWIZARD_STATIC_DIR"))
	databaseURL := strings.TrimSpace(os.Getenv("DATABASE_URL"))
	oidcIssuerURL := strings.TrimRight(strings.TrimSpace(os.Getenv("NETWIZARD_OIDC_ISSUER_URL")), "/")
	oidcClientID := strings.TrimSpace(os.Getenv("NETWIZARD_OIDC_CLIENT_ID"))
	oidcClientSecret := strings.TrimSpace(os.Getenv("NETWIZARD_OIDC_CLIENT_SECRET"))
	oidcRedirectURL := strings.TrimSpace(os.Getenv("NETWIZARD_OIDC_REDIRECT_URL"))
	privateServiceKey := strings.TrimSpace(os.Getenv("NETWIZARD_PRIVATE_SERVICE_KEY"))

	sessionCookieName := strings.TrimSpace(os.Getenv("NETWIZARD_SESSION_COOKIE_NAME"))
	if sessionCookieName == "" {
		sessionCookieName = "netwizard_session"
	}
	sessionTTL := 12 * time.Hour
	if raw := strings.TrimSpace(os.Getenv("NETWIZARD_SESSION_TTL")); raw != "" {
		if parsed, err := time.ParseDuration(raw); err == nil && parsed > 0 {
			sessionTTL = parsed
		}
	}
	authHTTPTimeout := 10 * time.Second
	if raw := strings.TrimSpace(os.Getenv("NETWIZARD_AUTH_HTTP_TIMEOUT")); raw != "" {
		if parsed, err := time.ParseDuration(raw); err == nil && parsed > 0 {
			authHTTPTimeout = parsed
		}
	}

	cookieSecure := false
	if u, err := url.Parse(oidcRedirectURL); err == nil && strings.EqualFold(u.Scheme, "https") {
		cookieSecure = true
	}
	if raw := strings.TrimSpace(os.Getenv("NETWIZARD_COOKIE_SECURE")); raw != "" {
		if parsed, err := strconv.ParseBool(raw); err == nil {
			cookieSecure = parsed
		}
	}

	maxProjectBytes := int64(10 * 1024 * 1024)
	if raw := strings.TrimSpace(os.Getenv("NETWIZARD_MAX_PROJECT_BYTES")); raw != "" {
		if parsed, err := strconv.ParseInt(raw, 10, 64); err == nil && parsed > 0 {
			maxProjectBytes = parsed
		}
	}

	return Config{
		Addr: addr, AllowedOrigins: origins, Version: version, StaticDir: staticDir,
		DatabaseURL: databaseURL,
		OIDCIssuerURL: oidcIssuerURL, OIDCClientID: oidcClientID,
		OIDCClientSecret: oidcClientSecret, OIDCRedirectURL: oidcRedirectURL,
		SessionCookieName: sessionCookieName, SessionTTL: sessionTTL,
		CookieSecure: cookieSecure, AuthHTTPTimeout: authHTTPTimeout,
		MaxProjectBytes: maxProjectBytes, PrivateServiceKey: privateServiceKey,
	}
}
