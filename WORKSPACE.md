# CloudTalk Homework — Agentic Workspace

This document is the primary context source for AI agents working in this repository.
It describes the project purpose, repository structure, operating conventions, and
everything that cannot be inferred from the code itself.

For the full architectural picture, see [ARCHITECTURE.md](ARCHITECTURE.md).
For decision rationale, see [adr/README.md](adr/README.md).
For the agent entry point, see [AGENTS.md](AGENTS.md).

---

## What This Project Is

A **product review system** (similar to Amazon or Alza), built as a full-stack
TypeScript application across two repositories.

Users browse a seeded product catalog, register accounts, and submit star-rated text
reviews. The backend exposes a hybrid REST + GraphQL API. The frontend is an Angular SPA
consuming both protocols.

**User groups:**
- Anonymous visitors — browse products, read reviews
- Authenticated users — create, edit, and delete their own reviews
- Admin (seeded) — moderate review status (P2)

**Core functional areas:**
1. Product catalog — list page and detail page with aggregated ratings
2. Review CRUD — create/edit/delete a review with 1–5 star rating and text body
3. Review aggregation — denormalized `avg_rating` + `review_count` per product
4. Authentication — self-managed JWT (register, login, refresh, logout)

---

## Repository Structure

This workspace coordinates two repositories linked as **git submodules**:

| Path | Repository | Role | Stack |
|---|---|---|---|
| `cloudtalk_homework_be/` | `cloudtalk_homework_be` | NestJS API + Prisma + PostgreSQL | Node.js + TypeScript |
| `cloudtalk_homework_fe/` | `cloudtalk_homework_fe` | Angular SPA | Angular + TypeScript |

The workspace root holds shared infrastructure:

| Path | Purpose |
|---|---|
| `docker-compose.yml` | Postgres 16-alpine for local dev |
| `scripts/` | setup.sh, submodule helpers |
| `adr/` | Architecture Decision Records |
| `mcp/cloudtalk-api/` | MCP server wrapping the REST + GraphQL API (see below) |
| `mcp/cloudtalk-db/` | MCP server for direct read-only DB access via Prisma (see below) |
| `ARCHITECTURE.md` | Current system state (stack, schema, API) |
| `WORKSPACE.md` | This file — developer + agent onboarding |
| `AGENTS.md` | Agent entry point and implementation phases |
| `.ai/` | Agent-agnostic rules, skills, guides (see `.ai/README.md`) |
| `mcp.json` | MCP server config for agents; paths are workspace-relative |
| `.cursor/mcp.json` | Same as `mcp.json` — Cursor loads this path for project MCP |

**MCP setup:** After clone, run `pnpm install` and `pnpm run build` in each of the two MCP packages:

```bash
cd mcp/cloudtalk-api && pnpm install && pnpm run build
cd mcp/cloudtalk-db  && pnpm install && pnpm run build
```

- **cloudtalk-api**: Wraps the running backend. Set `BASE_URL` env var to override (default `http://localhost:3000`). Optional: set `SCHEMA_PATH` if `schema.graphql` is not at `cloudtalk_homework_be/schema.graphql` relative to the workspace.
- **cloudtalk-db**: Connects directly to Postgres. Set `DATABASE_URL` env var to the connection string (default: `postgresql://postgres:postgres@localhost:5432/reviews_dev`). Single tool: `query` — accepts any read-only SQL `SELECT` and returns full-fidelity JSON (no truncation). Rejects any statement containing write/DDL keywords before it reaches the DB.

After cloning: `git clone --recurse-submodules <url>` then `./scripts/setup.sh`.

---

## Local Port Conventions

| Service | Default Port |
|---|---|
| Angular dev server | 4200 |
| NestJS API (REST + GraphQL) | 3000 |
| PostgreSQL | 5432 |

REST endpoints: `http://localhost:3000/api/*`
GraphQL endpoint: `http://localhost:3000/graphql`
GraphQL Playground: `http://localhost:3000/graphql` (in development mode)

---

## First-Time Setup

Use [pnpm](https://pnpm.io/) for installs and scripts (`corepack enable pnpm` on Node 20+).

```bash
# Clone with submodules
git clone --recurse-submodules <repo-url>
cd cloudtalk_homework

# Start database
docker compose up -d

# Backend
cd cloudtalk_homework_be
cp .env.example .env
# Optional: create .env.local with overrides (e.g. Supabase URLs) — gitignored, wins over .env
pnpm install             # also runs prisma generate via postinstall
pnpm run migrate:local   # prisma migrate dev — creates schema + runs seed automatically
pnpm run dev             # http://localhost:3000

# Frontend (separate terminal)
cd cloudtalk_homework_fe
cp .env.example .env
pnpm install
pnpm run codegen         # generate typed GQL services from schema.graphql (first time and after BE schema changes)
pnpm start               # http://localhost:4200
```

Demo credentials (seeded): `user@demo.com / password123`, `admin@demo.com / password123`

---

## Operating Conventions

### Commit Messages

Format: `<type>(<scope>): <subject>`

Types: `feat` `fix` `refactor` `test` `docs` `chore` `perf`

BE scopes: `auth` `reviews` `products` `db` `api` `health` `common`
FE scopes: `auth` `reviews` `products` `shared` `graphql` `fe`
Workspace scopes: `workspace` `docs` `adr`

```
feat(reviews): add helpful votes endpoint
fix(auth): correct refresh token rotation on concurrent requests
docs(adr): add ADR 009 hybrid REST+GraphQL
chore(workspace): add docker-compose.yml
```

### Branching

- `main` — production-ready code
- `feat/<description>` — feature branches
- `fix/<description>` — bug fix branches

### File Naming

| Layer | Convention | Example |
|---|---|---|
| Angular components | `kebab-case.component.ts` | `product-card.component.ts` |
| Angular services | `kebab-case.service.ts` | `review-command.service.ts` |
| Angular guards | `kebab-case.guard.ts` | `auth.guard.ts` |
| Angular interceptors | `kebab-case.interceptor.ts` | `auth.interceptor.ts` |
| GQL query documents | `kebab-case.queries.ts` | `review.queries.ts` |
| BE controllers | `kebab-case.controller.ts` | `reviews.controller.ts` |
| BE services | `kebab-case.service.ts` | `reviews.service.ts` |
| BE resolvers | `kebab-case.resolver.ts` | `reviews.resolver.ts` |
| BE DTOs | `kebab-case.dto.ts` | `create-review.dto.ts` |
| BE GraphQL models | `kebab-case.model.ts` | `review.model.ts` |
| BE guards | `kebab-case.guard.ts` | `jwt-auth.guard.ts` |
| DB migrations | auto-generated by Prisma | `20260401120000_create_reviews` |

### Never Edit

- `dist/` in either repo — compiled output
- `mcp/cloudtalk-api/dist/` and `mcp/cloudtalk-db/dist/` — gitignored compiled output; run `pnpm run build` in each package after clone
- `src/generated/` in the FE repo — graphql-codegen output; gitignored, generated in CI and locally via `pnpm run codegen`
- `prisma/migrations/` auto-generated files — use `prisma migrate dev` to generate

---

## Technology Decisions

| Concern | Choice | ADR |
|---|---|---|
| Frontend framework | Angular 17+ (standalone, signals) | [001](adr/001-stack.md) |
| Frontend styling | Tailwind CSS | — |
| Frontend GraphQL | Apollo Angular + graphql-codegen | [011](adr/011-contract-ownership.md) |
| Backend framework | NestJS with Fastify adapter | [003](adr/003-backend-framework.md) |
| API style | Hybrid REST + GraphQL | [009](adr/009-hybrid-rest-graphql.md) |
| ORM | Prisma | [005](adr/005-orm.md) |
| Database | PostgreSQL 16 | [004](adr/004-postgresql.md) |
| Authentication | Self-managed JWT (bcrypt + httpOnly cookie) | [006](adr/006-jwt-auth.md) |
| Local dev | Docker Compose (Postgres only) | [008](adr/008-docker-compose.md) |
| Testing | Jest (both repos) | — |
| Repo structure | Two repos as git submodules | [010](adr/010-two-repo-structure.md) |
| Contract ownership | OpenAPI + GraphQL SDL from backend | [011](adr/011-contract-ownership.md) |
| Agent API tooling | MCP `cloudtalk-api` (list / get_details / execute) | [015](adr/015-mcp-api-wrapper.md) |
| Agent DB tooling | MCP `cloudtalk-db` (read-only SQL `query`) | [016](adr/016-mcp-db-reader.md) |

---

## GraphQL Conventions

- Schema generated **code-first** from NestJS decorators (`@ObjectType`, `@Field`,
  `@InputType`, `@Resolver`) — `autoSchemaFile: true` in `GraphQLModule.forRoot`.
- Pagination uses **Relay-style cursor connections** (`first`/`after`, `edges`/`pageInfo`).
- All GraphQL read paths live in resolvers; all write paths live in REST controllers.
  Never add mutations to the GraphQL schema (the hybrid split is intentional).
- **`@CurrentUser()`** is REST-only — reads `req.user` via `switchToHttp()`.
  **`@GqlCurrentUser()`** is for GraphQL resolvers — reads user from `GqlExecutionContext`.
  Both are in `src/common/decorators/`. Use `@UseGuards(GqlAuthGuard)` on any resolver
  method that requires authentication (e.g. `myReviews`).
- **`HttpExceptionFilter`** (global) checks `host.getType() === 'graphql'` and re-throws
  without calling `reply.status()` — Apollo formats the error itself.
- The `schema.graphql` file is the contract artefact — export with `pnpm run schema:export`
  in the BE repo, then regenerate FE types with `pnpm run codegen` in the FE repo.

### Security Headers and Rate Limiting (Phase 5)

`@fastify/helmet` is registered in `main.ts` (CSP disabled in non-production to allow Apollo Sandbox).

`ThrottlerModule` is registered globally in `AppModule` with a 100 req/min default. Stricter
limits are applied per-endpoint via `@Throttle()`:

| Endpoint | Limit |
|---|---|
| `POST /api/auth/register` | 5 req/min |
| `POST /api/auth/login` | 10 req/min |
| `POST /api/products/:id/reviews` | 20 req/min |

Auth and review controllers use `ThrottlerBehindProxyGuard` (reads real IP from `X-Forwarded-For`).

### Correlation IDs (Phase 5)

`CorrelationIdMiddleware` (applied globally via `AppModule.configure`) generates a UUID4
correlation ID per request or forwards `X-Correlation-ID` if the header is already present.
The ID is attached to the raw Node request and echoed back in the response header.

`LoggingInterceptor` (global, HTTP only) logs `→` on entry and `←` on completion/error,
including method, URL, duration in ms, and the correlation ID.

### GraphQLModule Registration

Already registered in `AppModule`. Relevant packages (pinned to NestJS v10):

| Package | Version | Note |
|---|---|---|
| `@nestjs/graphql` | `^12` | v13+ requires NestJS v11 |
| `@nestjs/apollo` | `^12` | Apollo driver adapter |
| `@apollo/server` | `^4` | v5+ requires NestJS v11 |
| `@as-integrations/fastify` | `^2` | Fastify integration for Apollo v4 |
| `graphql` | `^16` | peer dep |

### Cursor Pagination Pattern

Relay-style cursor connections. Cursor = opaque base64 JSON encoding the **row ID**
(`{ id: "uuid" }`). Utilities: `encodeCursor(id)` / `decodeCursor(cursor)` in
`src/common/pagination/cursor.util.ts`.

```
XxxConnection { edges: [XxxEdge!]!, pageInfo: PageInfo!, totalCount: Int! }
XxxEdge       { node: Xxx!, cursor: String! }
PageInfo      { hasNextPage: Boolean!, hasPreviousPage: Boolean!,
                startCursor: String, endCursor: String }
```

Both `ProductConnection` and `ReviewConnection` follow this pattern.

### GraphQL Codegen Workflow

```bash
# In cloudtalk_homework_be/
pnpm run schema:export   # writes schema.graphql to repo root

# In cloudtalk_homework_fe/
pnpm run codegen         # reads schema.graphql, writes src/generated/
```

`src/generated/` is **gitignored**. CI runs `pnpm run codegen` before `tsc` and tests.

---

## Frontend Architecture (Phase 6+)

### App Bootstrap

`app.config.ts` wires all providers:

```typescript
provideRouter(routes, withComponentInputBinding())
provideHttpClient(withFetch(), withInterceptors([authInterceptor, errorInterceptor]))
provideAnimations()
provideApollo()                                     // Apollo Client + InMemoryCache
{ provide: APP_INITIALIZER, useFactory: initAuth }  // restores token from sessionStorage
```

`app.routes.ts` uses lazy-loaded routes for every feature. The `authGuard` (functional) protects
`/my-reviews`.

### Auth Pattern

`AuthService` (`src/app/core/auth/`) holds all auth state:

- Access token stored in `sessionStorage`, exposed as a `signal<string | null>`.
- `isLoggedIn` and `currentUser` are `computed()` signals — read them directly in templates with `()`.
- `initFromSession()` is called once via `APP_INITIALIZER` on app boot.
- **`authInterceptor`** — attaches `Authorization: Bearer <token>` to every outgoing request.
- **`errorInterceptor`** — catches 401 on non-auth URLs, calls `POST /api/auth/refresh` (httpOnly cookie),
  then retries the original request. On refresh failure, clears session.
- **`authGuard`** — redirects unauthenticated users to `/auth/login?returnUrl=<requested-path>`.
  `LoginComponent` reads this param and navigates back to it after a successful login.

No Firebase. No `localStorage`. Do not introduce NgRx or BehaviorSubject for auth state.

### Apollo Client

`provideApollo()` (`src/app/core/graphql/graphql.provider.ts`) returns `EnvironmentProviders`.

**Critical:** `ApolloModule` must be registered via `importProvidersFrom(ApolloModule)` inside
`makeEnvironmentProviders([...])`. Placing `ApolloModule` directly (without `importProvidersFrom`)
silently fails to register the `Apollo` service, causing `NullInjectorError: No provider for _Apollo!`
on lazy-loaded routes that inject generated GQL services.

Cache policy: `fetchPolicy: 'cache-and-network'`. Cursor pagination merge policies are configured for:
- **`Query.products`** — `keyArgs: ['filter']`; merges edges on subsequent `after` fetches; resets on new filter
- **`Product.reviews`** — `keyArgs: ['sort', 'filterByRating']`; same merge behaviour

Both use the shared `paginatedMerge` helper in `graphql.provider.ts`.

Reads `GRAPHQL_URL` from `window.__env?.GRAPHQL_URL` (runtime) falling back to `http://localhost:3000/graphql`.

### Data-fetching Component Pattern (Phase 8)

All data-fetching feature components (`ProductListComponent`, `ProductDetailComponent`,
`ReviewListComponent`, `MyReviewsComponent`) use the same structure:

```typescript
// 1. Inject the generated GQL service (not Apollo directly)
private readonly productListGQL = inject(ProductListGQL);
private readonly cdr = inject(ChangeDetectorRef);
private readonly destroy$ = new Subject<void>();

// 2. State as signals — compatible with OnPush
readonly loading = signal(true);
readonly queryError = signal('');
readonly items = signal<ItemType[]>([]);
readonly hasNextPage = signal(false);
readonly endCursor = signal<string | null>(null);

// 3. Start a watchQuery and subscribe to valueChanges
ngOnInit(): void {
  this.queryRef = this.productListGQL.watch({ first: PAGE_SIZE });
  this.queryRef.valueChanges.pipe(takeUntil(this.destroy$)).subscribe((result) => {
    this.loading.set(false);
    if (result.errors?.length) { this.queryError.set(...); return; }
    this.items.set(result.data.products.edges.map((e) => e.node));
    this.hasNextPage.set(result.data.products.pageInfo.hasNextPage);
    this.cdr.markForCheck();   // ← required because component uses OnPush
  });
}

// 4. Destroy
ngOnDestroy(): void { this.destroy$.next(); this.destroy$.complete(); }

// 5. Reload (sort/filter change)
reload(): void { void this.queryRef.refetch({ first: PAGE_SIZE, filter: ... }); }

// 6. Pagination
onLoadMore(): void { void this.queryRef.fetchMore({ variables: { after: this.endCursor() } }); }
```

`ChangeDetectorRef.markForCheck()` is **mandatory** in every subscription callback when the
component uses `OnPush` and updates signals inside a non-Angular zone (Apollo's observable).

### Environment Variables (Frontend)

```
API_URL=http://localhost:3000/api
GRAPHQL_URL=http://localhost:3000/graphql
```

Set in `.env` (gitignored). `.env.example` is committed. Values can be overridden at runtime via
`window.__env` (inject into `index.html` via a server-side script in production).

**Production (Firebase Hosting → Cloud Run):** `cloudtalk_homework_fe/firebase.json` rewrites
`/api/**` and `/graphql` to Cloud Run service `cloudtalk-be` in `us-central1`. The deploy workflow
writes `public/env.js` with defaults `https://cloudtalk-homework.web.app/api` and
`.../graphql` (overridable via GitHub repo variables `API_URL` / `GRAPHQL_URL`). One-time GCP:
grant the Firebase Hosting service account **Cloud Run Invoker** on that service (Firebase console
may prompt when first deploying rewrites). Set Cloud Run `CORS_ORIGIN` to the Hosting origin
(e.g. `https://cloudtalk-homework.web.app`).

### Jest / Testing

- Test runner: `@angular-builders/jest` invoked via `ng test` (`pnpm test`).
- `@angular-builders/jest` **automatically injects** `jest-preset-angular/setup-env/zone` into
  `setupFilesAfterEnv` — do **not** add it again in `jest.config.js` or `setup-jest.ts`.
  Calling `setupZoneTestEnv()` a second time throws "Cannot set base providers because it has
  already been called".
- `setup-jest.ts` is kept as a placeholder for custom global setup (mocks, matchers, etc.).
- Components that inject `AuthService` need `provideHttpClient()` + `provideRouter([])` in their spec.
- **Services that call `router.navigate()`** (e.g. `AuthService.logout()`) must receive a mock
  Router to avoid `NG04002: Cannot match any routes` errors in unit tests. Use a value provider
  instead of `provideRouter([])`:

```typescript
const mockRouter = { navigate: jest.fn().mockResolvedValue(true) };
providers: [
  provideHttpClient(),
  provideHttpClientTesting(),
  { provide: Router, useValue: mockRouter },
]
```

- Angular's static `Validators.*` methods (e.g. `Validators.required`, `Validators.email`) are
  safe to reference unbound in form definitions. The ESLint rule `@typescript-eslint/unbound-method`
  is configured with `ignoreStatic: true` in `cloudtalk_homework_fe/.eslintrc.js` for this reason.

### Shared Components

| Component | Location | Notes |
|---|---|---|
| `StarRatingComponent` | `shared/components/star-rating/` | Interactive (emits `ratingChange`) or readonly; `OnPush` |
| `LoadingSpinnerComponent` | `shared/components/` | `size` input (`sm`/`md`/`lg`), optional `label`, `fullPage` |
| `ErrorMessageComponent` | `shared/components/` | `message` + optional `retryable` flag + `retry` emitter |
| `PaginationComponent` | `shared/components/` | Relay-style load-more; shows count; `OnPush` |
| `TimeAgoPipe` | `shared/pipes/` | Standalone pipe; formats ISO date strings |

### Feature Review Components (Phase 8)

| Component | Location | Notes |
|---|---|---|
| `ReviewCardComponent` | `features/reviews/` | Displays a single review; edit/delete shown only for owner; exports `ReviewCardData` interface; `OnPush` |
| `ReviewFormComponent` | `features/reviews/` | Dual-mode create/edit; star picker + title + body; maps `DUPLICATE_REVIEW` error; exports `ReviewFormData` |
| `ReviewListComponent` | `features/reviews/` | Full review list for a product; sort + rating-filter controls; "Write a review" CTA; load-more pagination |

`ReviewListComponent` is self-contained — give it `[productId]` and listen to `(reviewsChanged)` to know when to refetch the parent product's aggregates.

---

## pnpm script conventions

Both repos use [pnpm](https://pnpm.io/) and these standardized script names:

| Command | Purpose |
|---|---|
| `pnpm run dev` | Start dev server with watch mode (BE only) |
| `pnpm start` | Start dev server (FE: `ng serve`) |
| `pnpm run build` | Production build |
| `pnpm test` | Run unit tests in watch mode (Jest) |
| `pnpm run test:ci` | Run unit tests once, no watch — used in FE CI (FE only) |
| `pnpm run test:cov` | Run unit tests with coverage report (BE only) |
| `pnpm run test:e2e` | Run integration/e2e tests (BE only) |
| `pnpm run lint:check` | ESLint check — no auto-fix, exits 1 on errors (used in CI) |
| `pnpm run lint` | ESLint check with auto-fix |
| `pnpm run format` | Prettier format (write) |
| `pnpm run format:check` | Prettier check (no write, for CI) |
| `pnpm run codegen` | Run graphql-codegen (FE only) |
| `pnpm run schema:export` | Export schema.graphql (BE only) |
| `pnpm run migrate:local` | `prisma migrate dev` — local dev (creates migration + runs seed, BE only) |
| `pnpm run migrate:deploy` | `prisma migrate deploy` — apply migrations to local DB without prompts |
| `pnpm run migrate:prod` | `prisma migrate deploy` against production DB (requires `.env.production`, BE only) |
| `pnpm run generate` | Regenerate Prisma Client after schema changes (BE only) |
| `pnpm run seed` | Run seed script directly — env loaded via `load-env.ts` (BE only) |
| `pnpm exec dotenv -o -e .env -e .env.local -- <cmd>` | Run any command with `.env` + `.env.local` (BE; avoid nested `pnpm run … --` — it breaks `dotenv-cli`) |
| `pnpm exec dotenv -o -e .env -e .env.production -- <cmd>` | Same with `.env.production` for prod DB (BE) |

---

## Running Tests

```bash
# Backend — unit tests
cd cloudtalk_homework_be && pnpm test

# Backend — e2e (requires running Postgres)
cd cloudtalk_homework_be && pnpm run test:e2e

# Frontend — unit tests
cd cloudtalk_homework_fe && pnpm test
```

---

## Quality Gates

Before any commit:
- `pnpm exec tsc --noEmit` — zero type errors
- `pnpm run lint:check` — zero ESLint errors
- `pnpm test` — all tests pass

In CI (GitHub Actions — `.github/workflows/ci.yml` in each submodule repo):

**Backend CI** (`quality` + `build` jobs):
- lint · format check · `tsc --noEmit`
- unit tests with coverage (`pnpm run test:cov`)
- Postgres 16 service container for e2e tests (`pnpm run test:e2e`)
- schema freshness check: `pnpm run schema:export` + `git diff --exit-code schema.graphql`
- production build (`pnpm run build`) — runs after quality gate passes

**Frontend CI** (`quality` + `build` jobs):
- shallow-clone BE repo into the sibling `../cloudtalk_homework_be/` path so `schema.graphql` is available (BE is the single source of truth per ADR 011)
- `pnpm run codegen` — generates `src/generated/graphql.ts` from the fetched schema
- lint · format check · `tsc --noEmit -p tsconfig.app.json` · `tsc --noEmit -p tsconfig.spec.json`
- unit tests via Angular CLI jest builder (`pnpm run test:ci`)
- production build (`pnpm run build`) — runs after quality gate passes

---

## Deployment

Both repos deploy on every `push` to `main` (also `workflow_dispatch`) via `.github/workflows/deploy.yml`.

### Backend → Google Cloud Run

The `deploy.yml` workflow:
1. Authenticates to GCP via **Workload Identity Federation** (OIDC, `google-github-actions/auth@v2`) — no long-lived JSON key.
2. Builds a multi-stage Docker image, pushes it to **Artifact Registry** (`us-central1`) with a commit-SHA tag.
3. Deploys to **Cloud Run** using the SHA tag.

Production environment variables (`DATABASE_URL`, `JWT_SECRET`, `CORS_ORIGIN`, etc.) are set directly on the Cloud Run service (not baked into the image). Set `CORS_ORIGIN` to the Firebase Hosting origin (e.g. `https://cloudtalk-homework.web.app`).

Required GitHub repo variables: `GCP_PROJECT_ID`, `GCP_AR_REPOSITORY`, `GCP_CLOUD_RUN_SERVICE`, `GCP_REGION`, `GCP_WORKLOAD_IDENTITY_PROVIDER`, `GCP_SERVICE_ACCOUNT_EMAIL`.

### Frontend → Firebase Hosting

The `deploy.yml` workflow:
1. Shallow-clones the BE repo for `schema.graphql` (same pattern as CI).
2. Runs `pnpm run codegen`.
3. Writes `public/env.js` with production `window.__env` values (defaults: `https://cloudtalk-homework.web.app/api` and `.../graphql`; overridable via repo variables `API_URL` / `GRAPHQL_URL`).
4. Runs `pnpm run build`.
5. Authenticates to GCP via Workload Identity Federation.
6. Deploys to **Firebase Hosting** via `firebase deploy --only hosting`.

`firebase.json` rewrites `/api/**` and `/graphql` to the Cloud Run service `cloudtalk-be`, so the SPA hits its own origin for all API calls (no CORS preflight in production).

Required GitHub repo variables: `GCP_WORKLOAD_IDENTITY_PROVIDER`, `GCP_SERVICE_ACCOUNT_EMAIL`, `FIREBASE_PROJECT_ID`.

### `public/env.js` — Runtime API Configuration

The Angular SPA reads API base URLs from `window.__env` at runtime:

```js
// public/env.js — committed with localhost defaults, overwritten by deploy workflow
(function (window) {
  window.__env = {
    API_URL: 'http://localhost:3000/api',
    GRAPHQL_URL: 'http://localhost:3000/graphql',
  };
})(window);
```

Services fall back to `http://localhost:3000` if `window.__env` is absent — safe for tests and local dev. Never read `.env` at runtime; those files are developer documentation only.

---

## Cross-Repo Change Protocol

When an API contract changes (new field, renamed type, new endpoint):

1. Implement the change in `cloudtalk_homework_be/` and merge to `main`
2. Run `pnpm run schema:export` in the BE — commit the updated `schema.graphql`
3. Implement the FE change — CI will run `pnpm run codegen` against the new schema automatically
4. Merge the FE change to `main`

Never merge a FE change that depends on an unmerged BE change.

See `.ai/skills/cross-repo-change/SKILL.md` for the full protocol.

---

## External Dependencies

- **PostgreSQL 16** — via Docker Compose locally; Supabase-hosted in production
- **Google Cloud Run** — production backend hosting (`us-central1`, service `cloudtalk-be`)
- **Google Artifact Registry** — Docker image store for Cloud Run deployments
- **Firebase Hosting** — production frontend hosting; rewrites to Cloud Run for `/api/**` and `/graphql`
- **No external auth provider** — self-managed JWT (see [ADR 006](adr/006-jwt-auth.md))
- **No CDN** — product images use placeholder URLs in MVP
- **`dotenv-cli`** (dev dep, BE repo) — invoked inline in `migrate:*`, `generate`, and
  `prisma:studio` scripts (`dotenv -o -e .env -e .env.local -- …`). Do not nest
  `pnpm run <script> -- …` around another script that already ends with `--` for dotenv.
- **`dotenv`** (dep, BE repo) — used by `src/config/load-env.ts`; imported as the first
  statement in `main.ts`, `prisma/seed.ts`, and `scripts/export-schema.ts` so that
  **`.env.local` always overrides `.env`** (and both override shell variables) without
  needing `dotenv-cli` on every npm script
- **`@nestjs/graphql@^12` + `@nestjs/apollo@^12` + `@apollo/server@^4` +
  `@as-integrations/fastify@^2` + `graphql@^16`** (BE repo) — pinned to NestJS v10-compatible
  versions; already installed and wired up in `AppModule`

---

## Agent Operating Guidelines

- Read `AGENTS.md` first — it is the universal entry point for all AI agents
- Read `.ai/rules/` for coding standards relevant to the file scope you are working in
- Read `.ai/skills/` for multi-step workflow guides before starting complex tasks
- Prefer editing existing files over creating new ones
- Follow the commit message format strictly — subject must be entirely lower-case
- Work only in the submodule that owns the concern you are changing
- Never write backend logic in the frontend repo or vice versa
- Use `gh` CLI for GitHub operations (PRs, issues, checks)
- After any significant architectural decision, add an ADR and update `ARCHITECTURE.md`
- After any change to structure, ports, env vars, or conventions, update this file
- Do not generate placeholder lorem ipsum — use realistic review/product data
