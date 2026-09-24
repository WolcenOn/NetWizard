package httpapi

import (
	"context"
	"encoding/json"
	"errors"
	"io"
	"net/http"
	"net/url"
	"strconv"
	"strings"
	"time"

	"github.com/WolcenOn/NetWizard/backend/internal/auth"
	"github.com/WolcenOn/NetWizard/backend/internal/projects"
	"github.com/WolcenOn/NetWizard/backend/internal/realtime"
)

func (s *Server) collaborationReady() bool {
	return s != nil && s.remoteWritesReady() && s.operations != nil && s.realtime != nil
}

func (s *Server) collaborationRoutes() {
	require := s.auth.Sessions.Require
	s.mux.Handle("GET /api/projects/{projectID}/revisions", require(http.HandlerFunc(s.handleProjectRevisions)))
	s.mux.Handle("GET /api/projects/{projectID}/operations", require(http.HandlerFunc(s.handleProjectOperations)))
	s.mux.Handle("GET /api/projects/{projectID}/ws", require(http.HandlerFunc(s.handleProjectWebSocket)))
}

func projectETag(project projects.Project, revision projects.Revision) string {
	return `"p:` + strconv.FormatInt(project.CurrentVersion, 10) + ":" + revision.Checksum + `"`
}

func (s *Server) handleProjectRevisions(w http.ResponseWriter, r *http.Request) {
	principal, ok := auth.PrincipalFromContext(r.Context())
	if !ok {
		http.Error(w, "unauthorized", http.StatusUnauthorized)
		return
	}
	projectID := strings.TrimSpace(r.PathValue("projectID"))
	if err := s.authorizer.RequireProjectRole(r.Context(), principal, projectID, auth.RoleViewer); err != nil {
		writeAuthzError(w, err)
		return
	}
	limit := 50
	if raw := strings.TrimSpace(r.URL.Query().Get("limit")); raw != "" {
		value, err := strconv.Atoi(raw)
		if err != nil || value < 1 || value > 200 {
			http.Error(w, "invalid limit", http.StatusBadRequest)
			return
		}
		limit = value
	}
	items, err := s.projects.ListRevisions(r.Context(), projectID, limit)
	if err != nil {
		s.writeProjectError(w, "list revisions", err)
		return
	}
	type revisionMeta struct {
		ProjectID     string    `json:"projectId"`
		Version       int64     `json:"version"`
		SchemaVersion string    `json:"schemaVersion"`
		Checksum      string    `json:"checksum"`
		CreatedBy     string    `json:"createdBy"`
		CreatedAt     time.Time `json:"createdAt"`
	}
	history := make([]revisionMeta, 0, len(items))
	for _, item := range items {
		history = append(history, revisionMeta{
			ProjectID: item.ProjectID, Version: item.Version, SchemaVersion: item.SchemaVersion,
			Checksum: item.Checksum, CreatedBy: item.CreatedBy, CreatedAt: item.CreatedAt,
		})
	}
	writeJSON(w, http.StatusOK, map[string]any{"revisions": history})
}

func (s *Server) handleProjectOperations(w http.ResponseWriter, r *http.Request) {
	principal, ok := auth.PrincipalFromContext(r.Context())
	if !ok {
		http.Error(w, "unauthorized", http.StatusUnauthorized)
		return
	}
	projectID := strings.TrimSpace(r.PathValue("projectID"))
	if err := s.authorizer.RequireProjectRole(r.Context(), principal, projectID, auth.RoleViewer); err != nil {
		writeAuthzError(w, err)
		return
	}
	since, err := parseNonNegativeInt64(r.URL.Query().Get("since"))
	if err != nil {
		http.Error(w, "invalid since", http.StatusBadRequest)
		return
	}
	items, err := s.operations.OperationsSince(r.Context(), projectID, since, 200)
	if err != nil {
		s.internalError(w, "replay operations", err)
		return
	}
	latest, err := s.operations.LatestOperationSeq(r.Context(), projectID)
	if err != nil {
		s.internalError(w, "latest operation seq", err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{
		"operations": items,
		"latestSeq":  latest,
	})
}

func parseNonNegativeInt64(raw string) (int64, error) {
	raw = strings.TrimSpace(raw)
	if raw == "" {
		return 0, nil
	}
	value, err := strconv.ParseInt(raw, 10, 64)
	if err != nil || value < 0 {
		return 0, errors.New("invalid non-negative integer")
	}
	return value, nil
}

func (s *Server) websocketOriginAllowed(r *http.Request) bool {
	origin := strings.TrimSpace(r.Header.Get("Origin"))
	if origin == "" {
		return true
	}
	u, err := url.Parse(origin)
	if err != nil || u.Scheme == "" || u.Host == "" {
		return false
	}
	if strings.EqualFold(u.Host, r.Host) {
		return true
	}
	for _, allowed := range s.cfg.AllowedOrigins {
		if origin == strings.TrimSpace(allowed) {
			return true
		}
	}
	return false
}

func (s *Server) handleProjectWebSocket(w http.ResponseWriter, r *http.Request) {
	principal, ok := auth.PrincipalFromContext(r.Context())
	if !ok {
		http.Error(w, "unauthorized", http.StatusUnauthorized)
		return
	}
	projectID := strings.TrimSpace(r.PathValue("projectID"))
	if err := s.authorizer.RequireProjectRole(r.Context(), principal, projectID, auth.RoleViewer); err != nil {
		writeAuthzError(w, err)
		return
	}
	if !s.websocketOriginAllowed(r) {
		http.Error(w, "forbidden origin", http.StatusForbidden)
		return
	}
	clientID := strings.TrimSpace(r.URL.Query().Get("clientId"))
	if clientID == "" || len(clientID) > 128 {
		http.Error(w, "invalid clientId", http.StatusBadRequest)
		return
	}
	sinceSeq, err := parseNonNegativeInt64(r.URL.Query().Get("sinceSeq"))
	if err != nil {
		http.Error(w, "invalid sinceSeq", http.StatusBadRequest)
		return
	}

	conn, err := upgradeWebSocket(w, r, clientID)
	if err != nil {
		http.Error(w, "websocket upgrade failed", http.StatusBadRequest)
		return
	}

	room := s.realtime.Room(projectID)
	room.Join(conn)
	defer func() {
		room.Leave(clientID)
		s.realtime.RemoveRoomIfEmpty(projectID)
		leave, _ := realtime.NewMessage(realtime.MessageProjectLeave, projectID, map[string]any{"clientId": clientID})
		room.Broadcast(context.Background(), leave, clientID)
	}()

	project, revision, err := s.projects.GetProject(r.Context(), projectID)
	if err != nil {
		_ = sendRealtimeError(conn, "project_unavailable", "project is unavailable")
		return
	}
	latestSeq, err := s.operations.LatestOperationSeq(r.Context(), projectID)
	if err != nil {
		_ = sendRealtimeError(conn, "operation_store_unavailable", "operation replay is unavailable")
		return
	}
	var backlog []realtime.OperationEnvelope
	if latestSeq-sinceSeq <= 1000 {
		backlog, err = s.operations.OperationsSince(r.Context(), projectID, sinceSeq, 1000)
		if err != nil {
			_ = sendRealtimeError(conn, "operation_store_unavailable", "operation replay is unavailable")
			return
		}
	}

	hello, _ := realtime.NewMessage(realtime.MessageHello, projectID, map[string]any{
		"clientId":       clientID,
		"currentVersion": project.CurrentVersion,
		"etag":           projectETag(project, revision),
		"latestSeq":      latestSeq,
		"presence":       room.Presence(),
	})
	hello.ClientID = clientID
	hello.Seq = latestSeq
	if err := conn.Send(r.Context(), hello); err != nil {
		return
	}
	if latestSeq-sinceSeq > 1000 {
		resync, _ := realtime.NewMessage(realtime.MessageResyncRequired, projectID, map[string]any{
			"reason": "replay_window_exceeded", "latestSeq": latestSeq,
		})
		resync.ClientID = clientID
		_ = conn.Send(r.Context(), resync)
		return
	}
	for _, env := range backlog {
		msg, _ := realtime.NewMessage(realtime.MessageOperationApplied, projectID, env)
		msg.Seq = env.Seq
		if err := conn.Send(r.Context(), msg); err != nil {
			return
		}
	}

	join, _ := realtime.NewMessage(realtime.MessageProjectJoin, projectID, map[string]any{
		"clientId": clientID, "userId": principal.UserID, "name": principal.DisplayName,
	})
	join.ClientID = clientID
	room.Broadcast(r.Context(), join, clientID)

	for {
		msg, err := conn.Read(r.Context())
		if errors.Is(err, io.EOF) {
			return
		}
		if err != nil {
			_ = sendRealtimeError(conn, "invalid_message", "invalid realtime message")
			return
		}
		if msg.ProjectID != "" && msg.ProjectID != projectID {
			_ = sendRealtimeError(conn, "project_mismatch", "message project does not match connection")
			continue
		}
		if msg.ClientID != "" && msg.ClientID != clientID {
			_ = sendRealtimeError(conn, "client_mismatch", "message client does not match connection")
			continue
		}
		switch msg.Type {
		case realtime.MessagePing:
			pong, _ := realtime.NewMessage(realtime.MessagePong, projectID, map[string]any{"time": time.Now().UTC()})
			pong.ClientID = clientID
			_ = conn.Send(r.Context(), pong)
		case realtime.MessagePresenceUpdate, realtime.MessagePresenceCursor, realtime.MessagePresenceSelection, realtime.MessagePresenceEditing:
			s.handlePresenceMessage(r.Context(), room, conn, principal, projectID, clientID, msg)
		case realtime.MessageProjectOperation:
			s.handleOperationMessage(r.Context(), room, conn, principal, projectID, clientID, msg)
		default:
			_ = sendRealtimeError(conn, "unsupported_message", "message type is not supported")
		}
	}
}

func (s *Server) handlePresenceMessage(ctx context.Context, room *realtime.Room, conn *wsConn, principal auth.Principal, projectID, clientID string, msg realtime.Message) {
	var incoming realtime.PresenceState
	if len(msg.Payload) > 0 {
		_ = json.Unmarshal(msg.Payload, &incoming)
	}
	incoming.ProjectID = projectID
	incoming.ClientID = clientID
	incoming.UserID = principal.UserID
	incoming.Name = principal.DisplayName
	incoming.UpdatedAt = time.Now().UTC()
	room.SetPresence(incoming)

	out, _ := realtime.NewMessage(realtime.MessagePresenceUpdate, projectID, incoming)
	out.ClientID = clientID
	room.Broadcast(ctx, out, clientID)
}

func (s *Server) handleOperationMessage(ctx context.Context, room *realtime.Room, conn *wsConn, principal auth.Principal, projectID, clientID string, msg realtime.Message) {
	if err := s.authorizer.RequireProjectRole(ctx, principal, projectID, auth.RoleEditor); err != nil {
		rejected, _ := realtime.NewMessage(realtime.MessageOperationRejected, projectID, realtime.ErrorPayload{Code: "forbidden", Message: "editor role required"})
		rejected.ClientID = clientID
		_ = conn.Send(ctx, rejected)
		return
	}
	var op realtime.Operation
	if err := json.Unmarshal(msg.Payload, &op); err != nil {
		_ = sendRealtimeError(conn, "invalid_operation", "operation payload is invalid")
		return
	}
	if op.ClientID == "" {
		op.ClientID = clientID
	}
	if op.ClientID != clientID {
		_ = sendRealtimeError(conn, "client_mismatch", "operation client does not match connection")
		return
	}
	if err := op.Validate(64 * 1024); err != nil {
		_ = sendRealtimeError(conn, "invalid_operation", "operation is invalid")
		return
	}
	allowed, err := s.writeLimit.AllowWrite(ctx, principal.UserID, time.Now().UTC(), 60, time.Minute)
	if err != nil {
		_ = sendRealtimeError(conn, "rate_limit_unavailable", "write limit is unavailable")
		return
	}
	if !allowed {
		rejected, _ := realtime.NewMessage(realtime.MessageOperationRejected, projectID, realtime.ErrorPayload{Code: "rate_limited", Message: "write rate limit exceeded"})
		rejected.ClientID = clientID
		_ = conn.Send(ctx, rejected)
		return
	}
	env, err := s.operations.AppendOperation(ctx, projectID, op, principal.Subject)
	if errors.Is(err, realtime.ErrOperationConflict) {
		rejected, _ := realtime.NewMessage(realtime.MessageOperationRejected, projectID, realtime.ErrorPayload{Code: "base_version_conflict", Message: "project version changed; resync required"})
		rejected.ClientID = clientID
		_ = conn.Send(ctx, rejected)
		resync, _ := realtime.NewMessage(realtime.MessageResyncRequired, projectID, map[string]any{"reason": "base_version_conflict"})
		resync.ClientID = clientID
		_ = conn.Send(ctx, resync)
		return
	}
	if errors.Is(err, realtime.ErrOperationInvalid) {
		_ = sendRealtimeError(conn, "invalid_operation", "operation is invalid")
		return
	}
	if err != nil {
		_ = sendRealtimeError(conn, "operation_store_unavailable", "operation could not be persisted")
		return
	}

	ack, _ := realtime.NewMessage(realtime.MessageOperationAck, projectID, env)
	ack.ClientID = clientID
	ack.Seq = env.Seq
	_ = conn.Send(ctx, ack)

	applied, _ := realtime.NewMessage(realtime.MessageOperationApplied, projectID, env)
	applied.ClientID = clientID
	applied.Seq = env.Seq
	room.Broadcast(ctx, applied, clientID)
}

func sendRealtimeError(conn *wsConn, code, message string) error {
	msg, _ := realtime.NewMessage(realtime.MessageError, "", realtime.ErrorPayload{Code: code, Message: message})
	return conn.Send(context.Background(), msg)
}
