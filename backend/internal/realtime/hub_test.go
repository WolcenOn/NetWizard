package realtime

import (
	"context"
	"testing"
)

type fakeConn struct {
	id     string
	closed bool
	msgs   []Message
}

func (f *fakeConn) ID() string { return f.id }
func (f *fakeConn) Send(ctx context.Context, msg Message) error {
	f.msgs = append(f.msgs, msg)
	return nil
}
func (f *fakeConn) Close() error { f.closed = true; return nil }

func TestRoomBroadcastSkipsSender(t *testing.T) {
	room := NewRoom("p1")
	a := &fakeConn{id: "a"}
	b := &fakeConn{id: "b"}
	room.Join(a)
	room.Join(b)
	msg := Message{Type: MessageProjectOperation, ProjectID: "p1"}
	if errs := room.Broadcast(context.Background(), msg, "a"); len(errs) != 0 {
		t.Fatalf("expected no errors, got %d", len(errs))
	}
	if len(a.msgs) != 0 {
		t.Fatalf("sender should not receive echo")
	}
	if len(b.msgs) != 1 || b.msgs[0].Type != MessageProjectOperation {
		t.Fatalf("receiver did not get message")
	}
}

func TestRoomLeaveClosesClientAndClearsPresence(t *testing.T) {
	room := NewRoom("p1")
	a := &fakeConn{id: "a"}
	room.Join(a)
	room.SetPresence(PresenceState{ProjectID: "p1", ClientID: "a", View: "v5"})
	room.Leave("a")
	if !a.closed {
		t.Fatalf("client should be closed on leave")
	}
	if !room.Empty() {
		t.Fatalf("room should be empty")
	}
	if len(room.Presence()) != 0 {
		t.Fatalf("presence should be cleared")
	}
}
