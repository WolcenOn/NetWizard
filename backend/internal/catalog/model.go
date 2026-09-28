package catalog

import (
	"context"
	"encoding/json"
	"errors"
	"strings"
	"time"
)

var ErrNotFound = errors.New("catalog model not found")

type DeviceModel struct {
	ID string `json:"id"`
	Manufacturer string `json:"manufacturer"`
	Model string `json:"model"`
	SKU string `json:"sku,omitempty"`
	Revision string `json:"revision,omitempty"`
	Kind string `json:"kind"`
	Definition json.RawMessage `json:"definition"`
	Validated bool `json:"validated"`
	CreatedBy string `json:"createdBy"`
	CreatedAt time.Time `json:"createdAt"`
	UpdatedAt time.Time `json:"updatedAt"`
}

type UpsertInput struct {
	ID string
	Manufacturer string
	Model string
	SKU string
	Revision string
	Kind string
	Definition json.RawMessage
	Actor string
}

type Store interface {
	ListDeviceModels(context.Context) ([]DeviceModel,error)
	GetDeviceModel(context.Context,string) (DeviceModel,error)
	UpsertDeviceModel(context.Context,UpsertInput) (DeviceModel,error)
}

func NormalizeID(v string) string {
	v=strings.ToLower(strings.TrimSpace(v))
	var b strings.Builder
	lastDash:=false
	for _,r:=range v {
		ok:=(r>='a'&&r<='z')||(r>='0'&&r<='9')
		if ok { b.WriteRune(r); lastDash=false } else if !lastDash && b.Len()>0 { b.WriteByte('-'); lastDash=true }
	}
	return strings.Trim(b.String(),"-")
}

func ValidateDefinition(raw json.RawMessage) error {
	if len(raw)==0 || !json.Valid(raw) { return errors.New("invalid model definition") }
	var m map[string]any
	if err:=json.Unmarshal(raw,&m); err!=nil { return errors.New("invalid model definition") }
	for _,k:=range []string{"manufacturer","model","kind"} {
		if strings.TrimSpace(asString(m[k]))=="" { return errors.New(k+" is required") }
	}
	if groups,ok:=m["portGroups"].([]any); ok {
		for _,g:=range groups {
			obj,ok:=g.(map[string]any); if !ok { return errors.New("invalid port group") }
			if strings.TrimSpace(asString(obj["namePattern"]))=="" { return errors.New("port group namePattern is required") }
			if n,ok:=obj["count"].(float64); !ok || n<0 || n>10000 { return errors.New("invalid port group count") }
		}
	}
	return nil
}

func asString(v any) string { s,_:=v.(string); return s }
