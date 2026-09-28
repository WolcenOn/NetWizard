package postgres

import (
	"context"
	"database/sql"
	"encoding/json"
	"errors"
	"fmt"
	"strings"

	"github.com/WolcenOn/NetWizard/backend/internal/catalog"
)

func (s *Store) ListDeviceModels(ctx context.Context) ([]catalog.DeviceModel,error) {
	rows,err:=s.db.QueryContext(ctx,`
SELECT id, manufacturer, model, sku, revision, kind, definition, validated,
       created_by_subject, created_at, updated_at
FROM global_device_models
WHERE validated = TRUE
ORDER BY LOWER(manufacturer), LOWER(model), id
`)
	if err!=nil { return nil,fmt.Errorf("postgres: list global device models: %w",err) }
	defer rows.Close()
	out:=[]catalog.DeviceModel{}
	for rows.Next(){
		var m catalog.DeviceModel; var raw []byte
		if err:=rows.Scan(&m.ID,&m.Manufacturer,&m.Model,&m.SKU,&m.Revision,&m.Kind,&raw,&m.Validated,&m.CreatedBy,&m.CreatedAt,&m.UpdatedAt);err!=nil{return nil,err}
		m.Definition=append(json.RawMessage(nil),raw...); out=append(out,m)
	}
	return out,rows.Err()
}

func (s *Store) GetDeviceModel(ctx context.Context,id string)(catalog.DeviceModel,error){
	var m catalog.DeviceModel; var raw []byte
	err:=s.db.QueryRowContext(ctx,`
SELECT id, manufacturer, model, sku, revision, kind, definition, validated,
       created_by_subject, created_at, updated_at
FROM global_device_models WHERE id=$1 AND validated=TRUE
`,strings.TrimSpace(id)).Scan(&m.ID,&m.Manufacturer,&m.Model,&m.SKU,&m.Revision,&m.Kind,&raw,&m.Validated,&m.CreatedBy,&m.CreatedAt,&m.UpdatedAt)
	if errors.Is(err,sql.ErrNoRows){return catalog.DeviceModel{},catalog.ErrNotFound}
	if err!=nil{return catalog.DeviceModel{},fmt.Errorf("postgres: get global device model: %w",err)}
	m.Definition=append(json.RawMessage(nil),raw...); return m,nil
}

func (s *Store) UpsertDeviceModel(ctx context.Context,input catalog.UpsertInput)(catalog.DeviceModel,error){
	input.ID=catalog.NormalizeID(input.ID); input.Manufacturer=strings.TrimSpace(input.Manufacturer); input.Model=strings.TrimSpace(input.Model)
	input.SKU=strings.TrimSpace(input.SKU); input.Revision=strings.TrimSpace(input.Revision); input.Kind=strings.TrimSpace(input.Kind); input.Actor=strings.TrimSpace(input.Actor)
	if input.ID==""||input.Manufacturer==""||input.Model==""||input.Kind==""||input.Actor==""{return catalog.DeviceModel{},errors.New("postgres: catalog id, identity, kind and actor are required")}
	if err:=catalog.ValidateDefinition(input.Definition);err!=nil{return catalog.DeviceModel{},err}
	var m catalog.DeviceModel; var raw []byte
	err:=s.db.QueryRowContext(ctx,`
INSERT INTO global_device_models(id,manufacturer,model,sku,revision,kind,definition,validated,created_by_subject,updated_by_subject)
VALUES($1,$2,$3,$4,$5,$6,$7::jsonb,TRUE,$8,$8)
ON CONFLICT(id) DO UPDATE SET
 manufacturer=EXCLUDED.manufacturer, model=EXCLUDED.model, sku=EXCLUDED.sku, revision=EXCLUDED.revision,
 kind=EXCLUDED.kind, definition=EXCLUDED.definition, validated=TRUE, updated_by_subject=EXCLUDED.updated_by_subject, updated_at=NOW()
RETURNING id,manufacturer,model,sku,revision,kind,definition,validated,created_by_subject,created_at,updated_at
`,input.ID,input.Manufacturer,input.Model,input.SKU,input.Revision,input.Kind,string(input.Definition),input.Actor).
	Scan(&m.ID,&m.Manufacturer,&m.Model,&m.SKU,&m.Revision,&m.Kind,&raw,&m.Validated,&m.CreatedBy,&m.CreatedAt,&m.UpdatedAt)
	if err!=nil{return catalog.DeviceModel{},fmt.Errorf("postgres: upsert global device model: %w",err)}
	m.Definition=append(json.RawMessage(nil),raw...)
	return m,nil
}
