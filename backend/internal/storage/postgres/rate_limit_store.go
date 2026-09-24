package postgres

import (
	"context"
	"errors"
	"fmt"
	"strings"
	"time"
)

func (s *Store) AllowWrite(ctx context.Context, userID string, now time.Time, limit int, window time.Duration) (bool, error) {
	if s == nil || s.db == nil {
		return false, errors.New("postgres: store is not initialized")
	}
	userID = strings.TrimSpace(userID)
	if userID == "" || limit <= 0 || window <= 0 {
		return false, errors.New("postgres: invalid rate limit request")
	}
	now = now.UTC()
	cutoff := now.Add(-window)

	var count int
	if err := s.db.QueryRowContext(ctx, `
INSERT INTO api_write_limits(user_id, window_start, request_count)
VALUES ($1, $2, 1)
ON CONFLICT (user_id)
DO UPDATE SET
    window_start = CASE
        WHEN api_write_limits.window_start <= $3 THEN EXCLUDED.window_start
        ELSE api_write_limits.window_start
    END,
    request_count = CASE
        WHEN api_write_limits.window_start <= $3 THEN 1
        ELSE api_write_limits.request_count + 1
    END
RETURNING request_count
`, userID, now, cutoff).Scan(&count); err != nil {
		return false, fmt.Errorf("postgres: update write rate limit: %w", err)
	}
	return count <= limit, nil
}
