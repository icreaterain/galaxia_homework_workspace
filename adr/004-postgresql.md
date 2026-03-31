# 004 — PostgreSQL as the database

**Date:** 2026-03-31
**Status:** Decided

## Context

Reviews require relational integrity (user → review → product), aggregate queries
(AVG rating), and a unique constraint (one review per user per product).

## Decision

PostgreSQL.

## Trade-offs

- Requires Docker for local setup (but Docker Compose is used anyway).
- More setup than SQLite, but SQLite has limitations with concurrent writes.

## Alternatives considered

MongoDB — rejected: no natural enforcement of a unique review constraint; aggregation
pipeline is more complex than a simple SQL AVG.
