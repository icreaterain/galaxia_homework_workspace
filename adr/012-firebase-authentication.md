# 012 — Firebase Authentication as identity provider (superseded)

**Date:** 2026-03-31
**Status:** Superseded by [006 — Self-managed JWT authentication](006-jwt-auth.md)

## Original decision (no longer in force)

Use Firebase Authentication as the managed identity provider. The Angular app handles
sign-up and sign-in via the Firebase JS SDK. The NestJS API verifies Firebase ID tokens
via the Admin SDK and never stores passwords.

## Supersession

Firebase Authentication was reverted in favour of self-managed JWT auth ([ADR 006](006-jwt-auth.md))
for two reasons:

1. **Evaluator friction:** Requires a Google Cloud / Firebase project, service account
   credentials, and a Firebase emulator for local testing — significant setup overhead
   that is not part of the assignment scope.
2. **Hidden implementation:** Auth is a core engineering concern. Delegating it to
   Firebase makes the take-home less demonstrative of the candidate's ability to reason
   about token management, refresh rotation, and secure cookie handling.

The application reverts to a self-managed bcrypt + JWT stack (access token in memory,
refresh token in httpOnly cookie) as described in [ADR 006](006-jwt-auth.md).
