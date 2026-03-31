# 012 — Firebase Authentication as identity provider

**Date:** 2026-03-31
**Status:** Decided

## Context

The product review system needs sign-up, sign-in, and authenticated API access. The previous approach ([ADR 006](006-jwt-auth.md)) was a self-managed JWT stack (register/login, bcrypt, refresh cookies) owned entirely by the backend.

We want a managed identity provider that reduces security-sensitive surface area in our code, provides battle-tested flows (email/password, optional social providers later), and keeps the NestJS API focused on **verifying** identity and **authorizing** domain actions.

## Decision

Use **Firebase Authentication** as the identity provider for end users.

- **Frontend (Angular):** Firebase JS SDK (`firebase/auth`) or AngularFire to handle sign-up, sign-in, sign-out, and token refresh. The client obtains a **Firebase ID token** (JWT) after authentication.
- **Backend (NestJS):** Does **not** implement `/auth/register`, `/auth/login`, or password storage. It uses the **Firebase Admin SDK** (`firebase-admin`) to **verify** the ID token on each protected request (`Authorization: Bearer <idToken>`). After verification, the API resolves or creates an application `User` row keyed by Firebase `uid`.
- **PostgreSQL:** The `users` table stores application data (`id`, `firebase_uid` UNIQUE, `email`, `display_name`, `role`, timestamps). **No password hash** is stored; credentials live in Firebase only.

Optional **bootstrap** endpoint (documented in ARCHITECTURE.md): e.g. `GET` or `POST /api/users/me` — first authenticated call creates the local user row from the verified token claims (email, display name) if missing.

## Trade-offs

- **Pros:** No password hashing or refresh-token rotation in our codebase; MFA and provider expansion available via Firebase; clear separation: Firebase = identity, API = product domain.
- **Cons:** External dependency and operational coupling to Google Cloud/Firebase; local dev requires a Firebase project (or emulator) and service account / web config; evaluators need `.env` with Firebase keys (documented in `.env.example`, never commit secrets).
- **Backend still owns API contracts:** Auth is verified at the edge of the API; business rules (e.g. one review per user) remain in NestJS + Postgres.

## Alternatives considered

- **Self-managed JWT (previous ADR 006):** Rejected for this revision in favor of Firebase to reduce auth implementation burden and demonstrate integration with a common production pattern.
- **Supabase Auth:** Could pair with Supabase-hosted Postgres; we keep Postgres + API ownership in NestJS and chose Firebase explicitly for identity.
- **Auth0 / Cognito:** Valid alternatives; Firebase was chosen for strong SPA SDK support and straightforward Admin token verification.

## Relation to ADR 006

[ADR 006](006-jwt-auth.md) is **superseded** by this record for identity and token issuance. The API still treats requests as **Bearer JWT** at the HTTP layer, but the token is a **Firebase ID token**, not an app-signed access token.
