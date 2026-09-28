package privateservices

import (
	"crypto/hmac"
	"crypto/sha256"
	"encoding/base64"
	"encoding/hex"
	"errors"
	"fmt"
	"strings"
	"time"
)

const ContractVersion = "netwizard-private-deployment-attestation-v1"

var ErrInvalidInput = errors.New("invalid private service input")

type Service struct {
	key        []byte
	routing    RoutingRunner
	deployment DeploymentRunner
}

type AttestationInput struct {
	ProjectID       string
	ProjectVersion  int64
	ProjectChecksum string
	ArtifactSHA256  string
	ArtifactBytes   int64
	Subject         string
	IssuedAt        time.Time
}

type Attestation struct {
	ContractVersion string    `json:"contractVersion"`
	Algorithm       string    `json:"algorithm"`
	ProjectID       string    `json:"projectId"`
	ProjectVersion  int64     `json:"projectVersion"`
	ProjectChecksum string    `json:"projectChecksum"`
	ArtifactSHA256  string    `json:"artifactSha256"`
	ArtifactBytes   int64     `json:"artifactBytes"`
	Subject         string    `json:"subject"`
	IssuedAt        time.Time `json:"issuedAt"`
	Signature       string    `json:"signature"`
}

func New(key []byte) (*Service, error) {
	if len(key) < 32 {
		return nil, fmt.Errorf("%w: private service key must be at least 32 bytes", ErrInvalidInput)
	}
	return &Service{key: append([]byte(nil), key...)}, nil
}

func (s *Service) Attest(input AttestationInput) (Attestation, error) {
	if s == nil || len(s.key) < 32 {
		return Attestation{}, errors.New("private service unavailable")
	}
	input.ProjectID = strings.TrimSpace(input.ProjectID)
	input.ProjectChecksum = strings.ToLower(strings.TrimSpace(input.ProjectChecksum))
	input.ArtifactSHA256 = strings.ToLower(strings.TrimSpace(input.ArtifactSHA256))
	input.Subject = strings.TrimSpace(input.Subject)
	input.IssuedAt = input.IssuedAt.UTC().Truncate(time.Second)

	if input.ProjectID == "" || input.ProjectVersion < 1 || input.Subject == "" ||
		input.ArtifactBytes < 1 || input.IssuedAt.IsZero() ||
		!validSHA256(input.ProjectChecksum) || !validSHA256(input.ArtifactSHA256) {
		return Attestation{}, ErrInvalidInput
	}

	out := Attestation{
		ContractVersion: ContractVersion,
		Algorithm:       "HMAC-SHA256",
		ProjectID:       input.ProjectID,
		ProjectVersion:  input.ProjectVersion,
		ProjectChecksum: input.ProjectChecksum,
		ArtifactSHA256:  input.ArtifactSHA256,
		ArtifactBytes:   input.ArtifactBytes,
		Subject:         input.Subject,
		IssuedAt:        input.IssuedAt,
	}
	mac := hmac.New(sha256.New, s.key)
	_, _ = mac.Write([]byte(canonicalPayload(out)))
	out.Signature = base64.RawURLEncoding.EncodeToString(mac.Sum(nil))
	return out, nil
}

func (s *Service) Verify(att Attestation) bool {
	if s == nil || len(s.key) < 32 {
		return false
	}
	signature, err := base64.RawURLEncoding.DecodeString(strings.TrimSpace(att.Signature))
	if err != nil {
		return false
	}
	expected, err := s.Attest(AttestationInput{
		ProjectID:       att.ProjectID,
		ProjectVersion:  att.ProjectVersion,
		ProjectChecksum: att.ProjectChecksum,
		ArtifactSHA256:  att.ArtifactSHA256,
		ArtifactBytes:   att.ArtifactBytes,
		Subject:         att.Subject,
		IssuedAt:        att.IssuedAt,
	})
	if err != nil {
		return false
	}
	want, err := base64.RawURLEncoding.DecodeString(expected.Signature)
	return err == nil && hmac.Equal(signature, want)
}

func validSHA256(value string) bool {
	if len(value) != sha256.Size*2 {
		return false
	}
	decoded, err := hex.DecodeString(value)
	return err == nil && len(decoded) == sha256.Size
}

func canonicalPayload(att Attestation) string {
	return strings.Join([]string{
		att.ContractVersion,
		att.Algorithm,
		att.ProjectID,
		fmt.Sprintf("%d", att.ProjectVersion),
		att.ProjectChecksum,
		att.ArtifactSHA256,
		fmt.Sprintf("%d", att.ArtifactBytes),
		att.Subject,
		att.IssuedAt.UTC().Format(time.RFC3339),
	}, "\n")
}
