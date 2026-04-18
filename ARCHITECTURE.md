# Architecture Overview

Current state of the system design. Update this file as the implementation evolves.
For the reasoning behind each choice, see the [ADR log](adr/README.md).

---

## System Diagram

```text
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
                                              ▲
                                              │ $queryRawUnsafe (read-only)
                                    [MCP galaxia-db]

[AI Agent / Cursor]
    ├── galaxia-api MCP ──HTTP──▶ /api/* + /graphql  (list / get_details / execute)
    └── galaxia-db  MCP ──────▶ PostgreSQL           (read-only SQL query → JSON)
```

REST handles all command-oriented writes (auth, review mutations).
GraphQL handles all read-oriented composed views (product queries, paginated reviews with
aggregates). Both protocols share the same service layer. See [ADR 009](adr/009-hybrid-rest-graphql.md).

---

## Stack

| Layer              | Technology                                                                    | ADR                                   |
| ------------------ | ----------------------------------------------------------------------------- | ------------------------------------- |
| Frontend           | Angular 17+ (standalone components, signals)                                  | [001](adr/001-stack.md)               |
| Frontend styling   | Tailwind CSS                                                                  | —                                     |
| Frontend GraphQL   | Apollo Angular + graphql-codegen                                              | [011](adr/011-contract-ownership.md)  |
| Backend framework  | NestJS with Fastify adapter                                                   | [003](adr/003-backend-framework.md)   |
| API style          | Hybrid REST (`/api/*`) + GraphQL (`/graphql`)                                 | [009](adr/009-hybrid-rest-graphql.md) |
| ORM                | Prisma                                                                        | [005](adr/005-orm.md)                 |
| Database           | PostgreSQL 16                                                                 | [004](adr/004-postgresql.md)          |
| Authentication     | Self-managed JWT (bcrypt + access/refresh tokens)                             | [006](adr/006-jwt-auth.md)            |
| Local dev          | Docker Compose (Postgres only)                                                | [008](adr/008-docker-compose.md)      |
| Testing            | Jest (unit + e2e BE), Jest via @angular-builders/jest (FE)                    | [013](adr/013-testing-strategy.md)    |
| CI                 | GitHub Actions (`quality` + `build` + `deploy` jobs, both repos)              | [014](adr/014-ci-pipeline.md)         |
| Backend hosting    | Google Cloud Run (managed, `us-central1`)                                     | —                                     |
| Frontend hosting   | Firebase Hosting (static SPA + rewrites to Cloud Run)                         | —                                     |
| Container registry | Google Artifact Registry (`us-central1`)                                      | —                                     |
| GCP auth           | Workload Identity Federation (no JSON service-account key)                    | [014](adr/014-ci-pipeline.md)         |
| Agent API tooling  | MCP `galaxia-api` — wraps REST + GraphQL API (list / get_details / execute) | [015](adr/015-mcp-api-wrapper.md)     |
| Agent DB tooling   | MCP `galaxia-db` — read-only SQL `query` tool returning JSON                | [016](adr/016-mcp-db-reader.md)       |

---

## Data Model

```text
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

| Method | Path                               | Auth           | Description                                  |
| ------ | ---------------------------------- | -------------- | -------------------------------------------- |
| POST   | `/api/auth/register`               | —              | Create account                               |
| POST   | `/api/auth/login`                  | —              | Authenticate; sets httpOnly refresh cookie   |
| POST   | `/api/auth/refresh`                | refresh cookie | Exchange refresh cookie for new access token |
| POST   | `/api/auth/logout`                 | —              | Clear refresh cookie                         |
| POST   | `/api/products/:productId/reviews` | JWT            | Create review                                |
| PUT    | `/api/reviews/:id`                 | JWT (owner)    | Update own review                            |
| DELETE | `/api/reviews/:id`                 | JWT (owner)    | Delete own review                            |
| GET    | `/api/health`                      | —              | Liveness check                               |
| GET    | `/api/health/ready`                | —              | Readiness check (verifies DB)                |

**Response envelope:**

```json
{ "data": { ... } }
{ "error": { "code": "DUPLICATE_REVIEW", "message": "...", "statusCode": 409 } }
```

### GraphQL (`/graphql`)

```graphql
type Query {
  product(id: ID!): Product
  products(
    first: Int
    after: String
    filter: ProductFilterInput
  ): ProductConnection
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
  reviews(
    first: Int
    after: String
    sort: ReviewSort
    filterByRating: Int
  ): ReviewConnection
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
  product: ReviewProductInfo # populated by myReviews query; null for Product.reviews
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
  autoSchemaFile: true,
  sortSchema: true,
  context: ({ request }) => ({ req: request }),
});
```

**Key decisions:**

- `@nestjs/graphql@^12` + `@apollo/server@^4` + `@nestjs/apollo@^12` + `@as-integrations/fastify@^2`
  — pinned to NestJS v10-compatible versions (v13 / Apollo v5 require NestJS v11+)
- `autoSchemaFile: true` during development; `pnpm run schema:export` writes `schema.graphql`
  to disk for the FE codegen pipeline
- `GqlAuthGuard` reads the request from `GqlExecutionContext`
  and delegates to the same `jwt` Passport strategy used by REST guards
- All GraphQL reads are unauthenticated by default; individual resolvers apply
  `@UseGuards(GqlAuthGuard)` as needed (e.g. `myReviews`)
- `HttpExceptionFilter` skips GraphQL context and re-throws; `GqlExceptionFilter`
  maps resolver errors to `GraphQLError` with REST-aligned `extensions.code`

**Cursor-based pagination pattern** (Relay connections):

```text
ProductConnection { edges: [ProductEdge!]!, pageInfo: PageInfo!, totalCount: Int! }
ProductEdge       { node: Product!, cursor: String! }
PageInfo          { hasNextPage: Boolean!, hasPreviousPage: Boolean!,
                    startCursor: String, endCursor: String }
```

Cursor encodes the **row ID** as opaque base64 JSON (`{ id }`). Utilities live in
`src/common/pagination/`.

---

## Backend Module Structure

> **Phases 1–5 implemented.**

```text
src/
  main.ts
  app.module.ts
  config/
    configuration.ts
    load-env.ts
  database/
    prisma.module.ts
    prisma.service.ts
  health/
    health.module.ts
    health.controller.ts
  auth/
    auth.module.ts
    auth.controller.ts
    auth.service.ts
    interfaces/
    strategies/
    guards/
    dto/
  common/
    decorators/
    filters/
    guards/
    interceptors/
    middleware/
    pagination/
  products/
    products.module.ts
    products.resolver.ts
    products.service.ts
    models/
  reviews/
    reviews.module.ts
    reviews.controller.ts
    reviews.resolver.ts
    reviews.service.ts
    dto/
    models/
```

---

## Frontend Structure

> **Phases 6–8 implemented.**

```text
src/
  app/
    app.component.ts
    app.config.ts
    app.routes.ts
    core/
      auth/
      graphql/
      http/
    features/
      products/
      reviews/
      auth/
    shared/
      components/
      models/
      pipes/
  generated/
  styles.css
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

### Backend (`galaxia_homework_be`)

**`quality` job** — runs on every push / PR to `main`, with a Postgres 16 service container:

| Step         | Command                                                         | Notes                                           |
| ------------ | --------------------------------------------------------------- | ----------------------------------------------- |
| Install      | `pnpm install --frozen-lockfile`                                | `postinstall` runs `prisma generate`            |
| Lint         | `pnpm run lint:check`                                           | ESLint, no auto-fix                             |
| Format       | `pnpm run format:check`                                         | Prettier check                                  |
| Type-check   | `pnpm exec tsc --noEmit`                                        |                                                 |
| Unit tests   | `pnpm run test:cov`                                             | Jest with coverage                              |
| Migrate      | `prisma migrate deploy`                                         | Applies migrations to the CI Postgres container |
| E2E tests    | `pnpm run test:e2e`                                             | `maxWorkers: 1`                                 |
| Schema check | `pnpm run schema:export && git diff --exit-code schema.graphql` | Fails if `schema.graphql` not committed         |

**`build` job** — gated on `quality`; runs `nest build`.

**`deploy` job** — runs on every push to `main` (also `workflow_dispatch`).

### Frontend (`galaxia_homework_fe`)

**`quality` job** — runs on every push / PR to `main`:

| Step             | Command                                        | Notes                                |
| ---------------- | ---------------------------------------------- | ------------------------------------ |
| Install          | `pnpm install --frozen-lockfile`               |                                      |
| Fetch schema     | `git clone --depth=1 <BE repo>`                | BE is source of truth                |
| Codegen          | `pnpm run codegen`                             | Generates `src/generated/graphql.ts` |
| Lint             | `pnpm run lint:check`                          |                                      |
| Format           | `pnpm run format:check`                        |                                      |
| Type-check app   | `pnpm exec tsc --noEmit -p tsconfig.app.json`  |                                      |
| Type-check tests | `pnpm exec tsc --noEmit -p tsconfig.spec.json` |                                      |
| Unit tests       | `pnpm run test:ci`                             |                                      |

**`build` job** — gated on `quality`; runs `ng build`.

**`deploy` job** — runs on every push to `main` (also `workflow_dispatch`).

---

## Environment Variables

### Backend (`.env` + optional `.env.local`)

```dotenv
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/reviews_dev
DIRECT_URL=postgresql://postgres:postgres@localhost:5432/reviews_dev
JWT_SECRET=change-me-in-production
JWT_ACCESS_EXPIRY=15m
JWT_REFRESH_EXPIRY=7d
CORS_ORIGIN=http://localhost:4200
PORT=3000
NODE_ENV=development
```

### Frontend

**Local dev (`.env`):**

```dotenv
API_URL=http://localhost:3000/api
GRAPHQL_URL=http://localhost:3000/graphql
```

**Production runtime (`public/env.js`):**

```js
(function (window) {
  window.__env = {
    API_URL: "https://galaxia-homework.web.app/api",
    GRAPHQL_URL: "https://galaxia-homework.web.app/graphql",
  };
})(window);
```

---

## Implementation Status

| Phase | Scope                                                                           | Status       |
| ----- | ------------------------------------------------------------------------------- | ------------ |
| 0     | Docker Compose, rewrite ADRs, update docs                                       | **Complete** |
| 1     | NestJS + Fastify + Prisma scaffold, schema, migrations, seed                    | **Complete** |
| 2     | Auth module (register, login, refresh, logout, guards)                          | **Complete** |
| 3     | GraphQL setup + product queries with pagination                                 | **Complete** |
| 4     | Review CRUD (REST writes + GraphQL reads + aggregate recalc)                    | **Complete** |
| 5     | Polish (exception filters, correlation IDs, helmet, throttler)                  | **Complete** |
| 6     | Angular scaffold + Apollo Angular + Tailwind + codegen                          | **Complete** |
| 7     | Frontend auth flow (AuthService, interceptors, guard, login/register)           | **Complete** |
| 8     | Frontend features (product list/detail, review list/form/card)                  | **Complete** |
| 9     | CI/CD pipelines (GitHub Actions, quality gates)                                 | **Complete** |
| 10    | Documentation finalization (READMEs, ADRs, trade-offs)                          | **Complete** |
| 11    | MCP tooling (`galaxia-api` API wrapper + `galaxia-db` read-only SQL reader) | **Complete** |

---

## Suggested Documentation Boundary

This file should remain the single source of truth for:

- architecture and system flow
- stack and hosting
- data model
- API contracts
- backend/frontend structure
- CI/CD
- environment variables
- implementation status

`AGENTS.md` should only summarize these topics and link here instead of duplicating them.
