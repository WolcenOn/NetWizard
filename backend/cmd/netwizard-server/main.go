package main

import (
	"context"
	"errors"
	"log/slog"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/WolcenOn/NetWizard/backend/internal/auth"
	"github.com/WolcenOn/NetWizard/backend/internal/config"
	"github.com/WolcenOn/NetWizard/backend/internal/httpapi"
	"github.com/WolcenOn/NetWizard/backend/internal/privateservices"
	"github.com/WolcenOn/NetWizard/backend/internal/realtime"
	"github.com/WolcenOn/NetWizard/backend/internal/storage/postgres"
)

func main() {
	logger := slog.New(slog.NewTextHandler(os.Stdout, &slog.HandlerOptions{Level: slog.LevelInfo}))
	cfg := config.FromEnv()
	if err := cfg.Validate(); err != nil {
		logger.Error("invalid backend configuration", "error", err)
		os.Exit(1)
	}

	deps := httpapi.Dependencies{}
	var postgresStore *postgres.Store
	if cfg.DatabaseConfigured() {
		startupCtx, cancel := context.WithTimeout(context.Background(), 20*time.Second)
		store, err := postgres.Open(startupCtx, cfg.DatabaseURL, cfg.MaxProjectBytes)
		cancel()
		if err != nil {
			logger.Error("postgres startup failed", "error", err)
			os.Exit(1)
		}
		postgresStore = store
		deps.Projects = store
		deps.Workspaces = store
		deps.Access = store
		deps.Limits = store
		deps.Operations = store
		deps.Realtime = realtime.NewHub()
		logger.Info("postgres project/workspace store ready")
	}
	if postgresStore != nil {
		defer postgresStore.Close()
	}

	if cfg.PrivateServicesConfigured() {
		service, err := privateservices.New([]byte(cfg.PrivateServiceKey))
		if err != nil {
			logger.Error("private services startup failed", "error", err)
			os.Exit(1)
		}
		deps.PrivateServices = service
		logger.Info("private services configured")
	}

	if cfg.AuthRequested() {
		sessions := &auth.SessionManager{
			Store: postgresStore,
			Cookie: auth.CookieConfig{
				Name: cfg.SessionCookieName,
				Secure: cfg.CookieSecure,
				MaxAge: cfg.SessionTTL,
			},
		}
		startupCtx, cancel := context.WithTimeout(context.Background(), cfg.AuthHTTPTimeout)
		service, err := auth.NewOIDCService(startupCtx, auth.OIDCConfig{
			IssuerURL: cfg.OIDCIssuerURL,
			ClientID: cfg.OIDCClientID,
			ClientSecret: cfg.OIDCClientSecret,
			RedirectURL: cfg.OIDCRedirectURL,
			SessionTTL: cfg.SessionTTL,
			HTTPTimeout: cfg.AuthHTTPTimeout,
		}, sessions)
		cancel()
		if err != nil {
			logger.Error("oidc startup failed", "error", err)
			os.Exit(1)
		}
		deps.Auth = service
		logger.Info("oidc authentication ready", "issuer", cfg.OIDCIssuerURL)
	}

	api := httpapi.NewServerWithDependencies(cfg, logger, deps)
	srv := &http.Server{
		Addr:              cfg.Addr,
		Handler:           api.Handler(),
		ReadHeaderTimeout: 5 * time.Second,
		ReadTimeout:       15 * time.Second,
		WriteTimeout:      30 * time.Second,
		IdleTimeout:       90 * time.Second,
	}

	go func() {
		logger.Info("starting NetWizard backend", "addr", cfg.Addr, "version", cfg.Version)
		if err := srv.ListenAndServe(); err != nil && !errors.Is(err, http.ErrServerClosed) {
			logger.Error("server failed", "error", err)
			os.Exit(1)
		}
	}()

	ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer stop()
	<-ctx.Done()

	shutdownCtx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()
	logger.Info("shutting down NetWizard backend")
	if err := srv.Shutdown(shutdownCtx); err != nil {
		logger.Error("graceful shutdown failed", "error", err)
		os.Exit(1)
	}
}
