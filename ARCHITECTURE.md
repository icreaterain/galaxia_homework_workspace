# Architecture Overview

Current state of the system design. Update this file as the implementation evolves.
For the reasoning behind each choice, see the [ADR log](adr/README.md).

---

## System Diagram

```
[Browser]
    │
    ▼
[Angular SPA]  ──HTTP/JSON──▶  [Node.js REST API]  ──▶  [PostgreSQL]
  :4200                            :3000                    :5432
```

---

## Stack

| Layer | Technology | ADR |
|---|---|---|
| Frontend | Angular (TypeScript, standalone components) | [001](adr/001-stack.md) |
| Backend | Node.js + TypeScript (NestJS or Express — TBD) | [003](adr/003-backend-framework.md) |
| API style | REST / JSON | [002](adr/002-rest-over-graphql.md) |
| Database | PostgreSQL | [004](adr/004-postgresql.md) |
| ORM / DB access | Prisma or TypeORM — TBD | [005](adr/005-orm.md) |
| Authentication | JWT (access token in memory + httpOnly refresh cookie) | [006](adr/006-jwt-auth.md) |
| Local dev | Docker Compose | [008](adr/008-docker-compose.md) |

---

## Data Model

```
users
  id          UUID PK
  email       TEXT UNIQUE NOT NULL
  password    TEXT NOT NULL          -- bcrypt hash
  created_at  TIMESTAMPTZ

products
  id          UUID PK
  name        TEXT NOT NULL
  description TEXT
  image_url   TEXT
  created_at  TIMESTAMPTZ

reviews
  id          UUID PK
  user_id     UUID FK → users.id
  product_id  UUID FK → products.id
  rating      SMALLINT NOT NULL      -- CHECK (1..5)
  body        TEXT
  created_at  TIMESTAMPTZ
  updated_at  TIMESTAMPTZ
  UNIQUE(user_id, product_id)        -- one review per user per product
```

Aggregates (`avg_rating`, `review_count`) are computed on-the-fly via SQL.
A materialized view or caching layer can be added if performance becomes a concern.

---

## API Surface

```
POST   /auth/register
POST   /auth/login                   -- sets httpOnly refresh cookie
POST   /auth/refresh                 -- exchanges refresh cookie for new access token
POST   /auth/logout                  -- clears refresh cookie

GET    /products                     -- public
GET    /products/:id                 -- public, includes avg_rating + review_count
GET    /products/:id/reviews         -- public
POST   /products/:id/reviews         -- auth required
PUT    /reviews/:id                  -- auth required, owner only
DELETE /reviews/:id                  -- auth required, owner only
```

---

## Key Constraints

- One review per user per product — enforced by DB unique constraint ([ADR 007](adr/007-one-review-per-user.md))
- Reading reviews is public; writing requires authentication
- Password hashes stored with bcrypt; plaintext passwords never persisted or logged
- Access tokens are never stored in localStorage — in-memory only on the frontend

---

## Frontend Structure (planned)

```
src/app/
  core/
    auth/           -- AuthService, AuthGuard, token interceptor
    http/           -- base API service, error interceptor
  features/
    products/       -- product list, product detail page
    reviews/        -- review form, review card, review list
  shared/
    components/     -- star-rating, error-message, loading-spinner
    models/         -- Review, Product, User interfaces
```

---

## Backend Structure (planned)

```
src/
  auth/             -- register, login, refresh, logout
  products/         -- list, detail with aggregated rating
  reviews/          -- CRUD, ownership guard
  common/           -- pipes, guards, interceptors, exceptions
  database/         -- DB module, migrations
```
