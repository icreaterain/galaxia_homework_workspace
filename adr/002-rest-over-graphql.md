# 002 — REST over GraphQL (superseded)

**Date:** 2026-03-31
**Status:** Superseded by [009 — Hybrid REST + GraphQL](009-hybrid-rest-graphql.md)

## Original decision (no longer in force)

Plain REST API with JSON for all operations.

## Supersession

The original rationale — that GraphQL adds complexity without meaningful benefit at this
scale — was revised when we considered the product detail page: a single page composed
of product info, aggregated ratings, and a paginated, sortable review list. REST would
require multiple round trips or a custom "include" parameter that re-implements GraphQL
ad hoc.

The system now uses a **hybrid model**: REST for command-oriented writes (auth, review
mutations) and GraphQL for read-oriented composed views (product queries, paginated
review lists with aggregates). See [ADR 009](009-hybrid-rest-graphql.md) for the full
rationale.
