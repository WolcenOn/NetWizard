package realtime

import (
	"context"
	"sync"
)

// ClientConn es la abstracción mínima para permitir tests sin acoplar el hub
// a una librería WebSocket concreta.
type ClientConn interface {
	ID() string
	Send(ctx context.Context, msg Message) error
	Close() error
}

// Hub mantiene salas por proyecto. En esta fase es memoria local;
// cuando haya escalado horizontal se podrá respaldar con pub/sub.
type Hub struct {
	mu    sync.RWMutex
	rooms map[string]*Room
}

func NewHub() *Hub {
	return &Hub{rooms: map[string]*Room{}}
}

func (h *Hub) Room(projectID string) *Room {
	h.mu.Lock()
	defer h.mu.Unlock()
	if room := h.rooms[projectID]; room != nil {
		return room
	}
	room := NewRoom(projectID)
	h.rooms[projectID] = room
	return room
}

func (h *Hub) RemoveRoomIfEmpty(projectID string) {
	h.mu.Lock()
	defer h.mu.Unlock()
	room := h.rooms[projectID]
	if room == nil || !room.Empty() {
		return
	}
	delete(h.rooms, projectID)
}

type Room struct {
	projectID string
	mu        sync.RWMutex
	clients   map[string]ClientConn
	presence  map[string]PresenceState
}

func NewRoom(projectID string) *Room {
	return &Room{projectID: projectID, clients: map[string]ClientConn{}, presence: map[string]PresenceState{}}
}

func (r *Room) Join(client ClientConn) {
	r.mu.Lock()
	defer r.mu.Unlock()
	r.clients[client.ID()] = client
}

func (r *Room) Leave(clientID string) {
	r.mu.Lock()
	defer r.mu.Unlock()
	if client := r.clients[clientID]; client != nil {
		_ = client.Close()
	}
	delete(r.clients, clientID)
	delete(r.presence, clientID)
}

func (r *Room) Empty() bool {
	r.mu.RLock()
	defer r.mu.RUnlock()
	return len(r.clients) == 0
}

func (r *Room) SetPresence(p PresenceState) {
	r.mu.Lock()
	defer r.mu.Unlock()
	r.presence[p.ClientID] = p
}

func (r *Room) Presence() []PresenceState {
	r.mu.RLock()
	defer r.mu.RUnlock()
	out := make([]PresenceState, 0, len(r.presence))
	for _, p := range r.presence {
		out = append(out, p)
	}
	return out
}

func (r *Room) Broadcast(ctx context.Context, msg Message, exceptClientID string) []error {
	r.mu.RLock()
	clients := make([]ClientConn, 0, len(r.clients))
	for id, client := range r.clients {
		if id == exceptClientID {
			continue
		}
		clients = append(clients, client)
	}
	r.mu.RUnlock()

	var errs []error
	for _, client := range clients {
		if err := client.Send(ctx, msg); err != nil {
			errs = append(errs, err)
		}
	}
	return errs
}
