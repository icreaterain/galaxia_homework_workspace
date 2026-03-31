# 009 — Hybrid REST + GraphQL (CQRS-lite)

**Date:** 2026-03-31
**Status:** Decided

## Context

The initial ADR ([002](002-rest-over-graphql.md)) chose REST-only. When designing the
product detail page — a composed view of product info, rating aggregates, and a
paginated, sortable, filterable review list — REST-only requires either multiple round
trips (product + reviews + aggregates) or a custom `?include=` parameter that
re-implements GraphQL ad hoc. GraphQL-only, on the other hand, loses the clarity of
HTTP status codes and verbs for command operations (create, update, delete, auth).

## Decision

Use a **hybrid model** on a single NestJS application (port 3000):

- **REST (`/api/*`):** all command-oriented writes — auth flows, review create/update/delete.
  HTTP verbs and status codes (201, 204, 409, 422) communicate intent unambiguously.
  Easy to inspect with curl/Postman. Natural fit for cookie-based refresh token handling.
- **GraphQL (`/graphql`):** all read-oriented composed views — product queries with
  nested reviews, aggregates, pagination, sorting, and filtering. The frontend requests
  exactly the fields it needs. Apollo Client provides normalized caching on the frontend.

Both REST controllers and GraphQL resolvers inject the **same service layer**. Services
are protocol-agnostic and contain all business logic. Only the protocol boundary
(controller or resolver) knows about the transport.

```
Angular SPA
 ├── HttpClient  ──POST/PUT/DELETE──▶ /api/*     (REST controllers)
 └── Apollo      ──POST /graphql──▶  /graphql    (GraphQL resolvers)
 │
 Service Layer (shared, protocol-agnostic)
 │
 Prisma Client
 │
 PostgreSQL
```

## Trade-offs

- **Two protocols mean two auth guard variants** (`JwtAuthGuard` for REST,
  `GqlAuthGuard` for GraphQL). Both share the same `JwtStrategy`; only context
  extraction differs. Cost is bounded.
- **Two error handling paths** (HTTP exception filter + Apollo `formatError`). The
  `common/` module standardizes error codes and formats across both.
- **Hybrid is more to explain** than REST-only. The architectural clarity (commands vs
  reads) is the payoff; it creates an explicit separation that invites discussion.

## Alternatives considered

- **REST-only:** Valid but requires multiple round trips for the product detail page or
  a custom include parameter. The read paths are naturally better served by GraphQL.
- **GraphQL-only:** Mutations in GraphQL lose HTTP status code clarity. A
  `createReview` mutation returning a union to indicate 409 Conflict is more complex
  than `POST /api/products/:id/reviews` returning HTTP 409.
- **tRPC:** Strong for same-repo full-stack TypeScript monorepos, but this project uses
  two separate repositories where tRPC's end-to-end type safety does not apply.
