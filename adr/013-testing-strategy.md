# 013 — Testing Strategy: Layers, Scope, and Coverage Priorities

**Date:** 2026-04-02
**Status:** Decided

## Context

The system is a hybrid REST + GraphQL API (NestJS/Fastify) consumed by an Angular SPA.
Business logic is split across three layers — HTTP controllers/resolvers, service layer, and
Prisma-backed persistence — making it critical to decide *which layer* owns which kind of test.

Without a documented strategy, test files were added opportunistically: 4 unit specs in the
backend (services + one controller + one smoke test) and 9 in the frontend (components +
two services). The e2e suite covers health and the full auth flow. Large areas — `ProductsService`,
all controllers, all resolvers, all interceptors/guards, and several Angular components — have
no automated tests at all.

## Decision

We adopt a **four-level test pyramid** with explicit ownership rules per layer:

### Level 1 — Unit tests (services and pure utilities)

*Where:* `src/**/*.spec.ts` in each repo.

| Backend | Frontend |
|---|---|
| All service classes (business logic, error codes, aggregate recalc) | All Angular services (HttpClient calls, signals, session handling) |
| `common/pagination/cursor.util.ts` (encode/decode round-trip) | All Angular pipes (`TimeAgoPipe`, etc.) |
| Exception filters (output shape under each HTTP status family) | Pure helper functions extracted from components |

Rule: **no I/O in unit tests**. Mock Prisma with `jest.fn()`, mock `HttpClient` with
`HttpTestingController`. A unit test must run offline with no DB, no network.

### Level 2 — Isolated integration tests (controllers and resolvers)

*Where:* `src/**/*.spec.ts` alongside the controller/resolver file.

Backend controllers and resolvers are tested with `@nestjs/testing`'s `createTestingModule`,
mocking the service layer. These tests verify:
- Route guards are applied (presence of `@UseGuards` decorators)
- DTOs are validated (call `ValidationPipe` explicitly)
- Response envelope shape (`{ data: ... }` on success, error shape on exception)
- Resolver field → service method mapping

Frontend components are tested with Angular's `TestBed` and mocked GQL services / command
services. The existing component specs (product list/detail, review list/form/card, my-reviews)
already follow this pattern — extend it to login/register/auth guard/interceptors.

### Level 3 — E2E / integration tests (full HTTP round-trip)

*Where:* `test/*.e2e-spec.ts` in the backend repo.

E2E tests boot `AppModule` against a real Postgres instance (provided by the GitHub Actions
`services` container). Each test module covers one domain:
- `app.e2e-spec.ts` — health endpoints ✅
- `auth.e2e-spec.ts` — register / login / refresh / logout ✅
- `reviews.e2e-spec.ts` — create / update / delete + aggregate recalc ✅
- `products.e2e-spec.ts` — GraphQL product + review queries with cursor pagination ✅

E2E tests run with `"maxWorkers": 1` in `jest-e2e.json` — sequential execution to prevent
parallel test suites from interfering with each other via the shared Postgres database.

### Level 4 — Smoke test (optional P2)

A single Playwright test that boots both apps and navigates the happy path
(register → browse product → submit review → see updated rating). Scoped as P2 stretch.

## Coverage Priorities (ordered by risk)

### P0 — Closed (all implemented as of Phase 9)

| File | Test type | Status |
|---|---|---|
| `products/products.service.ts` | Unit | ✅ |
| `reviews/reviews.controller.ts` | Isolated integration | ✅ |
| `auth/auth.controller.ts` | Isolated integration | ✅ |
| `common/pagination/cursor.util.ts` | Unit | ✅ |
| FE `auth.interceptor.ts` | Isolated integration | ✅ |
| FE `error.interceptor.ts` | Isolated integration | ✅ |
| BE `reviews.e2e-spec.ts` | E2E | ✅ |
| BE `products.e2e-spec.ts` | E2E | ✅ |

### P1 — Add alongside next feature work

| File | Test type | Reason |
|---|---|---|
| `reviews/reviews.resolver.ts` | Isolated integration | GraphQL field mapping to service |
| `products/products.resolver.ts` | Isolated integration | Pagination, filter mapping |
| `common/filters/http-exception.filter.ts` | Unit | Envelope shape contract |
| `common/filters/gql-exception.filter.ts` | Unit | GQL error extension shape |
| `auth/guards/jwt-auth.guard.ts` | Unit | Guard activation vs anonymous requests |
| FE `auth.guard.ts` | Isolated integration | Redirect logic |
| FE `login.component.ts` | Isolated integration | Form submit → AuthService, error display |
| FE `register.component.ts` | Isolated integration | Duplicate email error path |
| FE `star-rating.component.ts` | Isolated integration | Emit on click, disabled mode |
| FE `time-ago.pipe.ts` | Unit | Pure transform, boundary dates |

### P2 — Stretch / tech-debt clean-up

- JWT strategies (`jwt.strategy.ts`, `jwt-refresh.strategy.ts`) unit tests
- `correlation-id.middleware.ts` unit test
- `logging.interceptor.ts` unit test
- FE `pagination.component.ts`, `loading-spinner.component.ts`, `error-message.component.ts`
- Playwright smoke test

## What is explicitly out of scope

The following files are **not** worth unit-testing individually — they contain no logic:

- Module files (`*.module.ts`) — only DI wiring
- Model / DTO files — only decorators and type declarations
- GraphQL query documents (`*.queries.ts`) — only `gql` tag literals
- `main.ts`, `app.config.ts`, `app.routes.ts` — bootstrap/wiring
- `src/generated/**` — codegen output

## Trade-offs

| Simplification | Production alternative |
|---|---|
| No snapshot tests (Angular templates) | Playwright visual regression for critical pages |
| Coverage % threshold not enforced in CI yet | Add `--coverageThreshold` to Jest config once P1 gaps are closed |
| E2E test files run sequentially (`maxWorkers: 1`) against a shared Postgres DB | Per-suite DB reset with transaction rollback (`savepoints`) or separate schemas per test file |
| No contract (pact) tests between FE and BE | Apollo operation-level contract testing |
| `ValidationPipe` errors return 422 — tests must explicitly set `errorHttpStatusCode` in the e2e `beforeAll` | Global pipe registered in `main.ts` is already correct; e2e TestBed must replicate it |

## Alternatives considered

**Karma + Jasmine (FE):** Rejected. The project already uses `jest-preset-angular` /
`@angular-builders/jest`. Keeping a single test runner across both repos is simpler.

**Enforcing 80 % line coverage immediately:** Rejected. The current gap is too large — an
artificial threshold would create pressure to write low-value tests for modules and models.
Better to close the high-risk gaps (P0) first, then set a ratchet.

**Integration test DB per test file:** Evaluated. Transaction rollback (savepoint per test)
is the correct long-term pattern but adds setup complexity. Deferred to P1.
