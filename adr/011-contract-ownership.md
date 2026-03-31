# 011 — Contract ownership: OpenAPI + GraphQL SDL

**Date:** 2026-03-31
**Status:** Decided

## Context

Two separate repositories consume a single API. Without a defined ownership model for
API contracts, the frontend may consume fields that no longer exist, or the backend may
rename types that the frontend depends on. This is especially important for GraphQL,
where the schema is the primary contract surface.

## Decision

**The backend is the single source of truth for all API contracts.**

### GraphQL contract

- The backend uses `@nestjs/graphql` in **code-first** mode (`autoSchemaFile: true`).
  The schema is auto-generated from TypeScript decorators at build time.
- A `pnpm run schema:export` script in the BE repo writes the canonical `schema.graphql`
  file (committed to the BE repo).
- `src/generated/` is **gitignored** in the FE repo. The file is never committed.
- In FE CI, codegen runs as a build step before `tsc` and the test runner:
  1. Check out the workspace (BE submodule brings `schema.graphql`)
  2. `pnpm run codegen` — generates `src/generated/` from `schema.graphql`
  3. `pnpm exec tsc --noEmit`, `pnpm run lint`, `pnpm test` — all run against fresh generated types
- Local dev: developers run `pnpm run codegen` once after cloning, and again whenever
  `schema.graphql` changes. The codegen config points to `schema.graphql` via the
  relative workspace path (`../cloudtalk_homework_be/schema.graphql`), so it never
  requires the backend server to be running.

### REST contract

- `@nestjs/swagger` decorators on all REST controllers auto-generate `openapi.json`.
- For MVP, the frontend maintains REST response interfaces manually in
  `src/app/shared/models/`. There are only ~6 REST endpoints (auth + review mutations),
  so drift is manageable.
- A **P1 improvement** is to use `openapi-typescript` to auto-generate these interfaces
  from `openapi.json`.

### Cross-repo change protocol

When an API contract changes:
1. Implement the change in `cloudtalk_homework_be/` and merge to `main`.
2. Run `pnpm run schema:export` — commit the updated `schema.graphql` to the BE repo.
3. Implement the FE change; CI will run `pnpm run codegen` against the new schema automatically.
4. Merge the FE change to `main`.

Never merge a FE change that depends on an unmerged BE change.

## Trade-offs

- **GraphQL codegen eliminates manual type sync** for read paths — the highest-risk area
  for contract drift.
- **Generated files not committed** keeps the FE repo free of machine-generated noise
  and eliminates stale-generated-file bugs. The cost is that every CI run and every
  fresh clone requires a codegen step before the TypeScript compiler can run.
- **`schema.graphql` is committed to the BE repo** (not generated at runtime) so FE CI
  never needs the backend server running — it reads the file directly from the submodule.
- **Manual REST interface sync** is a known risk for the ~6 write endpoints. Acceptable
  for MVP; mitigated by TypeScript compiler catching shape mismatches at build time.

## Alternatives considered

- **Commit `src/generated/` to the FE repo:** Avoids the CI codegen step but introduces
  stale-generated-file bugs and pollutes git history with machine-generated churn.
  Rejected in favour of generating in CI.
- **Shared package on the npm registry for types:** Eliminates the codegen step but adds a versioning
  and publish workflow for an internal package. Overkill for two repos.
- **Runtime introspection against a live backend:** FE CI would need the backend running
  as a service container. More complex and slower than reading a committed schema file.
