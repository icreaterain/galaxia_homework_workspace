# AGENTS.md — Product Reviews System

This file is the entry point for AI agents working in this repository.
Read it fully before writing any code.

For the current system state (stack, schema, API, module structure, CI/CD, env vars), see [`ARCHITECTURE.md`](ARCHITECTURE.md).
For developer onboarding and operating conventions, see [`WORKSPACE.md`](WORKSPACE.md).
For decision rationale, see [`adr/`](adr/README.md).

---

## About This Workspace

This is a **cross-repository development workspace** for a full-stack product review system
(Amazon/Alza-style). It uses **git submodules** to coordinate changes across 2 repositories.

**What the system does:**
- Users browse a seeded product catalog, register, and submit star-rated reviews with text
- The backend exposes a **hybrid REST + GraphQL API**
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
| **AGENTS.md** (this file) | Quick reference, navigation, workspace rules |
| **[ARCHITECTURE.md](ARCHITECTURE.md)** | System architecture, stack, data model, API surface, module structure, CI/CD, environment |
| **[WORKSPACE.md](WORKSPACE.md)** | Developer onboarding, setup, conventions, environment usage |
| **[adr/](adr/README.md)** | Architecture Decision Records |
| **[.ai/](/.ai/README.md)** | Agent rules, skills, development guide, workflows |

### .ai/ Directory

```text
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
| [`galaxia_homework_be/`](galaxia_homework_be/) | NestJS API + Prisma + PostgreSQL | Node.js + TypeScript | 3000 |
| [`galaxia_homework_fe/`](galaxia_homework_fe/) | Angular SPA + Apollo + Tailwind | Angular + TypeScript | 4200 |

**PostgreSQL** runs via Docker Compose on port **5432**.

**Key contract:** Backend owns the GraphQL schema; frontend consumes generated types from it.
See [ADR 011](adr/011-contract-ownership.md).

---

## Architecture at a Glance

The system uses:
- **REST** for write commands (auth flows, review mutations)
- **GraphQL** for read queries (product lists, product detail, paginated reviews, aggregates)
- A **shared service layer** behind both protocols

For the full diagram, API definitions, data model, and module structure, see [`ARCHITECTURE.md`](ARCHITECTURE.md).

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
cd galaxia_homework_be
pnpm run dev             # start with hot reload
pnpm test                # unit tests
pnpm run test:e2e        # e2e tests (requires Postgres)
pnpm run schema:export   # export schema.graphql
```

### Frontend

```bash
cd galaxia_homework_fe
pnpm start               # ng serve on :4200
pnpm run codegen         # generate typed GraphQL services
pnpm test                # unit tests
```

### Quality Gate (run before every commit)

```bash
pnpm exec tsc --noEmit && pnpm run lint:check && pnpm test
```

---

## Key References

- Current architecture and implementation state: [`ARCHITECTURE.md`](ARCHITECTURE.md)
- Setup and conventions: [`WORKSPACE.md`](WORKSPACE.md)
- Decision history: [`adr/README.md`](adr/README.md)
- Agent rules and skills: [`.ai/`](.ai/README.md)

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

```text
galaxia_homework/
├── AGENTS.md                    ← you are here
├── ARCHITECTURE.md              ← system architecture, data model, API, CI/CD
├── WORKSPACE.md                 ← developer onboarding, setup, conventions
├── .ai/                         ← agent rules, skills, guides (agent-agnostic)
│   ├── development.md
│   ├── workflows.md
│   ├── rules/
│   └── skills/
├── adr/                         ← Architecture Decision Records
├── galaxia_homework_be/       ← NestJS API (git submodule)
├── galaxia_homework_fe/       ← Angular SPA (git submodule)
├── mcp/
│   ├── galaxia-api/           ← MCP: API wrapper
│   └── galaxia-db/            ← MCP: read-only DB access
├── scripts/                     ← setup helpers
├── docker-compose.yml           ← Postgres 16 for local dev
├── mcp.json                     ← MCP server config
└── .cursor/                     ← IDE-specific config
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
