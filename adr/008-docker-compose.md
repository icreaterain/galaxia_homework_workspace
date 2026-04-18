# 008 — Docker Compose for local development

**Date:** 2026-03-31
**Status:** Decided

## Context

The assignment asks for easy evaluator setup. Running Postgres locally without Docker
adds friction for evaluators who may not have it installed.

## Decision

A root-level `docker-compose.yml` brings up **Postgres 16-alpine** with a single
`docker compose up -d`. The Angular dev server and NestJS API are run separately —
hot-reload makes containerizing dev servers impractical and slower to iterate on.

The Compose file exposes Postgres on the default port `5432` with credentials:
`postgres / postgres / reviews_dev`. These match the `DATABASE_URL` default in
`galaxia_homework_be/.env.example`.

## Trade-offs

- Evaluators need Docker Desktop installed. This is a common developer tool and an
  acceptable dependency.
- The API and frontend are not containerized for dev; `Dockerfile`s exist in each repo
  for production builds.
- A named volume (`pgdata`) persists data between container restarts so seed data
  survives `docker compose stop`.

## Alternatives considered

- **SQLite:** Rejected — concurrent write limitations and not representative of a
  production-like setup.
- **Manual Postgres install instructions:** Rejected — too much evaluator friction.
- **Containerize all three services:** Rejected for dev — rebuilding containers on code
  changes is too slow; hot-reload requires the process to run on the host.
