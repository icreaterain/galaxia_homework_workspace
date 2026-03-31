# Architecture Overview

Current state of the system design. Update this file as the implementation evolves.
For the reasoning behind each choice, see the [ADR log](adr/README.md).

---

## System Diagram

```
[Browser]
    │
    ▼
[Angular SPA :4200] ── Firebase Auth SDK ──▶ [Firebase Authentication]
    │
    │  REST + GraphQL, Authorization: Bearer <Firebase ID token>
    ▼
[Node.js API :3000]  ── firebase-admin verifyIdToken ──▶  [PostgreSQL :5432]
```

Identity is externalized to Firebase; the API trusts only tokens it verifies with the Firebase Admin SDK.

---

## Stack

| Layer | Technology | ADR |
|---|---|---|
| Frontend | Angular (TypeScript, standalone components) | [001](adr/001-stack.md) |
| Backend | Node.js + TypeScript (NestJS or Express — TBD) | [003](adr/003-backend-framework.md) |
| API style | REST / JSON | [002](adr/002-rest-over-graphql.md) |
| Database | PostgreSQL | [004](adr/004-postgresql.md) |
| ORM / DB access | Prisma or TypeORM — TBD | [005](adr/005-orm.md) |
| Authentication | Firebase Authentication (ID tokens verified by API via Admin SDK) | [012](adr/012-firebase-authentication.md) |
| Local dev | Docker Compose | [008](adr/008-docker-compose.md) |

---

## Data Model

```
users
  id            UUID PK
  firebase_uid  TEXT UNIQUE NOT NULL   -- Firebase Auth UID (sub claim)
  email         TEXT UNIQUE NOT NULL
  display_name  TEXT
  role          TEXT NOT NULL DEFAULT 'user'   -- user | admin
  created_at    TIMESTAMPTZ
  updated_at    TIMESTAMPTZ
  -- No password: credentials live in Firebase only

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

Sign-in and sign-up are handled by **Firebase Authentication** in the Angular app (not by the API).

Protected REST and GraphQL operations require `Authorization: Bearer <Firebase ID token>`.

```
GET    /api/users/me                 -- optional bootstrap: ensure local user row exists (auth required)
-- (or POST /api/users/sync — same purpose; choose one canonical contract at implementation)

GET    /products                     -- public
GET    /products/:id                 -- public, includes avg_rating + review_count
GET    /products/:id/reviews         -- public
POST   /products/:id/reviews         -- auth required (Firebase ID token)
PUT    /reviews/:id                  -- auth required, owner only
DELETE /reviews/:id                  -- auth required, owner only
```

---

## Key Constraints

- One review per user per product — enforced by DB unique constraint ([ADR 007](adr/007-one-review-per-user.md))
- Reading reviews is public; writing requires authentication
- Identity is managed by Firebase; the API verifies Firebase ID tokens server-side and never stores passwords
- Firebase ID tokens are short-lived; the Angular app uses the Firebase client SDK to refresh tokens; attach the current ID token to API calls (typically via an HTTP interceptor)

---

## Frontend Structure (planned)

```
src/app/
  core/
    auth/           -- AuthService (Firebase Auth), AuthGuard, ID token interceptor
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
  auth/             -- Firebase token verification guard, optional user bootstrap
  products/         -- list, detail with aggregated rating
  reviews/          -- CRUD, ownership guard
  common/           -- pipes, guards, interceptors, exceptions
  database/         -- DB module, migrations
```
