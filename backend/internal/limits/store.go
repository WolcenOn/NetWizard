package limits

import (
	"context"
	"time"
)

type Store interface {
	AllowWrite(context.Context, string, time.Time, int, time.Duration) (bool, error)
}
