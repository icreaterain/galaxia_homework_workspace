---
name: cross-repo-change
description: Coordinates changes that span both the frontend (cloudtalk_homework_fe) and backend (cloudtalk_homework_be) repositories. Use when an API contract changes, a new endpoint is added, a shared type needs updating, or any change requires commits in both repos.
---

# Cross-Repo Change Coordination

## Dependency Direction

```
cloudtalk_homework_fe  →  depends on  →  cloudtalk_homework_be
```

The frontend consumes the backend API. Backend changes must always be stable before the frontend is updated to depend on them.

## Merge Order (always follow this)

1. **Backend first** — implement and merge the BE change
2. **Frontend second** — update the FE to consume the new contract

Never merge a FE change that depends on an unmerged BE change.

## Workflow

```
- [ ] 1. Design the shared API contract (document it)
- [ ] 2. Implement BE change on a feature branch
- [ ] 3. Verify BE change locally (tests pass, endpoint works)
- [ ] 4. Merge BE branch to main
- [ ] 5. Implement FE change on a matching feature branch
- [ ] 6. Test FE against the updated BE
- [ ] 7. Merge FE branch to main
```

## Naming Branches Across Repos

Use the same feature scope in both branch names:

```
cloudtalk_homework_be:  feat/reviews-add-helpful-votes
cloudtalk_homework_fe:  feat/reviews-add-helpful-votes
```

## Commit Message Coordination

Use the same scope in both repos' commit messages:

```
# BE commit
feat(reviews): add helpful votes endpoint

# FE commit
feat(reviews): implement helpful votes UI
```

## API Contract Documentation

When adding or changing an endpoint, document the contract in both places:

1. **In the BE repo** — update/add the route's JSDoc or OpenAPI comment
2. **In ARCHITECTURE.md** — if it's a non-trivial design decision (e.g., new auth flow)
3. **In WORKSPACE.md** — if the URL conventions section changes

## Type Synchronization

There is no shared package between FE and BE in the MVP.
When a type/interface changes (e.g., the `Review` response shape):

1. Update the BE response DTO/interface
2. Manually update the matching TypeScript interface in the FE (`src/app/models/review.ts` or similar)
3. Note this in the commit message: `feat(reviews): align Review type with API v2 response shape`

## Checklist Before Opening a FE PR That Depends on a BE Change

- [ ] BE PR is merged to `main`
- [ ] FE branch is based on a commit after the BE merge
- [ ] Local integration test passes (FE running against the updated BE)
- [ ] No hardcoded localhost URLs — use Angular's environment files
