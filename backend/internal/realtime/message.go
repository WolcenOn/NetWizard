package realtime

import (
	"encoding/json"
	"time"
)

// MessageType define el contrato de eventos del canal colaborativo.
type MessageType string

const (
	MessageHello              MessageType = "hello"
	MessagePing               MessageType = "ping"
	MessagePong               MessageType = "pong"
	MessageError              MessageType = "error"
	MessageResyncRequired     MessageType = "resync_required"
	MessageProjectJoin        MessageType = "project.join"
	MessageProjectLeave       MessageType = "project.leave"
	MessageProjectOperation   MessageType = "project.operation"
	MessageOperationAck       MessageType = "project.operation.ack"
	MessageOperationApplied   MessageType = "project.operation.applied"
	MessageOperationRejected  MessageType = "project.operation.rejected"
	MessagePresenceUpdate     MessageType = "presence.update"
	MessagePresenceCursor     MessageType = "presence.cursor"
	MessagePresenceSelection  MessageType = "presence.selection"
	MessagePresenceEditing    MessageType = "presence.editing"
	MessageViewPanZoom        MessageType = "view.pan_zoom"
	MessageViewNodeMove       MessageType = "view.node_move"
	MessageViewLayoutApply    MessageType = "view.layout_apply"
	MessageViewFilterChange   MessageType = "view.filter_change"
)

// Message es el sobre común para WebSocket.
type Message struct {
	Type      MessageType     `json:"type"`
	ProjectID string          `json:"projectId,omitempty"`
	ClientID  string          `json:"clientId,omitempty"`
	Seq       int64           `json:"seq,omitempty"`
	SentAt    time.Time       `json:"sentAt,omitempty"`
	Payload   json.RawMessage `json:"payload,omitempty"`
}

func NewMessage(t MessageType, projectID string, payload any) (Message, error) {
	raw, err := json.Marshal(payload)
	if err != nil {
		return Message{}, err
	}
	return Message{Type: t, ProjectID: projectID, SentAt: time.Now().UTC(), Payload: raw}, nil
}

// ErrorPayload evita exponer errores internos del servidor al cliente.
type ErrorPayload struct {
	Code    string `json:"code"`
	Message string `json:"message"`
}
