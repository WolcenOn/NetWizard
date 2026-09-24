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

const PrivateRoutingContractVersion = "netwizard-private-routing-v1"

var (
	ErrPrivateRoutingUnavailable = errors.New("private routing unavailable")
	ErrPrivateRoutingInvalid     = errors.New("invalid private routing request")
)

type RoutingRequest struct {
	Project  json.RawMessage `json:"project"`
	DeviceID string          `json:"deviceId"`
}

type RoutingResult struct {
	ContractVersion string   `json:"contractVersion"`
	PlanVersion     string   `json:"planVersion"`
	GeneratorVersion string  `json:"generatorVersion"`
	DeviceID        string   `json:"deviceId"`
	Vendor          string   `json:"vendor"`
	Output          string   `json:"output"`
	Warnings        []string `json:"warnings"`
}

type RoutingRunner interface {
	Run(ctx context.Context, request RoutingRequest) (RoutingResult, error)
}

type NodeRoutingRunner struct {
	NodeBinary string
	ScriptPath string
	Timeout    time.Duration
}

func (r NodeRoutingRunner) Run(ctx context.Context, request RoutingRequest) (RoutingResult, error) {
	request.DeviceID = strings.TrimSpace(request.DeviceID)
	if len(request.Project) == 0 || request.DeviceID == "" || !json.Valid(request.Project) {
		return RoutingResult{}, ErrPrivateRoutingInvalid
	}
	node := strings.TrimSpace(r.NodeBinary)
	if node == "" {
		node = "node"
	}
	script := strings.TrimSpace(r.ScriptPath)
	if script == "" {
		return RoutingResult{}, ErrPrivateRoutingUnavailable
	}
	timeout := r.Timeout
	if timeout <= 0 {
		timeout = 5 * time.Second
	}
	runCtx, cancel := context.WithTimeout(ctx, timeout)
	defer cancel()

	payload, err := json.Marshal(request)
	if err != nil {
		return RoutingResult{}, fmt.Errorf("encode private routing request: %w", err)
	}
	cmd := exec.CommandContext(runCtx, node, script)
	cmd.Env = []string{}
	cmd.Stdin = bytes.NewReader(payload)

	var stdout, stderr bytes.Buffer
	cmd.Stdout = &stdout
	cmd.Stderr = &stderr
	if err := cmd.Run(); err != nil {
		if errors.Is(runCtx.Err(), context.DeadlineExceeded) {
			return RoutingResult{}, fmt.Errorf("%w: worker timeout", ErrPrivateRoutingUnavailable)
		}
		message := strings.TrimSpace(stderr.String())
		if len(message) > 240 {
			message = message[:240]
		}
		if message == "" {
			message = err.Error()
		}
		return RoutingResult{}, fmt.Errorf("%w: %s", ErrPrivateRoutingInvalid, message)
	}
	if stdout.Len() > 512*1024 {
		return RoutingResult{}, fmt.Errorf("%w: worker response too large", ErrPrivateRoutingInvalid)
	}
	var result RoutingResult
	if err := json.Unmarshal(stdout.Bytes(), &result); err != nil {
		return RoutingResult{}, fmt.Errorf("%w: invalid worker response", ErrPrivateRoutingInvalid)
	}
	if result.ContractVersion != PrivateRoutingContractVersion ||
		strings.TrimSpace(result.DeviceID) != request.DeviceID ||
		strings.TrimSpace(result.Vendor) == "" {
		return RoutingResult{}, fmt.Errorf("%w: worker contract mismatch", ErrPrivateRoutingInvalid)
	}
	return result, nil
}

func (s *Service) SetRoutingRunner(runner RoutingRunner) {
	if s == nil {
		return
	}
	s.routing = runner
}

func (s *Service) RoutingConfigured() bool {
	return s != nil && s.routing != nil
}

func (s *Service) GenerateRouting(ctx context.Context, project json.RawMessage, deviceID string) (RoutingResult, error) {
	if s == nil || s.routing == nil {
		return RoutingResult{}, ErrPrivateRoutingUnavailable
	}
	return s.routing.Run(ctx, RoutingRequest{Project: project, DeviceID: deviceID})
}
