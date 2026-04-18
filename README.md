# Product Reviews System

A full-stack product review platform (Amazon/Alza-style) built with Angular and NestJS.

Users browse a seeded product catalog, register accounts, and submit star-rated reviews. The backend exposes a **hybrid REST + GraphQL API**: REST for all writes (auth, review mutations) and GraphQL for all reads (product queries, paginated review lists with aggregates).

---

## Architecture

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

REST handles all command-oriented writes; GraphQL handles all read-oriented views. Both protocols share the same service layer — services are protocol-agnostic.

For the full architectural picture, see [ARCHITECTURE.md](ARCHITECTURE.md). For decision rationale, see [adr/](adr/README.md).

---

## Quick Start

### Prerequisites

- Node.js 20+
- [pnpm](https://pnpm.io/installation) 10+ (enable via [Corepack](https://nodejs.org/api/corepack.html): `corepack enable pnpm`)
- Docker Desktop

### 1. Clone with submodules

```bash
git clone --recurse-submodules https://github.com/icreaterain/galaxia_homework_workspace.git
cd galaxia_homework_workspace
./scripts/setup.sh
```

If you already cloned without `--recurse-submodules`:

```bash
git submodule update --init --recursive
./scripts/setup.sh
```

### 2. Start the database

```bash
docker compose up -d
```

### 3. Start the backend

```bash
cd galaxia_homework_be
cp .env.example .env       # edit DATABASE_URL / JWT_SECRET if needed
pnpm run migrate:local     # applies migrations + seeds demo data
pnpm run dev               # API at http://localhost:3000
```

### 4. Start the frontend

```bash
cd galaxia_homework_fe
pnpm start                 # App at http://localhost:4200
```

---

## Demo Credentials

| Email | Password | Role |
|---|---|---|
| `user@demo.com` | `password123` | User |
| `admin@demo.com` | `password123` | Admin |

---

## Features

- Browse a seeded product catalog (15 products across 5 categories)
- Product detail page with paginated reviews, average rating, and rating distribution
- User registration and login (JWT auth with silent refresh)
- Create, edit, and delete your own review (one review per product per user)
- Sort reviews by newest, oldest, highest rating, lowest rating
- Filter reviews by star rating
- "My Reviews" page listing all reviews you've submitted
- Fully typed GraphQL queries via Apollo Angular + graphql-codegen

---

## Project Structure

| Path | Repository | Role |
|---|---|---|
| `galaxia_homework_be/` | [`icreaterain/galaxia_homework_be`](https://github.com/icreaterain/galaxia_homework_be) | NestJS API + Prisma + PostgreSQL |
| `galaxia_homework_fe/` | [`icreaterain/galaxia_homework_fe`](https://github.com/icreaterain/galaxia_homework_fe) | Angular 19 SPA |

---

## API Design

### Why Hybrid REST + GraphQL?

This is a CQRS-lite design:

**REST for commands** — write operations are transactional, each has a clear HTTP verb and status code, auth flows naturally map to POST + cookies, and individual endpoints are easy to rate-limit.

**GraphQL for reads** — a product detail page is a composed view (product info + aggregates + paginated reviews + author data). GraphQL lets the frontend request exactly the fields it needs, and Apollo Client's normalized cache reduces redundant requests.

### REST Endpoints (`/api/*`)

| Method | Path | Auth | Description |
|---|---|---|---|
| `POST` | `/api/auth/register` | — | Create account |
| `POST` | `/api/auth/login` | — | Authenticate; sets httpOnly refresh cookie |
| `POST` | `/api/auth/refresh` | cookie | Exchange refresh cookie for new access token |
| `POST` | `/api/auth/logout` | — | Clear refresh cookie |
| `POST` | `/api/products/:productId/reviews` | JWT | Create review |
| `PUT` | `/api/reviews/:id` | JWT (owner) | Update own review |
| `DELETE` | `/api/reviews/:id` | JWT (owner) | Delete own review |
| `GET` | `/api/health` | — | Liveness check |
| `GET` | `/api/health/ready` | — | Readiness check (verifies DB) |

### GraphQL (`/graphql`)

Key queries: `product(id)`, `products(first, after, filter)`, `myReviews(first, after)`.

Playground available at `http://localhost:3000/graphql` in development.

---

## Running Tests

```bash
# Backend — unit tests
cd galaxia_homework_be && pnpm test

# Backend — e2e tests (requires running Postgres)
cd galaxia_homework_be && pnpm run test:e2e

# Frontend — unit tests
cd galaxia_homework_fe && pnpm test
```

See [TESTING.md](TESTING.md) for coverage audit, patterns, and backlog.

---

## CI/CD

Both repos use GitHub Actions with a `quality` gate (lint + format check + type-check + unit tests + e2e) and a `build` gate gated on quality. Every push to `main` also triggers a `deploy` job:

- **Backend** → Google Cloud Run (`us-central1`) via Workload Identity Federation
- **Frontend** → Firebase Hosting; `/api/**` and `/graphql` are rewritten to Cloud Run

See [ADR 014](adr/014-ci-pipeline.md) for the full pipeline rationale.

---

## Technology Stack

| Layer | Technology | Why |
|---|---|---|
| Frontend | Angular 19 (standalone, signals) | Modern Angular DX; reactive state without NgRx |
| Frontend styling | Tailwind CSS | Utility-first; fast iteration without a component library |
| Frontend GraphQL | Apollo Angular + graphql-codegen | Type-safe GQL services generated from the BE schema |
| Backend framework | NestJS with Fastify adapter | Modular DI, lower per-request overhead vs Express |
| API style | Hybrid REST + GraphQL | REST for commands (clear verbs/status codes); GraphQL for composed reads |
| ORM | Prisma | Type-safe generated client; clean migration story |
| Database | PostgreSQL 16 | Reliable, well-supported; hosted on Supabase in production |
| Authentication | Self-managed JWT | Access token in memory (15 min) + refresh token in httpOnly cookie (7 days) |
| Local dev | Docker Compose (Postgres only) | Simple, portable — no Supabase CLI required locally |
| Testing | Jest (both repos) | Fast, consistent; e2e via supertest against real Postgres |
| CI | GitHub Actions | Quality gate on every push; deploy on merge to `main` |
| Backend hosting | Google Cloud Run | Managed, scales to zero |
| Frontend hosting | Firebase Hosting | CDN + `/api/**` rewrites to Cloud Run |

---

## Key Design Decisions

| Decision | ADR |
|---|---|
| TypeScript end-to-end (NestJS + Angular) | [ADR 001](adr/001-stack.md) |
| NestJS with Fastify adapter | [ADR 003](adr/003-backend-framework.md) |
| PostgreSQL as the database | [ADR 004](adr/004-postgresql.md) |
| Prisma as the ORM | [ADR 005](adr/005-orm.md) |
| Self-managed JWT authentication | [ADR 006](adr/006-jwt-auth.md) |
| One review per user per product | [ADR 007](adr/007-one-review-per-user.md) |
| Docker Compose for local dev | [ADR 008](adr/008-docker-compose.md) |
| Hybrid REST + GraphQL (CQRS-lite) | [ADR 009](adr/009-hybrid-rest-graphql.md) |
| Two-repository structure (git submodules) | [ADR 010](adr/010-two-repo-structure.md) |
| Contract ownership: backend is source of truth | [ADR 011](adr/011-contract-ownership.md) |
| Testing strategy | [ADR 013](adr/013-testing-strategy.md) |
| CI pipeline design | [ADR 014](adr/014-ci-pipeline.md) |

---

## Trade-offs and Simplifications

| Simplification | Production alternative |
|---|---|
| `avg_rating` and `review_count` are recalculated synchronously on every review write | Decouple via an event/queue (e.g. BullMQ) to avoid write amplification under load |
| No shared types package — REST interfaces are maintained manually in the FE repo | `openapi-typescript` generates FE types from the OpenAPI spec exported by `@nestjs/swagger` |
| Single-instance API — no Redis, no queue workers | Add Redis for response caching and distributed rate limiting; add read replicas for Postgres |
| No E2E tests in MVP (Playwright) | Playwright smoke test covering the critical path (browse → review submit) |
| No refresh token invalidation store | Token family tracking in DB or Redis for full revocation support |
| Product images use placeholder URLs | CDN-backed image upload (e.g. Cloud Storage + signed URLs) |
| Admin moderation dashboard is a stub (`status` field exists but no admin UI) | Full moderation workflow with a flagging queue and admin review actions |

---

## AI / MCP Tooling

The workspace ships two [Model Context Protocol (MCP)](https://modelcontextprotocol.io) servers that give AI assistants direct access to the running API and the database:

| Server | Location | What it exposes |
|--------|----------|-----------------|
| `galaxia-api` | `mcp/galaxia-api/` | REST + GraphQL API — list endpoints, call them, inspect responses |
| `galaxia-db` | `mcp/galaxia-db/` | Read-only SQL queries against PostgreSQL |

### Building the MCP servers

The servers are TypeScript projects that must be compiled before use. `./scripts/setup.sh` does this automatically as part of the normal workspace setup. To build them in isolation:

```bash
cd mcp/galaxia-api && pnpm install && pnpm run build
cd mcp/galaxia-db  && pnpm install && pnpm run build
```

### Connecting your AI assistant

The workspace-level config lives in `mcp.json` at the repository root. Point your AI client at that file — the exact step depends on your tool:

| Client | How to register |
|--------|----------------|
| **Cursor** | Settings → MCP → add server → point to `mcp.json` (or copy the server entries into your user-level `~/.cursor/mcp.json`) |
| **Claude Desktop** | `claude_desktop_config.json` → `mcpServers` → copy the entries from `mcp.json` |
| **Other MCP-compatible clients** | Consult the client docs; the `mcp.json` format follows the standard MCP server configuration schema |

The servers expect the backend and database to be running locally (steps 2–3 of Quick Start above). The `BASE_URL` and `DATABASE_URL` values in `mcp.json` match the default local dev environment and can be overridden via environment variables if your setup differs.

---

## Documentation

| File | Purpose |
|---|---|
| [ARCHITECTURE.md](ARCHITECTURE.md) | Current system state: stack, data model, API surface, module structure |
| [WORKSPACE.md](WORKSPACE.md) | Agentic workspace context: conventions, setup, operating rules |
| [TESTING.md](TESTING.md) | Test coverage audit, patterns, and gap backlog |
| [adr/README.md](adr/README.md) | Architecture Decision Records index |
| [galaxia_homework_be/README.md](galaxia_homework_be/README.md) | Backend setup, API reference, scripts |
| [galaxia_homework_fe/README.md](galaxia_homework_fe/README.md) | Frontend setup, architecture, scripts |
