# 010 — Two-repository structure (git submodules)

**Date:** 2026-03-31
**Status:** Decided

## Context

The project has a backend (NestJS API) and a frontend (Angular SPA) that are
independently deployable, have separate dependency graphs, and run different CI
pipelines. They can evolve at different speeds as long as the API contract is respected.

## Decision

Maintain **two separate git repositories** (`cloudtalk_homework_be`,
`cloudtalk_homework_fe`) linked as **git submodules** under a workspace root
(`cloudtalk_homework`).

- Each repo has its own `package.json`, `tsconfig.json`, `.eslintrc`, `.env.example`,
  `Dockerfile`, CI pipeline, and `README.md`.
- The workspace root holds shared infrastructure: `docker-compose.yml`, `scripts/`,
  `adr/`, `ARCHITECTURE.md`, `WORKSPACE.md`, `AGENTS.md`.
- Submodule pointers in the workspace root are updated together whenever a cross-repo
  change lands on `main` in both repos.

## Trade-offs

- **Independent deployment:** BE and FE can be deployed, scaled, and versioned
  independently.
- **Separate CI pipelines:** Each repo runs its own lint, typecheck, and test jobs.
  The BE pipeline includes e2e tests against a Postgres service container. The FE
  pipeline includes a codegen freshness check.
- **Cross-repo friction:** When an API contract changes, both repos must be updated in
  the correct order (BE first, FE second). This is documented and enforced by convention
  (see [ADR 011](011-contract-ownership.md) and the cross-repo skill).
- **Submodule UX:** `git clone --recurse-submodules` is required; documented in the
  workspace README. A `scripts/setup.sh` helper handles post-clone init.

## Alternatives considered

- **Monorepo (nx or turborepo):** Stronger tooling for cross-repo refactors and shared
  types, but adds build tooling complexity and is overkill for two repos with a clean
  API boundary.
- **Single repository:** Simplest setup, but conflates deployment units and complicates
  CI (running the full test suite for a minor frontend change).
