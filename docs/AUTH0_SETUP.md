# Auth0 production login for NetWizard

NetWizard uses a server-side OpenID Connect Authorization Code flow with PKCE. The browser never receives the Auth0 client secret.

## Auth0 application

Create an Auth0 **Regular Web Application**.

Configure:

- Allowed Callback URL: `https://<netwizard-domain>/api/auth/callback`
- Grant type: Authorization Code
- ID token signing algorithm: RS256
- Application authentication method: Client Secret (Basic)

NetWizard sends PKCE S256 on every login and validates the nonce, issuer, audience, expiry and RS256 signature of the ID token.

The Auth0 issuer is your tenant/custom-domain base URL, for example:

```text
https://your-tenant.eu.auth0.com
```

Do not include `/authorize`, `/oauth/token` or `/.well-known/openid-configuration` in `NETWIZARD_OIDC_ISSUER_URL`.

## Railway variables

Set these on the NetWizard Railway service:

```text
NETWIZARD_OIDC_ISSUER_URL=https://your-tenant.eu.auth0.com
NETWIZARD_OIDC_CLIENT_ID=<Auth0 Client ID>
NETWIZARD_OIDC_CLIENT_SECRET=<Auth0 Client Secret>
NETWIZARD_OIDC_REDIRECT_URL=https://<netwizard-domain>/api/auth/callback
NETWIZARD_COOKIE_SECURE=true
```

Keep the existing PostgreSQL `DATABASE_URL`.

To enable E6 private services as well, also configure a random backend-only secret of at least 32 bytes:

```text
NETWIZARD_PRIVATE_SERVICE_KEY=<random secret, minimum 32 bytes>
```

The Docker image already sets:

```text
NETWIZARD_PRIVATE_ROUTING_WORKER=/app/private/routing-worker.cjs
```

Do not create or override that variable in Railway unless the container layout is intentionally changed.

## Expected production check

After deployment:

1. `GET /api/capabilities` reports `authConfigPresent: true`, `authEnforced: true` and `privateRouting: true` when the private service key is present.
2. The top bar displays **Entrar** when no session exists.
3. **Entrar** redirects to Auth0 Universal Login.
4. Auth0 redirects back to `/api/auth/callback`.
5. The backend creates an opaque PostgreSQL-backed session and a Secure/HttpOnly/SameSite=Lax cookie.
6. The top bar displays the authenticated user's name/email.
7. **Salir** revokes the server-side session using the CSRF token returned by `/api/auth/me`.

## Failure behaviour

Startup fails deliberately if:

- the OIDC configuration is partial;
- PostgreSQL is missing while OIDC is enabled;
- an HTTPS callback is configured while Secure cookies are disabled;
- discovery advertises ID-token algorithms but not RS256;
- discovery advertises PKCE methods but not S256;
- a client secret is configured and discovery advertises token authentication methods but not `client_secret_basic`.

This prevents an incompatible provider/application configuration from failing only after users attempt to log in.
