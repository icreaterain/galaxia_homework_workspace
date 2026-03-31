# 006 — JWT authentication strategy

**Date:** 2026-03-31
**Status:** Decided

## Context

The app needs stateless auth that works with an Angular SPA.

## Decision

Short-lived JWT access token (15 min) stored in memory on the frontend.
Refresh token (7 days) stored in an httpOnly, Secure, SameSite=Strict cookie.

## Trade-offs

- httpOnly cookie prevents XSS theft of the refresh token.
- Access token in memory means it is lost on page reload — the frontend must call the
  refresh endpoint on app boot to silently re-acquire a new access token.
- More complex than a simple localStorage JWT, but meaningfully more secure.

## Alternatives considered

Session cookies + server-side session store — rejected: adds statefulness to the API,
requires a session store (Redis or DB), complicates horizontal scaling.

Access token in localStorage — rejected: vulnerable to XSS.
