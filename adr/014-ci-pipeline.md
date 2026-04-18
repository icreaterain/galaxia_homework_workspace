# 014 — CI/CD Pipeline: GitHub Actions, deployment targets, pnpm v10 native deps, validation status codes

**Date:** 2026-04-02
**Status:** Decided

## Context

Both submodule repos needed automated quality gates and deployment pipelines. Each repo has
two workflow files: `ci.yml` (quality + build) and `deploy.yml` (production deployment).
Several non-obvious decisions arose during implementation: pnpm v10's new default of
blocking dependency lifecycle scripts, the correct HTTP status for validation errors, e2e
test parallelism against a shared database, how the frontend obtains the GraphQL schema,
the choice of deployment targets (Cloud Run vs Firebase Hosting), and how to avoid storing
long-lived GCP credentials in GitHub secrets.

## Decisions

### 1. GitHub Actions with a `quality` + `build` job structure

Each repo has a single `.github/workflows/ci.yml` with two jobs:
- **`quality`** — lint, format check, type-check, tests (and e2e for BE). Must pass first.
- **`build`** — production build, gated on `quality`. Catches template compiler errors not
  caught by `tsc --noEmit` (Angular) and verifies `nest build` compiles cleanly (NestJS).

The `build` job is separate so a build failure does not hide test output, and so test
results are always visible even if the build breaks.

### 2. pnpm v10 `onlyBuiltDependencies` for native packages

pnpm v10 blocks dependency lifecycle scripts (`install`, `postinstall`) by default as a
supply-chain security measure. This causes `bcrypt` to fail with a missing native binding
(`bcrypt_lib.node`) because its `node-pre-gyp` download never runs.

The fix is the `pnpm.onlyBuiltDependencies` allowlist in `package.json`:

```json
"pnpm": {
  "onlyBuiltDependencies": ["@prisma/client", "bcrypt", "prisma"]
}
```

These three packages are known to require their install scripts:
- `bcrypt` — downloads or compiles the native binding
- `prisma` / `@prisma/client` — downloads the query engine binary and generates the client

No other lifecycle scripts are needed, so the allowlist remains minimal.

### 3. `ValidationPipe` errors return 422, not 400

NestJS's `ValidationPipe` defaults to `BadRequestException` (400). The API design convention
(see `.cursor/rules/api-design.mdc`) specifies HTTP **422 Unprocessable Entity** for all
validation failures, consistently across REST and the error vocabulary.

The fix is `errorHttpStatusCode: HttpStatus.UNPROCESSABLE_ENTITY` on every `ValidationPipe`
instantiation — in `main.ts` and in every e2e `beforeAll` that wires up its own pipe. E2e
tests must replicate the global pipe settings exactly or they will assert the wrong status.

### 4. E2e tests run with `maxWorkers: 1`

The four e2e spec files share a single Postgres database. When Jest runs them in parallel
(the default), test suites can observe each other's data — for example, the reviews e2e
creates a product and reviews that the products e2e may query. This caused spurious 409
(duplicate review) errors when suites overlapped.

Setting `"maxWorkers": 1` in `test/jest-e2e.json` forces sequential execution. Each suite
still isolates its own data via `afterAll` cleanup.

### 5. Frontend CI fetches `schema.graphql` from the BE repo with a shallow clone

FE CI must run `pnpm run codegen` before type-checking or running tests, because
`src/generated/graphql.ts` is gitignored and never committed. `codegen.ts` reads
`../galaxia_homework_be/schema.graphql` (the workspace-relative path used in local dev).

In CI the FE repo is checked out in isolation (`/home/runner/work/galaxia_homework_fe/`);
the BE submodule is not present. The FE CI workflow reconstructs the sibling directory
structure with a shallow clone:

```yaml
- name: Fetch BE repo for schema.graphql
  run: |
    SIBLING_DIR="$(dirname "$GITHUB_WORKSPACE")/galaxia_homework_be"
    git clone --depth=1 "$BE_REPO" "$SIBLING_DIR"
```

This satisfies ADR 011 (BE is the single source of truth for the schema) without committing
`schema.graphql` to the FE repo or requiring the backend server to be running.

Note: sparse checkout (`--filter=blob:none --sparse`) was tried first but fails with
`'schema.graphql' is not a directory` in Git's default cone mode. A full shallow clone
(`--depth=1`) is used instead; the BE repo is small enough that this adds minimal CI time.

### 6. `NODE_ENV=test` override after loading `.env`

`test/setup-env.ts` loads `.env` (and `.env.local`) via `load-env.ts`, which uses
`override: true`. This means a `.env` that sets `NODE_ENV=development` will override
Jest's own `NODE_ENV=test`, causing `PrismaService` to log all `prisma:error` events to
stdout. Handled errors (e.g. P2002 on duplicate review) then produce misleading log output
in e2e runs.

The fix is a single line at the end of `setup-env.ts`:

```typescript
process.env.NODE_ENV = 'test';
```

`PrismaService` checks `process.env.NODE_ENV === 'test'` and reduces its log profile to
`warn`-only, suppressing the `prisma:error` stdout stream for expected constraint violations.

### 7. GCP Workload Identity Federation — no JSON service-account key

Both deploy workflows authenticate to GCP using OpenID Connect (OIDC) via
`google-github-actions/auth@v2` with `workload_identity_provider` and `service_account`:

```yaml
- uses: google-github-actions/auth@v2
  with:
    workload_identity_provider: ${{ vars.GCP_WORKLOAD_IDENTITY_PROVIDER }}
    service_account: ${{ vars.GCP_SERVICE_ACCOUNT_EMAIL }}
```

No long-lived JSON key is stored in GitHub Secrets. The job requires `id-token: write`
permission to request a short-lived OIDC token from GitHub's token endpoint, which GCP
exchanges for a short-lived access token scoped to the service account.

### 8. Backend deployment: Docker → Artifact Registry → Cloud Run

The backend ships as a Docker image. The `deploy.yml` workflow builds a multi-stage image,
pushes it to Artifact Registry with both a commit-SHA tag and `latest`, then deploys to
Cloud Run with the SHA tag (pinned, not `latest`) for traceability. Production secrets
(`DATABASE_URL`, `JWT_SECRET`, `CORS_ORIGIN`, etc.) are set directly on the Cloud Run
service rather than baked into the image or passed as build args.

The multi-stage `Dockerfile` copies the full `node_modules` from the builder stage to the
runner stage (rather than re-installing with `--prod`) because pnpm's virtual store embeds
the Prisma-generated client at a version-specific path that a clean production install would
not reproduce correctly.

### 9. Frontend deployment: Firebase Hosting + `public/env.js` runtime config

The Angular SPA is deployed to Firebase Hosting. `firebase.json` configures two rewrites
before the catch-all Angular SPA route:
- `/api/**` → Cloud Run service `galaxia-be`
- `/graphql` → same Cloud Run service

This means the frontend and the API share one origin in production; no CORS preflight is
needed for API calls from the SPA.

API base URLs are injected at deploy time via `public/env.js`, which sets `window.__env`.
The file is committed with localhost defaults (for local dev) and overwritten by the deploy
workflow before `ng build`. Services read `window.__env.API_URL` / `window.__env.GRAPHQL_URL`
with a fallback to `http://localhost:3000`. This decouples the production URL from the build
artefact — the same `dist/` could be deployed to a different origin simply by regenerating
`env.js`.

## Trade-offs

| Decision | Trade-off |
|---|---|
| `onlyBuiltDependencies` allowlist | Must be updated if a new native-binding dependency is added. Running `pnpm approve-builds` locally and committing the updated `package.json` is the documented path. |
| `maxWorkers: 1` for e2e | E2e suite is slower (sequential). Acceptable for the current suite size (~30 tests). Long-term fix: per-suite DB resets. |
| Shallow BE clone in FE CI | Adds a network call per CI run. Will fail if the BE repo is private and the runner does not have read access. For private repos, replace the anonymous clone with a `GITHUB_TOKEN` credential or a machine-user PAT stored as a secret. |
| 422 in `beforeAll` | E2e test setup must mirror `main.ts` exactly. A future refactor extracting `createApp()` into a shared test helper would eliminate the duplication. |
| Copy full `node_modules` in Dockerfile | Larger image (~300 MB vs ~80 MB for a prod-only install). Trade-off for correctness of the Prisma virtual-store path. Long-term fix: evaluate `prisma generate --generator-output` to a deterministic path. |
| `window.__env` injected at deploy time | `public/env.js` is committed with localhost defaults; a developer could accidentally ship the dev file if the deploy step is skipped. Mitigated by the CI `deploy` job always overwriting the file before building. |
| Workload Identity Federation | Requires one-time GCP setup (pool + provider + IAM binding). More complex to provision than a JSON key, but eliminates credential rotation risk. |

## Alternatives considered

**Commit `schema.graphql` to the FE repo:** Rejected per ADR 011. The BE is the source of
truth; a committed copy in the FE repo can drift and produces misleading green CI.

**Sparse checkout for `schema.graphql`:** Tried. Git cone mode treats sparse-checkout paths
as directories; `schema.graphql` is a file, so `git sparse-checkout set schema.graphql`
exits 128 unless `--no-cone` / `--skip-checks` is set. Shallow full clone is simpler.

**`errorHttpStatusCode` globally via `app.module.ts`:** Possible but non-standard. The
`ValidationPipe` is a NestJS global pipe registered in `main.ts`; adding it to the module
as a provider creates two pipes. The correct pattern is to set it in `main.ts` and replicate
it exactly in e2e `beforeAll`.

**Bake `API_URL` into the Angular build via `environment.ts`:** Angular's build-time
environment substitution would work but couples every environment change to a rebuild + redeploy.
The `window.__env` approach allows the same build artefact to be pointed at a different
backend by regenerating `env.js` only.

**Store a GCP JSON service-account key in GitHub Secrets:** Simpler to provision but
creates a long-lived credential that must be rotated and can be exfiltrated. OIDC
Workload Identity Federation is stateless and rotation-free.

**Deploy BE to Cloud Run via Docker Compose:** Out of scope for an automated CD pipeline;
retained `docker-compose.yml` only for local Postgres.
