package realtime

import "time"

type PresenceState struct {
	ProjectID string    `json:"projectId"`
	ClientID  string    `json:"clientId"`
	UserID    string    `json:"userId,omitempty"`
	Name      string    `json:"name,omitempty"`
	View      string    `json:"view,omitempty"`
	Entity    string    `json:"entity,omitempty"`
	Field     string    `json:"field,omitempty"`
	X         float64   `json:"x,omitempty"`
	Y         float64   `json:"y,omitempty"`
	UpdatedAt time.Time `json:"updatedAt"`
}

func (p PresenceState) Expired(now time.Time, ttl time.Duration) bool {
	if p.UpdatedAt.IsZero() {
		return true
	}
	return now.Sub(p.UpdatedAt) > ttl
}
