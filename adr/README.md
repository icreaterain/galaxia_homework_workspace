# Architecture Decision Records

Numbered log of significant design choices made during this project.
Each ADR captures context, the decision, trade-offs, and alternatives considered.

New decisions go here — one file per decision. Do not edit decided ADRs;
if a decision is superseded, update its status and create a new ADR.

## Template

Copy `000-template.md` when adding a new entry.

## Index

| # | Title | Status |
|---|---|---|
| [001](001-stack.md) | TypeScript end-to-end: NestJS + Angular | Decided |
| [002](002-rest-over-graphql.md) | REST over GraphQL | Superseded by 009 |
| [003](003-backend-framework.md) | NestJS with Fastify adapter | Decided |
| [004](004-postgresql.md) | PostgreSQL as the database | Decided |
| [005](005-orm.md) | Prisma as the ORM | Decided |
| [006](006-jwt-auth.md) | Self-managed JWT authentication | Decided |
| [007](007-one-review-per-user.md) | One review per user per product | Decided |
| [008](008-docker-compose.md) | Docker Compose for local development | Decided |
| [009](009-hybrid-rest-graphql.md) | Hybrid REST + GraphQL (CQRS-lite) | Decided |
| [010](010-two-repo-structure.md) | Two-repository structure (git submodules) | Decided |
| [011](011-contract-ownership.md) | Contract ownership: OpenAPI + GraphQL SDL | Decided |
| [012](012-firebase-authentication.md) | Firebase Authentication (superseded) | Superseded by 006 |
| [013](013-testing-strategy.md) | Testing Strategy: layers, scope, and coverage priorities | Decided |
| [014](014-ci-pipeline.md) | CI Pipeline: GitHub Actions, pnpm v10 native deps, validation status codes | Decided |
| [015](015-mcp-api-wrapper.md) | MCP Server as API Wrapper (list / get\_details / execute tools) | Decided |
