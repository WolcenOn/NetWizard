package projects

import (
	"encoding/json"
	"strings"
	"testing"
)

func TestValidateSnapshotAcceptsNetWizard350(t *testing.T) {
	raw := json.RawMessage("{\"_schemaVersion\":\"3.50.0\",\"projName\":\"Demo\",\"devices\":[]}")
	version, err := ValidateSnapshot(raw, 1024)
	if err != nil {
		t.Fatal(err)
	}
	if version != SupportedSchemaVersion {
		t.Fatalf("expected %s, got %s", SupportedSchemaVersion, version)
	}
	if got := SnapshotChecksum(raw); len(got) != 64 {
		t.Fatalf("expected sha256 checksum, got %q", got)
	}
}

func TestValidateSnapshotRejectsFutureAndOversizedPayloads(t *testing.T) {
	if _, err := ValidateSnapshot(json.RawMessage("{\"_schemaVersion\":\"4.0.0\"}"), 1024); err == nil {
		t.Fatal("expected unsupported schema to fail")
	}
	raw := json.RawMessage("{\"_schemaVersion\":\"3.50.0\",\"payload\":\"" + strings.Repeat("x", 200) + "\"}")
	if _, err := ValidateSnapshot(raw, 64); err == nil {
		t.Fatal("expected oversized snapshot to fail")
	}
}
