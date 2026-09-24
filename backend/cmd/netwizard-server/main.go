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

	"github.com/WolcenOn/NetWizard/backend/internal/config"
	"github.com/WolcenOn/NetWizard/backend/internal/httpapi"
	"github.com/WolcenOn/NetWizard/backend/internal/storage/postgres"
)

func main() {
	logger := slog.New(slog.NewTextHandler(os.Stdout, &slog.HandlerOptions{Level: slog.LevelInfo}))
	cfg := config.FromEnv()

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
		logger.Info("postgres project store ready")
	}
	if postgresStore != nil {
		defer postgresStore.Close()
	}

	api := httpapi.NewServerWithDependencies(cfg, logger, deps)
	srv := &http.Server{
		Addr:              cfg.Addr,
		Handler:           api.Handler(),
		ReadHeaderTimeout: 5 * time.Second,
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
