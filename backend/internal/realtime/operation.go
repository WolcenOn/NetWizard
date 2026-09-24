package realtime

import (
	"context"
	"encoding/json"
	"errors"
	"strings"
	"time"
)

type OperationKind string

const (
	OperationDeviceUpdate    OperationKind = "device.update"
	OperationPortUpdate      OperationKind = "port.update"
	OperationHostUpdate      OperationKind = "host.update"
	OperationHostAssignPort OperationKind = "host.assign_port"
	OperationVLANUpdate      OperationKind = "vlan.update"
	OperationLinkUpdate      OperationKind = "link.update"
	OperationLocationUpdate  OperationKind = "location.update"
	OperationFirewallUpdate  OperationKind = "firewall.update"
	OperationViewNodeMove    OperationKind = "view.node_move"
	OperationLayoutApply     OperationKind = "view.layout_apply"
)

// Operation representa una mutación solicitada por un cliente.
type Operation struct {
	OpID        string          `json:"opId"`
	ClientID    string          `json:"clientId"`
	BaseVersion int64           `json:"baseVersion"`
	Kind        OperationKind   `json:"kind"`
	EntityID    string          `json:"entityId,omitempty"`
	Payload     json.RawMessage `json:"payload"`
}

// OperationEnvelope es la operación ya aceptada y secuenciada por el servidor.
type OperationEnvelope struct {
	ProjectID string    `json:"projectId"`
	Seq       int64     `json:"seq"`
	Operation Operation `json:"operation"`
	CreatedBy string    `json:"createdBy"`
	CreatedAt time.Time `json:"createdAt"`
}

var (
	ErrOperationConflict = errors.New("operation base version conflict")
	ErrOperationInvalid  = errors.New("invalid operation")
)

func (op Operation) Validate(maxPayloadBytes int) error {
	if strings.TrimSpace(op.OpID) == "" || len(op.OpID) > 128 ||
		strings.TrimSpace(op.ClientID) == "" || len(op.ClientID) > 128 ||
		op.BaseVersion < 1 || !validOperationKind(op.Kind) ||
		len(op.Payload) == 0 || (maxPayloadBytes > 0 && len(op.Payload) > maxPayloadBytes) ||
		!json.Valid(op.Payload) {
		return ErrOperationInvalid
	}
	if len(op.EntityID) > 256 {
		return ErrOperationInvalid
	}
	return nil
}

func validOperationKind(kind OperationKind) bool {
	switch kind {
	case OperationDeviceUpdate, OperationPortUpdate, OperationHostUpdate,
		OperationHostAssignPort, OperationVLANUpdate, OperationLinkUpdate,
		OperationLocationUpdate, OperationFirewallUpdate, OperationViewNodeMove,
		OperationLayoutApply:
		return true
	default:
		return false
	}
}

type OperationStore interface {
	AppendOperation(ctx context.Context, projectID string, op Operation, actor string) (OperationEnvelope, error)
	OperationsSince(ctx context.Context, projectID string, sinceSeq int64, limit int) ([]OperationEnvelope, error)
	LatestOperationSeq(ctx context.Context, projectID string) (int64, error)
}

type Snapshot struct {
	ProjectID     string          `json:"projectId"`
	Version       int64           `json:"version"`
	SchemaVersion string          `json:"schemaVersion"`
	Snapshot      json.RawMessage `json:"snapshot"`
	UpdatedAt     time.Time       `json:"updatedAt"`
}

type SnapshotStore interface {
	LoadSnapshot(ctx context.Context, projectID string) (Snapshot, error)
	SaveSnapshot(ctx context.Context, snapshot Snapshot) error
}
