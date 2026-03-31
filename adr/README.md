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
| [001](001-stack.md) | Node.js + Angular as primary stack | Decided |
| [002](002-rest-over-graphql.md) | REST over GraphQL | Decided |
| [003](003-backend-framework.md) | NestJS vs Express | Under discussion |
| [004](004-postgresql.md) | PostgreSQL as the database | Decided |
| [005](005-orm.md) | ORM choice | Under discussion |
| [006](006-jwt-auth.md) | JWT authentication strategy (historical) | Superseded by 012 |
| [007](007-one-review-per-user.md) | One review per user per product | Decided |
| [008](008-docker-compose.md) | Docker Compose for local dev | Decided |
| [012](012-firebase-authentication.md) | Firebase Authentication as identity provider | Decided |
