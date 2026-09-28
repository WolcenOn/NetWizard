package httpapi

import (
	"encoding/json"
	"errors"
	"net/http"
	"strings"

	"github.com/WolcenOn/NetWizard/backend/internal/auth"
	"github.com/WolcenOn/NetWizard/backend/internal/catalog"
)

func (s *Server) isGlobalAdmin(principal auth.Principal) bool {
	subject:=strings.TrimSpace(principal.Subject)
	if subject=="" { return false }
	for _,allowed:=range s.cfg.AdminSubjects {
		if strings.TrimSpace(allowed)==subject { return true }
	}
	return false
}

func (s *Server) requireGlobalAdmin(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter,r *http.Request){
		principal,ok:=auth.PrincipalFromContext(r.Context())
		if !ok { http.Error(w,"unauthorized",http.StatusUnauthorized); return }
		if !s.isGlobalAdmin(principal) { http.Error(w,"forbidden",http.StatusForbidden); return }
		next.ServeHTTP(w,r)
	})
}

func (s *Server) handleListGlobalDeviceModels(w http.ResponseWriter,r *http.Request){
	items,err:=s.catalog.ListDeviceModels(r.Context())
	if err!=nil { s.internalError(w,"list global device models",err); return }
	writeJSON(w,http.StatusOK,map[string]any{"models":items})
}

func (s *Server) handleGetGlobalDeviceModel(w http.ResponseWriter,r *http.Request){
	item,err:=s.catalog.GetDeviceModel(r.Context(),strings.TrimSpace(r.PathValue("modelID")))
	if errors.Is(err,catalog.ErrNotFound){http.Error(w,"device model not found",http.StatusNotFound);return}
	if err!=nil{s.internalError(w,"get global device model",err);return}
	writeJSON(w,http.StatusOK,item)
}

func (s *Server) handleUpsertGlobalDeviceModel(w http.ResponseWriter,r *http.Request){
	principal,_:=auth.PrincipalFromContext(r.Context())
	id:=catalog.NormalizeID(r.PathValue("modelID"))
	if id=="" { http.Error(w,"invalid model id",http.StatusBadRequest); return }
	var body struct{ Definition json.RawMessage `json:"definition"` }
	if err:=decodeJSON(w,r,&body,512*1024);err!=nil{writeDecodeError(w,err);return}
	if err:=catalog.ValidateDefinition(body.Definition);err!=nil{http.Error(w,err.Error(),http.StatusBadRequest);return}
	var def struct {
		Manufacturer string `json:"manufacturer"`
		Model string `json:"model"`
		SKU string `json:"sku"`
		Revision string `json:"revision"`
		Kind string `json:"kind"`
	}
	if err:=json.Unmarshal(body.Definition,&def);err!=nil{http.Error(w,"invalid model definition",http.StatusBadRequest);return}
	item,err:=s.catalog.UpsertDeviceModel(r.Context(),catalog.UpsertInput{
		ID:id,Manufacturer:def.Manufacturer,Model:def.Model,SKU:def.SKU,Revision:def.Revision,Kind:def.Kind,
		Definition:body.Definition,Actor:principal.Subject,
	})
	if err!=nil{http.Error(w,"invalid or conflicting device model",http.StatusBadRequest);return}
	writeJSON(w,http.StatusOK,item)
}
