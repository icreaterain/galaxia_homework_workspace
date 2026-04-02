# Testing Guide

Living reference for test coverage, patterns, and the backlog of gaps.
The **strategic rationale** (why these layers, why these priorities) lives in
[ADR 013](adr/013-testing-strategy.md).

---

## Quick Commands

```bash
# Backend unit tests
cd cloudtalk_homework_be && pnpm test

# Backend unit tests with coverage report
cd cloudtalk_homework_be && pnpm test -- --coverage

# Backend e2e (requires Postgres)
cd cloudtalk_homework_be && pnpm run test:e2e

# Frontend unit tests
cd cloudtalk_homework_fe && pnpm test

# Frontend unit tests with coverage report
cd cloudtalk_homework_fe && pnpm test -- --coverage
```

---

## Test Pyramid

```
         ▲
         │  L4 Playwright smoke (P2 — not yet)
        ╱╲
       ╱  ╲  L3 E2E (Postgres + full AppModule)
      ╱────╲
     ╱      ╲  L2 Isolated integration (controllers, resolvers, components)
    ╱──────────╲
   ╱            ╲  L1 Unit (services, pipes, pure utilities)
  ╱──────────────╲
```

**L1 Unit** — mock all I/O; no DB, no HTTP.
**L2 Isolated integration** — `@nestjs/testing` / Angular `TestBed`; mock the service layer.
**L3 E2E** — full NestJS app + real Postgres; HTTP via `supertest`/`@nestjs/testing`.
**L4 Smoke** — Playwright; both apps running; happy-path navigation only.

---

## Current Coverage Audit

### Backend (as of 2026-04-02)

#### Covered

| File | Level | What is tested |
|---|---|---|
| `auth/auth.service.ts` | L1 unit | register (hash, conflict), login (wrong user/password), refresh (success, 401) |
| `reviews/reviews.service.ts` | L1 unit | create, update, delete (owner guard, aggregates, errors), findByProduct (pagination, filter, sort), findMyReviews, getRatingDistribution |
| `health/health.controller.ts` | L1 unit | liveness (timestamp), readiness (DB ok / error / non-Error rejection) |
| `database/prisma.service.ts` | L1 unit | smoke: defined, lifecycle hooks present |
| *full app (health routes)* | L3 e2e | `GET /api/health`, `GET /api/health/ready` → 200 + JSON shape |
| *full app (auth routes)* | L3 e2e | register, login, refresh, logout — status codes, envelope, cookies, validation, 401 |

#### P0 — closed ✓

| File | Level | Tests added |
|---|---|---|
| `products/products.service.ts` | L1 unit | cursor encode/decode, filter by category/search, `findById` not-found, `findByIdOptional`, hasNextPage, page caps |
| `reviews/reviews.controller.ts` | L2 isolated | create/update/delete success envelopes, ForbiddenException, NotFoundException propagation |
| `auth/auth.controller.ts` | L2 isolated | register/login/refresh response envelopes, cookie set/clear, `parseExpiry` all units |
| `common/pagination/cursor.util.ts` | L1 unit | round-trip, uuid, special chars, empty string, invalid base64, missing id, null payload |

**P1 — closed ✓**

| File | Level | Tests added |
|---|---|---|
| `reviews/reviews.resolver.ts` | L2 isolated | `myReviews` pagination, `reviews` ResolveField, `ratingDistribution` |
| `products/products.resolver.ts` | L2 isolated | `product(id)` nullable, `products` connection args forwarding |
| `common/filters/http-exception.filter.ts` | L1 unit | Envelope shape all status families, array messages, body.error passthrough |
| `common/filters/gql-exception.filter.ts` | L1 unit | GraphQLError thrown, extensions.code + statusCode, all status families |
| `auth/guards/jwt-auth.guard.ts` | L1 unit | handleRequest passthrough and error re-throw |
| `test/reviews.e2e-spec.ts` | L3 e2e | Create/update/delete lifecycle, aggregate recalc, 403/409/401/422 |
| `test/products.e2e-spec.ts` | L3 e2e | `product(id)` nullable, cursor pagination, next page, category filter |

**P2 — tech debt / stretch**

| File | Suggested level | Notes |
|---|---|---|
| `auth/strategies/jwt.strategy.ts` | L1 unit | `validate()` method only |
| `auth/strategies/jwt-refresh.strategy.ts` | L1 unit | `validate()` with cookie extraction |
| `common/middleware/correlation-id.middleware.ts` | L1 unit | assigns UUID if header absent; passes existing header through |
| `common/interceptors/logging.interceptor.ts` | L1 unit | log shape; timer attached |

**Not worth testing** (no logic): `*.module.ts`, `*.model.ts`, `*.dto.ts`, `*.interface.ts`,
`main.ts`, `app.module.ts`, `config/configuration.ts`.

---

### Frontend (as of 2026-04-02)

#### Covered

| File | Level | What is tested |
|---|---|---|
| `core/auth/auth.service.ts` | L2 isolated | signals init, sessionStorage restore, login/register/logout/refresh with `HttpTestingController`, 401 clears session, logout navigates |
| `features/reviews/review-command.service.ts` | L2 isolated | create (POST body/URL), update (PUT), delete (DELETE), default API base |
| `features/products/product-list.component.ts` | L2 isolated | GQL `watch`, render, loading/error states, categories, load-more guard, debounced search, filter/clear |
| `features/products/product-detail.component.ts` | L2 isolated | product header, price, description, not-found, ratingBars math, onReviewsChanged/reload |
| `features/reviews/review-list.component.ts` | L2 isolated | GQL watch, cards, count, errors, pagination, reload, CTA (anon vs auth), form cancel/saved, delete confirm |
| `features/reviews/review-form.component.ts` | L2 isolated | create vs edit mode, validation, star change, submit, DUPLICATE_REVIEW, cancel, invalid-submit touches |
| `features/reviews/review-card.component.ts` | L2 isolated | author, initial, optional title, helpful count, isOwner gates, edit/delete outputs |
| `features/reviews/my-reviews.component.ts` | L2 isolated | list/empty/error, product name, edit/form-saved, delete+confirm, load-more, reload |
| `app.component.ts` | L2 isolated | smoke: component creates |

#### P0 — closed ✓

| File | Level | Tests added |
|---|---|---|
| `core/auth/auth.interceptor.ts` | L2 isolated | attaches Bearer header, skips when null, token rotates between requests |
| `core/http/error.interceptor.ts` | L2 isolated | non-401 pass-through, 401 on /auth/ pass-through, refresh+retry with new token, refresh failure clears session |

**P1 — closed ✓**

| File | Level | Tests added |
|---|---|---|
| `core/auth/auth.guard.ts` | L2 isolated | Returns true when authenticated, UrlTree with returnUrl when not |
| `features/auth/login.component.ts` | L2 isolated | Form validation, submit flow, error envelope, returnUrl navigation, isLoading |
| `features/auth/register.component.ts` | L2 isolated | Form validation, duplicate email error, isLoading |
| `shared/components/star-rating/star-rating.component.ts` | L2 isolated | Star classes, `onSelect` emit, disabled in readonly mode |
| `shared/pipes/time-ago.pipe.ts` | L1 unit | All thresholds (seconds → years), string input |

**P2 — shared UI (very simple)**

| File | Suggested level | Notes |
|---|---|---|
| `shared/components/pagination.component.ts` | L2 isolated | emits `loadMore` only when `hasNextPage` |
| `shared/components/loading-spinner.component.ts` | L2 isolated | renders when `loading` true; hides otherwise |
| `shared/components/error-message.component.ts` | L2 isolated | renders message string |

**Not worth testing**: `*.queries.ts` (gql tag literals), `*.models.ts` (interfaces only),
`app.routes.ts`, `app.config.ts`, `graphql.provider.ts`, `main.ts`, `src/generated/**`.

---

## Test Patterns

### Backend — unit test for a service

```typescript
// reviews.service.spec.ts pattern
const mockPrisma = {
  review: {
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    findMany: jest.fn(),
    groupBy: jest.fn(),
  },
  product: { update: jest.fn() },
  $transaction: jest.fn((fn) => fn(mockPrisma)),
};

beforeEach(async () => {
  const module = await Test.createTestingModule({
    providers: [
      ReviewsService,
      { provide: PrismaService, useValue: mockPrisma },
    ],
  }).compile();
  service = module.get(ReviewsService);
});
```

### Backend — isolated integration test for a controller

```typescript
// reviews.controller.spec.ts pattern
const mockReviewsService = {
  create: jest.fn(),
  update: jest.fn(),
  remove: jest.fn(),
};

beforeEach(async () => {
  const module = await Test.createTestingModule({
    controllers: [ReviewsController],
    providers: [{ provide: ReviewsService, useValue: mockReviewsService }],
  })
    .overrideGuard(JwtAuthGuard)
    .useValue({ canActivate: () => true })
    .compile();
  controller = module.get(ReviewsController);
});
```

### Backend — E2E test skeleton

```typescript
// test/reviews.e2e-spec.ts pattern
let app: NestFastifyApplication;
let prisma: PrismaService;

beforeAll(async () => {
  const module = await Test.createTestingModule({ imports: [AppModule] }).compile();
  app = module.createNestApplication<NestFastifyApplication>(new FastifyAdapter());
  app.register(fastifyCookie);
  app.useGlobalPipes(new ValidationPipe({ whitelist: true }));
  app.useGlobalFilters(new HttpExceptionFilter());
  await app.init();
  await app.getHttpAdapter().getInstance().ready();
  prisma = module.get(PrismaService);
});

afterAll(async () => {
  await prisma.$disconnect();
  await app.close();
});
```

### Frontend — isolated component test

```typescript
// Pattern already established in product-list.component.spec.ts
const mockGql = { watch: jest.fn() };

beforeEach(async () => {
  await TestBed.configureTestingModule({
    imports: [ComponentUnderTest],
    providers: [
      { provide: ProductListGQL, useValue: mockGql },
      provideRouter([]),
      provideHttpClient(),
    ],
  }).compileComponents();
  fixture = TestBed.createComponent(ComponentUnderTest);
});
```

### Frontend — interceptor test

```typescript
// Pattern for auth.interceptor.spec.ts
beforeEach(() => {
  TestBed.configureTestingModule({
    providers: [
      provideHttpClient(withInterceptors([authInterceptor])),
      provideHttpClientTesting(),
      { provide: AuthService, useValue: { accessToken: signal('test-token') } },
    ],
  });
});

it('attaches Authorization header', () => {
  httpClient.get('/api/products').subscribe();
  const req = httpTesting.expectOne('/api/products');
  expect(req.request.headers.get('Authorization')).toBe('Bearer test-token');
});
```

---

## CI Integration

Unit tests run on every push:

```yaml
# .github/workflows/ci-be.yml (relevant step)
- name: Unit tests
  run: pnpm test -- --ci --passWithNoTests

# .github/workflows/ci-fe.yml (relevant step)
- name: Unit tests
  run: pnpm test -- --ci --passWithNoTests
```

E2E tests run with a Postgres service container:

```yaml
services:
  postgres:
    image: postgres:16
    env:
      POSTGRES_DB: reviews_test
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: postgres
    ports: ['5432:5432']
```

**Coverage thresholds** are not enforced yet. Once P0 gaps are closed, add to
`jest.config.js` / `package.json`:

```json
"coverageThreshold": {
  "global": { "lines": 70, "functions": 70, "branches": 60 }
}
```

Ratchet upward by 5 % per sprint until a stable ≥ 80 % line coverage is reached.

---

## Gap Closure Roadmap

| Sprint | Target | Status |
|---|---|---|
| 1 | Audit documented; P0 gaps closed in both repos | **done** |
| 2 | P1 BE: resolver specs, exception filter specs, `reviews.e2e-spec` | **done** |
| 2 | P1 FE: guard, login/register components, `star-rating`, `time-ago.pipe` | **done** |
| 3 | P2 all items; enable coverage thresholds at 70 % | pending |
| 4 | Ratchet to 80 % lines; add Playwright smoke | pending |
