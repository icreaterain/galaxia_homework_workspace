# 003 — NestJS vs Express for the backend framework

**Date:** 2026-03-31
**Status:** Under discussion — to be decided at implementation start

## Context

Both are valid Node.js frameworks. NestJS provides opinionated structure
(modules, controllers, services) closer to Angular's mental model; Express is minimal.

## Decision

TBD. Update this entry when decided.

## Trade-offs

- **NestJS:** more structured, DI built-in, better for long-term maintainability, but
  heavier for a demo. Strong parallel to Angular's architecture (good for consistency).
- **Express:** simpler, less magic, faster to scaffold manually.

## Alternatives considered

Fastify — similar to Express but faster; not chosen as the default recommendation because
it is less familiar and adds no meaningful advantage for a demo-scale project.

## Recommendation

NestJS if the evaluator values structure and consistency with the Angular frontend.
Express if brevity and minimal scaffolding matter more.
