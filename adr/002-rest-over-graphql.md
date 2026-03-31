# 002 — REST over GraphQL

**Date:** 2026-03-31
**Status:** Decided

## Context

The system is straightforward CRUD over two main entities (products, reviews).

## Decision

Plain REST API with JSON.

## Trade-offs

- No over-fetching protection, but the dataset is small and queries are simple.
- REST is easier to inspect with curl/Postman, lowering evaluator friction.

## Alternatives considered

GraphQL — would add complexity (resolver setup, schema definition language) without
meaningful benefit at this scale.
