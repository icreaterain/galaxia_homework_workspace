# Development Guide

Commands, quality gates, and scripts reference for both repositories.

## Commands Quick Reference

### cloudtalk_homework_be (NestJS API)

| Command | Description |
|---------|-------------|
| `pnpm run dev` | Start dev server with watch mode |
| `pnpm run build` | Production build |
| `pnpm test` | Run unit tests in watch mode |
| `pnpm run test:cov` | Run unit tests with coverage report |
| `pnpm run test:e2e` | Run e2e tests (requires Postgres) |
| `pnpm run lint:check` | ESLint check (no auto-fix, CI mode) |
| `pnpm run lint` | ESLint with auto-fix |
| `pnpm run format` | Prettier format |
| `pnpm run format:check` | Prettier check (CI mode) |
| `pnpm run schema:export` | Export `schema.graphql` from code-first decorators |
| `pnpm run migrate:local` | `prisma migrate dev` — creates migration + runs seed |
| `pnpm run migrate:deploy` | `prisma migrate deploy` — apply migrations without prompts |
| `pnpm run migrate:prod` | `prisma migrate deploy` against production DB |
| `pnpm run generate` | Regenerate Prisma Client after schema changes |
| `pnpm run seed` | Run seed script directly |

### cloudtalk_homework_fe (Angular SPA)

| Command | Description |
|---------|-------------|
| `pnpm start` | Start dev server (`ng serve`, port 4200) |
| `pnpm run build` | Production build |
| `pnpm test` | Run unit tests in watch mode |
| `pnpm run test:ci` | Run unit tests once, no watch (CI mode) |
| `pnpm run lint:check` | ESLint check (no auto-fix, CI mode) |
| `pnpm run lint` | ESLint with auto-fix |
| `pnpm run format` | Prettier format |
| `pnpm run format:check` | Prettier check (CI mode) |
| `pnpm run codegen` | Generate typed GraphQL services from `schema.graphql` |

## Quality Gate Sequence

Run these in order before every commit.

### Backend

```bash
cd cloudtalk_homework_be
pnpm exec tsc --noEmit
pnpm run lint:check
pnpm run format:check
pnpm test
pnpm run test:e2e
```

### Frontend

```bash
cd cloudtalk_homework_fe
pnpm run codegen
pnpm exec tsc --noEmit -p tsconfig.app.json
pnpm exec tsc --noEmit -p tsconfig.spec.json
pnpm run lint:check
pnpm run format:check
pnpm run test:ci
```

## GraphQL Codegen Workflow

The backend owns the GraphQL schema (code-first). The frontend generates typed services from it.

```bash
# 1. In the BE repo — export the schema after any resolver/model change
cd cloudtalk_homework_be
pnpm run schema:export   # writes schema.graphql to repo root

# 2. In the FE repo — regenerate typed services
cd cloudtalk_homework_fe
pnpm run codegen          # reads ../cloudtalk_homework_be/schema.graphql
                          # writes src/generated/graphql.ts (gitignored)
```

CI runs codegen automatically — it shallow-clones the BE repo for the schema file.

## Database Operations

All Prisma commands use `dotenv-cli` to load `.env` + `.env.local`:

```bash
# Local development
pnpm run migrate:local    # creates migration + seeds

# Apply without prompts (CI or staging)
pnpm run migrate:deploy

# Regenerate client after schema.prisma changes
pnpm run generate

# Open Prisma Studio (visual DB browser)
pnpm exec dotenv -o -e .env -e .env.local -- prisma studio
```

Avoid nesting `pnpm run … --` around another script that already ends with `--` for dotenv-cli.

## PR Workflow (using `gh`)

### Creating a PR

```bash
cd <repo>
git push -u origin HEAD
gh pr create --title "<type>(<scope>): <subject>" --body "$(cat <<'EOF'
## Summary
<description>

## Testing
- All quality checks passing
EOF
)"
```

### Checking PR Status

```bash
gh pr status
gh pr checks <number>
```

### Reviewing PRs

```bash
gh pr list
gh pr view <number>
gh pr diff <number>
```

## Workspace Scripts

| Script | Purpose |
|--------|---------|
| `scripts/setup.sh` | Initialize submodules + install deps |

Run from workspace root: `./scripts/<script-name>.sh`

## Environment Setup

### Backend `.env`

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

`.env.local` overrides `.env` for the same key — used for machine-specific values.

### Frontend `.env`

```
API_URL=http://localhost:3000/api
GRAPHQL_URL=http://localhost:3000/graphql
```

These are for developer reference only — the SPA reads `window.__env` at runtime.

## Common Issues

### `NullInjectorError: No provider for _Apollo!`

`ApolloModule` must be registered via `importProvidersFrom(ApolloModule)` — not placed directly in `makeEnvironmentProviders`.

### `Cannot set base providers because it has already been called`

Do NOT call `setupZoneTestEnv()` in `setup-jest.ts` — `@angular-builders/jest` injects it automatically.

### `NG04002: Cannot match any routes`

Services that call `router.navigate()` need a mock Router in tests, not `provideRouter([])`.

### Schema freshness check fails in CI

Run `pnpm run schema:export` and commit `schema.graphql` before pushing.
