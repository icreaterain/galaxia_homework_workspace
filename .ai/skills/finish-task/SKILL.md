# Finish Task

Completes a development task by running quality checks, committing, and creating pull requests. Use after implementation is done and ready for review.

## Input

A branch name or task description.

## Workflow

### Step 1: Identify Changes

For each repository, check for uncommitted changes:
```bash
cd cloudtalk_homework_be && git status && git diff --stat
cd cloudtalk_homework_fe && git status && git diff --stat
```

### Step 2: Run Quality Checks

For each repository with changes, run the full quality gate:

**cloudtalk_homework_be:**
```bash
cd cloudtalk_homework_be
pnpm exec tsc --noEmit
pnpm run lint:check
pnpm run format:check
pnpm test
pnpm run test:e2e
```

**cloudtalk_homework_fe:**
```bash
cd cloudtalk_homework_fe
pnpm run codegen
pnpm exec tsc --noEmit -p tsconfig.app.json
pnpm exec tsc --noEmit -p tsconfig.spec.json
pnpm run lint:check
pnpm run format:check
pnpm run test:ci
```

Present results:
```
## Quality Results

| Repository | Types | Lint | Format | Tests | Status |
|-----------|-------|------|--------|-------|--------|
| BE        |  ✅   |  ✅  |   ✅   |  ✅   |  PASS  |
| FE        |  ✅   |  ✅  |   ✅   |  ✅   |  PASS  |
```

### Step 3: Commit Changes

For each repository with changes:
```bash
cd <repo>
git add <specific files>
git commit -m "<type>(<scope>): <lower-case subject>"
git push -u origin <branch-name>
```

Follow commit conventions from `.ai/rules/project-conventions.md`:
- Subject must be entirely lower-case
- Scopes: `auth` `reviews` `products` `db` `api` `health` `common` (BE) / `auth` `reviews` `products` `shared` `graphql` `fe` (FE)

### Step 4: Create Pull Requests

For each repository with changes:
```bash
cd <repo>
gh pr create \
  --title "<type>(<scope>): <lower-case subject>" \
  --body "$(cat <<'EOF'
## Summary
<1-3 bullet points describing the change>

## Changes
- <file-level summary>

## Testing
- All quality checks passing
- Tests: <N> passing

## Checklist
- [ ] Types pass (`tsc --noEmit`)
- [ ] Lint passes (`lint:check`)
- [ ] All tests pass
- [ ] Documentation updated (if applicable)
EOF
)"
```

If this is a cross-repo change, add a note linking the related PR:
```
**Related:** <repo>#<PR number>
```

### Step 5: Present Summary

```
## Task Complete

**Pull Requests:**
- cloudtalk_homework_be: <PR URL>
- cloudtalk_homework_fe: <PR URL>

**Quality:** All checks passing
**Branch:** <branch-name>
```
