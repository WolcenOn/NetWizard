package httpapi

import (
	"sync"
	"time"
)

type rateEntry struct {
	windowStart time.Time
	count       int
}

type writeRateLimiter struct {
	mu     sync.Mutex
	limit  int
	window time.Duration
	items  map[string]rateEntry
}

func newWriteRateLimiter(limit int, window time.Duration) *writeRateLimiter {
	if limit <= 0 {
		limit = 60
	}
	if window <= 0 {
		window = time.Minute
	}
	return &writeRateLimiter{limit: limit, window: window, items: map[string]rateEntry{}}
}

func (l *writeRateLimiter) Allow(key string, now time.Time) bool {
	l.mu.Lock()
	defer l.mu.Unlock()

	entry := l.items[key]
	if entry.windowStart.IsZero() || now.Sub(entry.windowStart) >= l.window {
		l.items[key] = rateEntry{windowStart: now, count: 1}
		return true
	}
	if entry.count >= l.limit {
		return false
	}
	entry.count++
	l.items[key] = entry
	return true
}
