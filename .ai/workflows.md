# Cross-Repository Workflows

Patterns for coordinating changes across `cloudtalk_homework_be` and `cloudtalk_homework_fe`.

## Dependency Graph

```
cloudtalk_homework_fe  →  depends on  →  cloudtalk_homework_be
```

The frontend consumes the backend's REST endpoints and GraphQL schema. Backend changes must be stable before the frontend is updated.

---

## 1. Backend-Only Change

**When:** New or modified REST endpoint, service logic, database migration, or GraphQL resolver that does not require FE changes.

**Steps:**
1. Create feature branch in BE: `git checkout -b feat/<description>`
2. Implement change
3. Run BE quality gate (see `.ai/development.md`)
4. Commit, push, create PR: `gh pr create`
5. If GraphQL schema changed: run `pnpm run schema:export` and commit `schema.graphql`

---

## 2. Frontend-Only Change

**When:** UI/UX improvement, component refactor, or styling change that does not depend on API changes.

**Steps:**
1. Create feature branch in FE: `git checkout -b feat/<description>`
2. Run `pnpm run codegen` to ensure types are current
3. Implement change
4. Run FE quality gate (see `.ai/development.md`)
5. Commit, push, create PR: `gh pr create`

---

## 3. Full-Stack Change (API Contract Change)

**When:** New endpoint, changed response shape, new GraphQL query/field, or any change that requires coordinated BE + FE updates.

**Execution order:** BE first, then FE. Never merge a FE change that depends on an unmerged BE change.

**Steps:**

### Phase A: Backend

1. Create feature branch in BE: `git checkout -b feat/<description>`
2. Design the API contract (document endpoint shape)
3. Implement BE change (service + controller/resolver + DTOs)
4. If GraphQL schema changed: `pnpm run schema:export`, commit `schema.graphql`
5. Run BE quality gate
6. Commit, push, create PR:
   ```bash
   cd cloudtalk_homework_be
   gh pr create --title "feat(<scope>): <subject>"
   ```
7. Merge BE PR to main

### Phase B: Frontend

1. Create matching feature branch in FE: `git checkout -b feat/<description>`
2. Run `pnpm run codegen` to pick up the new schema
3. Implement FE change (service + component + template)
4. Run FE quality gate
5. Commit, push, create PR:
   ```bash
   cd cloudtalk_homework_fe
   gh pr create --title "feat(<scope>): <subject>" --body "Related: cloudtalk_homework_be#<PR>"
   ```
6. Merge FE PR to main

---

## 4. Database Migration

**When:** Adding/modifying columns, tables, or indexes.

**Steps:**
1. Edit `prisma/schema.prisma` in BE repo
2. Run `pnpm run migrate:local` — creates migration file + applies + seeds
3. Run `pnpm run generate` to update Prisma Client
4. Update services/DTOs that use the changed model
5. If the change affects GraphQL types, update models and run `pnpm run schema:export`
6. Follow the appropriate workflow above (backend-only or full-stack)

---

## 5. GraphQL Schema Update

**When:** Adding a new query, field, or type to the GraphQL schema.

**Steps:**
1. In BE: Add/modify `@ObjectType`, `@Field`, `@Resolver`, `@Query` decorators
2. Run `pnpm run schema:export` — generates `schema.graphql`
3. Commit `schema.graphql` with the BE changes
4. In FE: Run `pnpm run codegen` — regenerates `src/generated/graphql.ts`
5. Update FE query documents in `features/<domain>/graphql/<domain>.queries.ts`
6. Follow the full-stack workflow (Workflow 3)

---

## Workflow Selection Guide

| Task Type | Workflow | Key Rule |
|-----------|---------|----------|
| API endpoint change | 3 (Full-Stack) | BE merged before FE |
| UI-only improvement | 2 (FE-Only) | Ensure codegen is current |
| Service logic fix | 1 (BE-Only) | Export schema if resolvers changed |
| Database schema change | 4 (Migration) | Always migrate before updating services |
| New GraphQL field | 5 (Schema Update) | Export → codegen → update queries |

## General Coordination Rules

1. **Producer-first:** The backend is always the producer — merge BE before FE
2. **Matching branches:** Use the same branch name pattern across both repos
3. **Linked PRs:** Reference related PRs in descriptions using `<repo>#<number>`
4. **Same commit scope:** Use the same `(<scope>)` in both repos' commit messages
5. **Schema as contract:** `schema.graphql` is the single source of truth for the GraphQL API
