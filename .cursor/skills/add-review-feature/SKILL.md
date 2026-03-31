---
name: add-review-feature
description: Guides end-to-end implementation of a feature in the product review system, covering backend (controller, service, DB migration) and frontend (component, service, routing). Use when adding a new API endpoint, a new UI feature, or a new entity to the review system domain.
---

# Adding a Feature to the Review System

## Domain Model Quick Reference

```
users ──< reviews >── products
```

- One review per user per product (UNIQUE constraint)
- Rating: integer 1–5
- Aggregates (avg_rating, review_count) are computed via SQL, not stored

## Feature Implementation Checklist

Copy and track:

```
- [ ] 1. Design the API contract change (if any)
- [ ] 2. Write or update DB migration
- [ ] 3. Implement BE service method
- [ ] 4. Implement BE controller/route
- [ ] 5. Write BE unit tests
- [ ] 6. Update Angular service (HTTP call)
- [ ] 7. Implement Angular component/template
- [ ] 8. Write FE unit tests
- [ ] 9. Add an ADR in `adr/` if a non-trivial decision was made; update `ARCHITECTURE.md` if current state changed
- [ ] 10. Update WORKSPACE.md if a convention changed
```

## Step 1 — API Contract

Before writing any code, write out the endpoint shape:

```
METHOD /path
Auth: required | public
Request body: { field: type, ... }
Response 200: { data: { ... } }
Response errors: 401 | 403 | 404 | 409 | 422
```

Confirm this matches the URL conventions in `.cursor/rules/api-design.mdc`.

## Step 2 — Database Migration

Name migrations: `YYYYMMDDHHMMSS_<description>.ts`

If adding a column, ensure it is nullable or has a default — never add a NOT NULL column without a default to an existing table.

## Step 3–4 — Backend (NestJS or Express)

**NestJS pattern:**
```
src/
  reviews/
    reviews.controller.ts   ← route handlers, validation
    reviews.service.ts       ← business logic, DB calls
    dto/
      create-review.dto.ts
      update-review.dto.ts
    reviews.module.ts
```

**Express pattern:**
```
src/
  reviews/
    reviews.router.ts        ← route definitions + middleware
    reviews.controller.ts    ← handler functions
    reviews.service.ts       ← business logic, DB calls
    reviews.schema.ts        ← Zod/Joi validation schemas
```

Authorization check: verify `req.user.id === review.user_id` before allowing edit/delete. Return 403 if not the owner.

## Step 6–7 — Frontend

**Angular service pattern:**
```typescript
@Injectable({ providedIn: 'root' })
export class ReviewService {
  private http = inject(HttpClient);

  getReviews(productId: string): Observable<Review[]> {
    return this.http.get<{ data: Review[] }>(`/api/products/${productId}/reviews`)
      .pipe(map(res => res.data));
  }
}
```

**Component pattern:**
- Use `OnPush` change detection for review list items
- Show loading state while request is in flight
- Show inline error if submission fails (do not navigate away)
- Disable the submit button while the request is pending

## Auth-Gated UI

When a feature requires authentication:
- Gate the route with the `AuthGuard`
- In the template, use `@if (authService.isLoggedIn$ | async)` to conditionally show
  "Write a review" vs "Edit your review" vs "Sign in to review"

## Testing Notes

**BE:** Test service methods with a mocked repository/DB client. Test controller with supertest.

**FE:** Test service HTTP calls with `HttpClientTestingModule`. Test components with `TestBed` and mock the service.

## Common Mistakes to Avoid

- Forgetting to set `Content-Type: application/json` in FE HTTP calls (Angular's `HttpClient` does this automatically — don't override it)
- Returning the full user object from BE endpoints — strip `password` hash before responding
- Not handling the 409 Conflict case in the FE when a user tries to review a product twice
