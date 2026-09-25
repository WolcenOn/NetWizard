package auth

import (
	"context"
	"crypto"
	"crypto/rsa"
	"crypto/sha256"
	"encoding/base64"
	"encoding/binary"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"math/big"
	"net/http"
	"net/url"
	"strings"
	"time"
)

type OIDCConfig struct {
	IssuerURL    string
	ClientID     string
	ClientSecret string
	RedirectURL  string
	SessionTTL   time.Duration
	HTTPTimeout  time.Duration
}

type discoveryDocument struct {
	Issuer                               string
	Authorization_endpoint               string
	Token_endpoint                       string
	Jwks_uri                             string
	Token_endpoint_auth_methods_supported []string
	Id_token_signing_alg_values_supported []string
	Code_challenge_methods_supported      []string
}

type jwkSet struct {
	Keys []struct {
		Kty string
		Kid string
		Alg string
		N   string
		E   string
	}
}

type idTokenClaims struct {
	Iss   string
	Sub   string
	Aud   json.RawMessage
	Exp   int64
	Nonce string
	Email string
	Name  string
}

type Service struct {
	cfg       OIDCConfig
	http      *http.Client
	discovery discoveryDocument
	Sessions  *SessionManager
}

func NewOIDCService(ctx context.Context, cfg OIDCConfig, sessions *SessionManager) (*Service, error) {
	if sessions == nil || sessions.Store == nil {
		return nil, errors.New("oidc: session store is required")
	}
	if strings.TrimSpace(cfg.IssuerURL) == "" || strings.TrimSpace(cfg.ClientID) == "" || strings.TrimSpace(cfg.RedirectURL) == "" {
		return nil, errors.New("oidc: issuer, client id and redirect URL are required")
	}
	if cfg.SessionTTL <= 0 {
		return nil, errors.New("oidc: session TTL must be positive")
	}
	if cfg.HTTPTimeout <= 0 {
		cfg.HTTPTimeout = 10 * time.Second
	}
	client := &http.Client{Timeout: cfg.HTTPTimeout}
	issuer := strings.TrimRight(strings.TrimSpace(cfg.IssuerURL), "/")
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, issuer+"/.well-known/openid-configuration", nil)
	if err != nil {
		return nil, err
	}
	resp, err := client.Do(req)
	if err != nil {
		return nil, fmt.Errorf("oidc discovery failed: %w", err)
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("oidc discovery returned %s", resp.Status)
	}
	var doc discoveryDocument
	if err := json.NewDecoder(io.LimitReader(resp.Body, 1<<20)).Decode(&doc); err != nil {
		return nil, fmt.Errorf("oidc discovery decode: %w", err)
	}
	if strings.TrimRight(doc.Issuer, "/") != issuer {
		return nil, errors.New("oidc discovery issuer mismatch")
	}
	for name, endpoint := range map[string]string{
		"authorization_endpoint": doc.Authorization_endpoint,
		"token_endpoint": doc.Token_endpoint,
		"jwks_uri": doc.Jwks_uri,
	} {
		u, err := url.Parse(endpoint)
		if err != nil || (u.Scheme != "https" && u.Scheme != "http") || u.Host == "" {
			return nil, fmt.Errorf("oidc discovery %s is invalid", name)
		}
	}

	if len(doc.Id_token_signing_alg_values_supported) > 0 &&
		!containsString(doc.Id_token_signing_alg_values_supported, "RS256") {
		return nil, errors.New("oidc provider does not advertise RS256 id token signing")
	}
	if len(doc.Code_challenge_methods_supported) > 0 &&
		!containsString(doc.Code_challenge_methods_supported, "S256") {
		return nil, errors.New("oidc provider does not advertise S256 PKCE")
	}
	if strings.TrimSpace(cfg.ClientSecret) != "" &&
		len(doc.Token_endpoint_auth_methods_supported) > 0 &&
		!containsString(doc.Token_endpoint_auth_methods_supported, "client_secret_basic") {
		return nil, errors.New("oidc provider does not advertise client_secret_basic")
	}
	return &Service{cfg: cfg, http: client, discovery: doc, Sessions: sessions}, nil
}

func (s *Service) LoginURL(ctx context.Context, returnTo string) (string, error) {
	if s == nil || s.Sessions == nil {
		return "", errors.New("oidc: service unavailable")
	}
	if !validReturnTo(returnTo) {
		return "", errors.New("oidc: invalid return path")
	}
	state, err := randomToken(32)
	if err != nil {
		return "", err
	}
	nonce, err := randomToken(32)
	if err != nil {
		return "", err
	}
	verifier, err := randomToken(48)
	if err != nil {
		return "", err
	}
	challengeSum := sha256.Sum256([]byte(verifier))
	challenge := base64.RawURLEncoding.EncodeToString(challengeSum[:])
	login := LoginState{
		StateHash: hashToken(state), Nonce: nonce, PKCEVerifier: verifier,
		ReturnTo: returnTo, ExpiresAt: time.Now().UTC().Add(10 * time.Minute),
	}
	if err := s.Sessions.Store.SaveLoginState(ctx, login); err != nil {
		return "", err
	}
	u, err := url.Parse(s.discovery.Authorization_endpoint)
	if err != nil {
		return "", err
	}
	q := u.Query()
	q.Set("response_type", "code")
	q.Set("client_id", s.cfg.ClientID)
	q.Set("redirect_uri", s.cfg.RedirectURL)
	q.Set("scope", "openid profile email")
	q.Set("state", state)
	q.Set("nonce", nonce)
	q.Set("code_challenge", challenge)
	q.Set("code_challenge_method", "S256")
	u.RawQuery = q.Encode()
	return u.String(), nil
}

func (s *Service) Callback(ctx context.Context, state, code string) (string, Session, string, error) {
	state = strings.TrimSpace(state)
	code = strings.TrimSpace(code)
	if state == "" || code == "" {
		return "", Session{}, "", ErrInvalidState
	}
	login, err := s.Sessions.Store.ConsumeLoginState(ctx, hashToken(state), time.Now().UTC())
	if err != nil {
		return "", Session{}, "", ErrInvalidState
	}
	rawToken, err := s.exchangeCode(ctx, code, login.PKCEVerifier)
	if err != nil {
		return "", Session{}, "", err
	}
	identity, err := s.verifyIDToken(ctx, rawToken, login.Nonce)
	if err != nil {
		return "", Session{}, "", err
	}
	userID, err := newUserID()
	if err != nil {
		return "", Session{}, "", err
	}
	user, err := s.Sessions.Store.UpsertUser(ctx, identity, userID)
	if err != nil {
		return "", Session{}, "", err
	}
	rawSession, session, err := s.Sessions.Create(ctx, user, s.cfg.SessionTTL)
	if err != nil {
		return "", Session{}, "", err
	}
	return rawSession, session, login.ReturnTo, nil
}

func (s *Service) exchangeCode(ctx context.Context, code, verifier string) (string, error) {
	form := url.Values{}
	form.Set("grant_type", "authorization_code")
	form.Set("code", code)
	form.Set("redirect_uri", s.cfg.RedirectURL)
	form.Set("client_id", s.cfg.ClientID)
	form.Set("code_verifier", verifier)
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, s.discovery.Token_endpoint, strings.NewReader(form.Encode()))
	if err != nil {
		return "", err
	}
	req.Header.Set("Content-Type", "application/x-www-form-urlencoded")
	if s.cfg.ClientSecret != "" {
		req.SetBasicAuth(s.cfg.ClientID, s.cfg.ClientSecret)
	}
	resp, err := s.http.Do(req)
	if err != nil {
		return "", fmt.Errorf("oidc token exchange failed: %w", err)
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		io.Copy(io.Discard, io.LimitReader(resp.Body, 4096))
		return "", fmt.Errorf("oidc token exchange returned %s", resp.Status)
	}
	var payload struct {
		Id_token string
	}
	if err := json.NewDecoder(io.LimitReader(resp.Body, 1<<20)).Decode(&payload); err != nil {
		return "", fmt.Errorf("oidc token response decode: %w", err)
	}
	if payload.Id_token == "" {
		return "", errors.New("oidc token response omitted id_token")
	}
	return payload.Id_token, nil
}

func (s *Service) verifyIDToken(ctx context.Context, raw, expectedNonce string) (ExternalIdentity, error) {
	parts := strings.Split(raw, ".")
	if len(parts) != 3 {
		return ExternalIdentity{}, errors.New("oidc id token is malformed")
	}
	headerRaw, err := base64.RawURLEncoding.DecodeString(parts[0])
	if err != nil {
		return ExternalIdentity{}, errors.New("oidc id token header is malformed")
	}
	var header struct {
		Alg string
		Kid string
		Typ string
	}
	if err := json.Unmarshal(headerRaw, &header); err != nil || header.Alg != "RS256" || header.Kid == "" {
		return ExternalIdentity{}, errors.New("oidc id token uses unsupported signing metadata")
	}
	key, err := s.fetchRSAKey(ctx, header.Kid)
	if err != nil {
		return ExternalIdentity{}, err
	}
	sig, err := base64.RawURLEncoding.DecodeString(parts[2])
	if err != nil {
		return ExternalIdentity{}, errors.New("oidc id token signature is malformed")
	}
	digest := sha256.Sum256([]byte(parts[0] + "." + parts[1]))
	if err := rsa.VerifyPKCS1v15(key, crypto.SHA256, digest[:], sig); err != nil {
		return ExternalIdentity{}, errors.New("oidc id token signature verification failed")
	}
	claimsRaw, err := base64.RawURLEncoding.DecodeString(parts[1])
	if err != nil {
		return ExternalIdentity{}, errors.New("oidc id token claims are malformed")
	}
	var claims idTokenClaims
	if err := json.Unmarshal(claimsRaw, &claims); err != nil {
		return ExternalIdentity{}, errors.New("oidc id token claims are invalid")
	}
	if strings.TrimRight(claims.Iss, "/") != strings.TrimRight(s.cfg.IssuerURL, "/") {
		return ExternalIdentity{}, errors.New("oidc id token issuer mismatch")
	}
	if !audienceContains(claims.Aud, s.cfg.ClientID) {
		return ExternalIdentity{}, errors.New("oidc id token audience mismatch")
	}
	if claims.Exp <= time.Now().UTC().Unix() {
		return ExternalIdentity{}, errors.New("oidc id token expired")
	}
	if claims.Nonce == "" || claims.Nonce != expectedNonce {
		return ExternalIdentity{}, errors.New("oidc id token nonce mismatch")
	}
	if strings.TrimSpace(claims.Sub) == "" {
		return ExternalIdentity{}, errors.New("oidc id token subject is missing")
	}
	return ExternalIdentity{
		Issuer: strings.TrimRight(claims.Iss, "/"), Subject: claims.Sub,
		Email: claims.Email, DisplayName: claims.Name,
	}, nil
}

func (s *Service) fetchRSAKey(ctx context.Context, kid string) (*rsa.PublicKey, error) {
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, s.discovery.Jwks_uri, nil)
	if err != nil {
		return nil, err
	}
	resp, err := s.http.Do(req)
	if err != nil {
		return nil, fmt.Errorf("oidc jwks fetch failed: %w", err)
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("oidc jwks returned %s", resp.Status)
	}
	var set jwkSet
	if err := json.NewDecoder(io.LimitReader(resp.Body, 1<<20)).Decode(&set); err != nil {
		return nil, fmt.Errorf("oidc jwks decode: %w", err)
	}
	for _, key := range set.Keys {
		if key.Kid != kid || key.Kty != "RSA" || key.N == "" || key.E == "" {
			continue
		}
		nBytes, err := base64.RawURLEncoding.DecodeString(key.N)
		if err != nil {
			continue
		}
		eBytes, err := base64.RawURLEncoding.DecodeString(key.E)
		if err != nil || len(eBytes) == 0 || len(eBytes) > 4 {
			continue
		}
		var padded [4]byte
		copy(padded[4-len(eBytes):], eBytes)
		e := int(binary.BigEndian.Uint32(padded[:]))
		if e <= 1 {
			continue
		}
		return &rsa.PublicKey{N: new(big.Int).SetBytes(nBytes), E: e}, nil
	}
	return nil, errors.New("oidc signing key not found")
}

func audienceContains(raw json.RawMessage, clientID string) bool {
	var single string
	if err := json.Unmarshal(raw, &single); err == nil {
		return single == clientID
	}
	var many []string
	if err := json.Unmarshal(raw, &many); err != nil {
		return false
	}
	for _, aud := range many {
		if aud == clientID {
			return true
		}
	}
	return false
}

func validReturnTo(value string) bool {
	if value == "" {
		return true
	}
	if !strings.HasPrefix(value, "/") || strings.HasPrefix(value, "//") || strings.ContainsAny(value, "\r\n") {
		return false
	}
	u, err := url.Parse(value)
	return err == nil && !u.IsAbs() && u.Host == ""
}

func containsString(values []string, target string) bool {
	for _, value := range values {
		if strings.EqualFold(strings.TrimSpace(value), target) {
			return true
		}
	}
	return false
}
