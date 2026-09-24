package privateservices

import (
	"strings"
	"testing"
	"time"
)

func TestAttestationIsDeterministicAndVerifiable(t *testing.T) {
	service, err := New([]byte(strings.Repeat("k", 32)))
	if err != nil {
		t.Fatal(err)
	}
	input := AttestationInput{
		ProjectID:       "prj-1",
		ProjectVersion:  3,
		ProjectChecksum: strings.Repeat("a", 64),
		ArtifactSHA256:  strings.Repeat("b", 64),
		ArtifactBytes:   1234,
		Subject:         "issuer|user",
		IssuedAt:        time.Date(2026, 9, 24, 18, 0, 0, 987000000, time.UTC),
	}
	first, err := service.Attest(input)
	if err != nil {
		t.Fatal(err)
	}
	second, err := service.Attest(input)
	if err != nil {
		t.Fatal(err)
	}
	if first.Signature == "" || first.Signature != second.Signature {
		t.Fatalf("expected deterministic signature, got %q and %q", first.Signature, second.Signature)
	}
	if !service.Verify(first) {
		t.Fatal("expected attestation to verify")
	}
	tampered := first
	tampered.ArtifactBytes++
	if service.Verify(tampered) {
		t.Fatal("tampered attestation must not verify")
	}
}

func TestAttestationRejectsWeakKeyAndInvalidDigest(t *testing.T) {
	if _, err := New([]byte("short")); err == nil {
		t.Fatal("expected weak key rejection")
	}
	service, err := New([]byte(strings.Repeat("s", 32)))
	if err != nil {
		t.Fatal(err)
	}
	_, err = service.Attest(AttestationInput{
		ProjectID:       "prj-1",
		ProjectVersion:  1,
		ProjectChecksum: strings.Repeat("a", 64),
		ArtifactSHA256:  "not-a-sha",
		ArtifactBytes:   1,
		Subject:         "subject",
		IssuedAt:        time.Now().UTC(),
	})
	if err == nil {
		t.Fatal("expected invalid digest rejection")
	}
}
