package realtime

import (
	"encoding/json"
	"errors"
	"testing"
)

func TestOperationValidateAcceptsDeclaredKindsAndRejectsInvalidPayloads(t *testing.T) {
	valid := Operation{
		OpID: "op-1", ClientID: "client-1", BaseVersion: 1,
		Kind: OperationDeviceUpdate, EntityID: "sw1",
		Payload: json.RawMessage(`{"name":"SW1"}`),
	}
	if err := valid.Validate(1024); err != nil {
		t.Fatalf("valid operation rejected: %v", err)
	}

	tests := []Operation{
		{OpID: "", ClientID: "c", BaseVersion: 1, Kind: OperationDeviceUpdate, Payload: json.RawMessage(`{}`)},
		{OpID: "op", ClientID: "", BaseVersion: 1, Kind: OperationDeviceUpdate, Payload: json.RawMessage(`{}`)},
		{OpID: "op", ClientID: "c", BaseVersion: 0, Kind: OperationDeviceUpdate, Payload: json.RawMessage(`{}`)},
		{OpID: "op", ClientID: "c", BaseVersion: 1, Kind: OperationKind("unknown"), Payload: json.RawMessage(`{}`)},
		{OpID: "op", ClientID: "c", BaseVersion: 1, Kind: OperationDeviceUpdate, Payload: json.RawMessage(`{bad`)},
		{OpID: "op", ClientID: "c", BaseVersion: 1, Kind: OperationDeviceUpdate, Payload: json.RawMessage(`{"oversized":"123456"}`)},
	}
	for i, op := range tests {
		limit := 1024
		if i == len(tests)-1 {
			limit = 4
		}
		if err := op.Validate(limit); !errors.Is(err, ErrOperationInvalid) {
			t.Fatalf("case %d expected invalid operation, got %v", i, err)
		}
	}
}
