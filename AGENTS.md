# AGENTS.md — Product Reviews System

This file is the entry point for AI agents working in this repository.
Read it fully before writing any code.

For the current system state (stack, schema, API), see [`ARCHITECTURE.md`](ARCHITECTURE.md).
For developer onboarding and operating conventions, see [`WORKSPACE.md`](WORKSPACE.md).
For decision rationale, see [`adr/`](adr/README.md).

---

## About This Workspace

This is a **cross-repository development workspace** for a full-stack product review system
(Amazon/Alza-style). It uses **git submodules** to coordinate changes across 2 repositories.

**What the system does:**
- Users browse a seeded product catalog, register, and submit star-rated reviews with text
- The backend exposes a **hybrid REST + GraphQL API**: REST for all write commands (auth, review mutations); GraphQL for all reads (product queries, paginated review lists with aggregates)
- The frontend is an Angular SPA consuming both protocols

**User groups:**
- Anonymous visitors — browse products, read reviews
- Authenticated users — create, edit, and delete their own reviews
- Admin (seeded) — moderate review status (P2)

---

## Documentation Structure

This workspace uses **modular documentation** stored in agent-agnostic format:

| File | Purpose |
|------|---------|
| **AGENTS.md** (this file) | Quick reference, navigation, project overview |
| **[ARCHITECTURE.md](ARCHITECTURE.md)** | System architecture, data model, API surface, CI/CD |
| **[WORKSPACE.md](WORKSPACE.md)** | Developer onboarding, setup, conventions, environment |
| **[adr/](adr/README.md)** | Architecture Decision Records (16 decisions) |
| **[.ai/](/.ai/README.md)** | Agent rules, skills, development guide, workflows |

### .ai/ Directory

```
.ai/
├── development.md           — Commands, quality gates, scripts reference
├── workflows.md             — Cross-repo workflow patterns
├── rules/                   — Coding standards by file scope
│   ├── project-conventions.md    (all files)
│   ├── typescript-standards.md   (**/*.ts)
│   ├── angular-patterns.md       (FE **/*.ts)
│   └── api-design.md             (BE **/*.ts)
└── skills/                  — Multi-step workflow guides
    ├── graphql-schema-sync/      keeping schema.graphql in sync (export + codegen)
    ├── cross-repo-change/        coordinating BE + FE changes
    ├── extend-agentic-docs/      maintaining workspace documentation
    ├── start-task/               initialize task with branches + plan
    └── finish-task/              quality checks, commit, PR creation
```

---

## Repository Overview

| Repository | Purpose | Stack | Port |
|------------|---------|-------|------|
| [`cloudtalk_homework_be/`](cloudtalk_homework_be/) | NestJS API + Prisma + PostgreSQL | Node.js + TypeScript | 3000 |
| [`cloudtalk_homework_fe/`](cloudtalk_homework_fe/) | Angular SPA + Apollo + Tailwind | Angular + TypeScript | 4200 |

**PostgreSQL** runs via Docker Compose on port **5432**.

### Dependency Graph

```
cloudtalk_homework_fe  →  depends on  →  cloudtalk_homework_be
                                              │
                                         Prisma Client
                                              │
                                       PostgreSQL :5432
```

**Key integration point:** The GraphQL schema. The BE exports `schema.graphql` (code-first); the FE runs `graphql-codegen` against it to generate typed services. See [ADR 011](adr/011-contract-ownership.md).

---

## Architecture: How REST and GraphQL Coexist

```
Angular SPA
 ├── HttpClient ──POST/PUT/DELETE──▶ /api/* (REST controllers)
 └── Apollo ──POST /graphql──▶ /graphql (GraphQL resolvers)
                                    │
                               Service Layer (shared, protocol-agnostic)
                                    │
                               Prisma Client
                                    │
                               PostgreSQL
```

- REST controllers and GraphQL resolvers both inject the **same service layer**
- Services contain all business logic and do not know which protocol called them
- REST for commands (create/update/delete review, auth flows)
- GraphQL for reads (product queries, paginated reviews, aggregates)
- Never add mutations to GraphQL; never add GET endpoints to REST for data reads

See [ADR 009](adr/009-hybrid-rest-graphql.md) for the full rationale.

---

## API Surface

### REST (`/api/*`)

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/api/auth/register` | — | Create account |
| POST | `/api/auth/login` | — | Authenticate; sets httpOnly refresh cookie |
| POST | `/api/auth/refresh` | cookie | Exchange refresh cookie for new access token |
| POST | `/api/auth/logout` | — | Clear refresh cookie |
| POST | `/api/products/:productId/reviews` | JWT | Create review |
| PUT | `/api/reviews/:id` | JWT (owner) | Update own review |
| DELETE | `/api/reviews/:id` | JWT (owner) | Delete own review |
| GET | `/api/health` | — | Liveness check |
| GET | `/api/health/ready` | — | Readiness check (verifies DB) |

Response envelope: `{ "data": { ... } }` on success, `{ "error": { "code": "...", "message": "...", "statusCode": N } }` on error.

### GraphQL (`/graphql`)

```graphql
product(id: ID!): Product
products(first: Int, after: String, filter: ProductFilterInput): ProductConnection
myReviews(first: Int, after: String): ReviewConnection
```

Product includes nested: `avgRating`, `reviewCount`, `ratingDistribution`, `reviews(first, after, sort, filterByRating)`.

Pagination: Relay-style cursor connections (`first`/`after`, `edges`/`pageInfo`).

---

## Data Model

```
users       id, email (UNIQUE), display_name, password_hash (bcrypt), role (user|admin)
products    id, name, description, image_url, category, price, avg_rating*, review_count*
reviews     id, user_id FK, product_id FK, rating (1-5), title?, body, status, UNIQUE(user_id, product_id)
review_votes  id, review_id FK, user_id FK, UNIQUE(review_id, user_id)  ← P1
```

`*` `avg_rating` and `review_count` are **denormalized** — recalculated inside `ReviewsService` in the same transaction as every review write.

---

## Quick Start for Agents

### For Simple Tasks (Single Repository)

Work directly in the appropriate repository. Read the relevant `.ai/rules/` file for coding standards.

### For Cross-Repository Tasks

Read `.ai/skills/cross-repo-change/SKILL.md` first. Backend changes always go before frontend changes.

### For GraphQL Schema Changes

Read `.ai/skills/graphql-schema-sync/SKILL.md` — covers export, codegen, drift detection, and breaking changes.

---

## Git Workflow

**Never commit directly to main.** Always work in feature branches.

```bash
cd <repo>
git checkout main
git pull origin main
git checkout -b feat/<kebab-case-description>
```

**Branch naming:** `feat/<description>` or `fix/<description>`

**Commit format:** `<type>(<scope>): <lower-case subject>`
- Subject must be entirely lower-case (enforced by commitlint)
- Types: `feat` `fix` `refactor` `test` `docs` `chore` `perf`
- BE scopes: `auth` `reviews` `products` `db` `api` `health` `common`
- FE scopes: `auth` `reviews` `products` `shared` `graphql` `fe`

**PR creation:** Use `gh pr create` — see `.ai/skills/finish-task/SKILL.md`.

---

## Development Commands

For the full reference, see `.ai/development.md`. Quick essentials:

### Backend

```bash
cd cloudtalk_homework_be
pnpm run dev             # start with hot reload
pnpm test                # unit tests
pnpm run test:e2e        # e2e tests (requires Postgres)
pnpm run schema:export   # export schema.graphql
```

### Frontend

```bash
cd cloudtalk_homework_fe
pnpm start               # ng serve on :4200
pnpm run codegen         # generate typed GraphQL services
pnpm test                # unit tests
```

### Quality Gate (run before every commit)

```bash
pnpm exec tsc --noEmit && pnpm run lint:check && pnpm test
```

---

## MCP Servers

Two MCP servers provide AI agents with direct API and database access:

| Server | Tool | Description |
|--------|------|-------------|
| `cloudtalk-api` | `list`, `get_details`, `execute` | Wraps the running REST + GraphQL API |
| `cloudtalk-db` | `query` | Read-only SQL against PostgreSQL (returns JSON) |

Build before use: `cd mcp/<server> && pnpm install && pnpm run build`

Config: `mcp.json` (workspace root) and `.cursor/mcp.json` (Cursor IDE).

See [ADR 015](adr/015-mcp-api-wrapper.md) and [ADR 016](adr/016-mcp-db-reader.md).

---

## Key Architecture Decisions

| # | Decision | ADR |
|---|----------|-----|
| 001 | TypeScript end-to-end: NestJS + Angular | [001](adr/001-stack.md) |
| 003 | NestJS with Fastify adapter | [003](adr/003-backend-framework.md) |
| 004 | PostgreSQL 16 | [004](adr/004-postgresql.md) |
| 005 | Prisma ORM | [005](adr/005-orm.md) |
| 006 | Self-managed JWT auth (bcrypt + httpOnly cookies) | [006](adr/006-jwt-auth.md) |
| 007 | One review per user per product | [007](adr/007-one-review-per-user.md) |
| 008 | Docker Compose for local dev | [008](adr/008-docker-compose.md) |
| 009 | Hybrid REST + GraphQL (commands vs reads) | [009](adr/009-hybrid-rest-graphql.md) |
| 010 | Two repos as git submodules | [010](adr/010-two-repo-structure.md) |
| 011 | Contract ownership: BE exports schema, FE codegen | [011](adr/011-contract-ownership.md) |
| 013 | Testing strategy (Jest + e2e) | [013](adr/013-testing-strategy.md) |
| 014 | CI pipeline (GitHub Actions) | [014](adr/014-ci-pipeline.md) |
| 015 | MCP API wrapper | [015](adr/015-mcp-api-wrapper.md) |
| 016 | MCP DB reader | [016](adr/016-mcp-db-reader.md) |

---

## Implementation Status

All phases complete:

| Phase | Scope | Status |
|---|---|---|
| 0 | Docker Compose, ADRs, docs | **Complete** |
| 1 | NestJS + Fastify + Prisma scaffold, schema, migrations, seed | **Complete** |
| 2 | Auth module (register, login, refresh, logout, guards) | **Complete** |
| 3 | GraphQL setup + product queries with pagination | **Complete** |
| 4 | Review CRUD (REST writes + GraphQL reads + aggregate recalc) | **Complete** |
| 5 | Polish (exception filters, correlation IDs, helmet, throttler) | **Complete** |
| 6 | Angular scaffold + Apollo Angular + Tailwind + codegen | **Complete** |
| 7 | Frontend auth flow (AuthService, interceptors, guard, login/register) | **Complete** |
| 8 | Frontend features (product list/detail, review list/form/card) | **Complete** |
| 9 | CI/CD pipelines (GitHub Actions, quality gates) | **Complete** |
| 10 | Documentation finalization | **Complete** |
| 11 | MCP tooling | **Complete** |

---

## Agent Operating Guidelines

- Read the relevant `.ai/rules/*.md` file before making changes
- Follow commit message format strictly — subject must be entirely lower-case
- Work only in the submodule that owns the concern you are changing
- Never write backend logic in the frontend repo or vice versa
- For GraphQL schema changes, read `.ai/skills/graphql-schema-sync/SKILL.md`
- For cross-repo changes, read `.ai/skills/cross-repo-change/SKILL.md`
- After architectural decisions, add an ADR and update `ARCHITECTURE.md`
- After convention changes, update `WORKSPACE.md` and `.ai/rules/`
- Use `gh` CLI for GitHub operations (PRs, issues)
- Do not generate placeholder lorem ipsum — use realistic review/product data

---

## Workspace Structure

```
cloudtalk_homework/
├── AGENTS.md                    ← you are here
├── ARCHITECTURE.md              ← system architecture, data model, API, CI/CD
├── WORKSPACE.md                 ← developer onboarding, setup, conventions
├── .ai/                         ← agent rules, skills, guides (agent-agnostic)
│   ├── development.md
│   ├── workflows.md
│   ├── rules/
│   └── skills/
├── adr/                         ← Architecture Decision Records (001–016)
├── cloudtalk_homework_be/       ← NestJS API (git submodule)
├── cloudtalk_homework_fe/       ← Angular SPA (git submodule)
├── mcp/
│   ├── cloudtalk-api/           ← MCP: API wrapper
│   └── cloudtalk-db/            ← MCP: read-only DB access
├── scripts/                     ← setup helpers
├── docker-compose.yml           ← Postgres 16 for local dev
├── mcp.json                     ← MCP server config
└── .cursor/                     ← IDE-specific config (mcp.json pointer)
```

---

## Documentation Maintenance

After any change, update the relevant file:

| What changed | Update |
|---|---|
| Architectural decision | `adr/NNN-title.md` (new file) + `adr/README.md` (index row) |
| Current system state | `ARCHITECTURE.md` |
| Conventions, ports, env vars | `WORKSPACE.md` + `.ai/rules/` |
| New workflow or skill | `.ai/skills/<name>/SKILL.md` |
| New coding pattern | `.ai/rules/<name>.md` |

See `.ai/skills/extend-agentic-docs/SKILL.md` for the full documentation maintenance protocol.
