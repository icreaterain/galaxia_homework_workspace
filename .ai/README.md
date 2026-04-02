# .ai/ — Agent-Agnostic AI Configuration

This directory contains AI agent guidance for the cloudtalk_homework workspace. The contents are designed to work with any AI coding assistant (Cursor, Claude Code, GitHub Copilot, Windsurf, etc.) — no IDE-specific format is used.

## Structure

```
.ai/
├── README.md              ← you are here
├── development.md         ← commands, quality gates, scripts reference
├── workflows.md           ← cross-repo workflow patterns
├── rules/                 ← coding standards (applied by file scope)
│   ├── project-conventions.md    ← commit messages, file naming, API split (all files)
│   ├── typescript-standards.md   ← error handling, no-any, return types (*.ts)
│   ├── angular-patterns.md       ← components, services, Apollo, testing (FE *.ts)
│   └── api-design.md             ← REST/GraphQL conventions, auth, validation (BE *.ts)
└── skills/                ← multi-step workflow guides
    ├── graphql-schema-sync/SKILL.md   ← keeping schema.graphql in sync (export + codegen)
    ├── cross-repo-change/SKILL.md     ← coordinating BE + FE changes
    ├── extend-agentic-docs/SKILL.md   ← maintaining workspace documentation
    ├── start-task/SKILL.md            ← initialize a task with branches + plan
    └── finish-task/SKILL.md           ← quality checks, commit, PR creation (uses gh)
```

## How Agents Should Use This

1. **Entry point:** Start with `AGENTS.md` at the workspace root — it provides the full project overview and links here
2. **Rules:** Read the relevant rule file based on the file scope you're working in
3. **Skills:** When performing a multi-step workflow, read the matching skill before starting
4. **Development:** Reference `development.md` for commands and quality gate sequences
5. **Workflows:** Reference `workflows.md` when a change spans multiple repositories

## Relationship to Other Docs

| File | Purpose | Location |
|------|---------|----------|
| `AGENTS.md` | Universal AI agent entry point | workspace root |
| `ARCHITECTURE.md` | Current system state (stack, schema, API) | workspace root |
| `WORKSPACE.md` | Developer + agent onboarding | workspace root |
| `adr/` | Architecture Decision Records (rationale) | workspace root |
| `.ai/` | Agent rules, skills, and guides | this directory |
