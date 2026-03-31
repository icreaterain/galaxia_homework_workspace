# 001 — TypeScript end-to-end: NestJS + Angular

**Date:** 2026-03-31
**Status:** Decided

## Context

The assignment states a preference for Node.js + Angular. Both repositories must be
maintainable by developers who may not have authored them, so consistent language and
strong typing are priorities.

## Decision

Use **TypeScript** throughout both repositories with `strict: true`:

- **Backend:** NestJS with Fastify adapter (see [ADR 003](003-backend-framework.md))
- **Frontend:** Angular 17+ with standalone components and signals

No runtime JavaScript files. Explicit return types on all public service and controller
methods. No `any`.

## Trade-offs

- Angular has more boilerplate than React/Vue for a small demo, but provides strong
  structure (DI, modules, guards, interceptors) that suits a "maintainable by others"
  requirement.
- Strict TypeScript catches contract drift between frontend models and backend DTOs at
  compile time, reducing integration bugs.
- NestJS mirrors Angular's architectural patterns (modules, decorators, DI), making the
  mental model consistent across both repos.

## Alternatives considered

- **Next.js full-stack:** Rejected — harder to demonstrate a clear BE/FE separation and
  the hybrid REST+GraphQL split.
- **JavaScript (no TypeScript):** Rejected — type safety is a core requirement for
  long-term maintainability.
