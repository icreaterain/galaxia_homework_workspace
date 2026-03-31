# 007 — One review per user per product

**Date:** 2026-03-31
**Status:** Decided

## Context

Amazon-style systems allow only one review per product per customer to prevent
gaming and simplify the data model.

## Decision

Enforce with a `UNIQUE(user_id, product_id)` constraint at the database level.
The API returns 409 Conflict if a user attempts to create a second review.
The frontend shows "Edit your review" instead of "Write a review" when the user
already has a review for the current product.

## Trade-offs

- Simplifies the data model and prevents abuse.
- Users can edit or delete their review, but cannot stack multiple reviews.

## Alternatives considered

Application-level enforcement only — rejected: race conditions can bypass it without
a DB constraint.
