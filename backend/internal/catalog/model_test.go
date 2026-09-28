package catalog

import (
	"encoding/json"
	"testing"
)

func TestValidateDefinition(t *testing.T) {
	good:=json.RawMessage(`{"manufacturer":"ACME","model":"X48","kind":"switch","portGroups":[{"namePattern":"Gi{n}","count":48}]}`)
	if err:=ValidateDefinition(good);err!=nil{t.Fatalf("valid definition rejected: %v",err)}
	for _,raw:=range []json.RawMessage{
		json.RawMessage(`{"manufacturer":"","model":"X","kind":"switch"}`),
		json.RawMessage(`{"manufacturer":"ACME","model":"X","kind":""}`),
		json.RawMessage(`{"manufacturer":"ACME","model":"X","kind":"switch","portGroups":[{"namePattern":"","count":48}]}`),
	}{
		if err:=ValidateDefinition(raw);err==nil{t.Fatalf("invalid definition accepted: %s",string(raw))}
	}
	if got:=NormalizeID(" Global / ACME X48 Rev A ");got!="global-acme-x48-rev-a"{t.Fatalf("unexpected normalized id %q",got)}
}
