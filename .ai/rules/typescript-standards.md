# TypeScript Standards

Applies to: `**/*.ts` in both the Angular frontend and Node.js backend.

## Error Handling

```typescript
// ❌ BAD
try {
  await reviewsService.create(dto);
} catch (e) {}

// ✅ GOOD
try {
  await reviewsService.create(dto);
} catch (e) {
  logger.error('Failed to create review', { error: e, dto });
  throw new ServiceError('Review creation failed', { cause: e });
}
```

## No `any`

Use `unknown` and narrow, or define proper types. `any` is forbidden unless interfacing with a third-party library that provides no types.

## Async/Await over raw Promises

Prefer `async/await` for all async code. Avoid `.then().catch()` chains.

## Explicit Return Types on Public Functions

```typescript
// ❌ BAD
async function getReviews(productId: string) { ... }

// ✅ GOOD
async function getReviews(productId: string): Promise<Review[]> { ... }
```

## DTOs / Types

- Define request/response shapes as TypeScript interfaces or classes
- Use a shared types pattern: if both FE and BE need the same shape, document it in ARCHITECTURE.md and keep them in sync manually (no shared package in MVP)
