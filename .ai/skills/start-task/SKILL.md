# Start Task

Initializes a development task by analyzing scope, creating feature branches, and presenting a plan. Use at the beginning of any non-trivial feature or bug fix.

## Input

A task description, GitHub issue number, or feature name.

## Workflow

### Step 1: Fetch Context

If a GitHub issue number is provided, fetch the issue:
```bash
gh issue view <number> --json title,body,labels,assignees
```

Extract title, description, acceptance criteria. Identify scope and affected repositories.

If no issue number: use the task description to determine scope.

### Step 2: Analyze Scope

Determine which repositories are affected:

- **cloudtalk_homework_be**: Changes to API endpoints, database schema, services, auth, or GraphQL resolvers
- **cloudtalk_homework_fe**: Changes to Angular components, services, routing, templates, or GraphQL queries

Cross-reference the dependency direction:
```
cloudtalk_homework_fe  →  depends on  →  cloudtalk_homework_be
```

If both repos are affected, the BE change must go first (see `.ai/skills/cross-repo-change/SKILL.md`).

### Step 3: Create Feature Branches

For each affected repository:
```bash
cd <repo>
git checkout main
git pull origin main
git checkout -b feat/<kebab-case-description>
```

Branch naming: `feat/<description>` or `fix/<description>`.

### Step 4: Present Plan

```
## Task: <title>

**Scope:** frontend-only | backend-only | full-stack
**Repositories:** <list>
**Branches created:** <list>

**Planned changes:**
- cloudtalk_homework_be: <description>
- cloudtalk_homework_fe: <description>

**Execution order:** <BE first if cross-repo, otherwise parallel>

Ready to proceed?
1. Approve and start implementation
2. Modify plan
```
