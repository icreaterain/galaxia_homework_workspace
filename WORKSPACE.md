# CloudTalk Homework — Agentic Workspace

This document is the primary context source for AI agents working in this repository.
It describes the project purpose, repository structure, operating conventions, and everything
that cannot be inferred from the code itself.

---

## What This Project Is

A **product review system** (similar to Amazon or Alza), built as a full-stack application.
Users can browse products and submit, edit, delete, and read reviews with ratings.

**User groups:**
- Anonymous visitors — browse products and read reviews
- Authenticated users — submit and manage their own reviews

**Core functional areas:**
1. Product catalog — listing and detail pages
2. Review submission — create/edit/delete a review with a star rating and text body
3. Review aggregation — average rating, review count per product
4. User authentication — register, login, session management

---

## Repository Structure

This workspace coordinates two repositories, linked as **git submodules** under the workspace root:

| Path | Repository | Role | Stack |
|---|---|---|---|
| `cloudtalk_homework_fe/` | [`cloudtalk_homework_fe`](https://github.com/icreaterain/cloudtalk_homework_fe) | Frontend SPA | Angular (TypeScript) |
| `cloudtalk_homework_be/` | [`cloudtalk_homework_be`](https://github.com/icreaterain/cloudtalk_homework_be) | REST API + persistence | Node.js (TypeScript) |

After cloning the workspace, run `./scripts/setup.sh` to initialize submodules and install npm dependencies (when `package.json` exists in each repo).

**First-time workspace maintainers** (empty FE/BE remotes cannot be submodules until they have a commit):

1. `./scripts/bootstrap-empty-remotes.sh` — creates a README + initial commit on each remote (requires push access)
2. `./scripts/add-submodules.sh` — registers both repos as submodules and creates `.gitmodules`
3. Commit the submodule registration in the workspace repo

### Dependency Direction

```
[Browser]
    │
    ▼
[Angular FE]  ──HTTP──▶  [Node.js BE]  ──▶  [Database]
```

The frontend depends on the backend API contract. When the API contract changes:
1. Update and stabilize the BE endpoint first
2. Then update the FE to consume the new shape

### Local Port Conventions

| Service | Default Port |
|---|---|
| Angular dev server | 4200 |
| Node.js API | 3000 |
| Database (Postgres) | 5432 |

---

## Operating Conventions

### Commit Messages

Format: `<type>(<scope>): <subject>`

Types: `feat`, `fix`, `refactor`, `test`, `docs`, `chore`, `perf`

Scope examples: `auth`, `reviews`, `products`, `db`, `api`, `fe`

```
feat(reviews): add star rating to review submission form
fix(api): correct 404 response when product not found
docs(workspace): add database schema section
```

### Branching

- `main` — production-ready code
- `feat/<ticket-or-description>` — feature branches
- `fix/<description>` — bug fix branches

### File Naming

| Layer | Convention | Example |
|---|---|---|
| Angular components | `kebab-case.component.ts` | `product-card.component.ts` |
| Angular services | `kebab-case.service.ts` | `review.service.ts` |
| BE route handlers | `kebab-case.controller.ts` | `reviews.controller.ts` |
| BE business logic | `kebab-case.service.ts` | `reviews.service.ts` |
| DB migrations | `YYYYMMDDHHMMSS_description.ts` | `20260401120000_create_reviews.ts` |

### Never Edit

- `dist/` — compiled output in both repos
- Auto-generated migration snapshots (if using TypeORM/Prisma auto-generation)

---

## Technology Decisions (Rationale in ARCHITECTURE.md)

| Concern | Choice |
|---|---|
| Frontend framework | Angular |
| Backend runtime | Node.js + TypeScript |
| API style | REST |
| Database | PostgreSQL |
| ORM | To be decided at implementation start (see ARCHITECTURE.md) |
| Auth | JWT (access token in memory, refresh token in httpOnly cookie) |
| Testing | Jest (BE), Karma/Jest (FE) |
| Containerization | Docker Compose for local dev |

---

## What the Code Won't Tell You

### External Dependencies

- No third-party review aggregation service — ratings are computed in-database
- No CDN for product images in the MVP — images are placeholder URLs

### Known Constraints

- The assignment asks for easy setup: `docker compose up` should be sufficient to run the full stack
- Authentication is required to post a review, but not to read reviews (public read)
- A user may only have **one review per product** (enforced at DB level with a unique constraint)

### Architecture Decisions

See [ARCHITECTURE.md](ARCHITECTURE.md) for the current system overview and [adr/](adr/README.md) for the full reasoning behind key choices.

### Environment Configuration

Both repos use `.env` files. A `.env.example` is committed; `.env` is gitignored.

Key variables:
- `DATABASE_URL` — Postgres connection string
- `JWT_SECRET` — signing secret (never commit a real value)
- `CORS_ORIGIN` — allowed frontend origin (default: `http://localhost:4200`)

---

## Development Workflow

### First-Time Setup

```bash
# From workspace root (after clone — use --recurse-submodules, or run ./scripts/setup.sh)
./scripts/setup.sh

docker compose up -d          # starts Postgres (when compose file exists)
cd cloudtalk_homework_be && cp .env.example .env && npm run migrate && npm run dev
cd cloudtalk_homework_fe && npm start   # or: ng serve
```

If submodules were not initialized by the clone, run `./scripts/setup.sh` first (or `git submodule update --init --recursive`).

### Running Tests

```bash
# BE
cd cloudtalk_homework_be && npm test

# FE
cd cloudtalk_homework_fe && npm test
```

### Quality Gates

- TypeScript must compile with zero errors before committing
- ESLint must pass (configured in both repos)
- All tests must pass before merging to `main`

---

## Cross-Repo Change Protocol

When a change touches both repos (e.g., a new API field):

1. Design the API contract change (document in ARCHITECTURE.md if significant)
2. Implement and merge the BE change first
3. Update FE to consume the new contract
4. Coordinate commits with matching messages referencing the same feature scope

See skill: `.cursor/skills/cross-repo-change/SKILL.md`

---

## Agent Operating Guidelines

- Prefer editing existing files over creating new ones
- Follow the commit message format strictly — commit messages are part of the documentation
- When adding a new domain feature, read `.cursor/skills/add-review-feature/SKILL.md` first
- After any significant architectural decision, update ARCHITECTURE.md
- After any change to repo structure, ports, env vars, or conventions, update this file
- Do not generate placeholder lorem ipsum content — use realistic review/product data
