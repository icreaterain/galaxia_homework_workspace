# 007 — One review per user per product

**Date:** 2026-03-31
**Status:** Decided

## Context

Amazon-style systems allow only one review per product per customer to prevent review
gaming and to simplify the data model and aggregate calculations.

## Decision

Enforce with a `UNIQUE(user_id, product_id)` constraint on the `reviews` table at the
database level. Application-level enforcement alone is insufficient due to race
conditions.

- The API returns **409 Conflict** with error code `DUPLICATE_REVIEW` if a user attempts
  to create a second review for the same product.
- The frontend shows "Edit your review" instead of "Write a review" when the user
  already has a review for the current product.
- Aggregate recalculation (`avg_rating`, `review_count`) is simplified: each review
  update changes exactly one row.

## Trade-offs

- Simplifies the data model and prevents abuse.
- Users can edit or delete their review, but cannot stack multiple reviews.
- The DB constraint is the ultimate safety net; the service layer also checks before
  attempting an insert for a clearer error message.

## Alternatives considered

- **Application-level enforcement only:** Rejected — race conditions can bypass it
  without a DB constraint.
- **Allow multiple drafts:** Not aligned with the Amazon-style UX goal.
