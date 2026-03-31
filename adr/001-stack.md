# 001 — Node.js + Angular as primary stack

**Date:** 2026-03-31
**Status:** Decided

## Context

The assignment states a preference for Node.js + Angular.

## Decision

Use Node.js (TypeScript) for the backend and Angular for the frontend.

## Trade-offs

- Angular has more boilerplate than React/Vue for a small demo, but provides strong
  structure and typing that suits a "maintainable by other developers" requirement.
- Node.js is a natural fit alongside Angular since both use TypeScript and npm.

## Alternatives considered

Next.js full-stack — rejected: harder to demonstrate a clear BE/FE separation.
NestJS for the backend — considered; see [003](003-backend-framework.md).
