# 008 — Docker Compose for local dev

**Date:** 2026-03-31
**Status:** Decided

## Context

The assignment asks for easy setup. Running Postgres locally without Docker adds
friction for evaluators who may not have it installed.

## Decision

A root-level `docker-compose.yml` brings up Postgres (and optionally the backend API)
with a single `docker compose up -d`. The Angular dev server is run separately via
`ng serve` — hot-reload makes containerizing the FE dev server impractical.

## Trade-offs

- Evaluators need Docker Desktop installed.
- The FE is not containerized for dev (a production `Dockerfile` can be added later).

## Alternatives considered

SQLite — rejected: concurrent write limitations and less representative of a
production-like setup.

Manual Postgres install instructions — rejected: too much evaluator friction.
