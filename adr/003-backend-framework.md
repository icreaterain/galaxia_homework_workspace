# 003 — NestJS with Fastify adapter as the backend framework

**Date:** 2026-03-31
**Status:** Decided

## Context

Both NestJS and Express are valid Node.js frameworks. The choice affects how well the
backend scales to adding GraphQL, guards, interceptors, and a layered module structure.

## Decision

Use **NestJS** with the **Fastify adapter** (`@nestjs/platform-fastify`).

- NestJS provides opinionated structure (modules, controllers, services, DI) that mirrors
  Angular's architecture, making the codebase consistent across both repositories.
- The Fastify adapter replaces the default Express adapter, giving lower per-request
  overhead and access to Fastify plugins (`@fastify/cookie`, `@fastify/helmet`).
- Apollo Server is registered via `@nestjs/graphql` with the Apollo driver, enabling the
  hybrid REST + GraphQL model on a single port.

## Trade-offs

- **NestJS:** more structured and opinionated than Express; setup is heavier for a small
  demo but better for long-term maintainability and evaluation of engineering judgment.
- **Fastify over Express:** requires `@fastify/cookie` for httpOnly cookie support and
  small adjustments to how middleware is registered. The performance and plugin ecosystem
  benefits outweigh this.
- The NestJS DI system makes service-layer unit testing straightforward (mock any
  injectable dependency).

## Alternatives considered

- **Express:** simpler and more familiar, but would require manual wiring of DI,
  validation, guard patterns, and GraphQL integration. Rejected in favour of NestJS's
  built-in equivalents.
- **Fastify (standalone):** valid but loses NestJS's module system, which is essential
  for organizing the auth, products, reviews, and common modules cleanly.
- **tRPC:** excellent for same-repo full-stack TypeScript, but this project uses two
  separate repositories where tRPC's end-to-end type safety does not apply.
