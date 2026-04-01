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
}

type ReviewAuthor {
  id: ID!
  displayName: String!
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

## GraphQL Setup (Phase 3)

`GraphQLModule` is registered in `AppModule` using the Apollo driver (code-first):

```typescript
GraphQLModule.forRoot<ApolloDriverConfig>({
  driver: ApolloDriver,
  autoSchemaFile: true,          // generates schema.graphql in-memory; use path for CI export
  sortSchema: true,
  context: ({ request }) => ({ req: request }),  // exposes req for GqlAuthGuard
})
```

**Key decisions:**
- `@nestjs/graphql@^12` + `@apollo/server@^4` — pinned to NestJS v10-compatible versions
  (v13 / Apollo v5 require NestJS v11+)
- `autoSchemaFile: true` during development; `pnpm run schema:export` writes `schema.graphql`
  to disk for the FE codegen pipeline
- `GqlAuthGuard` (already in `src/auth/guards/`) reads the request from `GqlExecutionContext`
  and delegates to the same `jwt` Passport strategy used by REST guards
- All GraphQL reads are unauthenticated by default; individual resolvers or fields apply
  `@UseGuards(GqlAuthGuard)` as needed

**Cursor-based pagination pattern** (Relay connections):

```
ProductConnection { edges: [ProductEdge!]!, pageInfo: PageInfo!, totalCount: Int! }
ProductEdge       { node: Product!, cursor: String! }
PageInfo          { hasNextPage: Boolean!, endCursor: String }
```

Cursor encodes `createdAt` (ISO string) as base64. Utilities live in
`src/common/pagination/` (created in Phase 3).

---

## Backend Module Structure

> **Phases 1–2 implemented.** `auth/`, `common/decorators/`, `common/filters/` are on disk.
> Phase 3 target: `products/` module (GraphQL queries). Phases 4–5: `reviews/` and remaining `common/`.

```
src/
  main.ts                       # Bootstrap: Fastify adapter, ValidationPipe, CORS, /api prefix,
                                #   global HttpExceptionFilter
  app.module.ts                 # Root module — ConfigModule (global), PrismaModule, HealthModule,
                                #   AuthModule
  config/
    configuration.ts            # Typed AppConfig + Joi validation schema; .env + .env.local loaded
  database/
    prisma.module.ts            # @Global() module
    prisma.service.ts           # Extends PrismaClient; onModuleInit/Destroy lifecycle
  health/
    health.module.ts
    health.controller.ts        # GET /api/health (liveness) + GET /api/health/ready (readiness)
  auth/                         # ✅ Phase 2
    auth.module.ts              # PassportModule, JwtModule (async), strategies, controller, service
    auth.controller.ts          # POST /api/auth/register|login|refresh|logout
    auth.service.ts             # bcrypt hash/compare, JWT sign (access + refresh), ConflictException
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
  common/                       # ✅ Phase 2 (partial)
    decorators/
      current-user.decorator.ts # @CurrentUser() — reads req.user set by Passport (REST only)
    filters/
      http-exception.filter.ts  # Global: HttpException → { error: { code, message, statusCode } }

  # --- Phase 3 target ---
  products/
    products.module.ts
    products.resolver.ts        # @Query() product(id), products(first, after, filter)
    products.service.ts         # findById, findAll with cursor pagination
    models/
      product.model.ts          # @ObjectType()
      product-connection.model.ts
      product-filter.input.ts   # @InputType()
      rating-distribution.model.ts

  # --- Phases 4–5 target ---
  reviews/
    reviews.module.ts
    reviews.controller.ts       # REST: POST /products/:id/reviews, PUT/DELETE /reviews/:id
    reviews.resolver.ts         # @ResolveField() reviews on Product; @Query() myReviews
    reviews.service.ts          # Business logic, aggregate recalc in same transaction
    dto/
      create-review.dto.ts
      update-review.dto.ts
    models/
      review.model.ts
      review-connection.model.ts
      review-sort.enum.ts
  common/                       # Phase 5 additions
    filters/
      gql-exception.filter.ts
    interceptors/
      logging.interceptor.ts
    middleware/
      correlation-id.middleware.ts
    scalars/
      date-time.scalar.ts
```

---

## Frontend Structure

```
src/app/
  core/
    auth/
      auth.service.ts           # Signals: isLoggedIn, currentUser; token management
      auth.guard.ts
      auth.interceptor.ts       # Attaches JWT to REST requests
    graphql/
      graphql.provider.ts       # Apollo Client configuration
    http/
      error.interceptor.ts      # 401 → silent token refresh
  features/
    products/
      product-list.component.ts
      product-detail.component.ts
      graphql/
        product.queries.ts
    reviews/
      review-list.component.ts
      review-form.component.ts
      review-card.component.ts
      graphql/
        review.queries.ts
      review-command.service.ts  # REST: create/update/delete
    auth/
      login.component.ts
      register.component.ts
  shared/
    components/
      star-rating/
        star-rating.component.ts
      loading-spinner.component.ts
      error-message.component.ts
      pagination.component.ts
    models/                     # TypeScript interfaces for REST responses
    pipes/
      time-ago.pipe.ts
  generated/                    # graphql-codegen output — gitignored; run `pnpm run codegen`
```

---

## Key Constraints

- One review per user per product — DB unique constraint + 409 Conflict response ([ADR 007](adr/007-one-review-per-user.md))
- Reading reviews is public; writing requires authentication
- `avg_rating` and `review_count` are kept consistent by `ReviewsService` within the same transaction
- REST endpoints own writes; GraphQL resolvers own reads — never cross the boundary
- The backend is the single source of truth for all API contracts ([ADR 011](adr/011-contract-ownership.md))

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

### Frontend (`.env`)

```
API_URL=http://localhost:3000/api
GRAPHQL_URL=http://localhost:3000/graphql
```

---

## Implementation Status

| Phase | Scope | Status |
|---|---|---|
| 0 | Docker Compose, rewrite ADRs, update docs | **Complete** |
| 1 | NestJS + Fastify + Prisma scaffold, schema, migrations, seed | **Complete** |
| 2 | Auth module (register, login, refresh, logout, guards) | **Complete** |
| 3 | GraphQL setup + product queries with pagination | Pending |
| 4 | Review CRUD (REST writes + GraphQL reads + aggregate recalc) | Pending |
| 5 | Polish (exception filters, correlation IDs, helmet, throttler) | Pending |
| 6 | Angular scaffold + Apollo Angular + Tailwind + codegen | Pending |
| 7 | Frontend auth flow (AuthService, interceptors, guard, login/register) | Pending |
| 8 | Frontend features (product list/detail, review list/form/card) | Pending |
| 9 | CI/CD pipelines (GitHub Actions, quality gates) | Pending |
| 10 | Documentation finalization (READMEs, ADRs, trade-offs) | Pending |
