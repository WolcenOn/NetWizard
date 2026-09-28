package httpapi

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/WolcenOn/NetWizard/backend/internal/auth"
	"github.com/WolcenOn/NetWizard/backend/internal/config"
)

func TestGlobalAdminAuthorization(t *testing.T) {
	s:=&Server{cfg:config.Config{AdminSubjects:[]string{"admin-sub","other-admin"}}}
	if !s.isGlobalAdmin(auth.Principal{Subject:"admin-sub"}) { t.Fatal("configured subject must be admin") }
	if s.isGlobalAdmin(auth.Principal{Subject:"user-sub"}) { t.Fatal("unconfigured subject must not be admin") }

	next:=http.HandlerFunc(func(w http.ResponseWriter,r *http.Request){w.WriteHeader(http.StatusNoContent)})
	req:=httptest.NewRequest(http.MethodPut,"/api/device-models/global/global-acme-x48",nil)

	rec:=httptest.NewRecorder()
	s.requireGlobalAdmin(next).ServeHTTP(rec,req.WithContext(auth.WithPrincipal(req.Context(),auth.Principal{UserID:"usr1",Subject:"user-sub"})))
	if rec.Code!=http.StatusForbidden { t.Fatalf("non-admin expected 403, got %d",rec.Code) }

	rec=httptest.NewRecorder()
	s.requireGlobalAdmin(next).ServeHTTP(rec,req.WithContext(auth.WithPrincipal(req.Context(),auth.Principal{UserID:"usr1",Subject:"admin-sub"})))
	if rec.Code!=http.StatusNoContent { t.Fatalf("admin expected 204, got %d",rec.Code) }
}
