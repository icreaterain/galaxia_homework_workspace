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
- `app.e2e-spec.ts` — health endpoints
- `auth.e2e-spec.ts` — register / login / refresh / logout
- `reviews.e2e-spec.ts` *(planned)* — create / update / delete + aggregate recalc
- `products.e2e-spec.ts` *(planned)* — GraphQL product + review queries with cursor pagination

### Level 4 — Smoke test (optional P2)

A single Playwright test that boots both apps and navigates the happy path
(register → browse product → submit review → see updated rating). Scoped as P2 stretch.

## Coverage Priorities (ordered by risk)

### P0 — Must add before any new feature

| File | Test type | Reason |
|---|---|---|
| `products/products.service.ts` | Unit | Cursor pagination + filter logic has no coverage |
| `reviews/reviews.controller.ts` | Isolated integration | Owner-check + envelope shape |
| `auth/auth.controller.ts` | Isolated integration | Refresh cookie handling; partially in e2e but unit gap |
| `common/pagination/cursor.util.ts` | Unit | Pure encode/decode — trivial but load-bearing |
| FE `auth.interceptor.ts` | Isolated integration | Injects Bearer token on every request |
| FE `error.interceptor.ts` | Isolated integration | 401 → silent refresh → retry is the hardest FE path |

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
| BE `reviews.e2e-spec.ts` | E2E | Full review lifecycle with aggregate recalc |
| BE `products.e2e-spec.ts` | E2E | GraphQL cursor pagination |

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
| Coverage % threshold not enforced in CI yet | Add `--coverageThreshold` to Jest config once P0 gaps are closed |
| E2E tests share a single Postgres DB without full reset between suites | Use `beforeEach` transaction rollback or per-suite DB resets |
| No contract (pact) tests between FE and BE | Apollo operation-level contract testing |

## Alternatives considered

**Karma + Jasmine (FE):** Rejected. The project already uses `jest-preset-angular` /
`@angular-builders/jest`. Keeping a single test runner across both repos is simpler.

**Enforcing 80 % line coverage immediately:** Rejected. The current gap is too large — an
artificial threshold would create pressure to write low-value tests for modules and models.
Better to close the high-risk gaps (P0) first, then set a ratchet.

**Integration test DB per test file:** Evaluated. Transaction rollback (savepoint per test)
is the correct long-term pattern but adds setup complexity. Deferred to P1.
