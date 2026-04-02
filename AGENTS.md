# AGENTS.md — Product Reviews System

This file is the entry point for AI agents working in this repository.
Read it fully before writing any code. Update it after any significant change.

For Cursor-specific context, rules, and skills, see [`WORKSPACE.md`](WORKSPACE.md).
For architecture decisions and rationale, see [`adr/`](adr/README.md).
For current system state (stack, schema, API), see [`ARCHITECTURE.md`](ARCHITECTURE.md).

---

## Project in One Paragraph

A full-stack **product review system** (Amazon/Alza-style). Users browse a seeded product
catalog, register, and submit star-rated reviews with text. The backend exposes a **hybrid
REST + GraphQL API**: REST handles all write commands (auth, review mutations); GraphQL
handles all reads (product queries, paginated review lists with aggregates). The frontend
is an Angular SPA that uses Angular's `HttpClient` for REST and Apollo Angular for GraphQL.

---

## Repository Layout

```
cloudtalk_homework/            ← this workspace (git superproject)
├── cloudtalk_homework_be/     ← NestJS API (git submodule)
├── cloudtalk_homework_fe/     ← Angular SPA (git submodule)
├── adr/                       ← Architecture Decision Records
├── scripts/                   ← setup and submodule helpers
├── AGENTS.md                  ← you are here
├── ARCHITECTURE.md            ← current system overview
└── WORKSPACE.md               ← Cursor-specific agentic context
```

Work only in the submodule that owns the concern you are changing.
Never write backend logic in the frontend repo or vice versa.

---

## Stack (Decided)

| Layer | Technology |
|---|---|
| Frontend framework | Angular 17+ (standalone components, signals) |
| Frontend styling | Tailwind CSS |
| Frontend GraphQL | Apollo Angular + `graphql-codegen` |
| Backend framework | NestJS with Fastify adapter |
| Backend API | Hybrid REST (`/api/*`) + GraphQL (`/graphql`) |
| Backend GraphQL | `@nestjs/graphql@^12` + `@apollo/server@^4` + `graphql@^16` (pinned for NestJS v10) |
| ORM | Prisma |
| Database | PostgreSQL 16 |
| Auth | JWT — access token (15 min, in-memory) + refresh token (7 days, httpOnly cookie) |
| Logging | pino (via Fastify) |
| Testing | Jest (both repos) |
| CI | GitHub Actions (`quality` + `build` + `deploy` jobs per repo) |
| Backend hosting | Google Cloud Run (managed, `us-central1`) |
| Frontend hosting | Firebase Hosting (SPA + rewrites to Cloud Run) |
| GCP auth | Workload Identity Federation (OIDC — no JSON keys in secrets) |
| Local dev | Docker Compose (Postgres only) |

Decisions not yet reached by implementation are marked **TBD** in `ARCHITECTURE.md`.
Do not assume the TBD items — check that file first.

---

## Architecture: How REST and GraphQL Coexist

```
Angular SPA
  ├── HttpClient  ──POST/PUT/DELETE──▶  /api/*       (REST controllers)
  └── Apollo      ──POST /graphql──▶    /graphql      (GraphQL resolvers)
                                             │
                                       Service Layer   (shared, protocol-agnostic)
                                             │
                                       Prisma Client
                                             │
                                       PostgreSQL
```

- REST controllers and GraphQL resolvers both inject the **same service layer**.
- Services contain all business logic and do not know which protocol called them.
- REST for commands (create/update/delete review, auth flows).
- GraphQL for reads (product queries, paginated reviews, aggregates).

---

## API Surface

### REST (`/api/*`)

```
POST   /api/auth/register
POST   /api/auth/login             → sets httpOnly refresh cookie
POST   /api/auth/refresh           → exchanges refresh cookie for new access token
POST   /api/auth/logout

POST   /api/products/:productId/reviews    ← auth required
PUT    /api/reviews/:id                    ← auth required, owner only
DELETE /api/reviews/:id                    ← auth required, owner only

GET    /api/health
GET    /api/health/ready
```

Response envelope:
```json
{ "data": { ... } }                       // success
{ "error": { "code": "...", "message": "...", "statusCode": 422 } }   // error
```

### GraphQL (`/graphql`)

Key queries (expand as schema grows):

```graphql
product(id: ID!): Product
products(first: Int, after: String, filter: ProductFilterInput): ProductConnection
myReviews(first: Int, after: String): ReviewConnection
```

Product includes nested: `avgRating`, `reviewCount`, `ratingDistribution`,
`reviews(first, after, sort, filterByRating)`.

---

## Data Model (Current Draft)

```
users         id, email (UNIQUE), display_name, password_hash (bcrypt), role (user|admin)
products      id, name, description, image_url, category, price, avg_rating*, review_count*
reviews       id, user_id FK, product_id FK, rating (1-5), title?, body, status, UNIQUE(user_id, product_id)
review_votes  id, review_id FK, user_id FK, UNIQUE(review_id, user_id)      ← P1
```

`*` `avg_rating` and `review_count` are **denormalized** — recalculated inside
`ReviewsService` in the same transaction as every review write (create/update/delete).

---

## Coding Conventions

### Commit Messages (enforced by commitlint)

```
<type>(<scope>): <subject>

feat(reviews): add helpful votes endpoint
fix(auth): correct refresh token rotation on concurrent requests
docs(adr): add ADR 009 hybrid REST+GraphQL
```

Types: `feat` `fix` `refactor` `test` `docs` `chore` `perf`
BE scopes: `auth` `reviews` `products` `db` `api` `health` `common`
FE scopes: `auth` `reviews` `products` `shared` `graphql` `fe`

### TypeScript

- `strict: true` in both repos. No `any`. No implicit returns.
- Explicit return types on all public service and controller methods.
- Error handling: always `catch (e)` and log with context — never swallow silently.

### Backend File Naming

| File type | Convention |
|---|---|
| Controller | `reviews.controller.ts` |
| Service | `reviews.service.ts` |
| Resolver | `reviews.resolver.ts` |
| DTO | `create-review.dto.ts` |
| GraphQL model | `review.model.ts` |
| Guard | `jwt-auth.guard.ts` |

### Frontend File Naming

| File type | Convention |
|---|---|
| Component | `review-card.component.ts` |
| Service | `review-command.service.ts` |
| Guard | `auth.guard.ts` |
| Interceptor | `auth.interceptor.ts` |
| GQL queries | `review.queries.ts` |

### Never Edit

- `dist/` in either repo
- `src/generated/` in the FE repo (graphql-codegen output)
- `prisma/migrations/` auto-generated files — use `prisma migrate dev` to generate

---

## Backend Module Structure

```
src/
  auth/         controllers + service + strategies + guards + DTOs
  products/     resolver + service + models
  reviews/      controller + resolver + service + DTOs + models
  common/       decorators, filters, interceptors, middleware, scalars
  database/     prisma.module.ts + prisma.service.ts
  health/       health.controller.ts
  config/       configuration.ts (@nestjs/config, validated at startup)
```

---

## Frontend Structure

```
src/app/
  core/
    auth/         AuthService (signals), AuthGuard, AuthInterceptor, ErrorInterceptor
    graphql/      provideApollo() — InMemoryCache with cursor-merge for products + reviews
    http/         ErrorInterceptor (401 → silent refresh)
  features/
    products/     ProductListComponent (grid, search, category filter, load-more)
                  ProductDetailComponent (header, rating distribution chart, ReviewListComponent)
                  graphql/product.queries.ts
    reviews/      ReviewListComponent (sort, rating-filter, write/edit CTA, load-more)
                  ReviewFormComponent (create/edit, star picker, DUPLICATE_REVIEW handling)
                  ReviewCardComponent (owner-only edit/delete, exports ReviewCardData)
                  MyReviewsComponent (own reviews with product link, inline edit)
                  review-command.service.ts (REST: create/update/delete)
                  graphql/review.queries.ts
    auth/         LoginComponent, RegisterComponent
  shared/
    components/   StarRatingComponent, LoadingSpinnerComponent, ErrorMessageComponent,
                  PaginationComponent (Relay load-more)
    models/       auth.models.ts, review.models.ts (REST request/response interfaces)
    pipes/        TimeAgoPipe
  generated/      graphql-codegen output (run: pnpm run codegen)
```

---

## Environment Variables

### Backend `.env` (and optional `.env.local`)

`.env.local` overrides `.env` for the same key — used for machine-specific values (e.g. Supabase URLs). Both files are gitignored; only `.env.example` is committed.

```
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/reviews_dev
DIRECT_URL=postgresql://postgres:postgres@localhost:5432/reviews_dev
JWT_SECRET=change-me-in-production
JWT_ACCESS_EXPIRY=15m
JWT_REFRESH_EXPIRY=7d
CORS_ORIGIN=http://localhost:4200
PORT=3000
NODE_ENV=development
```

`DIRECT_URL` is required by the Prisma schema (`directUrl`). Local dev: same value as `DATABASE_URL`. Supabase: `DATABASE_URL` = pooled URL (port 6543), `DIRECT_URL` = direct URL (port 5432).

### Frontend `.env`

```
API_URL=http://localhost:3000/api
GRAPHQL_URL=http://localhost:3000/graphql
```

These files are developer reference only — the SPA reads API URLs from `window.__env` at runtime (`public/env.js`). The deploy workflow overwrites `public/env.js` with production values before building and deploying to Firebase Hosting.

---

## Local Setup

```bash
# Clone workspace with submodules
git clone --recurse-submodules <workspace-url>
cd cloudtalk_homework
./scripts/setup.sh           # init submodules + pnpm install

# Start database
docker compose up -d

# Backend (new terminal)
cd cloudtalk_homework_be
cp .env.example .env
# Optional: create .env.local with machine-specific overrides (gitignored, wins over .env)
pnpm install                 # also runs prisma generate via postinstall
pnpm run migrate             # prisma migrate dev — local only, runs seed automatically
# For production: cp .env.production.example .env.production, fill Supabase URLs, then:
# pnpm run migrate:prod       # prisma migrate deploy against production
pnpm run dev                 # http://localhost:3000

# Frontend (new terminal)
cd cloudtalk_homework_fe
cp .env.example .env
pnpm start                   # http://localhost:4200
```

Demo credentials (seeded): `user@demo.com / password123`, `admin@demo.com / password123`

---

## Running Tests

```bash
# Backend — unit + e2e
cd cloudtalk_homework_be && pnpm test && pnpm run test:e2e

# Frontend — unit
cd cloudtalk_homework_fe && pnpm test
```

---

## Quality Gates

Before any commit:
- `pnpm exec tsc --noEmit` — zero type errors
- `pnpm run lint:check` — zero ESLint errors
- `pnpm test` — all tests pass

In CI (GitHub Actions — `.github/workflows/ci.yml` in each repo):

**Backend CI** (`quality` job):
- lint (`lint:check`), format check, `tsc --noEmit`
- unit tests with coverage (`test:cov`)
- Postgres service container for e2e tests (`test:e2e`)
- schema freshness: `pnpm run schema:export` + `git diff --exit-code schema.graphql`

**Frontend CI** (`quality` job):
- shallow-clone BE repo (`git clone --depth=1`) into sibling path for `schema.graphql` (ADR 011)
- codegen (`pnpm run codegen`) — generates `src/generated/graphql.ts` from fetched schema
- lint, format check, `tsc --noEmit` (app + spec tsconfigs)
- unit tests via Angular CLI jest builder (`test:ci`)

Both repos also have a `build` job gated on `quality`.

**Deployment CI** (`deploy` job — `.github/workflows/deploy.yml`, runs on push to `main`):

- **Backend**: authenticate to GCP via Workload Identity Federation → build + push Docker image to Artifact Registry → deploy to Cloud Run.
- **Frontend**: shallow-clone BE schema → codegen → write `public/env.js` with production `window.__env` → `ng build` → deploy to Firebase Hosting.

---

## Cross-Repo Change Protocol

When an API contract changes (new field, renamed type, new endpoint):

1. Implement the change in `cloudtalk_homework_be/` and merge to `main`
2. Run `pnpm run schema:export` in the BE — commit the updated `schema.graphql`
3. Implement the FE change — CI will run `pnpm run codegen` against the new schema automatically
4. Implement the FE change and merge to `main`

Never merge a FE change that depends on an unmerged BE change.

---

## Implementation Phases

Track progress here as phases complete. Update status and add links to key commits.

| Phase | Scope | Status |
|---|---|---|
| 0 | Docker Compose, rewrite ADRs, update docs | **complete** |
| 1 | NestJS + Fastify + Prisma scaffold, schema, migrations, seed | **complete** |
| 2 | Auth module (register, login, refresh, logout, guards) | **complete** |
| 3 | GraphQL setup + product queries with pagination | **complete** |
| 4 | Review CRUD (REST writes + GraphQL reads + aggregate recalc) | **complete** |
| 5 | Polish (exception filters, correlation IDs, helmet, throttler) | **complete** |
| 6 | Angular scaffold + Apollo Angular + Tailwind + codegen | **complete** |
| 7 | Frontend auth flow (AuthService, interceptors, login/register) | **complete** |
| 8 | Frontend features (product list/detail, review list/form/card) | **complete** |
| 9 | CI/CD pipelines (GitHub Actions, quality gates) | **complete** |
| 10 | Documentation finalization (READMEs, ADRs, trade-offs) | pending |

---

## P0 / P1 / P2 Feature Scope

**P0 (must ship):** auth, product list + detail, review CRUD, aggregates, pagination,
error handling, health checks, seed data, unit + e2e tests, CI, READMEs.

**P1 (high value):** helpful votes, "My Reviews" page, rating distribution chart,
GraphQL codegen pipeline, OpenAPI spec, correlation ID middleware, rate limiting.

**P2 (stretch):** moderation dashboard, Playwright smoke test, response caching,
multi-stage Dockerfiles, REST type generation with openapi-typescript.

---

## Key Trade-offs (document more in README as implementation progresses)

| Simplification | Production alternative |
|---|---|
| Denormalized `avg_rating` recalculated synchronously | Decouple via event/queue to avoid write amplification |
| No shared types package (manual REST interface sync) | `openapi-typescript` generates FE types from OpenAPI spec |
| Single-instance API (no Redis, no queue) | Add Redis for caching + rate limiting; read replicas for Postgres |
| No E2E tests in MVP | Playwright critical-path smoke test (P1) |
| No refresh token invalidation store | Token family tracking in DB or Redis for revocation |

---

## Documentation Maintenance

After any change, update the relevant file:

| What changed | Update |
|---|---|
| Architectural decision | `adr/NNN-title.md` (new file) + `adr/README.md` (index row) |
| Current system state | `ARCHITECTURE.md` |
| Conventions, ports, env vars, workflow | `WORKSPACE.md` + this file |
| Phase completed | Implementation Phases table in this file |
| New P0/P1 item shipped | Move it to appropriate section above |

See `.cursor/skills/extend-agentic-docs/SKILL.md` for the full documentation maintenance protocol.
