# Architecture Overview

Current state of the system design. Update this file as the implementation evolves.
For the reasoning behind each choice, see the [ADR log](adr/README.md).

---

## System Diagram

```
[Browser]
    │
    ▼
[Angular SPA :4200]
    ├── HttpClient  ──POST/PUT/DELETE──▶  /api/*     [NestJS + Fastify :3000]
    └── Apollo      ──POST /graphql──▶   /graphql   [Apollo Server]
                                              │
                                         Service Layer
                                              │
                                         Prisma Client
                                              │
                                       [PostgreSQL :5432]
```

REST handles all command-oriented writes (auth, review mutations).
GraphQL handles all read-oriented composed views (product queries, paginated reviews with
aggregates). Both protocols share the same service layer. See [ADR 009](adr/009-hybrid-rest-graphql.md).

---

## Stack

| Layer | Technology | ADR |
|---|---|---|
| Frontend | Angular 17+ (standalone components, signals) | [001](adr/001-stack.md) |
| Frontend styling | Tailwind CSS | — |
| Frontend GraphQL | Apollo Angular + graphql-codegen | [011](adr/011-contract-ownership.md) |
| Backend framework | NestJS with Fastify adapter | [003](adr/003-backend-framework.md) |
| API style | Hybrid REST (`/api/*`) + GraphQL (`/graphql`) | [009](adr/009-hybrid-rest-graphql.md) |
| ORM | Prisma | [005](adr/005-orm.md) |
| Database | PostgreSQL 16 | [004](adr/004-postgresql.md) |
| Authentication | Self-managed JWT (bcrypt + access/refresh tokens) | [006](adr/006-jwt-auth.md) |
| Local dev | Docker Compose (Postgres only) | [008](adr/008-docker-compose.md) |
| Testing | Jest (unit + e2e BE), Jest via @angular-builders/jest (FE) | [013](adr/013-testing-strategy.md) |
| CI | GitHub Actions (`quality` + `build` + `deploy` jobs, both repos) | [014](adr/014-ci-pipeline.md) |
| Backend hosting | Google Cloud Run (managed, `us-central1`) | — |
| Frontend hosting | Firebase Hosting (static SPA + rewrites to Cloud Run) | — |
| Container registry | Google Artifact Registry (`us-central1`) | — |
| GCP auth | Workload Identity Federation (no JSON service-account key) | [014](adr/014-ci-pipeline.md) |

---

## Data Model

```
users
  id            UUID PK
  email         TEXT UNIQUE NOT NULL
  display_name  TEXT NOT NULL
  password_hash TEXT NOT NULL           -- bcrypt, cost 12
  role          TEXT NOT NULL DEFAULT 'user'   -- user | admin
  created_at    TIMESTAMPTZ
  updated_at    TIMESTAMPTZ

products
  id            UUID PK
  name          TEXT NOT NULL
  description   TEXT
  image_url     TEXT
  category      TEXT
  price         DECIMAL NOT NULL
  avg_rating    DECIMAL NOT NULL DEFAULT 0   -- denormalized, recalculated on every review write
  review_count  INT NOT NULL DEFAULT 0       -- denormalized, recalculated on every review write
  created_at    TIMESTAMPTZ
  updated_at    TIMESTAMPTZ

reviews
  id            UUID PK
  user_id       UUID FK → users.id NOT NULL
  product_id    UUID FK → products.id NOT NULL
  rating        SMALLINT NOT NULL CHECK (rating >= 1 AND rating <= 5)
  title         TEXT                         -- optional
  body          TEXT NOT NULL                -- max 5000 chars
  status        TEXT NOT NULL DEFAULT 'published'  -- published | flagged | removed
  created_at    TIMESTAMPTZ
  updated_at    TIMESTAMPTZ
  UNIQUE(user_id, product_id)               -- one review per user per product

review_votes  (P1)
  id            UUID PK
  review_id     UUID FK → reviews.id NOT NULL
  user_id       UUID FK → users.id NOT NULL
  created_at    TIMESTAMPTZ
  UNIQUE(review_id, user_id)               -- one vote per user per review
```

`avg_rating` and `review_count` are **denormalized** — recalculated inside
`ReviewsService` in the same transaction as every review write (create/update/delete).
`ratingDistribution` (1–5 star counts) is computed on-the-fly via `GROUP BY rating`
only on the product detail page (acceptable cost for a single product).

---

## API Surface

### REST (`/api/*`)

| Method | Path | Auth | Description |
|---|---|---|---|
| POST | `/api/auth/register` | — | Create account |
| POST | `/api/auth/login` | — | Authenticate; sets httpOnly refresh cookie |
| POST | `/api/auth/refresh` | refresh cookie | Exchange refresh cookie for new access token |
| POST | `/api/auth/logout` | — | Clear refresh cookie |
| POST | `/api/products/:productId/reviews` | JWT | Create review |
| PUT | `/api/reviews/:id` | JWT (owner) | Update own review |
| DELETE | `/api/reviews/:id` | JWT (owner) | Delete own review |
| GET | `/api/health` | — | Liveness check |
| GET | `/api/health/ready` | — | Readiness check (verifies DB) |

**Response envelope:**
```json
{ "data": { ... } }
{ "error": { "code": "DUPLICATE_REVIEW", "message": "...", "statusCode": 409 } }
```

### GraphQL (`/graphql`)

```graphql
type Query {
  product(id: ID!): Product
  products(first: Int, after: String, filter: ProductFilterInput): ProductConnection
  myReviews(first: Int, after: String): ReviewConnection
}

type Product {
  id: ID!
  name: String!
  description: String
  imageUrl: String
  category: String
  price: Float!
  avgRating: Float!
  reviewCount: Int!
  ratingDistribution: RatingDistribution!
  reviews(first: Int, after: String, sort: ReviewSort, filterByRating: Int): ReviewConnection
}

type Review {
  id: ID!
  rating: Int!
  title: String
  body: String!
  createdAt: DateTime!
  updatedAt: DateTime!
  author: ReviewAuthor!
  helpfulCount: Int!
  viewerHasVotedHelpful: Boolean!
  product: ReviewProductInfo        # populated by myReviews query; null for Product.reviews
}

type ReviewAuthor {
  id: ID!
  displayName: String!
}

type ReviewProductInfo {
  id: ID!
  name: String!
  imageUrl: String
}

type RatingDistribution {
  oneStar: Int!
  twoStar: Int!
  threeStar: Int!
  fourStar: Int!
  fiveStar: Int!
}
```

Pagination uses Relay-style cursor connections (`first`/`after`, `edges`/`pageInfo`).
Cursor encodes the sort key as a base64 opaque string.

---

## GraphQL Setup

`GraphQLModule` is registered in `AppModule` using the Apollo driver (code-first):

```typescript
GraphQLModule.forRoot<ApolloDriverConfig>({
  driver: ApolloDriver,
  autoSchemaFile: true,          // generates schema.graphql in-memory; use path for CI export
  sortSchema: true,
  context: ({ request }) => ({ req: request }),  // exposes req for GqlAuthGuard / GqlCurrentUser
})
```

**Key decisions:**
- `@nestjs/graphql@^12` + `@apollo/server@^4` + `@nestjs/apollo@^12` + `@as-integrations/fastify@^2`
  — pinned to NestJS v10-compatible versions (v13 / Apollo v5 require NestJS v11+)
- `autoSchemaFile: true` during development; `pnpm run schema:export` writes `schema.graphql`
  to disk for the FE codegen pipeline
- `GqlAuthGuard` (in `src/auth/guards/`) reads the request from `GqlExecutionContext`
  and delegates to the same `jwt` Passport strategy used by REST guards
- All GraphQL reads are unauthenticated by default; individual resolvers apply
  `@UseGuards(GqlAuthGuard)` as needed (e.g. `myReviews`)
- **`HttpExceptionFilter`** (global) detects `'graphql'` context type and re-throws the
  exception; **`GqlExceptionFilter`** (also global) catches it and converts it to a
  `GraphQLError` with `extensions.code` matching the REST error vocabulary

**Cursor-based pagination pattern** (Relay connections):

```
ProductConnection { edges: [ProductEdge!]!, pageInfo: PageInfo!, totalCount: Int! }
ProductEdge       { node: Product!, cursor: String! }
PageInfo          { hasNextPage: Boolean!, hasPreviousPage: Boolean!,
                    startCursor: String, endCursor: String }
```

Cursor encodes the **row ID** as opaque base64 JSON (`{ id }`). Utilities live in
`src/common/pagination/` (cursor.util.ts + page-info.model.ts).

---

## Backend Module Structure

> **Phases 1–5 implemented.**

```
src/
  main.ts                       # Bootstrap: loads .env/.env.local, Fastify adapter,
                                #   Helmet, CORS, /api prefix, global filters + interceptor
  app.module.ts                 # Root: ConfigModule, ThrottlerModule, GraphQLModule,
                                #   PrismaModule, HealthModule, AuthModule, ProductsModule,
                                #   ReviewsModule; applies CorrelationIdMiddleware globally
  config/
    configuration.ts            # Typed AppConfig + Joi validation schema
    load-env.ts                 # Loads .env then .env.local with override:true (same as
                                #   dotenv-cli -o); imported first in main, seed, export-schema
  database/
    prisma.module.ts            # @Global() module
    prisma.service.ts           # Extends PrismaClient; onModuleInit/Destroy lifecycle
  health/
    health.module.ts
    health.controller.ts        # GET /api/health (liveness) + GET /api/health/ready (readiness)
  auth/                         # ✅ Phase 2
    auth.module.ts              # PassportModule, JwtModule (async), strategies, controller, service
    auth.controller.ts          # POST /api/auth/register|login|refresh|logout
                                #   ThrottlerBehindProxyGuard: register 5/min, login 10/min
    auth.service.ts             # bcrypt hash/compare, JWT sign (access + refresh)
    interfaces/
      jwt-payload.interface.ts  # JwtPayload { sub, email, role }, AuthenticatedUser
    strategies/
      jwt.strategy.ts           # Bearer token → validates user exists → returns AuthenticatedUser
      jwt-refresh.strategy.ts   # httpOnly cookie extractor → same validation
    guards/
      jwt-auth.guard.ts         # REST: extends AuthGuard('jwt')
      jwt-refresh.guard.ts      # REST: extends AuthGuard('jwt-refresh')
      gql-auth.guard.ts         # GraphQL: overrides getRequest() via GqlExecutionContext
    dto/
      register.dto.ts           # email, displayName, password (class-validator)
      login.dto.ts              # email, password
  common/                       # ✅ Phases 2–5
    decorators/
      current-user.decorator.ts   # @CurrentUser() — REST only (switchToHttp)
      gql-current-user.decorator.ts # @GqlCurrentUser() — GraphQL resolvers only
    filters/
      http-exception.filter.ts  # Global REST filter; skips GraphQL context (re-throws)
      gql-exception.filter.ts   # ✅ Phase 5 — maps HttpExceptions in resolvers to
                                #   GraphQLError with extensions.code (UNAUTHORIZED, FORBIDDEN…)
    guards/
      throttler-behind-proxy.guard.ts # ✅ Phase 5 — extracts real IP from X-Forwarded-For
    interceptors/
      logging.interceptor.ts    # ✅ Phase 5 — logs → and ← with method, URL, ms, correlationId
    middleware/
      correlation-id.middleware.ts # ✅ Phase 5 — generates/propagates X-Correlation-ID
    pagination/
      page-info.model.ts        # PageInfo @ObjectType with all four Relay fields
      cursor.util.ts            # encodeCursor(id) / decodeCursor(cursor) — opaque base64 JSON
  products/                     # ✅ Phase 3
    products.module.ts
    products.resolver.ts        # @Query() product(id) → nullable, products(first,after,filter)
    products.service.ts         # findById (throws), findByIdOptional (nullable), findMany
    models/
      product.model.ts          # @ObjectType()
      product-connection.model.ts # ProductConnection + ProductEdge
      product-filter.input.ts   # @InputType() — category, search
  reviews/                      # ✅ Phase 4
    reviews.module.ts
    reviews.controller.ts       # POST /api/products/:id/reviews (201) — 20 req/min
                                # PUT  /api/reviews/:id (200)
                                # DELETE /api/reviews/:id (204)
    reviews.resolver.ts         # @ResolveField() reviews, ratingDistribution on Product
                                # @Query() myReviews (GqlAuthGuard)
    reviews.service.ts          # create/update/delete with aggregate recalc in same tx
                                # findByProduct (sort, filterByRating, cursor pagination)
                                # findMyReviews, getRatingDistribution
    dto/
      create-review.dto.ts      # rating (1-5), title? (≤200), body (≤5000)
      update-review.dto.ts      # all fields optional
    models/
      review.model.ts           # @ObjectType()
      review-connection.model.ts # ReviewConnection + ReviewEdge
      review-author.model.ts    # @ObjectType() { id, displayName }
      rating-distribution.model.ts # oneStar..fiveStar Int! counts
      review-sort.enum.ts       # NEWEST | OLDEST | HIGHEST_RATING | LOWEST_RATING | MOST_HELPFUL
```

---

## Frontend Structure

> **Phases 6–8 implemented.**

```
src/
  app/
    app.component.ts            # Nav shell — logo, primary nav, auth actions, router-outlet
    app.config.ts               # provideRouter, provideHttpClient (interceptors), provideApollo,
                                #   APP_INITIALIZER (initFromSession)
    app.routes.ts               # Lazy-loaded routes; authGuard on /my-reviews
    core/
      auth/
        auth.service.ts         # Signals: isLoggedIn, currentUser, accessToken;
                                #   login/register/refresh/logout; sessionStorage persistence
        auth.service.spec.ts    # 16 unit tests; mocks Router to avoid navigation
        auth.guard.ts           # Functional canActivate; reads isLoggedIn() signal;
                                #   redirects to /auth/login?returnUrl=<original-path>
        auth.interceptor.ts     # Attaches Authorization: Bearer to all outgoing REST requests
      graphql/
        graphql.provider.ts     # provideApollo() — importProvidersFrom(ApolloModule),
                                #   InMemoryCache with cursor-merge for Query.products
                                #   and Product.reviews; cache-and-network fetch policy
      http/
        error.interceptor.ts    # Catches 401, calls /api/auth/refresh, retries original request
    features/
      products/
        product-list.component.ts   # Product grid (12/page); debounced search + category filter;
                                    #   QueryRef.watchQuery + signals + ChangeDetectorRef;
                                    #   first 4 images eager/high-priority, rest lazy
        product-detail.component.ts # Product header, price, rating summary (avg + distribution
                                    #   bar chart); embeds ReviewListComponent; refetches product
                                    #   on review mutation to keep avgRating/reviewCount live
        graphql/
          product.queries.ts        # PRODUCT_LIST_QUERY, PRODUCT_DETAIL_QUERY,
                                    #   PRODUCT_REVIEWS_QUERY — gql documents
      reviews/
        my-reviews.component.ts     # Auth-guarded; lists own reviews with product thumbnail/link;
                                    #   inline edit form; load-more pagination
        review-list.component.ts    # Review list for a product; sort + rating-filter controls;
                                    #   "Write a review" / "Edit your review" gates; load-more
        review-form.component.ts    # Dual-mode (create / edit); star picker + title + body;
                                    #   inline validation; DUPLICATE_REVIEW error mapping
        review-card.component.ts    # Single review card; edit/delete shown for owner only; OnPush
                                    #   exports ReviewCardData interface for parent components
        review-command.service.ts   # REST: createReview, updateReview, deleteReview
        graphql/
          review.queries.ts         # MY_REVIEWS_QUERY (includes product { id name imageUrl })
      auth/
        login.component.ts          # Reactive form (email + password); reads ?returnUrl;
                                    #   inline field errors + API error banner + loading state
        register.component.ts       # Reactive form (displayName + email + password);
                                    #   redirects to /products after success
    shared/
      components/
        star-rating/
          star-rating.component.ts  # Interactive + readonly; emits ratingChange; OnPush
        loading-spinner.component.ts  # size (sm/md/lg), label, fullPage inputs
        error-message.component.ts    # message + optional retryable/retry emitter
        pagination.component.ts       # Relay-style load-more; OnPush
      models/
        auth.models.ts              # LoginRequest, RegisterRequest, AuthUser, TokenResponse
        review.models.ts            # CreateReviewRequest, UpdateReviewRequest, ReviewResponse
      pipes/
        time-ago.pipe.ts            # Standalone pipe; "3d ago", "2mo ago", etc.
  generated/                        # graphql-codegen output — gitignored; run `pnpm run codegen`
  styles.css                        # Tailwind directives + .btn, .input, .card, .label utilities
```

---

## Key Constraints

- One review per user per product — DB unique constraint + 409 Conflict response ([ADR 007](adr/007-one-review-per-user.md))
- Reading reviews is public; writing requires authentication
- `avg_rating` and `review_count` are kept consistent by `ReviewsService` within the same transaction
- REST endpoints own writes; GraphQL resolvers own reads — never cross the boundary
- The backend is the single source of truth for all API contracts ([ADR 011](adr/011-contract-ownership.md))

---

## CI/CD

Both submodule repos have `.github/workflows/ci.yml` (GitHub Actions). See [ADR 014](adr/014-ci-pipeline.md) for the rationale behind each decision.

### Backend (`cloudtalk_homework_be`)

**`quality` job** — runs on every push / PR to `main`, with a Postgres 16 service container:

| Step | Command | Notes |
|---|---|---|
| Install | `pnpm install --frozen-lockfile` | `postinstall` runs `prisma generate` |
| Lint | `pnpm run lint:check` | ESLint, no auto-fix |
| Format | `pnpm run format:check` | Prettier check |
| Type-check | `pnpm exec tsc --noEmit` | |
| Unit tests | `pnpm run test:cov` | Jest with coverage |
| Migrate | `prisma migrate deploy` | Applies migrations to the CI Postgres container |
| E2E tests | `pnpm run test:e2e` | `maxWorkers: 1` — sequential to avoid shared-DB races |
| Schema check | `pnpm run schema:export && git diff --exit-code schema.graphql` | Fails if `schema.graphql` not committed |

**`build` job** — gated on `quality`; runs `nest build`.

**`deploy` job** — runs on every push to `main` (also `workflow_dispatch`); builds and deploys to production:

| Step | Detail |
|---|---|
| Authenticate to GCP | Workload Identity Federation via `google-github-actions/auth@v2` — no JSON key stored in secrets |
| Build Docker image | Tags `$IMAGE:$SHA` + `$IMAGE:latest`; `IMAGE` = `us-central1-docker.pkg.dev/<project>/<repo>/api` |
| Push to Artifact Registry | Both SHA and `latest` tags pushed |
| Deploy to Cloud Run | `gcloud run deploy cloudtalk-be --image $IMAGE:$SHA ...`; app env vars / secrets set on the Cloud Run service directly |

Required GitHub repo variables: `GCP_PROJECT_ID`, `GCP_AR_REPOSITORY`, `GCP_CLOUD_RUN_SERVICE`, `GCP_REGION`, `GCP_WORKLOAD_IDENTITY_PROVIDER`, `GCP_SERVICE_ACCOUNT_EMAIL`.

### Frontend (`cloudtalk_homework_fe`)

**`quality` job** — runs on every push / PR to `main`:

| Step | Command | Notes |
|---|---|---|
| Install | `pnpm install --frozen-lockfile` | |
| Fetch schema | `git clone --depth=1 <BE repo>` | Shallow clone into `../cloudtalk_homework_be/`; BE is source of truth (ADR 011) |
| Codegen | `pnpm run codegen` | Generates `src/generated/graphql.ts`; required before type-check or tests |
| Lint | `pnpm run lint:check` | |
| Format | `pnpm run format:check` | |
| Type-check app | `pnpm exec tsc --noEmit -p tsconfig.app.json` | |
| Type-check tests | `pnpm exec tsc --noEmit -p tsconfig.spec.json` | |
| Unit tests | `pnpm run test:ci` | `ng test --watch=false` via `@angular-builders/jest` |

**`build` job** — gated on `quality`; runs `ng build`.

**`deploy` job** — runs on every push to `main` (also `workflow_dispatch`); builds and deploys to production:

| Step | Detail |
|---|---|
| Fetch schema | Same shallow BE clone as `quality` |
| Codegen | `pnpm run codegen` |
| Write `public/env.js` | Injects `window.__env` with `API_URL` and `GRAPHQL_URL` at build time; defaults to `https://cloudtalk-homework.web.app/api` and `.../graphql`; overridable via repo variables `API_URL` / `GRAPHQL_URL` |
| Build | `pnpm run build` — output to `dist/cloudtalk_homework_fe/browser` |
| Authenticate to GCP | Workload Identity Federation |
| Deploy to Firebase Hosting | `firebase deploy --only hosting --project $FIREBASE_PROJECT_ID` |

`firebase.json` rewrites `/api/**` → Cloud Run service `cloudtalk-be` and `/graphql` → same; all other paths → `index.html` (Angular HTML5 routing).

Required GitHub repo variables: `GCP_WORKLOAD_IDENTITY_PROVIDER`, `GCP_SERVICE_ACCOUNT_EMAIL`, `FIREBASE_PROJECT_ID`. Optional: `API_URL`, `GRAPHQL_URL` (override defaults).

### Key CI environment

| Variable | Value in CI | Purpose |
|---|---|---|
| `DATABASE_URL` | `postgresql://postgres:postgres@localhost:5432/reviews_test` | Test DB |
| `DIRECT_URL` | same | Required by Prisma schema |
| `JWT_SECRET` | inline string (≥16 chars) | Satisfies Joi validation |
| `NODE_ENV` | `test` | Disables verbose Prisma logging; suppresses `prisma:error` for expected P2002 |
| `pnpm.onlyBuiltDependencies` | `["@prisma/client", "bcrypt", "prisma"]` | pnpm v10 blocks native build scripts by default |

---

## Environment Variables

### Backend (`.env` + optional `.env.local`)

`.env` holds defaults (committed via `.env.example`). `.env.local` holds machine-specific overrides (gitignored) — e.g. Supabase URLs. Nest and all Prisma scripts load both; `.env.local` wins for duplicate keys.

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

`DIRECT_URL` is required by `prisma/schema.prisma` (`directUrl = env("DIRECT_URL")`). For local Docker Postgres set it to the same value as `DATABASE_URL`. For Supabase, `DATABASE_URL` = pooled (PgBouncer, port 6543) and `DIRECT_URL` = direct Postgres (port 5432).

In production (Cloud Run) these are set directly on the service via `--set-env-vars` or Secret Manager; no `.env` file is used on the container. Set `CORS_ORIGIN` to the Firebase Hosting origin (e.g. `https://cloudtalk-homework.web.app`).

### Frontend

**Local dev (`.env`):**
```
API_URL=http://localhost:3000/api
GRAPHQL_URL=http://localhost:3000/graphql
```

These `.env` files are never read at runtime — they are for developer reference only.

**Production runtime (`public/env.js`):**

The SPA reads API URLs from `window.__env` at runtime — injected by `public/env.js`, which is a static file loaded before `main.js` via a `<script src="env.js">` in `index.html`. For local dev the committed file points to `localhost:3000`. The deploy workflow overwrites it with production URLs before the Firebase Hosting deployment:

```js
(function (window) {
  window.__env = {
    API_URL: 'https://cloudtalk-homework.web.app/api',
    GRAPHQL_URL: 'https://cloudtalk-homework.web.app/graphql',
  };
})(window);
```

Because Firebase Hosting rewrites `/api/**` and `/graphql` to the Cloud Run backend, the FE can use its own origin for API calls — there is no hard-coded backend URL in the production build.

---

## Implementation Status

| Phase | Scope | Status |
|---|---|---|
| 0 | Docker Compose, rewrite ADRs, update docs | **Complete** |
| 1 | NestJS + Fastify + Prisma scaffold, schema, migrations, seed | **Complete** |
| 2 | Auth module (register, login, refresh, logout, guards) | **Complete** |
| 3 | GraphQL setup + product queries with pagination | **Complete** |
| 4 | Review CRUD (REST writes + GraphQL reads + aggregate recalc) | **Complete** |
| 5 | Polish (exception filters, correlation IDs, helmet, throttler) | **Complete** |
| 6 | Angular scaffold + Apollo Angular + Tailwind + codegen | **Complete** |
| 7 | Frontend auth flow (AuthService, interceptors, guard, login/register) | **Complete** |
| 8 | Frontend features (product list/detail, review list/form/card) | **Complete** |
| 9 | CI/CD pipelines (GitHub Actions, quality gates) | **Complete** |
| 10 | Documentation finalization (READMEs, ADRs, trade-offs) | Pending |
