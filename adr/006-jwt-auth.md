# 006 — Self-managed JWT authentication

**Date:** 2026-03-31
**Status:** Decided (reinstated; [012 — Firebase Authentication](012-firebase-authentication.md) is superseded)

## Context

The product review system needs user registration, login, and authenticated API access.
An earlier revision ([ADR 012](012-firebase-authentication.md)) proposed Firebase
Authentication as a managed identity provider. That decision was reversed: Firebase adds
an external hard dependency (Google Cloud project, service account, emulator for tests)
that increases evaluator friction and obscures the auth implementation — a core
engineering concern in a take-home assignment.

## Decision

Implement self-managed JWT authentication directly in the NestJS backend:

- **Registration / Login:** `POST /api/auth/register` and `POST /api/auth/login` handled
  by `AuthController`. Passwords hashed with **bcrypt** (cost factor 12).
- **Access token:** Short-lived JWT (15 min), signed with `JWT_SECRET` env var. Stored
  **in memory** on the Angular frontend (never in localStorage or sessionStorage).
- **Refresh token:** Long-lived JWT (7 days), stored in an **httpOnly, Secure,
  SameSite=Strict cookie**. Rotated on every refresh (old token invalidated).
- **Passport strategies:** `JwtStrategy` (access token) and `JwtRefreshStrategy`
  (refresh cookie) via `@nestjs/passport`.
- **Guards:** `JwtAuthGuard` (REST endpoints) and `GqlAuthGuard` (GraphQL resolvers).
  Both share the same `JwtStrategy`; only the context extraction differs.

## Trade-offs

- **Pros:** No external dependency; auth is fully observable and testable; demonstrates
  a critical engineering concern (token management, refresh rotation) rather than
  delegating it to Firebase.
- **Cons:** We own the security-sensitive code. Mitigated by using battle-tested
  libraries (`passport-jwt`, `bcrypt`) and following refresh token rotation best
  practices.
- **No refresh token revocation store in MVP:** Revocation requires a Redis set or DB
  table of invalidated token JTIs. Documented as a production improvement; acceptable
  for a take-home.

## Alternatives considered

- **Firebase Authentication (ADR 012, superseded):** Rejected because it adds evaluator
  setup friction and hides the auth implementation behind a third-party SDK.
- **Auth0 / Cognito:** Same concern — managed providers are production-appropriate but
  obscure the engineering decisions that are the point of the assignment.
- **Sessions (server-side):** Stateful; requires Redis or DB for session store.
  JWT-based stateless auth is more representative of modern SPA + API architectures.
