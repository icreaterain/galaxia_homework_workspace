# 006 — JWT authentication strategy (historical)

**Date:** 2026-03-31
**Status:** Superseded by [012 — Firebase Authentication](012-firebase-authentication.md)

## Context

The app needs stateless auth that works with an Angular SPA.

## Original decision (no longer in force)

Short-lived JWT access token (15 min) stored in memory on the frontend.
Refresh token (7 days) stored in an httpOnly, Secure, SameSite=Strict cookie.

## Supersession

Identity is now provided by **Firebase Authentication**. The API verifies **Firebase ID tokens** (JWTs) via the Admin SDK instead of issuing its own access/refresh pair. See [ADR 012](012-firebase-authentication.md).

## Historical trade-offs (for reference)

- httpOnly cookie prevented XSS theft of the refresh token when we owned refresh ourselves.
- Self-managed auth required register/login endpoints and password storage in Postgres.
