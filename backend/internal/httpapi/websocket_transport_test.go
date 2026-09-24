package httpapi

import (
	"bufio"
	"encoding/binary"
	"encoding/json"
	"fmt"
	"io"
	"net"
	"net/http"
	"net/http/httptest"
	"net/url"
	"strings"
	"testing"

	"github.com/WolcenOn/NetWizard/backend/internal/realtime"
)

func dialTestWebSocket(t *testing.T, serverURL, path, session string) (net.Conn, *bufio.Reader) {
	t.Helper()
	u, err := url.Parse(serverURL)
	if err != nil {
		t.Fatal(err)
	}
	conn, err := net.Dial("tcp", u.Host)
	if err != nil {
		t.Fatal(err)
	}
	request := fmt.Sprintf(
		"GET %s HTTP/1.1\r\nHost: %s\r\nOrigin: %s://%s\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Version: 13\r\nSec-WebSocket-Key: dGhlIHNhbXBsZSBub25jZQ==\r\nCookie: netwizard_session=%s\r\n\r\n",
		path, u.Host, u.Scheme, u.Host, session,
	)
	if _, err := io.WriteString(conn, request); err != nil {
		_ = conn.Close()
		t.Fatal(err)
	}
	reader := bufio.NewReader(conn)
	status, err := reader.ReadString('\n')
	if err != nil {
		_ = conn.Close()
		t.Fatal(err)
	}
	if !strings.Contains(status, "101") {
		rest, _ := io.ReadAll(reader)
		_ = conn.Close()
		t.Fatalf("websocket upgrade failed: %s%s", status, string(rest))
	}
	for {
		line, err := reader.ReadString('\n')
		if err != nil {
			_ = conn.Close()
			t.Fatal(err)
		}
		if line == "\r\n" {
			break
		}
	}
	return conn, reader
}

func readServerWebSocketMessage(t *testing.T, reader *bufio.Reader) realtime.Message {
	t.Helper()
	header := make([]byte, 2)
	if _, err := io.ReadFull(reader, header); err != nil {
		t.Fatal(err)
	}
	if header[1]&0x80 != 0 {
		t.Fatal("server frame must not be masked")
	}
	opcode := header[0] & 0x0F
	if opcode != 0x1 {
		t.Fatalf("expected text frame, got opcode %d", opcode)
	}
	length := uint64(header[1] & 0x7F)
	switch length {
	case 126:
		var ext [2]byte
		if _, err := io.ReadFull(reader, ext[:]); err != nil {
			t.Fatal(err)
		}
		length = uint64(binary.BigEndian.Uint16(ext[:]))
	case 127:
		var ext [8]byte
		if _, err := io.ReadFull(reader, ext[:]); err != nil {
			t.Fatal(err)
		}
		length = binary.BigEndian.Uint64(ext[:])
	}
	payload := make([]byte, int(length))
	if _, err := io.ReadFull(reader, payload); err != nil {
		t.Fatal(err)
	}
	var msg realtime.Message
	if err := json.Unmarshal(payload, &msg); err != nil {
		t.Fatalf("decode websocket message: %v payload=%s", err, string(payload))
	}
	return msg
}

func writeClientWebSocketMessage(t *testing.T, conn net.Conn, msg realtime.Message) {
	t.Helper()
	payload, err := json.Marshal(msg)
	if err != nil {
		t.Fatal(err)
	}
	mask := [4]byte{0x12, 0x34, 0x56, 0x78}
	frame := []byte{0x81}
	switch {
	case len(payload) < 126:
		frame = append(frame, 0x80|byte(len(payload)))
	case len(payload) <= 65535:
		frame = append(frame, 0x80|126, byte(len(payload)>>8), byte(len(payload)))
	default:
		t.Fatalf("test payload unexpectedly large: %d", len(payload))
	}
	frame = append(frame, mask[:]...)
	for i, b := range payload {
		frame = append(frame, b^mask[i%4])
	}
	if _, err := conn.Write(frame); err != nil {
		t.Fatal(err)
	}
}

func TestAuthenticatedWebSocketOperationAckAndReconnectReplay(t *testing.T) {
	server, rawSession, store, ops := newCollaborationServer(t)
	_, project := seedCollaborationProject(t, store)
	ts := httptest.NewServer(server.Handler())
	defer ts.Close()

	conn, reader := dialTestWebSocket(t, ts.URL, "/api/projects/"+project.ID+"/ws?clientId=client-a&baseVersion=1&sinceSeq=0", rawSession)
	hello := readServerWebSocketMessage(t, reader)
	if hello.Type != realtime.MessageHello || hello.ProjectID != project.ID {
		t.Fatalf("unexpected hello: %#v", hello)
	}

	op := realtime.Operation{
		OpID: "op-live-1", ClientID: "client-a", BaseVersion: 1,
		Kind: realtime.OperationDeviceUpdate, EntityID: "sw1",
		Payload: json.RawMessage(`{"name":"SW1"}`),
	}
	opRaw, _ := json.Marshal(op)
	writeClientWebSocketMessage(t, conn, realtime.Message{
		Type: realtime.MessageProjectOperation, ProjectID: project.ID,
		ClientID: "client-a", Payload: opRaw,
	})
	ack := readServerWebSocketMessage(t, reader)
	if ack.Type != realtime.MessageOperationAck || ack.Seq != 1 {
		t.Fatalf("unexpected operation ack: %#v", ack)
	}
	latest, err := ops.LatestOperationSeq(t.Context(), project.ID, 1)
	if err != nil || latest != 1 {
		t.Fatalf("operation was not persisted: latest=%d err=%v", latest, err)
	}
	_ = conn.Close()

	conn2, reader2 := dialTestWebSocket(t, ts.URL, "/api/projects/"+project.ID+"/ws?clientId=client-b&baseVersion=1&sinceSeq=0", rawSession)
	defer conn2.Close()
	hello2 := readServerWebSocketMessage(t, reader2)
	if hello2.Type != realtime.MessageHello || hello2.Seq != 1 {
		t.Fatalf("reconnect hello should advertise latest seq 1: %#v", hello2)
	}
	replayed := readServerWebSocketMessage(t, reader2)
	if replayed.Type != realtime.MessageOperationApplied || replayed.Seq != 1 ||
		!strings.Contains(string(replayed.Payload), `"opId":"op-live-1"`) {
		t.Fatalf("unexpected replay after reconnect: %#v", replayed)
	}
}

func TestWebSocketUpgradeRequiresRFC6455Headers(t *testing.T) {
	server, rawSession, store, _ := newCollaborationServer(t)
	_, project := seedCollaborationProject(t, store)
	req := authenticatedRequest(http.MethodGet, "/api/projects/"+project.ID+"/ws?clientId=c1&baseVersion=1", "", rawSession, false)
	rec := httptest.NewRecorder()
	server.Handler().ServeHTTP(rec, req)
	if rec.Code != http.StatusBadRequest {
		t.Fatalf("missing upgrade headers expected 400, got %d", rec.Code)
	}
}
