package httpapi

import (
	"encoding/json"
	"log/slog"
	"net/http"
	"strings"
	"time"

	"github.com/WolcenOn/NetWizard/backend/internal/auth"
	"github.com/WolcenOn/NetWizard/backend/internal/config"
	"github.com/WolcenOn/NetWizard/backend/internal/limits"
	"github.com/WolcenOn/NetWizard/backend/internal/projects"
	"github.com/WolcenOn/NetWizard/backend/internal/realtime"
	"github.com/WolcenOn/NetWizard/backend/internal/workspaces"
)

type Dependencies struct {
	Projects   projects.Store
	Workspaces workspaces.Store
	Access     auth.AccessStore
	Limits     limits.Store
	Auth       *auth.Service
	Operations realtime.OperationStore
	Realtime   *realtime.Hub
}

type Server struct {
	cfg        config.Config
	log        *slog.Logger
	mux        *http.ServeMux
	projects   projects.Store
	workspaces workspaces.Store
	authorizer auth.Authorizer
	auth       *auth.Service
	writeLimit limits.Store
	operations realtime.OperationStore
	realtime   *realtime.Hub
}

func NewServer(cfg config.Config, logger *slog.Logger) *Server {
	return NewServerWithDependencies(cfg, logger, Dependencies{})
}

func NewServerWithDependencies(cfg config.Config, logger *slog.Logger, deps Dependencies) *Server {
	if logger == nil {
		logger = slog.Default()
	}
	s := &Server{
		cfg: cfg, log: logger, mux: http.NewServeMux(),
		projects: deps.Projects, workspaces: deps.Workspaces,
		authorizer: auth.Authorizer{Store: deps.Access},
		auth: deps.Auth, writeLimit: deps.Limits,
		operations: deps.Operations, realtime: deps.Realtime,
	}
	s.routes()
	return s
}

func (s *Server) Handler() http.Handler {
	return s.securityHeaders(s.cors(s.requestLog(s.mux)))
}

func (s *Server) routes() {
	s.mux.HandleFunc("GET /api/health", s.handleHealth)
	s.mux.HandleFunc("GET /api/version", s.handleVersion)
	s.mux.HandleFunc("GET /api/capabilities", s.handleCapabilities)
	if s.auth != nil {
		s.mux.HandleFunc("GET /api/auth/login", s.handleAuthLogin)
		s.mux.HandleFunc("GET /api/auth/callback", s.handleAuthCallback)
		s.mux.Handle("POST /api/auth/logout", s.auth.Sessions.Require(s.requireCSRF(http.HandlerFunc(s.handleAuthLogout))))
		s.mux.Handle("GET /api/auth/me", s.auth.Sessions.Require(http.HandlerFunc(s.handleAuthMe)))
		if s.remoteWritesReady() {
			s.remoteRoutes()
		}
	}
	if s.cfg.StaticDir != "" {
		s.mux.Handle("/", s.staticHandler())
	}
}

func (s *Server) staticHandler() http.Handler {
	files := http.FileServer(http.Dir(s.cfg.StaticDir))
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodGet && r.Method != http.MethodHead {
			w.Header().Set("Allow", "GET, HEAD")
			http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
			return
		}
		if strings.HasPrefix(r.URL.Path, "/api/") {
			http.NotFound(w, r)
			return
		}
		if r.URL.Path == "/" {
			files.ServeHTTP(w, r)
			return
		}
		requested := strings.TrimPrefix(r.URL.Path, "/")
		if file, err := http.Dir(s.cfg.StaticDir).Open(requested); err == nil {
			_ = file.Close()
			files.ServeHTTP(w, r)
			return
		}
		fallback := r.Clone(r.Context())
		fallback.URL.Path = "/"
		files.ServeHTTP(w, fallback)
	})
}

func (s *Server) handleHealth(w http.ResponseWriter, r *http.Request) {
	writeJSON(w, http.StatusOK, map[string]any{
		"ok": true, "version": s.cfg.Version,
		"timestamp": time.Now().UTC().Format(time.RFC3339),
	})
}

func (s *Server) handleVersion(w http.ResponseWriter, r *http.Request) {
	writeJSON(w, http.StatusOK, map[string]any{
		"version": s.cfg.Version,
		"mode":    "saas-foundation",
	})
}

func (s *Server) handleCapabilities(w http.ResponseWriter, r *http.Request) {
	writeJSON(w, http.StatusOK, map[string]any{
		"schemaVersion":       projects.SupportedSchemaVersion,
		"localMode":           true,
		"databaseConfigured":  s.cfg.DatabaseConfigured(),
		"databaseReady":       s.projects != nil,
		"authConfigPresent":   s.cfg.AuthConfigPresent(),
		"authEnforced":        s.auth != nil,
		"remoteProjectWrites": s.remoteWritesReady(),
		"collaboration":       s.collaborationReady(),
		"maxProjectBytes":     s.cfg.MaxProjectBytes,
	})
}

func (s *Server) handleAuthLogin(w http.ResponseWriter, r *http.Request) {
	noStore(w)
	if len(r.URL.RawQuery) > 4096 {
		http.Error(w, "bad request", http.StatusBadRequest)
		return
	}
	returnTo := r.URL.Query().Get("returnTo")
	loginURL, err := s.auth.LoginURL(r.Context(), returnTo)
	if err != nil {
		s.log.Warn("oidc login rejected", "error", err)
		http.Error(w, "login unavailable", http.StatusBadRequest)
		return
	}
	http.Redirect(w, r, loginURL, http.StatusFound)
}

func (s *Server) handleAuthCallback(w http.ResponseWriter, r *http.Request) {
	noStore(w)
	if len(r.URL.RawQuery) > 8192 {
		http.Error(w, "bad request", http.StatusBadRequest)
		return
	}
	rawSession, session, returnTo, err := s.auth.Callback(
		r.Context(), r.URL.Query().Get("state"), r.URL.Query().Get("code"),
	)
	if err != nil {
		s.log.Warn("oidc callback rejected", "error", err)
		http.Error(w, "authentication failed", http.StatusUnauthorized)
		return
	}
	s.auth.Sessions.SetCookie(w, rawSession, session.ExpiresAt)
	if returnTo == "" {
		returnTo = "/"
	}
	http.Redirect(w, r, returnTo, http.StatusFound)
}

func (s *Server) handleAuthLogout(w http.ResponseWriter, r *http.Request) {
	noStore(w)
	principal, ok := auth.PrincipalFromContext(r.Context())
	if !ok {
		http.Error(w, "unauthorized", http.StatusUnauthorized)
		return
	}
	if err := s.auth.Sessions.Invalidate(r.Context(), principal.SessionID); err != nil {
		s.log.Error("session logout failed", "error", err)
		http.Error(w, "logout failed", http.StatusInternalServerError)
		return
	}
	s.auth.Sessions.ClearCookie(w)
	w.WriteHeader(http.StatusNoContent)
}

func (s *Server) handleAuthMe(w http.ResponseWriter, r *http.Request) {
	noStore(w)
	principal, ok := auth.PrincipalFromContext(r.Context())
	if !ok {
		http.Error(w, "unauthorized", http.StatusUnauthorized)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{
		"subject": principal.Subject,
		"email": principal.Email,
		"displayName": principal.DisplayName,
		"csrfToken": principal.CSRFToken,
	})
}

func noStore(w http.ResponseWriter) {
	w.Header().Set("Cache-Control", "no-store")
	w.Header().Set("Pragma", "no-cache")
}

func (s *Server) requestLog(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		start := time.Now()
		next.ServeHTTP(w, r)
		s.log.Info("http request", "method", r.Method, "path", r.URL.Path, "duration", time.Since(start).String())
	})
}

func (s *Server) securityHeaders(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("X-Content-Type-Options", "nosniff")
		w.Header().Set("X-Frame-Options", "DENY")
		w.Header().Set("Referrer-Policy", "no-referrer")
		next.ServeHTTP(w, r)
	})
}

func (s *Server) cors(next http.Handler) http.Handler {
	allowed := map[string]bool{}
	for _, origin := range s.cfg.AllowedOrigins {
		allowed[strings.TrimSpace(origin)] = true
	}
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		origin := r.Header.Get("Origin")
		if origin != "" && allowed[origin] {
			w.Header().Set("Access-Control-Allow-Origin", origin)
			w.Header().Set("Vary", "Origin")
			w.Header().Set("Access-Control-Allow-Credentials", "true")
			w.Header().Set("Access-Control-Allow-Methods", "GET,POST,PUT,PATCH,DELETE,OPTIONS")
			w.Header().Set("Access-Control-Allow-Headers", "Authorization,Content-Type,X-NetWizard-CSRF")
		}
		if r.Method == http.MethodOptions {
			w.WriteHeader(http.StatusNoContent)
			return
		}
		next.ServeHTTP(w, r)
	})
}

func writeJSON(w http.ResponseWriter, status int, value any) {
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(value)
}
