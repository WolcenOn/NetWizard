package privateservices

import (
	"encoding/json"
	"errors"
	"testing"
)

func validDeploymentPlanResult() DeploymentPlanResult {
	return DeploymentPlanResult{
		ContractVersion:        PrivateDeploymentContractVersion,
		GeneratedAt:            "2026-09-29T06:00:00Z",
		OK:                     true,
		ProductionReady:        true,
		ProductionStatus:       "ready",
		ProductionGateContract: PrivateProductionGateContractVersion,
		ProductionGate:         json.RawMessage(`{"contractVersion":"netwizard-private-production-gate-v1","status":"ready","ready":true}`),
	}
}

func TestValidateDeploymentPlanResultAcceptsProductionGate(t *testing.T) {
	if err := validateDeploymentPlanResult(validDeploymentPlanResult()); err != nil {
		t.Fatalf("valid deployment result rejected: %v", err)
	}
}

func TestValidateDeploymentPlanResultRejectsInconsistentProductionReadiness(t *testing.T) {
	result := validDeploymentPlanResult()
	result.ProductionStatus = "review"
	if err := validateDeploymentPlanResult(result); !errors.Is(err, ErrPrivateDeploymentInvalid) {
		t.Fatalf("expected invalid deployment result, got %v", err)
	}
}

func TestValidateDeploymentPlanResultRejectsMissingProductionGate(t *testing.T) {
	result := validDeploymentPlanResult()
	result.ProductionGate = nil
	if err := validateDeploymentPlanResult(result); !errors.Is(err, ErrPrivateDeploymentInvalid) {
		t.Fatalf("expected production gate contract failure, got %v", err)
	}
}

func TestValidateDeploymentPlanResultAcceptsReviewWhenNotReady(t *testing.T) {
	result := validDeploymentPlanResult()
	result.ProductionReady = false
	result.ProductionStatus = "review"
	result.ProductionGate = json.RawMessage(`{"contractVersion":"netwizard-private-production-gate-v1","status":"review","ready":false}`)
	if err := validateDeploymentPlanResult(result); err != nil {
		t.Fatalf("review deployment result rejected: %v", err)
	}
}
