# Angular Patterns

Applies to: `cloudtalk_homework_fe/**/*.ts`

## Components

- Use standalone components (Angular 19, no NgModules)
- Keep templates simple — move complex logic into the component class or a service
- Use `OnPush` change detection for list-item components (e.g., `ReviewCardComponent`)

```typescript
@Component({
  selector: 'app-review-card',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `...`,
})
export class ReviewCardComponent {
  @Input({ required: true }) review!: Review;
}
```

## Services

- All HTTP calls live in services, never in components
- Use the `inject()` function over constructor injection for new code
- Return `Observable<T>` from service methods; use `firstValueFrom()` in components when async/await is cleaner

## Auth State

Auth uses **self-managed JWT** — no Firebase. `AuthService` (`src/app/core/auth/auth.service.ts`):

- Stores the access token in `sessionStorage` and exposes it via Angular **signals**:
  `isLoggedIn`, `currentUser`, `accessToken` (all `computed()` or `signal()`)
- `initFromSession()` is called on app boot via `APP_INITIALIZER` in `app.config.ts`
- On login/register, the server returns `{ accessToken, user }` and sets an httpOnly refresh cookie
- `authInterceptor` (functional) attaches `Authorization: Bearer` to all outgoing REST requests
- `errorInterceptor` catches 401 responses and calls `POST /api/auth/refresh` (uses the httpOnly cookie);
  on success it retries the original request; on failure it clears the session

```typescript
// ✅ reading auth state in a component
readonly authService = inject(AuthService);
// template: @if (authService.isLoggedIn()) { ... }
```

```typescript
// ❌ DO NOT store tokens in localStorage
// ❌ DO NOT use Firebase — auth is self-managed
```

## Route Guards

Use the functional `authGuard` from `src/app/core/auth/auth.guard.ts`. Apply it in `app.routes.ts`:

```typescript
{ path: 'my-reviews', canActivate: [authGuard], loadComponent: () => ... }
```

The guard reads `authService.isLoggedIn()` (signal, synchronous). On failure it redirects to
`/auth/login?returnUrl=<original-path>`. `LoginComponent` reads `?returnUrl` and navigates there
after a successful login (falling back to `/products`).

## Error Display

Show user-facing errors via `ErrorMessageComponent` (`src/app/shared/components/error-message.component.ts`). Never use `alert()`.

## Apollo / GraphQL

- `provideApollo()` is called in `app.config.ts` and returns `EnvironmentProviders`
- Query documents live in `features/<domain>/graphql/<domain>.queries.ts` as `gql` tagged templates
- Typed query services live in `src/generated/graphql.ts` — run `pnpm run codegen` to regenerate
- **Inject the generated typed service** (e.g. `ProductListGQL`) — do not inject `Apollo` directly

### `importProvidersFrom` is required for `ApolloModule`

```typescript
// ✅ correct — Apollo service is visible to lazy-loaded routes
makeEnvironmentProviders([
  importProvidersFrom(ApolloModule),
  { provide: APOLLO_OPTIONS, useFactory: ..., deps: [HttpLink] },
])

// ❌ wrong — ApolloModule placed directly; Apollo service is NOT registered
makeEnvironmentProviders([
  ApolloModule,              // ← silent failure; injectables inside are not provided
  { provide: APOLLO_OPTIONS, ... },
])
```

Without `importProvidersFrom`, lazy-loaded components that inject a generated GQL service throw
`NullInjectorError: No provider for _Apollo!` even though the provider array looks correct.

### QueryRef + Signals + OnPush (the standard data-fetching pattern)

Every data-fetching component uses this structure:

```typescript
// 1. Inject the generated GQL service, CDR, and a destroy Subject
private readonly gql = inject(ProductListGQL);
private readonly cdr = inject(ChangeDetectorRef);
private readonly destroy$ = new Subject<void>();

// 2. Signals for template state (OnPush-compatible)
readonly loading = signal(true);
readonly items = signal<NodeType[]>([]);
readonly hasNextPage = signal(false);
readonly endCursor = signal<string | null>(null);

// 3. Watch query
ngOnInit(): void {
  this.queryRef = this.gql.watch({ first: 12 });
  this.queryRef.valueChanges.pipe(takeUntil(this.destroy$)).subscribe((result) => {
    this.loading.set(false);
    this.items.set(result.data.products.edges.map((e) => e.node));
    this.cdr.markForCheck(); // ← always required when using OnPush + Apollo observable
  });
}
ngOnDestroy(): void { this.destroy$.next(); this.destroy$.complete(); }

// 4. Refetch (filters changed)
reload(): void { void this.queryRef.refetch({ first: 12, filter: ... }); }

// 5. Load more
onLoadMore(): void {
  void this.queryRef.fetchMore({ variables: { after: this.endCursor() } });
}
```

### Product Image Loading (LCP)

The first row of a product grid is typically the LCP element. Use `eager`/`high-priority` for
the first few cards and `lazy` for the rest to avoid NG0913 warnings:

```html
@for (product of products(); track product.id; let i = $index) {
  <img
    [src]="product.imageUrl"
    [attr.loading]="i < 4 ? 'eager' : 'lazy'"
    [attr.fetchpriority]="i < 4 ? 'high' : null"
  />
}
```

## Reactive Forms

Use `FormBuilder.nonNullable.group()` so `getRawValue()` returns non-nullable typed values.
Angular's static `Validators.*` methods are safe as unbound references — ESLint is configured
with `ignoreStatic: true` to allow this pattern:

```typescript
// ✅ correct
readonly form = this.fb.nonNullable.group({
  email: ['', [Validators.required, Validators.email]],
  password: ['', [Validators.required, Validators.minLength(8)]],
});
const { email, password } = this.form.getRawValue();
```

## Testing

- Run tests with `pnpm test` (`ng test` via `@angular-builders/jest`); the builder owns zone env init
- **Do NOT call `setupZoneTestEnv()` in `setup-jest.ts`** — `@angular-builders/jest` injects it;
  calling it twice causes "Cannot set base providers because it has already been called"
- Components that inject `AuthService` need `provideHttpClient()` and `provideRouter([])` in the spec:

```typescript
await TestBed.configureTestingModule({
  imports: [MyComponent],
  providers: [provideRouter([]), provideHttpClient()],
}).compileComponents();
```

- Services that call `router.navigate()` need a **mock Router**, not `provideRouter([])` — a real
  router with no routes throws `NG04002` on any navigation attempt:

```typescript
const mockRouter = { navigate: jest.fn().mockResolvedValue(true) };
TestBed.configureTestingModule({
  providers: [
    provideHttpClient(),
    provideHttpClientTesting(),
    { provide: Router, useValue: mockRouter },
  ],
});
```
