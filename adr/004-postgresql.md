# 004 — PostgreSQL as the database

**Date:** 2026-03-31
**Status:** Decided

## Context

Reviews require relational integrity (user → review → product), aggregate queries
(AVG rating, review count), and a unique constraint (one review per user per product).
The application must run locally and be deployable to a managed cloud service.

## Decision

**PostgreSQL 16** as the database engine.

- **Local dev:** plain Postgres 16-alpine container via Docker Compose (workspace root).
- **Production (documented, not wired):** Supabase-hosted Postgres. The application
  connects via a standard `DATABASE_URL` and is Supabase-agnostic — switching to any
  other Postgres provider requires only an env-var change.

## Trade-offs

- Requires Docker for local setup, but Docker Compose is used anyway for consistency.
- More setup than SQLite, but SQLite lacks concurrent write reliability and is not a
  production-representative choice.
- Denormalized `avg_rating` and `review_count` columns on the `products` table avoid
  per-request aggregation queries (see [ADR 009](009-hybrid-rest-graphql.md) for
  trade-off details).

## Alternatives considered

- **MongoDB:** Rejected — no natural enforcement of the unique review constraint;
  aggregation pipeline is more complex than SQL AVG.
- **SQLite:** Rejected — concurrent write limitations; not representative of a production
  stack.
- **MySQL:** Valid, but Postgres has better JSON support, native UUID type, and stronger
  ANSI SQL compliance.
