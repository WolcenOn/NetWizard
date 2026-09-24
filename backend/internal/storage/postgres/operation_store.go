package postgres

import (
	"context"
	"database/sql"
	"encoding/json"
	"errors"
	"fmt"
	"strings"

	"github.com/WolcenOn/NetWizard/backend/internal/realtime"
)

func (s *Store) AppendOperation(ctx context.Context, projectID string, op realtime.Operation, actor string) (realtime.OperationEnvelope, error) {
	projectID = strings.TrimSpace(projectID)
	op.OpID = strings.TrimSpace(op.OpID)
	op.ClientID = strings.TrimSpace(op.ClientID)
	actor = strings.TrimSpace(actor)
	if projectID == "" || op.OpID == "" || op.ClientID == "" || actor == "" || op.BaseVersion < 1 || op.Kind == "" || len(op.Payload) == 0 {
		return realtime.OperationEnvelope{}, realtime.ErrOperationInvalid
	}

	tx, err := s.db.BeginTx(ctx, &sql.TxOptions{Isolation: sql.LevelSerializable})
	if err != nil {
		return realtime.OperationEnvelope{}, fmt.Errorf("postgres: begin append operation: %w", err)
	}
	defer tx.Rollback()

	var currentVersion int64
	if err := tx.QueryRowContext(ctx, `
SELECT current_version FROM projects WHERE id = $1 AND deleted_at IS NULL FOR SHARE
`, projectID).Scan(&currentVersion); errors.Is(err, sql.ErrNoRows) {
		return realtime.OperationEnvelope{}, realtime.ErrOperationConflict
	} else if err != nil {
		return realtime.OperationEnvelope{}, fmt.Errorf("postgres: load operation base version: %w", err)
	}
	if currentVersion != op.BaseVersion {
		return realtime.OperationEnvelope{}, realtime.ErrOperationConflict
	}

	var existing realtime.OperationEnvelope
	var payload []byte
	var kind string
	err = tx.QueryRowContext(ctx, `
SELECT project_id, seq, op_id, client_id, base_version, kind, COALESCE(entity_id,''), payload, created_by_subject, created_at
FROM project_operations WHERE project_id = $1 AND op_id = $2
`, projectID, op.OpID).Scan(
		&existing.ProjectID, &existing.Seq, &existing.Operation.OpID, &existing.Operation.ClientID,
		&existing.Operation.BaseVersion, &kind, &existing.Operation.EntityID, &payload,
		&existing.CreatedBy, &existing.CreatedAt,
	)
	if err == nil {
		existing.Operation.Kind = realtime.OperationKind(kind)
		existing.Operation.Payload = append(json.RawMessage(nil), payload...)
		return existing, nil
	}
	if !errors.Is(err, sql.ErrNoRows) {
		return realtime.OperationEnvelope{}, fmt.Errorf("postgres: check duplicate operation: %w", err)
	}

	var seq int64
	if err := tx.QueryRowContext(ctx, `
INSERT INTO project_operation_counters(project_id, last_seq)
VALUES ($1, 1)
ON CONFLICT (project_id)
DO UPDATE SET last_seq = project_operation_counters.last_seq + 1
RETURNING last_seq
`, projectID).Scan(&seq); err != nil {
		return realtime.OperationEnvelope{}, fmt.Errorf("postgres: allocate operation sequence: %w", err)
	}

	env := realtime.OperationEnvelope{ProjectID: projectID, Seq: seq, Operation: op, CreatedBy: actor}
	if err := tx.QueryRowContext(ctx, `
INSERT INTO project_operations(project_id, seq, op_id, client_id, base_version, kind, entity_id, payload, created_by_subject)
VALUES ($1,$2,$3,$4,$5,$6,NULLIF($7,''),$8::jsonb,$9)
RETURNING created_at
`, projectID, seq, op.OpID, op.ClientID, op.BaseVersion, string(op.Kind), op.EntityID, string(op.Payload), actor).Scan(&env.CreatedAt); err != nil {
		return realtime.OperationEnvelope{}, fmt.Errorf("postgres: insert operation: %w", err)
	}

	if err := writeAudit(ctx, tx, "", projectID, actor, "project.operation.append", projectID, map[string]any{"seq": seq, "opId": op.OpID, "kind": op.Kind}); err != nil {
		return realtime.OperationEnvelope{}, err
	}
	if err := tx.Commit(); err != nil {
		return realtime.OperationEnvelope{}, fmt.Errorf("postgres: commit operation: %w", err)
	}
	return env, nil
}

func (s *Store) OperationsSince(ctx context.Context, projectID string, sinceSeq int64, limit int) ([]realtime.OperationEnvelope, error) {
	if limit <= 0 || limit > 1000 {
		limit = 500
	}
	rows, err := s.db.QueryContext(ctx, `
SELECT project_id, seq, op_id, client_id, base_version, kind, COALESCE(entity_id,''), payload, created_by_subject, created_at
FROM project_operations
WHERE project_id = $1 AND seq > $2
ORDER BY seq ASC
LIMIT $3
`, strings.TrimSpace(projectID), sinceSeq, limit)
	if err != nil {
		return nil, fmt.Errorf("postgres: operations since: %w", err)
	}
	defer rows.Close()
	out := []realtime.OperationEnvelope{}
	for rows.Next() {
		var env realtime.OperationEnvelope
		var payload []byte
		var kind string
		if err := rows.Scan(&env.ProjectID, &env.Seq, &env.Operation.OpID, &env.Operation.ClientID, &env.Operation.BaseVersion, &kind, &env.Operation.EntityID, &payload, &env.CreatedBy, &env.CreatedAt); err != nil {
			return nil, err
		}
		env.Operation.Kind = realtime.OperationKind(kind)
		env.Operation.Payload = append(json.RawMessage(nil), payload...)
		out = append(out, env)
	}
	return out, rows.Err()
}

func (s *Store) LatestOperationSeq(ctx context.Context, projectID string) (int64, error) {
	var seq int64
	err := s.db.QueryRowContext(ctx, `
SELECT COALESCE((SELECT last_seq FROM project_operation_counters WHERE project_id = $1), 0)
`, strings.TrimSpace(projectID)).Scan(&seq)
	if err != nil {
		return 0, fmt.Errorf("postgres: latest operation seq: %w", err)
	}
	return seq, nil
}
