package config

import (
	"os"
	"strings"
)

// Config contiene los parámetros mínimos del backend NetWizard.
// En producción, AllowedOrigins debe configurarse explícitamente.
type Config struct {
	Addr           string
	AllowedOrigins []string
	Version        string
	StaticDir      string
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

	return Config{Addr: addr, AllowedOrigins: origins, Version: version, StaticDir: staticDir}
}
