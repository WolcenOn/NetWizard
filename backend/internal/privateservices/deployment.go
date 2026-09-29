package privateservices

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"os/exec"
	"strings"
	"time"
)

const PrivateDeploymentContractVersion = "netwizard-private-deployment-plan-v2"
const PrivateProductionGateContractVersion = "netwizard-private-production-gate-v1"

var (
	ErrPrivateDeploymentUnavailable = errors.New("private deployment planning unavailable")
	ErrPrivateDeploymentInvalid     = errors.New("invalid private deployment planning request")
)

type DeploymentPlanRequest struct {
	Project     json.RawMessage `json:"project"`
	GeneratedAt time.Time       `json:"generatedAt"`
}

type DeploymentArtifact struct {
	Path    string `json:"path"`
	Content string `json:"content"`
	MIME    string `json:"mime"`
}

type DeploymentPlanResult struct {
	ContractVersion             string               `json:"contractVersion"`
	GeneratedAt                 string               `json:"generatedAt"`
	OK                          bool                 `json:"ok"`
	ProjectName                 string               `json:"projectName"`
	ChangeSet                   json.RawMessage      `json:"changeSet"`
	IncrementalPlan             json.RawMessage      `json:"incrementalPlan"`
	DeploymentPlan              json.RawMessage      `json:"deploymentPlan"`
	RunbookMarkdown             string               `json:"runbookMarkdown"`
	RollbackMarkdown            string               `json:"rollbackMarkdown"`
	ChangeSummaryMarkdown       string               `json:"changeSummaryMarkdown"`
	IncrementalSummaryMarkdown  string               `json:"incrementalSummaryMarkdown"`
	PostChangeChecklistMarkdown string               `json:"postChangeChecklistMarkdown"`
	Artifacts                   []DeploymentArtifact `json:"artifacts"`
	Issues                      json.RawMessage      `json:"issues"`
	ConfigSources               map[string]string    `json:"configSources,omitempty"`
	PrivateConfigContract       string               `json:"privateConfigContract,omitempty"`
	ProductionReady             bool                 `json:"productionReady"`
	ProductionStatus            string               `json:"productionStatus"`
	ProductionGateContract      string               `json:"productionGateContract"`
	ProductionGate              json.RawMessage      `json:"productionGate"`
	ProductionGateSummary       string               `json:"productionGateSummaryMarkdown"`
}

type DeploymentRunner interface {
	Run(ctx context.Context, request DeploymentPlanRequest) (DeploymentPlanResult, error)
}

type NodeDeploymentRunner struct {
	NodeBinary string
	ScriptPath string
	Timeout    time.Duration
}

func (r NodeDeploymentRunner) Run(ctx context.Context, request DeploymentPlanRequest) (DeploymentPlanResult, error) {
	if len(request.Project) == 0 || !json.Valid(request.Project) {
		return DeploymentPlanResult{}, ErrPrivateDeploymentInvalid
	}
	node := strings.TrimSpace(r.NodeBinary)
	if node == "" {
		node = "node"
	}
	script := strings.TrimSpace(r.ScriptPath)
	if script == "" {
		return DeploymentPlanResult{}, ErrPrivateDeploymentUnavailable
	}
	timeout := r.Timeout
	if timeout <= 0 {
		timeout = 10 * time.Second
	}
	runCtx, cancel := context.WithTimeout(ctx, timeout)
	defer cancel()

	payload, err := json.Marshal(request)
	if err != nil {
		return DeploymentPlanResult{}, fmt.Errorf("encode private deployment request: %w", err)
	}
	cmd := exec.CommandContext(runCtx, node, script)
	cmd.Env = []string{}
	cmd.Stdin = bytes.NewReader(payload)

	var stdout, stderr bytes.Buffer
	cmd.Stdout = &stdout
	cmd.Stderr = &stderr
	if err := cmd.Run(); err != nil {
		if errors.Is(runCtx.Err(), context.DeadlineExceeded) {
			return DeploymentPlanResult{}, fmt.Errorf("%w: worker timeout", ErrPrivateDeploymentUnavailable)
		}
		message := strings.TrimSpace(stderr.String())
		if len(message) > 400 {
			message = message[:400]
		}
		if message == "" {
			message = err.Error()
		}
		return DeploymentPlanResult{}, fmt.Errorf("%w: %s", ErrPrivateDeploymentInvalid, message)
	}
	if stdout.Len() > 16*1024*1024 {
		return DeploymentPlanResult{}, fmt.Errorf("%w: worker response too large", ErrPrivateDeploymentInvalid)
	}
	var result DeploymentPlanResult
	if err := json.Unmarshal(stdout.Bytes(), &result); err != nil {
		return DeploymentPlanResult{}, fmt.Errorf("%w: invalid worker response", ErrPrivateDeploymentInvalid)
	}
	if err := validateDeploymentPlanResult(result); err != nil {
		return DeploymentPlanResult{}, err
	}
	return result, nil
}

func validateDeploymentPlanResult(result DeploymentPlanResult) error {
	if result.ContractVersion != PrivateDeploymentContractVersion || strings.TrimSpace(result.GeneratedAt) == "" {
		return fmt.Errorf("%w: worker contract mismatch", ErrPrivateDeploymentInvalid)
	}
	if result.ProductionGateContract != PrivateProductionGateContractVersion || len(result.ProductionGate) == 0 || !json.Valid(result.ProductionGate) {
		return fmt.Errorf("%w: production gate contract mismatch", ErrPrivateDeploymentInvalid)
	}
	switch result.ProductionStatus {
	case "ready", "review", "blocked":
	default:
		return fmt.Errorf("%w: invalid production gate status", ErrPrivateDeploymentInvalid)
	}
	if result.ProductionReady != (result.ProductionStatus == "ready") {
		return fmt.Errorf("%w: inconsistent production gate readiness", ErrPrivateDeploymentInvalid)
	}
	return nil
}

func (s *Service) SetDeploymentRunner(runner DeploymentRunner) {
	if s == nil {
		return
	}
	s.deployment = runner
}

func (s *Service) DeploymentConfigured() bool {
	return s != nil && s.deployment != nil
}

func (s *Service) GenerateDeploymentPlan(ctx context.Context, project json.RawMessage, generatedAt time.Time) (DeploymentPlanResult, error) {
	if s == nil || s.deployment == nil {
		return DeploymentPlanResult{}, ErrPrivateDeploymentUnavailable
	}
	return s.deployment.Run(ctx, DeploymentPlanRequest{
		Project: project, GeneratedAt: generatedAt,
	})
}
